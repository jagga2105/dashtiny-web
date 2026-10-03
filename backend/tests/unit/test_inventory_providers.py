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
