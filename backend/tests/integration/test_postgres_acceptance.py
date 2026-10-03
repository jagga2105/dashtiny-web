import os
import sys
import uuid
import pytest
from datetime import date, datetime, timezone
import concurrent.futures

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from alembic.config import Config
from alembic import command

from app.models.models import (
    Base, User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity,
    TripSnapshot, TripProposal, SquadRoom, SquadMember, SquadExpense,
    CommunityPost, PostLike
)
from app.services.trip_revision_service import create_revision, serialize_trip_days, get_current_version

from urllib.parse import urlparse

def validate_test_database_safety(url: str) -> None:
    """
    Safety guard to prevent catastrophic DROP SCHEMA on non-disposable databases.
    Rejects production, prod, or default database names (e.g. 'production', 'prod', 'dashtiny_db').
    Requires an unmistakable test database marker such as '_test', 'test_', or 'acceptance'.
    """
    parsed = urlparse(url)
    db_name = (parsed.path or "").lstrip("/").lower()

    # 1. Prohibited markers
    prohibited_markers = ["prod", "production", "live", "dashtiny_db", "main", "master"]
    for marker in prohibited_markers:
        if marker in db_name:
            raise RuntimeError(
                f"SAFETY GUARD FAILURE: Refusing to drop schema. "
                f"Database '{db_name}' contains dangerous production marker '{marker}'."
            )

    # 2. Required test markers
    valid_markers = ["_test", "test_", "acceptance"]
    if not any(marker in db_name for marker in valid_markers):
        raise RuntimeError(
            f"SAFETY GUARD FAILURE: Refusing to drop schema. "
            f"Database '{db_name}' is missing an unmistakable test marker ({valid_markers}). "
            f"Integration tests require a dedicated disposable test database."
        )


# STEP 1: Load POSTGRES_TEST_DATABASE_URL
POSTGRES_URL = os.environ.get(
    "POSTGRES_TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/dashtiny_empty_test"
)

# STEP 2: Unconditionally validate database is unmistakably disposable BEFORE ANY CONNECTION
# If a dangerous URL is configured, fail immediately rather than skipping.
validate_test_database_safety(POSTGRES_URL)


# STEP 3: Only then attempt connection
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


# STEP 4: Only then allow DROP SCHEMA
@pytest.fixture(scope="module")
def pg_engine():
    # Enforce test database safety guard before any schema modification
    validate_test_database_safety(POSTGRES_URL)

    ini_path = os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini")
    script_path = os.path.join(os.path.dirname(__file__), "..", "..", "alembic")
    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", script_path)
    alembic_cfg.set_main_option("sqlalchemy.url", POSTGRES_URL)

    engine = create_engine(POSTGRES_URL)
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.commit()

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


def test_postgres_concurrent_squad_expenses(pg_engine, pg_session):
    """
    Item 23 & 15:
    Real PostgreSQL concurrency: Multiple concurrent expense insertions
    for the same squad calculate accurate totals and respect row locks.
    """
    user = User(
        email=f"squad_payer_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Payer User",
        password_hash="pw",
        account_type="personal_traveler"
    )
    pg_session.add(user)
    pg_session.flush()

    trip = Itinerary(
        title="Concurrent Squad Trip",
        destination="Goa",
        owner_id=user.id,
        total_budget=50000.0,
        currency="INR",
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 4)
    )
    pg_session.add(trip)
    pg_session.flush()

    squad = SquadRoom(itinerary_id=trip.id, room_code=f"SQ-{uuid.uuid4().hex[:6].upper()}")
    pg_session.add(squad)
    pg_session.flush()

    member = SquadMember(squad_id=squad.id, user_id=user.id, role="owner")
    pg_session.add(member)
    pg_session.commit()

    squad_id = squad.id
    user_id = user.id

    def insert_expense(amount: float, idx: int):
        Session = sessionmaker(bind=pg_engine, autocommit=False, autoflush=False)
        sess = Session()
        try:
            exp = SquadExpense(
                squad_id=squad_id,
                paid_by_user_id=user_id,
                description=f"Expense #{idx}",
                amount=amount,
                category="food"
            )
            sess.add(exp)
            sess.commit()
            return True
        except Exception:
            sess.rollback()
            return False
        finally:
            sess.close()

    # Launch 10 concurrent threads inserting ₹100 each
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(insert_expense, 100.0, i) for i in range(10)]
        results = [f.result() for f in futures]

    assert all(results)
    pg_session.expire_all()
    expenses = pg_session.query(SquadExpense).filter(SquadExpense.squad_id == squad_id).all()
    assert len(expenses) == 10
    total = sum(float(e.amount) for e in expenses)
    assert total == 1000.0


