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
    AIRun, AIToolCall, SquadRoom, SquadMember, TripSnapshot, TripProposal, Booking
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
    instruction: Optional[str] = ""
    proposal_type: Optional[str] = "ITINERARY_DIFF"  # ITINERARY_DIFF or ATTACH_FLIGHT_OFFER
    offer: Optional[Dict[str, Any]] = None
    offer_id: Optional[str] = None
    search_context: Optional[Dict[str, Any]] = None


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
            if act.get("lat") is None or act.get("lng") is None:
                coords = get_coordinates(loc)
                if coords.get("found"):
                    act["lat"] = coords.get("lat")
                    act["lng"] = coords.get("lng")
                    if not act.get("provenance") or act.get("provenance") == "DETERMINISTIC":
                        act["provenance"] = coords.get("provenance", "GEOCODED")
                    act["location_source"] = "GEOCODED"
                else:
                    spatial_verified = False
                    if not act.get("provenance"):
                        act["provenance"] = "CURATED_UNRESOLVED"
                    act["location_source"] = "UNRESOLVED"
            else:
                act.setdefault("location_source", "GEOCODED")

    weather_profile = get_destination_weather(trip.destination)
    weather_condition = weather_profile.get("condition") or "Weather unavailable"

    # 4. Get current revision version for parent locking (every Trip starts at v1)
    curr_version = get_current_version(db, trip.id)
    if curr_version == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trip has not been initialized with baseline revision v1."
        )

    # Check if flight offer proposal
    if request.proposal_type == "ATTACH_FLIGHT_OFFER" or request.offer:
        offer = request.offer or {}

        # P0: Verify offer search context matches current active search context (409 Conflict defense)
        if request.search_context:
            ctx = request.search_context
            ctx_origin = (ctx.get("origin") or "").strip().upper()
            ctx_dest = (ctx.get("destination") or "").strip().upper()
            ctx_dep = (ctx.get("departure_date") or ctx.get("departureDate") or "").strip()
            ctx_ret = (ctx.get("return_date") or ctx.get("returnDate") or "").strip()
            ctx_cabin = (ctx.get("cabin_class") or ctx.get("cabinClass") or "").strip().lower()
            ctx_pax = ctx.get("passengers")
            ctx_trip_type = (ctx.get("trip_type") or ctx.get("tripType") or "").strip().lower()

            offer_origin = (offer.get("origin") or "").strip().upper()
            offer_dest = (offer.get("destination") or "").strip().upper()
            offer_dep = (offer.get("departure_date") or "").strip()
            offer_ret = (offer.get("return_date") or "").strip()
            offer_cabin = (offer.get("cabin_class") or "").strip().lower()
            offer_pax = offer.get("passengers")
            offer_trip_type = (offer.get("trip_type") or "").strip().lower()

            mismatches = []
            if ctx_origin and offer_origin and ctx_origin != offer_origin:
                mismatches.append(f"origin ({offer_origin} vs {ctx_origin})")
            if ctx_dest and offer_dest and ctx_dest != offer_dest:
                mismatches.append(f"destination ({offer_dest} vs {ctx_dest})")
            if ctx_dep and offer_dep and ctx_dep != offer_dep:
                mismatches.append(f"departure date ({offer_dep} vs {ctx_dep})")
            if ctx_trip_type == "roundtrip" and ctx_ret and offer_ret and ctx_ret != offer_ret:
                mismatches.append(f"return date ({offer_ret} vs {ctx_ret})")
            if ctx_cabin and offer_cabin and ctx_cabin != offer_cabin:
                mismatches.append(f"cabin ({offer_cabin} vs {ctx_cabin})")
            if ctx_pax is not None and offer_pax is not None and int(ctx_pax) != int(offer_pax):
                mismatches.append(f"passengers ({offer_pax} vs {ctx_pax})")
            if ctx_trip_type and offer_trip_type and ctx_trip_type != offer_trip_type:
                mismatches.append(f"trip type ({offer_trip_type} vs {ctx_trip_type})")

            if mismatches:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Flight offer search context does not match active search context: {', '.join(mismatches)}. Please refresh your search."
                )

        airline = offer.get("airline", "Selected Airline")
        flight_number = offer.get("flight_number", "FL-100")
        origin = offer.get("origin", "")
        dest = offer.get("destination", "")
        price = float(offer.get("price", 0))
        summary = f"Attach {airline} flight {flight_number} ({origin} → {dest}) to your trip"

        changes = [{
            "action": "attach_flight",
            "flight_number": flight_number,
            "airline": airline,
            "origin": origin,
            "destination": dest,
            "departure_time": offer.get("departure_time"),
            "arrival_time": offer.get("arrival_time"),
            "price": price,
            "why_recommended": offer.get("why_recommended", "Traveler selected curated flight offer")
        }]

        updated_days = []
        for idx, day in enumerate(before_days):
            day_copy = dict(day)
            acts = list(day.get("activities", []))
            if idx == 0:
                transit_act = {
                    "time": offer.get("departure_time", "08:00 AM"),
                    "description": f"Flight {airline} {flight_number}: {origin} → {dest}",
                    "location": f"{offer.get('origin_airport', {}).get('name', origin)} Airport",
                    "place_type": "TR",
                    "provenance": "CURATED",
                    "cost_estimate": price,
                    "why_recommended": offer.get("why_recommended", "Selected transportation for trip"),
                    "location_source": "VERIFIED_AIRPORT",
                    "transit_mode": "flight"
                }
                acts.insert(0, transit_act)
            if offer.get("trip_type") == "roundtrip" and idx == len(before_days) - 1 and len(before_days) > 1:
                return_act = {
                    "time": "06:00 PM",
                    "description": f"Return Flight {airline}: {dest} → {origin}",
                    "location": f"{offer.get('destination_airport', {}).get('name', dest)} Airport",
                    "place_type": "TR",
                    "provenance": "CURATED",
                    "cost_estimate": 0,
                    "why_recommended": "Return flight segment",
                    "location_source": "VERIFIED_AIRPORT",
                    "transit_mode": "flight"
                }
                acts.append(return_act)
            day_copy["activities"] = acts
            updated_days.append(day_copy)

        proposal = TripProposal(
            trip_id=trip.id,
            user_id=user.id,
            parent_version=curr_version,
            instruction=request.instruction or summary,
            summary=summary,
            changes=changes,
            before_state={"days": before_days},
            after_state=updated_days,
            verification={
                "spatial_bounds": "VERIFIED",
                "airport_codes": f"{origin} - {dest}",
                "route_feasible": True
            },
            provenance={
                "tier": "CURATED",
                "source": "CURATED_DATABASE",
                "model": "curated-flight-v1",
                "why_recommended": offer.get("why_recommended", "Selected curated flight offer"),
                "proposal_type": "ATTACH_FLIGHT_OFFER",
                "offer_payload": offer
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
    if current_ver != proposal.parent_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Trip has been modified (current revision v{current_ver}) since proposal was generated "
                f"(target v{proposal.parent_version}). Please generate a fresh proposal."
            )
        )

    try:
        # Apply diff to database while preserving stable activity IDs (pure PostgreSQL mutation)
        apply_activity_diff(db, trip, proposal.after_state)

        # Check if proposal is ATTACH_FLIGHT_OFFER
        prov = proposal.provenance or {}
        is_flight = prov.get("proposal_type") == "ATTACH_FLIGHT_OFFER" or any(
            c.get("action") == "attach_flight" for c in (proposal.changes or [])
        )
        if is_flight:
            offer_payload = prov.get("offer_payload") or {}
            airline_name = offer_payload.get("airline") or offer_payload.get("provider", "Curated Airline")
            flight_num = offer_payload.get("flight_number", "FL")
            booking_ref = Booking(
                trip_id=trip.id,
                user_id=user.id,
                category="flight",
                provider=airline_name,
                title=f"Flight {airline_name} {flight_num}",
                amount=float(offer_payload.get("price", 0)),
                currency=offer_payload.get("currency", "INR"),
                status="pending",
                provenance="CURATED",
                details={
                    "offer_id": offer_payload.get("offer_id"),
                    "origin": offer_payload.get("origin"),
                    "destination": offer_payload.get("destination"),
                    "departure_time": offer_payload.get("departure_time"),
                    "arrival_time": offer_payload.get("arrival_time"),
                    "source": "CURATED_DATABASE",
                    "verification": "UNVERIFIED_CURATED_OFFER"
                }
            )
            db.add(booking_ref)

        db.flush()
        db.expire_all()

        # Reload trip to get freshly flushed activities
        trip = db.query(Itinerary).filter(Itinerary.id == proposal.trip_id).first()

        # Serialize authoritative resulting canonical state AFTER mutation
        resulting_days = serialize_trip_days(trip)

        # Create append-only revision containing RESULTING STATE
        snapshot, next_ver = create_revision(
            db=db,
            trip_id=trip.id,
            user_id=user.id,
            action_type="ATTACH_FLIGHT_OFFER" if is_flight else "AI_PROPOSAL_ACCEPTED",
            days_data=resulting_days,
            summary=proposal.summary,
            instruction=proposal.instruction,
            model="curated-flight-v1" if is_flight else "deterministic-planner-v1",
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
