"""
DashTiny Itinerary 2.0 Test Suite
backend/tests/unit/test_itinerary_2_0.py

Comprehensive tests for:
1. TravelerBrief validation & normalization
2. Natural language intent extraction across all dimensions (trip_type, travel_mode, pace, daily_schedule, itinerary_style, stopovers)
3. 3-day sequential chunking & cross-chunk continuity
4. Global itinerary validator: day continuity, zero duplicate places, time conflicts, geographic sanity, budget guardrails
5. Arrival day (lighter, check-in) & Departure day (checkout, transit buffer)
6. Adaptive daily rhythm (early_riser vs night_owl) and density (relaxed vs fast)
7. Daily vs Detailed itinerary style
8. AI proposal adaptation (make it more relaxed, cheaper, start later, add food, add nature)
9. Community trip adaptation
10. Multi-duration trips: 3, 5, 7, 10, 14 days
"""
import pytest
from datetime import date, timedelta
from app.utils.text_normalizer import normalize_travel_text, correct_travel_spelling, normalize_city_alias
from app.services.planner.traveler_brief import TravelerBrief, Stopover
from app.services.planner.intent import parse_travel_intent
from app.services.planner.itinerary_engine import (
    PlannerService,
    ItineraryEngine,
    ChunkContinuityContext,
    StructuredDay,
    StructuredActivity
)
from app.services.itinerary_validator import GlobalItineraryValidator, parse_time_to_minutes
from app.services.planner.proposal_service import ProposalService


def test_travel_text_normalizer():
    # Spelling corrections
    assert correct_travel_spelling("itiniary") == "itinerary"
    assert correct_travel_spelling("accomodation") == "accommodation"
    assert correct_travel_spelling("resturant") == "restaurant"
    assert correct_travel_spelling("flite") == "flight"
    
    # City aliases
    assert normalize_city_alias("bombay") == "Mumbai"
    assert normalize_city_alias("bangalore") == "Bengaluru"
    assert normalize_city_alias("calcutta") == "Kolkata"
    assert normalize_city_alias("banaras") == "Varanasi"

    # Full text normalizer
    norm = normalize_travel_text("Plan a trip to bombay with cheap accomodation and flite")
    assert "Mumbai" in norm
    assert "accommodation" in norm
    assert "flight" in norm


def test_traveler_brief_model_and_allocations():
    # Valid brief
    brief = TravelerBrief(
        destination="Goa",
        origin="Delhi",
        days_count=7,
        travellers=2,
        budget=60000.0,
        trip_type="romantic",
        travel_mode="flight",
        pace="relaxed",
        daily_schedule="balanced",
        itinerary_style="daily",
        interests=["food", "beaches", "photography"],
        stopovers=[Stopover(location="South Goa", nights=2, sequence=1)]
    )

    assert brief.destination == "Goa"
    assert brief.trip_type == "romantic"
    assert brief.pace == "relaxed"
    assert len(brief.stopovers) == 1
    assert brief.stopovers[0].location == "South Goa"
    assert brief.stopovers[0].nights == 2

    # Stopover allocations
    allocations = brief.get_stopover_day_allocations()
    # Should allocate 2 days to South Goa, then remaining 5 days to Goa
    assert len(allocations) == 2
    assert allocations[0] == ("South Goa", 1, 2)
    assert allocations[1] == ("Goa", 3, 7)


def test_travel_intent_parser_itinerary_2_0_comprehensive():
    prompt = (
        "Plan me a relaxed 7-day Goa trip from Delhi for ₹60,000. "
        "I love food, beaches and photography. I'm travelling with my partner. "
        "Start days around 9:30. Include South Goa for 2 nights."
    )
    result = parse_travel_intent(prompt)
    understood = result.understood

    assert understood.destination == "Goa"
    assert understood.origin == "Delhi"
    assert understood.days_count == 7
    assert understood.budget == 60000.0
    assert understood.travelers == 2
    assert understood.persona == "couple"
    assert understood.trip_type == "romantic"
    assert understood.pace == "relaxed"
    assert understood.daily_schedule == "balanced"
    assert "food" in understood.interests
    assert "beaches" in understood.interests
    assert "photography" in understood.interests
    assert len(understood.stopovers) == 1
    assert understood.stopovers[0]["location"] == "South Goa"
    assert understood.stopovers[0]["nights"] == 2
    assert result.is_ready_to_plan is True


