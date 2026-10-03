from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db.database import get_db
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, SquadRoom, SquadMember, Booking, User, CommunityPost, TripSnapshot
from app.api.deps import get_current_user
from app.services.trip_revision_service import (
    serialize_trip_days,
    record_mutation,
    restore_revision
)

router = APIRouter(prefix="/trips", tags=["My Trips & Active Passages"])

@router.get("/my-trips")
def get_my_trips(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get all active and past itineraries strictly owned by the authenticated user.
    Uses selectinload to eagerly fetch days, activities, bookings, and squad rooms in batch,
    completely eliminating N+1 query overhead.
    """
    itineraries = (
        db.query(Itinerary)
        .filter(Itinerary.owner_id == user.id)
        .options(
            selectinload(Itinerary.days).selectinload(ItineraryDay.activities),
            selectinload(Itinerary.bookings),
            selectinload(Itinerary.squad_room)
        )
        .order_by(Itinerary.created_at.desc())
        .all()
    )

    results = []
    for it in itineraries:
        squad = it.squad_room
        sorted_days = sorted(it.days, key=lambda d: d.day_number)

        formatted_days = []
        for d in sorted_days:
            sorted_acts = sorted(d.activities, key=lambda a: a.sort_order)
            formatted_days.append({
                "id": d.id,
                "dayNumber": d.day_number,
                "title": d.title,
                "coverImage": d.cover_image_url or "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
                "weather": d.weather_summary or "Weather unavailable",
                "activities": [
                    {
                        "id": a.id,
                        "time": a.time_slot,
                        "description": a.description,
                        "location": a.location,
                        "placeType": a.place_type,
                        "estimatedTransit": a.estimated_transit,
                        "crowdWarning": a.crowd_warning,
                        "costEstimate": float(a.cost_estimate or 0),
                        "lat": a.lat,
                        "lng": a.lng,
                        "provenance": a.provenance or "DETERMINISTIC",
                        "whyRecommended": a.why_recommended,
                        "source_citation": a.source_citation
                    }
                    for a in sorted_acts
                ]
            })

        formatted_bookings = [
            {
                "id": b.id,
                "trip_id": b.trip_id,
                "category": b.category,
                "provider": b.provider,
                "title": b.title,
                "amount": float(b.amount),
                "currency": b.currency,
                "status": b.status,
                "pnr_ref": b.pnr_ref,
                "provenance": b.provenance or "SAVED_REFERENCE",
                "source": (b.details or {}).get("source", "USER_PROVIDED" if b.status == "saved_reference" else "PROVIDER"),
                "verification": (b.details or {}).get("verification", "UNVERIFIED" if b.status == "saved_reference" else "VERIFIED"),
                "created_at": str(b.created_at),
                "details": b.details
            }
            for b in it.bookings
        ]

        total_days = len(formatted_days)
        completed_days = 0
        if it.status == "completed":
            completed_days = total_days
        elif it.start_date and it.end_date:
            today = datetime.now(timezone.utc).date()
            if today > it.end_date:
                completed_days = total_days
            elif today >= it.start_date:
                completed_days = min(total_days, max(0, (today - it.start_date).days))

        results.append({
            "id": it.id,
            "title": it.title,
            "destination": it.destination,
            "destination_id": it.destination.lower().replace(" ", "-"),
            "origin": it.origin or "",
            "startDate": str(it.start_date),
            "endDate": str(it.end_date),
            "travellers": it.travellers or 2,
            "budget": float(it.total_budget),
            "currency": it.currency,
            "persona": it.persona,
            "vibe": it.vibe or it.persona or "Discovery",
            "status": it.status or "draft",
            "is_public": bool(it.is_public),
            "source_trip_id": it.source_trip_id,
            "squad_room_code": squad.room_code if squad else "DASH-ROOM",
            "daysCount": total_days,
            "bookingsCount": len(formatted_bookings),
            "completed_days": completed_days,
            "days": formatted_days,
            "bookings": formatted_bookings
        })

    return results

COMMUNITY_PUBLIC_SNAPSHOTS = {
    "trip_1": {
        "id": "trip_1",
        "title": "Kyoto Cultural & Gastronomy Getaway",
        "author": "Rohan Sharma",
        "author_name": "Rohan Sharma",
        "destination": "Kyoto, Japan",
        "duration_days": 6,
        "budget_est": "₹72,000",
        "vibe": "culture",
        "stops": [
            {"id": "s1", "day": 1, "time": "08:30", "title": "Fushimi Inari Taisha Dawn Shrine Walk", "location": "Fushimi, Kyoto", "tag": "Historic Shrine", "keep": True},
            {"id": "s2", "day": 1, "time": "14:00", "title": "Tofuku-ji Hojo Zen Rock Garden", "location": "Higashiyama, Kyoto", "tag": "Zen Sanctuary", "keep": True},
            {"id": "s3", "day": 2, "time": "10:00", "title": "Gion Shirakawa Historic District Stroll", "location": "Gion, Kyoto", "tag": "Cultural Walk", "keep": True},
            {"id": "s4", "day": 2, "time": "17:30", "title": "Traditional Ochaya Tea Ceremony Experience", "location": "Kennin-ji area", "tag": "Artisanal Tasting", "keep": True},
            {"id": "s5", "day": 3, "time": "11:30", "title": "Nishiki Market Culinary Tastings & Matcha Crawl", "location": "Central Kyoto", "tag": "Gastronomy", "keep": True},
            {"id": "s6", "day": 3, "time": "16:00", "title": "Philosopher’s Path Scenic Canal Walk", "location": "Sakyo Ward", "tag": "Scenic Walk", "keep": True},
            {"id": "s7", "day": 4, "time": "07:30", "title": "Arashiyama Bamboo Grove Sunrise Access", "location": "Arashiyama", "tag": "Nature & Photography", "keep": True},
            {"id": "s8", "day": 4, "time": "10:30", "title": "Tenryu-ji Sogenchi Landscape Garden", "location": "Arashiyama", "tag": "UNESCO Heritage", "keep": True},
            {"id": "s9", "day": 5, "time": "09:30", "title": "Uji Day Excursion: Byodoin Phoenix Hall", "location": "Uji, Kyoto", "tag": "Artisanal Excursion", "keep": True},
            {"id": "s10", "day": 5, "time": "15:00", "title": "Tsuen Tea Oldest Matcha Roastery Tasting", "location": "Uji Riverbank", "tag": "Culinary Heritage", "keep": True},
            {"id": "s11", "day": 6, "time": "09:00", "title": "Kiyomizu-dera Panoramic Wooden Stage", "location": "Higashiyama", "tag": "Scenic Panorama", "keep": True},
            {"id": "s12", "day": 6, "time": "13:00", "title": "Sannenzaka & Ninenzaka Pottery Lane Stroll", "location": "Higashiyama", "tag": "Artisanal Craft", "keep": True}
        ]
    },
    "trip_2": {
        "id": "trip_2",
        "title": "South Goa Slow Coastal & Seafood Escape",
        "author": "Ananya Verma",
        "author_name": "Ananya Verma",
        "destination": "Palolem & Agonda, Goa",
        "duration_days": 4,
        "budget_est": "₹28,000",
        "vibe": "beach",
        "stops": [
            {"id": "s1", "day": 1, "time": "12:00", "title": "Check-in at Secluded Cliffside Eco-Villa", "location": "Canacona, South Goa", "tag": "Arrival Sanctuary", "keep": True},
            {"id": "s2", "day": 1, "time": "17:30", "title": "Palolem Beach Golden Hour & Sundowner", "location": "Palolem Beach", "tag": "Coastal Sunset", "keep": True},
            {"id": "s3", "day": 2, "time": "07:30", "title": "Agonda Backwater Kayaking & Mangrove Birding", "location": "Agonda River", "tag": "Water Exploration", "keep": True},
            {"id": "s4", "day": 2, "time": "13:30", "title": "Authentic Saraswat Seafood Thali at Hidden Shack", "location": "Agonda Beach Road", "tag": "Authentic Culinary", "keep": True},
            {"id": "s5", "day": 3, "time": "10:30", "title": "Cabo de Rama Historic Portuguese Fort Exploration", "location": "Cabo de Rama Cliff", "tag": "Scenic Heritage", "keep": True},
            {"id": "s6", "day": 3, "time": "16:30", "title": "Cliffside Artisan Cafe Espresso & Sunset Lookout", "location": "Cabo de Rama", "tag": "Slow Living", "keep": True},
            {"id": "s7", "day": 4, "time": "08:00", "title": "Galgibaga Olive Ridley Turtle Sanctuary Morning Walk", "location": "Galgibaga Beach", "tag": "Nature Sanctuary", "keep": True},
            {"id": "s8", "day": 4, "time": "12:00", "title": "Traditional Goan Poee & Organic Cashew Farm Visit", "location": "Canacona Hinterland", "tag": "Farewell Heritage", "keep": True}
        ]
    }
}

@router.get("/{trip_id}/public")
def get_public_trip_snapshot(trip_id: str, db: Session = Depends(get_db)):
    """
    Get public read-only itinerary snapshot for community adaptation/forking.
    Accessible without personal authorization tokens; strips private bookings and user data.
    Only exposes trips that are explicitly public or linked to a CommunityPost, or known demo IDs.
    Uses selectinload to eagerly fetch days and activities, eliminating N+1 queries.
    """
    if trip_id in COMMUNITY_PUBLIC_SNAPSHOTS:
        return COMMUNITY_PUBLIC_SNAPSHOTS[trip_id]

    it = (
        db.query(Itinerary)
        .filter(Itinerary.id == trip_id)
        .options(
            selectinload(Itinerary.days).selectinload(ItineraryDay.activities),
            selectinload(Itinerary.owner)
        )
        .first()
    )
    if it:
        # Enforce public/published privacy boundary
        is_published = bool(it.is_public)
        if not is_published:
            has_community_post = db.query(CommunityPost).filter(CommunityPost.source_trip_id == it.id).first() is not None
            if has_community_post:
                is_published = True

        if not is_published:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Public itinerary snapshot not found or not published to community."
            )

        owner = it.owner
        sorted_days = sorted(it.days, key=lambda d: d.day_number)
        stops = []
        for d in sorted_days:
            sorted_acts = sorted(d.activities, key=lambda a: a.sort_order)
            for idx, a in enumerate(sorted_acts):
                stops.append({
                    "id": a.id,
                    "day": d.day_number,
                    "time": a.time_slot,
                    "title": a.description,
                    "location": a.location or it.destination,
                    "tag": a.place_type or "TA",
                    "keep": True
                })
        return {
            "id": it.id,
            "title": it.title,
            "author": owner.full_name if owner else "Community Explorer",
            "author_name": owner.full_name if owner else "Community Explorer",
            "destination": it.destination,
            "origin": it.origin or "",
            "travellers": it.travellers or 2,
            "duration_days": len(sorted_days) or 3,
            "budget_est": f"₹{int(it.total_budget):,} est." if it.total_budget else "Flexible",
            "vibe": it.vibe or it.persona or "Discovery",
            "stops": stops
        }

    raise HTTPException(status_code=404, detail="Public itinerary snapshot not found")

@router.get("/{trip_id}")
def get_trip_details(
    trip_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get full details, days, activities, and linked bookings for a specific trip.
    Enforces data ownership: user must be the trip owner or a member of the trip squad.
    Eagerly loads days, activities, bookings, and squad in batch to completely eliminate N+1 queries.
    """
    it = (
        db.query(Itinerary)
        .filter(Itinerary.id == trip_id)
        .options(
            selectinload(Itinerary.days).selectinload(ItineraryDay.activities),
            selectinload(Itinerary.bookings),
            selectinload(Itinerary.squad_room).selectinload(SquadRoom.members)
        )
        .first()
    )
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Enforce data ownership
    is_owner = (it.owner_id == user.id)
    squad = it.squad_room
    is_member = False
    if squad:
        is_member = any(m.user_id == user.id for m in squad.members)
    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have access to this itinerary."
        )

    trip_bookings = it.bookings
    sorted_days = sorted(it.days, key=lambda d: d.day_number)

    formatted_days = [
        {
            "id": d.id,
            "dayNumber": d.day_number,
            "title": d.title,
            "coverImage": d.cover_image_url,
            "weather": d.weather_summary or "Weather unavailable",
            "activities": [
                {
                    "id": a.id,
                    "time": a.time_slot,
                    "description": a.description,
                    "location": a.location,
                    "placeType": a.place_type,
                    "estimatedTransit": a.estimated_transit,
                    "crowdWarning": a.crowd_warning,
                    "costEstimate": float(a.cost_estimate or 0),
                    "lat": a.lat,
                    "lng": a.lng,
                    "provenance": a.provenance or "DETERMINISTIC",
                    "whyRecommended": a.why_recommended,
                    "source_citation": a.source_citation
                }
                for a in sorted(d.activities, key=lambda x: x.sort_order)
            ]
        }
        for d in sorted_days
    ]

    return {
        "id": it.id,
        "title": it.title,
        "destination": it.destination,
        "destination_id": it.destination.lower().replace(" ", "-"),
        "origin": it.origin or "",
        "startDate": str(it.start_date),
        "endDate": str(it.end_date),
        "travellers": it.travellers or 2,
        "budget": float(it.total_budget),
        "currency": it.currency,
        "persona": it.persona,
        "vibe": it.vibe or it.persona or "Discovery",
        "status": it.status or "draft",
        "is_public": bool(it.is_public),
        "source_trip_id": it.source_trip_id,
        "squad_room_code": squad.room_code if squad else None,
        "daysCount": len(sorted_days),
        "bookingsCount": len(trip_bookings),
        "bookings": [
            {
                "id": b.id,
                "trip_id": b.trip_id,
                "category": b.category,
                "provider": b.provider,
                "title": b.title,
                "amount": float(b.amount),
                "currency": b.currency,
                "status": b.status,
                "pnr_ref": b.pnr_ref,
                "provenance": b.provenance or "SAVED_REFERENCE",
                "source": (b.details or {}).get("source", "USER_PROVIDED" if b.status == "saved_reference" else "PROVIDER"),
                "verification": (b.details or {}).get("verification", "UNVERIFIED" if b.status == "saved_reference" else "VERIFIED"),
                "created_at": str(b.created_at),
                "details": b.details
            }
            for b in trip_bookings
        ],
        "days": formatted_days
    }

