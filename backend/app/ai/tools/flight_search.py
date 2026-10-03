"""
Flight Search Tool - Aggregation & Normalization Layer
Normalizes offers across providers into FlightOffer schema with explicit CURATED provenance.
"""
from typing import List, Dict, Any, Optional
from app.services.providers.curated import CuratedFlightProvider

_provider = CuratedFlightProvider()


def search_flights(
    origin: str,
    destination: str,
    date: Optional[str] = None,
    return_date: Optional[str] = None,
    passengers: int = 1,
    cabin_class: str = "economy",
    trip_type: str = "roundtrip"
) -> List[Dict[str, Any]]:
    """
    Search and normalize flight inventory for explicit origin and destination.
    Returns list of standardized FlightOffer objects with explicit CURATED provenance.
    Never labeled as live provider inventory.
    """
    return _provider.search_flights(
        origin=origin,
        destination=destination,
        departure_date=date,
        return_date=return_date,
        passengers=passengers,
        cabin_class=cabin_class,
        trip_type=trip_type
    )
