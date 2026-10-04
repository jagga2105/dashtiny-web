"""
DashTiny Deterministic & Explainable Matching Engine.
Evaluates multi-dimensional compatibility between travelers, trips, and squad candidates.
Computes interest overlap, pace compatibility, budget alignment, style resonance,
and enforces dealbreaker / dislike suppression without hallucination.
"""
from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel
from app.models.models import UserProfile, Itinerary, ItineraryDay, ItineraryActivity


class CompatibilityReport(BaseModel):
    score: int  # 0 to 100
    compatibility_level: str  # EXCELLENT, GOOD, MODERATE, LOW
    has_dealbreaker: bool
    dealbreakers: List[str]
    shared_interests: List[str]
    shared_vibe: Optional[str] = None
    pace_match: str  # EXACT, COMPATIBLE, OPPOSITE, UNKNOWN
    budget_match: str  # ALIGNED, SIMILAR, DIVERGENT, UNKNOWN
    breakdown: Dict[str, int]
    explanation: str


def _normalize_tokens(items: Optional[List[str]]) -> Set[str]:
    if not items:
        return set()
    tokens = set()
    for item in items:
        if not item:
            continue
        cleaned = item.strip().lower()
        if cleaned:
            tokens.add(cleaned)
    return tokens


def _infer_trip_pace(trip: Itinerary, owner_profile: Optional[UserProfile]) -> str:
    if owner_profile and owner_profile.pace:
        return owner_profile.pace.lower().strip()
    
    if trip.days:
        total_acts = sum(len(d.activities) for d in trip.days if d.activities)
        avg_acts = total_acts / max(1, len(trip.days))
        if avg_acts <= 2.2:
            return "relaxed"
        elif avg_acts >= 4.5:
            return "packed"
        else:
            return "balanced"
    
    # Fallback to persona or default balanced
    persona = (trip.persona or "").lower()
    if "fast" in persona or "packed" in persona:
        return "packed"
    if "slow" in persona or "chill" in persona or "relaxed" in persona:
        return "relaxed"
    return "balanced"


def _infer_trip_budget_tier(trip: Itinerary, owner_profile: Optional[UserProfile]) -> str:
    if owner_profile and owner_profile.budget_tier:
        return owner_profile.budget_tier.lower().strip()

    if trip.total_budget and trip.travellers:
        days_count = len(trip.days) if trip.days else 3
        per_person_per_day = trip.total_budget / (max(1, trip.travellers) * max(1, days_count))
        if per_person_per_day < 3500:
            return "budget"
        elif per_person_per_day > 9000:
            return "luxury"
        else:
            return "moderate"

    return "moderate"


