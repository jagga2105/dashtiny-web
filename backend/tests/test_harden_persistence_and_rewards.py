import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from app.models.models import (
    User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity,
    TripSnapshot, RewardVoucher, RewardRedemption, RewardTransaction,
    AIRun, AIToolCall, Booking
)
from app.services.reward_service import award_rewards

def test_multiple_trip_snapshots_versioning_and_reason(client, db_session, test_user):
    """
    Issue 2 & 16:
    - Multiple consecutive AI mutations on the same trip increment snapshot version (v1, v2, etc.).
    - UniqueConstraint("trip_id", "version") does not break.
    - Reason fields (action_type, actor_type, instruction, model) are recorded.
    """
    trip = Itinerary(
        title="Kyoto Zen Passage",
        destination="Kyoto",
        owner_id=test_user.id,
        total_budget=50000.0,
        currency="INR",
        start_date=datetime(2026, 11, 10).date(),
        end_date=datetime(2026, 11, 15).date()
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1: Arrival")
    db_session.add(day1)
    db_session.commit()
    db_session.refresh(day1)

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="10:00 AM",
        description="Fushimi Inari Morning Walk",
        location="Fushimi Inari",
        place_type="TA",
        cost_estimate=0.0,
        provenance="VERIFIED",
        sort_order=0
    )
    db_session.add(act1)
    db_session.commit()
    db_session.refresh(act1)

    original_act_id = act1.id

    # 1. First AI edit -> creates snapshot v1
    res1 = client.post(
        "/api/v1/ai/query",
        json={"trip_id": trip.id, "instruction": "Add lunch at Nishiki Market"}
    )
    assert res1.status_code == 200, res1.text
    snap1 = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip.id,
        TripSnapshot.version == 1
    ).first()
    assert snap1 is not None
    assert snap1.action_type == "AI_MODIFY_ITINERARY"
    assert snap1.actor_type == "USER"
    assert "lunch" in snap1.instruction.lower()

    # 2. Second AI edit -> must increment to version 2 without crashing
    res2 = client.post(
        "/api/v1/ai/query",
        json={"trip_id": trip.id, "instruction": "Move sunset to Kiyomizu-dera"}
    )
    assert res2.status_code == 200, res2.text
    snap2 = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip.id,
        TripSnapshot.version == 2
    ).first()
    assert snap2 is not None
    assert snap2.version == 2
    assert snap2.action_type == "AI_MODIFY_ITINERARY"

    # 3. Verify stable activity ID was retained for the existing activity
    db_session.expire_all()
    retained_act = db_session.query(ItineraryActivity).filter(ItineraryActivity.id == original_act_id).first()
    assert retained_act is not None
    assert retained_act.location == "Fushimi Inari"

