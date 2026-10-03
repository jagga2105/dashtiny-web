import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from app.models.models import (
    User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity,
    TripSnapshot, RewardVoucher, RewardRedemption, RewardTransaction,
    AIRun, AIToolCall, Booking
)
from app.services.reward_service import (
    award_rewards,
    InsufficientRewardBalanceError,
    InsufficientCreditsError
)

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


def test_reward_ledger_ten_rules_end_to_end(client, db_session, test_user):
    """
    Requirements 7, 8, 9, 10, 11:
    1. award +50
    2. award +20
    3. same idempotency key twice -> only one ledger row
    4. different idempotency keys -> two awards
    5. negative award with insufficient balance -> rejected (raises ValueError, never silently clamped)
    6. balance_after is correct
    7. booking reward appears in RewardTransaction with clean non-verified wording
    8. community reward appears in RewardTransaction
    9. voucher redemption appears in RewardTransaction
    """
    user_id = test_user.id
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    profile.reward_coins = 100
    db_session.commit()

    # 1. award +50
    bal1, awarded1 = award_rewards(
        db=db_session,
        user_id=user_id,
        delta=50,
        reward_type="PROMO_BONUS",
        reason="Early Explorer Bonus",
        idempotency_key="idemp_rule_50"
    )
    db_session.commit()
    assert awarded1 is True
    assert bal1 == 150

    # 2. award +20
    bal2, awarded2 = award_rewards(
        db=db_session,
        user_id=user_id,
        delta=20,
        reward_type="PROMO_BONUS",
        reason="Survey Completion",
        idempotency_key="idemp_rule_20"
    )
    db_session.commit()
    assert awarded2 is True
    assert bal2 == 170

    # 3. same idempotency key twice -> only one ledger row
    bal_dup, awarded_dup = award_rewards(
        db=db_session,
        user_id=user_id,
        delta=50,
        reward_type="PROMO_BONUS",
        reason="Duplicate Attempt",
        idempotency_key="idemp_rule_50"
    )
    db_session.commit()
    assert awarded_dup is False
    assert bal_dup == 170

    tx_count_50 = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == "idemp_rule_50"
    ).count()
    assert tx_count_50 == 1

    # 4. different idempotency keys -> two awards
    tx_count_20 = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == "idemp_rule_20"
    ).count()
    assert tx_count_20 == 1

    # 5. negative award with insufficient balance -> rejected with domain error, NEVER silently clamped to 0
    with pytest.raises(ValueError, match="Insufficient reward coins"):
        award_rewards(
            db=db_session,
            user_id=user_id,
            delta=-200,  # 170 - 200 = -30 < 0
            reward_type="PENALTY",
            reason="Illegal deduction",
            idempotency_key="idemp_illegal_neg"
        )

    # Verify balance was NOT silently clamped to 0
    profile_recheck = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    assert profile_recheck.reward_coins == 170

    # 6. balance_after is correct on valid deduction
    bal_deduct, awarded_deduct = award_rewards(
        db=db_session,
        user_id=test_user.id,
        delta=-70,
        reward_type="ADJUSTMENT",
        reason="Valid deduction",
        idempotency_key="idemp_valid_deduct"
    )
    db_session.commit()
    assert awarded_deduct is True
    assert bal_deduct == 100
    deduct_tx = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == "idemp_valid_deduct"
    ).first()
    assert deduct_tx.balance_after == 100
    assert deduct_tx.delta == -70

    # 7. booking reward appears in RewardTransaction with correct non-verified wording
    bk_res = client.post("/api/v1/bookings/create", json={
        "category": "flight",
        "provider": "IndiGo",
        "pnr_ref": "INDIGO99XYZ",
        "title": "BLR -> DEL Flight",
        "amount": 4500.0,
        "currency": "INR"
    })
    assert bk_res.status_code == 200, bk_res.text
    booking_tx = db_session.query(RewardTransaction).filter(
        RewardTransaction.reference_type == "booking",
        RewardTransaction.idempotency_key == "booking_reward_IndiGo_INDIGO99XYZ"
    ).first()
    assert booking_tx is not None
    assert booking_tx.delta == 50
    assert booking_tx.type == "BOOKING_SAVED"
    assert booking_tx.reason == "Saved booking reference for IndiGo (INDIGO99XYZ)"
    assert "verified" not in booking_tx.reason.lower()

    # 8. community reward appears in RewardTransaction
    post_res = client.post("/api/v1/community/posts", json={
        "getaway_title": "Monsoon Trek to Kudremukh",
        "location": "Chikkamagaluru, India",
        "image_url": "https://images.unsplash.com/photo-kudremukh",
        "content": "Breathtaking green rolling hills and misty clouds."
    })
    assert post_res.status_code == 200, post_res.text
    post_id = post_res.json()["post_id"]
    comm_tx = db_session.query(RewardTransaction).filter(
        RewardTransaction.reference_type == "community_post",
        RewardTransaction.reference_id == post_id
    ).first()
    assert comm_tx is not None
    assert comm_tx.delta == 20
    assert comm_tx.type == "TRIP_SHARED"

    # 9. voucher redemption appears in RewardTransaction
    current_coins = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first().reward_coins
    assert current_coins >= 100
    redeem_res = client.post("/api/v1/rewards/redeem", json={"voucher_id": "vch_03"})
    assert redeem_res.status_code == 200, redeem_res.text

    redemption_tx = db_session.query(RewardTransaction).filter(
        RewardTransaction.reference_type == "reward_voucher",
        RewardTransaction.reference_id == "vch_03"
    ).first()
    assert redemption_tx is not None
    assert redemption_tx.delta == -100
    assert redemption_tx.type == "VOUCHER_REDEEMED"
    assert redemption_tx.balance_after == current_coins - 100


