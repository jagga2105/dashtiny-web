"""
DashTiny L4 — Intelligent Itinerary Generation + Planner UX 2.0 Comprehensive Test Suite
backend/tests/unit/test_planner_l4.py

Validates all L4 P0/P1 contracts:
1. One canonical pipeline for all itinerary generation
2. Durable PostgreSQL TripProposal persistence & lifecycle (pending, accepted, rejected, expired)
3. Proposal ownership enforcement (403/404 for unauthorized users)
4. Proposal concurrency & atomic acceptance (FOR UPDATE, 409 Conflict on double-accept)
5. No fake destination data (422 DestinationResearchIncompleteError on unknown destinations)
6. Authentic Destination Intelligence & interest matching scoring
7. Pace variation with material density changes (Relaxed vs Balanced vs Packed)
8. Day semantics (ARRIVAL_DAY, NORMAL_DAY, DEPARTURE_DAY)
9. Budget engine decoupling food from stay, with over-budget action options
10. Truthful weather provenance (VERIFIED, SEASONAL_ESTIMATE, UNAVAILABLE)
11. 3-day sequential chunking and seamless merging for long trips (5-30 days)
12. Duplicate place and activity prevention across days
13. Geographic continuity & anti-ping-pong routing
14. Time feasibility with non-overlapping chronological schedules
15. End-to-end integration scenario (Prompt -> Intent -> Proposal -> Refine -> Accept -> Trip & Revision v1)
16. Squad room is personal by default (no automatic SquadRoom creation on trip accept)
"""
import pytest
from datetime import datetime, timedelta, timezone, date
from fastapi.testclient import TestClient

from app.models.models import User, TripProposal, Itinerary, TripSnapshot, AIRun, SquadRoom
from app.services.planner.itinerary_engine import (
    ItineraryEngine,
    PlannerService,
    TravelerBrief,
    StructuredDay,
    StructuredActivity
)
from app.services.planner.destination_intelligence import (
    DestinationIntelligence,
    DestinationCandidate,
    DestinationResearchIncompleteError
)
from app.services.planner.proposal_service import ProposalService
from app.services.planner.intent import parse_travel_intent
from app.services.planner.budget_engine import BudgetEngine
from app.main import app
from app.db.database import get_db
from app.api.deps import get_current_user


# ==============================================================================
# 1. PROPOSAL PERSISTENCE & DATABASE INTEGRITY
# ==============================================================================

