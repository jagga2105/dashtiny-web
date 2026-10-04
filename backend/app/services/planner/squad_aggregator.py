"""
DashTiny — Squad Profile Aggregator Engine (Phase 5)
Aggregates traveler preferences across all active squad members to produce
an authoritative, consensus-driven Group Travel Profile:
- Harmonized group pace (accommodates relaxed/slow pacing)
- Shared passions and ranked interests
- Universal exclusions (dislikes of any member with attribution)
- Shared likes and dining constraints
- Human-readable narrative explanation
"""

from typing import List, Dict, Any, Optional
from collections import Counter, defaultdict
from sqlalchemy.orm import Session
from app.models.models import SquadRoom, SquadMember, User, UserProfile, Itinerary


class SquadProfileAggregator:
    @staticmethod
    def aggregate_squad_profile(squad_id: str, db: Session) -> Dict[str, Any]:
        """
        Computes the consensus group travel profile across all active squad members.
        """
        squad = db.query(SquadRoom).filter(SquadRoom.id == squad_id).first()
        if not squad:
            raise ValueError(f"Squad room {squad_id} not found")

        itinerary = db.query(Itinerary).filter(Itinerary.id == squad.itinerary_id).first()
        members = db.query(SquadMember).filter(SquadMember.squad_id == squad.id).all()

        member_profiles: List[Dict[str, Any]] = []
        all_interests: List[str] = []
        dislike_map: Dict[str, List[str]] = defaultdict(list)
        like_map: Dict[str, List[str]] = defaultdict(list)
        food_pref_set = set()
        paces: List[str] = []
        styles: List[str] = []

        for m in members:
            u: Optional[User] = m.user
            p: Optional[UserProfile] = (
                db.query(UserProfile).filter(UserProfile.user_id == m.user_id).first()
                if u else None
            )

            name = u.full_name if u and u.full_name else "Explorer"
            avatar = u.avatar_url if u and u.avatar_url else (name[0].upper() if name else "E")
            is_verified = bool(u.is_verified) if u else False
            trust_score = float(u.trust_score or 95.0) if u else 95.0

            m_pace = (p.pace if p and p.pace else "balanced").lower()
            m_style = (p.travel_style if p and p.travel_style else "balanced").lower()
            m_interests = p.interests if p and isinstance(p.interests, list) else []
            m_likes = p.likes if p and isinstance(p.likes, list) else []
            m_dislikes = p.dislikes if p and isinstance(p.dislikes, list) else []
            m_food = p.food_preferences if p and isinstance(p.food_preferences, list) else []

            paces.append(m_pace)
            styles.append(m_style)
            all_interests.extend(m_interests)

            for d in m_dislikes:
                if d and isinstance(d, str):
                    clean_d = d.strip().lower()
                    if clean_d and name not in dislike_map[clean_d]:
                        dislike_map[clean_d].append(name)

            for lk in m_likes:
                if lk and isinstance(lk, str):
                    clean_l = lk.strip().lower()
                    if clean_l and name not in like_map[clean_l]:
                        like_map[clean_l].append(name)

            for fp in m_food:
                if fp and isinstance(fp, str):
                    food_pref_set.add(fp.strip())

            member_profiles.append({
                "member_id": m.id,
                "user_id": m.user_id,
                "name": name,
                "email": u.email if u else "",
                "avatar": avatar,
                "role": m.role or "member",
                "is_verified": is_verified,
                "trust_score": trust_score,
                "pace": m_pace,
                "travel_style": m_style,
                "interests": m_interests,
                "likes": m_likes,
                "dislikes": m_dislikes,
                "food_preferences": m_food,
                "joined_at": str(m.joined_at),
            })

        member_count = len(member_profiles)

        # 1. Harmonized Pace:
        # Accommodates the slowest/relaxed member so no squad member feels overwhelmed.
        if "relaxed" in paces or "slow" in paces:
            harmonized_pace = "relaxed"
            pace_explanation = (
                "Accommodating relaxed pacing for group comfort so all squad members can enjoy each stop without rushing."
            )
        elif all(p == "fast" for p in paces) and member_count > 0:
            harmonized_pace = "fast"
            pace_explanation = "All squad members prefer an energetic, fast-paced itinerary."
        else:
            harmonized_pace = "balanced"
            pace_explanation = "Balanced pacing chosen for optimal mix of sightseeing, exploration, and leisure."

        # 2. Shared Passions and Ranked Interests:
        interest_counts = Counter([i.strip() for i in all_interests if i and isinstance(i, str)])
        ranked_interests = [
            {
                "name": interest,
                "count": count,
                "percentage": round((count / member_count) * 100) if member_count > 0 else 100
            }
            for interest, count in interest_counts.most_common()
        ]

        # Shared by 2+ members (or all if squad size is 1)
        threshold = 2 if member_count > 1 else 1
        shared_passions = [
            item["name"] for item in ranked_interests if item["count"] >= threshold
        ]

        # 3. Universal Exclusions (Dislikes of ANY member):
        universal_exclusions = [
            {
                "dislike": dislike,
                "flagged_by": flaggers,
                "count": len(flaggers),
            }
            for dislike, flaggers in sorted(dislike_map.items(), key=lambda x: len(x[1]), reverse=True)
        ]

        # 4. Shared Likes:
        shared_likes = [
            {
                "like": like,
                "endorsed_by": endorsers,
                "count": len(endorsers),
            }
            for like, endorsers in sorted(like_map.items(), key=lambda x: len(x[1]), reverse=True)
        ]

        # 5. Dominant Travel Style:
        style_counts = Counter(styles)
        dominant_style = style_counts.most_common(1)[0][0] if style_counts else "balanced"

        # 6. Group Narrative Summary:
        destination_name = itinerary.destination if itinerary else "the destination"
        passion_text = (
            f"shared passions for {', '.join(shared_passions[:3])}"
            if shared_passions else "diverse personal interests"
        )
        exclusion_text = (
            f"observing {len(universal_exclusions)} universal exclusions"
            if universal_exclusions else "zero strict exclusions"
        )

        narrative = (
            f"Squad of {member_count} {'explorers' if member_count > 1 else 'traveler'} planning for {destination_name}. "
            f"Operating at a {harmonized_pace} pace with {passion_text} and {exclusion_text}."
        )

        return {
            "squad_id": squad.id,
            "itinerary_id": squad.itinerary_id,
            "room_code": squad.room_code,
            "destination": destination_name,
            "member_count": member_count,
            "members": member_profiles,
            "harmonized_pace": harmonized_pace,
            "pace_explanation": pace_explanation,
            "dominant_style": dominant_style,
            "shared_passions": shared_passions,
            "ranked_interests": ranked_interests,
            "universal_exclusions": universal_exclusions,
            "exclusion_tags": [item["dislike"] for item in universal_exclusions],
            "shared_likes": shared_likes,
            "combined_dietary": sorted(list(food_pref_set)),
            "narrative": narrative,
        }
