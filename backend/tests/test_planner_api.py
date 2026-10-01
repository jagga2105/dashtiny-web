import pytest
from unittest.mock import MagicMock
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

def test_planner_trust_boundaries_provenance_and_factual_rationales(client):
    """
    Test trust boundary compliance:
    1. Provenance: Deterministic planner never emits 'AI GENERATED'.
       Geocoded spots are 'CURATED', unresolvable spots are 'CURATED_UNRESOLVED'.
    2. Routing/Crowd Truth: All transit & crowd claims carry '(Estimated)'.
       Origin transit does not invent flight/route specifics.
    3. Factual Rationales: 'why_recommended' does not claim unconsulted ratings/reviews,
       grounding strictly in user preferences ('Matches your...').
    """
    payload = {
        "destination": "Goa",
        "days_count": 2,
        "travellers": 2,
        "origin": "Delhi",
        "vibe": "romantic",
        "interests": ["photography", "seafood"],
        "start_date": "2026-11-01",
        "end_date": "2026-11-02"
    }

    res = client.post("/api/v1/planner/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    valid_tiers = {"CURATED", "PROVIDER_VERIFIED", "DETERMINISTIC", "CURATED_UNRESOLVED", "UNKNOWN", "USER_GENERATED"}

    for day in data["days"]:
        for act in day["activities"]:
            prov = act.get("provenance")
            # 1. Provenance must not falsely claim AI generation
            assert prov != "AI GENERATED", f"Deterministic activity falsely claimed 'AI GENERATED': {act}"
            assert prov in valid_tiers, f"Invalid provenance tier '{prov}' in {act}"

            # 2. Transit and crowd warnings must be qualified as Estimated
            transit = act.get("estimatedTransit", "")
            crowd = act.get("crowdWarning", "")
            assert "(Estimated)" in transit, f"Transit claim '{transit}' missing '(Estimated)' label"
            assert "(Estimated)" in crowd, f"Crowd warning '{crowd}' missing '(Estimated)' label"

            # 3. Rationales must not claim ratings/reviews
            why = act.get("whyRecommended")
            if why:
                assert "top traveler ratings" not in why.lower()
                assert "traveler culinary reviews" not in why.lower()
                assert "high traveler reviews" not in why.lower()

    # Day 1 Arrival transit should not invent non-stop flight route claims
    d1_act0 = data["days"][0]["activities"][0]
    assert "non-stop" not in d1_act0["estimatedTransit"].lower()
    assert "Delhi" in d1_act0["estimatedTransit"]

    # Evening activity should ground why_recommended in photography
    d1_eve = data["days"][0]["activities"][2]
    assert "photography" in d1_eve["whyRecommended"].lower()
    assert "matches your photography preference" in d1_eve["whyRecommended"].lower()

    # Verify an unresolved location correctly gets CURATED_UNRESOLVED provenance
    unresolved_payload = {
        "destination": "Atlantis Hidden Realm",
        "days_count": 1,
        "start_date": "2026-12-01",
        "end_date": "2026-12-01"
    }
    unresolved_res = client.post("/api/v1/planner/generate", json=unresolved_payload)
    assert unresolved_res.status_code == 200
    unresolved_data = unresolved_res.json()
    unresolved_acts = unresolved_data["days"][0]["activities"]
    assert any(a["provenance"] == "CURATED_UNRESOLVED" for a in unresolved_acts)
    assert not any(a["provenance"] == "AI GENERATED" for a in unresolved_acts)

    # Verify GET /api/v1/trips/my-trips passes whyRecommended and correct provenance
    trips_res = client.get("/api/v1/trips/my-trips")
    assert trips_res.status_code == 200
    user_trips = trips_res.json()
    assert len(user_trips) > 0
    first_trip = user_trips[0]
    first_act = first_trip["days"][0]["activities"][0]
    assert "whyRecommended" in first_act
    assert first_act["provenance"] != "AI GENERATED"

def test_daina_ai_planning_pipeline_and_observability(client, db_session, monkeypatch):
    """
    Test Real DAIna flow:
    LLM -> structured planner output -> constraint validation -> tool verification -> persist
    1. Verifies structured AI generation correctly parses into DayPlan & ActivityItems
    2. Verifies tool verification layer applies spatial geocoding and '(Estimated)' transit/crowds
    3. Verifies honest AI Observability records real model name and token usage
    """
    from unittest.mock import MagicMock
    import app.ai.agents.planner_agent as pa

    mock_json_content = """{
      "title": "Bespoke 2-Day Kyoto Sanctuary Passage",
      "days": [
        {
          "day_number": 1,
          "title": "Arrival & Historic Temple Discovery",
          "activities": [
            {
              "time_slot": "09:30 AM",
              "description": "Orientation and check-in at Kyoto Sanctuary",
              "location": "Kyoto",
              "place_type": "H",
              "why_recommended": "Matches your preference for peaceful cultural surroundings."
            },
            {
              "time_slot": "01:00 PM",
              "description": "Traditional Kaiseki multi-course lunch",
              "location": "Gion Historic Quarter",
              "place_type": "R",
              "why_recommended": "Matches your cultural gastronomy interest."
            },
            {
              "time_slot": "05:30 PM",
              "description": "Golden hour twilight photography at Fushimi Inari",
              "location": "Kyoto",
              "place_type": "TA",
              "why_recommended": "Matches your photography preference with unobstructed dusk light."
            }
          ]
        },
        {
          "day_number": 2,
          "title": "Bamboo Groves & Artisan Heritage",
          "activities": [
            {
              "time_slot": "09:00 AM",
              "description": "Arashiyama bamboo grove morning walk",
              "location": "Kyoto",
              "place_type": "TA",
              "why_recommended": "Matches your serene nature preference."
            },
            {
              "time_slot": "01:00 PM",
              "description": "Zen garden matcha and soba lunch",
              "location": "Arashiyama Strip",
              "place_type": "R",
              "why_recommended": "Matches your authentic culinary interest."
            },
            {
              "time_slot": "06:00 PM",
              "description": "Twilight tea house reflection",
              "location": "Pontocho Alley",
              "place_type": "TA",
              "why_recommended": "Matches your cultural ambiance interest."
            }
          ]
        }
      ]
    }"""

    mock_choice = MagicMock()
    mock_choice.message.content = mock_json_content
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage.total_tokens = 485

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    # Monkeypatch get_llm_client to simulate Gemini Flash free tier
    monkeypatch.setattr(pa, "get_llm_client", lambda: (mock_client, "gemini-1.5-flash"))

    payload = {
        "destination": "Kyoto",
        "days_count": 2,
        "travellers": 2,
        "budget": 85000.0,
        "currency": "INR",
        "start_date": "2026-11-10",
        "end_date": "2026-11-11",
        "persona": "culture_seeker",
        "vibe": "cultural & peaceful",
        "interests": ["photography", "heritage cuisine"]
    }

    res = client.post("/api/v1/planner/generate", json=payload)
    assert res.status_code == 200
    data = res.json()

    # 1. Structured output populated from LLM
    assert len(data["days"]) == 2
    assert data["days"][0]["title"] == "Arrival & Historic Temple Discovery"
    assert data["days"][1]["title"] == "Bamboo Groves & Artisan Heritage"

    # 2. Tool verification layer verified spatial geocoding & separated source provenance
    d1_act0 = data["days"][0]["activities"][0]
    assert d1_act0["lat"] is not None  # Kyoto coordinates resolved
    assert d1_act0["provenance"] == "AI_GENERATED"
    assert d1_act0["generationSource"] == "AI_GENERATED"
    assert d1_act0["locationSource"] in ["CURATED", "PROVIDER_VERIFIED"]
    assert d1_act0["contentSource"] == "AI"
    assert d1_act0["costType"] == "ESTIMATED_ALLOCATION"
    assert d1_act0["estimatedAllocation"] > 0
    assert "(Estimated)" in d1_act0["estimatedTransit"]
    assert "(Estimated)" in d1_act0["crowdWarning"]

    # 3. Honest AI Observability recorded real model and tokens
    trip_id = data["id"]
    ai_run = db_session.query(AIRun).filter(AIRun.trip_id == trip_id).first()
    assert ai_run is not None
    assert ai_run.model == "gemini-1.5-flash"
    assert ai_run.tokens_used == 485
    assert ai_run.status == "success"

def test_daina_ai_planning_graceful_fallback_on_error(client, db_session, monkeypatch):
    """
    Test that if the LLM provider fails (quota, network error),
    DAIna gracefully falls back to the deterministic engine without breaking the user experience.
    """
    import app.ai.agents.planner_agent as pa

    def mock_failing_llm(*args, **kwargs):
        raise RuntimeError("Google Gemini API quota exceeded (free tier 15 RPM)")

    mock_client = MagicMock()
    monkeypatch.setattr(pa, "get_llm_client", lambda: (mock_client, "gemini-1.5-flash"))
    monkeypatch.setattr(pa, "generate_llm_plan", mock_failing_llm)

    payload = {
        "destination": "Goa",
        "days_count": 2,
        "travellers": 2,
        "vibe": "romantic",
        "start_date": "2026-11-01",
        "end_date": "2026-11-02"
    }

    res = client.post("/api/v1/planner/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["days"]) == 2

    # Verify fallback was used and honest observability was logged
    trip_id = data["id"]
    ai_run = db_session.query(AIRun).filter(AIRun.trip_id == trip_id).first()
    assert ai_run is not None
    assert ai_run.model == "deterministic-planner-v1"
    assert ai_run.tokens_used == 0

def test_provider_selection_strictly_respects_llm_provider(monkeypatch):
    """
    Test that get_llm_client() strictly respects LLM_PROVIDER setting.
    If LLM_PROVIDER='ollama', it must NOT select Gemini even if GEMINI_API_KEY is configured.
    """
    import app.ai.agents.planner_agent as pa
    from app.config import settings

    monkeypatch.setattr(settings, "LLM_PROVIDER", "ollama")
    monkeypatch.setattr(settings, "LLM_BASE_URL", "http://localhost:11434/v1")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "dummy-gemini-key")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "dummy-groq-key")

    client, model = pa.get_llm_client()
    assert model == "llama3.2"
    assert "11434" in str(client.base_url)

