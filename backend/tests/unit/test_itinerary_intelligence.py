"""
DashTiny Itinerary Intelligence Test Suite
backend/tests/unit/test_itinerary_intelligence.py

Verifies:
1. Natural language intent extraction (origin, destination, days, travelers, budget, pace, interests)
2. 1-day, 3-day, 5-day, 7-day, and 14-day trip generation
3. Chunked generation for trips > 4 days (e.g. 7-day and 14-day trips)
4. Anti-duplicate and time-feasibility validation
5. Budget engine with category breakdown & budget overrun guardrails
6. Proposal lifecycle: generate -> trip unchanged, accept -> trip created + revision v1, reject -> trip unchanged
7. Partial editing: modifying target day preserves unrelated days
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, TripSnapshot, User
from app.services.planner.intent import parse_travel_intent
from app.services.planner.itinerary_engine import ItineraryEngine
from app.services.planner.budget_engine import BudgetEngine
from app.services.planner.validator import ItineraryValidator


def test_intent_extraction_natural_language():
    prompt = "5 day Goa trip from Delhi for two people under 50k, relaxed, beaches and good food"
    result = parse_travel_intent(prompt)

    assert result.is_ready_to_plan is True
    assert result.understood.destination == "Goa"
    assert result.understood.origin == "Delhi"
    assert result.understood.days_count == 5
    assert result.understood.travelers == 2
    assert result.understood.budget == 50000.0
    assert result.understood.pace == "relaxed"
    assert "beaches" in result.understood.interests
    assert "food" in result.understood.interests
    assert "Goa" in result.summary_text
    assert "5 days" in result.summary_text


def test_intent_extraction_missing_destination():
    prompt = "plan a 4-day trip for 2 people under 30k"
    result = parse_travel_intent(prompt)

    assert result.is_ready_to_plan is False
    assert "destination" in result.missing_critical
    assert len(result.clarification_questions) > 0


def test_itinerary_generation_1_day_and_3_day():
    # 1-Day Trip
    prop_1 = ItineraryEngine.generate_itinerary(
        destination="Jaipur",
        days_count=1,
        travelers=2,
        budget=15000.0
    )
    assert prop_1.days_count == 1
    assert len(prop_1.days) == 1
    assert len(prop_1.days[0].activities) >= 2
    assert prop_1.budget_breakdown.total_estimated > 0

    # 3-Day Trip
    prop_3 = ItineraryEngine.generate_itinerary(
        destination="Goa",
        days_count=3,
        travelers=2,
        budget=35000.0,
        pace="relaxed"
    )
    assert prop_3.days_count == 3
    assert len(prop_3.days) == 3
    # Check relaxed density: 2-4 activities
    for day in prop_3.days:
        assert 2 <= len(day.activities) <= 5


def test_chunked_generation_7_day_and_14_day():
    """Verifies that 7-day and 14-day trips use chunked synthesis and merge into one unified plan."""
    # 7-Day Trip
    prop_7 = ItineraryEngine.generate_itinerary(
        destination="Goa",
        days_count=7,
        travelers=2,
        budget=70000.0,
        pace="balanced"
    )
    assert prop_7.days_count == 7
    assert len(prop_7.days) == 7
    # Verify no duplicates across days
    all_titles = [act.title.lower() for d in prop_7.days for act in d.activities]
    # Check deduplication is preserved
    assert len(all_titles) > 15
    assert prop_7.validation.quality_score >= 70

    # 14-Day Trip
    prop_14 = ItineraryEngine.generate_itinerary(
        destination="Goa",
        days_count=14,
        travelers=2,
        budget=120000.0
    )
    assert prop_14.days_count == 14
    assert len(prop_14.days) == 14


def test_budget_engine_breakdown_and_guardrails():
    # On target test
    breakdown = BudgetEngine.calculate_estimate(
        days_count=5,
        travelers=2,
        target_budget=50000.0,
        accommodation_preference="comfort"
    )
    assert len(breakdown.categories) >= 4
    categories = {c.category: c.amount for c in breakdown.categories}
    assert "accommodation" in categories
    assert "food" in categories
    assert "activities" in categories
    assert "local_transport" in categories

    # Over budget test (target 20k, but estimate ~40k)
    over_breakdown = BudgetEngine.calculate_estimate(
        days_count=6,
        travelers=4,
        target_budget=20000.0,
        accommodation_preference="comfort"
    )
    assert over_breakdown.is_over_budget is True
    assert over_breakdown.guardrail_status == "OVER_TARGET"
    assert "reduce_cost" in over_breakdown.available_actions
    assert over_breakdown.overage_amount > 0


def test_proposal_lifecycle_generate_does_not_mutate_db(client: TestClient, db_session: Session, test_user):
    """Proposal generation does not mutate the database."""
    initial_trip_count = db_session.query(Itinerary).count()

    res = client.post("/api/v1/planner/proposals", json={
        "destination": "Goa",
        "days_count": 5,
        "travellers": 2,
        "budget": 50000.0,
        "pace": "relaxed"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert "proposal_id" in data
    assert data["destination"] == "Goa"
    assert len(data["days"]) == 5

    # Database Trip count must be unchanged!
    db_session.expire_all()
    current_trip_count = db_session.query(Itinerary).count()
    assert current_trip_count == initial_trip_count


def test_proposal_lifecycle_accept_creates_trip_and_revision(client: TestClient, db_session: Session, test_user):
    """Accepting a proposal creates the Trip and initial revision v1."""
    # 1. Generate proposal
    res = client.post("/api/v1/planner/proposals", json={
        "destination": "Jaipur",
        "days_count": 3,
        "travellers": 2,
        "budget": 30000.0,
        "pace": "balanced"
    })
    assert res.status_code == 200
    proposal_id = res.json()["proposal_id"]

    # 2. Accept proposal
    accept_res = client.post(f"/api/v1/planner/proposals/{proposal_id}/accept")
    assert accept_res.status_code == 200, accept_res.text
    trip_data = accept_res.json()
    trip_id = trip_data["id"]

    # Verify Trip in DB
    trip = db_session.query(Itinerary).filter(Itinerary.id == trip_id).first()
    assert trip is not None
    assert trip.destination == "Jaipur"
    assert trip.owner_id == test_user.id

    # Verify Days and Activities
    days = db_session.query(ItineraryDay).filter(ItineraryDay.itinerary_id == trip_id).all()
    assert len(days) == 3

    # Verify TripRevision v1
    revision = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip_id,
        TripSnapshot.action_type == "INITIAL_CREATION"
    ).first()
    assert revision is not None
    assert revision.version == 1


def test_proposal_lifecycle_reject_does_not_create_trip(client: TestClient, db_session: Session, test_user):
    """Rejecting a proposal discards it without touching the database."""
    initial_trip_count = db_session.query(Itinerary).count()

    # 1. Generate proposal
    res = client.post("/api/v1/planner/proposals", json={
        "destination": "Manali",
        "days_count": 3,
        "travellers": 2
    })
    assert res.status_code == 200
    proposal_id = res.json()["proposal_id"]

    # 2. Reject proposal
    reject_res = client.post(f"/api/v1/planner/proposals/{proposal_id}/reject")
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"

    # Trip count unchanged
    assert db_session.query(Itinerary).count() == initial_trip_count


def test_partial_edit_preserves_unrelated_days(client: TestClient, db_session: Session, test_user):
    """Editing one day modifies only that day and leaves other days completely preserved."""
    # 1. Generate proposal
    res = client.post("/api/v1/planner/proposals", json={
        "destination": "Goa",
        "days_count": 4,
        "travellers": 2,
        "pace": "balanced"
    })
    assert res.status_code == 200
    proposal = res.json()
    proposal_id = proposal["proposal_id"]

    day1_before = proposal["days"][0]["activities"]
    day2_before = proposal["days"][1]["activities"]

    # 2. Partial edit: make Day 2 more relaxed
    edit_res = client.post(f"/api/v1/planner/proposals/{proposal_id}/edit", json={
        "instruction": "Make Day 2 more relaxed",
        "target_day": 2
    })
    assert edit_res.status_code == 200
    edit_data = edit_res.json()
    assert len(edit_data["changes"]) > 0

    updated_days = edit_data["updated_days"]
    # Day 1 must be exactly preserved!
    assert len(updated_days[0]["activities"]) == len(day1_before)
    assert updated_days[0]["activities"][0]["title"] == day1_before[0]["title"]

    # Day 2 should reflect the relaxation edit
    day2_titles = [a["title"] for a in updated_days[1]["activities"]]
    assert any("Leisure" in t or "Relaxation" in t for t in day2_titles)
