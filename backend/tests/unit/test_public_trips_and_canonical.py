import uuid
import pytest
from datetime import date
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, CommunityPost, UserProfile, User

def test_canonical_trip_summary_in_my_trips(client, db_session, test_user):
    """
    Verify /trips/my-trips returns the canonical TripSummary attributes:
    origin, travellers, vibe, is_public, source_trip_id, bookingsCount, daysCount
    """
    trip = Itinerary(
        id="canonical-trip-1",
        owner_id=test_user.id,
        title="Delhi to Tokyo Expedition",
        destination="Tokyo",
        origin="DEL",
        travellers=4,
        vibe="adventure",
        status="active",
        is_public=False,
        total_budget=120000.0,
        currency="INR",
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 6)
    )
    db_session.add(trip)
    db_session.commit()

    resp = client.get("/api/v1/trips/my-trips")
    assert resp.status_code == 200
    trips = resp.json()
    assert len(trips) >= 1
    found = next((t for t in trips if t["id"] == "canonical-trip-1"), None)
    assert found is not None
    assert found["origin"] == "DEL"
    assert found["travellers"] == 4
    assert found["vibe"] == "adventure"
    assert found["status"] == "active"
    assert found["is_public"] is False
    assert found["destination"] == "Tokyo"
    assert "bookingsCount" in found
    assert "daysCount" in found

def test_private_trip_cannot_be_accessed_via_public_endpoint(client, db_session, test_user):
    """
    Verify /trips/{trip_id}/public returns 404 for an unpublished / private trip,
    protecting traveler privacy against arbitrary UUID scraping.
    """
    private_trip = Itinerary(
        id="private-trip-secret-uuid",
        owner_id=test_user.id,
        title="Private Family Vacation",
        destination="Switzerland",
        origin="BOM",
        travellers=3,
        status="active",
        is_public=False,
        total_budget=200000.0,
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 10)
    )
    db_session.add(private_trip)
    db_session.commit()

    resp = client.get(f"/api/v1/trips/{private_trip.id}/public")
    assert resp.status_code == 404
    assert "not found or not published to community" in resp.json()["detail"].lower()

def test_fuzzy_destination_substring_does_not_leak_snapshots(client):
    """
    Verify that querying with fuzzy strings like 'kyoto' or 'goa' does NOT match
    hardcoded snapshots by destination substring. Only exact IDs are valid.
    """
    resp_kyoto = client.get("/api/v1/trips/kyoto/public")
    assert resp_kyoto.status_code == 404

    resp_goa = client.get("/api/v1/trips/goa/public")
    assert resp_goa.status_code == 404

def test_community_publish_links_source_trip_and_makes_public(client, db_session, test_user):
    """
    Verify that creating a CommunityPost with source_trip_id:
    1. Sets is_public = True on the Itinerary in the database
    2. Attaches author_id and source_trip_id to the CommunityPost
    3. Allows GET /trips/{trip_id}/public to serve the trip
    4. Serializes ItineraryActivity ORM objects safely without AttributeError
    """
    trip = Itinerary(
        id="published-trip-999",
        owner_id=test_user.id,
        title="Kyoto Zen Gardens & Kaiseki",
        destination="Kyoto",
        origin="DEL",
        travellers=2,
        vibe="cultural & relaxed",
        total_budget=85000.0,
        currency="INR",
        start_date=date(2026, 11, 10),
        end_date=date(2026, 11, 14),
        is_public=False
    )
    db_session.add(trip)
    db_session.flush()

    day1 = ItineraryDay(
        id="day-1-999",
        itinerary_id=trip.id,
        day_number=1,
        title="Arrival & Gion Lanterns"
    )
    db_session.add(day1)
    db_session.flush()

    act1 = ItineraryActivity(
        id="act-1-999",
        day_id=day1.id,
        time_slot="18:00 - 20:00",
        description="Gion Evening Walk",
        location="Gion",
        sort_order=1
    )
    db_session.add(act1)
    db_session.commit()

    # Pre-condition: public endpoint should 404 prior to community publishing
    resp_pre = client.get(f"/api/v1/trips/{trip.id}/public")
    assert resp_pre.status_code == 404

    # Publish to community
    post_payload = {
        "getaway_title": "Unforgettable Kyoto Highlights",
        "location": "Kyoto, Japan",
        "content": "A serene 4-day escape through Arashiyama and Gion temples.",
        "image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e",
        "companions_needed": 2,
        "source_trip_id": trip.id
    }
    publish_resp = client.post("/api/v1/community/posts", json=post_payload)
    assert publish_resp.status_code == 200
    post_data = publish_resp.json()
    assert post_data["source_trip_id"] == trip.id
    assert post_data["author_id"] == test_user.id

    # Verify database was updated
    db_session.refresh(trip)
    assert trip.is_public is True

    # Now public endpoint should succeed and serialize ItineraryActivity ORM objects cleanly
    pub_resp = client.get(f"/api/v1/trips/{trip.id}/public")
    assert pub_resp.status_code == 200
    pub_data = pub_resp.json()
    assert pub_data["id"] == trip.id
    assert pub_data["destination"] == "Kyoto"
    assert pub_data["author"] == test_user.full_name
    assert len(pub_data["stops"]) == 1
    stop = pub_data["stops"][0]
    assert stop["title"] == "Gion Evening Walk"
    assert stop["day"] == 1

