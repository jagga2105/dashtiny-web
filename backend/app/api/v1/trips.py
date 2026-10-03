from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, SquadRoom, SquadMember, Booking, User, CommunityPost
from app.api.deps import get_current_user

router = APIRouter(prefix="/trips", tags=["My Trips & Active Passages"])

@router.get("/my-trips")
def get_my_trips(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get all active and past itineraries strictly owned by the authenticated user.
    """
    itineraries = db.query(Itinerary).filter(Itinerary.owner_id == user.id).order_by(Itinerary.created_at.desc()).all()

    results = []
    for it in itineraries:
        days = db.query(ItineraryDay).filter(ItineraryDay.itinerary_id == it.id).order_by(ItineraryDay.day_number.asc()).all()
        squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == it.id).first()

        formatted_days = []
        for d in days:
            acts = db.query(ItineraryActivity).filter(ItineraryActivity.day_id == d.id).order_by(ItineraryActivity.sort_order.asc()).all()
            formatted_days.append({
                "id": d.id,
                "dayNumber": d.day_number,
                "title": d.title,
                "coverImage": d.cover_image_url or "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
                "weather": d.weather_summary or "28°C Sunny ☀️",
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
                    for a in acts
                ]
            })

        # Fetch bookings linked to this specific trip
        trip_bookings = db.query(Booking).filter(Booking.trip_id == it.id).all()
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
            for b in trip_bookings
        ]

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
            "daysCount": len(formatted_days),
            "bookingsCount": len(formatted_bookings),
            "completed_days": 0,
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
    """
    if trip_id in COMMUNITY_PUBLIC_SNAPSHOTS:
        return COMMUNITY_PUBLIC_SNAPSHOTS[trip_id]

    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
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

        owner = db.query(User).filter(User.id == it.owner_id).first()
        days = db.query(ItineraryDay).filter(ItineraryDay.itinerary_id == it.id).order_by(ItineraryDay.day_number.asc()).all()
        stops = []
        for d in days:
            acts = db.query(ItineraryActivity).filter(ItineraryActivity.day_id == d.id).order_by(ItineraryActivity.sort_order.asc()).all()
            for idx, a in enumerate(acts):
                a_id = getattr(a, "id", None) or (a.get("id") if isinstance(a, dict) else None) or f"d{d.day_number}_a{idx}"
                a_time = getattr(a, "time_slot", None) or (a.get("time") if isinstance(a, dict) else None) or "10:00"
                a_title = getattr(a, "description", None) or getattr(a, "title", None) or (a.get("description") or a.get("title") if isinstance(a, dict) else None) or "Local Experience"
                a_location = getattr(a, "location", None) or (a.get("location") if isinstance(a, dict) else None) or it.destination
                a_tag = getattr(a, "place_type", None) or getattr(a, "tag", None) or (a.get("tag") or a.get("place_type") if isinstance(a, dict) else None) or "Sightseeing"
                stops.append({
                    "id": a_id,
                    "day": d.day_number,
                    "time": a_time,
                    "title": a_title,
                    "location": a_location,
                    "tag": a_tag,
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
            "duration_days": len(days) or 3,
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
    """
    it = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Enforce data ownership
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
            detail="Access denied. You do not have access to this itinerary."
        )

    days = db.query(ItineraryDay).filter(ItineraryDay.itinerary_id == it.id).order_by(ItineraryDay.day_number.asc()).all()
    trip_bookings = db.query(Booking).filter(Booking.trip_id == it.id).all()

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
        "daysCount": len(days),
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
        "days": [
            {
                "dayNumber": d.day_number,
                "title": d.title,
                "coverImage": d.cover_image_url,
                "weather": d.weather_summary,
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
                    for a in db.query(ItineraryActivity).filter(ItineraryActivity.day_id == d.id).all()
                ]
            }
            for d in days
        ]
    }

class AddActivityRequest(BaseModel):
    id: Optional[str] = None
    day_id: Optional[str] = None
    day_number: Optional[int] = 1
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

    db.delete(activity)
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
    Add or restore an itinerary activity to a trip day.
    Used for user-initiated additions and undoing deletions.
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

    # Locate destination day
    target_day = None
    if request.day_id:
        target_day = db.query(ItineraryDay).filter(
            ItineraryDay.id == request.day_id,
            ItineraryDay.itinerary_id == it.id
        ).first()

    if not target_day:
        target_day = db.query(ItineraryDay).filter(
            ItineraryDay.itinerary_id == it.id,
            ItineraryDay.day_number == (request.day_number or 1)
        ).first()

    if not target_day:
        # Fallback to first day
        target_day = db.query(ItineraryDay).filter(ItineraryDay.itinerary_id == it.id).order_by(ItineraryDay.day_number.asc()).first()

    if not target_day:
        raise HTTPException(status_code=404, detail="No days found in trip to attach activity")

    # Get max sort order in day
    current_count = db.query(ItineraryActivity).filter(ItineraryActivity.day_id == target_day.id).count()

    new_act = ItineraryActivity(
        id=request.id if request.id else None,
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
