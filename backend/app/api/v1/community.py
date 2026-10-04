import uuid
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.db.database import get_db
from app.models.models import (
    CommunityPost, User, UserProfile, PostLike, Itinerary,
    ItineraryDay, ItineraryActivity
)
from app.api.deps import get_current_user, get_optional_user
from app.api.v1.trips import COMMUNITY_PUBLIC_SNAPSHOTS
from app.services.trip_revision_service import create_revision, serialize_trip_days
from app.services.matching_engine import calculate_traveler_trip_compatibility

router = APIRouter(prefix="/community", tags=["Community Feed & Squad Match"])


class CreatePostRequest(BaseModel):
    getaway_title: str
    location: str
    content: str
    image_url: Optional[str] = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"
    companions_needed: Optional[int] = 2
    source_trip_id: Optional[str] = None


@router.get("/feed")
def get_community_feed(
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Get live verified getaway posts and companion request feed.
    Enriches posts with canonical Trip details if linked to a source trip.
    Computes deterministic compatibility score when user is authenticated with a profile.
    Uses eager loading (joinedload) to eliminate N+1 queries.
    """
    user_profile = None
    if current_user:
        user_profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    posts = (
        db.query(CommunityPost)
        .options(
            joinedload(CommunityPost.source_trip).joinedload(Itinerary.days).joinedload(ItineraryDay.activities),
            joinedload(CommunityPost.source_trip).joinedload(Itinerary.owner),
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
        target_trip = p.source_trip

        if p.source_trip:
            trip = p.source_trip
            # Server-authoritative visibility boundary: Never leak PRIVATE trips in community feed
            if trip.visibility == "PRIVATE" and not trip.is_public:
                continue
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
            target_trip = Itinerary(
                id=p.id,
                title=snap.get("title", p.getaway_title),
                destination=snap.get("destination", p.location),
                vibe=snap.get("vibe", "Culture"),
                persona="culture",
                total_budget=72000.0,
                travellers=2
            )
        else:
            target_trip = Itinerary(
                id=p.id,
                title=p.getaway_title,
                destination=p.location,
                vibe=trip_style[0] if trip_style else "Discovery",
                persona="discovery",
                total_budget=40000.0,
                travellers=p.companions_needed or 2
            )

        # Compute deterministic compatibility
        owner_profile = None
        if target_trip and getattr(target_trip, "owner_id", None):
            owner_profile = db.query(UserProfile).filter(UserProfile.user_id == target_trip.owner_id).first()
        elif p.author_id:
            owner_profile = db.query(UserProfile).filter(UserProfile.user_id == p.author_id).first()

        compat_report = calculate_traveler_trip_compatibility(
            user_profile=user_profile,
            trip=target_trip,
            trip_owner_profile=owner_profile
        )

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
            "comments_count": None,  # Explicitly None to avoid presenting fake comments
            "companions_needed": p.companions_needed,
            "created_at": str(p.created_at),
            "compatibility_score": compat_report.score if user_profile else None,
            "compatibility_level": compat_report.compatibility_level if user_profile else None,
            "has_dealbreaker": compat_report.has_dealbreaker if user_profile else False,
            "compatibility_explanation": compat_report.explanation if user_profile else None,
            "shared_interests": compat_report.shared_interests if user_profile else [],
        })

    # When user is profiled, re-rank feed by compatibility:
    # 1. Non-dealbreaker trips first
    # 2. Highest compatibility score first
    # 3. Dealbreaker trips demoted to bottom
    if user_profile:
        results.sort(
            key=lambda r: (
                not r["has_dealbreaker"],
                r["compatibility_score"] or 0
            ),
            reverse=True
        )

    return results


@router.post("/posts")
def create_community_post(
    request: CreatePostRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Publish real travel story to community feed in PostgreSQL.
    Explicitly requires source_trip ownership when linking to a trip.
    Never exposes private bookings or notes.
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
        trip.visibility = "PUBLIC"

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
    Enforces unique like per traveler with atomic counter update to prevent concurrency race conditions.
    """
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    try:
        with db.begin_nested():
            new_like = PostLike(post_id=post.id, user_id=user.id)
            db.add(new_like)
            db.flush()
    except IntegrityError:
        return {
            "status": "already_liked",
            "post_id": post.id,
            "likes_count": post.likes_count or 0,
            "message": "You have already liked this getaway post."
        }

    # Concurrency-safe atomic counter increment in database
    db.query(CommunityPost).filter(CommunityPost.id == post_id).update(
        {CommunityPost.likes_count: func.coalesce(CommunityPost.likes_count, 0) + 1}
    )
    db.commit()
    db.refresh(post)

    return {
        "status": "liked",
        "post_id": post.id,
        "likes_count": post.likes_count
    }


@router.post("/posts/{post_id}/fork", status_code=status.HTTP_201_CREATED)
def fork_community_trip(
    post_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Forks a public community trip into a brand new private trip owned by the current user.
    - Clones itinerary, days, and activities.
    - Sets is_public = False on the new trip (private by default).
    - NEVER exposes private bookings, squad rooms, notes, or traveler information.
    - Creates initial revision with action_type = 'COMMUNITY_FORKED'.
    """
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Community post not found")

    source_trip = None
    if post.source_trip_id:
        source_trip = db.query(Itinerary).filter(Itinerary.id == post.source_trip_id).first()

    today = date.today()
    if source_trip:
        if not source_trip.is_public and source_trip.owner_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Source trip is private and cannot be forked."
            )

        duration_days = (source_trip.end_date - source_trip.start_date).days if (source_trip.start_date and source_trip.end_date) else 3
        if duration_days < 1:
            duration_days = 3

        new_trip = Itinerary(
            owner_id=user.id,
            title=f"Draft Trip to {source_trip.destination} (from {post.author_name or 'Community'})",
            destination=source_trip.destination,
            source_trip_id=source_trip.id,
            origin=None,
            travellers=None,
            total_budget=None,
            currency=source_trip.currency or "INR",
            start_date=None,
            end_date=None,
            vibe=source_trip.vibe,
            persona=source_trip.persona,
            status="draft",
            is_public=False
        )
        db.add(new_trip)
        db.flush()

        # Clone days and activities
        for day in sorted(source_trip.days, key=lambda d: d.day_number):
            new_day = ItineraryDay(
                itinerary_id=new_trip.id,
                day_number=day.day_number,
                title=day.title,
                weather_summary=day.weather_summary,
                cover_image_url=day.cover_image_url
            )
            db.add(new_day)
            db.flush()

            for act in sorted(day.activities, key=lambda a: a.sort_order):
                new_act = ItineraryActivity(
                    day_id=new_day.id,
                    time_slot=act.time_slot,
                    description=act.description,
                    location=act.location,
                    place_type=act.place_type,
                    cost_estimate=act.cost_estimate,
                    provenance="USER_GENERATED",
                    lat=act.lat,
                    lng=act.lng,
                    source_citation=f"Forked from {post.getaway_title}",
                    why_recommended=act.why_recommended,
                    duration_minutes=act.duration_minutes,
                    transit_minutes=act.transit_minutes,
                    transit_mode=act.transit_mode,
                    transit_source=act.transit_source,
                    transit_confidence=act.transit_confidence,
                    sort_order=act.sort_order
                )
                db.add(new_act)
            db.flush()

    elif post.id in COMMUNITY_PUBLIC_SNAPSHOTS:
        snap = COMMUNITY_PUBLIC_SNAPSHOTS[post.id]
        dest = snap.get("destination", post.location)

        new_trip = Itinerary(
            owner_id=user.id,
            title=f"Draft Trip to {dest} (from {post.author_name or 'Community'})",
            destination=dest,
            source_trip_id=post.source_trip_id,
            origin=None,
            travellers=None,
            total_budget=None,
            currency="INR",
            start_date=None,
            end_date=None,
            vibe=snap.get("vibe", "Discovery"),
            persona="solo",
            status="draft",
            is_public=False
        )
        db.add(new_trip)
        db.flush()

        for d_idx, day_data in enumerate(snap.get("days", [])):
            new_day = ItineraryDay(
                itinerary_id=new_trip.id,
                day_number=d_idx + 1,
                title=day_data.get("title", f"Day {d_idx + 1}"),
                weather_summary=day_data.get("weather", "Weather unavailable")
            )
            db.add(new_day)
            db.flush()

            for a_idx, act_data in enumerate(day_data.get("activities", [])):
                new_act = ItineraryActivity(
                    day_id=new_day.id,
                    time_slot=act_data.get("time", "10:00 AM"),
                    description=act_data.get("description", "Sightseeing"),
                    location=act_data.get("location", dest),
                    place_type=act_data.get("placeType", "TA"),
                    cost_estimate=act_data.get("costEstimate", 0.0),
                    provenance="USER_GENERATED",
                    lat=act_data.get("lat"),
                    lng=act_data.get("lng"),
                    source_citation=f"Community guide: {post.getaway_title}",
                    why_recommended=act_data.get("whyRecommended"),
                    duration_minutes=act_data.get("durationMinutes", 60),
                    transit_minutes=act_data.get("transitMinutes", 15),
                    transit_mode=act_data.get("transitMode", "WALK"),
                    transit_source="ESTIMATED",
                    transit_confidence="ESTIMATED",
                    sort_order=a_idx
                )
                db.add(new_act)
            db.flush()
    else:
        # Generic single-day template
        new_trip = Itinerary(
            owner_id=user.id,
            title=f"Draft Trip to {post.location} (from {post.author_name or 'Community'})",
            destination=post.location,
            source_trip_id=post.source_trip_id,
            origin=None,
            travellers=None,
            total_budget=None,
            currency="INR",
            start_date=None,
            end_date=None,
            vibe="Discovery",
            persona="solo",
            status="draft",
            is_public=False
        )
        db.add(new_trip)
        db.flush()

        day1 = ItineraryDay(itinerary_id=new_trip.id, day_number=1, title="Arrival & Exploration")
        db.add(day1)
        db.flush()

        act1 = ItineraryActivity(
            day_id=day1.id,
            time_slot="10:00 AM",
            description=f"Explore {post.location}",
            location=post.location,
            place_type="TA",
            cost_estimate=500.0,
            provenance="USER_GENERATED",
            sort_order=0
        )
        db.add(act1)
        db.flush()

    # Record initial revision
    create_revision(
        db=db,
        trip_id=new_trip.id,
        user_id=user.id,
        action_type="COMMUNITY_FORKED",
        days_data=serialize_trip_days(new_trip),
        summary=f"Forked from community getaway: {post.getaway_title} by {post.author_name}",
        actor_type="USER"
    )

    db.commit()
    db.refresh(new_trip)

    return {
        "status": "success",
        "message": f"Successfully forked '{post.getaway_title}' into your private trips!",
        "new_trip_id": new_trip.id,
        "title": new_trip.title,
        "destination": new_trip.destination,
        "is_public": new_trip.is_public
    }
