"""
DashTiny AI Action & Diff Service (POST /api/v1/ai/query)
Implements conversational action model returning structured diffs with full AI observability.
"""
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt

from sqlalchemy import func
from app.config import settings
from app.db.database import get_db
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, User, AIRun, AIToolCall, SquadRoom, SquadMember, TripSnapshot
from app.ai.tools.itinerary import apply_itinerary_action
from app.ai.tools.weather import get_destination_weather
from app.ai.tools.hotel_search import search_hotels
from app.ai.tools.flight_search import search_flights
from app.ai.tools.maps import get_coordinates
from app.api.deps import get_current_user

router = APIRouter(prefix="/ai", tags=["DashTiny AI Action & Diff Engine"])

class AIQueryRequest(BaseModel):
    trip_id: str
    instruction: str

@router.post("/query")
def ai_query(
    request: AIQueryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Experience-First Conversational / Action Endpoint.
    Modifies specific trip items, recalculates pacing/budget, logs AI tool runs,
    persists updates to PostgreSQL, and returns what changed ({ "changes": [...] }).
    Enforces strict user ownership: only the owner or squad member can modify the trip.
    All changes, snapshots, and telemetry are executed within a single atomic database transaction.
    Existing activities preserve their persistent identity (diff-based persistence).
    """
    start_time = time.time()
    
    trip = db.query(Itinerary).filter(Itinerary.id == request.trip_id).first()
    if not trip:
        if request.trip_id in ["latest", "", None]:
            trip = db.query(Itinerary).filter(Itinerary.owner_id == user.id).order_by(Itinerary.created_at.desc()).first()
        else:
            raise HTTPException(status_code=404, detail="Trip not found")
    
    if not trip:
        raise HTTPException(status_code=404, detail="No active trip found to modify")

    # Enforce data ownership
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

    # Serialize current days & activities for rollback snapshot
    current_days = []
    for d in sorted(trip.days, key=lambda x: x.day_number):
        current_days.append({
            "id": d.id,
            "day_number": d.day_number,
            "title": d.title,
            "weather": d.weather_summary,
            "activities": [
                {
                    "id": a.id,
                    "time": a.time_slot,
                    "description": a.description,
                    "location": a.location,
                    "place_type": a.place_type,
                    "estimated_transit": a.estimated_transit,
                    "cost_estimate": float(a.cost_estimate or 0),
                    "provenance": a.provenance or "DETERMINISTIC",
                    "lat": a.lat,
                    "lng": a.lng,
                    "source_citation": a.source_citation,
                    "why_recommended": a.why_recommended,
                    "generation_source": a.generation_source,
                    "location_source": a.location_source,
                    "content_source": a.content_source,
                    "sort_order": a.sort_order
                }
                for a in sorted(d.activities, key=lambda x: x.sort_order)
            ]
        })

    # Save a versioned rollback snapshot prior to applying changes
    max_ver = db.query(func.max(TripSnapshot.version)).filter(TripSnapshot.trip_id == trip.id).scalar() or 0
    snapshot = TripSnapshot(
        trip_id=trip.id,
        version=max_ver + 1,
        user_id=user.id,
        action="ai_query",
        summary=f"Snapshot v{max_ver + 1} before: {request.instruction[:60]}",
        days_data=current_days
    )
    db.add(snapshot)

    # Execute deterministic itinerary action tool
    action_result = apply_itinerary_action(request.instruction, current_days)
    
    # Diff-based activity persistence: preserves stable activity identity
    for day_data in action_result["updated_days"]:
        db_day = db.query(ItineraryDay).filter(ItineraryDay.id == day_data.get("id")).first()
        if db_day:
            existing_acts = {a.id: a for a in db_day.activities}
            retained_act_ids = set()

            for idx, act in enumerate(day_data.get("activities", [])):
                act_id = act.get("id")
                loc_name = act.get("location", trip.destination)
                coords = get_coordinates(loc_name)
                act_lat = act.get("lat") or coords.get("lat")
                act_lng = act.get("lng") or coords.get("lng")
                act_prov = act.get("provenance") or (coords.get("provenance") if coords.get("found") else "CURATED_UNRESOLVED")

                if act_id and act_id in existing_acts:
                    # UPDATE existing activity in-place: preserves ID for bookings, comments, references
                    db_act = existing_acts[act_id]
                    db_act.time_slot = act.get("time", db_act.time_slot or "10:00 AM")
                    db_act.description = act.get("description", db_act.description)
                    db_act.location = loc_name
                    db_act.place_type = act.get("place_type", db_act.place_type or "TA")
                    db_act.cost_estimate = act.get("cost_estimate", db_act.cost_estimate or 0)
                    db_act.provenance = act_prov
                    db_act.lat = act_lat
                    db_act.lng = act_lng
                    if act.get("source_citation"):
                        db_act.source_citation = act.get("source_citation")
                    if act.get("why_recommended"):
                        db_act.why_recommended = act.get("why_recommended")
                    db_act.sort_order = idx
                    retained_act_ids.add(act_id)
                else:
                    # INSERT new activity
                    new_act = ItineraryActivity(
                        day_id=db_day.id,
                        time_slot=act.get("time", "10:00 AM"),
                        description=act.get("description", ""),
                        location=loc_name,
                        place_type=act.get("place_type", "TA"),
                        cost_estimate=act.get("cost_estimate", 0),
                        provenance=act_prov,
                        lat=act_lat,
                        lng=act_lng,
                        source_citation=act.get("source_citation") or "DashTiny Spatial Map Engine",
                        why_recommended=act.get("why_recommended"),
                        sort_order=idx
                    )
                    db.add(new_act)
                    db.flush()  # assign generated ID
                    retained_act_ids.add(new_act.id)

            # DELETE removed activities
            for act_id, act_obj in existing_acts.items():
                if act_id not in retained_act_ids:
                    db.delete(act_obj)

    latency_ms = int((time.time() - start_time) * 1000)

    # AI Observability: Single atomic transaction boundary
    ai_run = AIRun(
        user_id=user.id,
        trip_id=trip.id,
        prompt=request.instruction,
        model="deterministic-planner-v1",
        latency_ms=latency_ms,
        tokens_used=0,
        status="success"
    )
    db.add(ai_run)
    db.flush()  # Obtain ai_run.id without committing transaction

    tool_call = AIToolCall(
        run_id=ai_run.id,
        tool_name="itinerary.apply_itinerary_action",
        input_payload={"instruction": request.instruction, "trip_id": trip.id},
        output_payload={"changes_count": len(action_result["changes"])},
        provenance="AI_GENERATED",
        latency_ms=latency_ms
    )
    db.add(tool_call)

    # Commit snapshot, diff modifications, ai_run, and tool_call in one atomic transaction
    db.commit()

    # Re-fetch updated trip representation
    db.refresh(trip)
    updated_trip_payload = {
        "id": trip.id,
        "title": trip.title,
        "destination": trip.destination,
        "startDate": str(trip.start_date),
        "endDate": str(trip.end_date),
        "budget": float(trip.total_budget),
        "days": [
            {
                "id": d.id,
                "dayNumber": d.day_number,
                "title": d.title,
                "weather": d.weather_summary,
                "activities": [
                    {
                        "id": a.id,
                        "time": a.time_slot,
                        "description": a.description,
                        "location": a.location,
                        "placeType": a.place_type,
                        "costEstimate": float(a.cost_estimate or 0),
                        "provenance": a.provenance or "DETERMINISTIC"
                    }
                    for a in sorted(d.activities, key=lambda x: x.sort_order)
                ]
            }
            for d in sorted(trip.days, key=lambda x: x.day_number)
        ]
    }

    return {
        "status": "success",
        "trip_id": trip.id,
        "summary": action_result["summary"],
        "changes": action_result["changes"],
        "trip": updated_trip_payload
    }