def test_destination_boundary_enforcement_in_spatial_verification():
    """
    Test that geographic boundary verification rejects landmarks that do not belong to target destination.
    Eiffel Tower (Paris) proposed for Kyoto MUST be rejected as UNRESOLVED with lat/lng=None.
    """
    from app.ai.tools.maps import get_coordinates

    # 1. Out-of-bounds mismatch: Eiffel Tower when destination is Kyoto
    mismatch_geo = get_coordinates("Eiffel Tower", target_destination="Kyoto")
    assert mismatch_geo["found"] is False
    assert mismatch_geo["lat"] is None
    assert mismatch_geo["lng"] is None
    assert mismatch_geo["location_source"] == "UNRESOLVED"
    assert mismatch_geo.get("mismatch") is True

    # 2. In-bounds valid spot: Arashiyama when destination is Kyoto
    valid_geo = get_coordinates("Arashiyama Bamboo Grove", target_destination="Kyoto")
    assert valid_geo["found"] is True
    assert valid_geo["lat"] is not None
    assert valid_geo["location_source"] == "CURATED"

def test_strict_constraint_validator():
    """
    Test that validate_plan_constraints strictly requires sequential day numbers 1..N
    and enforces exactly 3 activities per day.
    """
    from app.ai.agents.planner_agent import validate_plan_constraints, AIItineraryRaw, AIDayRaw, AIActivityRaw

    # Day count too low -> raises ValueError
    insufficient_days = AIItineraryRaw(
        title="Test",
        days=[
            AIDayRaw(
                day_number=1,
                title="Day 1",
                activities=[
                    AIActivityRaw(time_slot="09:00 AM", description="A1", location="Kyoto"),
                    AIActivityRaw(time_slot="01:00 PM", description="A2", location="Kyoto")
                ]
            )
        ]
    )
    with pytest.raises(ValueError, match="expected 2"):
        validate_plan_constraints(insufficient_days, expected_days=2)

    # Valid plan with 4 activities per day -> truncated strictly to 3 activities
    plan_with_4 = AIItineraryRaw(
        title="Test",
        days=[
            AIDayRaw(
                day_number=1,
                title="Day 1",
                activities=[
                    AIActivityRaw(time_slot="09:00 AM", description="A1", location="Kyoto"),
                    AIActivityRaw(time_slot="01:00 PM", description="A2", location="Kyoto"),
                    AIActivityRaw(time_slot="04:00 PM", description="A3", location="Kyoto"),
                    AIActivityRaw(time_slot="07:00 PM", description="A4", location="Kyoto")
                ]
            )
        ]
    )
    validated = validate_plan_constraints(plan_with_4, expected_days=1)
    assert len(validated.days) == 1
    assert len(validated.days[0].activities) == 3

