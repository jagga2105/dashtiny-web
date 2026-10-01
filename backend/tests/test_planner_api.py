import pytest
from fastapi.testclient import TestClient
from app.models.models import ItineraryActivity, AIRun, Itinerary
from app.main import app
from app.db.database import get_db

def test_planner_generate_success_and_activity_id_consistency(client, db_session, test_user):
    """
    Test that /planner/generate:
    1. Consumes complete PlannerRequest (destination, travellers, dates, vibe, persona)
    2. Scales to 6 travellers
    3. Accurately returns persisted database ItineraryActivity IDs (matching PostgreSQL)
    4. Honest AI Observability (model='deterministic-planner-v1', tokens_used=0)
    """
    payload = {
        "destination": "Kyoto",
        "days_count": 3,
        "travellers": 6,
        "budget": 90000.0,
        "currency": "INR",
        "start_date": "2026-11-10",
        "end_date": "2026-11-12",
        "persona": "family",
        "vibe": "cultural & relaxed"
    }

    response = client.post("/api/v1/planner/generate", json=payload)
    assert response.status_code == 200, f"Unexpected response: {response.text}"

    data = response.json()
    assert data["destination"] == "Kyoto"
    assert data["travellers"] == 6
    assert data["vibe"] == "cultural & relaxed"
    assert len(data["days"]) == 3

    # Verify Activity ID Consistency:
    # Returned ID MUST match the database ItineraryActivity primary key, not an ephemeral random UUID
    first_day = data["days"][0]
    assert len(first_day["activities"]) > 0

    for day in data["days"]:
        for api_act in day["activities"]:
            act_id = api_act["id"]
            db_act = db_session.query(ItineraryActivity).filter(ItineraryActivity.id == act_id).first()
            assert db_act is not None, f"Activity ID {act_id} in API response not found in database!"
            assert db_act.time_slot == api_act["time"]
            assert db_act.description == api_act["description"]

    # Verify party size of 6 scaled the hotel checkin activity description
    checkin_act = first_day["activities"][0]
    assert "party of 6" in checkin_act["description"]

    # Verify AI Observability telemetry was honestly recorded without hallucinated token usage
    trip_id = data["id"]
    ai_run = db_session.query(AIRun).filter(AIRun.trip_id == trip_id).first()
    assert ai_run is not None
    assert ai_run.model == "deterministic-planner-v1"
    assert ai_run.tokens_used == 0
    assert ai_run.status == "success"

def test_planner_inconsistent_dates_validation(client):
    """
    Test that when end_date < start_date, the endpoint rejects with 422 Unprocessable Entity.
    """
    payload = {
        "destination": "Goa",
        "days_count": 3,
        "travellers": 2,
        "start_date": "2026-12-25",
        "end_date": "2026-12-20"  # Inconsistent: earlier than start_date
    }

    response = client.post("/api/v1/planner/generate", json=payload)
    assert response.status_code == 422
    assert "end_date cannot be earlier than start_date" in response.json()["detail"]

def test_planner_malformed_date_rejected(client):
    """
    Test that malformed/non-ISO dates reject with 422 Unprocessable Entity (no silent date rewriting).
    """
    payload = {
        "destination": "Manali",
        "start_date": "invalid-date-string"
    }
    response = client.post("/api/v1/planner/generate", json=payload)
    assert response.status_code == 422
    assert "Invalid start_date" in response.json()["detail"]

def test_planner_vibe_interests_and_origin_differentiation(client):
    """
    Test that differing vibes, interests, and origins produce meaningfully differentiated itineraries
    satisfying the constraint satisfaction contract (e.g. romantic/seafood/photography vs adventure/scuba/nightlife).
    """
    # Trip A: Romantic, Seafood, Photography departing from Mumbai
    payload_a = {
        "destination": "Goa",
        "days_count": 3,
        "travellers": 2,
        "origin": "Mumbai",
        "vibe": "romantic",
        "interests": ["seafood", "photography"],
        "start_date": "2026-11-01",
        "end_date": "2026-11-03"
    }
    res_a = client.post("/api/v1/planner/generate", json=payload_a)
    assert res_a.status_code == 200
    data_a = res_a.json()

    # Day 1 Arrival should cite Mumbai origin
    d1_acts_a = data_a["days"][0]["activities"]
    assert "Mumbai" in d1_acts_a[0]["description"]
    # Lunch should cite Seafood
    assert any("seafood" in act["description"].lower() or "catch" in act["description"].lower() for act in d1_acts_a)
    # Evening should cite Photography / Golden Hour
    assert any("photography" in act["description"].lower() or "golden hour" in act["description"].lower() for act in d1_acts_a)

    # Trip B: Adventure, Scuba, Nightlife departing from Delhi
    payload_b = {
        "destination": "Goa",
        "days_count": 3,
        "travellers": 4,
        "origin": "Delhi",
        "vibe": "adventure",
        "interests": ["scuba", "nightlife"],
        "start_date": "2026-11-01",
        "end_date": "2026-11-03"
    }
    res_b = client.post("/api/v1/planner/generate", json=payload_b)
    assert res_b.status_code == 200
    data_b = res_b.json()

    # Day 1 Arrival should cite Delhi origin
    d1_acts_b = data_b["days"][0]["activities"]
    assert "Delhi" in d1_acts_b[0]["description"]
    # Evening should cite Nightlife / Social Lounge
    assert any("nightlife" in act["description"].lower() or "lounge" in act["description"].lower() for act in d1_acts_b)
    # Day 2 should incorporate Scuba Diving expedition
    d2_acts_b = data_b["days"][1]["activities"]
    assert any("scuba" in act["description"].lower() or "reef" in act["description"].lower() for act in d2_acts_b)

    # Assert that the two plans are fundamentally differentiated
    assert data_a["days"][0]["title"] != data_b["days"][0]["title"]
    assert d1_acts_a[1]["description"] != d1_acts_b[1]["description"]

def test_planner_unauthenticated_rejected(db_session):
    """
    Test that calling /planner/generate without credentials returns 401 Unauthorized.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Clean app dependency overrides to test raw auth requirement
    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as unauth_client:
            response = unauth_client.post("/api/v1/planner/generate", json={"destination": "Manali"})
            assert response.status_code == 401
    finally:
        app.dependency_overrides.clear()
