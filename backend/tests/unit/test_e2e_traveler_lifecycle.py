import pytest
from app.models.models import (
    User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity,
    TripSnapshot, SquadRoom, SquadMember, TripInterestRequest
)
from app.services.trip_revision_service import serialize_trip_days, get_current_version
from app.api.deps import get_current_user, get_optional_user
from app.main import app

def test_full_traveler_lifecycle_e2e(client, db_session):
    """
    End-to-End Traveler Lifecycle Scenario (Phase 8 QA):
    1. User A (Creator) initializes profile with explicit pace, passions, and dealbreakers.
    2. User A plans and publishes a Goa trip with PUBLIC visibility.
    3. User B (Explorer) initializes compatible profile.
    4. User B discovers User A's Goa trip via Community Feed with high compatibility match.
    5. User B expresses interest to join Squad with a personal note.
    6. User A receives INTEREST_RECEIVED notification and approves User B.
    7. User B receives INTEREST_APPROVED notification and enters Squad Room.
    8. Squad Consensus Radar reflects 2 members with harmonized 'relaxed' pace.
    9. User A promotes User B to 'co_planner'.
    10. User B submits collaborative itinerary suggestion to DAIna.
    11. DAIna synthesizes TripProposal revision; both squad members upvote.
    12. User B (as Co-Planner) accepts suggestion into itinerary, committing revision v2.
    13. Both members receive ITINERARY_REVISED notifications and mark all as read.
    """
    # -------------------------------------------------------------
    # 1. Setup User A (Creator) & User B (Explorer)
    # -------------------------------------------------------------
    user_a = User(
        id="user-a-creator-uuid",
        email="creator.alex@dashtiny.ai",
        full_name="Alex Mercer",
        password_hash="hash"
    )
    user_b = User(
        id="user-b-explorer-uuid",
        email="explorer.maya@dashtiny.ai",
        full_name="Maya Lin",
        password_hash="hash"
    )
    db_session.add_all([user_a, user_b])
    db_session.flush()

    # User A Profile
    profile_a = UserProfile(
        user_id=user_a.id,
        reward_coins=300,
        travel_style="solo",
        pace="relaxed",
        likes=["beaches", "seafood", "photography"],
        dislikes=["crowded_temples", "pilgrimage"],
        food_preferences=["seafood", "local_eats"]
    )
    # User B Profile (Compatible: same pace, shared likes)
    profile_b = UserProfile(
        user_id=user_b.id,
        reward_coins=150,
        travel_style="solo",
        pace="relaxed",
        likes=["beaches", "scuba_diving", "photography"],
        dislikes=["nightclubs"],
        food_preferences=["local_eats"]
    )
    db_session.add_all([profile_a, profile_b])
    db_session.commit()

    # -------------------------------------------------------------
    # 2. User A creates and publishes Goa trip with PUBLIC visibility
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_a
    app.dependency_overrides[get_optional_user] = lambda: user_a

    trip = Itinerary(
        id="goa-trip-e2e-uuid",
        owner_id=user_a.id,
        destination="Goa, India",
        title="Relaxed Coastal Goa Getaway",
        visibility="PUBLIC",
        status="upcoming",
        total_budget=35000,
        currency="INR",
        persona="solo",
        is_public=True
    )
    db_session.add(trip)
    db_session.flush()

    day1 = ItineraryDay(
        id="goa-e2e-day-1",
        itinerary_id=trip.id,
        day_number=1,
        title="Arrival & Beach Sunset"
    )
    db_session.add(day1)
    db_session.flush()

    act1 = ItineraryActivity(
        id="goa-e2e-act-1",
        day_id=day1.id,
        description="Check-in at Coastal Villa and explore beaches",
        location="Anjuna Beach, Goa",
        time_slot="14:00",
        cost_estimate=0,
        sort_order=1
    )
    act2 = ItineraryActivity(
        id="goa-e2e-act-2",
        day_id=day1.id,
        description="Sunset Walk and Photography at Anjuna Beach",
        location="Anjuna Beach, Goa",
        time_slot="17:30",
        cost_estimate=500,
        sort_order=2
    )
    db_session.add_all([act1, act2])
    db_session.flush()

    # Initial Revision Snapshot v1
    snap_v1 = TripSnapshot(
        trip_id=trip.id,
        version=1,
        parent_version=0,
        user_id=user_a.id,
        action="initial_creation",
        action_type="INITIAL_CREATION",
        days_data=serialize_trip_days(trip)
    )
    db_session.add(snap_v1)
    db_session.commit()

    # Publish trip to community feed
    pub_res = client.post("/api/v1/community/posts", json={
        "getaway_title": "Relaxed Coastal Goa Getaway",
        "location": "Goa, India",
        "content": "A serene photography and beach walk trip across North and South Goa.",
        "source_trip_id": trip.id,
        "companions_needed": 2
    })
    assert pub_res.status_code == 200

    # -------------------------------------------------------------
    # 3. User B Discovers Trip in Community Feed with Compatibility Radar
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_b
    app.dependency_overrides[get_optional_user] = lambda: user_b

    feed_res = client.get("/api/v1/community/feed")
    assert feed_res.status_code == 200
    feed_data = feed_res.json()
    assert len(feed_data) >= 1

    # Find User A's Goa trip
    goa_post = next((p for p in feed_data if p.get("source_trip_id") == trip.id), None)
    assert goa_post is not None
    assert goa_post["compatibility_score"] is not None
    # Pace match + shared likes yields high compatibility score >= 70
    assert goa_post["compatibility_score"] >= 70
    assert goa_post["has_dealbreaker"] is False

    # -------------------------------------------------------------
    # 4. User B submits "Show Interest" request to join Squad
    # -------------------------------------------------------------
    interest_res = client.post(
        f"/api/v1/trips/{trip.id}/interest",
        json={"message": "Hey Alex! Love the relaxed pace and photography focus. Would love to join your squad!"}
    )
    assert interest_res.status_code == 200
    interest_data = interest_res.json()
    assert interest_data["status"] == "pending"
    request_id = interest_data["request_id"]

    # -------------------------------------------------------------
    # 5. User A receives Notification & Approves Request
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_a
    app.dependency_overrides[get_optional_user] = lambda: user_a

    # Check notification received
    notif_res = client.get("/api/v1/notifications")
    assert notif_res.status_code == 200
    notif_data = notif_res.json()
    assert notif_data["unread_count"] >= 1
    received_notif = next((n for n in notif_data["notifications"] if n["type"] == "INTEREST_RECEIVED"), None)
    assert received_notif is not None
    assert "Maya Lin" in received_notif["title"] or "Maya Lin" in received_notif["body"]

    # User A approves User B
    respond_res = client.post(
        f"/api/v1/trips/{trip.id}/interest/{request_id}/respond",
        json={"action": "approve"}
    )
    assert respond_res.status_code == 200
    respond_data = respond_res.json()
    assert respond_data["status"] == "approved"

    # Get squad created
    squad = db_session.query(SquadRoom).filter(SquadRoom.itinerary_id == trip.id).first()
    assert squad is not None
    squad_id = squad.id

    # -------------------------------------------------------------
    # 6. User B enters Squad Room and checks Consensus Profile
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_b
    app.dependency_overrides[get_optional_user] = lambda: user_b

    # User B checks approval notification
    b_notif_res = client.get("/api/v1/notifications")
    assert b_notif_res.status_code == 200
    b_notifs = b_notif_res.json()["notifications"]
    assert any(n["type"] == "INTEREST_APPROVED" for n in b_notifs)

    # User B checks Squad Consensus Profile
    squad_prof_res = client.get(f"/api/v1/squads/{squad_id}/profile")
    assert squad_prof_res.status_code == 200
    squad_prof = squad_prof_res.json()
    assert squad_prof["member_count"] == 2
    assert squad_prof["harmonized_pace"] == "relaxed"
    like_names = [item["like"] for item in squad_prof["shared_likes"]]
    assert "beaches" in like_names
    assert "photography" in like_names

    # -------------------------------------------------------------
    # 7. User A promotes User B to Co-Planner
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_a
    app.dependency_overrides[get_optional_user] = lambda: user_a

    promote_res = client.put(
        f"/api/v1/squads/{squad_id}/members/{user_b.id}/role",
        json={"role": "co_planner"}
    )
    assert promote_res.status_code == 200
    promote_data = promote_res.json()
    assert promote_data["new_role"] == "co_planner"

    # -------------------------------------------------------------
    # 8. User B submits collaborative itinerary suggestion to DAIna
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_b
    app.dependency_overrides[get_optional_user] = lambda: user_b

    sug_res = client.post(
        f"/api/v1/squads/{squad_id}/suggestions",
        json={"instruction": "Add a beachside seafood sunset shack dinner at 19:30"}
    )
    assert sug_res.status_code == 201
    sug_data = sug_res.json()
    assert sug_data["status"] == "success"
    suggestion_id = sug_data["suggestion"]["id"]
    assert sug_data["suggestion"]["upvotes"] == 1  # Author auto-upvotes

    # -------------------------------------------------------------
    # 9. User A votes up on User B's suggestion
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_a
    app.dependency_overrides[get_optional_user] = lambda: user_a

    vote_res = client.post(
        f"/api/v1/squads/{squad_id}/suggestions/{suggestion_id}/vote",
        json={"vote": "up"}
    )
    assert vote_res.status_code == 200
    vote_data = vote_res.json()
    assert vote_data["upvotes"] == 2
    assert vote_data["user_vote"] == "up"

    # -------------------------------------------------------------
    # 10. User B (as Co-Planner) accepts suggestion -> commits revision v2
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_b
    app.dependency_overrides[get_optional_user] = lambda: user_b

    accept_res = client.post(f"/api/v1/squads/{squad_id}/suggestions/{suggestion_id}/accept")
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert accept_data["status"] == "success"

    # Verify TripSnapshot v2 exists in DB
    current_v = get_current_version(db_session, trip.id)
    assert current_v == 2

    snap_v2 = db_session.query(TripSnapshot).filter(
        TripSnapshot.trip_id == trip.id,
        TripSnapshot.version == 2
    ).first()
    assert snap_v2 is not None
    assert snap_v2.parent_version == 1

    # -------------------------------------------------------------
    # 11. Verify ITINERARY_REVISED notifications on User A & Mark all read
    # -------------------------------------------------------------
    app.dependency_overrides[get_current_user] = lambda: user_a
    app.dependency_overrides[get_optional_user] = lambda: user_a

    a_notifs_after = client.get("/api/v1/notifications").json()["notifications"]
    revised_notif = next((n for n in a_notifs_after if n["type"] == "ITINERARY_REVISED"), None)
    assert revised_notif is not None
    assert "v2" in revised_notif["title"]

    # Mark all notifications read
    read_all_res = client.post("/api/v1/notifications/read-all")
    assert read_all_res.status_code == 200
    assert read_all_res.json()["unread_count"] == 0

    unread_check = client.get("/api/v1/notifications").json()["unread_count"]
    assert unread_check == 0
