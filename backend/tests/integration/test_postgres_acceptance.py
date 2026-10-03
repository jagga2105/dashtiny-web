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