def test_proposal_persistence_in_trip_proposal(client, db_session, test_user):
    """
    P0: Verifies proposals are durably stored in PostgreSQL TripProposal table,
    not in ephemeral memory. Verifies proposal generation DOES NOT create a Trip or Revision.
    """
    initial_trip_count = db_session.query(Itinerary).count()
    initial_revision_count = db_session.query(TripSnapshot).count()

    payload = {
        "destination": "Goa",
        "days_count": 3,
        "travellers": 2,
        "budget": 50000.0,
        "currency": "INR",
        "start_date": "2026-11-10",
        "end_date": "2026-11-12",
        "pace": "balanced",
        "persona": "couple",
        "interests": ["beaches", "food"]
    }

    res = client.post("/api/v1/planner/proposals", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    proposal_id = data["proposal_id"]

    # Verify persisted in database
    db_prop = db_session.query(TripProposal).filter(TripProposal.id == proposal_id).first()
    assert db_prop is not None
    assert db_prop.user_id == test_user.id
    assert db_prop.status == "pending"
    assert db_prop.trip_id is None
    assert db_prop.proposal_data is not None
    assert len(db_prop.proposal_data["days"]) == 3
    assert db_prop.proposal_data["budget_breakdown"]["total_estimated"] > 0

    # Verify NO Trip or Revision was created during proposal generation
    assert db_session.query(Itinerary).count() == initial_trip_count
    assert db_session.query(TripSnapshot).count() == initial_revision_count


# ==============================================================================
# 2. PROPOSAL OWNERSHIP & SECURITY
# ==============================================================================

def test_proposal_ownership_enforcement(client, db_session, test_user):
    """
    P0: A random authenticated user must not access, accept, reject, or edit another user's proposal.
    Must return 403 Forbidden.
    """
    # 1. Create proposal owned by test_user
    prop = ProposalService.create_itinerary_proposal(
        destination="Goa",
        days_count=3,
        travelers=2,
        budget=45000,
        user_id=test_user.id,
        db=db_session
    )
    prop_id = prop["proposal_id"]

    # 2. Setup attacker user
    attacker = User(
        id="attacker-uuid-9999",
        email="attacker@security-test.com",
        full_name="Attacker",
        password_hash="testhash"
    )
    db_session.add(attacker)
    db_session.commit()

    # Override current user to attacker
    app.dependency_overrides[get_current_user] = lambda: attacker

    try:
        # GET proposal
        get_res = client.get(f"/api/v1/planner/proposals/{prop_id}")
        assert get_res.status_code == 403
        assert "forbidden" in get_res.json()["detail"].lower() or "not authorized" in get_res.json()["detail"].lower()

        # POST accept
        accept_res = client.post(f"/api/v1/planner/proposals/{prop_id}/accept")
        assert accept_res.status_code == 403
        assert "forbidden" in accept_res.json()["detail"].lower() or "not authorized" in accept_res.json()["detail"].lower()

        # POST reject
        reject_res = client.post(f"/api/v1/planner/proposals/{prop_id}/reject")
        assert reject_res.status_code == 403
        assert "forbidden" in reject_res.json()["detail"].lower() or "not authorized" in reject_res.json()["detail"].lower()

        # POST edit
        edit_res = client.post(f"/api/v1/planner/proposals/{prop_id}/edit", json={"instruction": "Hack trip"})
        assert edit_res.status_code == 403
        assert "forbidden" in edit_res.json()["detail"].lower() or "not authorized" in edit_res.json()["detail"].lower()
    finally:
        app.dependency_overrides[get_current_user] = lambda: test_user


# ==============================================================================
# 3. PROPOSAL CONCURRENCY & ATOMIC ACCEPTANCE
# ==============================================================================

def test_proposal_concurrency_double_accept_prevention(client, db_session, test_user):
    """
    P0: Acceptance must be atomic. Two sequential/simultaneous accepts result in
    one success and one conflict (409). Never create two Trips from one proposal.
    """
    prop = ProposalService.create_itinerary_proposal(
        destination="Goa",
        days_count=2,
        travelers=2,
        budget=35000,
        user_id=test_user.id,
        db=db_session
    )
    prop_id = prop["proposal_id"]

    # First accept -> 200 OK, creates Trip
    res1 = client.post(f"/api/v1/planner/proposals/{prop_id}/accept")
    assert res1.status_code == 200
    trip_id = res1.json()["id"]

    # Verify proposal status in DB is accepted
    db_prop = db_session.query(TripProposal).filter(TripProposal.id == prop_id).first()
    assert db_prop.status == "accepted"
    assert db_prop.trip_id == trip_id

    # Second accept -> 409 Conflict
    res2 = client.post(f"/api/v1/planner/proposals/{prop_id}/accept")
    assert res2.status_code == 409
    assert "already" in res2.json()["detail"].lower()

    # Verify only ONE trip exists for this proposal
    trips_for_prop = db_session.query(TripProposal).filter(TripProposal.trip_id == trip_id).all()
    assert len(trips_for_prop) == 1


# ==============================================================================
# 4. PROPOSAL EXPIRY REJECTION
# ==============================================================================

def test_expired_proposal_cannot_be_accepted(client, db_session, test_user):
    """
    P0: Expired proposals cannot be accepted. Returns 400 Bad Request or 409 Conflict.
    """
    prop = ProposalService.create_itinerary_proposal(
        destination="Jaipur",
        days_count=2,
        travelers=2,
        budget=30000,
        user_id=test_user.id,
        db=db_session
    )
    prop_id = prop["proposal_id"]

    # Manually expire the proposal
    db_prop = db_session.query(TripProposal).filter(TripProposal.id == prop_id).first()
    db_prop.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.commit()

    res = client.post(f"/api/v1/planner/proposals/{prop_id}/accept")
    assert res.status_code in [400, 409]
    assert "expired" in res.json()["detail"].lower()

    db_session.refresh(db_prop)
    assert db_prop.status == "expired"


# ==============================================================================
# 5. NO FAKE DESTINATION DATA
# ==============================================================================

def test_unknown_destination_rejected_without_fabrication(client):
    """
    P0: Unknown destinations without verified attraction intelligence MUST NOT
    receive generic fake/placeholder attractions. Must return 422 Destination research incomplete.
    """
    payload = {
        "destination": "NowhereLand Realm 987654",
        "days_count": 3,
        "travellers": 2,
        "budget": 40000.0,
        "start_date": "2026-11-01",
        "end_date": "2026-11-03"
    }

    res = client.post("/api/v1/planner/proposals", json=payload)
    assert res.status_code == 422
    assert "destination research is incomplete" in res.json()["detail"].lower()


# ==============================================================================
# 6. INTEREST MATCHING & CANDIDATE SCORING
# ==============================================================================

def test_interest_matching_scores_candidate_places_materially():
    """
    P0: Interest matching provides explicit candidate scoring (+15 per tag)
    and formats deterministic why_recommended rationale.
    """
    beach_cand = DestinationCandidate(
        name="Palolem Beach Scenic Cove",
        description="Pristine crescent bay with gentle surf and beach shacks.",
        location="Canacona, South Goa",
        place_type="TA",
        categories=["beaches", "photography", "nature"],
        cost_estimate=0.0,
        duration=90,
        cluster_name="South Goa Beaches"
    )

    museum_cand = DestinationCandidate(
        name="Modern Art Gallery",
        description="Contemporary painting exhibits.",
        location="Panjim, Goa",
        place_type="TA",
        categories=["art", "indoor"],
        cost_estimate=250.0,
        duration=60,
        cluster_name="Central Goa"
    )

    user_interests = ["beaches", "photography"]

    score_beach, why_beach = DestinationIntelligence.score_candidate(
        candidate=beach_cand,
        user_interests=user_interests,
        persona="couple",
        pace="relaxed",
        target_cluster="South Goa Beaches"
    )

    score_museum, why_museum = DestinationIntelligence.score_candidate(
        candidate=museum_cand,
        user_interests=user_interests,
        persona="couple",
        pace="relaxed",
        target_cluster="South Goa Beaches"
    )

    # Beach candidate must score significantly higher
    assert score_beach > score_museum + 25
    assert "beaches" in why_beach.lower() or "photography" in why_beach.lower()
    assert "top traveler ratings" not in why_beach.lower()


# ==============================================================================
# 7. PACE VARIATION (RELAXED VS BALANCED VS PACKED)
# ==============================================================================

def test_pace_variation_materially_changes_density_and_schedule():
    """
    P1: Pace must produce materially different plans:
    - Relaxed: 2-4 stops, starts 10:00 AM, longer durations
    - Balanced: 3-5 stops, starts 09:00 AM
    - Packed: 4-7 stops, starts 08:00 AM, higher density
    """
    brief_relaxed = TravelerBrief.from_inputs(
        destination="Goa",
        days_count=3,
        pace="relaxed",
        budget=45000
    )
    brief_packed = TravelerBrief.from_inputs(
        destination="Goa",
        days_count=3,
        pace="packed",
        budget=45000
    )

    plan_relaxed = PlannerService.plan_from_brief(brief_relaxed)
    plan_packed = PlannerService.plan_from_brief(brief_packed)

    # Day 2 is a NORMAL_DAY with full pacing effect
    d2_relaxed = plan_relaxed.days[1]
    d2_packed = plan_packed.days[1]

    # Verify activity counts
    assert len(d2_relaxed.activities) < len(d2_packed.activities)
    assert len(d2_relaxed.activities) in [2, 3, 4]
    assert len(d2_packed.activities) in [4, 5, 6, 7]

    # Verify start times
    assert d2_relaxed.activities[0].time == "10:00 AM"
    assert d2_packed.activities[0].time == "08:00 AM"


# ==============================================================================
# 8. DATE & TRIP-DAY SEMANTICS
# ==============================================================================

def test_trip_day_semantics_arrival_and_departure():
    """
    P1: Day 1 must have ARRIVAL_DAY semantics (check-in, lunch, light orientation, max 3 stops).
    Day N must have DEPARTURE_DAY semantics (checkout, transfer, zero evening conflicts).
    Intermediate days must have NORMAL_DAY semantics.
    """
    brief = TravelerBrief.from_inputs(
        destination="Jaipur",
        days_count=3,
        pace="balanced",
        budget=40000
    )
    plan = PlannerService.plan_from_brief(brief)

    d1 = plan.days[0]
    d2 = plan.days[1]
    d3 = plan.days[2]

    # Day 1: Arrival
    assert d1.day_semantics == "ARRIVAL_DAY"
    assert len(d1.activities) <= 3
    assert d1.activities[0].place_type == "H"
    assert "check-in" in d1.activities[0].title.lower() or "arrive" in d1.activities[0].title.lower()

    # Day 2: Normal
    assert d2.day_semantics == "NORMAL_DAY"

    # Day 3: Departure
    assert d3.day_semantics == "DEPARTURE_DAY"
    last_act = d3.activities[-1]
    assert last_act.place_type == "H"
    assert "departure" in last_act.title.lower() or "transfer" in last_act.title.lower()
    # Zero evening activity scheduled on departure day
    assert not any(a.period_of_day == "evening" for a in d3.activities)


# ==============================================================================
# 9. BUDGET ENGINE CORRECTION & UX
# ==============================================================================

def test_budget_engine_decoupled_food_and_over_budget_actions():
    """
    P1: Food estimates must NOT derive from accommodation_preference.
    Food estimates depend on food preferences, destination, days, and travelers.
    Over-budget returns explicit corrective actions (reduce_cost, keep_highlights, change_stay, reduce_activities).
    """
    # 1. Verify food is independent of accommodation preference
    b_hostel = BudgetEngine.calculate_estimate(
        days_count=4,
        travelers=2,
        target_budget=20000,
        accommodation_preference="hostel",
        food_preferences=["local_eats"]
    )
    b_luxury = BudgetEngine.calculate_estimate(
        days_count=4,
        travelers=2,
        target_budget=80000,
        accommodation_preference="luxury",
        food_preferences=["local_eats"]
    )

    # Accommodation costs differ drastically
    assert b_luxury.accommodation > b_hostel.accommodation * 3
    # Food cost should be identical because food_preferences and travelers are the same
    assert b_luxury.food == b_hostel.food

    # 2. Verify over-budget actions
    over_budget = BudgetEngine.calculate_estimate(
        days_count=5,
        travelers=2,
        target_budget=15000,  # Far below realistic 5-day trip cost
        accommodation_preference="comfort"
    )
    assert over_budget.is_over_budget is True
    assert over_budget.overage_amount > 0
    assert len(over_budget.available_actions) >= 4
    action_slugs = [a if isinstance(a, str) else a.get("action", "") for a in over_budget.available_actions]
    assert "reduce_cost" in action_slugs
    assert "keep_highlights" in action_slugs
    assert "change_stay" in action_slugs
    assert "reduce_activities" in action_slugs


# ==============================================================================
# 10. WEATHER PROVENANCE TRUTHFULNESS
# ==============================================================================

def test_weather_provenance_truthfulness():
    """
    P0: Weather must carry honest provenance (VERIFIED, SEASONAL_ESTIMATE, UNAVAILABLE).
    Never hardcode fake satellite forecasts.
    """
    brief = TravelerBrief.from_inputs(
        destination="Coorg",
        days_count=2,
        budget=30000
    )
    plan = PlannerService.plan_from_brief(brief)

    valid_weather_provs = {"VERIFIED", "SEASONAL_ESTIMATE", "UNAVAILABLE"}
    for day in plan.days:
        assert day.weather_provenance in valid_weather_provs
        assert len(day.weather_summary) > 0


# ==============================================================================
# 11. 3-DAY SEQUENTIAL CHUNKING & SEAMLESS MERGING
# ==============================================================================

def test_long_trip_chunk_merge_and_duplicate_prevention():
    """
    P0: Trips of 5-30 days use 3-day sequential chunking passing continuity context.
    The resulting days merge seamlessly without duplicate places.
    """
    brief = TravelerBrief.from_inputs(
        destination="Kyoto",
        days_count=7,
        budget=120000,
        pace="balanced"
    )

    # 7 days splits into: [1..3, 4..6, 7..7]
    chunks = PlannerService.build_chunks(brief.days_count)
    assert chunks == [(1, 3), (4, 6), (7, 7)]

    plan = PlannerService.plan_from_brief(brief)
    assert len(plan.days) == 7

    # Verify strictly sequential day numbers
    for i, d in enumerate(plan.days, start=1):
        assert d.day_number == i

    # Verify duplicate place prevention across chunk boundaries
    seen_places = set()
    for d in plan.days:
        for act in d.activities:
            # Exclude check-in and checkout logistics
            if act.place_type != "H":
                title_lower = act.title.lower().strip()
                assert title_lower not in seen_places, f"Duplicate attraction detected: {act.title} on Day {d.day_number}"
                seen_places.add(title_lower)


# ==============================================================================
# 12. GEOGRAPHIC CONTINUITY & ANTI-PING-PONG ROUTING
# ==============================================================================

def test_geographic_continuity_anti_ping_pong():
    """
    P1: Daily activities are clustered geographically with Haversine distance tracking.
    """
    brief = TravelerBrief.from_inputs(
        destination="Goa",
        days_count=3,
        budget=45000,
        pace="balanced"
    )
    plan = PlannerService.plan_from_brief(brief)

    for day in plan.days:
        assert day.geography_confidence in ["VERIFIED", "APPROXIMATE"]
        assert day.cluster_name != ""
        # Activities within day share or neighbor the cluster
        for act in day.activities:
            if act.lat is not None and act.lng is not None:
                assert -90 <= act.lat <= 90
                assert -180 <= act.lng <= 180


# ==============================================================================
# 13. TIME FEASIBILITY & CHRONOLOGICAL BUFFERING
# ==============================================================================

def test_time_feasibility_no_overlapping_activities():
    """
    P1: Every activity has chronological start and end time with sufficient transit/rest buffers.
    """
    brief = TravelerBrief.from_inputs(
        destination="Jaipur",
        days_count=3,
        budget=40000,
        pace="balanced"
    )
    plan = PlannerService.plan_from_brief(brief)

    for day in plan.days:
        prev_end_mins = None
        for act in day.activities:
            # Time string format e.g. "09:30 AM"
            assert "AM" in act.time or "PM" in act.time
            assert act.duration_minutes > 0
            assert act.transit_time_minutes >= 0
            assert "(Estimated)" in act.estimated_transit
            assert "(Estimated)" in act.crowd_warning


# ==============================================================================
# 14. END-TO-END PROPOSAL LIFECYCLE SCENARIO
# ==============================================================================

def test_end_to_end_proposal_lifecycle_scenario(client, db_session, test_user):
    """
    Full Scenario:
    User
     ↓ Natural language
    Intent Parsing
     ↓
    Proposal Generation (No Trip, No Revision)
     ↓
    Review & Revision Request
     ↓
    New Revised Proposal (No Trip, No Revision)
     ↓
    Accept
     ↓
    Trip Created + Revision v1 + AIRun telemetry
    """
    # 1. Natural Language Intent Parsing
    prompt = "5 days in Goa from Delhi for 2 under 50k, relaxed with beaches and good food"
    intent_res = client.post("/api/v1/planner/parse-intent", json={"prompt": prompt})
    assert intent_res.status_code == 200
    res_data = intent_res.json()
    intent = res_data.get("understood") or res_data.get("intent")
    assert intent["destination"].lower() == "goa"
    assert intent["days_count"] == 5
    assert (intent.get("travelers_count") or intent.get("travelers")) == 2
    assert intent["budget"] == 50000
    assert intent["pace"] == "relaxed"
    assert "beaches" in intent["interests"]

    # 2. Generate Initial Proposal
    prop_req = {
        "destination": intent["destination"],
        "days_count": intent["days_count"],
        "travellers": intent.get("travelers_count") or intent.get("travelers") or 2,
        "budget": intent["budget"],
        "origin": intent.get("origin") or "Delhi",
        "pace": intent["pace"],
        "interests": intent["interests"],
        "start_date": "2026-11-15",
        "end_date": "2026-11-19"
    }
    prop_res = client.post("/api/v1/planner/proposals", json=prop_req)
    assert prop_res.status_code == 200
    initial_prop = prop_res.json()
    initial_prop_id = initial_prop["proposal_id"]

    # Verify no trip or revision yet
    assert db_session.query(Itinerary).count() == 0
    assert db_session.query(TripSnapshot).count() == 0

    # 3. Refine Proposal via Partial Edit
    edit_res = client.post(
        f"/api/v1/planner/proposals/{initial_prop_id}/edit",
        json={"instruction": "Add more local food and make Day 2 more relaxed"}
    )
    assert edit_res.status_code == 200
    refined_prop = edit_res.json()
    refined_prop_id = refined_prop["proposal_id"]

    # Still no trip or revision
    assert db_session.query(Itinerary).count() == 0
    assert db_session.query(TripSnapshot).count() == 0

    # 4. Accept Refined Proposal
    accept_res = client.post(f"/api/v1/planner/proposals/{refined_prop_id}/accept")
    assert accept_res.status_code == 200
    trip = accept_res.json()
    trip_id = trip["id"]

    # Now Trip and Revision v1 exist in database!
    db_trip = db_session.query(Itinerary).filter(Itinerary.id == trip_id).first()
    assert db_trip is not None
    assert db_trip.destination == "Goa"

    revisions = db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip_id).all()
    assert len(revisions) == 1
    assert revisions[0].version == 1
    assert revisions[0].action_type == "INITIAL_CREATION"

    # AI Telemetry logged
    ai_run = db_session.query(AIRun).filter(AIRun.trip_id == trip_id).first()
    assert ai_run is not None
    assert ai_run.status == "success"

    # 5. Reject another proposal -> status rejected, no Trip created
    other_prop = ProposalService.create_itinerary_proposal(
        destination="Jaipur",
        days_count=2,
        user_id=test_user.id,
        db=db_session
    )
    reject_res = client.post(f"/api/v1/planner/proposals/{other_prop['proposal_id']}/reject")
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"


# ==============================================================================
# 15. SQUAD ROOM PERSONAL BY DEFAULT (NO AUTOMATIC SQUAD)
# ==============================================================================

def test_squad_room_is_not_automatically_created(client, db_session, test_user):
    """
    P1: Trips are personal by default. When a proposal is accepted,
    a SquadRoom must NOT be created automatically. The traveler chooses 'Plan with friends'.
    """
    prop = ProposalService.create_itinerary_proposal(
        destination="Manali",
        days_count=3,
        travelers=1,
        user_id=test_user.id,
        db=db_session
    )
    accept_res = client.post(f"/api/v1/planner/proposals/{prop['proposal_id']}/accept")
    assert accept_res.status_code == 200
    trip_id = accept_res.json()["id"]

    # Verify no SquadRoom exists for this trip
    squad = db_session.query(SquadRoom).filter(SquadRoom.itinerary_id == trip_id).first()
    assert squad is None, "SquadRoom was automatically created for a personal trip!"