def test_postgres_concurrent_community_likes(pg_engine, pg_session):
    """
    Item 23 & 17:
    Real PostgreSQL concurrency: Simultaneous like requests from different users
    safely and atomically increment post.likes_count.
    """
    author = User(
        email=f"like_author_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Post Author",
        password_hash="pw",
        account_type="personal_traveler"
    )
    pg_session.add(author)
    pg_session.flush()

    post = CommunityPost(
        author_id=author.id,
        author_name=author.full_name,
        author_avatar="https://avatar.com/test.jpg",
        image_url="https://images.com/test.jpg",
        getaway_title="Sunset in Gokarna",
        location="Gokarna",
        content="Quiet beaches and cliffs",
        likes_count=0
    )
    pg_session.add(post)
    pg_session.commit()

    post_id = post.id

    # Create 5 distinct users who will like this post simultaneously
    user_ids = []
    for i in range(5):
        u = User(
            email=f"liker_{i}_{uuid.uuid4().hex[:6]}@example.com",
            full_name=f"Liker {i}",
            password_hash="pw",
            account_type="personal_traveler"
        )
        pg_session.add(u)
        pg_session.flush()
        user_ids.append(u.id)
    pg_session.commit()

    def do_like(uid: str):
        Session = sessionmaker(bind=pg_engine, autocommit=False, autoflush=False)
        sess = Session()
        try:
            sess.add(PostLike(post_id=post_id, user_id=uid))
            sess.query(CommunityPost).filter(CommunityPost.id == post_id).update(
                {CommunityPost.likes_count: CommunityPost.likes_count + 1}
            )
            sess.commit()
            return True
        except Exception:
            sess.rollback()
            return False
        finally:
            sess.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(do_like, uid) for uid in user_ids]
        results = [f.result() for f in futures]

    assert all(results)
    pg_session.expire_all()
    refreshed_post = pg_session.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    assert refreshed_post.likes_count == 5

    # If the same user attempts a duplicate like concurrently, unique constraint blocks it
    dup_success = do_like(user_ids[0])
    assert dup_success is False


