import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.models import User, UserProfile, Itinerary, SquadRoom, SquadMember
from app.api.v1.auth import get_current_user
from app.services.planner.squad_aggregator import SquadProfileAggregator


def as_user(user_obj):
    class UserOverrideContext:
        def __enter__(self):
            app.dependency_overrides[get_current_user] = lambda: user_obj
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            app.dependency_overrides.pop(get_current_user, None)

    return UserOverrideContext()


def test_squad_profile_aggregation_engine(db_session: Session):
    # Setup 3 users
    u1 = User(email="owner@dashtiny.ai", full_name="Aarav Owner", password_hash="h1", trust_score=95.0, is_verified=True)
    u2 = User(email="relaxed@dashtiny.ai", full_name="Riya Relaxed", password_hash="h2", trust_score=90.0, is_verified=False)
    u3 = User(email="photo@dashtiny.ai", full_name="Kabir Explorer", password_hash="h3", trust_score=88.0, is_verified=True)
    db_session.add_all([u1, u2, u3])
    db_session.flush()

    p1 = UserProfile(
        user_id=u1.id,
        pace="balanced",
        travel_style="culture",
        interests=["Food", "Photography", "Temples"],
        dislikes=["Crowded nightlife"],
        likes=["Fine dining"],
        food_preferences=["Local delicacies"]
    )
    p2 = UserProfile(
        user_id=u2.id,
        pace="relaxed",
        travel_style="coastal",
        interests=["Photography", "Beaches", "Cafes"],
        dislikes=["Long walking"],
        likes=["Sunset views"],
        food_preferences=["Seafood"]
    )
    p3 = UserProfile(
        user_id=u3.id,
        pace="fast",
        travel_style="photography",
        interests=["Photography", "Food", "Art"],
        dislikes=["Generic tourist traps"],
        likes=["Hidden spots"],
        food_preferences=["Vegetarian"]
    )
    db_session.add_all([p1, p2, p3])
    db_session.flush()

    trip = Itinerary(
        title="South India Cultural Odyssey",
        destination="Kerala & Mysore",
        total_budget=50000.0,
        owner_id=u1.id,
        visibility="PUBLIC"
    )
    db_session.add(trip)
    db_session.flush()

    squad = SquadRoom(itinerary_id=trip.id, room_code="SQUAD-KER01")
    db_session.add(squad)
    db_session.flush()

    m1 = SquadMember(squad_id=squad.id, user_id=u1.id, role="owner")
    m2 = SquadMember(squad_id=squad.id, user_id=u2.id, role="member")
    m3 = SquadMember(squad_id=squad.id, user_id=u3.id, role="member")
    db_session.add_all([m1, m2, m3])
    db_session.commit()

    # Run Aggregation Engine
    profile = SquadProfileAggregator.aggregate_squad_profile(squad.id, db_session)

    assert profile["squad_id"] == squad.id
    assert profile["member_count"] == 3
    # Harmonized pace must accommodate relaxed member Riya
    assert profile["harmonized_pace"] == "relaxed"
    assert "relaxed pacing" in profile["pace_explanation"].lower()

    # Shared passions: Photography (3 members), Food (2 members)
    assert "Photography" in profile["shared_passions"]
    assert "Food" in profile["shared_passions"]

    # Universal exclusions: Must contain dislikes from all 3 members
    exclusion_tags = profile["exclusion_tags"]
    assert "crowded nightlife" in exclusion_tags
    assert "long walking" in exclusion_tags
    assert "generic tourist traps" in exclusion_tags

    # Combined dietary: Seafood and Vegetarian
    assert "Seafood" in profile["combined_dietary"]
    assert "Vegetarian" in profile["combined_dietary"]


def test_squad_profile_api_and_permissions(client: TestClient, db_session: Session):
    owner = User(email="owner_api@dashtiny.ai", full_name="Owner User", password_hash="h", trust_score=95.0)
    stranger = User(email="stranger@dashtiny.ai", full_name="Stranger User", password_hash="h", trust_score=80.0)
    db_session.add_all([owner, stranger])
    db_session.flush()

    trip = Itinerary(
        title="Goa Escape",
        destination="Goa",
        total_budget=30000.0,
        owner_id=owner.id,
        visibility="PUBLIC"
    )
    db_session.add(trip)
    db_session.flush()

    squad = SquadRoom(itinerary_id=trip.id, room_code="SQUAD-GOA99")
    db_session.add(squad)
    db_session.flush()

    m1 = SquadMember(squad_id=squad.id, user_id=owner.id, role="owner")
    db_session.add(m1)
    db_session.commit()

    # Owner can retrieve profile
    with as_user(owner):
        res = client.get(f"/api/v1/squads/{squad.id}/profile")
        assert res.status_code == 200
        data = res.json()
        assert data["squad_id"] == squad.id
        assert data["member_count"] == 1

    # Stranger is rejected with 403 Forbidden
    with as_user(stranger):
        res = client.get(f"/api/v1/squads/{squad.id}/profile")
        assert res.status_code == 403


def test_squad_by_trip_auto_initialization(client: TestClient, db_session: Session):
    owner = User(email="trip_owner_init@dashtiny.ai", full_name="Trip Architect", password_hash="h")
    db_session.add(owner)
    db_session.flush()

    trip = Itinerary(
        title="Jaipur Royal Heritage",
        destination="Jaipur",
        total_budget=40000.0,
        owner_id=owner.id,
        visibility="PUBLIC"
    )
    db_session.add(trip)
    db_session.commit()

    # Trip currently has no SquadRoom. Owner querying /by-trip/{trip_id} should auto-create it
    with as_user(owner):
        res = client.get(f"/api/v1/squads/by-trip/{trip.id}")
        assert res.status_code == 200
        data = res.json()
        assert data["destination"] == "Jaipur"
        assert data["member_count"] == 1
        assert data["members"][0]["user_id"] == owner.id
        assert data["members"][0]["role"] == "owner"


def test_squad_member_role_governance(client: TestClient, db_session: Session):
    owner = User(email="gov_owner@dashtiny.ai", full_name="Gov Owner", password_hash="h")
    member = User(email="gov_member@dashtiny.ai", full_name="Gov Member", password_hash="h")
    db_session.add_all([owner, member])
    db_session.flush()

    trip = Itinerary(title="Hampi Heritage", destination="Hampi", total_budget=15000.0, owner_id=owner.id)
    db_session.add(trip)
    db_session.flush()

    squad = SquadRoom(itinerary_id=trip.id, room_code="SQUAD-HMP01")
    db_session.add(squad)
    db_session.flush()

    m_owner = SquadMember(squad_id=squad.id, user_id=owner.id, role="owner")
    m_member = SquadMember(squad_id=squad.id, user_id=member.id, role="member")
    db_session.add_all([m_owner, m_member])
    db_session.commit()

    # 1. Non-owner cannot promote
    with as_user(member):
        res = client.put(f"/api/v1/squads/{squad.id}/members/{member.id}/role", json={"role": "co_planner"})
        assert res.status_code == 403

    # 2. Owner promotes member to co_planner
    with as_user(owner):
        res = client.put(f"/api/v1/squads/{squad.id}/members/{member.id}/role", json={"role": "co_planner"})
        assert res.status_code == 200
        assert res.json()["new_role"] == "co_planner"

    # 3. Cannot demote owner with this endpoint
    with as_user(owner):
        res = client.put(f"/api/v1/squads/{squad.id}/members/{owner.id}/role", json={"role": "member"})
        assert res.status_code == 400
