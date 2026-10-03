import pytest
from datetime import date
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, CommunityPost, UserProfile

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
