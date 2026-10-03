import pytest
from datetime import date
from starlette.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import User, Itinerary, ItineraryDay, ItineraryActivity, SquadRoom, SquadMember, SquadExpense, CommunityPost, PostLike


def test_squad_crud_membership_and_summary_math(client: TestClient, db_session: Session, test_user):
    """
    Item 15 & 23:
    Full real Squad API lifecycle:
    - POST /squads creates room and assigns owner
    - POST /squads/{id}/members adds member
    - POST /squads/{id}/expenses records expenses
    - GET /squads/{id}/summary calculates exact total spent, per-person share, and balances
    - Reject negative expenses
    """
    trip = Itinerary(
        title="Goa Squad Trip",
        destination="Goa",
        owner_id=test_user.id,
        total_budget=60000.0,
        currency="INR",
        start_date=date(2026, 11, 20),
        end_date=date(2026, 11, 23)
    )
    db_session.add(trip)
    db_session.commit()

    # 1. Create squad
    sq_res = client.post("/api/v1/squads", json={"itinerary_id": trip.id})
    assert sq_res.status_code == 201, sq_res.text
    squad_id = sq_res.json()["squad_id"]

    # Create companion user
    companion = User(
        email="companion_goa@example.com",
        full_name="Priya Sharma",
        password_hash="hashed_companion",
        account_type="personal_traveler"
    )
    db_session.add(companion)
    db_session.commit()

    # 2. Add member
    add_m_res = client.post(f"/api/v1/squads/{squad_id}/members", json={
        "user_id": companion.id,
        "role": "member"
    })
    assert add_m_res.status_code == 201

    # 3. Add expense by test_user: ₹6,000 for villa
    exp1_res = client.post(f"/api/v1/squads/{squad_id}/expenses", json={
        "description": "Beachfront Villa Deposit",
        "amount": 6000.0,
        "category": "stay",
        "paid_by_user_id": test_user.id
    })
    assert exp1_res.status_code == 201

    # 4. Add expense by companion: ₹2,000 for dinner
    exp2_res = client.post(f"/api/v1/squads/{squad_id}/expenses", json={
        "description": "Seafood Dinner",
        "amount": 2000.0,
        "category": "food",
        "paid_by_user_id": companion.id
    })
    assert exp2_res.status_code == 201

    # 5. Get summary: total = 8000, 2 members, share = 4000
    # test_user paid 6000 -> balance = +2000
    # companion paid 2000 -> balance = -2000
    sum_res = client.get(f"/api/v1/squads/{squad_id}/summary")
    assert sum_res.status_code == 200
    s_data = sum_res.json()
    assert s_data["total_spent"] == 8000.0
    assert s_data["member_count"] == 2
    assert s_data["per_person_share"] == 4000.0

    members = {m["id"]: m for m in s_data["members"]}
    assert members[test_user.id]["paid"] == 6000.0
    assert members[test_user.id]["balance"] == 2000.0
    assert members[companion.id]["paid"] == 2000.0
    assert members[companion.id]["balance"] == -2000.0


def test_squad_rejects_negative_and_zero_expense(client: TestClient, db_session: Session, test_user):
    """
    Item 15: Squad expenses must strictly reject amounts <= 0.
    """
    trip = Itinerary(
        title="Zero Expense Trip",
        destination="Jaipur",
        owner_id=test_user.id,
        total_budget=20000.0,
        currency="INR",
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 3)
    )
    db_session.add(trip)
    db_session.commit()

    sq = SquadRoom(itinerary_id=trip.id, room_code="JAI-TEST")
    db_session.add(sq)
    db_session.flush()
    db_session.add(SquadMember(squad_id=sq.id, user_id=test_user.id, role="owner"))
    db_session.commit()

    # Negative amount
    res_neg = client.post(f"/api/v1/squads/{sq.id}/expenses", json={
        "description": "Fraudulent refund",
        "amount": -500.0,
        "category": "transit"
    })
    assert res_neg.status_code in [400, 422]

    # Zero amount
    res_zero = client.post(f"/api/v1/squads/{sq.id}/expenses", json={
        "description": "Zero cost",
        "amount": 0.0,
        "category": "transit"
    })
    assert res_zero.status_code in [400, 422]


def test_community_fork_private_ownership(client: TestClient, db_session: Session, test_user):
    """
    Item 16 & 23:
    Forking a public community post:
    - Creates a new trip owned by test_user
    - New trip is private (is_public=False)
    - Original author and source trip remain distinct
    """
    author = User(
        email="author_curator@example.com",
        full_name="Curator Explorer",
        password_hash="hashed_author",
        account_type="personal_traveler"
    )
    db_session.add(author)
    db_session.commit()

    source_trip = Itinerary(
        title="Curator's Magical Manali Itinerary",
        destination="Manali",
        owner_id=author.id,
        total_budget=35000.0,
        currency="INR",
        start_date=date(2026, 12, 10),
        end_date=date(2026, 12, 14),
        is_public=True
    )
    db_session.add(source_trip)
    db_session.commit()

    day1 = ItineraryDay(itinerary_id=source_trip.id, day_number=1, title="Arrival in Solang")
    db_session.add(day1)
    db_session.commit()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="10:00 AM",
        description="Solang Valley Paragliding",
        location="Solang Valley",
        place_type="TA",
        cost_estimate=3200.0,
        sort_order=0
    )
    db_session.add(act1)
    db_session.commit()

    post = CommunityPost(
        author_id=author.id,
        source_trip_id=source_trip.id,
        author_name=author.full_name,
        author_avatar="https://example.com/avatar.jpg",
        image_url="https://example.com/cover.jpg",
        getaway_title="Epic Solang Paragliding Getaway",
        location="Manali, HP",
        content="Amazing experience flying over the valley!"
    )
    db_session.add(post)
    db_session.commit()

    # test_user forks this post
    fork_res = client.post(f"/api/v1/community/posts/{post.id}/fork")
    assert fork_res.status_code == 201, fork_res.text
    fork_data = fork_res.json()

    assert fork_data["status"] == "success"
    new_trip_id = fork_data["new_trip_id"]

    # Verify new trip in DB
    db_session.expire_all()
    new_trip = db_session.query(Itinerary).filter(Itinerary.id == new_trip_id).first()
    assert new_trip is not None
    assert new_trip.owner_id == test_user.id
    assert new_trip.is_public is False
    assert new_trip.destination == "Manali"
    assert len(new_trip.days) == 1
    assert len(new_trip.days[0].activities) == 1
    assert "Paragliding" in new_trip.days[0].activities[0].description
