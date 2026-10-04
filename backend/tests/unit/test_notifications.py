import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.models import (
    User, Itinerary, ItineraryDay, ItineraryActivity,
    SquadRoom, SquadMember, Notification, Friendship, TripInterestRequest
)
from app.api.v1.auth import get_current_user
from app.services.trip_revision_service import record_initial_revision
from app.services.notification_service import NotificationService


def as_user(user_obj):
    class UserOverrideContext:
        def __enter__(self):
            app.dependency_overrides[get_current_user] = lambda: user_obj
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            app.dependency_overrides.pop(get_current_user, None)

    return UserOverrideContext()


def test_notification_listing_and_read_endpoints(client: TestClient, db_session: Session):
    u1 = User(email="notif_user1@dashtiny.ai", full_name="Aarav Notif", password_hash="h1")
    u2 = User(email="notif_user2@dashtiny.ai", full_name="Riya Other", password_hash="h2")
    db_session.add_all([u1, u2])
    db_session.flush()

    n1 = Notification(
        user_id=u1.id,
        type="INTEREST_RECEIVED",
        title="New Interest Request",
        body="Riya wants to join your trip.",
        is_read=False
    )
    n2 = Notification(
        user_id=u1.id,
        type="FRIEND_REQUEST",
        title="New Friend Request",
        body="Riya sent you a friend request.",
        is_read=False
    )
    n3 = Notification(
        user_id=u1.id,
        type="ITINERARY_REVISED",
        title="Itinerary Updated",
        body="Version 2 was committed.",
        is_read=True
    )
    # Notification for other user
    n_other = Notification(
        user_id=u2.id,
        type="SQUAD_INVITATION",
        title="Squad Invite",
        body="Secret invite for u2",
        is_read=False
    )
    db_session.add_all([n1, n2, n3, n_other])
    db_session.commit()

    with as_user(u1):
        # 1. List all notifications for u1
        resp = client.get("/api/v1/notifications")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_count"] == 3
        assert data["unread_count"] == 2
        notif_ids = [n["id"] for n in data["notifications"]]
        assert n1.id in notif_ids
        assert n_other.id not in notif_ids

        # 2. Filter unread only
        resp_unread = client.get("/api/v1/notifications?unread_only=true")
        assert resp_unread.status_code == 200
        unread_data = resp_unread.json()
        assert unread_data["total_count"] == 2
        assert all(n["is_read"] is False for n in unread_data["notifications"])

        # 3. Mark single notification as read
        resp_read = client.post(f"/api/v1/notifications/{n1.id}/read")
        assert resp_read.status_code == 200
        assert resp_read.json()["is_read"] is True
        assert resp_read.json()["unread_count"] == 1

        # 4. Mark all read
        resp_all = client.post("/api/v1/notifications/read-all")
        assert resp_all.status_code == 200
        assert resp_all.json()["unread_count"] == 0

        # Verify all are read
        resp_after = client.get("/api/v1/notifications")
        assert resp_after.json()["unread_count"] == 0


def test_cannot_read_or_delete_other_users_notification(client: TestClient, db_session: Session):
    u1 = User(email="owner_notif@dashtiny.ai", full_name="Owner", password_hash="h1")
    u2 = User(email="intruder@dashtiny.ai", full_name="Intruder", password_hash="h2")
    db_session.add_all([u1, u2])
    db_session.flush()

    n = Notification(
        user_id=u1.id,
        type="INTEREST_RECEIVED",
        title="Private Notice",
        body="Private details for u1.",
        is_read=False
    )
    db_session.add(n)
    db_session.commit()

    with as_user(u2):
        resp = client.post(f"/api/v1/notifications/{n.id}/read")
        assert resp.status_code == 404

        del_resp = client.delete(f"/api/v1/notifications/{n.id}")
        assert del_resp.status_code == 404


