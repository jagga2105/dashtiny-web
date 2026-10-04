import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.models import (
    User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity,
    SquadRoom, SquadMember, SquadSuggestion, SquadVote, TripProposal
)
from app.api.v1.auth import get_current_user
from app.services.trip_revision_service import record_initial_revision, get_current_version


def as_user(user_obj):
    class UserOverrideContext:
        def __enter__(self):
            app.dependency_overrides[get_current_user] = lambda: user_obj
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            app.dependency_overrides.pop(get_current_user, None)

    return UserOverrideContext()


@pytest.fixture
def setup_squad_with_itinerary(db_session: Session):
    owner = User(
        email="owner_squad@dashtiny.ai",
        full_name="Aarav Owner",
        password_hash="pw1",
        trust_score=95.0,
        is_verified=True
    )
    coplanner = User(
        email="coplanner_squad@dashtiny.ai",
        full_name="Riya CoPlanner",
        password_hash="pw2",
        trust_score=90.0,
        is_verified=True
    )
    member = User(
        email="member_squad@dashtiny.ai",
        full_name="Kabir Explorer",
        password_hash="pw3",
        trust_score=85.0,
        is_verified=False
    )
    outsider = User(
        email="outsider_squad@dashtiny.ai",
        full_name="Stranded Explorer",
        password_hash="pw4",
        trust_score=50.0,
        is_verified=False
    )
    db_session.add_all([owner, coplanner, member, outsider])
    db_session.flush()

    trip = Itinerary(
        title="Goa Coastal Squad Getaway",
        destination="Goa",
        total_budget=40000.0,
        owner_id=owner.id,
        visibility="PUBLIC"
    )
    db_session.add(trip)
    db_session.flush()

    day1 = ItineraryDay(
        itinerary_id=trip.id,
        day_number=1,
        title="Arrival & Beach Vibes"
    )
    db_session.add(day1)
    db_session.flush()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="10:00 AM",
        description="Check-in at Beachfront Villa",
        location="Anjuna",
        place_type="H",
        cost_estimate=0,
        sort_order=0
    )
    act2 = ItineraryActivity(
        day_id=day1.id,
        time_slot="02:00 PM",
        description="High intensity afternoon cliff trek",
        location="Vagator",
        place_type="TA",
        cost_estimate=500,
        sort_order=1
    )
    db_session.add_all([act1, act2])
    db_session.flush()

    # Record baseline revision v1
    record_initial_revision(db_session, trip.id, owner.id)

    squad = SquadRoom(itinerary_id=trip.id, room_code="SQUAD-GOA01")
    db_session.add(squad)
    db_session.flush()

    m_owner = SquadMember(squad_id=squad.id, user_id=owner.id, role="owner")
    m_co = SquadMember(squad_id=squad.id, user_id=coplanner.id, role="co_planner")
    m_mem = SquadMember(squad_id=squad.id, user_id=member.id, role="member")
    db_session.add_all([m_owner, m_co, m_mem])
    db_session.commit()

    return {
        "owner": owner,
        "coplanner": coplanner,
        "member": member,
        "outsider": outsider,
        "trip": trip,
        "squad": squad
    }


def test_create_squad_suggestion_with_daina_proposal(client: TestClient, setup_squad_with_itinerary, db_session: Session):
    data = setup_squad_with_itinerary
    squad = data["squad"]
    member = data["member"]

    with as_user(member):
        resp = client.post(
            f"/api/v1/squads/{squad.id}/suggestions",
            json={"instruction": "Make day 1 less tiring and add private villa chill"}
        )

    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "success"
    suggestion = body["suggestion"]
    assert suggestion["squad_id"] == squad.id
    assert suggestion["user_id"] == member.id
    assert suggestion["author_name"] == "Kabir Explorer"
    assert suggestion["proposal_id"] is not None
    assert suggestion["upvotes"] == 1  # Author auto-upvotes
    assert suggestion["user_vote"] == "up"
    assert len(suggestion["changes_diff"]) > 0

    # Verify persisted in database
    db_suggestion = db_session.query(SquadSuggestion).filter(SquadSuggestion.id == suggestion["id"]).first()
    assert db_suggestion is not None
    assert db_suggestion.status == "proposal_generated"


def test_outsider_cannot_create_suggestion(client: TestClient, setup_squad_with_itinerary):
    data = setup_squad_with_itinerary
    squad = data["squad"]
    outsider = data["outsider"]

    with as_user(outsider):
        resp = client.post(
            f"/api/v1/squads/{squad.id}/suggestions",
            json={"instruction": "Let's change destination to Mumbai"}
        )

    assert resp.status_code == 403


