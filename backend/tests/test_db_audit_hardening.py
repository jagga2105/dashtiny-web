"""
Test Suite for DashTiny Database & Architectural Hardening Audit
Verifies:
1. DB Constraints (UNIQUE on user_id, squad_id+user_id, itinerary_id+day_number, user_id+category+key, provider+pnr_ref)
2. Atomic User Registration (User + UserProfile committed together)
3. Reward Ledger & Single Redemption Guard (RewardTransaction + RewardRedemption)
4. Pure Read on GET /rewards/vault
5. Booking PNR Integrity & Reward Idempotency (no fake PNR, provider-scoped uniqueness)
6. Stable Activity Identity in AI Queries (diff-based persistence)
7. Versioned TripSnapshot & Atomic AI Mutation / Rollback
8. Numeric Trust Score & Profile Stats
"""
import pytest
from datetime import date
from sqlalchemy.exc import IntegrityError
from fastapi.testclient import TestClient

from app.models.models import (
    User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity,
    SquadRoom, SquadMember, Booking, TravelerMemory,
    RewardVoucher, RewardTransaction, RewardRedemption, TripSnapshot, AIRun
)

def test_atomic_user_registration(client, db_session):
    """
    Audit Item 24: Registration creates User and UserProfile atomically in one transaction.
    """
    reg_payload = {
        "email": "newtraveler@dashtiny.ai",
        "full_name": "Zara Vance",
        "password": "SecurePassword123!"
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "newtraveler@dashtiny.ai"

    # Verify both User and UserProfile exist in the database
    user = db_session.query(User).filter(User.email == "newtraveler@dashtiny.ai").first()
    assert user is not None
    assert user.trust_score == 95.0
    assert user.trip_completion_count == 0
    assert user.verified_booking_count == 0

    profile = db_session.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    assert profile is not None
    assert profile.reward_coins == 0


def test_unique_constraints_integrity(db_session, test_user):
    """
    Audit Items 2, 5, 10:
    - UserProfile UNIQUE(user_id)
    - SquadRoom UNIQUE(itinerary_id)
    - SquadMember UNIQUE(squad_id, user_id)
    - ItineraryDay UNIQUE(itinerary_id, day_number)
    - TravelerMemory UNIQUE(user_id, category, key)
    - Booking UNIQUE(provider, pnr_ref)
    """
    user_id = test_user.id

    # 1. UserProfile UNIQUE(user_id)
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            dup_profile = UserProfile(user_id=user_id, reward_coins=100)
            db_session.add(dup_profile)
            db_session.flush()

    # Create base itinerary
    it = Itinerary(
        id="it-constraint-test-1",
        owner_id=user_id,
        title="Kyoto Test Run",
        destination="Kyoto",
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 5),
        total_budget=50000.0,
        travellers=2,
        status="draft"
    )
    db_session.add(it)
    db_session.flush()

    # 2. ItineraryDay UNIQUE(itinerary_id, day_number)
    day1 = ItineraryDay(id="day-test-1", itinerary_id=it.id, day_number=1, title="Day One")
    db_session.add(day1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            dup_day = ItineraryDay(id="day-test-1-dup", itinerary_id=it.id, day_number=1, title="Day One Duplicate")
            db_session.add(dup_day)
            db_session.flush()

    # 3. SquadRoom UNIQUE(itinerary_id) & SquadMember UNIQUE(squad_id, user_id)
    squad = SquadRoom(id="squad-test-1", itinerary_id=it.id, room_code="DASH-TEST-99")
    db_session.add(squad)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            dup_squad = SquadRoom(id="squad-test-2", itinerary_id=it.id, room_code="DASH-TEST-98")
            db_session.add(dup_squad)
            db_session.flush()

    member1 = SquadMember(id="sm-1", squad_id=squad.id, user_id=user_id, role="creator")
    db_session.add(member1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            dup_member = SquadMember(id="sm-2", squad_id=squad.id, user_id=user_id, role="member")
            db_session.add(dup_member)
            db_session.flush()

    # 4. TravelerMemory UNIQUE(user_id, category, key)
    mem1 = TravelerMemory(
        user_id=user_id,
        category="budget",
        key="sensitivity",
        value="high",
        source="EXPLICIT",
        confidence=1.0
    )
    db_session.add(mem1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            dup_mem = TravelerMemory(
                user_id=user_id,
                category="budget",
                key="sensitivity",
                value="low",
                source="BEHAVIORAL",
                confidence=0.5
            )
            db_session.add(dup_mem)
            db_session.flush()

    # 5. Booking UNIQUE(provider, pnr_ref)
    b1 = Booking(
        trip_id=it.id,
        user_id=user_id,
        category="flight",
        provider="IndiGo",
        title="Flight to Delhi",
        amount=4500.0,
        currency="INR",
        status="saved_reference",
        pnr_ref="6E-TEST-88"
    )
    db_session.add(b1)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            b2 = Booking(
                trip_id=it.id,
                user_id=user_id,
                category="flight",
                provider="IndiGo",
                title="Another Flight",
                amount=5200.0,
                currency="INR",
                status="saved_reference",
                pnr_ref="6E-TEST-88"
            )
            db_session.add(b2)
            db_session.flush()


def test_reward_ledger_and_single_redemption(client, db_session, test_user):
    """
    Audit Items 6, 7, 8, 9:
    - Ledger records RewardTransaction on redemption
    - RewardRedemption table prevents duplicate voucher redemptions
    - Pure read GET /rewards/vault does not mutate DB
    """
    # 1. Check vault is pure read
    initial_tx_count = db_session.query(RewardTransaction).count()
    res_vault = client.get("/api/v1/rewards/vault")
    assert res_vault.status_code == 200
    vault_data = res_vault.json()
    assert vault_data["gold_coins"] == 500
    assert len(vault_data["vouchers"]) >= 3
    # No transactions should have been written on GET
    assert db_session.query(RewardTransaction).count() == initial_tx_count

    # 2. Redeem voucher vch_01 (Taj Hotels, costs 150)
    res_redeem = client.post("/api/v1/rewards/redeem", json={"voucher_id": "vch_01"})
    assert res_redeem.status_code == 200
    redeem_data = res_redeem.json()
    assert redeem_data["status"] == "redeemed"
    assert redeem_data["remaining_coins"] == 350

    # Verify RewardRedemption recorded
    redemption = db_session.query(RewardRedemption).filter(
        RewardRedemption.user_id == test_user.id,
        RewardRedemption.voucher_id == "vch_01"
    ).first()
    assert redemption is not None
    assert redemption.coins_spent == 150
    assert redemption.voucher_code == "TAJ-DASHTINY-3K"

    # Verify RewardTransaction audit ledger
    tx = db_session.query(RewardTransaction).filter(
        RewardTransaction.user_id == test_user.id,
        RewardTransaction.reference_id == "vch_01"
    ).first()
    assert tx is not None
    assert tx.delta == -150
    assert tx.balance_after == 350
    assert tx.type == "VOUCHER_REDEEMED"

    # 3. Attempting to redeem the same voucher again should FAIL (Item 7 & 8 guard)
    res_dup = client.post("/api/v1/rewards/redeem", json={"voucher_id": "vch_01"})
    assert res_dup.status_code == 400
    assert "already redeemed" in res_dup.json()["detail"].lower()

    # 4. Check vault shows is_redeemed=True and includes it in my_redemptions
    res_vault2 = client.get("/api/v1/rewards/vault")
    v2_data = res_vault2.json()
    assert v2_data["gold_coins"] == 350
    vch_01_item = next(v for v in v2_data["vouchers"] if v["id"] == "vch_01")
    assert vch_01_item["is_redeemed"] is True
    assert len(v2_data["my_redemptions"]) == 1
    assert v2_data["my_redemptions"][0]["voucher_id"] == "vch_01"


def test_booking_no_fake_pnr_and_reward_idempotency(client, db_session, test_user):
    """
    Audit Item 5:
    - Creating a booking with real PNR awards +50 coins and records ledger transaction.
    - Creating a booking without PNR saves booking with pnr_ref=None (no fake PNR) and awards 0 coins.
    - Duplicate provider + PNR returns 400 error.
    """
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    starting_coins = profile.reward_coins

    # 1. Booking with genuine PNR
    b_payload = {
        "category": "flight",
        "provider": "Air India",
        "title": "Delhi to Srinagar",
        "amount": 6200.0,
        "currency": "INR",
        "pnr_ref": "AI-SRINAGAR-771"
    }
    res = client.post("/api/v1/bookings/create", json=b_payload)
    assert res.status_code == 200, res.text
    b_data = res.json()
    assert b_data["coins_earned"] == 50
    assert b_data["pnr_ref"] == "AI-SRINAGAR-771"

    # Verify ledger entry
    tx = db_session.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == "booking_reward_Air India_AI-SRINAGAR-771"
    ).first()
    assert tx is not None
    assert tx.delta == 50
    assert tx.type == "BOOKING_SAVED"
    assert tx.reason == "Saved booking reference for Air India (AI-SRINAGAR-771)"
    assert "verified" not in tx.reason.lower()

    # 2. Duplicate PNR on same provider should be rejected
    res_dup = client.post("/api/v1/bookings/create", json=b_payload)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"].lower()

    # 3. Booking without PNR should not invent fake PNR and should not award coins
    b_no_pnr = {
        "category": "hotel",
        "provider": "Local Homestay",
        "title": "Pahalgam Pine Cottage",
        "amount": 3500.0,
        "currency": "INR",
        "pnr_ref": None
    }
    res2 = client.post("/api/v1/bookings/create", json=b_no_pnr)
    assert res2.status_code == 200
    b2_data = res2.json()
    assert b2_data["pnr_ref"] is None
    assert b2_data["coins_earned"] == 0

    saved_b2 = db_session.query(Booking).filter(Booking.id == b2_data["booking_id"]).first()
    assert saved_b2.pnr_ref is None


def test_ai_query_diff_persistence_and_stable_activity_ids(client, db_session, test_user):
    """
    Audit Items 17, 18, 19:
    - AI modification preserves stable existing activity IDs via diff persistence.
    - AI snapshot carries version number (v1, v2...)
    - Undo endpoint rolls back to snapshot v1 and preserves activity identity.
    """
    # 1. Create a trip with 1 day and 2 activities
    trip = Itinerary(
        id="trip-diff-test",
        owner_id=test_user.id,
        title="Goa Coastal Sprint",
        destination="Goa",
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 2),
        total_budget=40000.0,
        travellers=2,
        status="draft"
    )
    db_session.add(trip)
    db_session.commit()

    day = ItineraryDay(
        id="day-diff-1",
        itinerary_id=trip.id,
        day_number=1,
        title="Day 1 - Coastal Arrival"
    )
    db_session.add(day)
    db_session.commit()

    act1 = ItineraryActivity(
        id="act-stable-001",
        day_id=day.id,
        time_slot="10:00 AM",
        description="Check-in at Beachfront Villa",
        location="Palolem Beach",
        cost_estimate=8000.0,
        sort_order=0
    )
    act2 = ItineraryActivity(
        id="act-stable-002",
        day_id=day.id,
        time_slot="04:00 PM",
        description="Sunset kayak session",
        location="Agonda River",
        cost_estimate=1200.0,
        sort_order=1
    )
    db_session.add(act1)
    db_session.add(act2)
    db_session.commit()

    original_act1_id = act1.id
    original_act2_id = act2.id

    # 2. Execute AI query to modify the trip
    res_ai = client.post("/api/v1/ai/query", json={
        "trip_id": trip.id,
        "instruction": "Swap the afternoon activity to a seafood cooking masterclass"
    })
    assert res_ai.status_code == 200, res_ai.text
    ai_data = res_ai.json()
    assert ai_data["status"] == "success"

    # 3. Verify TripSnapshot has version = 1
    snapshot = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip.id
    ).first()
    assert snapshot is not None
    assert snapshot.version == 1
    assert snapshot.action == "ai_query"

    # 4. Verify stable activity ID: the first activity that wasn't removed should KEEP its original primary key!
    acts_after = db_session.query(ItineraryActivity).filter(
        ItineraryActivity.day_id == day.id
    ).all()
    act_ids_after = [a.id for a in acts_after]
    assert original_act1_id in act_ids_after, f"Expected {original_act1_id} to be preserved in {act_ids_after}"

    # 5. Test snapshot listing endpoint
    res_snaps = client.get(f"/api/v1/trips/{trip.id}/snapshots")
    assert res_snaps.status_code == 200
    snaps_data = res_snaps.json()
    assert len(snaps_data) == 1
    assert snaps_data[0]["version"] == 1

    # 6. Test Undo restores snapshot v1
    res_undo = client.post(f"/api/v1/trips/{trip.id}/undo")
    assert res_undo.status_code == 200
    undo_data = res_undo.json()
    assert undo_data["status"] == "success"
    assert undo_data["restored_version"] == 1

    # Verify act1 and act2 are restored and snapshot is popped
    restored_acts = db_session.query(ItineraryActivity).filter(
        ItineraryActivity.day_id == day.id
    ).all()
    restored_ids = [a.id for a in restored_acts]
    assert original_act1_id in restored_ids
    assert db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id).count() == 0
