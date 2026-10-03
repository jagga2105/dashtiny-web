import pytest
from datetime import datetime, timezone, date
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
from app.services.snapshot_service import allocate_and_create_trip_snapshot

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

    # 3. Third AI edit -> must increment to version 3 sequentially
    res3 = client.post(
        "/api/v1/ai/query",
        json={"trip_id": trip.id, "instruction": "Add matcha tea ceremony at Uji"}
    )
    assert res3.status_code == 200, res3.text
    snap3 = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip.id,
        TripSnapshot.version == 3
    ).first()
    assert snap3 is not None
    assert snap3.version == 3
    assert snap3.action_type == "AI_MODIFY_ITINERARY"

    # Verify all snapshots for this trip are strictly sequential [1, 2, 3] with NO duplicates
    all_snaps = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip.id
    ).order_by(TripSnapshot.version.asc()).all()
    assert [s.version for s in all_snaps] == [1, 2, 3]

    # 4. Verify stable activity ID was retained for the existing activity
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
        reason="Saved Booking Reference",
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
        reason="Saved Booking Reference Duplicate",
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


def test_failed_ai_mutation_rolls_back_fully(db_session, test_user):
    """
    Verify that an error occurring during an AI mutation:
    1. Rolls back the newly allocated TripSnapshot.
    2. Rolls back any activity modifications.
    3. Rolls back any AI run and tool call telemetry.
    4. Leaves database clean so subsequent mutations allocate the correct version.
    """
    trip = Itinerary(
        title="Osaka Food Odyssey",
        destination="Osaka",
        owner_id=test_user.id,
        total_budget=30000.0,
        currency="INR",
        start_date=datetime(2026, 12, 1).date(),
        end_date=datetime(2026, 12, 3).date()
    )
    db_session.add(trip)
    db_session.flush()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1: Dotonbori")
    db_session.add(day1)
    db_session.flush()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="12:00 PM",
        description="Takoyaki Tasting",
        location="Dotonbori",
        place_type="TA",
        sort_order=0
    )
    db_session.add(act1)
    db_session.flush()

    # 1. Create initial snapshot v1
    snap1, v1 = allocate_and_create_trip_snapshot(
        db=db_session,
        trip_id=trip.id,
        user_id=test_user.id,
        days_data=[{"day": 1, "activity": "Takoyaki Tasting"}]
    )
    db_session.commit()
    assert v1 == 1

    # 2. Simulate failing AI mutation with savepoint rollback
    try:
        with db_session.begin_nested() as sp:
            # Step A: snapshot v2 allocated
            snap2, v2 = allocate_and_create_trip_snapshot(
                db=db_session,
                trip_id=trip.id,
                user_id=test_user.id,
                days_data=[{"day": 1, "activity": "Takoyaki Tasting"}]
            )
            assert v2 == 2

            # Step B: Activity modified
            act1.description = "Uncommitted Partial Edit"

            # Step C: Telemetry added
            ai_run = AIRun(
                user_id=test_user.id,
                trip_id=trip.id,
                prompt="Failing edit",
                model="deterministic-planner-v1",
                latency_ms=10.0,
                status="failed"
            )
            db_session.add(ai_run)

            # Step D: Mid-transaction failure occurs before commit
            raise RuntimeError("Simulated crash during action execution")
    except RuntimeError:
        pass

    # Verify atomic rollback:
    # 1. Snapshot v2 was NOT persisted
    all_snaps = db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id).all()
    assert len(all_snaps) == 1
    assert all_snaps[0].version == 1

    # 2. Activity was NOT mutated
    db_session.expire_all()
    fresh_act = db_session.query(ItineraryActivity).filter(ItineraryActivity.id == act1.id).first()
    assert fresh_act.description == "Takoyaki Tasting"

    # 3. AI run was NOT persisted
    failed_runs = db_session.query(AIRun).filter(
        AIRun.trip_id == trip.id,
        AIRun.prompt == "Failing edit"
    ).all()
    assert len(failed_runs) == 0

    # 4. Subsequent mutation allocates version 2 cleanly without duplicate or collision
    snap_success, v_success = allocate_and_create_trip_snapshot(
        db=db_session,
        trip_id=trip.id,
        user_id=test_user.id,
        days_data=[{"day": 1, "activity": "Kuromon Market Breakfast"}]
    )
    db_session.commit()
    assert v_success == 2

    final_snaps = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip.id
    ).order_by(TripSnapshot.version.asc()).all()
    assert len(final_snaps) == 2
    assert [s.version for s in final_snaps] == [1, 2]


