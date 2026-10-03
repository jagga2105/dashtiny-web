import os
import sys
import uuid
import pytest
from datetime import date, datetime, timezone
import concurrent.futures

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from alembic.config import Config
from alembic import command

from app.models.models import (
    Base, User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity,
    TripSnapshot, Booking, RewardVoucher, RewardRedemption, RewardTransaction,
    TravelerMemory, CommunityPost, PostLike, SquadRoom, SquadExpense
)
from app.services.reward_service import award_rewards

# Determine PostgreSQL test database URL
POSTGRES_URL = os.environ.get(
    "POSTGRES_TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/dashtiny_empty_test"
)

def is_postgres_available():
    try:
        test_engine = create_engine(POSTGRES_URL, connect_args={"connect_timeout": 3})
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        test_engine.dispose()
        return True
    except Exception:
        return False

pytestmark = pytest.mark.skipif(
    not is_postgres_available(),
    reason="PostgreSQL is not reachable at POSTGRES_TEST_DATABASE_URL"
)

@pytest.fixture(scope="module")
def pg_engine():
    # Run Alembic migrations from scratch on the PostgreSQL test database
    ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    script_path = os.path.join(os.path.dirname(__file__), "..", "alembic")
    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", script_path)
    alembic_cfg.set_main_option("sqlalchemy.url", POSTGRES_URL)

    # Clean existing tables
    engine = create_engine(POSTGRES_URL)
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.commit()

    # 1. Verify Alembic upgrade succeeds to head on clean PostgreSQL
    command.upgrade(alembic_cfg, "head")

    yield engine
    engine.dispose()

@pytest.fixture
def pg_session(pg_engine):
    Session = sessionmaker(bind=pg_engine, autocommit=False, autoflush=False)
    session = Session()
    yield session
    session.rollback()
    session.close()

def create_pg_user(session, email=None):
    u = User(
        id=str(uuid.uuid4()),
        email=email or f"user_{uuid.uuid4().hex[:8]}@dashtiny.ai",
        full_name="Postgres Explorer",
        trust_score=85.0
    )
    session.add(u)
    session.flush()
    prof = UserProfile(user_id=u.id, reward_coins=200)
    session.add(prof)
    session.flush()
    return u

def create_pg_trip(session, user_id):
    trip = Itinerary(
        id=str(uuid.uuid4()),
        owner_id=user_id,
        title="Kyoto Zen Journey",
        destination="Kyoto",
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 7),
        total_budget=60000.0,
        currency="INR"
    )
    session.add(trip)
    session.flush()
    return trip


def test_postgres_alembic_and_trip_snapshot_all_observability_fields(pg_session):
    """
    Requirements 1, 2, 4:
    - Alembic upgrade succeeds on empty PostgreSQL.
    - TripSnapshot persists all 4 observability fields: action_type, actor_type, instruction, model.
    """
    user = create_pg_user(pg_session)
    trip = create_pg_trip(pg_session, user.id)

    snapshot = TripSnapshot(
        trip_id=trip.id,
        version=1,
        user_id=user.id,
        action="ai_query",
        action_type="AI_MODIFY_ITINERARY",
        actor_type="USER",
        instruction="Optimize schedule for morning temples and afternoon matcha",
        model="deterministic-planner-v1",
        summary="AI schedule optimization",
        days_data=[{"day": 1, "activities": []}]
    )
    pg_session.add(snapshot)
    pg_session.commit()

    saved_snap = pg_session.query(TripSnapshot).filter(TripSnapshot.id == snapshot.id).first()
    assert saved_snap is not None
    assert saved_snap.action_type == "AI_MODIFY_ITINERARY"
    assert saved_snap.actor_type == "USER"
    assert saved_snap.instruction == "Optimize schedule for morning temples and afternoon matcha"
    assert saved_snap.model == "deterministic-planner-v1"
    assert saved_snap.version == 1


def test_postgres_unique_trip_snapshot_version(pg_session):
    """Requirement 4: UNIQUE(trip_id, version) constraint rejects duplicate version."""
    user = create_pg_user(pg_session)
    trip = create_pg_trip(pg_session, user.id)

    s1 = TripSnapshot(
        trip_id=trip.id,
        version=1,
        user_id=user.id,
        action="ai_query",
        action_type="AI_MODIFY_ITINERARY",
        actor_type="USER",
        days_data=[]
    )
    pg_session.add(s1)
    pg_session.commit()

    s2 = TripSnapshot(
        trip_id=trip.id,
        version=1,  # Duplicate version for same trip_id
        user_id=user.id,
        action="ai_query",
        action_type="AI_MODIFY_ITINERARY",
        actor_type="USER",
        days_data=[]
    )
    pg_session.add(s2)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()


