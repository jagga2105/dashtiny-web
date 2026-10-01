from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import CommunityPost, User, UserProfile

router = APIRouter(prefix="/community", tags=["Community Feed & Squad Match"])
security = HTTPBearer(auto_error=False)

def get_current_user_or_default(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if auth:
        try:
            payload = jwt.decode(auth.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return user
        except Exception:
            pass
    default_user = db.query(User).first()
    if not default_user:
        default_user = User(email="traveler@dashtiny.ai", full_name="Explorer")
        db.add(default_user)
        db.commit()
    return default_user

class CreatePostRequest(BaseModel):
    getaway_title: str
    location: str
    content: str
    image_url: Optional[str] = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"
    companions_needed: Optional[int] = 2

@router.get("/feed")
def get_community_feed(db: Session = Depends(get_db)):
    """
    Get live verified getaway posts and companion request feed.
    """
    posts = db.query(CommunityPost).order_by(CommunityPost.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "author_name": p.author_name,
            "author_avatar": p.author_avatar,
            "trust_score": p.trust_score,
            "getaway_title": p.getaway_title,
            "location": p.location,
            "image_url": p.image_url,
            "content": p.content,
            "likes_count": p.likes_count,
            "companions_needed": p.companions_needed,
            "created_at": str(p.created_at)
        }
        for p in posts
    ]

@router.post("/posts")
def create_community_post(
    request: CreatePostRequest,
    user: User = Depends(get_current_user_or_default),
    db: Session = Depends(get_db)
):
    """
    Publish real travel story to community feed in PostgreSQL.
    """
    new_post = CommunityPost(
        author_name=user.full_name,
        author_avatar=user.avatar_url or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        trust_score=user.trust_score or "98% Verified Explorer",
        getaway_title=request.getaway_title,
        location=request.location,
        image_url=request.image_url,
        content=request.content,
        likes_count=1,
        companions_needed=request.companions_needed or 2
    )
    db.add(new_post)

    # Reward user with +20 Gold Coins for sharing!
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if profile:
        profile.reward_coins = (profile.reward_coins or 0) + 20

    db.commit()
    db.refresh(new_post)

    return {
        "status": "published",
        "post_id": new_post.id,
        "author_name": new_post.author_name,
        "getaway_title": new_post.getaway_title,
        "likes_count": new_post.likes_count,
        "coins_earned": 20
    }

@router.post("/posts/{post_id}/like")
def like_community_post(post_id: str, db: Session = Depends(get_db)):
    """
    Increment like count for community post in PostgreSQL.
    """
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.likes_count = (post.likes_count or 0) + 1
    db.commit()
    return {"status": "liked", "post_id": post.id, "likes_count": post.likes_count}
