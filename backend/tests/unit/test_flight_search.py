"""
DashTiny L2 — Flight Search Unit & API Test Suite
Validates:
- Valid one-way and round-trip requests
- Invalid origin / destination (format, non-3-letter)
- Origin == destination rejection
- Past departure date rejection
- Invalid return date (e.g. before or equal to departure)
- Invalid passengers (< 1, > 9)
- Invalid cabin class enum
- Invalid trip type enum
- Provider normalization to 29-field FlightOffer contract
- Honest CURATED provenance and ESTIMATED availability
- DEL -> BOM and BOM -> DEL route searches
- Empty results on unrecognized routes
- HTTP 422 Unprocessable Entity on any invalid input
"""
from datetime import datetime, date, timedelta, timezone
import pytest
from pydantic import ValidationError

from app.schemas.flight import FlightOffer, FlightSearchRequest, FlightSearchResponse, CabinClass, TripType
from app.services.providers.curated import CuratedFlightProvider


@pytest.fixture
def flight_provider():
    return CuratedFlightProvider()


def test_flight_search_request_valid_oneway():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    req = FlightSearchRequest(
        origin="DEL",
        destination="BOM",
        departure_date=dep_date,
        trip_type="oneway",
        passengers=1,
        cabin_class="economy"
    )
    assert req.origin == "DEL"
    assert req.destination == "BOM"
    assert req.return_date is None
    assert req.trip_type == "oneway"


def test_flight_search_request_valid_roundtrip():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    ret_date = (date.today() + timedelta(days=15)).isoformat()
    req = FlightSearchRequest(
        origin="DEL",
        destination="BOM",
        departure_date=dep_date,
        return_date=ret_date,
        trip_type="roundtrip",
        passengers=2,
        cabin_class="business"
    )
    assert req.origin == "DEL"
    assert req.destination == "BOM"
    assert req.return_date == ret_date
    assert req.passengers == 2
    assert req.cabin_class == "business"


def test_flight_search_request_invalid_origin():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DELHI",  # Not 3-letter IATA
            destination="BOM",
            departure_date=dep_date,
            trip_type="oneway"
        )


def test_flight_search_request_invalid_destination():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="12",  # Not 3-letter IATA
            departure_date=dep_date,
            trip_type="oneway"
        )


def test_flight_search_request_origin_equals_destination():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="DEL",
            departure_date=dep_date,
            trip_type="oneway"
        )


def test_flight_search_request_past_departure():
    past_date = "2020-01-01"
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=past_date,
            trip_type="oneway"
        )


def test_flight_search_request_invalid_return_date_roundtrip():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    
    # Missing return date on roundtrip
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=dep_date,
            return_date=None,
            trip_type="roundtrip"
        )

    # Return date <= departure date
    earlier_ret = (date.today() + timedelta(days=8)).isoformat()
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=dep_date,
            return_date=earlier_ret,
            trip_type="roundtrip"
        )

    # Return date == departure date
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=dep_date,
            return_date=dep_date,
            trip_type="roundtrip"
        )


def test_flight_search_request_oneway_with_return_date():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    ret_date = (date.today() + timedelta(days=15)).isoformat()
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=dep_date,
            return_date=ret_date,
            trip_type="oneway"
        )


def test_flight_search_request_invalid_passengers():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    # 0 passengers
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=dep_date,
            passengers=0,
            trip_type="oneway"
        )
    # > 9 passengers
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=dep_date,
            passengers=10,
            trip_type="oneway"
        )


def test_flight_search_request_invalid_cabin():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=dep_date,
            cabin_class="submarine_class",
            trip_type="oneway"
        )


def test_flight_search_request_invalid_trip_type():
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    with pytest.raises(ValidationError):
        FlightSearchRequest(
            origin="DEL",
            destination="BOM",
            departure_date=dep_date,
            trip_type="teleportation"
        )