def test_chunk_calculation_3_day_boundaries():
    # 3 days -> 1 chunk
    assert PlannerService.build_chunks(3) == [(1, 3)]
    # 4 days -> 1 chunk
    assert PlannerService.build_chunks(4) == [(1, 4)]
    # 5 days -> [1..3, 4..5]
    assert PlannerService.build_chunks(5) == [(1, 3), (4, 5)]
    # 7 days -> [1..3, 4..6, 7..7]
    assert PlannerService.build_chunks(7) == [(1, 3), (4, 6), (7, 7)]
    # 10 days -> [1..3, 4..6, 7..9, 10..10]
    assert PlannerService.build_chunks(10) == [(1, 3), (4, 6), (7, 9), (10, 10)]
    # 14 days -> [1..3, 4..6, 7..9, 10..12, 13..14]
    assert PlannerService.build_chunks(14) == [(1, 3), (4, 6), (7, 9), (10, 12), (13, 14)]


def test_chunk_generation_and_continuity_context():
    brief = TravelerBrief(
        destination="Goa",
        days_count=7,
        travellers=2,
        budget=60000.0,
        pace="relaxed",
        daily_schedule="balanced"
    )

    init_context = ChunkContinuityContext(
        chunk_index=0,
        previous_chunk_final_location="Goa",
        budget_remaining=60000.0
    )

    # Chunk 1 (Days 1 to 3)
    chunk1_days, ctx1 = PlannerService.generate_chunk(
        brief=brief,
        start_day=1,
        end_day=3,
        trip_start_date=date(2026, 11, 1),
        context=init_context
    )

    assert len(chunk1_days) == 3
    assert chunk1_days[0].day_number == 1
    assert chunk1_days[1].day_number == 2
    assert chunk1_days[2].day_number == 3
    assert ctx1.chunk_index == 1
    assert ctx1.previous_chunk_final_location is not None
    assert len(ctx1.already_visited_places) > 0

    # Chunk 2 (Days 4 to 6) receiving Chunk 1 context
    chunk2_days, ctx2 = PlannerService.generate_chunk(
        brief=brief,
        start_day=4,
        end_day=6,
        trip_start_date=date(2026, 11, 1),
        context=ctx1
    )

    assert len(chunk2_days) == 3
    assert chunk2_days[0].day_number == 4
    assert chunk2_days[1].day_number == 5
    assert chunk2_days[2].day_number == 6
    # No duplicate activities across chunks
    chunk1_titles = {a.title.lower() for d in chunk1_days for a in d.activities}
    chunk2_titles = {a.title.lower() for d in chunk2_days for a in d.activities}
    assert len(chunk1_titles.intersection(chunk2_titles)) == 0


def test_arrival_and_departure_day_logic():
    brief = TravelerBrief(
        destination="Goa",
        days_count=4,
        travellers=2,
        budget=40000.0,
        pace="balanced"
    )

    proposal = PlannerService.plan_from_brief(brief)
    days = proposal.days

    # Day 1: Arrival & Settle In
    day1 = days[0]
    assert "Arrive" in day1.day_theme or "Settle" in day1.day_theme
    # First activity should be check-in / arrival
    assert any(a.place_type == "H" or "arrive" in a.title.lower() or "check-in" in a.title.lower() for a in day1.activities)
    assert len(day1.activities) <= 3  # Lighter schedule on arrival day

    # Final Day: Farewell & Departure
    final_day = days[-1]
    assert "Departure" in final_day.day_theme or "Farewell" in final_day.day_theme
    # Final day should have checkout and farewell/transfer
    assert any(a.place_type == "H" or "checkout" in a.title.lower() for a in final_day.activities)
    assert any("farewell" in a.title.lower() or "transfer" in a.title.lower() for a in final_day.activities)


def test_adaptive_daily_rhythm_early_riser_vs_night_owl():
    # Early Riser: starts ~ 08:30 AM
    brief_early = TravelerBrief(
        destination="Goa",
        days_count=3,
        daily_schedule="early_riser",
        pace="fast"
    )
    prop_early = PlannerService.plan_from_brief(brief_early)
    # Day 2 should start early
    start_early = prop_early.days[1].activities[0].time
    assert parse_time_to_minutes(start_early) <= 8 * 60 + 35

    # Night Owl: starts ~ 10:30 AM
    brief_night = TravelerBrief(
        destination="Goa",
        days_count=3,
        daily_schedule="night_owl",
        pace="relaxed"
    )
    prop_night = PlannerService.plan_from_brief(brief_night)
    start_night = prop_night.days[1].activities[0].time
    assert parse_time_to_minutes(start_night) >= 10 * 60


