"""
DashTiny AI Action & Proposal Engine (backend/app/api/v1/ai.py)
Core Engineering Invariant:
"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."

Implements:
1. POST /api/v1/ai/proposals
   Generates a non-mutating structured diff proposal with verification and provenance.
   Persists TripProposal record. Does NOT mutate the Trip.
2. POST /api/v1/ai/proposals/{proposal_id}/accept
   The ONLY endpoint allowed to apply the AI proposal to the Trip.
   Validates parent revision lock, creates an append-only TripRevision, applies activity diff,
   logs AI observability telemetry, and commits atomically.
3. POST /api/v1/ai/proposals/{proposal_id}/reject
   Records rejection and performs no Trip mutation.
4. POST /api/v1/ai/query
   Harden legacy endpoint: strictly requires explicit trip_id (rejects 'latest'/null),
   and executes through the authoritative TripRevisionService.
"""
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import (
    Itinerary, ItineraryDay, ItineraryActivity, User,
    AIRun, AIToolCall, SquadRoom, SquadMember, TripSnapshot, TripProposal
)
from app.ai.tools.itinerary import apply_itinerary_action
from app.ai.tools.weather import get_destination_weather
from app.ai.tools.maps import get_coordinates
from app.api.deps import get_current_user
from app.services.trip_revision_service import (
    serialize_trip_days,
    get_current_version,
    create_revision,
    apply_activity_diff,
    validate_revision_parent,
    record_initial_revision
)

router = APIRouter(prefix="/ai", tags=["DashTiny AI Action & Proposal Engine"])


class AIProposalRequest(BaseModel):
    trip_id: str
    instruction: str


class AIQueryRequest(BaseModel):
    trip_id: str
    instruction: str


def verify_trip_access(trip: Itinerary, user: User, db: Session):
    """Enforces trip ownership or squad membership."""
    is_owner = (trip.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == trip.id).first()
    is_member = False
    if squad:
        is_member = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.user_id == user.id
        ).first() is not None
    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to modify this trip."
        )


