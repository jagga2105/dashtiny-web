"""
Traveler Profile & Personalization Router (Phase 1)
backend/app/api/v1/profile.py
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.deps import get_current_user
from app.models.models import User, UserProfile
from app.schemas.profile import UpdateProfileRequest, TravelerProfileResponse

router = APIRouter(prefix="/profile", tags=["profile"])


def _serialize_profile(user: User, profile: UserProfile) -> TravelerProfileResponse:
    return TravelerProfileResponse(
        id=profile.id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        is_verified=bool(user.is_verified),
        trust_score=float(user.trust_score) if user.trust_score is not None else 95.0,
        trust_score_display=user.trust_score_display,
        account_type=user.account_type or "personal_traveler",
        reward_coins=profile.reward_coins or 0,
        home_city=profile.home_city or "Bengaluru",
        preferred_currency=profile.preferred_currency or "INR",
        bio=profile.bio,
        travel_style=profile.travel_style or "solo",
        pace=profile.pace or "balanced",
        interests=profile.interests or [],
        likes=profile.likes or [],
        dislikes=profile.dislikes or [],
        food_preferences=profile.food_preferences or [],
        activity_preferences=profile.activity_preferences or [],
        accommodation_preference=profile.accommodation_preference or "comfort",
        transport_preference=profile.transport_preference or "mix",
        budget_tier=profile.budget_tier or "moderate",
        budget_range=profile.budget_range or {},
        social_preferences=profile.social_preferences or {}
    )


@router.get("", response_model=TravelerProfileResponse)
def get_my_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the authenticated traveler's complete profile and personal preferences.
    If no UserProfile record exists yet, automatically initializes one with defaults.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(
            user_id=user.id,
            home_city="Bengaluru",
            preferred_currency="INR",
            travel_style="solo",
            pace="balanced",
            interests=[],
            likes=[],
            dislikes=[],
            food_preferences=[],
            activity_preferences=[],
            accommodation_preference="comfort",
            transport_preference="mix",
            budget_tier="moderate"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return _serialize_profile(user, profile)


@router.put("", response_model=TravelerProfileResponse)
def update_my_profile(
    request: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atomically updates the authenticated traveler's preferences, style, likes, and dislikes.
    Enforces server-side data integrity and ownership.
    """
    # 1. Update User attributes if provided
    if request.full_name is not None and request.full_name.strip():
        user.full_name = request.full_name.strip()
    if request.avatar_url is not None:
        user.avatar_url = request.avatar_url

    # 2. Acquire profile under row lock
    profile = (
        db.query(UserProfile)
        .filter(UserProfile.user_id == user.id)
        .with_for_update()
        .first()
    )
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    # 3. Apply profile preferences
    if request.home_city is not None:
        profile.home_city = request.home_city.strip()
    if request.preferred_currency is not None:
        profile.preferred_currency = request.preferred_currency.strip().upper()
    if request.bio is not None:
        profile.bio = request.bio.strip()
    if request.travel_style is not None:
        profile.travel_style = request.travel_style
    if request.pace is not None:
        profile.pace = request.pace
    if request.interests is not None:
        profile.interests = [i.strip() for i in request.interests if i.strip()]
    if request.likes is not None:
        profile.likes = [l.strip() for l in request.likes if l.strip()]
    if request.dislikes is not None:
        profile.dislikes = [d.strip() for d in request.dislikes if d.strip()]
    if request.food_preferences is not None:
        profile.food_preferences = [f.strip() for f in request.food_preferences if f.strip()]
    if request.activity_preferences is not None:
        profile.activity_preferences = [a.strip() for a in request.activity_preferences if a.strip()]
    if request.accommodation_preference is not None:
        profile.accommodation_preference = request.accommodation_preference
    if request.transport_preference is not None:
        profile.transport_preference = request.transport_preference
    if request.budget_tier is not None:
        profile.budget_tier = request.budget_tier
    if request.budget_range is not None:
        profile.budget_range = request.budget_range
    if request.social_preferences is not None:
        profile.social_preferences = request.social_preferences

    db.commit()
    db.refresh(user)
    db.refresh(profile)

    return _serialize_profile(user, profile)


@router.get("/{user_id}", response_model=TravelerProfileResponse)
def get_public_user_profile(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get another traveler's profile for squad compatibility evaluation.
    Masks private fields while exposing shared travel style, interests, likes, and dislikes.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    profile = db.query(UserProfile).filter(UserProfile.user_id == target_user.id).first()
    if not profile:
        profile = UserProfile(user_id=target_user.id)

    # Return serialized with masked email if not viewing self
    res = _serialize_profile(target_user, profile)
    if target_user.id != current_user.id:
        res.email = f"{res.email[:3]}***@{res.email.split('@')[-1]}"
        res.budget_range = {}  # Don't expose private budget details to third parties
    return res
