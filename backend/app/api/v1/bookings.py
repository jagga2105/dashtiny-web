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
from app.models.models import Booking, User, UserProfile, Itinerary, SquadRoom, SquadMember, RewardTransaction
from app.api.deps import get_current_user

from app.services.providers import (
    FlightProvider,
    HotelProvider,
    CuratedFlightProvider,
    CuratedHotelProvider,
)

router = APIRouter(prefix="/bookings", tags=["Booking Aggregator & Reservations"])

_flight_provider: FlightProvider = CuratedFlightProvider()
_hotel_provider: HotelProvider = CuratedHotelProvider()

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
    origin: str,
    destination: str,
    departure_date: Optional[str] = None,
    return_date: Optional[str] = None,
    passengers: int = 1,
    cabin_class: str = "economy",
    trip_type: str = "roundtrip"
):
    """
    Search curated travel catalog flight offers normalized into FlightOffer schema.
    Returns current catalog pricing and estimated availability with explicit CURATED provenance.
    Live OTA provider integrations are deferred to future phases.
    Requires explicit search intent: origin and destination.
    """
    return _flight_provider.search_flights(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        return_date=return_date,
        passengers=passengers,
        cabin_class=cabin_class,
        trip_type=trip_type
    )

@router.get("/search/hotels")
def search_hotels_endpoint(
    destination: str,
    guests: int = 2,
    check_in: Optional[str] = None,
    check_out: Optional[str] = None,
    room_type: Optional[str] = None
):
    """
    Search curated travel catalog stays offers normalized into HotelOffer schema.
    Returns current catalog pricing and estimated availability with explicit CURATED provenance.
    Live OTA provider integrations are deferred to future phases.
    Requires explicit search intent: destination.
    """
    return _hotel_provider.search_hotels(
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
    Enforces UNIQUE(provider, pnr_ref), avoids fake auto-generated PNRs, and awards
    reward coins through an idempotent ledger transaction.
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

    pnr_clean = request.pnr_ref.strip() if request.pnr_ref and request.pnr_ref.strip() else None

    # Enforce UNIQUE(provider, pnr_ref)
    if pnr_clean:
        existing_booking = db.query(Booking).filter(
            Booking.provider == request.provider,
            Booking.pnr_ref == pnr_clean
        ).first()
        if existing_booking:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A booking reference for provider '{request.provider}' with PNR/Ref '{pnr_clean}' already exists."
            )

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
        pnr_ref=pnr_clean,
        provenance="SAVED_REFERENCE",
        details=merged_details
    )
    db.add(new_booking)
    db.flush()  # assign new_booking.id

    # Reward Ledger with Idempotency
    # Only genuine provided PNR references earn coins; drafts without PNR do not earn rewards.
    # Same provider + PNR can only be rewarded once.
    coins_earned = 0
    total_coins = 0
    if pnr_clean and len(pnr_clean) >= 3:
        from app.services.reward_service import award_rewards
        idempotency_key = f"booking_reward_{request.provider}_{pnr_clean}"
        total_coins, was_awarded = award_rewards(
            db=db,
            user_id=user.id,
            delta=50,
            reward_type="BOOKING_SAVED",
            reason=f"Saved booking reference for {request.provider} ({pnr_clean})",
            reference_type="booking",
            reference_id=new_booking.id,
            idempotency_key=idempotency_key,
            metadata_json={"provider": request.provider, "pnr_ref": pnr_clean, "booking_id": new_booking.id}
        )
        if was_awarded:
            coins_earned = 50
    else:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        total_coins = profile.reward_coins if profile else 0

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
        "coins_earned": coins_earned,
        "total_coins": total_coins,
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