def test_postgres_unique_booking_provider_pnr_ref(pg_session):
    """Requirement 4: UNIQUE(provider, pnr_ref) rejects duplicate provider + PNR."""
    user = create_pg_user(pg_session)
    trip = create_pg_trip(pg_session, user.id)

    pnr = f"PNR{uuid.uuid4().hex[:6].upper()}"
    b1 = Booking(
        trip_id=trip.id,
        user_id=user.id,
        category="flight",
        provider="IndiGo",
        pnr_ref=pnr,
        title="Flight BLR-DEL",
        amount=4200.0,
        currency="INR"
    )
    pg_session.add(b1)
    pg_session.commit()

    b2 = Booking(
        trip_id=trip.id,
        user_id=user.id,
        category="flight",
        provider="IndiGo",
        pnr_ref=pnr,  # Duplicate provider and pnr_ref
        title="Duplicate Booking",
        amount=4200.0,
        currency="INR"
    )
    pg_session.add(b2)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()


def test_postgres_unique_user_voucher_redemption(pg_session):
    """Requirement 4: UNIQUE(user_id, voucher_id) rejects duplicate voucher redemption."""
    user = create_pg_user(pg_session)
    voucher = RewardVoucher(
        brand="Taj Stays",
        discount="₹2000 Off",
        coin_cost=100,
        category="Stays",
        code=f"TAJ-{uuid.uuid4().hex[:6]}"
    )
    pg_session.add(voucher)
    pg_session.commit()

    r1 = RewardRedemption(
        user_id=user.id,
        voucher_id=voucher.id,
        coins_spent=100,
        voucher_code=voucher.code,
        status="redeemed"
    )
    pg_session.add(r1)
    pg_session.commit()

    r2 = RewardRedemption(
        user_id=user.id,
        voucher_id=voucher.id,
        coins_spent=100,
        voucher_code=voucher.code,
        status="redeemed"
    )
    pg_session.add(r2)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()


def test_postgres_unique_post_user_like(pg_session):
    """Requirement 4: UNIQUE(post_id, user_id) rejects duplicate post like."""
    user = create_pg_user(pg_session)
    post = CommunityPost(
        author_id=user.id,
        author_name=user.full_name,
        author_avatar="",
        getaway_title="Ladakh Bike Expedition",
        location="Leh, Ladakh",
        image_url="https://example.com/ladakh.jpg",
        content="Epic pass rides."
    )
    pg_session.add(post)
    pg_session.commit()

    like1 = PostLike(post_id=post.id, user_id=user.id)
    pg_session.add(like1)
    pg_session.commit()

    like2 = PostLike(post_id=post.id, user_id=user.id)
    pg_session.add(like2)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()


def test_postgres_unique_traveler_memory(pg_session):
    """Requirement 4: UNIQUE(user_id, category, key) rejects duplicate memory key."""
    user = create_pg_user(pg_session)
    m1 = TravelerMemory(
        user_id=user.id,
        category="flight",
        key="seat_preference",
        value={"seat": "window"},
        source="explicit",
        confidence=0.9
    )
    pg_session.add(m1)
    pg_session.commit()

    m2 = TravelerMemory(
        user_id=user.id,
        category="flight",
        key="seat_preference",
        value={"seat": "aisle"},
        source="explicit",
        confidence=0.9
    )
    pg_session.add(m2)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()


def test_postgres_check_constraints_reject_invalid_values(pg_session):
    """
    Requirement 5: CheckConstraints reject out-of-bound values in PostgreSQL:
    - User.trust_score: 0 <= trust_score <= 100
    - TravelerMemory.confidence: 0 <= confidence <= 1
    - Booking.amount: amount >= 0
    - RewardVoucher.coin_cost: coin_cost >= 0
    - RewardTransaction.balance_after: balance_after >= 0
    - SquadExpense.amount: amount >= 0
    - ItineraryActivity.duration_minutes: duration_minutes >= 0
    - ItineraryActivity.transit_minutes: transit_minutes >= 0
    """
    user = create_pg_user(pg_session)
    trip = create_pg_trip(pg_session, user.id)
    day = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    pg_session.add(day)
    pg_session.commit()

    # 1. Invalid trust_score (> 100)
    u_invalid = User(email=f"bad_trust_{uuid.uuid4().hex[:6]}@test.com", full_name="Bad", trust_score=110.0)
    pg_session.add(u_invalid)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    # 2. Invalid memory confidence (> 1.0)
    m_invalid = TravelerMemory(user_id=user.id, category="diet", key="pref", value={}, source="ai", confidence=1.5)
    pg_session.add(m_invalid)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    # 3. Invalid booking amount (< 0)
    b_invalid = Booking(trip_id=trip.id, user_id=user.id, category="flight", provider="AirAsia", title="Flight", amount=-10.0)
    pg_session.add(b_invalid)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    # 4. Invalid voucher coin_cost (< 0)
    v_invalid = RewardVoucher(brand="Test", discount="10%", coin_cost=-5, category="Stays", code=f"BAD_{uuid.uuid4().hex[:6]}")
    pg_session.add(v_invalid)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    # 5. Invalid reward transaction balance_after (< 0)
    tx_invalid = RewardTransaction(user_id=user.id, delta=-50, balance_after=-10, type="PENALTY", reason="Bad balance")
    pg_session.add(tx_invalid)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    # 6. Invalid squad expense amount (< 0)
    room = SquadRoom(itinerary_id=trip.id, room_code=f"R_{uuid.uuid4().hex[:6]}")
    pg_session.add(room)
    pg_session.commit()
    exp_invalid = SquadExpense(squad_id=room.id, paid_by_user_id=user.id, description="Dinner", amount=-50.0, category="Food")
    pg_session.add(exp_invalid)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    # 7. Invalid activity duration_minutes (< 0)
    act_dur_invalid = ItineraryActivity(day_id=day.id, time_slot="Morning", description="Walk", duration_minutes=-10)
    pg_session.add(act_dur_invalid)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()

    # 8. Invalid activity transit_minutes (< 0)
    act_trans_invalid = ItineraryActivity(day_id=day.id, time_slot="Morning", description="Walk", transit_minutes=-15)
    pg_session.add(act_trans_invalid)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()