def test_friend_request_triggers_notifications(client: TestClient, db_session: Session):
    sender = User(email="sender_fr@dashtiny.ai", full_name="Sender Explorer", password_hash="h1")
    recipient = User(email="recipient_fr@dashtiny.ai", full_name="Recipient Explorer", password_hash="h2")
    db_session.add_all([sender, recipient])
    db_session.commit()

    # Sender sends friend request
    with as_user(sender):
        send_resp = client.post(
            "/api/v1/friends/request",
            json={"friend_id": recipient.id}
        )
        assert send_resp.status_code == 200
        req_id = send_resp.json()["request_id"]

    # Verify recipient received notification
    notif = db_session.query(Notification).filter(
        Notification.user_id == recipient.id,
        Notification.type == "FRIEND_REQUEST"
    ).first()
    assert notif is not None
    assert "Sender Explorer" in notif.body

    # Recipient accepts friend request
    with as_user(recipient):
        resp_acc = client.post(
            f"/api/v1/friends/requests/{req_id}/respond",
            json={"action": "accept"}
        )
        assert resp_acc.status_code == 200

    # Verify sender received FRIEND_ACCEPTED notification
    accepted_notif = db_session.query(Notification).filter(
        Notification.user_id == sender.id,
        Notification.type == "FRIEND_ACCEPTED"
    ).first()
    assert accepted_notif is not None
    assert "Recipient Explorer" in accepted_notif.body


def test_trip_interest_and_squad_suggestion_triggers_notifications(client: TestClient, db_session: Session):
    owner = User(email="trip_owner_notif@dashtiny.ai", full_name="Aarav Owner", password_hash="h1")
    applicant = User(email="trip_applicant_notif@dashtiny.ai", full_name="Riya Applicant", password_hash="h2")
    db_session.add_all([owner, applicant])
    db_session.flush()

    trip = Itinerary(
        title="Kerala Backwaters Expedition",
        destination="Kerala",
        total_budget=35000.0,
        owner_id=owner.id,
        visibility="PUBLIC"
    )
    db_session.add(trip)
    db_session.flush()

    day1 = ItineraryDay(itinerary_id=trip.id, day_number=1, title="Arrival")
    db_session.add(day1)
    db_session.flush()

    act1 = ItineraryActivity(
        day_id=day1.id,
        time_slot="10:00 AM",
        description="Houseboat Cruise",
        location="Alleppey",
        place_type="TA",
        cost_estimate=2000,
        sort_order=0
    )
    db_session.add(act1)
    db_session.flush()

    record_initial_revision(db_session, trip.id, owner.id)

    # 1. Applicant expresses interest
    with as_user(applicant):
        int_resp = client.post(
            f"/api/v1/trips/{trip.id}/interest",
            json={"message": "I love photography and Kerala sunsets!"}
        )
        assert int_resp.status_code == 200
        req_id = int_resp.json()["request_id"]

    # Verify owner received INTEREST_RECEIVED notification
    owner_notif = db_session.query(Notification).filter(
        Notification.user_id == owner.id,
        Notification.type == "INTEREST_RECEIVED"
    ).first()
    assert owner_notif is not None
    assert "Riya Applicant" in owner_notif.body

    # 2. Owner approves applicant
    with as_user(owner):
        appr_resp = client.post(
            f"/api/v1/trips/{trip.id}/interest/{req_id}/respond",
            json={"action": "approve"}
        )
        assert appr_resp.status_code == 200

    # Verify applicant received INTEREST_APPROVED notification
    appr_notif = db_session.query(Notification).filter(
        Notification.user_id == applicant.id,
        Notification.type == "INTEREST_APPROVED"
    ).first()
    assert appr_notif is not None
    assert "approved to join the squad" in appr_notif.body

    # 3. Squad room now has owner and applicant. Applicant suggests an itinerary change
    squad = db_session.query(SquadRoom).filter(SquadRoom.itinerary_id == trip.id).first()
    assert squad is not None

    with as_user(applicant):
        sug_resp = client.post(
            f"/api/v1/squads/{squad.id}/suggestions",
            json={"instruction": "Move beach visit to sunset"}
        )
        assert sug_resp.status_code == 201
        sug_id = sug_resp.json()["suggestion"]["id"]

    # Verify owner received SQUAD_SUGGESTION_CREATED notification
    sug_notif = db_session.query(Notification).filter(
        Notification.user_id == owner.id,
        Notification.type == "SQUAD_SUGGESTION_CREATED"
    ).first()
    assert sug_notif is not None
    assert "Move beach visit to sunset" in sug_notif.body

    # 4. Owner accepts suggestion into canonical itinerary
    with as_user(owner):
        acc_resp = client.post(f"/api/v1/squads/{squad.id}/suggestions/{sug_id}/accept")
        assert acc_resp.status_code == 200

    # Verify applicant received ITINERARY_REVISED notification
    rev_notif = db_session.query(Notification).filter(
        Notification.user_id == applicant.id,
        Notification.type == "ITINERARY_REVISED"
    ).first()
    assert rev_notif is not None
    assert "Revision v2" in rev_notif.title
