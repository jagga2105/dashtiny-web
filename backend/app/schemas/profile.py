"""
Pydantic Schemas for Traveler Profile & Personalization (Phase 1)
backend/app/schemas/profile.py
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


VALID_PACES = {"relaxed", "balanced", "packed", "fast", "slow"}
VALID_TRAVEL_STYLES = {"solo", "couple", "family", "squad", "nomad", "luxury", "backpacker", "group", "daytripper", "adventure", "leisure", "romantic", "business"}
VALID_ACCOMMODATIONS = {"hostel", "budget", "comfort", "boutique", "luxury", "resort", "villa", "hotel"}
VALID_TRANSPORTS = {"walking", "public_transit", "cab", "rental_car", "mix", "scooter", "flight", "train", "car"}
VALID_BUDGET_TIERS = {"budget", "moderate", "premium", "luxury", "comfort", "ultra_luxury"}


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    avatar_url: Optional[str] = None
    home_city: Optional[str] = Field(None, max_length=100)
    preferred_currency: Optional[str] = Field(None, max_length=10)
    bio: Optional[str] = Field(None, max_length=1000)
    travel_style: Optional[str] = None
    pace: Optional[str] = None
    interests: Optional[List[str]] = None
    likes: Optional[List[str]] = None
    dislikes: Optional[List[str]] = None
    food_preferences: Optional[List[str]] = None
    activity_preferences: Optional[List[str]] = None
    accommodation_preference: Optional[str] = None
    transport_preference: Optional[str] = None
    budget_tier: Optional[str] = None
    budget_range: Optional[Dict[str, Any]] = None
    social_preferences: Optional[Dict[str, Any]] = None

    @field_validator("pace")
    @classmethod
    def validate_pace(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().lower()
            if clean not in VALID_PACES:
                raise ValueError(f"pace must be one of: {', '.join(sorted(VALID_PACES))}")
            return clean
        return v

    @field_validator("travel_style")
    @classmethod
    def validate_travel_style(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().lower()
            if clean not in VALID_TRAVEL_STYLES:
                raise ValueError(f"travel_style must be one of: {', '.join(sorted(VALID_TRAVEL_STYLES))}")
            return clean
        return v

    @field_validator("accommodation_preference")
    @classmethod
    def validate_accommodation(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().lower()
            if clean not in VALID_ACCOMMODATIONS:
                raise ValueError(f"accommodation_preference must be one of: {', '.join(sorted(VALID_ACCOMMODATIONS))}")
            return clean
        return v

    @field_validator("transport_preference")
    @classmethod
    def validate_transport(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().lower()
            if clean not in VALID_TRANSPORTS:
                raise ValueError(f"transport_preference must be one of: {', '.join(sorted(VALID_TRANSPORTS))}")
            return clean
        return v

    @field_validator("budget_tier")
    @classmethod
    def validate_budget_tier(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().lower()
            if clean not in VALID_BUDGET_TIERS:
                raise ValueError(f"budget_tier must be one of: {', '.join(sorted(VALID_BUDGET_TIERS))}")
            return clean
        return v


class TravelerProfileResponse(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    is_verified: bool = False
    trust_score: float = 95.0
    trust_score_display: str = "95% Explorer"
    account_type: str = "personal_traveler"
    reward_coins: int = 0
    home_city: str = "Bengaluru"
    preferred_currency: str = "INR"
    bio: Optional[str] = None
    travel_style: str = "solo"
    pace: str = "balanced"
    interests: List[str] = Field(default_factory=list)
    likes: List[str] = Field(default_factory=list)
    dislikes: List[str] = Field(default_factory=list)
    food_preferences: List[str] = Field(default_factory=list)
    activity_preferences: List[str] = Field(default_factory=list)
    accommodation_preference: str = "comfort"
    transport_preference: str = "mix"
    budget_tier: str = "moderate"
    budget_range: Dict[str, Any] = Field(default_factory=dict)
    social_preferences: Dict[str, Any] = Field(default_factory=dict)