def calculate_traveler_trip_compatibility(
    user_profile: Optional[UserProfile],
    trip: Itinerary,
    trip_owner_profile: Optional[UserProfile] = None
) -> CompatibilityReport:
    """
    Deterministically score compatibility between a traveler and an itinerary.
    """
    if not user_profile:
        # Default baseline report for anonymous or un-profiled visitors
        return CompatibilityReport(
            score=70,
            compatibility_level="GOOD",
            has_dealbreaker=False,
            dealbreakers=[],
            shared_interests=[],
            shared_vibe=trip.vibe or "Discovery",
            pace_match="UNKNOWN",
            budget_match="UNKNOWN",
            breakdown={"baseline": 70},
            explanation="Explore this journey to discover its rhythm and destinations."
        )

    user_interests = _normalize_tokens(user_profile.interests)
    user_likes = _normalize_tokens(user_profile.likes)
    user_dislikes = _normalize_tokens(user_profile.dislikes)
    user_food = _normalize_tokens(user_profile.food_preferences)

    # Collect trip semantic tokens from title, destination, vibe, activities
    trip_tokens: Set[str] = set()
    if trip.destination:
        trip_tokens.add(trip.destination.lower())
    if trip.vibe:
        trip_tokens.add(trip.vibe.lower())
    if trip.persona:
        trip_tokens.add(trip.persona.lower())

    if trip.days:
        for day in trip.days:
            for act in day.activities:
                if act.description:
                    for word in act.description.lower().split():
                        trip_tokens.add(word.strip(",.!?"))
                if act.place_type:
                    trip_tokens.add(act.place_type.lower())

    # Add trip owner's interests if available
    owner_interests = _normalize_tokens(trip_owner_profile.interests) if trip_owner_profile else set()
    owner_likes = _normalize_tokens(trip_owner_profile.likes) if trip_owner_profile else set()
    owner_dislikes = _normalize_tokens(trip_owner_profile.dislikes) if trip_owner_profile else set()
    owner_food = _normalize_tokens(trip_owner_profile.food_preferences) if trip_owner_profile else set()

    all_trip_concepts = trip_tokens.union(owner_interests).union(owner_likes)

    # 1. Check Dislikes / Dealbreakers
    detected_dealbreakers: List[str] = []
    for dislike in user_dislikes:
        d_lower = dislike.lower()
        # Direct match or substring in trip concepts
        if any(d_lower in c for c in all_trip_concepts) or any(c in d_lower for c in all_trip_concepts if len(c) > 3):
            detected_dealbreakers.append(dislike)

    # Mutual dealbreaker: check if owner dislikes anything user likes
    for o_dislike in owner_dislikes:
        od_lower = o_dislike.lower()
        if any(od_lower in u_like for u_like in user_likes):
            detected_dealbreakers.append(f"Host avoids {o_dislike}")

    has_dealbreaker = len(detected_dealbreakers) > 0

    # 2. Shared Interests & Passions (0 - 35 pts)
    matched_interests: List[str] = []
    combined_user_passions = user_interests.union(user_likes)
    for passion in combined_user_passions:
        p_lower = passion.lower()
        if any(p_lower in c for c in all_trip_concepts) or any(c in p_lower for c in all_trip_concepts if len(c) > 3):
            matched_interests.append(passion)

    if len(matched_interests) >= 3:
        interest_pts = 35
    elif len(matched_interests) == 2:
        interest_pts = 26
    elif len(matched_interests) == 1:
        interest_pts = 16
    else:
        interest_pts = 8

    # 3. Pace Compatibility (0 - 20 pts)
    user_pace = (user_profile.pace or "balanced").lower().strip()
    trip_pace = _infer_trip_pace(trip, trip_owner_profile)

    pace_ranks = {"relaxed": 1, "balanced": 2, "packed": 3}
    user_rank = pace_ranks.get(user_pace, 2)
    trip_rank = pace_ranks.get(trip_pace, 2)
    diff = abs(user_rank - trip_rank)

    if diff == 0:
        pace_pts = 20
        pace_match = "EXACT"
    elif diff == 1:
        pace_pts = 13
        pace_match = "COMPATIBLE"
    else:
        pace_pts = 4
        pace_match = "OPPOSITE"

    # 4. Budget Tier Alignment (0 - 15 pts)
    user_budget = (user_profile.budget_tier or "moderate").lower().strip()
    trip_budget = _infer_trip_budget_tier(trip, trip_owner_profile)

    budget_ranks = {"budget": 1, "moderate": 2, "luxury": 3}
    b_diff = abs(budget_ranks.get(user_budget, 2) - budget_ranks.get(trip_budget, 2))

    if b_diff == 0:
        budget_pts = 15
        budget_match = "ALIGNED"
    elif b_diff == 1:
        budget_pts = 9
        budget_match = "SIMILAR"
    else:
        budget_pts = 3
        budget_match = "DIVERGENT"

    # 5. Travel Style / Persona Match (0 - 15 pts)
    user_style = (user_profile.travel_style or "").lower().strip()
    trip_style = (trip.vibe or trip.persona or "").lower().strip()
    owner_style = (trip_owner_profile.travel_style or "").lower().strip() if trip_owner_profile else ""

    style_pts = 8  # Baseline
    if user_style and (user_style in trip_style or trip_style in user_style or user_style in owner_style):
        style_pts = 15
    elif user_style and any(w in trip_style for w in user_style.split()):
        style_pts = 12

    # 6. Food & Dining Preference Match (0 - 15 pts)
    food_pts = 10  # Neutral baseline
    if user_food and owner_food:
        shared_food = user_food.intersection(owner_food)
        if len(shared_food) >= 2:
            food_pts = 15
        elif len(shared_food) == 1:
            food_pts = 13
    elif user_food:
        food_pts = 12

    # Calculate Total Score
    raw_score = interest_pts + pace_pts + budget_pts + style_pts + food_pts
    breakdown = {
        "interests": interest_pts,
        "pace": pace_pts,
        "budget": budget_pts,
        "style": style_pts,
        "food": food_pts
    }

    if has_dealbreaker:
        # Severe penalty: capped at 28 max
        final_score = min(28, max(5, raw_score - 55))
        level = "LOW"
    else:
        final_score = min(99, max(20, raw_score))
        if final_score >= 80:
            level = "EXCELLENT"
        elif final_score >= 62:
            level = "GOOD"
        elif final_score >= 45:
            level = "MODERATE"
        else:
            level = "LOW"

    # Generate Deterministic Explanation
    explanation_parts = []
    if has_dealbreaker:
        db_str = ", ".join(detected_dealbreakers[:2])
        explanation = f"Low Compatibility ({final_score}%) • This journey includes {db_str}, which conflicts with your stated preferences."
    else:
        shared_summary = []
        if matched_interests:
            shared_summary.append(", ".join(matched_interests[:3]))
        if pace_match == "EXACT":
            shared_summary.append(f"{user_pace} rhythm")
        if budget_match == "ALIGNED":
            shared_summary.append(f"{user_budget} budget tier")

        if shared_summary:
            traits = " • ".join(shared_summary)
            explanation = f"{final_score}% Match • High resonance in {traits}."
        else:
            explanation = f"{final_score}% Match • Balanced travel compatibility with {trip_pace} exploration pace."

    return CompatibilityReport(
        score=final_score,
        compatibility_level=level,
        has_dealbreaker=has_dealbreaker,
        dealbreakers=detected_dealbreakers,
        shared_interests=matched_interests,
        shared_vibe=trip.vibe or "Discovery",
        pace_match=pace_match,
        budget_match=budget_match,
        breakdown=breakdown,
        explanation=explanation
    )
