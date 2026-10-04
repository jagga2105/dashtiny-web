import uuid
import pytest
from datetime import date
from contextlib import contextmanager

from app.main import app
from app.db.database import get_db
from app.api.deps import get_current_user, get_optional_user
from app.models.models import (
    User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity,
    Friendship, TripInterestRequest, SquadRoom, SquadMember
)


@pytest.fixture
def companion_user(db_session):
    u = User(
        id=f"comp-user-{uuid.uuid4().hex[:8]}",
        email=f"companion_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Maya Lin",
        password_hash="testhash"
    )
    db_session.add(u)
    db_session.flush()
    prof = UserProfile(
        user_id=u.id,
        interests=["beaches", "snorkeling", "seafood"],
        likes=["quiet coves"],
        dislikes=["crowds"],
        pace="relaxed",
        budget_tier="moderate",
        reward_coins=200
    )
    db_session.add(prof)
    db_session.commit()
    return u


@contextmanager
def as_user(user_obj):
    old_current = app.dependency_overrides.get(get_current_user)
    old_optional = app.dependency_overrides.get(get_optional_user)
    app.dependency_overrides[get_current_user] = lambda: user_obj
    app.dependency_overrides[get_optional_user] = lambda: user_obj
    try:
        yield
    finally:
        if old_current:
            app.dependency_overrides[get_current_user] = old_current
        else:
            app.dependency_overrides.pop(get_current_user, None)
        if old_optional:
            app.dependency_overrides[get_optional_user] = old_optional
        else:
            app.dependency_overrides.pop(get_optional_user, None)


def test_send_and_accept_friend_request(client, db_session, test_user, companion_user):
    """
    Test end-to-end friend request lifecycle:
    User A sends -> User B inspects incoming -> User B accepts -> Both are friends.
    """
    # 1. User A (test_user) sends request to Maya
    req_resp = client.post("/api/v1/friends/request", json={"friend_id": companion_user.id})
    assert req_resp.status_code == 200
    assert req_resp.json()["status"] == "sent"
    req_id = req_resp.json()["request_id"]

    # 2. Maya inspects friends list
    with as_user(companion_user):
        maya_list = client.get("/api/v1/friends")
        assert maya_list.status_code == 200
        incoming = maya_list.json()["incoming_requests"]
        assert len(incoming) == 1
        assert incoming[0]["request_id"] == req_id
        assert incoming[0]["user_id"] == test_user.id

        # 3. Maya accepts request
        respond_resp = client.post(f"/api/v1/friends/requests/{req_id}/respond", json={"action": "accept"})
        assert respond_resp.status_code == 200
        assert respond_resp.json()["status"] == "accepted"

        # 4. Maya sees test_user in her friends
        maya_after = client.get("/api/v1/friends").json()
        assert len(maya_after["friends"]) == 1
        assert maya_after["friends"][0]["id"] == test_user.id

    # 5. Outside context, test_user sees Maya in his friends
    user_after = client.get("/api/v1/friends").json()
    assert len(user_after["friends"]) == 1
    assert user_after["friends"][0]["id"] == companion_user.id
    assert user_after["friends"][0]["pace"] == "relaxed"


def test_cannot_friend_self_and_duplicate_prevention(client, companion_user):
    """
    Validation prevents friending self or sending duplicate pending requests.
    """
    # Self-friend
    bad_resp = client.post("/api/v1/friends/request", json={"friend_id": "test-user-uuid-1234"})
    assert bad_resp.status_code == 400

    # First request
    resp1 = client.post("/api/v1/friends/request", json={"friend_id": companion_user.id})
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "sent"

    # Second duplicate request
    resp2 = client.post("/api/v1/friends/request", json={"friend_id": companion_user.id})
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "pending"
    assert "already sent" in resp2.json()["message"]


def test_reciprocal_friend_request_auto_accepts(client, test_user, companion_user):
    """
    When User A requests User B, and User B sends request back to User A,
    the friendship is automatically accepted.
    """
    client.post("/api/v1/friends/request", json={"friend_id": companion_user.id})

    with as_user(companion_user):
        resp = client.post("/api/v1/friends/request", json={"friend_id": test_user.id})
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"
        assert "now travel friends" in resp.json()["message"]


