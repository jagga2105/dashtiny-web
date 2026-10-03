import pytest
from datetime import date
from starlette.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import User, Itinerary, ItineraryDay, ItineraryActivity
from app.config import settings
from app.api.v1.auth import create_access_token


def test_google_failure_returns_error_not_demo(client: TestClient, monkeypatch):
    """
    Item 4 & 23:
    When Google authentication fails or backend fails to process Google payload,
    it must return an authentication error and NEVER fall back automatically to demo mode.
    """
    # Attempt login with invalid payload (e.g. empty or broken)
    res = client.post("/api/v1/auth/google", json={
        "google_id": "",
        "email": "invalid-email-format"
    })
    # Must fail with validation/auth error, not 200 demo login
    assert res.status_code in [400, 422]


def test_demo_mode_disabled_in_production(client: TestClient, monkeypatch):
    """
    Item 4 & 23:
    In production environments, /auth/demo must return 403 Forbidden.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "DEMO_MODE", False)

    res = client.post("/api/v1/auth/demo", json={"role": "demo_explorer"})
    assert res.status_code == 403
    assert "disabled in this environment" in res.json()["detail"].lower()


def test_passwordless_account_requires_reset(client: TestClient, db_session: Session):
    """
    Item 4 & 23:
    A passwordless account (created via OAuth/OTP with hashed_password=None)
    must reject password login and require a password setup/reset flow.
    It must NEVER silently accept the supplied password as permanent.
    """
    oauth_user = User(
        email="oauth_traveler@example.com",
        full_name="OAuth Traveler",
        password_hash=None,
        account_type="personal_traveler"
    )
    db_session.add(oauth_user)
    db_session.commit()

    # Attempt to log in with arbitrary password
    res = client.post("/api/v1/auth/login", json={
        "email": "oauth_traveler@example.com",
        "password": "AttemptedPassword123"
    })
    assert res.status_code == 400
    assert any(term in res.json()["detail"].lower() for term in ["password setup", "password reset"])

    # Verify password was NOT silently set
    db_session.refresh(oauth_user)
    assert oauth_user.password_hash is None


def test_user_a_cannot_read_or_mutate_user_b_trip(client: TestClient, db_session: Session, test_user):
    """
    Item 23:
    User A cannot read User B's private Trip.
    User A cannot mutate User B's Trip.
    """
    # Create User B
    user_b = User(
        email="user_b@example.com",
        full_name="User B Traveler",
        password_hash="hashed_pw_b",
        account_type="personal_traveler"
    )
    db_session.add(user_b)
    db_session.commit()

    # Create private Trip for User B
    trip_b = Itinerary(
        title="User B Secret Vacation",
        destination="Maldives",
        owner_id=user_b.id,
        total_budget=150000.0,
        currency="INR",
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 5),
        is_public=False
    )
    db_session.add(trip_b)
    db_session.commit()

    day_b = ItineraryDay(itinerary_id=trip_b.id, day_number=1, title="Arrival")
    db_session.add(day_b)
    db_session.commit()

    # Client is authenticated as test_user (User A)
    # 1. User A tries to read User B's trip
    res_read = client.get(f"/api/v1/trips/{trip_b.id}")
    assert res_read.status_code == 403

    # 2. User A tries to add activity to User B's trip
    res_add = client.post(f"/api/v1/trips/{trip_b.id}/activities", json={
        "day_id": day_b.id,
        "time_slot": "10:00 AM",
        "description": "Unauthorized addition by User A"
    })
    assert res_add.status_code == 403

    # 3. User A tries to create AI proposal on User B's trip
    res_prop = client.post("/api/v1/ai/proposals", json={
        "trip_id": trip_b.id,
        "instruction": "Add parasailing"
    })
    assert res_prop.status_code == 403
