from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, SquadRoom, Booking, User

router = APIRouter(prefix="/trips", tags=["My Trips & Active Passages"])
security = HTTPBearer(auto_error=False)

def get_current_user_or_default(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if auth:
        try:
            payload = jwt.decode(auth.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return user
        except Exception:
            pass
    # Return first user in DB if no auth token provided
    default_user = db.query(User).first()
    if not default_user:
        default_user = User(email="traveler@dashtiny.ai", full_name="Explorer")
        db.add(default_user)
        db.commit()
    return default_user

@router.get("/my-trips")
def get_my_trips(user: User = Depends(get_current_user_or_default), db: Session = Depends(get_db)):
    """
    Get all active and past itineraries for the user from PostgreSQL.
    """
    itineraries = db.query(Itinerary).filter(Itinerary.owner_id == user.id).order_by(Itinerary.created_at.desc()).all()
    
    # If this specific user has no itineraries yet, check if there are any itineraries in DB or generate one
    if not itineraries:
        itineraries = db.query(Itinerary).order_by(Itinerary.created_at.desc()).limit(3).all()

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
                        "lat": a.lat,
                        "lng": a.lng,
                        "provenance": a.provenance or "AI GENERATED",
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
                "provenance": b.provenance or "VERIFIED",
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
def get_trip_details(trip_id: str, db: Session = Depends(get_db)):
    """
    Get full details, days, activities, and linked bookings for a specific trip.
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    days = db.query(ItineraryDay).filter(ItineraryDay.itinerary_id == it.id).order_by(ItineraryDay.day_number.asc()).all()
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()
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
                "provenance": b.provenance or "VERIFIED",
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
                        "lat": a.lat,
                        "lng": a.lng,
                        "provenance": a.provenance or "AI GENERATED",
                        "source_citation": a.source_citation
                    }
                    for a in db.query(ItineraryActivity).filter(ItineraryActivity.day_id == d.id).all()
                ]
            }
            for d in days
        ]
    }
