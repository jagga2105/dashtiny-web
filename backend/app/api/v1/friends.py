from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.db.database import get_db
from app.models.models import Friendship, User, UserProfile
from app.api.deps import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/friends", tags=["Friends & Social Graph"])


class SendFriendRequest(BaseModel):
    friend_id: Optional[str] = None
    email: Optional[str] = None


class RespondFriendRequest(BaseModel):
    action: str  # "accept" or "reject"


@router.get("")
def list_friends(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List accepted friends, pending incoming requests, and pending outgoing requests.
    Includes profile summary for each traveler.
    """
    # 1. Accepted Friends
    accepted_rows = db.query(Friendship).filter(
        Friendship.status == "accepted",
        or_(Friendship.user_id == user.id, Friendship.friend_id == user.id)
    ).all()

    friend_user_ids = []
    friendship_map = {}
    for f in accepted_rows:
        other_id = f.friend_id if f.user_id == user.id else f.user_id
        friend_user_ids.append(other_id)
        friendship_map[other_id] = {
            "friendship_id": f.id,
            "since": str(f.created_at)
        }

    friends_data = []
    if friend_user_ids:
        friend_users = db.query(User).filter(User.id.in_(friend_user_ids)).all()
        for u in friend_users:
            prof = db.query(UserProfile).filter(UserProfile.user_id == u.id).first()
            meta = friendship_map.get(u.id, {})
            friends_data.append({
                "id": u.id,
                "friendship_id": meta.get("friendship_id"),
                "full_name": u.full_name,
                "email": u.email,
                "avatar_url": u.avatar_url or f"https://avatar.iran.liara.run/public?username={u.id}",
                "is_verified": bool(u.is_verified),
                "trust_score": float(u.trust_score or 95.0),
                "since": meta.get("since"),
                "pace": prof.pace if prof else "balanced",
                "travel_style": prof.travel_style if prof else None,
                "interests": prof.interests if prof else []
            })

    # 2. Incoming Requests
    incoming_rows = db.query(Friendship).filter(
        Friendship.friend_id == user.id,
        Friendship.status == "pending"
    ).all()

    incoming_data = []
    for r in incoming_rows:
        sender = db.query(User).filter(User.id == r.user_id).first()
        if sender:
            prof = db.query(UserProfile).filter(UserProfile.user_id == sender.id).first()
            incoming_data.append({
                "request_id": r.id,
                "user_id": sender.id,
                "full_name": sender.full_name,
                "avatar_url": sender.avatar_url or f"https://avatar.iran.liara.run/public?username={sender.id}",
                "trust_score": float(sender.trust_score or 95.0),
                "is_verified": bool(sender.is_verified),
                "created_at": str(r.created_at),
                "pace": prof.pace if prof else "balanced",
                "interests": prof.interests if prof else []
            })

    # 3. Outgoing Requests
    outgoing_rows = db.query(Friendship).filter(
        Friendship.user_id == user.id,
        Friendship.status == "pending"
    ).all()

    outgoing_data = []
    for r in outgoing_rows:
        target = db.query(User).filter(User.id == r.friend_id).first()
        if target:
            outgoing_data.append({
                "request_id": r.id,
                "user_id": target.id,
                "full_name": target.full_name,
                "avatar_url": target.avatar_url or f"https://avatar.iran.liara.run/public?username={target.id}",
                "created_at": str(r.created_at)
            })

    return {
        "friends": friends_data,
        "incoming_requests": incoming_data,
        "outgoing_requests": outgoing_data,
        "total_friends": len(friends_data)
    }


@router.post("/request")
def send_friend_request(
    request: SendFriendRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a friend request by user_id or email.
    """
    target: Optional[User] = None
    if request.friend_id:
        target = db.query(User).filter(User.id == request.friend_id).first()
    elif request.email:
        target = db.query(User).filter(User.email == request.email.strip().lower()).first()

    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Traveler not found"
        )

    if target.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a friend request to yourself"
        )

    existing = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == user.id, Friendship.friend_id == target.id),
            and_(Friendship.user_id == target.id, Friendship.friend_id == user.id)
        )
    ).first()

    if existing:
        if existing.status == "accepted":
            return {
                "status": "already_friends",
                "message": f"You are already friends with {target.full_name}",
                "friendship_id": existing.id
            }
        elif existing.status == "pending":
            if existing.user_id == user.id:
                return {
                    "status": "pending",
                    "message": "Friend request already sent and pending acceptance",
                    "request_id": existing.id
                }
            else:
                # Reciprocal request -> Auto-accept!
                existing.status = "accepted"
                db.commit()
                return {
                    "status": "accepted",
                    "message": f"Connected! You and {target.full_name} are now travel friends",
                    "friendship_id": existing.id
                }
        else:
            # Re-activate previously rejected request
            existing.user_id = user.id
            existing.friend_id = target.id
            existing.status = "pending"
            NotificationService.notify_friend_request(db, user, target.id)
            db.commit()
            return {
                "status": "sent",
                "message": f"Friend request sent to {target.full_name}",
                "request_id": existing.id
            }

    new_friendship = Friendship(
        user_id=user.id,
        friend_id=target.id,
        status="pending"
    )
    db.add(new_friendship)
    NotificationService.notify_friend_request(db, user, target.id)
    db.commit()
    db.refresh(new_friendship)

    return {
        "status": "sent",
        "message": f"Friend request sent to {target.full_name}",
        "request_id": new_friendship.id
    }


@router.post("/requests/{request_id}/respond")
def respond_friend_request(
    request_id: str,
    body: RespondFriendRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept or reject an incoming friend request.
    Only the recipient (friend_id) can respond.
    """
    friendship = db.query(Friendship).filter(Friendship.id == request_id).first()
    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found"
        )

    if friendship.friend_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to respond to this friend request"
        )

    action = body.action.lower().strip()
    if action == "accept":
        friendship.status = "accepted"
        NotificationService.notify_friend_accepted(db, user, friendship.user_id)
        db.commit()
        return {
            "status": "accepted",
            "message": "Friend request accepted! You are now connected.",
            "friendship_id": friendship.id
        }
    elif action == "reject":
        friendship.status = "rejected"
        db.commit()
        return {
            "status": "rejected",
            "message": "Friend request rejected."
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Allowed values: 'accept', 'reject'"
        )


@router.delete("/{friend_id}")
def remove_friend(
    friend_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove an existing friend connection.
    """
    friendship = db.query(Friendship).filter(
        Friendship.status == "accepted",
        or_(
            and_(Friendship.user_id == user.id, Friendship.friend_id == friend_id),
            and_(Friendship.user_id == friend_id, Friendship.friend_id == user.id)
        )
    ).first()

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend connection not found"
        )

    db.delete(friendship)
    db.commit()

    return {
        "status": "success",
        "message": "Friend connection removed"
    }
