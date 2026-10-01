import random
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import Booking, User, UserProfile, Itinerary, SquadRoom, SquadMember
from app.api.deps import get_current_user

from app.ai.tools.flight_search import search_flights
from app.ai.tools.hotel_search import search_hotels

router = APIRouter(prefix="/bookings", tags=["Booking Aggregator & Reservations"])

class CreateBookingRequest(BaseModel):
    category: str  # flight, hotel, train, bus, cab
    provider: str  # IndiGo, Taj Hotels, Airbnb, etc.
    title: str
    amount: float
    currency: Optional[str] = "INR"
    trip_id: Optional[str] = None
    pnr_ref: Optional[str] = None
    details: Optional[dict] = None

@router.get("/search/flights")
def search_flights_endpoint(origin: str = "BLR", destination: str = "GOI"):
    """
    Search and normalize live flight inventory into FlightOffer schema.
    """
    return search_flights(origin, destination)

@router.get("/search/hotels")
def search_hotels_endpoint(destination: str = "Goa", guests: int = 2):
    """
    Search and normalize live stays inventory into HotelOffer schema.
    """
    return search_hotels(destination, guests=guests)

@router.post("/create")
def create_booking(
    request: CreateBookingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save real travel booking reference in PostgreSQL, validate trip ownership, and attach to Trip.
    """
    # Verify Trip ownership / membership if trip_id is provided
    if request.trip_id:
        trip = db.query(Itinerary).filter(Itinerary.id == request.trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        is_owner = (trip.owner_id == user.id)
        squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == trip.id).first()
        is_member = False
        if squad:
            is_member = db.query(SquadMember).filter(
                SquadMember.squad_id == squad.id,
                SquadMember.user_id == user.id
            ).first() is not None
        if not (is_owner or is_member):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to attach bookings to this trip."
            )

    category_prefix = request.category[:2].upper()
    random_num = random.randint(10000, 99999)
    pnr_code = request.pnr_ref or f"DASH-REF-{category_prefix}-{random_num}"

    new_booking = Booking(
        trip_id=request.trip_id,
        user_id=user.id,
        category=request.category,
        provider=request.provider,
        title=request.title,
        amount=request.amount,
        currency=request.currency or "INR",
        status="saved_reference",
        pnr_ref=pnr_code,
        provenance="PROVIDER_VERIFIED",
        details=request.details or {}
    )
    db.add(new_booking)

    # Award reward coins (+50 coins for saving booking reference)
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile:
        profile.reward_coins = (profile.reward_coins or 0) + 50

    db.commit()
    db.refresh(new_booking)

    return {
        "status": "saved_reference",
        "booking_id": new_booking.id,
        "pnr_ref": new_booking.pnr_ref,
        "title": new_booking.title,
        "provider": new_booking.provider,
        "category": new_booking.category,
        "amount": float(new_booking.amount),
        "currency": new_booking.currency,
        "coins_earned": 50,
        "message": f"Booking reference successfully saved to your trip workspace for {new_booking.provider}!"
    }

@router.get("/my-bookings")
def get_my_bookings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all user bookings strictly belonging to the authenticated traveler.
    """
    bookings = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()
    return [
        {
            "id": b.id,
            "category": b.category,
            "provider": b.provider,
            "title": b.title,
            "amount": float(b.amount),
            "currency": b.currency,
            "status": b.status,
            "pnr_ref": b.pnr_ref,
            "created_at": str(b.created_at),
            "details": b.details
        }
        for b in bookings
    ]