class AddActivityRequest(BaseModel):
    day_id: str
    time_slot: str = "10:00 AM"
    description: str
    location: Optional[str] = None
    place_type: Optional[str] = "TA"
    cost_estimate: Optional[float] = 0.0
    lat: Optional[float] = None
    lng: Optional[float] = None
    provenance: Optional[str] = "DETERMINISTIC"
    why_recommended: Optional[str] = None
    source_citation: Optional[str] = None

@router.delete("/{trip_id}/activities/{activity_id}")
def delete_trip_activity(
    trip_id: str,
    activity_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Persistently remove an itinerary activity from a trip.
    Enforces user data ownership and validates activity membership in the trip.
    Records an append-only revision in TripRevisionService.
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    is_owner = (it.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()
    is_member = False
    if squad:
        is_member = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.user_id == user.id
        ).first() is not None
    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to modify this trip."
        )

    # Find the activity and verify it belongs to one of this trip's days
    activity = db.query(ItineraryActivity).filter(ItineraryActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    day = db.query(ItineraryDay).filter(ItineraryDay.id == activity.day_id).first()
    if not day or day.itinerary_id != it.id:
        raise HTTPException(status_code=400, detail="Activity does not belong to the specified trip")

    desc = activity.description
    db.delete(activity)
    db.flush()

    # Record mutation revision
    record_mutation(
        db=db,
        trip_id=it.id,
        user_id=user.id,
        action_type="USER_ACTIVITY_REMOVED",
        summary=f"Removed activity: {desc}"
    )
    db.commit()

    return {
        "status": "success",
        "action": "deleted",
        "trip_id": trip_id,
        "activity_id": activity_id,
        "message": "Activity removed persistently from trip"
    }

@router.post("/{trip_id}/activities")
def add_trip_activity(
    trip_id: str,
    request: AddActivityRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add an itinerary activity to an explicit trip day.
    Requires validated day_id; no silent fallbacks to day_number or day 1.
    Activity ID is server-generated; records append-only revision in TripRevisionService.
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    is_owner = (it.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()
    is_member = False
    if squad:
        is_member = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.user_id == user.id
        ).first() is not None
    if not is_owner and not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to modify this trip."
        )

    # Locate destination day explicitly
    if not request.day_id or not request.day_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="day_id is required."
        )

    target_day = db.query(ItineraryDay).filter(
        ItineraryDay.id == request.day_id.strip(),
        ItineraryDay.itinerary_id == it.id
    ).first()

    if not target_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified day_id not found in this trip."
        )

    # Get max sort order in day
    current_count = db.query(ItineraryActivity).filter(ItineraryActivity.day_id == target_day.id).count()

    new_act = ItineraryActivity(
        day_id=target_day.id,
        time_slot=request.time_slot,
        description=request.description,
        location=request.location or it.destination,
        place_type=request.place_type or "TA",
        cost_estimate=request.cost_estimate or 0.0,
        provenance=request.provenance or "DETERMINISTIC",
        lat=request.lat,
        lng=request.lng,
        why_recommended=request.why_recommended or "Added to itinerary",
        source_citation=request.source_citation or "User Action",
        sort_order=current_count
    )
    db.add(new_act)
    db.flush()

    # Record mutation revision
    record_mutation(
        db=db,
        trip_id=it.id,
        user_id=user.id,
        action_type="USER_ACTIVITY_ADDED",
        summary=f"Added activity: {new_act.description}"
    )
    db.commit()
    db.refresh(new_act)

    return {
        "status": "success",
        "action": "added",
        "activity": {
            "id": new_act.id,
            "dayId": new_act.day_id,
            "dayNumber": target_day.day_number,
            "time": new_act.time_slot,
            "description": new_act.description,
            "location": new_act.location,
            "placeType": new_act.place_type,
            "costEstimate": float(new_act.cost_estimate or 0),
            "lat": new_act.lat,
            "lng": new_act.lng,
            "provenance": new_act.provenance,
            "whyRecommended": new_act.why_recommended
        }
    }


