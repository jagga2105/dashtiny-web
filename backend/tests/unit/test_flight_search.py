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
    # Curated catalog returns strict empty list for unsupported corridors
    assert "offers" in data
    assert data["offers"] == []


def test_curated_provider_unsupported_corridor_returns_empty(flight_provider):
    """Unsupported corridor returns [] without synthesizing fake durations."""
    offers = flight_provider.search_flights(
        origin="JAI",
        destination="SXR",
        departure_date="2026-11-20",
        trip_type="oneway"
    )
    assert offers == []


def test_curated_provider_supported_corridor_deterministic(flight_provider):
    """Supported corridor returns deterministic curated offers with normalized provider."""
    offers = flight_provider.search_flights(
        origin="DEL",
        destination="BOM",
        departure_date="2026-11-20",
        trip_type="oneway"
    )
    assert len(offers) == 5
    for o in offers:
        assert o.provider == "DashTiny Curated Catalog"
        assert o.outbound is not None
        assert o.outbound.origin == "DEL"
        assert o.outbound.destination == "BOM"
        assert o.inbound is None


def test_curated_provider_stability_across_separate_instances():
    """Same request to separate provider instances yields identical offer IDs and flight numbers."""
    provider1 = CuratedFlightProvider()
    provider2 = CuratedFlightProvider()

    offers1 = provider1.search_flights(
        origin="DEL",
        destination="BLR",
        departure_date="2026-11-20",
        return_date="2026-11-25",
        trip_type="roundtrip"
    )
    offers2 = provider2.search_flights(
        origin="DEL",
        destination="BLR",
        departure_date="2026-11-20",
        return_date="2026-11-25",
        trip_type="roundtrip"
    )

    assert len(offers1) == len(offers2) == 5
    for o1, o2 in zip(offers1, offers2):
        assert o1.offer_id == o2.offer_id
        assert o1.flight_number == o2.flight_number
        assert o1.price == o2.price
        assert o1.why_recommended == o2.why_recommended
        assert o1.outbound.departure_time == o2.outbound.departure_time
        assert o1.inbound.departure_time == o2.inbound.departure_time


def test_curated_provider_oneway_has_no_inbound_segment(flight_provider):
    """One-way flight offer has outbound segment but inbound is None."""
    offers = flight_provider.search_flights(
        origin="DEL",
        destination="GOI",
        departure_date="2026-11-20",
        trip_type="oneway"
    )
    assert len(offers) > 0
    for o in offers:
        assert o.outbound is not None
        assert o.outbound.origin == "DEL"
        assert o.outbound.destination == "GOI"
        assert o.inbound is None


def test_curated_provider_roundtrip_has_inbound_segment(flight_provider):
    """Round-trip flight offer requires outbound and inbound segments with inverted route."""
    offers = flight_provider.search_flights(
        origin="DEL",
        destination="GOI",
        departure_date="2026-11-20",
        return_date="2026-11-25",
        trip_type="roundtrip"
    )
    assert len(offers) > 0
    for o in offers:
        assert o.outbound is not None
        assert o.outbound.origin == "DEL"
        assert o.outbound.destination == "GOI"
        assert o.inbound is not None
        assert o.inbound.origin == "GOI"
        assert o.inbound.destination == "DEL"
        assert o.inbound.departure_date == "2026-11-25"


# ==============================================================================
# L2.4 P0 & P1 REGRESSION TESTS: OFFER IDENTITY, AIRPORT AUTHORITY & CONTEXT SAFETY
# ==============================================================================

def test_offer_id_unique_across_search_contexts(flight_provider):
    """
    P0 Test: Deterministic offer identity must vary with departure date,
    return date, cabin class, passengers, and trip type, but stay identical
    for the exact same search query.
    """
    base_params = {
        "origin": "DEL",
        "destination": "GOI",
        "departure_date": "2026-11-20",
        "return_date": "2026-11-25",
        "passengers": 1,
        "cabin_class": "economy",
        "trip_type": "roundtrip"
    }

    offers_base1 = flight_provider.search_flights(**base_params)
    offers_base2 = flight_provider.search_flights(**base_params)
    assert len(offers_base1) > 0
    # Same exact search -> same offer IDs
    for o1, o2 in zip(offers_base1, offers_base2):
        assert o1.offer_id == o2.offer_id
        assert o1.offer_id.startswith("fl_")

    # Different departure date -> different offer IDs
    offers_diff_dep = flight_provider.search_flights(
        **{**base_params, "departure_date": "2026-11-21"}
    )
    for o1, o2 in zip(offers_base1, offers_diff_dep):
        assert o1.offer_id != o2.offer_id

    # Different return date -> different offer IDs
    offers_diff_ret = flight_provider.search_flights(
        **{**base_params, "return_date": "2026-11-28"}
    )
    for o1, o2 in zip(offers_base1, offers_diff_ret):
        assert o1.offer_id != o2.offer_id

    # Different cabin class -> different offer IDs
    offers_diff_cabin = flight_provider.search_flights(
        **{**base_params, "cabin_class": "business"}
    )
    for o1, o2 in zip(offers_base1, offers_diff_cabin):
        assert o1.offer_id != o2.offer_id

    # Different passengers count -> different offer IDs
    offers_diff_pax = flight_provider.search_flights(
        **{**base_params, "passengers": 3}
    )
    for o1, o2 in zip(offers_base1, offers_diff_pax):
        assert o1.offer_id != o2.offer_id

    # Different trip type (one-way vs round-trip) -> different offer IDs
    offers_oneway = flight_provider.search_flights(
        origin="DEL",
        destination="GOI",
        departure_date="2026-11-20",
        return_date=None,
        passengers=1,
        cabin_class="economy",
        trip_type="oneway"
    )
    for o1, o2 in zip(offers_base1, offers_oneway):
        assert o1.offer_id != o2.offer_id


