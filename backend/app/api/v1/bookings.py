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
def search_flights_endpoint(
    origin: str = "BLR",
    destination: str = "GOI",
    departure_date: Optional[str] = None,
    return_date: Optional[str] = None,
    passengers: int = 1,
    cabin_class: str = "economy",
    trip_type: str = "roundtrip"
):
    """
    Search and normalize live flight inventory into FlightOffer schema.
    Consumes departure_date, return_date, passengers, cabin_class, and trip_type.
    """
    return search_flights(
        origin=origin,
        destination=destination,
        date=departure_date,
        return_date=return_date,
        passengers=passengers,
        cabin_class=cabin_class,
        trip_type=trip_type
    )

@router.get("/search/hotels")
def search_hotels_endpoint(
    destination: str = "Goa",
    guests: int = 2,
    check_in: Optional[str] = None,
    check_out: Optional[str] = None,
    room_type: Optional[str] = None
):
    """
    Search and normalize live stays inventory into HotelOffer schema.
    Consumes destination, guests, check_in, check_out, and room_type.
    """
    return search_hotels(
        destination=destination,
        guests=guests,
        check_in=check_in,
        check_out=check_out,
        room_type=room_type
    )

@router.post("/create")
def create_booking(
    request: CreateBookingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save travel booking reference in PostgreSQL, validate trip ownership, and attach to Trip.
    Truth boundary: User-provided booking reference carries status=saved_reference,
    provenance=SAVED_REFERENCE, source=USER_PROVIDED, verification=UNVERIFIED.
    Only partner-confirmed API webhooks carry PROVIDER_VERIFIED.
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

    merged_details = dict(request.details or {})
    merged_details.setdefault("source", "USER_PROVIDED")
    merged_details.setdefault("verification", "UNVERIFIED")

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
        provenance="SAVED_REFERENCE",
        details=merged_details
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
        "trip_id": new_booking.trip_id,
        "pnr_ref": new_booking.pnr_ref,
        "title": new_booking.title,
        "provider": new_booking.provider,
        "category": new_booking.category,
        "amount": float(new_booking.amount),
        "currency": new_booking.currency,
        "provenance": "SAVED_REFERENCE",
        "source": "USER_PROVIDED",
        "verification": "UNVERIFIED",
        "coins_earned": 50,
        "total_coins": profile.reward_coins if profile else 50,
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
            "trip_id": b.trip_id,
            "category": b.category,
            "provider": b.provider,
            "title": b.title,
            "amount": float(b.amount),
            "currency": b.currency,
            "status": b.status,
            "pnr_ref": b.pnr_ref,
            "provenance": b.provenance or "SAVED_REFERENCE",
            "source": (b.details or {}).get("source", "USER_PROVIDED" if b.status == "saved_reference" else "PROVIDER"),
            "verification": (b.details or {}).get("verification", "UNVERIFIED" if b.status == "saved_reference" else "VERIFIED"),
            "created_at": str(b.created_at),
            "details": b.details
        }
        for b in bookings
    ]

