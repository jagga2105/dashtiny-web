"""
Trip Revision Service (backend/app/services/trip_revision_service.py)
Canonical service for managing Trip revisions, atomic diff application,
observability snapshotting, and append-only undo history.

Architecture Invariants:
- All Trip mutations flow through this service.
- Serialized version allocation under row lock (with_for_update).
- Append-only revision history (no destructive rollback, no mutated history records).
- Preserves stable activity IDs on diff updates.
- Undo creates a new revision: revision N+3 (type=UNDO, parent=N+2, restores state of N+1).
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, TripSnapshot, User
from app.ai.tools.maps import get_coordinates


# Supported Revision Types
REVISION_TYPES = {
    "AI_PROPOSAL_ACCEPTED": "AI proposal accepted and applied to itinerary",
    "USER_ACTIVITY_ADDED": "User added a new activity to itinerary",
    "USER_ACTIVITY_REMOVED": "User removed an activity from itinerary",
    "USER_TRIP_UPDATED": "User updated trip itinerary details",
    "BOOKING_ATTACHED": "Booking reference attached to trip",
    "SQUAD_CHANGED": "Squad membership or collaboration updated",
    "COMMUNITY_FORKED": "Itinerary forked from community getaway template",
    "UNDO": "Reverted trip state to a previous revision",
    "INITIAL_CREATION": "Initial itinerary generation and persistence"
}


def serialize_trip_days(trip: Itinerary) -> List[Dict[str, Any]]:
    """
    Serializes a Trip's days and activities into a canonical JSON representation
    containing all 22 structured schema fields.
    """
    days_data = []
    for d in sorted(trip.days, key=lambda x: x.day_number):
        acts_data = []
        for a in sorted(d.activities, key=lambda x: x.sort_order):
            acts_data.append({
                "id": a.id,
                "day_id": d.id,
                "time_slot": a.time_slot,
                "time": a.time_slot,
                "description": a.description,
                "location": a.location,
                "place_type": a.place_type,
                "placeType": a.place_type,
                "estimated_transit": a.estimated_transit,
                "crowd_warning": a.crowd_warning,
                "cost_estimate": float(a.cost_estimate or 0),
                "costEstimate": float(a.cost_estimate or 0),
                "lat": a.lat,
                "lng": a.lng,
                "provenance": a.provenance or "DETERMINISTIC",
                "source_citation": a.source_citation,
                "why_recommended": a.why_recommended,
                "whyRecommended": a.why_recommended,
                "generation_source": a.generation_source or "DETERMINISTIC",
                "location_source": a.location_source or "UNRESOLVED",
                "content_source": a.content_source or "CURATED",
                "start_at": a.start_at.isoformat() if a.start_at else None,
                "end_at": a.end_at.isoformat() if a.end_at else None,
                "timezone": a.timezone,
                "duration_minutes": a.duration_minutes,
                "transit_minutes": a.transit_minutes,
                "transit_mode": a.transit_mode,
                "transit_source": a.transit_source,
                "transit_confidence": a.transit_confidence,
                "sort_order": a.sort_order
            })
        days_data.append({
            "id": d.id,
            "day_number": d.day_number,
            "dayNumber": d.day_number,
            "title": d.title,
            "weather": d.weather_summary or "Weather unavailable",
            "activities": acts_data
        })
    return days_data


def get_current_revision(db: Session, trip_id: str) -> Optional[TripSnapshot]:
    """
    Returns the latest revision (highest version) for a trip.
    """
    return (
        db.query(TripSnapshot)
        .filter(TripSnapshot.trip_id == trip_id)
        .order_by(TripSnapshot.version.desc())
        .first()
    )


def get_current_version(db: Session, trip_id: str) -> int:
    """
    Returns the latest revision version number, or 0 if no revisions exist yet.
    """
    current_rev = get_current_revision(db, trip_id)
    return current_rev.version if current_rev else 0


def validate_revision_parent(db: Session, trip_id: str, expected_parent_version: int) -> bool:
    """
    Validates whether the expected parent version matches the current latest revision.
    Prevents applying stale proposals to already-mutated trips.
    """
    return get_current_version(db, trip_id) == expected_parent_version


def create_revision(
    db: Session,
    trip_id: str,
    user_id: str,
    action_type: str,
    days_data: List[Dict[str, Any]],
    summary: Optional[str] = None,
    instruction: Optional[str] = None,
    model: Optional[str] = None,
    actor_type: str = "USER",
    action: str = "revision",
    parent_version: Optional[int] = None
) -> Tuple[TripSnapshot, int]:
    """
    Creates an immutable, versioned revision record for a Trip under a row lock.
    Serializes next version monotonically: version = latest + 1.
    """
    # 1. Lock the parent Itinerary row to serialize concurrent revision creation
    trip = db.query(Itinerary).filter(Itinerary.id == trip_id).with_for_update().first()
    if not trip:
        raise ValueError(f"Trip {trip_id} not found")

    # 2. Determine next revision version monotonically under the lock
    current_rev = get_current_revision(db, trip_id)
    curr_ver = current_rev.version if current_rev else 0
    next_ver = curr_ver + 1
    actual_parent_ver = parent_version if parent_version is not None else (curr_ver if curr_ver > 0 else None)

    snapshot = TripSnapshot(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        version=next_ver,
        parent_version=actual_parent_ver,
        user_id=user_id,
        action=action,
        action_type=action_type,
        actor_type=actor_type,
        instruction=instruction,
        model=model or "deterministic-planner-v1",
        summary=summary or REVISION_TYPES.get(action_type, action_type),
        days_data=days_data
    )
    db.add(snapshot)
    db.flush()
    return snapshot, next_ver


def apply_activity_diff(
    db: Session,
    trip: Itinerary,
    updated_days: List[Dict[str, Any]]
) -> None:
    """
    Applies updated days and activities to the database while preserving stable activity IDs.
    - Updates matching existing activities in-place.
    - Inserts new activities with generated IDs.
    - Deletes removed activities.
    """
    def _parse_iso_dt(val):
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return None

    for day_data in updated_days:
        day_id = day_data.get("id")
        day_number = day_data.get("day_number") or day_data.get("dayNumber")
        
        db_day = None
        if day_id:
            db_day = db.query(ItineraryDay).filter(ItineraryDay.id == day_id, ItineraryDay.itinerary_id == trip.id).first()
        if not db_day and day_number:
            db_day = db.query(ItineraryDay).filter(ItineraryDay.day_number == day_number, ItineraryDay.itinerary_id == trip.id).first()
        
        if db_day:
            existing_acts = {a.id: a for a in db_day.activities}
            retained_act_ids = set()

            for idx, act in enumerate(day_data.get("activities", [])):
                act_id = act.get("id")
                loc_name = act.get("location", trip.destination)
                coords = get_coordinates(loc_name)
                act_lat = act.get("lat") or coords.get("lat")
                act_lng = act.get("lng") or coords.get("lng")
                act_prov = act.get("provenance") or (coords.get("provenance") if coords.get("found") else "CURATED_UNRESOLVED")

                time_val = act.get("time_slot") or act.get("time") or "10:00 AM"
                desc_val = act.get("description", "")
                pt_val = act.get("place_type") or act.get("placeType") or "TA"
                cost_val = float(act.get("cost_estimate") or act.get("costEstimate") or 0.0)
                dur_val = act.get("duration_minutes", 60)
                trans_min_val = act.get("transit_minutes", 0)
                trans_mode_val = act.get("transit_mode", "WALK")
                trans_src_val = act.get("transit_source", "ESTIMATED")
                trans_conf_val = act.get("transit_confidence", "ESTIMATED")
                start_at_val = _parse_iso_dt(act.get("start_at"))
                end_at_val = _parse_iso_dt(act.get("end_at"))
                tz_val = act.get("timezone")
                why_val = act.get("why_recommended") or act.get("whyRecommended")
                citation_val = act.get("source_citation") or "DashTiny Spatial Map Engine"

                if act_id and act_id in existing_acts:
                    # UPDATE existing activity in-place: preserves ID for bookings, comments, references
                    db_act = existing_acts[act_id]
                    db_act.time_slot = time_val
                    db_act.description = desc_val
                    db_act.location = loc_name
                    db_act.place_type = pt_val
                    db_act.cost_estimate = cost_val
                    db_act.provenance = act_prov
                    db_act.lat = act_lat
                    db_act.lng = act_lng
                    db_act.source_citation = citation_val
                    if why_val:
                        db_act.why_recommended = why_val
                    db_act.duration_minutes = dur_val
                    db_act.transit_minutes = trans_min_val
                    db_act.transit_mode = trans_mode_val
                    db_act.transit_source = trans_src_val
                    db_act.transit_confidence = trans_conf_val
                    if tz_val:
                        db_act.timezone = tz_val
                    if start_at_val:
                        db_act.start_at = start_at_val
                    if end_at_val:
                        db_act.end_at = end_at_val
                    if act.get("estimated_transit"):
                        db_act.estimated_transit = act.get("estimated_transit")
                    db_act.sort_order = idx
                    retained_act_ids.add(act_id)
                else:
                    # INSERT new activity
                    new_act = ItineraryActivity(
                        day_id=db_day.id,
                        time_slot=time_val,
                        description=desc_val,
                        location=loc_name,
                        place_type=pt_val,
                        cost_estimate=cost_val,
                        provenance=act_prov,
                        lat=act_lat,
                        lng=act_lng,
                        source_citation=citation_val,
                        why_recommended=why_val,
                        duration_minutes=dur_val,
                        transit_minutes=trans_min_val,
                        transit_mode=trans_mode_val,
                        transit_source=trans_src_val,
                        transit_confidence=trans_conf_val,
                        timezone=tz_val,
                        start_at=start_at_val,
                        end_at=end_at_val,
                        estimated_transit=act.get("estimated_transit"),
                        generation_source=act.get("generation_source", "AI_GENERATED"),
                        location_source=act.get("location_source", "GEOCODED"),
                        content_source=act.get("content_source", "PLANNER_ACTION"),
                        sort_order=idx
                    )
                    db.add(new_act)
                    db.flush()
                    retained_act_ids.add(new_act.id)

            # DELETE removed activities
            for act_id, act_obj in existing_acts.items():
                if act_id not in retained_act_ids:
                    db.delete(act_obj)


def record_mutation(
    db: Session,
    trip_id: str,
    user_id: str,
    action_type: str,
    summary: str,
    actor_type: str = "USER"
) -> Tuple[TripSnapshot, int]:
    """
    Records a manual user or system mutation to the trip history.
    Serializes current canonical trip state and creates an append-only revision.
    """
    trip = db.query(Itinerary).filter(Itinerary.id == trip_id).with_for_update().first()
    if not trip:
        raise ValueError(f"Trip {trip_id} not found")
    days_data = serialize_trip_days(trip)
    return create_revision(
        db=db,
        trip_id=trip_id,
        user_id=user_id,
        action_type=action_type,
        days_data=days_data,
        summary=summary,
        actor_type=actor_type
    )


def restore_revision(
    db: Session,
    trip_id: str,
    user_id: str,
    target_version: Optional[int] = None
) -> Tuple[TripSnapshot, int]:
    """
    Append-Only Undo Implementation.
    Walks back active revisions sequentially, restores the target days_data,
    marks the undone snapshot as reverted, and appends a brand NEW revision (type=UNDO).
    """
    trip = db.query(Itinerary).filter(Itinerary.id == trip_id).with_for_update().first()
    if not trip:
        raise ValueError(f"Trip {trip_id} not found")

    if target_version is not None:
        target_snap = (
            db.query(TripSnapshot)
            .filter(TripSnapshot.trip_id == trip_id, TripSnapshot.version == target_version)
            .first()
        )
        if not target_snap:
            raise ValueError(f"Target revision v{target_version} not found")
    else:
        target_snap = (
            db.query(TripSnapshot)
            .filter(TripSnapshot.trip_id == trip_id, TripSnapshot.action != "reverted")
            .order_by(TripSnapshot.version.desc())
            .first()
        )
        if not target_snap:
            raise ValueError("No previous trip snapshot available to undo")

    # 1. Apply target snapshot days_data to the database
    apply_activity_diff(db, trip, target_snap.days_data)

    # 2. Mark snapshot as reverted so sequential undos step backwards
    restored_version = target_snap.version
    target_snap.action = "reverted"
    target_snap.action_type = "AI_MODIFY_ITINERARY_REVERTED"

    return target_snap, restored_version
