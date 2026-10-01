from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
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
