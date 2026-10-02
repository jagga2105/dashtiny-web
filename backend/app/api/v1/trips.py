from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, SquadRoom, SquadMember, Booking, User
from app.api.deps import get_current_user

router = APIRouter(prefix="/trips", tags=["My Trips & Active Passages"])

@router.get("/my-trips")
def get_my_trips(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get all active and past itineraries strictly owned by the authenticated user.
    """
    itineraries = db.query(Itinerary).filter(Itinerary.owner_id == user.id).order_by(Itinerary.created_at.desc()).all()

    results = []
    for it in itineraries:
        days = db.query(ItineraryDay).filter(ItineraryDay.itinerary_id == it.id).order_by(ItineraryDay.day_number.asc()).all()
        squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()

        formatted_days = []
        for d in days:
            acts = db.query(ItineraryActivity).filter(ItineraryActivity.day_id == d.id).order_by(ItineraryActivity.sort_order.asc()).all()
            formatted_days.append({
                "id": d.id,
                "dayNumber": d.day_number,
                "title": d.title,
                "coverImage": d.cover_image_url or "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
                "weather": d.weather_summary or "28°C Sunny ☀️",
                "activities": [
                    {
                        "id": a.id,
                        "time": a.time_slot,
                        "description": a.description,
                        "location": a.location,
                        "placeType": a.place_type,
                        "estimatedTransit": a.estimated_transit,
                        "crowdWarning": a.crowd_warning,
                        "costEstimate": float(a.cost_estimate or 0),
                        "lat": a.lat,
                        "lng": a.lng,
                        "provenance": a.provenance or "DETERMINISTIC",
                        "whyRecommended": a.why_recommended,
                        "source_citation": a.source_citation
                    }
                    for a in acts
                ]
            })

        # Fetch bookings linked to this specific trip
        trip_bookings = db.query(Booking).filter(Booking.trip_id == it.id).all()
        formatted_bookings = [
            {
                "id": b.id,
                "category": b.category,
                "provider": b.provider,
                "title": b.title,
                "amount": float(b.amount),
                "currency": b.currency,
                "status": b.status,
                "pnr_ref": b.pnr_ref,
                "provenance": b.provenance or "PROVIDER_VERIFIED",
                "created_at": str(b.created_at),
                "details": b.details
            }
            for b in trip_bookings
        ]

        results.append({
            "id": it.id,
            "title": it.title,
            "destination": it.destination,
            "startDate": str(it.start_date),
            "endDate": str(it.end_date),
            "budget": float(it.total_budget),
            "currency": it.currency,
            "persona": it.persona,
            "status": it.status,
            "squad_room_code": squad.room_code if squad else "DASH-ROOM",
            "daysCount": len(formatted_days),
            "days": formatted_days,
            "bookings": formatted_bookings
        })

    return results

@router.get("/{trip_id}")
def get_trip_details(
    trip_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get full details, days, activities, and linked bookings for a specific trip.
    Enforces data ownership: user must be the trip owner or a member of the trip squad.
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Enforce data ownership
    is_owner = (it.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()
    is_member = False
    if squad:
        is_member = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.user_id == user.id
        ).first() is not None
    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have access to this itinerary."
        )

    days = db.query(ItineraryDay).filter(ItineraryDay.itinerary_id == it.id).order_by(ItineraryDay.day_number.asc()).all()
    trip_bookings = db.query(Booking).filter(Booking.trip_id == it.id).all()

    return {
        "id": it.id,
        "title": it.title,
        "destination": it.destination,
        "startDate": str(it.start_date),
        "endDate": str(it.end_date),
        "budget": float(it.total_budget),
        "currency": it.currency,
        "persona": it.persona,
        "status": it.status,
        "squad_room_code": squad.room_code if squad else None,
        "bookings": [
            {
                "id": b.id,
                "category": b.category,
                "provider": b.provider,
                "title": b.title,
                "amount": float(b.amount),
                "currency": b.currency,
                "status": b.status,
                "pnr_ref": b.pnr_ref,
                "provenance": b.provenance or "PROVIDER_VERIFIED",
                "created_at": str(b.created_at),
                "details": b.details
            }
            for b in trip_bookings
        ],
        "days": [
            {
                "dayNumber": d.day_number,
                "title": d.title,
                "coverImage": d.cover_image_url,
                "weather": d.weather_summary,
                "activities": [
                    {
                        "id": a.id,
                        "time": a.time_slot,
                        "description": a.description,
                        "location": a.location,
                        "placeType": a.place_type,
                        "estimatedTransit": a.estimated_transit,
                        "crowdWarning": a.crowd_warning,
                        "costEstimate": float(a.cost_estimate or 0),
                        "lat": a.lat,
                        "lng": a.lng,
                        "provenance": a.provenance or "DETERMINISTIC",
                        "whyRecommended": a.why_recommended,
                        "source_citation": a.source_citation
                    }
                    for a in db.query(ItineraryActivity).filter(ItineraryActivity.day_id == d.id).all()
                ]
            }
            for d in days
        ]
    }

class AddActivityRequest(BaseModel):
    id: Optional[str] = None
    day_id: Optional[str] = None
    day_number: Optional[int] = 1
    time_slot: str = "10:00 AM"
    description: str
    location: Optional[str] = None
    place_type: Optional[str] = "TA"
    cost_estimate: Optional[float] = 0.0
    lat: Optional[float] = None
    lng: Optional[float] = None
    provenance: Optional[str] = "DETERMINISTIC"
    why_recommended: Optional[str] = None
    source_citation: Optional[str] = None

@router.delete("/{trip_id}/activities/{activity_id}")
def delete_trip_activity(
    trip_id: str,
    activity_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Persistently remove an itinerary activity from a trip.
    Enforces user data ownership and validates activity membership in the trip.
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    is_owner = (it.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()
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

    # Find the activity and verify it belongs to one of this trip's days
    activity = db.query(ItineraryActivity).filter(ItineraryActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    day = db.query(ItineraryDay).filter(ItineraryDay.id == activity.day_id).first()
    if not day or day.itinerary_id != it.id:
        raise HTTPException(status_code=400, detail="Activity does not belong to the specified trip")

    db.delete(activity)
    db.commit()

    return {
        "status": "success",
        "action": "deleted",
        "trip_id": trip_id,
        "activity_id": activity_id,
        "message": "Activity removed persistently from trip"
    }

@router.post("/{trip_id}/activities")
def add_trip_activity(
    trip_id: str,
    request: AddActivityRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add or restore an itinerary activity to a trip day.
    Used for user-initiated additions and undoing deletions.
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    is_owner = (it.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()
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

    # Locate destination day
    target_day = None
    if request.day_id:
        target_day = db.query(ItineraryDay).filter(
            ItineraryDay.id == request.day_id,
            ItineraryDay.itinerary_id == it.id
        ).first()

    if not target_day:
        target_day = db.query(ItineraryDay).filter(
            ItineraryDay.itinerary_id == it.id,
            ItineraryDay.day_number == (request.day_number or 1)
        ).first()

    if not target_day:
        # Fallback to first day
        target_day = db.query(ItineraryDay).filter(ItineraryDay.itinerary_id == it.id).order_by(ItineraryDay.day_number.asc()).first()

    if not target_day:
        raise HTTPException(status_code=404, detail="No days found in trip to attach activity")

    # Get max sort order in day
    current_count = db.query(ItineraryActivity).filter(ItineraryActivity.day_id == target_day.id).count()

    new_act = ItineraryActivity(
        id=request.id if request.id else None,
        day_id=target_day.id,
        time_slot=request.time_slot,
        description=request.description,
        location=request.location or it.destination,
        place_type=request.place_type or "TA",
        cost_estimate=request.cost_estimate or 0.0,
        provenance=request.provenance or "DETERMINISTIC",
        lat=request.lat,
        lng=request.lng,
        why_recommended=request.why_recommended or "Added to itinerary",
        source_citation=request.source_citation or "User Action",
        sort_order=current_count
    )
    db.add(new_act)
    db.commit()
    db.refresh(new_act)

    return {
        "status": "success",
        "action": "added",
        "activity": {
            "id": new_act.id,
            "dayId": new_act.day_id,
            "dayNumber": target_day.day_number,
            "time": new_act.time_slot,
            "description": new_act.description,
            "location": new_act.location,
            "placeType": new_act.place_type,
            "costEstimate": float(new_act.cost_estimate or 0),
            "lat": new_act.lat,
            "lng": new_act.lng,
            "provenance": new_act.provenance,
            "whyRecommended": new_act.why_recommended
        }
    }
