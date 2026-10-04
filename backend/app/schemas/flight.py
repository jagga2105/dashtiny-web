"""
Canonical Flight Search & Offer Schemas (backend/app/schemas/flight.py)
Adheres strictly to DashTiny L2 Specification:
- 29-field normalized FlightOffer contract
- Strict FlightSearchRequest validation (HTTP 422 on any invalid input)
- Search metadata response envelope
"""
from datetime import datetime, date, timezone
from enum import Enum
from typing import List, Dict, Any, Optional
import re
from pydantic import BaseModel, Field, field_validator, model_validator


class CabinClass(str, Enum):
    ECONOMY = "economy"
    PREMIUM_ECONOMY = "premium_economy"
    BUSINESS = "business"
    FIRST = "first"


class TripType(str, Enum):
    ONEWAY = "oneway"
    ROUNDTRIP = "roundtrip"


class AirportRef(BaseModel):
    code: str
    name: str
    city: str
    country: str = "India"


class FlightSegment(BaseModel):
    """
    Individual flight leg segment representing outbound or return travel.
    """
    origin: str
    destination: str
    departure_date: str
    departure_time: str
    arrival_date: str
    arrival_time: str
    duration_minutes: int
    stops: int = 0
    stop_details: List[Dict[str, Any]] = Field(default_factory=list)

    def __getitem__(self, item: str):
        if hasattr(self, item):
            return getattr(self, item)
        raise KeyError(item)

    def __contains__(self, item: str):
        return hasattr(self, item)


class FlightOffer(BaseModel):
    """
    Canonical Normalized FlightOffer schema required across Provider, API, and Frontend.
    Contains all mandatory fields, including outbound and inbound segments.
    """
    offer_id: str
    provider: str
    airline: str
    flight_number: str
    origin: str
    destination: str
    origin_airport: Dict[str, Any]
    destination_airport: Dict[str, Any]
    departure_date: str
    return_date: Optional[str] = None
    departure_time: str
    arrival_time: str
    duration_minutes: int
    stops: int = 0
    stop_details: List[Dict[str, Any]] = Field(default_factory=list)
    passengers: int = 1
    cabin_class: str = "economy"
    trip_type: str = "roundtrip"
    price: float = Field(..., ge=0)
    per_passenger_price: float = Field(..., ge=0)
    currency: str = "INR"
    baggage: str
    cancellation: str
    availability_state: str = "ESTIMATED"
    provenance: str = "CURATED"
    source: str = "CURATED_DATABASE"
    retrieved_at: str
    expires_at: str
    deep_link: str
    why_recommended: str
    outbound: FlightSegment
    inbound: Optional[FlightSegment] = None

    @model_validator(mode="after")
    def validate_trip_segments(self) -> "FlightOffer":
        if self.trip_type == "roundtrip" and self.inbound is None:
            raise ValueError("inbound segment is required for roundtrip flight offers")
        if self.trip_type == "oneway" and self.inbound is not None:
            raise ValueError("inbound segment must be None for oneway flight offers")
        return self

    def __getitem__(self, item: str):
        if hasattr(self, item):
            return getattr(self, item)
        raise KeyError(item)

    def __contains__(self, item: str):
        return hasattr(self, item)


class FlightSearchRequest(BaseModel):
    """
    Validated flight search parameters.
    Invalid inputs raise validation errors resulting in HTTP 422 Unprocessable Entity.
    """
    origin: str
    destination: str
    departure_date: str
    return_date: Optional[str] = None
    passengers: int = Field(default=1, ge=1, le=9)
    cabin_class: str = "economy"
    trip_type: str = "roundtrip"

    @field_validator("origin", "destination")
    @classmethod
    def validate_airport_code(cls, v: str) -> str:
        clean = v.strip().upper()
        if not re.match(r"^[A-Z]{3}$", clean):
            raise ValueError("Airport code must be a valid 3-letter IATA code (e.g. DEL, BOM)")
        return clean

    @field_validator("cabin_class")
    @classmethod
    def validate_cabin(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean == "premium":
            clean = "premium_economy"
        valid_cabins = [c.value for c in CabinClass]
        if clean not in valid_cabins:
            raise ValueError(f"cabin_class must be one of: {', '.join(valid_cabins)}")
        return clean

    @field_validator("trip_type")
    @classmethod
    def validate_trip_type(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean in ["round", "round_trip"]:
            clean = "roundtrip"
        elif clean in ["one_way", "single"]:
            clean = "oneway"
        valid_types = [t.value for t in TripType]
        if clean not in valid_types:
            raise ValueError(f"trip_type must be one of: {', '.join(valid_types)}")
        return clean

    @field_validator("departure_date")
    @classmethod
    def validate_departure_date(cls, v: str) -> str:
        clean = v.strip()
        try:
            dep_date = date.fromisoformat(clean)
        except ValueError:
            raise ValueError("departure_date must be in ISO format YYYY-MM-DD")
        
        today_utc = datetime.now(timezone.utc).date()
        if dep_date < today_utc:
            raise ValueError(f"departure_date cannot be in the past (must be >= {today_utc.isoformat()})")
        return clean

    @model_validator(mode="after")
    def validate_trip_consistency(self) -> "FlightSearchRequest":
        # Check origin != destination
        if self.origin == self.destination:
            raise ValueError("origin and destination airports cannot be the same")

        dep_date = date.fromisoformat(self.departure_date)

        if self.trip_type == "roundtrip":
            if not self.return_date or not self.return_date.strip():
                raise ValueError("return_date is required for round-trip flights")
            try:
                ret_date = date.fromisoformat(self.return_date.strip())
            except ValueError:
                raise ValueError("return_date must be in ISO format YYYY-MM-DD")
            if ret_date <= dep_date:
                raise ValueError("return_date must be strictly after departure_date")
        elif self.trip_type == "oneway":
            if self.return_date and self.return_date.strip():
                raise ValueError("return_date must be null for one-way flights")

        return self


class FlightSearchResponse(BaseModel):
    """
    Search response metadata envelope required by L2 specification.
    """
    search: Dict[str, Any]
    offers: List[FlightOffer]
    provenance: str = "CURATED"
    availability_state: str = "ESTIMATED"
    retrieved_at: str
    expires_at: str