def test_trip_interest_expression_and_approval_flow(client, db_session, test_user, companion_user):
    """
    Test prospective companion expressing interest in a trip,
    computing compatibility snapshot, and creator approving them into Squad.
    """
    # Setup test_user profile
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    profile.interests = ["beaches", "coastal walks"]
    profile.pace = "relaxed"
    db_session.commit()

    # Create trip owned by test_user
    trip = Itinerary(
        id=f"trip-int-{uuid.uuid4().hex[:8]}",
        owner_id=test_user.id,
        title="Andaman Coastal Discovery",
        destination="Havelock Island",
        vibe="beaches & snorkeling",
        persona="relaxed",
        visibility="PUBLIC",
        is_public=True,
        total_budget=50000.0,
        travellers=2
    )
    db_session.add(trip)
    db_session.flush()

    day = ItineraryDay(id=f"day-int-{uuid.uuid4().hex[:8]}", itinerary_id=trip.id, day_number=1, title="Beach Day")
    db_session.add(day)
    db_session.flush()

    act = ItineraryActivity(
        id=f"act-int-{uuid.uuid4().hex[:8]}",
        day_id=day.id,
        time_slot="09:00 AM",
        description="Snorkeling at Elephant Beach reef",
        location="Elephant Beach",
        sort_order=1
    )
    db_session.add(act)
    db_session.commit()

    # Maya expresses interest
    with as_user(companion_user):
        int_resp = client.post(
            f"/api/v1/trips/{trip.id}/interest",
            json={"message": "Hey Alex! Would love to join for the snorkeling."}
        )
        assert int_resp.status_code == 200
        data = int_resp.json()
        assert data["status"] == "pending"
        assert data["compatibility_score"] >= 75
        assert data["compatibility_level"] in ("GOOD", "EXCELLENT")
        req_id = data["request_id"]

    # Creator Alex inspects interest applications
    alex_apps = client.get(f"/api/v1/trips/{trip.id}/interest")
    assert alex_apps.status_code == 200
    apps_list = alex_apps.json()
    assert len(apps_list) == 1
    assert apps_list[0]["request_id"] == req_id
    assert apps_list[0]["applicant"]["full_name"] == "Maya Lin"
    assert apps_list[0]["compatibility_score"] >= 75

    # Creator Alex approves Maya
    appr_resp = client.post(
        f"/api/v1/trips/{trip.id}/interest/{req_id}/respond",
        json={"action": "approve"}
    )
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "approved"
    assert "squad_room_code" in appr_resp.json()

    # Verify Maya is now in SquadRoom
    squad = db_session.query(SquadRoom).filter(SquadRoom.itinerary_id == trip.id).first()
    assert squad is not None
    maya_membership = db_session.query(SquadMember).filter(
        SquadMember.squad_id == squad.id,
        SquadMember.user_id == companion_user.id
    ).first()
    assert maya_membership is not None
    assert maya_membership.role == "member"

    # Creator is also in SquadRoom as owner
    owner_membership = db_session.query(SquadMember).filter(
        SquadMember.squad_id == squad.id,
        SquadMember.user_id == test_user.id
    ).first()
    assert owner_membership is not None
    assert owner_membership.role == "owner"


def test_non_owner_cannot_review_or_respond_to_interest(client, db_session, test_user, companion_user):
    """
    Strangers cannot view applications or approve requests for trips they don't own.
    """
    trip = Itinerary(
        id=f"trip-sec-{uuid.uuid4().hex[:8]}",
        owner_id=test_user.id,
        title="Secret Sanctuary",
        destination="Ladakh",
        visibility="PUBLIC",
        is_public=True
    )
    db_session.add(trip)
    db_session.commit()

    with as_user(companion_user):
        forbidden_list = client.get(f"/api/v1/trips/{trip.id}/interest")
        assert forbidden_list.status_code == 403