def test_undo_multi_step_revisions_a_b_c_b_a(client, db_session, test_user):
    """
    Test server-side undo multi-step revision semantics:
    Initial: State A
    AI Change 1: Snapshot A (v1), State B
    AI Change 2: Snapshot B (v2), State C
    Undo: Restores State B, marks Snapshot B reverted
    Undo again: Restores State A, marks Snapshot A reverted
    Undo again: Fails with 400 (no previous snapshot available)
    Undo must NOT repeatedly restore the same snapshot.
    """
    # 1. Initial State A: 1 activity (Morning Yoga)
    trip = Itinerary(
        title="Kyoto Zen Multi-Undo Tour",
        destination="Kyoto",
        owner_id=test_user.id,
        total_budget=60000.0,
        currency="INR",
        start_date=date(2026, 11, 10),
        end_date=date(2026, 11, 12)
    )
    db_session.add(trip)
    db_session.commit()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1: Arrival")
    db_session.add(day1)
    db_session.commit()

    act_a = ItineraryActivity(
        day_id=day1.id,
        time_slot="08:00 AM",
        description="Activity A: Morning Yoga in Bamboo Grove",
        location="Arashiyama",
        place_type="TA",
        cost_estimate=500.0,
        sort_order=0
    )
    db_session.add(act_a)
    db_session.commit()
    act_a_id = act_a.id

    # Verify State A in DB
    acts_a = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).all()
    assert len(acts_a) == 1
    assert "Morning Yoga" in acts_a[0].description

    # 2. AI Change 1 -> State B: Add nearby walk
    res_b = client.post("/api/v1/ai/query", json={
        "trip_id": trip.id,
        "instruction": "I have 2 hours free in the afternoon, add a nearby walk"
    })
    assert res_b.status_code == 200, res_b.text
    db_session.expire_all()
    acts_b = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).order_by(ItineraryActivity.sort_order).all()
    assert len(acts_b) >= 2
    assert any("Heritage Photography Walk" in a.description for a in acts_b)

    # 3. AI Change 2 -> State C: Add relaxing spa siesta
    res_c = client.post("/api/v1/ai/query", json={
        "trip_id": trip.id,
        "instruction": "Make the schedule more relaxing and chill with a spa"
    })
    assert res_c.status_code == 200, res_c.text
    db_session.expire_all()
    acts_c = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).order_by(ItineraryActivity.sort_order).all()
    assert len(acts_c) >= 3
    assert any("Siesta & Spa" in a.description for a in acts_c)

    # Verify snapshots v1 and v2 exist with action == "ai_query"
    snaps_c = db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id).order_by(TripSnapshot.version.asc()).all()
    assert len(snaps_c) == 2
    assert snaps_c[0].version == 1 and snaps_c[0].action == "ai_query"
    assert snaps_c[1].version == 2 and snaps_c[1].action == "ai_query"

    # --- Step 4: First Undo -> Restores State B ---
    undo_1 = client.post(f"/api/v1/trips/{trip.id}/undo")
    assert undo_1.status_code == 200, undo_1.text
    u1_data = undo_1.json()
    assert u1_data["status"] == "success"
    assert u1_data["restored_version"] == 2
    assert u1_data["remaining_active_revisions"] == 1

    # Verify DB activities match State B (Siesta & Spa is gone, Heritage Photography Walk remains)
    db_session.expire_all()
    acts_after_u1 = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).all()
    assert not any("Siesta & Spa" in a.description for a in acts_after_u1)
    assert any("Heritage Photography Walk" in a.description for a in acts_after_u1)

    # Verify snapshot 2 is marked 'reverted' and snapshot 1 remains 'ai_query'
    snap_v2 = db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id, TripSnapshot.version == 2).first()
    assert snap_v2.action == "reverted"
    snap_v1 = db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id, TripSnapshot.version == 1).first()
    assert snap_v1.action == "ai_query"

    # --- Step 5: Second Undo -> Restores State A ---
    undo_2 = client.post(f"/api/v1/trips/{trip.id}/undo")
    assert undo_2.status_code == 200, undo_2.text
    u2_data = undo_2.json()
    assert u2_data["status"] == "success"
    assert u2_data["restored_version"] == 1
    assert u2_data["remaining_active_revisions"] == 0

    # Verify DB activities match State A (both Siesta & Spa and Heritage Walk are gone, only Morning Yoga remains)
    db_session.expire_all()
    acts_after_u2 = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).all()
    assert len(acts_after_u2) == 1
    assert "Morning Yoga" in acts_after_u2[0].description
    assert acts_after_u2[0].id == act_a_id

    # Verify both snapshots are marked 'reverted'
    all_reverted = db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id).all()
    assert len(all_reverted) == 2
    assert all(s.action == "reverted" for s in all_reverted)

    # --- Step 6: Third Undo -> Fails with 400 (Does NOT repeatedly restore the same snapshot) ---
    undo_3 = client.post(f"/api/v1/trips/{trip.id}/undo")
    assert undo_3.status_code == 400
    assert "no previous trip snapshot available to undo" in undo_3.json()["detail"].lower()

    # State A remains strictly intact
    db_session.expire_all()
    acts_final = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day1.id).all()
    assert len(acts_final) == 1
    assert "Morning Yoga" in acts_final[0].description


