import uuid
import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.models import Itinerary, Friendship, User, UserProfile, CommunityPost

@pytest.fixture
def other_user(db_session):
    u = User(
        id=f"other-user-{uuid.uuid4().hex[:8]}",
        email=f"other_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Jordan Lee",
        password_hash="testhash"
    )
    db_session.add(u)
    db_session.flush()
    prof = UserProfile(user_id=u.id, reward_coins=100)
    db_session.add(prof)
    db_session.commit()
    return u


def make_authenticated_client(db_session, user_obj):
    def override_get_db():
        yield db_session

    def override_get_current_user():
        return user_obj

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    client = TestClient(app)
    return client


def test_public_trip_accessible_by_anyone(client, db_session, test_user, other_user):
    """
    PUBLIC trips are accessible by both the owner and other users.
    """
    trip_id = f"trip-pub-{uuid.uuid4().hex[:8]}"
    trip = Itinerary(
        id=trip_id,
        owner_id=test_user.id,
        title="Public Goa Trip",
        destination="Goa",
        origin="BOM",
        travellers=2,
        visibility="PUBLIC",
        is_public=True,
        total_budget=40000.0,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 5)
    )
    db_session.add(trip)
    db_session.commit()

    # Owner access
    resp = client.get(f"/api/v1/trips/{trip_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["visibility"] == "PUBLIC"
    assert data["is_public"] is True

    # Other user access
    other_client = make_authenticated_client(db_session, other_user)
    try:
        resp_other = other_client.get(f"/api/v1/trips/{trip_id}")
        assert resp_other.status_code == 200
        assert resp_other.json()["id"] == trip_id
        assert resp_other.json()["visibility"] == "PUBLIC"
    finally:
        app.dependency_overrides.clear()


def test_private_trip_boundaries(client, db_session, test_user, other_user):
    """
    PRIVATE trips can only be accessed by the owner (or squad members), returning 403 to others.
    """
    trip_id = f"trip-priv-{uuid.uuid4().hex[:8]}"
    trip = Itinerary(
        id=trip_id,
        owner_id=test_user.id,
        title="Private Family Sanctuary",
        destination="Manali",
        origin="DEL",
        travellers=3,
        visibility="PRIVATE",
        is_public=False,
        total_budget=60000.0,
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 5)
    )
    db_session.add(trip)
    db_session.commit()

    # Owner access: Allowed
    resp = client.get(f"/api/v1/trips/{trip_id}")
    assert resp.status_code == 200
    assert resp.json()["visibility"] == "PRIVATE"

    # Stranger access: 403 Forbidden
    other_client = make_authenticated_client(db_session, other_user)
    try:
        resp_other = other_client.get(f"/api/v1/trips/{trip_id}")
        assert resp_other.status_code == 403
        assert "private or restricted to friends" in resp_other.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_friends_only_trip_access_flow(client, db_session, test_user, other_user):
    """
    FRIENDS_ONLY trips require an accepted Friendship between requester and owner.
    """
    trip_id = f"trip-friends-{uuid.uuid4().hex[:8]}"
    trip = Itinerary(
        id=trip_id,
        owner_id=test_user.id,
        title="Friends Only Camping Trek",
        destination="Rishikesh",
        origin="DEL",
        travellers=4,
        visibility="FRIENDS_ONLY",
        is_public=False,
        total_budget=30000.0,
        start_date=date(2026, 11, 10),
        end_date=date(2026, 11, 14)
    )
    db_session.add(trip)
    db_session.commit()

    other_client = make_authenticated_client(db_session, other_user)
    try:
        # Before friendship: 403
        resp_before = other_client.get(f"/api/v1/trips/{trip_id}")
        assert resp_before.status_code == 403

        # Pending friendship: Still 403
        friendship = Friendship(
            id=f"fr-{uuid.uuid4().hex[:8]}",
            user_id=test_user.id,
            friend_id=other_user.id,
            status="pending"
        )
        db_session.add(friendship)
        db_session.commit()

        resp_pending = other_client.get(f"/api/v1/trips/{trip_id}")
        assert resp_pending.status_code == 403

        # Accepted friendship: 200 OK
        friendship.status = "accepted"
        db_session.commit()

        resp_accepted = other_client.get(f"/api/v1/trips/{trip_id}")
        assert resp_accepted.status_code == 200
        assert resp_accepted.json()["id"] == trip_id
        assert resp_accepted.json()["visibility"] == "FRIENDS_ONLY"
    finally:
        app.dependency_overrides.clear()


def test_patch_trip_visibility(client, db_session, test_user, other_user):
    """
    Owner can change visibility between PUBLIC, FRIENDS_ONLY, PRIVATE.
    Invalid visibilities return 400.
    Non-owners get 403.
    """
    trip_id = f"trip-patch-{uuid.uuid4().hex[:8]}"
    trip = Itinerary(
        id=trip_id,
        owner_id=test_user.id,
        title="Dynamic Visibility Trip",
        destination="Jaipur",
        origin="DEL",
        travellers=2,
        visibility="PRIVATE",
        is_public=False,
        total_budget=25000.0,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 3)
    )
    db_session.add(trip)
    db_session.commit()

    # Owner updates to FRIENDS_ONLY
    patch_resp = client.patch(f"/api/v1/trips/{trip_id}/visibility", json={"visibility": "FRIENDS_ONLY"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["visibility"] == "FRIENDS_ONLY"
    assert patch_resp.json()["is_public"] is False

    # Owner updates to PUBLIC
    patch_resp = client.patch(f"/api/v1/trips/{trip_id}/visibility", json={"visibility": "PUBLIC"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["visibility"] == "PUBLIC"
    assert patch_resp.json()["is_public"] is True

    # Invalid visibility
    patch_bad = client.patch(f"/api/v1/trips/{trip_id}/visibility", json={"visibility": "SECRET_GARDEN"})
    assert patch_bad.status_code == 400

    # Non-owner attempting to patch
    other_client = make_authenticated_client(db_session, other_user)
    try:
        patch_other = other_client.patch(f"/api/v1/trips/{trip_id}/visibility", json={"visibility": "PRIVATE"})
        assert patch_other.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_community_feed_filters_private_trips(client, db_session, test_user):
    """
    Community feed must never expose private trips, even if referenced by a post.
    """
    trip_id = f"trip-comm-priv-{uuid.uuid4().hex[:8]}"
    trip = Itinerary(
        id=trip_id,
        owner_id=test_user.id,
        title="Private Post Trip",
        destination="Coorg",
        origin="BLR",
        travellers=2,
        visibility="PRIVATE",
        is_public=False,
        total_budget=30000.0,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 3)
    )
    db_session.add(trip)
    db_session.flush()

    post = CommunityPost(
        id=f"post-{uuid.uuid4().hex[:8]}",
        author_id=test_user.id,
        author_name=test_user.full_name or "Alex Mercer",
        author_avatar="https://avatar.iran.liara.run/public",
        getaway_title="Secret getaway",
        content="Amazing coffee plantations",
        location="Coorg",
        image_url="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957",
        source_trip_id=trip.id
    )
    db_session.add(post)
    db_session.commit()

    feed_resp = client.get("/api/v1/community/feed")
    assert feed_resp.status_code == 200
    feed = feed_resp.json()
    post_ids = [p["id"] for p in feed]
    assert post.id not in post_ids