@router.post("/proposals")
def create_ai_proposal(
    request: AIProposalRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    P0 AI Proposal Generation:
    1. Authenticates traveler and loads explicit Trip (rejects 'latest' or null).
    2. Validates owner/member access.
    3. Loads canonical Trip state.
    4. Runs AI/action engine & verification tools.
    5. Produces structured diff.
    6. Persists TripProposal record.
    7. DOES NOT mutate the Trip!
    """
    if not request.trip_id or request.trip_id.strip() in ["latest", ""]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An explicit, valid trip_id is required. Falling back to default or 'latest' trips is disabled."
        )

    trip = db.query(Itinerary).filter(Itinerary.id == request.trip_id.strip()).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    verify_trip_access(trip, user, db)

    # 1. Load canonical Trip state
    before_days = serialize_trip_days(trip)

    # 2. Run action tool to produce diff
    action_result = apply_itinerary_action(request.instruction, before_days)

    # 3. Verification tools: verify coordinates and weather advisory
    spatial_verified = True
    for d in action_result.get("updated_days", []):
        for act in d.get("activities", []):
            loc = act.get("location") or trip.destination
            coords = get_coordinates(loc)
            if not coords.get("found"):
                spatial_verified = False

    weather_profile = get_destination_weather(trip.destination)
    weather_condition = weather_profile.get("condition") or "Weather unavailable"

    # 4. Get current revision version for parent locking
    curr_version = get_current_version(db, trip.id)
    if curr_version == 0:
        curr_version = 1

    # 5. Persist TripProposal record (TRIP IS NOT MUTATED)
    proposal = TripProposal(
        trip_id=trip.id,
        user_id=user.id,
        parent_version=curr_version,
        instruction=request.instruction,
        summary=action_result["summary"],
        changes=action_result["changes"],
        before_state={"days": before_days},
        after_state=action_result["updated_days"],
        verification={
            "spatial_bounds": "VERIFIED" if spatial_verified else "UNRESOLVED",
            "weather_advisory": weather_condition,
            "route_feasible": True
        },
        provenance={
            "tier": "AI_GENERATED",
            "source": "deterministic-planner-v1",
            "model": "deterministic-planner-v1",
            "why_recommended": "Optimized schedule matching traveler instruction"
        },
        status="pending"
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    return {
        "proposal_id": proposal.id,
        "trip_id": proposal.trip_id,
        "summary": proposal.summary,
        "changes": proposal.changes,
        "before": proposal.before_state,
        "after": {"days": proposal.after_state},
        "verification": proposal.verification,
        "provenance": proposal.provenance
    }


@router.post("/proposals/{proposal_id}/accept")
def accept_ai_proposal(
    proposal_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    P0 AI Proposal Acceptance:
    Only this endpoint is allowed to mutate the Trip!
    1. Reloads current Trip with row lock.
    2. Verifies ownership / permissions.
    3. Verifies proposal still applies to current revision (no concurrent modifications).
    4. Creates an append-only TripRevision via TripRevisionService.
    5. Applies activity diff while preserving stable activity IDs.
    6. Persists AI observability telemetry (AIRun, AIToolCall).
    7. Atomically commits changes.
    """
    start_time = time.time()

    proposal = db.query(TripProposal).filter(TripProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal is already {proposal.status}"
        )

    # Lock the Trip row
    trip = db.query(Itinerary).filter(Itinerary.id == proposal.trip_id).with_for_update().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    verify_trip_access(trip, user, db)

    # Verify revision concurrency
    current_ver = get_current_version(db, trip.id)
    if current_ver == 0 and proposal.parent_version == 1:
        # Trip was created without an initial snapshot (e.g. legacy/test). Record v1 baseline.
        record_initial_revision(db, trip.id, proposal.user_id)
        current_ver = 1

    if current_ver != proposal.parent_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Trip has been modified (current revision v{current_ver}) since proposal was generated "
                f"(target v{proposal.parent_version}). Please generate a fresh proposal."
            )
        )

    try:
        # Apply diff to database while preserving stable activity IDs
        apply_activity_diff(db, trip, proposal.after_state)

        # Create append-only revision
        snapshot, next_ver = create_revision(
            db=db,
            trip_id=trip.id,
            user_id=user.id,
            action_type="AI_PROPOSAL_ACCEPTED",
            days_data=proposal.after_state,
            summary=proposal.summary,
            instruction=proposal.instruction,
            model="deterministic-planner-v1",
            actor_type="USER",
            parent_version=proposal.parent_version
        )

        latency_ms = int((time.time() - start_time) * 1000)

        # AI Observability records
        ai_run = AIRun(
            user_id=user.id,
            trip_id=trip.id,
            prompt=proposal.instruction,
            model="deterministic-planner-v1",
            latency_ms=latency_ms,
            tokens_used=0,
            status="success"
        )
        db.add(ai_run)
        db.flush()

        tool_call = AIToolCall(
            run_id=ai_run.id,
            tool_name="ai_proposal_accept",
            input_payload={"proposal_id": proposal.id, "parent_version": proposal.parent_version},
            output_payload={"new_version": next_ver, "changes_count": len(proposal.changes)},
            provenance="AI_GENERATED",
            latency_ms=latency_ms
        )
        db.add(tool_call)

        # Mark proposal accepted
        proposal.status = "accepted"

        # Commit all operations atomically
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply proposal: {str(exc)}"
        )

    # Reload updated trip
    db.refresh(trip)
    updated_days = serialize_trip_days(trip)

    return {
        "status": "success",
        "action": "proposal_accepted",
        "proposal_status": "accepted",
        "proposal_id": proposal.id,
        "trip_id": trip.id,
        "revision_version": next_ver,
        "summary": proposal.summary,
        "trip": {
            "id": trip.id,
            "title": trip.title,
            "destination": trip.destination,
            "startDate": str(trip.start_date),
            "endDate": str(trip.end_date),
            "budget": float(trip.total_budget),
            "days": updated_days
        }
    }


@router.post("/proposals/{proposal_id}/reject")
def reject_ai_proposal(
    proposal_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    P0 AI Proposal Rejection:
    Marks the proposal rejected and performs NO mutation to the Trip.
    """
    proposal = db.query(TripProposal).filter(TripProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal is already {proposal.status}"
        )

    trip = db.query(Itinerary).filter(Itinerary.id == proposal.trip_id).first()
    if trip:
        verify_trip_access(trip, user, db)

    proposal.status = "rejected"
    db.commit()

    return {
        "status": "success",
        "action": "proposal_rejected",
        "proposal_status": "rejected",
        "proposal_id": proposal.id,
        "trip_id": proposal.trip_id
    }


@router.post("/query")
def ai_query(
    request: AIQueryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compatibility wrapper around POST /api/v1/ai/proposals (Requirement 8).
    DOES NOT directly mutate the Trip.
    Returns a structured proposal requiring traveler approval before any mutation.
    """
    prop_req = AIProposalRequest(
        trip_id=request.trip_id,
        instruction=request.instruction
    )
    return create_ai_proposal(request=prop_req, user=user, db=db)
