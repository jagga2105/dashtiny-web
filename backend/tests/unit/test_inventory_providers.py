import pytest
from app.services.providers.curated import CuratedFlightProvider, CuratedHotelProvider, CuratedActivityProvider


def test_curated_flight_provider_schema_and_provenance():
    """
    Item 18 & 23:
    Curated flight provider must return standardized schema:
    offer_id, provider, price, currency, availability_state, deep_link,
    provenance, source, retrieved_at, expires_at.
    Never labeled as live provider inventory.
    """
    provider = CuratedFlightProvider()
    offers = provider.search_flights(
        origin="DEL",
        destination="GOA",
        passengers=2,
        cabin_class="economy",
        trip_type="roundtrip"
    )
    assert len(offers) > 0
    first = offers[0]

    # Required standardized fields
    assert "offer_id" in first
    assert "provider" in first
    assert first["price"] > 0
    assert first["currency"] == "INR"
    assert first["availability_state"] == "ESTIMATED"
    assert first["provenance"] == "CURATED"
    assert first["source"] == "CURATED_DATABASE"
    assert "retrieved_at" in first
    assert "expires_at" in first
    assert "deep_link" in first

    # Ensure price reflects passenger count
    assert first["passengers"] == 2
    assert first["trip_type"] == "roundtrip"


def test_curated_hotel_provider_schema_and_provenance():
    """
    Item 18 & 23:
    Curated hotel provider must return standardized schema with explicit CURATED provenance.
    """
    provider = CuratedHotelProvider()
    stays = provider.search_hotels(
        destination="Goa",
        guests=2,
        check_in="2026-11-01",
        check_out="2026-11-04"
    )
    assert len(stays) > 0
    first = stays[0]

    assert "offer_id" in first
    assert "provider" in first
    assert first["price"] > 0
    assert first["currency"] == "INR"
    assert first["availability_state"] == "ESTIMATED"
    assert first["provenance"] in ["CURATED", "DEMO"]
    assert first["source"] in ["CURATED_DATABASE", "Curated Boutique Registry", "Curated Luxury Stays", "DashTiny Showcase Catalog"]
    assert "retrieved_at" in first
    assert "expires_at" in first


def test_curated_activity_provider_schema_and_provenance():
    """
    Item 18:
    Activity provider returns standardized experience offers.
    """
    provider = CuratedActivityProvider()
    activities = provider.search_activities(destination="Jaipur", guests=2)
    assert len(activities) > 0
    first = activities[0]

    assert "offer_id" in first
    assert "provider" in first
    assert first["price"] > 0
    assert first["provenance"] == "CURATED"
    assert first["source"] == "CURATED_DATABASE"
    assert "retrieved_at" in first
    assert "expires_at" in first


def test_locations_search_and_lookup_endpoints(client):
    """
    Test Location domain API endpoints:
    - GET /api/v1/locations/search?q=
    - GET /api/v1/locations/airports/{iata_code}
    """
    # 1. Search without query returns hubs
    res = client.get("/api/v1/locations/search")
    assert res.status_code == 200
    hubs = res.json()
    assert len(hubs) > 0
    assert any(h["iata_code"] == "DEL" for h in hubs)

    # 2. Search with city query
    res_goa = client.get("/api/v1/locations/search?q=goa")
    assert res_goa.status_code == 200
    goa_airports = res_goa.json()
    assert len(goa_airports) > 0
    assert any(a["iata_code"] in ["GOI", "GOX"] for a in goa_airports)

    # 3. Lookup specific airport by IATA
    res_del = client.get("/api/v1/locations/airports/DEL")
    assert res_del.status_code == 200
    del_data = res_del.json()
    assert del_data["iata_code"] == "DEL"
    assert "Delhi" in del_data["city"]

    # 4. Unknown airport returns 404
    res_404 = client.get("/api/v1/locations/airports/ZZZ")
    assert res_404.status_code == 404

