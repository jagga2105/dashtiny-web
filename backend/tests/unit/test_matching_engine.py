import uuid
import pytest
from datetime import date
from app.models.models import User, UserProfile, Itinerary, ItineraryDay, ItineraryActivity, CommunityPost
from app.services.matching_engine import calculate_traveler_trip_compatibility


def test_interest_overlap_and_high_compatibility(db_session, test_user):
    """
    Test that strong interest overlap generates high compatibility score and clear explanation.
    """
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    profile.interests = ["surfing", "beaches", "specialty coffee"]
    profile.likes = ["artisan bakeries", "sunset views"]
    profile.dislikes = ["large tour buses"]
    profile.pace = "relaxed"
    profile.budget_tier = "moderate"
    profile.travel_style = "coastal relaxation"
    db_session.commit()

    trip = Itinerary(
        id=f"trip-{uuid.uuid4().hex[:8]}",
        owner_id=test_user.id,
        title="Bali Coastal Rhythms",
        destination="Canggu, Bali",
        vibe="beaches & cafes",
        persona="relaxed",
        total_budget=50000.0,
        travellers=2
    )
    db_session.add(trip)
    db_session.flush()

    day1 = ItineraryDay(id=f"day-{uuid.uuid4().hex[:8]}", itinerary_id=trip.id, day_number=1, title="Arrival & Surf")
    db_session.add(day1)
    db_session.flush()

    act1 = ItineraryActivity(
        id=f"act-{uuid.uuid4().hex[:8]}",
        day_id=day1.id,
        time_slot="08:00 AM",
        description="Morning surfing session at Echo Beach",
        location="Echo Beach, Canggu",
        sort_order=1
    )
    act2 = ItineraryActivity(
        id=f"act-{uuid.uuid4().hex[:8]}",
        day_id=day1.id,
        time_slot="05:30 PM",
        description="Specialty coffee and sunset views at beachfront lounge",
        location="Canggu Beach",
        sort_order=2
    )
    db_session.add_all([act1, act2])
    db_session.commit()
    db_session.refresh(trip)

    report = calculate_traveler_trip_compatibility(profile, trip)
    assert report.score >= 80
    assert report.compatibility_level == "EXCELLENT"
    assert report.has_dealbreaker is False
    assert len(report.shared_interests) >= 2
    assert "surfing" in [i.lower() for i in report.shared_interests] or "beaches" in [i.lower() for i in report.shared_interests]
    assert report.pace_match == "EXACT"
    assert "Match" in report.explanation


def test_dealbreaker_suppression_and_penalization(db_session, test_user):
    """
    Test that explicit traveler dealbreaker triggers severe score suppression and dealbreaker warning.
    """
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    profile.interests = ["museums", "reading"]
    profile.likes = ["quiet gardens"]
    profile.dislikes = ["nightlife", "loud clubs"]
    profile.pace = "relaxed"
    db_session.commit()

    trip = Itinerary(
        id=f"trip-{uuid.uuid4().hex[:8]}",
        owner_id=test_user.id,
        title="Goa Party Weekend",
        destination="North Goa",
        vibe="wild nightlife",
        persona="packed",
        total_budget=30000.0,
        travellers=4
    )
    db_session.add(trip)
    db_session.flush()

    day = ItineraryDay(id=f"day-{uuid.uuid4().hex[:8]}", itinerary_id=trip.id, day_number=1, title="Party Night")
    db_session.add(day)
    db_session.flush()

    act = ItineraryActivity(
        id=f"act-{uuid.uuid4().hex[:8]}",
        day_id=day.id,
        time_slot="10:00 PM",
        description="All-night club hopping and beach nightlife",
        location="Tito's Lane, Baga",
        sort_order=1
    )
    db_session.add(act)
    db_session.commit()
    db_session.refresh(trip)

    report = calculate_traveler_trip_compatibility(profile, trip)
    assert report.has_dealbreaker is True
    assert "nightlife" in report.dealbreakers
    assert report.score <= 28
    assert report.compatibility_level == "LOW"
    assert "conflicts with your stated preferences" in report.explanation