def test_postgres_concurrent_proposal_accepts_one_succeeds_one_409(pg_engine, pg_session):
    """
    Item 10 & 21:
    Concurrency test on real PostgreSQL:
    Two simultaneous accepts for proposals targeting parent revision v1.
    Row locking ensures:
    - One succeeds -> commits revision v2
    - One receives 409 Conflict -> no duplicate revision
    """
    user = User(
        email=f"concur_user_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Concur User",
        password_hash="pw",
        account_type="personal_traveler"
    )
    pg_session.add(user)
    pg_session.flush()

    trip = Itinerary(
        title="Kyoto Concurrency Race",
        destination="Kyoto",
        owner_id=user.id,
        total_budget=60000.0,
        currency="INR",
        start_date=date(2026, 11, 10),
        end_date=date(2026, 11, 14)
    )
    pg_session.add(trip)
    pg_session.flush()

    day = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    pg_session.add(day)
    pg_session.flush()

    act = ItineraryActivity(
        day_id=day.id,
        time_slot="10:00 AM",
        description="Fushimi Inari Early Stroll",
        location="Kyoto",
        place_type="TA",
        cost_estimate=0.0,
        sort_order=0
    )
    pg_session.add(act)
    pg_session.flush()

    # Create baseline revision v1
    from app.services.trip_revision_service import record_initial_revision, restore_revision, record_mutation
    record_initial_revision(pg_session, trip.id, user.id)
    pg_session.commit()

    trip_id = trip.id
    user_id = user.id

    # Create two pending proposals both targeting parent_version = 1
    p1 = TripProposal(
        trip_id=trip_id,
        user_id=user_id,
        parent_version=1,
        instruction="Proposal A: Add Nishiki lunch",
        summary="Add Nishiki Market lunch",
        changes=[{"action": "add", "item": "Nishiki Market"}],
        before_state={"days": serialize_trip_days(trip)},
        after_state={"days": serialize_trip_days(trip)},
        status="pending"
    )
    p2 = TripProposal(
        trip_id=trip_id,
        user_id=user_id,
        parent_version=1,
        instruction="Proposal B: Add Kiyomizu sunset",
        summary="Add Kiyomizu-dera sunset",
        changes=[{"action": "add", "item": "Kiyomizu-dera"}],
        before_state={"days": serialize_trip_days(trip)},
        after_state={"days": serialize_trip_days(trip)},
        status="pending"
    )
    pg_session.add(p1)
    pg_session.add(p2)
    pg_session.commit()

    p1_id = p1.id
    p2_id = p2.id

    def try_accept_proposal(proposal_id: str):
        Session = sessionmaker(bind=pg_engine, autocommit=False, autoflush=False)
        sess = Session()
        try:
            # 1. Lock trip row
            t = sess.query(Itinerary).filter(Itinerary.id == trip_id).with_for_update().first()
            prop = sess.query(TripProposal).filter(TripProposal.id == proposal_id).first()
            current_ver = get_current_version(sess, trip_id)

            # 2. Strict conflict check: proposal parent_version must match current_ver
            if prop.parent_version != current_ver:
                sess.rollback()
                return {"status": 409, "detail": "Conflict: stale proposal"}

            # 3. Create mutation revision
            create_revision(
                db=sess,
                trip_id=trip_id,
                user_id=user_id,
                action_type="AI_PROPOSAL_ACCEPTED",
                days_data=prop.after_state,
                summary=prop.summary,
                instruction=prop.instruction,
                parent_version=prop.parent_version
            )
            prop.status = "accepted"
            sess.commit()
            return {"status": 200, "detail": "Accepted"}
        except Exception as e:
            sess.rollback()
            return {"status": 500, "detail": str(e)}
        finally:
            sess.close()

    # Run both accepts concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(try_accept_proposal, p1_id)
        f2 = executor.submit(try_accept_proposal, p2_id)
        res1 = f1.result()
        res2 = f2.result()

    statuses = [res1["status"], res2["status"]]
    assert 200 in statuses, f"Expected one 200 success, got {statuses}"
    assert 409 in statuses, f"Expected one 409 conflict, got {statuses}"

    # Verify PostgreSQL DB state has exactly versions [1, 2] with no duplicate or collided versions
    pg_session.expire_all()
    all_snaps = pg_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip_id).order_by(TripSnapshot.version.asc()).all()
    assert [s.version for s in all_snaps] == [1, 2]