@router.get("/{trip_id}/snapshots")
def get_trip_snapshots(
    trip_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List versioned trip revisions available for history and undo.
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    is_owner = (it.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()
    is_member = False
    if squad:
        is_member = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.user_id == user.id
        ).first() is not None

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Not authorized to view snapshots for this trip")

    snapshots = db.query(TripSnapshot).filter(
        TripSnapshot.trip_id == it.id
    ).order_by(TripSnapshot.version.desc()).all()

    return [
        {
            "id": s.id,
            "version": s.version,
            "parent_version": s.parent_version,
            "action": s.action,
            "action_type": s.action_type,
            "summary": s.summary,
            "is_reverted": (s.action == "reverted"),
            "created_at": str(s.created_at)
        }
        for s in snapshots
    ]

@router.post("/{trip_id}/undo")
def undo_trip_change(
    trip_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Safe Append-Only Undo Endpoint.
    Restores prior revision domain state and creates a brand NEW append-only UNDO revision:
    revision N+3, type=UNDO, parent=N+2, restores state of N+1.
    History is never destroyed or mutated into fake states.
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).with_for_update().first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    is_owner = (it.owner_id == user.id)
    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()
    is_member = False
    if squad:
        is_member = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.user_id == user.id
        ).first() is not None

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Not authorized to modify this trip")

    try:
        new_undo_snap, restored_version = restore_revision(
            db=db,
            trip_id=it.id,
            user_id=user.id
        )
        db.commit()
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to undo trip change: {str(exc)}")

    remaining_active = db.query(TripSnapshot).filter(
        TripSnapshot.trip_id == it.id,
        TripSnapshot.action != "reverted"
    ).count()

    return {
        "status": "success",
        "action": "undo",
        "message": f"Trip successfully reverted to snapshot v{restored_version}",
        "trip_id": it.id,
        "restored_version": restored_version,
        "new_revision_version": new_undo_snap.version,
        "summary": new_undo_snap.summary,
        "remaining_active_revisions": remaining_active
    }


