from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.db.database import get_db
from app.models.models import CommunityPost, User, UserProfile, PostLike, Itinerary
from app.api.deps import get_current_user
from app.api.v1.trips import COMMUNITY_PUBLIC_SNAPSHOTS

router = APIRouter(prefix="/community", tags=["Community Feed & Squad Match"])

class CreatePostRequest(BaseModel):
    getaway_title: str
    location: str
    content: str
    image_url: Optional[str] = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"
    companions_needed: Optional[int] = 2
    source_trip_id: Optional[str] = None

@router.get("/feed")
def get_community_feed(db: Session = Depends(get_db)):
    """
    Get live verified getaway posts and companion request feed.
    Enriches posts with canonical Trip details if linked to a source trip.
    Uses eager loading (joinedload) to eliminate N+1 queries.
    """
    posts = (
        db.query(CommunityPost)
        .options(
            joinedload(CommunityPost.source_trip).joinedload(Itinerary.days),
            joinedload(CommunityPost.author)
        )
        .order_by(CommunityPost.created_at.desc())
        .all()
    )
    results = []
    for p in posts:
        source_trip_id = p.source_trip_id
        duration = "Flexible"
        budget_est = "Shared budget"
        trip_style = ["Travel Story"]
        is_completed = False

        if p.source_trip:
            trip = p.source_trip
            day_count = len(trip.days) if trip.days else 0
            duration = f"{day_count} Days" if day_count > 0 else "Flexible"
            budget_est = f"₹{int(trip.total_budget):,}" if trip.total_budget else "Flexible"
            trip_style = [trip.vibe or trip.persona or "Discovery"]
            is_completed = (trip.status == "completed")
        elif p.id in COMMUNITY_PUBLIC_SNAPSHOTS:
            snap = COMMUNITY_PUBLIC_SNAPSHOTS[p.id]
            source_trip_id = p.id
            duration = f"{snap.get('duration_days', 4)} Days"
            budget_est = snap.get("budget_est", "₹40,000")
            trip_style = [snap.get("vibe", "Culture")]
            is_completed = True

        # Genuinely derive author identity verification and trust score from current User record
        is_verified = bool(p.author.is_verified) if p.author else False
        author_trust_score = float(p.author.trust_score) if (p.author and p.author.trust_score is not None) else 95.0
        trust_display = p.author.trust_score_display if p.author else "Community Explorer"

        author_name = p.author.full_name if p.author else p.author_name
        author_avatar = p.author.avatar_url if (p.author and p.author.avatar_url) else p.author_avatar

        results.append({
            "id": p.id,
            "author_id": p.author_id,
            "source_trip_id": source_trip_id,
            "author_name": author_name,
            "author_avatar": author_avatar,
            "trust_score": trust_display,
            "author_trust_score": author_trust_score,
            "getaway_title": p.getaway_title,
            "destination": p.getaway_title,
            "location": p.location,
            "image_url": p.image_url,
            "content": p.content,
            "duration": duration,
            "budget_est": budget_est,
            "trip_style": trip_style,
            "is_identity_verified": is_verified,
            "is_trip_completed": is_completed,
            "likes_count": p.likes_count or 0,
            "comments_count": 0,
            "companions_needed": p.companions_needed,
            "created_at": str(p.created_at)
        })
    return results

@router.post("/posts")
def create_community_post(
    request: CreatePostRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Publish real travel story to community feed in PostgreSQL.
    Optionally links to an authoritative user trip and marks it public.
    """
    if request.source_trip_id:
        trip = db.query(Itinerary).filter(Itinerary.id == request.source_trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Source trip not found")
        if trip.owner_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only share itineraries that belong to you."
            )
        # Mark trip as explicitly public so public snapshot endpoint can safely serve it
        trip.is_public = True

    new_post = CommunityPost(
        author_id=user.id,
        source_trip_id=request.source_trip_id,
        author_name=user.full_name,
        author_avatar=user.avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        getaway_title=request.getaway_title,
        location=request.location,
        image_url=request.image_url,
        content=request.content,
        likes_count=0,
        companions_needed=request.companions_needed or 0
    )
    db.add(new_post)
    db.flush()

    # Route reward earning through authoritative ledger with idempotency
    idempotency_key = f"community_share_{user.id}_{new_post.source_trip_id or new_post.id}"
    from app.services.reward_service import award_rewards
    total_coins, was_awarded = award_rewards(
        db=db,
        user_id=user.id,
        delta=20,
        reward_type="TRIP_SHARED",
        reason=f"Shared community getaway story: {new_post.getaway_title}",
        reference_type="community_post",
        reference_id=new_post.id,
        idempotency_key=idempotency_key,
        metadata_json={"post_id": new_post.id, "title": new_post.getaway_title}
    )
    coins_earned = 20 if was_awarded else 0

    db.commit()
    db.refresh(new_post)

    return {
        "status": "published",
        "post_id": new_post.id,
        "author_id": new_post.author_id,
        "source_trip_id": new_post.source_trip_id,
        "author_name": new_post.author_name,
        "getaway_title": new_post.getaway_title,
        "likes_count": new_post.likes_count,
        "coins_earned": coins_earned,
        "total_coins": total_coins
    }

@router.post("/posts/{post_id}/like")
def like_community_post(
    post_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authenticated like for community post.
    Enforces unique like per traveler in PostgreSQL (post_likes table).
    """
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing_like = db.query(PostLike).filter(
        PostLike.post_id == post_id,
        PostLike.user_id == user.id
    ).first()

    if existing_like:
        return {
            "status": "already_liked",
            "post_id": post.id,
            "likes_count": post.likes_count,
            "message": "You have already liked this getaway post."
        }

    new_like = PostLike(post_id=post.id, user_id=user.id)
    db.add(new_like)
    post.likes_count = (post.likes_count or 0) + 1
    db.commit()
    return {"status": "liked", "post_id": post.id, "likes_count": post.likes_count}