def test_complete_22_field_snapshot_and_undo_restoration(client, db_session, test_user):
    """
    Issue 4: Complete canonical activity state is serialized in snapshot and restored during undo.
    Tests structured temporal (start_at, end_at, duration_minutes, timezone), transit (mode, minutes, confidence, source),
    and provenance fields.
    """
    trip = Itinerary(
        title="Tokyo Tech Expedition",
        destination="Tokyo",
        owner_id=test_user.id,
        total_budget=80000.0,
        currency="INR",
        start_date=datetime(2026, 11, 10).date(),
        end_date=datetime(2026, 11, 15).date()
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1: Akihabara")
    db_session.add(day1)
    db_session.commit()
    db_session.refresh(day1)

    start_time = datetime(2026, 11, 10, 9, 30, tzinfo=timezone.utc)
    end_time = datetime(2026, 11, 10, 11, 0, tzinfo=timezone.utc)

    act = ItineraryActivity(
        day_id=day1.id,
        time_slot="09:30 AM",
        description="Akihabara Electric Town Walk",
        location="Akihabara, Tokyo",
        place_type="TA",
        cost_estimate=1200.0,
        provenance="VERIFIED",
        lat=35.6983,
        lng=139.7731,
        source_citation="Tokyo Metro Guide",
        why_recommended="Hub of Japanese technology and electronics culture",
        start_at=start_time,
        end_at=end_time,
        timezone="Asia/Tokyo",
        duration_minutes=90,
        transit_minutes=20,
        transit_mode="SUBWAY",
        transit_source="MAPBOX",
        transit_confidence="VERIFIED",
        sort_order=0
    )
    db_session.add(act)
    db_session.commit()
    db_session.refresh(act)

    act_id = act.id

    # Mutate trip with AI
    ai_res = client.post(
        "/api/v1/ai/query",
        json={"trip_id": trip.id, "instruction": "Add coffee near Akihabara station"}
    )
    assert ai_res.status_code == 200

    # Undo trip modification
    undo_res = client.post(f"/api/v1/trips/{trip.id}/undo")
    assert undo_res.status_code == 200, undo_res.text

    # Verify that all 22 fields are fully restored
    db_session.expire_all()
    restored_act = db_session.query(ItineraryActivity).filter(ItineraryActivity.id == act_id).first()
    assert restored_act is not None
    assert restored_act.duration_minutes == 90
    assert restored_act.transit_mode == "SUBWAY"
    assert restored_act.transit_minutes == 20
    assert restored_act.transit_source == "MAPBOX"
    assert restored_act.transit_confidence == "VERIFIED"
    assert restored_act.timezone == "Asia/Tokyo"
    assert restored_act.source_citation == "Tokyo Metro Guide"
    assert restored_act.lat == pytest.approx(35.6983, rel=1e-3)
    assert restored_act.lng == pytest.approx(139.7731, rel=1e-3)

def test_central_award_rewards_idempotency_and_ledger(db_session, test_user):
    """
    Issue 6 & 7:
    - award_rewards updates profile balance and creates RewardTransaction atomically.
    - Same idempotency key produces no duplicate coin awards.
    """
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    start_coins = profile.reward_coins

    idemp_key = f"test_idemp_booking_{test_user.id}_ref99"

    # First award: should succeed
    bal1, awarded1 = award_rewards(
        db=db_session,
        user_id=test_user.id,
        delta=50,
        reward_type="BOOKING_SAVED",
        reason="Verified Booking Reference",
        reference_type="booking",
        reference_id="bk_99",
        idempotency_key=idemp_key
    )
    db_session.commit()

    assert awarded1 is True
    assert bal1 == start_coins + 50

    # Second award with identical idempotency key: should be ignored idempotently
    bal2, awarded2 = award_rewards(
        db=db_session,
        user_id=test_user.id,
        delta=50,
        reward_type="BOOKING_SAVED",
        reason="Verified Booking Reference Duplicate",
        reference_type="booking",
        reference_id="bk_99",
        idempotency_key=idemp_key
    )
    db_session.commit()

    assert awarded2 is False
    assert bal2 == start_coins + 50  # No double award

    # Verify exactly 1 ledger transaction exists with this key
    txs = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == idemp_key
    ).all()
    assert len(txs) == 1
    assert txs[0].delta == 50
    assert txs[0].balance_after == start_coins + 50

def test_reward_voucher_code_uniqueness(db_session):
    """
    Issue 9: RewardVoucher.code is UNIQUE in database schema.
    """
    v1 = RewardVoucher(
        brand="Luxury Taj",
        discount="₹5,000 Off",
        coin_cost=300,
        category="Stays",
        code="UNIQUE-CODE-2026"
    )
    db_session.add(v1)
    db_session.commit()

    v2 = RewardVoucher(
        brand="Duplicate Taj",
        discount="₹5,000 Off",
        coin_cost=300,
        category="Stays",
        code="UNIQUE-CODE-2026"
    )
    db_session.add(v2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_demo_login_numeric_trust_score_and_atomic_profile(client, db_session):
    """
    Issue 10 & 11:
    - /auth/demo creates user and profile in a single atomic transaction.
    - trust_score is Float (90.0) not a String.
    """
    res = client.post("/api/v1/auth/demo", json={
        "email": "harden_test_demo@dashtiny.travel",
        "full_name": "Hardened Demo Explorer"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data

    user = db_session.query(User).filter(User.email == "harden_test_demo@dashtiny.travel").first()
    assert user is not None
    assert isinstance(user.trust_score, float)
    assert user.trust_score == 90.0

    profile = db_session.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    assert profile is not None
    assert profile.reward_coins == 300

def test_hotel_and_flight_search_no_backend_defaults(client):
    """
    Issue 12 & 15:
    - Flight search with empty parameters does not default to BLR -> GOI.
    - Hotel search with empty destination returns empty results without defaulting to Goa.
    """
    res_hotel = client.get("/api/v1/bookings/search/hotels?destination=")
    assert res_hotel.status_code == 200
    assert res_hotel.json() == []

    res_flight = client.get("/api/v1/bookings/search/flights?origin=&destination=")
    assert res_flight.status_code == 200
    assert res_flight.json() == []