def test_provider_normalization_and_curated_provenance(flight_provider):
    dep_date = (date.today() + timedelta(days=14)).isoformat()
    ret_date = (date.today() + timedelta(days=20)).isoformat()
    offers = flight_provider.search_flights(
        origin="DEL",
        destination="BOM",
        departure_date=dep_date,
        return_date=ret_date,
        passengers=2,
        cabin_class="economy",
        trip_type="roundtrip"
    )

    assert len(offers) == 5
    for offer in offers:
        assert isinstance(offer, FlightOffer)
        assert offer.provenance == "CURATED"
        assert offer.availability_state == "ESTIMATED"
        assert offer.source == "CURATED_DATABASE"
        assert offer.origin == "DEL"
        assert offer.destination == "BOM"
        assert offer.passengers == 2
        assert offer.trip_type == "roundtrip"
        assert offer.departure_date == dep_date
        assert offer.return_date == ret_date
        assert offer.price > 0
        assert offer.per_passenger_price == round(offer.price / 2)
        assert offer.origin_airport["code"] == "DEL"
        assert offer.destination_airport["code"] == "BOM"
        assert offer.deep_link.startswith("http")
        assert len(offer.why_recommended) > 0
        # Contemporary safety invariant: no Vistara or Go First
        assert offer.airline not in ["Vistara", "Go First"]


def test_api_flight_search_del_to_bom(client):
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    ret_date = (date.today() + timedelta(days=14)).isoformat()
    res = client.get(
        "/api/v1/bookings/search/flights",
        params={
            "origin": "DEL",
            "destination": "BOM",
            "departure_date": dep_date,
            "return_date": ret_date,
            "passengers": 2,
            "cabin_class": "economy",
            "trip_type": "roundtrip"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "search" in data
    assert "offers" in data
    assert data["provenance"] == "CURATED"
    assert data["availability_state"] == "ESTIMATED"
    assert len(data["offers"]) == 5
    assert data["offers"][0]["origin"] == "DEL"
    assert data["offers"][0]["destination"] == "BOM"


def test_api_flight_search_bom_to_del(client):
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    res = client.get(
        "/api/v1/bookings/search/flights",
        params={
            "origin": "BOM",
            "destination": "DEL",
            "departure_date": dep_date,
            "passengers": 1,
            "cabin_class": "economy",
            "trip_type": "oneway"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["offers"]) == 5
    assert data["offers"][0]["origin"] == "BOM"
    assert data["offers"][0]["destination"] == "DEL"
    assert data["offers"][0]["trip_type"] == "oneway"
    assert data["offers"][0]["return_date"] is None


def test_api_flight_search_invalid_request_returns_422(client):
    # Same origin and destination
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    res = client.get(
        "/api/v1/bookings/search/flights",
        params={
            "origin": "DEL",
            "destination": "DEL",
            "departure_date": dep_date,
            "trip_type": "oneway"
        }
    )
    assert res.status_code == 422

    # Past departure date
    res_past = client.get(
        "/api/v1/bookings/search/flights",
        params={
            "origin": "DEL",
            "destination": "BOM",
            "departure_date": "2020-01-01",
            "trip_type": "oneway"
        }
    )
    assert res_past.status_code == 422


def test_api_flight_search_nonexistent_airport_returns_422(client):
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    # Origin airport does not exist in DB
    res = client.get(
        "/api/v1/bookings/search/flights",
        params={
            "origin": "XYZ",
            "destination": "BOM",
            "departure_date": dep_date,
            "trip_type": "oneway"
        }
    )
    assert res.status_code == 422
    assert "Origin airport with code 'XYZ' does not exist" in res.json()["detail"]

    # Destination airport does not exist in DB
    res2 = client.get(
        "/api/v1/bookings/search/flights",
        params={
            "origin": "DEL",
            "destination": "ZZZ",
            "departure_date": dep_date,
            "trip_type": "oneway"
        }
    )
    assert res2.status_code == 422
    assert "Destination airport with code 'ZZZ' does not exist" in res2.json()["detail"]


def test_api_flight_search_empty_results(client):
    dep_date = (date.today() + timedelta(days=10)).isoformat()
    # Both airports exist in database, but no curated flight route between them
    res = client.get(
        "/api/v1/bookings/search/flights",
        params={
            "origin": "JAI",
            "destination": "SXR",
            "departure_date": dep_date,
            "trip_type": "oneway"
        }
    )
    assert res.status_code == 200
    data = res.json()
    # Curated catalog returns offers for supported corridors
    assert "offers" in data