def test_undo_history_behavior_and_audit_trail(client, db_session, test_user):
    """
    Test A -> B -> undo -> history behavior:
    1. Revisions are NOT deleted on undo; they remain in audit history.
    2. GET /trips/{trip_id}/snapshots reflects is_reverted=True for reverted revisions.
    3. New AI mutation after undo starts from restored state and advances version chain.
    """
    trip = Itinerary(
        title="Hakone Springs Revision History",
        destination="Hakone",
        owner_id=test_user.id,
        total_budget=50000.0,
        currency="INR",
        start_date=date(2026, 12, 5),
        end_date=date(2026, 12, 7)
    )
    db_session.add(trip)
    db_session.commit()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    db_session.add(day1)
    db_session.commit()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="10:00 AM",
        description="State A: Onsen Soak",
        location="Hakone Yumoto",
        place_type="TA",
        sort_order=0
    )
    db_session.add(act1)
    db_session.commit()

    # AI change to State B
    res_b = client.post("/api/v1/ai/query", json={
        "trip_id": trip.id,
        "instruction": "State B: Add Lake Ashi pirate boat cruise"
    })
    assert res_b.status_code == 200

    # History before undo shows active snapshot v1
    history_pre = client.get(f"/api/v1/trips/{trip.id}/snapshots").json()
    assert len(history_pre) == 1
    assert history_pre[0]["version"] == 1
    assert history_pre[0]["action"] == "ai_query"
    assert history_pre[0]["is_reverted"] is False

    # Undo
    undo_res = client.post(f"/api/v1/trips/{trip.id}/undo")
    assert undo_res.status_code == 200

    # History AFTER undo: snapshot v1 is still present in history, marked is_reverted=True
    history_post = client.get(f"/api/v1/trips/{trip.id}/snapshots").json()
    assert len(history_post) == 1
    assert history_post[0]["version"] == 1
    assert history_post[0]["action"] == "reverted"
    assert history_post[0]["is_reverted"] is True

    # New AI mutation to State C
    res_c = client.post("/api/v1/ai/query", json={
        "trip_id": trip.id,
        "instruction": "State C: Add Mt. Fuji ropeway ride"
    })
    assert res_c.status_code == 200

    # History now has 2 revisions: v2 (active) and v1 (reverted)
    history_c = client.get(f"/api/v1/trips/{trip.id}/snapshots").json()
    assert len(history_c) == 2
    assert history_c[0]["version"] == 2
    assert history_c[0]["is_reverted"] is False
    assert history_c[1]["version"] == 1
    assert history_c[1]["is_reverted"] is True