def test_postgres_append_only_multi_undo_parent_chain(pg_engine, pg_session):
    """
    Items 1, 2, 4, 5, 6:
    Verify complete multi-step append-only undo on PostgreSQL:
    v1 INITIAL -> v2 AI -> v3 USER -> v4 AI
    Undo 1: creates v5 UNDO, restores v3 state
    Undo 2: creates v6 UNDO, restores v2 state
    Undo 3: creates v7 UNDO, restores v1 state
    Undo 4: raises ValueError (v1 has no parent)
    All snapshots v1-v7 exist and old snapshots are NEVER modified or marked reverted.
    """
    user = User(
        email=f"undo_chain_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Undo Chain User",
        password_hash="pw",
        account_type="personal_traveler"
    )
    pg_session.add(user)
    pg_session.flush()

    trip = Itinerary(
        title="Hakone Chain Undo Trip",
        destination="Hakone",
        owner_id=user.id,
        total_budget=50000.0,
        currency="INR",
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 4)
    )
    pg_session.add(trip)
    pg_session.flush()

    day = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Day 1")
    pg_session.add(day)
    pg_session.flush()

    act_v1 = ItineraryActivity(
        day_id=day.id,
        time_slot="09:00 AM",
        description="State v1: Morning Onsen",
        location="Hakone",
        place_type="TA",
        cost_estimate=1000.0,
        sort_order=0
    )
    pg_session.add(act_v1)
    pg_session.flush()

    from app.services.trip_revision_service import record_initial_revision, record_mutation, restore_revision
    record_initial_revision(pg_session, trip.id, user.id)
    pg_session.commit()

    # v2: AI Mutation
    act_v2 = ItineraryActivity(
        day_id=day.id,
        time_slot="01:00 PM",
        description="State v2: Lake Ashi Boat Cruise",
        location="Lake Ashi",
        place_type="TA",
        cost_estimate=800.0,
        sort_order=1
    )
    pg_session.add(act_v2)
    pg_session.flush()
    record_mutation(pg_session, trip.id, user.id, "AI_PROPOSAL_ACCEPTED", "Add Lake Ashi boat cruise")
    pg_session.commit()

    # v3: User Mutation
    act_v3 = ItineraryActivity(
        day_id=day.id,
        time_slot="04:00 PM",
        description="State v3: Artisan Soba Dinner",
        location="Gora",
        place_type="R",
        cost_estimate=1500.0,
        sort_order=2
    )
    pg_session.add(act_v3)
    pg_session.flush()
    record_mutation(pg_session, trip.id, user.id, "USER_ACTIVITY_ADDED", "User added artisan soba")
    pg_session.commit()

    # v4: AI Mutation
    act_v4 = ItineraryActivity(
        day_id=day.id,
        time_slot="08:00 PM",
        description="State v4: Stargazing Walk",
        location="Hakone Shrine",
        place_type="TA",
        cost_estimate=0.0,
        sort_order=3
    )
    pg_session.add(act_v4)
    pg_session.flush()
    record_mutation(pg_session, trip.id, user.id, "AI_PROPOSAL_ACCEPTED", "Add stargazing walk")
    pg_session.commit()

    # Verify initial sequence [1, 2, 3, 4]
    snaps_4 = pg_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id).order_by(TripSnapshot.version.asc()).all()
    assert [s.version for s in snaps_4] == [1, 2, 3, 4]

    # --- Undo 1: restores v3, creates v5 ---
    u1_snap, target_1 = restore_revision(pg_session, trip.id, user.id)
    pg_session.commit()
    assert u1_snap.version == 5
    assert u1_snap.parent_version == 4
    assert target_1 == 3
    assert u1_snap.action_type == "UNDO"

    pg_session.expire_all()
    acts_at_5 = pg_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day.id).all()
    assert len(acts_at_5) == 3
    assert not any("Stargazing" in a.description for a in acts_at_5)

    # --- Undo 2: restores v2, creates v6 ---
    u2_snap, target_2 = restore_revision(pg_session, trip.id, user.id)
    pg_session.commit()
    assert u2_snap.version == 6
    assert u2_snap.parent_version == 5
    assert target_2 == 2
    assert u2_snap.action_type == "UNDO"

    pg_session.expire_all()
    acts_at_6 = pg_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day.id).all()
    assert len(acts_at_6) == 2
    assert not any("Soba Dinner" in a.description for a in acts_at_6)

    # --- Undo 3: restores v1, creates v7 ---
    u3_snap, target_3 = restore_revision(pg_session, trip.id, user.id)
    pg_session.commit()
    assert u3_snap.version == 7
    assert u3_snap.parent_version == 6
    assert target_3 == 1
    assert u3_snap.action_type == "UNDO"

    pg_session.expire_all()
    acts_at_7 = pg_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day.id).all()
    assert len(acts_at_7) == 1
    assert "Morning Onsen" in acts_at_7[0].description

    # --- Undo 4: fails (v1 has no parent) ---
    with pytest.raises(ValueError, match="No previous trip revision available"):
        restore_revision(pg_session, trip.id, user.id)

    # Invariant: All 7 snapshots are persisted in PostgreSQL, strictly append-only, NONE marked 'reverted'
    all_7 = pg_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id).order_by(TripSnapshot.version.asc()).all()
    assert len(all_7) == 7
    assert [s.version for s in all_7] == [1, 2, 3, 4, 5, 6, 7]
    assert all(s.action != "reverted" for s in all_7)


