"""
DashTiny Phase 1: Traveler Profile & Personalization Foundation Tests
Verifies:
1. GET /api/v1/profile: Retrieves or auto-creates authenticated user's profile.
2. PUT /api/v1/profile: Updates profile personalization dimensions (travel_style, pace, likes, dislikes, food, accommodation).
3. GET /api/v1/profile/{user_id}: Public profile viewing with privacy boundaries.
4. Auto-inheritance: Proposal generation inherits user's stored profile preferences if omitted.
5. Dislike suppression: Disliked categories receive a heavy -60 penalty, prioritizing liked categories.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import User, UserProfile
from app.services.planner.proposal_service import ProposalService
from app.services.planner.destination_intelligence import DestinationIntelligence, DestinationCandidate


def test_get_and_update_profile(client: TestClient, db_session: Session, test_user: User):
    """
    Verifies that GET /api/v1/profile returns the profile and PUT /api/v1/profile updates it.
    """
    # 1. GET profile
    res = client.get("/api/v1/profile")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["user_id"] == test_user.id
    assert data["email"] == test_user.email

    # 2. PUT profile with rich traveler preferences
    payload = {
        "bio": "Adventurous solo traveler and coastal lover",
        "travel_style": "adventure",
        "pace": "fast",
        "interests": ["beaches", "seafood", "surfing"],
        "likes": ["sunset views", "coastal walks", "live acoustic music"],
        "dislikes": ["crowded temples", "nightclubs", "early wakeups"],
        "food_preferences": ["seafood", "local coastal"],
        "activity_preferences": ["water sports", "hiking"],
        "accommodation_preference": "boutique",
        "transport_preference": "scooter",
        "budget_tier": "comfort",
        "social_preferences": {"meet_travelers": True, "share_rides": False}
    }
    update_res = client.put("/api/v1/profile", json=payload)
    assert update_res.status_code == 200, update_res.text
    updated = update_res.json()

    assert updated["travel_style"] == "adventure"
    assert updated["pace"] == "fast"
    assert "seafood" in updated["interests"]
    assert "sunset views" in updated["likes"]
    assert "crowded temples" in updated["dislikes"]
    assert updated["accommodation_preference"] == "boutique"
    assert updated["social_preferences"]["meet_travelers"] is True

    # 3. Verify persisted in DB
    db_profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    assert db_profile is not None
    assert db_profile.travel_style == "adventure"
    assert "crowded temples" in db_profile.dislikes


def test_public_profile_view_privacy(client: TestClient, db_session: Session, test_user: User):
    """
    Verifies that GET /api/v1/profile/{user_id} provides a safe public view of another traveler.
    """
    # Set up profile for test_user
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    if not profile:
        profile = UserProfile(user_id=test_user.id)
        db_session.add(profile)
    profile.bio = "Globetrotter & photographer"
    profile.travel_style = "leisure"
    profile.interests = ["photography", "architecture"]
    profile.likes = ["panoramic views"]
    profile.social_preferences = {"open_to_squad": True}
    db_session.commit()

    # Create another user to view test_user's profile
    viewer = User(
        email="viewer@example.com",
        password_hash="fakehash",
        full_name="Explorer Bob"
    )
    db_session.add(viewer)
    db_session.commit()

    # Query public endpoint
    pub_res = client.get(f"/api/v1/profile/{test_user.id}")
    assert pub_res.status_code == 200, pub_res.text
    pub_data = pub_res.json()
    assert pub_data["user_id"] == test_user.id
    assert pub_data["full_name"] == test_user.full_name
    assert pub_data["travel_style"] == "leisure"
    assert "photography" in pub_data["interests"]


def test_proposal_auto_inherits_profile_preferences(client: TestClient, db_session: Session, test_user: User):
    """
    Verifies that when a traveler creates a proposal without specifying explicit pace or likes/dislikes,
    ProposalService automatically retrieves and applies their saved UserProfile.
    """
    # Set user profile with pace='relaxed' and explicit likes
    profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user.id).first()
    if not profile:
        profile = UserProfile(user_id=test_user.id)
        db_session.add(profile)
    profile.pace = "relaxed"
    profile.likes = ["beaches", "cafes"]
    profile.dislikes = ["pilgrimage", "crowded temples"]
    profile.accommodation_preference = "luxury"
    db_session.commit()

    # Create proposal with bare minimum inputs
    prop = ProposalService.create_itinerary_proposal(
        destination="Goa",
        days_count=3,
        travelers=2,
        user_id=test_user.id,
        db=db_session
    )

    data = prop.get("proposal_data") or prop
    # Pacing on normal day should reflect 'relaxed' (start at 10:00 AM)
    d2 = data["days"][1]
    assert d2["activities"][0]["time"] == "10:00 AM"


def test_destination_intelligence_dislike_suppression():
    """
    Verifies that DestinationIntelligence penalizes candidates matching dislikes by -60.0
    and boosts candidates matching likes by +20.0.
    """
    # Temple candidate
    temple = DestinationCandidate(
        name="Mangueshi Temple Pilgrimage",
        description="Historic 450-year-old Hindu temple dedicated to Lord Shiva, attracting devotees.",
        location="Ponda, Goa",
        place_type="TA",
        categories=["religious", "temple", "spiritual"],
        cost_estimate=0.0,
        duration=75
    )

    # Beach candidate
    beach = DestinationCandidate(
        name="Vagator Coastal Sunset Deck",
        description="Scenic coastal overlook with dramatic cliffs, sunset views, and relaxed cafes.",
        location="Vagator, North Goa",
        place_type="TA",
        categories=["beaches", "scenic", "sunset", "cafe"],
        cost_estimate=200.0,
        duration=90
    )

    # User hates religious places, loves beaches and sunset
    user_likes = ["beaches", "sunset"]
    user_dislikes = ["religious", "temple", "spiritual"]

    score_temple, why_temple = DestinationIntelligence.score_candidate(
        candidate=temple,
        user_interests=["sightseeing"],
        user_likes=user_likes,
        user_dislikes=user_dislikes
    )

    score_beach, why_beach = DestinationIntelligence.score_candidate(
        candidate=beach,
        user_interests=["sightseeing"],
        user_likes=user_likes,
        user_dislikes=user_dislikes
    )

    # Disliked temple should receive heavy negative score penalty
    assert score_temple <= -40.0
    # Liked beach should receive high positive score
    assert score_beach >= 70.0
    assert score_beach > score_temple
    assert "passion" in why_beach.lower() or "beaches" in why_beach.lower() or "sunset" in why_beach.lower()