def test_community_feed_contains_canonical_card_fields(client, db_session, test_user):
    """
    Verify GET /community/feed returns canonical CommunityTripCard fields:
    source_trip_id, duration, budget_est, trip_style, is_trip_completed
    """
    post = CommunityPost(
        id="feed-post-1",
        author_name="Kavya Iyer",
        author_avatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330",
        trust_score="94% Verified",
        getaway_title="Backpacking South Goa",
        location="Goa, India",
        image_url="https://images.unsplash.com/photo-1512343879784-a960bf40e7f2",
        content="Hidden cliffs and pristine turtle beaches in South Goa.",
        companions_needed=1,
        source_trip_id="goa-trip-uuid",
        likes_count=12
    )
    db_session.add(post)
    db_session.commit()

    resp = client.get("/api/v1/community/feed")
    assert resp.status_code == 200
    feed = resp.json()
    found = next((p for p in feed if p["id"] == "feed-post-1"), None)
    assert found is not None
    assert found["source_trip_id"] == "goa-trip-uuid"
    assert "duration" in found
    assert "budget_est" in found
    assert "trip_style" in found
    assert "is_trip_completed" in found

def test_booking_create_returns_server_authoritative_coins(client, db_session, test_user):
    """
    Verify POST /bookings/create returns total_coins and increments profile balance correctly.
    """
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    if not profile:
        profile = UserProfile(user_id=test_user.id, reward_coins=100)
        db_session.add(profile)
        db_session.commit()
    else:
        profile.reward_coins = 100
        db_session.commit()

    booking_payload = {
        "category": "flight",
        "provider": "Skyscanner",
        "title": "DEL -> HND Indigo 6E-101",
        "amount": 28500.0,
        "currency": "INR",
        "booking_url": "https://skyscanner.com/book/123",
        "pnr_ref": "6E-XYZ987"
    }
    resp = client.post("/api/v1/bookings/create", json=booking_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_coins" in data
    assert data["total_coins"] == 150  # 100 + 50 reward
    assert data["coins_earned"] == 50

def test_community_like_does_not_award_fake_coins(client, db_session, test_user):
    """
    Verify liking a community post increases likes_count on post
    but does NOT inflate or award coins to user profile.
    """
    post = CommunityPost(
        id="likeable-post-1",
        author_name="Rohan Mehta",
        author_avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        trust_score="92% Verified",
        getaway_title="Tokyo Hidden Ramen Spots",
        location="Tokyo, Japan",
        image_url="https://images.unsplash.com/photo-1503899036084-c55cdd92da26",
        content="The best tsukemen tucked away in Shinjuku alleys.",
        likes_count=5
    )
    db_session.add(post)
    db_session.commit()

    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    initial_coins = profile.reward_coins if profile else 0

    resp = client.post(f"/api/v1/community/posts/{post.id}/like")
    assert resp.status_code == 200
    data = resp.json()
    assert data["likes_count"] == 6

    # Refresh profile and verify no fake coins were credited
    if profile:
        db_session.refresh(profile)
        assert profile.reward_coins == initial_coins

def test_community_feed_truthful_identity_verification(client, db_session, test_user):
    """
    Verify /community/feed only returns is_identity_verified=True when User.is_verified is genuinely True.
    """
    test_user.is_verified = False
    db_session.commit()

    post = CommunityPost(
        id="unverified-author-post",
        author_id=test_user.id,
        author_name=test_user.full_name,
        author_avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        trust_score="90% Explorer",
        getaway_title="Manali Mountain Trek",
        location="Manali, India",
        image_url="https://images.unsplash.com/photo-1503899036084-c55cdd92da26",
        content="Quiet trails above Old Manali.",
        likes_count=12
    )
    db_session.add(post)
    db_session.commit()

    resp = client.get("/api/v1/community/feed")
    assert resp.status_code == 200
    feed = resp.json()
    found = next((p for p in feed if p["id"] == "unverified-author-post"), None)
    assert found is not None
    assert found["is_identity_verified"] is False

    # Now verify the user and check again
    test_user.is_verified = True
    db_session.commit()

    resp2 = client.get("/api/v1/community/feed")
    assert resp2.status_code == 200
    feed2 = resp2.json()
    found2 = next((p for p in feed2 if p["id"] == "unverified-author-post"), None)
    assert found2 is not None
    assert found2["is_identity_verified"] is True


def test_community_feed_trust_data_derived_from_user_record(client, db_session):
    """
    Verify community trust data is normalized:
    1. Does not store or rely on a static formatted trust string on CommunityPost.
    2. Derives trust_score and is_identity_verified dynamically from author User record.
    3. When author's User.trust_score or User.is_verified changes, feed reflects changes immediately.
    """
    author = User(
        email=f"author_{uuid.uuid4().hex[:6]}@dashtiny.ai",
        full_name="Aarav Sharma",
        trust_score=92.0,
        is_verified=False
    )
    db_session.add(author)
    db_session.commit()

    post = CommunityPost(
        id=f"post-{uuid.uuid4().hex[:6]}",
        author_id=author.id,
        author_name=author.full_name,
        author_avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb",
        getaway_title="Coorg Coffee Estate Escape",
        location="Coorg, Karnataka",
        image_url="https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
        content="Serene walking through organic Robusta plantations.",
        likes_count=10
    )
    db_session.add(post)
    db_session.commit()

    # Initial feed state: unverified author with 92% trust score
    res1 = client.get("/api/v1/community/feed")
    assert res1.status_code == 200
    feed1 = res1.json()
    card1 = next((p for p in feed1 if p["id"] == post.id), None)
    assert card1 is not None
    assert card1["author_id"] == author.id
    assert card1["is_identity_verified"] is False
    assert card1["author_trust_score"] == 92.0
    assert card1["trust_score"] == "92% Explorer"
    assert card1["author_name"] == "Aarav Sharma"

    # Update User record in database (verify, change trust_score to 84.0, update full_name)
    author.trust_score = 84.0
    author.is_verified = True
    author.full_name = "Aarav Sharma (Verified)"
    db_session.commit()

    # Second feed fetch: values MUST come from current User record without altering post
    res2 = client.get("/api/v1/community/feed")
    assert res2.status_code == 200
    feed2 = res2.json()
    card2 = next((p for p in feed2 if p["id"] == post.id), None)
    assert card2 is not None
    assert card2["is_identity_verified"] is True
    assert card2["author_trust_score"] == 84.0
    assert card2["trust_score"] == "84% Verified Explorer"
    assert card2["author_name"] == "Aarav Sharma (Verified)"

def test_server_side_trip_undo(client, db_session, test_user):
    """
    Verify server-side undo:
    1. AI query modifies trip and persists a TripSnapshot
    2. POST /trips/{trip_id}/undo restores the exact activities from before the AI query
    3. Consecutive or invalid undo returns 400
    """
    trip = Itinerary(
        id="undo-test-trip-1",
        owner_id=test_user.id,
        title="Jaipur Heritage Tour",
        destination="Jaipur",
        origin="DEL",
        travellers=2,
        total_budget=45000.0,
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 3)
    )
    db_session.add(trip)
    db_session.commit()

    day = ItineraryDay(
        id="undo-day-1",
        itinerary_id=trip.id,
        day_number=1,
        title="Day 1 Forts"
    )
    db_session.add(day)
    db_session.commit()

    initial_act = ItineraryActivity(
        id="initial-amber-fort",
        day_id=day.id,
        time_slot="09:00 AM",
        description="Visit Amber Fort & Elephant Sanctuary",
        location="Amber Fort, Jaipur",
        place_type="TA",
        cost_estimate=1200.0,
        sort_order=0
    )
    db_session.add(initial_act)
    db_session.commit()

    # Record authoritative initial revision v1
    from app.services.trip_revision_service import record_initial_revision
    record_initial_revision(db_session, trip.id, test_user.id)
    db_session.commit()

    # Generate proposal via /ai/query wrapper (trip remains unchanged)
    ai_resp = client.post("/api/v1/ai/query", json={
        "trip_id": trip.id,
        "instruction": "Move the fort visit to sunset"
    })
    assert ai_resp.status_code == 200
    ai_data = ai_resp.json()
    assert len(ai_data["changes"]) > 0
    prop_id = ai_data["proposal_id"]

    # Verify trip was NOT yet mutated
    acts_before_accept = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day.id).all()
    assert len(acts_before_accept) == 1
    assert "Amber Fort" in acts_before_accept[0].description

    # Authoritative AI mutation: Accept Proposal -> creates revision v2
    acc_resp = client.post(f"/api/v1/ai/proposals/{prop_id}/accept")
    assert acc_resp.status_code == 200
    assert acc_resp.json()["revision_version"] == 2

    # Verify activities table was mutated in DB
    db_session.expire_all()
    acts_after_ai = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day.id).all()
    assert len(acts_after_ai) > 0
    assert any("Sunset" in a.description or a.time_slot == "05:30 PM" for a in acts_after_ai)

    # Now call POST /api/v1/trips/{trip_id}/undo -> creates append-only revision v3 (restores v1)
    undo_resp = client.post(f"/api/v1/trips/{trip.id}/undo")
    assert undo_resp.status_code == 200
    assert undo_resp.json()["status"] == "success"
    assert undo_resp.json()["new_revision_version"] == 3
    assert undo_resp.json()["restored_version"] == 1

    # Verify DB restored original initial_act
    db_session.expire_all()
    restored_acts = db_session.query(ItineraryActivity).filter(ItineraryActivity.day_id == day.id).all()
    assert len(restored_acts) == 1
    assert "Amber Fort" in restored_acts[0].description
    assert float(restored_acts[0].cost_estimate) == 1200.0

    # Old revisions v1 and v2 remain intact and unmodified (append-only)
    from app.models.models import TripSnapshot
    snaps = db_session.query(TripSnapshot).filter(TripSnapshot.trip_id == trip.id).order_by(TripSnapshot.version.asc()).all()
    assert len(snaps) == 3
    assert snaps[0].version == 1 and snaps[0].action_type == "INITIAL_CREATION"
    assert snaps[1].version == 2 and snaps[1].action_type == "AI_PROPOSAL_ACCEPTED"
    assert snaps[2].version == 3 and snaps[2].action_type == "UNDO"
    assert all(s.action != "reverted" for s in snaps)

    # Calling undo again fails with 400 because v1 is initial baseline with no prior parent
    undo_resp_again = client.post(f"/api/v1/trips/{trip.id}/undo")
    assert undo_resp_again.status_code == 400
    assert "no previous trip revision available" in undo_resp_again.json()["detail"].lower()

def test_new_user_registration_starts_with_zero_coins(client, db_session):
    """
    Verify new user registration gives 0 coins (auditable onboarding, not 250 or 300).
    """
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": "zero_coins_traveler@example.com",
        "password": "Password123!",
        "full_name": "Zero Coins Traveler"
    })
    assert reg_resp.status_code == 200
    data = reg_resp.json()
    user_id = data["user"]["id"]

    profile = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    assert profile is not None
    assert profile.reward_coins == 0

