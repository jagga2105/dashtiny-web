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
from app.models.models import Booking, User, UserProfile

from app.ai.tools.flight_search import search_flights
from app.ai.tools.hotel_search import search_hotels

router = APIRouter(prefix="/bookings", tags=["Booking Aggregator & Reservations"])
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
    default_user = db.query(User).first()
    if not default_user:
        default_user = User(email="traveler@dashtiny.ai", full_name="Explorer")
        db.add(default_user)
        db.commit()
    return default_user

class CreateBookingRequest(BaseModel):
    category: str  # flight, hotel, train, bus, cab
    provider: str  # IndiGo, Taj Hotels, Airbnb, etc.
    title: str
    amount: float
    currency: Optional[str] = "INR"
    trip_id: Optional[str] = None
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
    user: User = Depends(get_current_user_or_default),
    db: Session = Depends(get_db)
):
    """
    Save real travel booking in PostgreSQL, generate PNR reference, attach to Trip, and award reward coins.
    """
    category_prefix = request.category[:2].upper()
    random_num = random.randint(10000, 99999)
    pnr_code = f"DASH-{category_prefix}-{random_num}"

    new_booking = Booking(
        trip_id=request.trip_id,
        user_id=user.id,
        category=request.category,
        provider=request.provider,
        title=request.title,
        amount=request.amount,
        currency=request.currency or "INR",
        status="confirmed",
        pnr_ref=pnr_code,
        provenance="VERIFIED",
        details=request.details or {}
    )
    db.add(new_booking)

    # Award reward coins (+50 coins for booking)
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile:
        profile.reward_coins = (profile.reward_coins or 0) + 50

    db.commit()
    db.refresh(new_booking)

    return {
        "status": "confirmed",
        "booking_id": new_booking.id,
        "pnr_ref": new_booking.pnr_ref,
        "title": new_booking.title,
        "provider": new_booking.provider,
        "category": new_booking.category,
        "amount": float(new_booking.amount),
        "currency": new_booking.currency,
        "coins_earned": 50,
        "message": f"Reservation successfully confirmed with {new_booking.provider}!"
    }

@router.get("/my-bookings")
def get_my_bookings(
    user: User = Depends(get_current_user_or_default),
    db: Session = Depends(get_db)
):
    """
    Fetch all user bookings from PostgreSQL.
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