def test_airport_authority_goa_does_not_alias_goi(db_session):
    """
    P0 Test: GOA must resolve to Genoa Cristoforo Colombo Airport in Italy,
    NEVER to Dabolim Airport (GOI) in Goa. GOI and GOX resolve independently.
    """
    from app.services.providers.curated import _resolve_airport_ref

    goa_info = _resolve_airport_ref("GOA", db=db_session)
    assert goa_info is not None
    assert goa_info["code"] == "GOA"
    assert "Genoa" in goa_info["city"] or "Genoa" in goa_info["name"]
    assert goa_info["country"] == "Italy"
    assert goa_info["code"] != "GOI"
    assert goa_info["name"] != "Dabolim Airport"

    goi_info = _resolve_airport_ref("GOI", db=db_session)
    assert goi_info is not None
    assert goi_info["code"] == "GOI"
    assert goi_info["city"] == "Goa"
    assert "Dabolim" in goi_info["name"]

    gox_info = _resolve_airport_ref("GOX", db=db_session)
    assert gox_info is not None
    assert gox_info["code"] == "GOX"
    assert gox_info["city"] == "Goa"
    assert "Manohar" in gox_info["name"] or "Mopa" in gox_info["name"]


def test_provider_rejects_missing_departure_and_roundtrip_return_date(flight_provider):
    """
    P0 Test: Curated provider must never invent departure or return dates.
    Missing departure date or missing return date on roundtrip returns [].
    """
    # Missing departure date
    res1 = flight_provider.search_flights(
        origin="DEL",
        destination="GOI",
        departure_date=None,
        trip_type="oneway"
    )
    assert res1 == []

    # Roundtrip with missing return date
    res2 = flight_provider.search_flights(
        origin="DEL",
        destination="GOI",
        departure_date="2026-11-20",
        return_date=None,
        trip_type="roundtrip"
    )
    assert res2 == []


def test_schedule_helpers_raise_value_error_on_invalid_data():
    """
    P0 Test: _format_time_with_duration and _calculate_arrival_date
    must raise explicit ValueError on malformed schedule strings instead
    of silently returning dummy fallbacks like '11:30 AM'.
    """
    import pytest
    from app.services.providers.curated import _format_time_with_duration, _calculate_arrival_date

    with pytest.raises(ValueError, match="Invalid departure time format"):
        _format_time_with_duration("invalid-time", 120)

    with pytest.raises(ValueError, match="Invalid departure date/time format"):
        _calculate_arrival_date("not-a-date", "10:30 AM", 120)


def test_proposal_rejects_stale_search_context_mismatch(client, db_session, test_user, flight_provider):
    """
    P0 Test: POST /api/v1/ai/proposals must reject with HTTP 409 Conflict
    if the flight offer does not match the active search context.
    """
    from datetime import date
    from app.models.models import Itinerary, ItineraryDay
    from app.services.trip_revision_service import record_initial_revision

    trip = Itinerary(
        title="Goa Trip",
        destination="Goa",
        owner_id=test_user.id,
        total_budget=40000.0,
        currency="INR",
        start_date=date(2026, 11, 20),
        end_date=date(2026, 11, 25)
    )
    db_session.add(trip)
    db_session.commit()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    db_session.add(day1)
    db_session.commit()

    record_initial_revision(db_session, trip.id, test_user.id)
    db_session.commit()

    offers = flight_provider.search_flights(
        origin="DEL",
        destination="GOI",
        departure_date="2026-11-20",
        return_date="2026-11-25",
        passengers=1,
        cabin_class="economy",
        trip_type="roundtrip"
    )
    assert len(offers) > 0
    selected_offer = offers[0].model_dump()

    # Mismatch: User changed search to destination BOM instead of GOI
    mismatched_context = {
        "origin": "DEL",
        "destination": "BOM",
        "departure_date": "2026-11-20",
        "return_date": "2026-11-25",
        "passengers": 1,
        "cabin_class": "economy",
        "trip_type": "roundtrip"
    }

    res = client.post(
        "/api/v1/ai/proposals",
        json={
            "trip_id": trip.id,
            "proposal_type": "ATTACH_FLIGHT_OFFER",
            "offer": selected_offer,
            "search_context": mismatched_context
        }
    )
    assert res.status_code == 409
    data = res.json()
    assert "Flight offer search context does not match active search context" in data["detail"]
    assert "destination" in data["detail"]


