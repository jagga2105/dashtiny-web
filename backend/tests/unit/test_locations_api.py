"""
Locations & Airport Domain Unit & API Tests
Verifies exact IATA, city search, airport name search, partial search,
case-insensitivity, unknown search, duplicate prevention, inactive handling, and invalid IATA.
"""
import pytest
from sqlalchemy.exc import IntegrityError
from app.models.models import Airport


def test_exact_iata_lookup(client):
    """GET /api/v1/locations/airports/{iata_code} returns exact airport data."""
    res = client.get("/api/v1/locations/airports/DEL")
    assert res.status_code == 200
    data = res.json()
    assert data["iata_code"] == "DEL"
    assert data["icao_code"] == "VIDP"
    assert "Indira Gandhi" in data["name"]
    assert data["country"] == "India"
    assert data["country_code"] == "IN"
    assert data["provenance"] == "REFERENCE_DATASET"
    assert data["is_active"] is True


def test_exact_iata_case_insensitive(client):
    """GET /api/v1/locations/airports/{iata_code} handles lowercase IATA codes cleanly."""
    res = client.get("/api/v1/locations/airports/del")
    assert res.status_code == 200
    data = res.json()
    assert data["iata_code"] == "DEL"


def test_invalid_iata_format(client):
    """GET /api/v1/locations/airports/{iata_code} rejects malformed IATA codes with 400."""
    res = client.get("/api/v1/locations/airports/TOOLONG")
    assert res.status_code == 400
    assert "Invalid IATA code" in res.json()["detail"]

    res_num = client.get("/api/v1/locations/airports/123")
    assert res_num.status_code == 400


def test_nonexistent_iata_returns_404(client):
    """GET /api/v1/locations/airports/{iata_code} returns 404 for unknown valid-format IATA."""
    res = client.get("/api/v1/locations/airports/ZZZ")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_search_exact_iata(client):
    """Search for 'DEL' ranks Delhi Indira Gandhi as #1 result."""
    res = client.get("/api/v1/locations/search?q=DEL")
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0
    assert items[0]["iata_code"] == "DEL"


def test_search_by_city_name(client):
    """Search for 'Delhi' or 'Mumbai' finds primary hub."""
    res = client.get("/api/v1/locations/search?q=Delhi")
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0
    assert items[0]["iata_code"] == "DEL"

    res_bom = client.get("/api/v1/locations/search?q=Mumbai")
    assert res_bom.status_code == 200
    bom_items = res_bom.json()
    assert len(bom_items) > 0
    assert bom_items[0]["iata_code"] == "BOM"


def test_search_by_airport_name(client):
    """Search for 'Indira Gandhi' or 'Kempegowda' finds matching airport."""
    res = client.get("/api/v1/locations/search?q=Indira Gandhi")
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0
    assert items[0]["iata_code"] == "DEL"

    res_blr = client.get("/api/v1/locations/search?q=Kempegowda")
    assert res_blr.status_code == 200
    blr_items = res_blr.json()
    assert len(blr_items) > 0
    assert blr_items[0]["iata_code"] == "BLR"


def test_search_partial_prefix(client):
    """Search for partial prefix 'mum' or 'kolk' matches city/airport."""
    res = client.get("/api/v1/locations/search?q=Mum")
    assert res.status_code == 200
    items = res.json()
    assert any(it["iata_code"] == "BOM" for it in items)

    res_ccu = client.get("/api/v1/locations/search?q=kolk")
    assert res_ccu.status_code == 200
    assert any(it["iata_code"] == "CCU" for it in res_ccu.json())


def test_search_case_insensitive(client):
    """Search works identically regardless of casing."""
    res_lower = client.get("/api/v1/locations/search?q=delhi")
    res_upper = client.get("/api/v1/locations/search?q=DELHI")
    assert res_lower.status_code == 200
    assert res_upper.status_code == 200
    assert res_lower.json()[0]["iata_code"] == res_upper.json()[0]["iata_code"] == "DEL"


def test_search_unknown_returns_empty_list(client):
    """Search for nonexistent location returns empty list without falling back to GOI."""
    res = client.get("/api/v1/locations/search?q=xyz-nonexistent-planet")
    assert res.status_code == 200
    assert res.json() == []


def test_search_empty_query_returns_curated_hubs(client):
    """Empty query returns popular primary gateways."""
    res = client.get("/api/v1/locations/search?q=")
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0
    iata_codes = [it["iata_code"] for it in items]
    assert "DEL" in iata_codes
    assert "BOM" in iata_codes


def test_search_bounded_limit(client):
    """Search respects limit parameter and bounds it between 1 and 50."""
    res = client.get("/api/v1/locations/search?q=a&limit=3")
    assert res.status_code == 200
    assert len(res.json()) <= 3


def test_duplicate_iata_prevention(db_session):
    """Database enforces UNIQUE constraint on iata_code."""
    dup_airport = Airport(
        id="test-dup-del",
        iata_code="DEL",  # Already exists in seeded data
        name="Duplicate Delhi Airport",
        city="Delhi",
        country="India",
        country_code="IN",
        search_text="del delhi duplicate",
        is_active=True
    )
    db_session.add(dup_airport)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_inactive_airport_exclusion(db_session, client):
    """Deactivated airports are excluded from search results and lookup."""
    inactive_airport = Airport(
        id="test-inactive-airport-01",
        iata_code="INA",
        name="Decommissioned Strip",
        city="Ghost Town",
        country="India",
        country_code="IN",
        search_text="ina ghost town decommissioned strip",
        is_active=False
    )
    db_session.add(inactive_airport)
    db_session.commit()

    # Search should NOT return inactive airport
    res = client.get("/api/v1/locations/search?q=Ghost Town")
    assert res.status_code == 200
    assert not any(it["iata_code"] == "INA" for it in res.json())

    # Lookup should return 404 for inactive airport
    res_get = client.get("/api/v1/locations/airports/INA")
    assert res_get.status_code == 404
