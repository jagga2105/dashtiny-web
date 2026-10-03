from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class BaseOffer(BaseModel):
    offer_id: str
    provider: str
    price: float = Field(..., ge=0)
    currency: str = "INR"
    availability_state: str = "ESTIMATED"  # AVAILABLE, LIMITED, ESTIMATED, UNCONFIRMED
    deep_link: str
    provenance: str = "CURATED"  # VERIFIED, CURATED, DEMO, USER_PROVIDED
    source: str = "CURATED_DATABASE"  # PROVIDER_API, CURATED_DATABASE, DEMO_FALLBACK
    retrieved_at: str
    expires_at: str


class FlightProvider(ABC):
    """
    Abstract Base Class for flight inventory providers (e.g. Skyscanner, Amadeus, Curated).
    """
    @abstractmethod
    def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: Optional[str] = None,
        return_date: Optional[str] = None,
        passengers: int = 1,
        cabin_class: str = "economy",
        trip_type: str = "roundtrip"
    ) -> List[Dict[str, Any]]:
        pass


class HotelProvider(ABC):
    """
    Abstract Base Class for hotel/stays inventory providers (e.g. Booking.com, Agoda, Curated).
    """
    @abstractmethod
    def search_hotels(
        self,
        destination: str,
        guests: int = 2,
        check_in: Optional[str] = None,
        check_out: Optional[str] = None,
        room_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        pass


class ActivityProvider(ABC):
    """
    Abstract Base Class for activity/experience providers (e.g. Viator, GetYourGuide, Curated).
    """
    @abstractmethod
    def search_activities(
        self,
        destination: str,
        category: Optional[str] = None,
        date: Optional[str] = None,
        guests: int = 1
    ) -> List[Dict[str, Any]]:
        pass