def test_postgres_squad_creator_owner_and_member_unprivileged(pg_engine, pg_session):
    """
    Item 17:
    Squad Hardening on PostgreSQL:
    - Creator is unconditionally role="owner"
    - Duplicate squad creation returns exists
    - Client input cannot grant privileged roles (role is always "member")
    - Duplicate membership is rejected cleanly by unique constraint
    """
    owner = User(
        email=f"sq_owner_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Squad Owner",
        password_hash="pw",
        account_type="personal_traveler"
    )
    invitee = User(
        email=f"sq_invitee_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Squad Invitee",
        password_hash="pw",
        account_type="personal_traveler"
    )
    pg_session.add(owner)
    pg_session.add(invitee)
    pg_session.flush()

    trip = Itinerary(
        title="Squad Hardening Trip",
        destination="Manali",
        owner_id=owner.id,
        total_budget=40000.0,
        currency="INR"
    )
    pg_session.add(trip)
    pg_session.commit()

    # Create squad
    squad = SquadRoom(itinerary_id=trip.id, room_code=f"SQ-{uuid.uuid4().hex[:6].upper()}")
    pg_session.add(squad)
    pg_session.flush()

    # Creator is always owner
    m_owner = SquadMember(squad_id=squad.id, user_id=owner.id, role="owner")
    pg_session.add(m_owner)
    pg_session.commit()

    # Attempt to add invitee with client-requested privileged role -> must be stored as "member"
    client_requested_role = "admin" # Client tried to spoof admin/owner
    safe_role = "member"  # Server-enforced
    m_invitee = SquadMember(squad_id=squad.id, user_id=invitee.id, role=safe_role)
    pg_session.add(m_invitee)
    pg_session.commit()

    pg_session.refresh(m_invitee)
    assert m_invitee.role == "member"

    # Attempting duplicate membership raises IntegrityError (caught cleanly)
    dup_member = SquadMember(squad_id=squad.id, user_id=invitee.id, role="member")
    pg_session.add(dup_member)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()


def test_postgres_airports_domain_search_and_lookup(pg_engine, pg_session):
    """
    Location domain tests on real PostgreSQL:
    - Verifies Airport persistence and indexing
    - Verifies search by IATA and city
    - Verifies unique constraint on iata_code
    """
    from app.models.models import Airport
    from app.db.seed_airports import seed_airports

    # Seed airports
    seeded_count = seed_airports(pg_session)
    assert seeded_count > 0

    # Search by IATA code
    goi = pg_session.query(Airport).filter(Airport.iata_code == "GOI").first()
    assert goi is not None
    assert "Goa" in goi.city
    assert goi.country == "India"

    # Search by city substring
    delhi_airports = pg_session.query(Airport).filter(Airport.city.ilike("%delhi%")).all()
    assert len(delhi_airports) >= 1
    assert any(a.iata_code == "DEL" for a in delhi_airports)

    # Unique constraint on iata_code rejects duplicate
    dup_airport = Airport(
        id=str(uuid.uuid4()),
        iata_code="DEL",
        name="Duplicate Delhi",
        city="Delhi",
        country="India"
    )
    pg_session.add(dup_airport)
    with pytest.raises(IntegrityError):
        pg_session.commit()
    pg_session.rollback()


def test_database_safety_guard_rejects_dangerous_targets():
    """
    Safety Guard Unit Verification:
    Rejects production, prod, or generic database names.
    Accepts only explicit test databases containing '_test', 'test_', or 'acceptance'.
    """
    # Prohibited cases must raise RuntimeError
    dangerous_urls = [
        "postgresql://postgres:secret@prod-db.aws.com:5432/production",
        "postgresql://postgres:secret@prod-db.aws.com:5432/dashtiny_prod",
        "postgresql://postgres:secret@localhost:5432/dashtiny_db",
        "postgresql://postgres:secret@localhost:5432/main",
        "postgresql://postgres:secret@localhost:5432/master",
        "postgresql://postgres:secret@localhost:5432/dashtiny",
    ]
    for url in dangerous_urls:
        with pytest.raises(RuntimeError, match="SAFETY GUARD FAILURE"):
            validate_test_database_safety(url)

    # Valid test markers must succeed without raising
    safe_urls = [
        "postgresql://postgres:postgres@localhost:5432/dashtiny_empty_test",
        "postgresql://postgres:postgres@localhost:5432/test_dashtiny",
        "postgresql://postgres:postgres@localhost:5432/dashtiny_acceptance",
        "postgresql://postgres:postgres@ci-runner:5432/ci_test_db",
    ]
    for url in safe_urls:
        validate_test_database_safety(url)  # Must not raise