def test_squad_member_voting(client: TestClient, setup_squad_with_itinerary, db_session: Session):
    data = setup_squad_with_itinerary
    squad = data["squad"]
    member = data["member"]
    coplanner = data["coplanner"]
    owner = data["owner"]

    # Member creates suggestion
    with as_user(member):
        create_resp = client.post(
            f"/api/v1/squads/{squad.id}/suggestions",
            json={"instruction": "Move beach visit to sunset"}
        )
    assert create_resp.status_code == 201
    sug_id = create_resp.json()["suggestion"]["id"]

    # Co-planner upvotes
    with as_user(coplanner):
        vote_resp = client.post(
            f"/api/v1/squads/{squad.id}/suggestions/{sug_id}/vote",
            json={"vote": "up"}
        )
    assert vote_resp.status_code == 200
    assert vote_resp.json()["upvotes"] == 2
    assert vote_resp.json()["downvotes"] == 0
    assert vote_resp.json()["user_vote"] == "up"

    # Owner downvotes
    with as_user(owner):
        vote_resp2 = client.post(
            f"/api/v1/squads/{squad.id}/suggestions/{sug_id}/vote",
            json={"vote": "down"}
        )
    assert vote_resp2.status_code == 200
    assert vote_resp2.json()["upvotes"] == 2
    assert vote_resp2.json()["downvotes"] == 1

    # Check listing includes vote counts and current user's vote
    with as_user(owner):
        list_resp = client.get(f"/api/v1/squads/{squad.id}/suggestions")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["id"] == sug_id
    assert items[0]["upvotes"] == 2
    assert items[0]["downvotes"] == 1
    assert items[0]["user_vote"] == "down"


def test_regular_member_cannot_accept_suggestion(client: TestClient, setup_squad_with_itinerary):
    data = setup_squad_with_itinerary
    squad = data["squad"]
    member = data["member"]

    # Member creates suggestion
    with as_user(member):
        create_resp = client.post(
            f"/api/v1/squads/{squad.id}/suggestions",
            json={"instruction": "Move beach visit to sunset"}
        )
    sug_id = create_resp.json()["suggestion"]["id"]

    # Member attempts to accept into itinerary -> Forbidden!
    with as_user(member):
        acc_resp = client.post(f"/api/v1/squads/{squad.id}/suggestions/{sug_id}/accept")
    assert acc_resp.status_code == 403
    assert "Only the squad owner, co-planners, or trip owner" in acc_resp.json()["detail"]


def test_coplanner_or_owner_can_accept_suggestion_and_increments_revision(
    client: TestClient, setup_squad_with_itinerary, db_session: Session
):
    data = setup_squad_with_itinerary
    squad = data["squad"]
    member = data["member"]
    coplanner = data["coplanner"]
    trip = data["trip"]

    # Baseline version should be 1
    assert get_current_version(db_session, trip.id) == 1

    # Member creates suggestion
    with as_user(member):
        create_resp = client.post(
            f"/api/v1/squads/{squad.id}/suggestions",
            json={"instruction": "Make day 1 less tiring"}
        )
    sug_id = create_resp.json()["suggestion"]["id"]

    # Co-planner accepts suggestion into canonical itinerary
    with as_user(coplanner):
        acc_resp = client.post(f"/api/v1/squads/{squad.id}/suggestions/{sug_id}/accept")

    assert acc_resp.status_code == 200
    acc_body = acc_resp.json()
    assert acc_body["status"] == "success"

    # Verify version has incremented to 2
    assert get_current_version(db_session, trip.id) == 2

    # Verify suggestion status updated to accepted
    db_sug = db_session.query(SquadSuggestion).filter(SquadSuggestion.id == sug_id).first()
    assert db_sug.status == "accepted"

    # Cannot accept twice
    with as_user(coplanner):
        acc_resp_dup = client.post(f"/api/v1/squads/{squad.id}/suggestions/{sug_id}/accept")
    assert acc_resp_dup.status_code == 400


def test_reject_suggestion(client: TestClient, setup_squad_with_itinerary, db_session: Session):
    data = setup_squad_with_itinerary
    squad = data["squad"]
    member = data["member"]

    with as_user(member):
        create_resp = client.post(
            f"/api/v1/squads/{squad.id}/suggestions",
            json={"instruction": "Move beach visit to sunset"}
        )
        sug_id = create_resp.json()["suggestion"]["id"]

        # Author rejects/cancels own suggestion
        rej_resp = client.post(f"/api/v1/squads/{squad.id}/suggestions/{sug_id}/reject")
        assert rej_resp.status_code == 200

    db_sug = db_session.query(SquadSuggestion).filter(SquadSuggestion.id == sug_id).first()
    assert db_sug.status == "rejected"