def test_pace_and_budget_divergence(db_session, test_user):
    """
    Test that opposite pace (relaxed vs packed) and opposite budget (budget vs luxury)
    are scored lower deterministically without triggering dealbreaker.
    """
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    profile.interests = ["hiking"]
    profile.likes = []
    profile.dislikes = []
    profile.pace = "relaxed"
    profile.budget_tier = "budget"
    db_session.commit()

    # Create packed luxury trip
    trip = Itinerary(
        id=f"trip-{uuid.uuid4().hex[:8]}",
        owner_id=test_user.id,
        title="Ultra Luxury Fast Alps Tour",
        destination="St. Moritz",
        vibe="luxury alpine",
        persona="fast",
        total_budget=300000.0,
        travellers=1
    )
    db_session.add(trip)
    db_session.flush()

    day = ItineraryDay(id=f"day-{uuid.uuid4().hex[:8]}", itinerary_id=trip.id, day_number=1, title="Packed Day")
    db_session.add(day)
    db_session.flush()

    # 5 activities = packed
    for i in range(5):
        db_session.add(ItineraryActivity(
            id=f"act-p-{uuid.uuid4().hex[:8]}",
            day_id=day.id,
            time_slot=f"{8+i}:00 AM",
            description=f"Alpine stop {i+1}",
            sort_order=i+1
        ))
    db_session.commit()
    db_session.refresh(trip)

    report = calculate_traveler_trip_compatibility(profile, trip)
    assert report.has_dealbreaker is False
    assert report.pace_match == "OPPOSITE"
    assert report.budget_match == "DIVERGENT"
    assert report.breakdown["pace"] == 4
    assert report.breakdown["budget"] == 3


def test_community_feed_reranked_by_compatibility(client, db_session, test_user):
    """
    Verify /community/feed re-ranks posts by compatibility for an authenticated user:
    Compatible trips at the top, dealbreaker trips at the bottom.
    """
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    profile.interests = ["temples", "history", "tea"]
    profile.likes = ["traditional architecture"]
    profile.dislikes = ["casinos", "gambling"]
    profile.pace = "balanced"
    db_session.commit()

    # Trip A: Perfect match (Kyoto heritage & temples)
    trip_a = Itinerary(
        id=f"trip-match-{uuid.uuid4().hex[:8]}",
        owner_id=test_user.id,
        title="Kyoto Heritage & Temples",
        destination="Kyoto",
        vibe="history & temples",
        persona="balanced",
        visibility="PUBLIC",
        is_public=True,
        total_budget=60000.0,
        travellers=2
    )
    # Trip B: Dealbreaker match (Macau casino strip)
    trip_b = Itinerary(
        id=f"trip-dealbreaker-{uuid.uuid4().hex[:8]}",
        owner_id=test_user.id,
        title="Macau Casino Lights",
        destination="Macau",
        vibe="casinos & nightlife",
        persona="packed",
        visibility="PUBLIC",
        is_public=True,
        total_budget=90000.0,
        travellers=2
    )
    db_session.add_all([trip_a, trip_b])
    db_session.flush()

    post_a = CommunityPost(
        id=f"post-a-{uuid.uuid4().hex[:8]}",
        author_id=test_user.id,
        author_name="Sensei",
        author_avatar="https://avatar.iran.liara.run/public",
        getaway_title="Kyoto Temples Journey",
        content="Serene morning at Ginkaku-ji and tea ceremonies.",
        location="Kyoto, Japan",
        image_url="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e",
        source_trip_id=trip_a.id
    )
    post_b = CommunityPost(
        id=f"post-b-{uuid.uuid4().hex[:8]}",
        author_id=test_user.id,
        author_name="HighRoller",
        author_avatar="https://avatar.iran.liara.run/public",
        getaway_title="Macau High Stakes",
        content="Non-stop gambling and resort casinos.",
        location="Macau",
        image_url="https://images.unsplash.com/photo-1518684079-3c830dcef090",
        source_trip_id=trip_b.id
    )
    db_session.add_all([post_a, post_b])
    db_session.commit()

    resp = client.get("/api/v1/community/feed")
    assert resp.status_code == 200
    feed = resp.json()

    # Find posts A and B in feed
    item_a = next((p for p in feed if p["id"] == post_a.id), None)
    item_b = next((p for p in feed if p["id"] == post_b.id), None)

    assert item_a is not None
    assert item_b is not None

    assert item_a["compatibility_score"] is not None
    assert item_a["compatibility_score"] >= 75
    assert item_a["has_dealbreaker"] is False

    assert item_b["has_dealbreaker"] is True
    assert item_b["compatibility_score"] <= 28

    # Post A must be ranked before Post B
    idx_a = feed.index(item_a)
    idx_b = feed.index(item_b)
    assert idx_a < idx_b