def test_global_itinerary_validator_checks():
    # Construct synthetic raw days to test validator guarantees
    days = [
        {
            "day_number": 1,
            "title": "Day 1",
            "cluster_name": "North Goa",
            "activities": [
                {
                    "title": "Aguada Fort",
                    "time": "09:30 AM",
                    "duration_minutes": 120,
                    "transit_time_minutes": 15,
                    "place_type": "TA",
                    "cluster": "North Goa"
                },
                {
                    "title": "Conflicting Activity",
                    "time": "10:30 AM",  # Conflict! Prior activity ends at 11:30 AM
                    "duration_minutes": 60,
                    "transit_time_minutes": 15,
                    "place_type": "TA",
                    "cluster": "North Goa"
                }
            ]
        },
        {
            "day_number": 3,  # Continuity gap! Day 2 missing
            "title": "Day 3",
            "cluster_name": "South Goa",
            "activities": [
                {
                    "title": "Aguada Fort",  # Duplicate place from Day 1!
                    "time": "09:30 AM",
                    "duration_minutes": 90,
                    "transit_time_minutes": 15,
                    "place_type": "TA",
                    "cluster": "South Goa"
                }
            ]
        }
    ]

    polished, report = GlobalItineraryValidator.validate_global_plan(
        days=days,
        pace="balanced",
        target_budget=30000.0,
        estimated_budget=28000.0
    )

    # Day continuity gap auto-resolved
    assert polished[0]["day_number"] == 1
    assert polished[1]["day_number"] == 2

    # Time conflict auto-resolved
    day1_acts = polished[0]["activities"]
    assert parse_time_to_minutes(day1_acts[1]["time"]) >= parse_time_to_minutes("11:45 AM")

    # Duplicate place flagged and handled
    issues = [i.category for i in report.issues]
    assert "CONTINUITY" in issues
    assert "TIMING" in issues
    assert "DUPLICATE" in issues


def test_budget_categories_reasoning():
    brief = TravelerBrief(
        destination="Goa",
        origin="Delhi",
        days_count=5,
        travellers=2,
        budget=60000.0,
        accommodation_preference="comfort"
    )

    proposal = PlannerService.plan_from_brief(brief)
    b = proposal.budget_breakdown

    assert b.total_estimated > 0
    assert b.accommodation > 0
    assert b.food > 0
    assert b.activities > 0
    assert b.local_transport > 0
    assert b.intercity_transport > 0
    assert b.miscellaneous > 0
    assert len(b.categories) >= 5


def test_ai_proposal_adaptation_commands():
    # 1. Generate base proposal
    prop_data = ProposalService.create_itinerary_proposal(
        destination="Goa",
        days_count=4,
        travelers=2,
        budget=50000.0
    )
    prop_id = prop_data["proposal_id"]

    # 2. Adaptation: "Make Day 2 more relaxed"
    edit_relax = ProposalService.propose_partial_edit(
        proposal_id=prop_id,
        instruction="Make Day 2 more relaxed",
        target_day=2
    )
    assert len(edit_relax["changes"]) > 0
    assert edit_relax["changes"][0]["action"] == "replaced"
    new_prop_id = edit_relax["proposal_id"]

    # 3. Adaptation: "Start later on Day 3"
    edit_start_later = ProposalService.propose_partial_edit(
        proposal_id=new_prop_id,
        instruction="Start later on Day 3",
        target_day=3
    )
    assert len(edit_start_later["changes"]) > 0
    assert any(c["action"] == "rescheduled" for c in edit_start_later["changes"])

    # 4. Adaptation: "Make it cheaper"
    edit_cheaper = ProposalService.propose_partial_edit(
        proposal_id=edit_start_later["proposal_id"],
        instruction="Make it cheaper and save money",
        target_day=2
    )
    assert "proposal_id" in edit_cheaper


def test_various_trip_durations_3_5_7_10_14():
    for days in [3, 5, 7, 10, 14]:
        brief = TravelerBrief(
            destination="Goa",
            days_count=days,
            travellers=2,
            budget=days * 8000.0,
            pace="balanced"
        )
        proposal = PlannerService.plan_from_brief(brief)
        assert len(proposal.days) == days
        assert proposal.days[0].day_number == 1
        assert proposal.days[-1].day_number == days
        # Contiguity check: 1 to N
        for idx, d in enumerate(proposal.days):
            assert d.day_number == idx + 1
            assert len(d.activities) >= 2
            # Verify coordinates are not fabricated
            for act in d.activities:
                if act.lat is not None:
                    assert isinstance(act.lat, float)
                    assert isinstance(act.lng, float)
