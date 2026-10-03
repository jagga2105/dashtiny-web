import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db.database import Base, get_db
from app.models.models import User, UserProfile, RewardVoucher
from app.api.deps import get_current_user
from app.main import app

# In-memory SQLite database for isolated, fast test execution
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    # Seed default vouchers for testing
    session = TestingSessionLocal()
    defaults = [
        RewardVoucher(
            id="vch_01",
            brand="Taj Hotels & Palaces",
            discount="₹3,000 Off Luxury Stays",
            coin_cost=150,
            category="Stays",
            code="TAJ-DASHTINY-3K"
        ),
        RewardVoucher(
            id="vch_02",
            brand="IndiGo Getaway Pass",
            discount="15% Cashback on Flights",
            coin_cost=200,
            category="Flights",
            code="6E-ESCAPE-15"
        ),
        RewardVoucher(
            id="vch_03",
            brand="Airbnb Sanctuaries",
            discount="₹2,500 Squad Discount",
            coin_cost=100,
            category="Villas",
            code="AIRBNB-SQUAD-25"
        )
    ]
    for d in defaults:
        session.add(d)
    session.commit()

    from app.db.seed_airports import seed_airports
    seed_airports(session)
    session.close()

    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def isolate_test_environment(monkeypatch):
    """
    Ensures unit tests run deterministically without consuming live external API quotas
    unless explicitly mocked or enabled by a test.
    """
    from app.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)

@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def test_user(db_session):
    user = User(
        id="test-user-uuid-1234",
        email="traveler@dashtiny.ai",
        full_name="Alex Mercer",
        password_hash="testhash"
    )
    db_session.add(user)
    db_session.flush()
    profile = UserProfile(
        user_id=user.id,
        reward_coins=500
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def client(db_session, test_user):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