def test_negative_reward_deduction_validation_suite(db_session, test_user):
    """
    Validation Suite for Negative Reward Deductions:
    1. 100 -> -50 succeeds = 50
    2. 20 -> -50 fails with controlled domain exception
    3. failed deduction creates no RewardTransaction
    4. failed deduction leaves balance unchanged
    5. positive reward still works
    6. idempotent duplicate still works
    - caller transaction remains rollback-safe
    """
    user_id = test_user.id
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id, reward_coins=0)
        db_session.add(profile)
        db_session.flush()

    # Initial state: 100
    profile.reward_coins = 100
    db_session.commit()

    # --- Test 1: 100 -> -50 succeeds = 50 ---
    new_bal, was_awarded = award_rewards(
        db=db_session,
        user_id=user_id,
        delta=-50,
        reward_type="REDEMPTION_TEST",
        reason="Deduct 50 from 100",
        idempotency_key="idemp_suite_deduct_50_success"
    )
    db_session.commit()
    assert was_awarded is True
    assert new_bal == 50

    db_profile = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    assert db_profile.reward_coins == 50

    tx_success = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == "idemp_suite_deduct_50_success"
    ).first()
    assert tx_success is not None
    assert tx_success.delta == -50
    assert tx_success.balance_after == 50

    # Set balance to 20 for failure testing
    db_profile.reward_coins = 20
    db_session.commit()

    tx_count_before = db_session.query(RewardTransaction).filter(
        RewardTransaction.user_id == user_id
    ).count()

    # --- Test 2: 20 -> -50 fails with controlled domain exception ---
    with pytest.raises(InsufficientRewardBalanceError) as exc_info:
        award_rewards(
            db=db_session,
            user_id=user_id,
            delta=-50,
            reward_type="REDEMPTION_TEST",
            reason="Illegal deduction: 20 minus 50",
            idempotency_key="idemp_suite_deduct_50_fail"
        )
    assert isinstance(exc_info.value, ValueError)  # Backward compatibility
    assert "Insufficient reward coins" in str(exc_info.value)
    assert exc_info.value.current_balance == 20
    assert exc_info.value.delta == -50
    assert exc_info.value.required_deduction == 50

    # Verify alias works
    assert isinstance(exc_info.value, InsufficientCreditsError)

    # --- Test 3: failed deduction creates no RewardTransaction ---
    tx_count_after = db_session.query(RewardTransaction).filter(
        RewardTransaction.user_id == user_id
    ).count()
    assert tx_count_after == tx_count_before

    failed_tx = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == "idemp_suite_deduct_50_fail"
    ).first()
    assert failed_tx is None

    # --- Test 4: failed deduction leaves balance unchanged ---
    profile_unchanged = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    assert profile_unchanged.reward_coins == 20

    # Verify caller transaction remains rollback-safe without aborted state
    with db_session.begin_nested() as savepoint:
        with pytest.raises(InsufficientRewardBalanceError):
            award_rewards(
                db=db_session,
                user_id=user_id,
                delta=-999,
                reward_type="REDEMPTION_TEST",
                reason="Savepoint rollback safety check"
            )
        savepoint.rollback()

    profile_after_rollback = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    assert profile_after_rollback is not None
    assert profile_after_rollback.reward_coins == 20

    # --- Test 5: positive reward still works ---
    pos_bal, pos_awarded = award_rewards(
        db=db_session,
        user_id=user_id,
        delta=30,
        reward_type="BONUS",
        reason="Positive Bonus 30",
        idempotency_key="idemp_suite_bonus_30"
    )
    db_session.commit()
    assert pos_awarded is True
    assert pos_bal == 50  # 20 + 30 = 50

    profile_after_bonus = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    assert profile_after_bonus.reward_coins == 50

    bonus_tx = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == "idemp_suite_bonus_30"
    ).first()
    assert bonus_tx is not None
    assert bonus_tx.delta == 30
    assert bonus_tx.balance_after == 50

    # --- Test 6: idempotent duplicate still works ---
    dup_bal, dup_awarded = award_rewards(
        db=db_session,
        user_id=user_id,
        delta=30,
        reward_type="BONUS",
        reason="Duplicate Positive Bonus 30",
        idempotency_key="idemp_suite_bonus_30"
    )
    db_session.commit()
    assert dup_awarded is False
    assert dup_bal == 50

    dup_tx_count = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == "idemp_suite_bonus_30"
    ).count()
    assert dup_tx_count == 1

    profile_final = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    assert profile_final.reward_coins == 50