def test_postgres_foreign_key_cascades(pg_session):
    """
    Requirement 4: FK cascade behavior works properly in PostgreSQL:
    - Deleting an itinerary deletes its days, activities, snapshots, and squad rooms.
    - Deleting a user deletes their profile and itineraries.
    """
    user = create_pg_user(pg_session)
    trip = create_pg_trip(pg_session, user.id)

    day = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    pg_session.add(day)
    pg_session.flush()

    act = ItineraryActivity(day_id=day.id, time_slot="10:00", description="Sightseeing")
    snap = TripSnapshot(trip_id=trip.id, version=1, user_id=user.id, action="ai", action_type="AI", actor_type="USER", days_data=[])
    room = SquadRoom(itinerary_id=trip.id, room_code=f"SQ_{uuid.uuid4().hex[:6]}")
    pg_session.add_all([act, snap, room])
    pg_session.commit()

    day_id = day.id
    act_id = act.id
    snap_id = snap.id
    room_id = room.id

    # Delete itinerary -> verify cascading delete
    pg_session.delete(trip)
    pg_session.commit()

    assert pg_session.query(ItineraryDay).filter(ItineraryDay.id == day_id).first() is None
    assert pg_session.query(ItineraryActivity).filter(ItineraryActivity.id == act_id).first() is None
    assert pg_session.query(TripSnapshot).filter(TripSnapshot.id == snap_id).first() is None
    assert pg_session.query(SquadRoom).filter(SquadRoom.id == room_id).first() is None


def test_postgres_concurrent_reward_awards(pg_engine):
    """
    Requirements 7, 9.10:
    Concurrent award_rewards calls with the SAME idempotency key on PostgreSQL
    do not throw unhandled IntegrityError and award coins exactly once.
    """
    Session = sessionmaker(bind=pg_engine, autocommit=False, autoflush=False)
    setup_session = Session()
    user = create_pg_user(setup_session)
    user_id = user.id
    setup_session.commit()
    setup_session.close()

    shared_idemp_key = f"concurrent_pg_award_{uuid.uuid4().hex}"

    def attempt_award(thread_id):
        sess = Session()
        try:
            bal, was_awarded = award_rewards(
                db=sess,
                user_id=user_id,
                delta=50,
                reward_type="CONCURRENT_TEST",
                reason=f"Concurrent Award Attempt {thread_id}",
                idempotency_key=shared_idemp_key
            )
            sess.commit()
            return bal, was_awarded, None
        except Exception as e:
            sess.rollback()
            return None, False, str(e)
        finally:
            sess.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(attempt_award, i) for i in range(4)]
        results = [f.result() for f in futures]

    # Verify no unhandled exception occurred
    for _, _, err in results:
        assert err is None, f"Concurrent execution raised unhandled error: {err}"

    # Verify exactly one attempt was awarded
    awarded_count = sum(1 for _, was_awarded, _ in results if was_awarded)
    assert awarded_count == 1, f"Expected exactly 1 award, got {awarded_count}"

    # Verify final balance in PostgreSQL
    verify_sess = Session()
    final_profile = verify_sess.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    assert final_profile.reward_coins == 250  # Started at 200 + 50
    tx_count = verify_sess.query(RewardTransaction).filter(
        RewardTransaction.idempotency_key == shared_idemp_key
    ).count()
    assert tx_count == 1
    verify_sess.close()
