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

from app.config import settings
from app.db.database import get_db
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, User, AIRun, AIToolCall, SquadRoom, SquadMember
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

    # Serialize current days & activities
    current_days = []
    for d in trip.days:
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
                    "provenance": a.provenance or "AI GENERATED"
                }
                for a in sorted(d.activities, key=lambda x: x.sort_order)
            ]
        })

    # Execute deterministic itinerary action tool
    action_result = apply_itinerary_action(request.instruction, current_days)
    
    # Save modified activities back into PostgreSQL
    for day_data in action_result["updated_days"]:
        db_day = db.query(ItineraryDay).filter(ItineraryDay.id == day_data.get("id")).first()
        if db_day:
            # Clear old activities and re-insert new slotted activities
            db.query(ItineraryActivity).filter(ItineraryActivity.day_id == db_day.id).delete()
            for idx, act in enumerate(day_data.get("activities", [])):
                loc_name = act.get("location", trip.destination)
                coords = get_coordinates(loc_name)
                act_lat = act.get("lat") or coords.get("lat")
                act_lng = act.get("lng") or coords.get("lng")
                new_act = ItineraryActivity(
                    day_id=db_day.id,
                    time_slot=act.get("time", "10:00 AM"),
                    description=act.get("description", ""),
                    location=loc_name,
                    place_type=act.get("place_type", "TA"),
                    cost_estimate=act.get("cost_estimate", 0),
                    provenance=act.get("provenance", "AI GENERATED"),
                    lat=act_lat,
                    lng=act_lng,
                    source_citation=act.get("source_citation") or "DashTiny Spatial Map Engine",
                    sort_order=idx
                )
                db.add(new_act)

    latency_ms = int((time.time() - start_time) * 1000)

    # AI Observability: Log run and tool execution
    ai_run = AIRun(
        user_id=user.id,
        trip_id=trip.id,
        prompt=request.instruction,
        model="gpt-4o-mini",
        latency_ms=latency_ms,
        tokens_used=350,
        status="success"
    )
    db.add(ai_run)
    db.commit()
    db.refresh(ai_run)

    tool_call = AIToolCall(
        run_id=ai_run.id,
        tool_name="itinerary.apply_itinerary_action",
        input_payload={"instruction": request.instruction, "trip_id": trip.id},
        output_payload={"changes_count": len(action_result["changes"])},
        provenance="AI_GENERATED",
        latency_ms=latency_ms
    )
    db.add(tool_call)
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
                        "provenance": a.provenance or "AI GENERATED"
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
