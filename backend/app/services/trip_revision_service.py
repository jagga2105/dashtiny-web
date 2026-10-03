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
    parent_version: Optional[int] = None,
    restored_from_version: Optional[int] = None
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
        restored_from_version=restored_from_version,
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
    - Explicit field semantics:
      * field omitted = preserve existing value
      * field explicitly null/clear = clear existing value
      * field explicitly supplied = update value
    - Updates matching existing activities in-place.
    - Inserts new activities with server-generated UUIDs.
    - Deletes removed activities.
    """
    def _parse_iso_dt(val):
        if val is None:
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

                if act_id and act_id in existing_acts:
                    # UPDATE existing activity in-place (preserves stable activity ID)
                    db_act = existing_acts[act_id]
                    
                    if "time_slot" in act or "time" in act:
                        val = act.get("time_slot") if "time_slot" in act else act.get("time")
                        if val is not None:
                            db_act.time_slot = val
                    if "description" in act:
                        if act["description"] is not None:
                            db_act.description = act["description"]
                    if "location" in act:
                        if act["location"] is not None:
                            db_act.location = act["location"]
                            if "lat" not in act and "lng" not in act:
                                coords = get_coordinates(act["location"])
                                if coords.get("found"):
                                    db_act.lat = coords.get("lat")
                                    db_act.lng = coords.get("lng")
                    if "place_type" in act or "placeType" in act:
                        val = act.get("place_type") if "place_type" in act else act.get("placeType")
                        if val is not None:
                            db_act.place_type = val
                    if "cost_estimate" in act or "costEstimate" in act or "cost" in act:
                        val = act.get("cost_estimate") if "cost_estimate" in act else (act.get("costEstimate") if "costEstimate" in act else act.get("cost"))
                        db_act.cost_estimate = float(val) if val is not None else 0.0
                    if "lat" in act:
                        db_act.lat = act["lat"]
                    if "lng" in act:
                        db_act.lng = act["lng"]
                    if "provenance" in act:
                        if act["provenance"] is not None:
                            db_act.provenance = act["provenance"]
                    if "source_citation" in act:
                        db_act.source_citation = act["source_citation"]
                    if "why_recommended" in act or "whyRecommended" in act:
                        val = act.get("why_recommended") if "why_recommended" in act else act.get("whyRecommended")
                        db_act.why_recommended = val
                    if "generation_source" in act or "generationSource" in act:
                        val = act.get("generation_source") if "generation_source" in act else act.get("generationSource")
                        db_act.generation_source = val
                    if "location_source" in act or "locationSource" in act:
                        val = act.get("location_source") if "location_source" in act else act.get("locationSource")
                        db_act.location_source = val
                    if "content_source" in act or "contentSource" in act:
                        val = act.get("content_source") if "content_source" in act else act.get("contentSource")
                        db_act.content_source = val
                    if "duration_minutes" in act or "durationMinutes" in act:
                        val = act.get("duration_minutes") if "duration_minutes" in act else act.get("durationMinutes")
                        db_act.duration_minutes = val
                    if "transit_minutes" in act or "transitMinutes" in act:
                        val = act.get("transit_minutes") if "transit_minutes" in act else act.get("transitMinutes")
                        db_act.transit_minutes = val
                    if "transit_mode" in act or "transitMode" in act:
                        val = act.get("transit_mode") if "transit_mode" in act else act.get("transitMode")
                        db_act.transit_mode = val
                    if "transit_source" in act:
                        db_act.transit_source = act["transit_source"]
                    if "transit_confidence" in act:
                        db_act.transit_confidence = act["transit_confidence"]
                    if "estimated_transit" in act or "estimatedTransit" in act:
                        val = act.get("estimated_transit") if "estimated_transit" in act else act.get("estimatedTransit")
                        db_act.estimated_transit = val
                    if "crowd_warning" in act or "crowdWarning" in act:
                        val = act.get("crowd_warning") if "crowd_warning" in act else act.get("crowdWarning")
                        db_act.crowd_warning = val
                    if "timezone" in act:
                        db_act.timezone = act["timezone"]
                    if "start_at" in act or "startAt" in act:
                        val = act.get("start_at") if "start_at" in act else act.get("startAt")
                        db_act.start_at = _parse_iso_dt(val)
                    if "end_at" in act or "endAt" in act:
                        val = act.get("end_at") if "end_at" in act else act.get("endAt")
                        db_act.end_at = _parse_iso_dt(val)

                    db_act.sort_order = idx
                    retained_act_ids.add(act_id)
                else:
                    # INSERT new activity with server-generated UUID
                    loc_name = act.get("location") or trip.destination
                    coords = get_coordinates(loc_name)
                    act_lat = act.get("lat") or coords.get("lat")
                    act_lng = act.get("lng") or coords.get("lng")
                    act_prov = act.get("provenance") or (coords.get("provenance") if coords.get("found") else "CURATED_UNRESOLVED")

                    new_act = ItineraryActivity(
                        id=str(uuid.uuid4()),
                        day_id=db_day.id,
                        time_slot=act.get("time_slot") or act.get("time") or "10:00 AM",
                        description=act.get("description", ""),
                        location=loc_name,
                        place_type=act.get("place_type") or act.get("placeType") or "TA",
                        cost_estimate=float(act.get("cost_estimate") or act.get("costEstimate") or act.get("cost") or 0.0),
                        provenance=act_prov,
                        lat=act_lat,
                        lng=act_lng,
                        source_citation=act.get("source_citation") or "DashTiny Spatial Map Engine",
                        why_recommended=act.get("why_recommended") or act.get("whyRecommended"),
                        duration_minutes=act.get("duration_minutes") or act.get("durationMinutes") or 60,
                        transit_minutes=act.get("transit_minutes") or act.get("transitMinutes") or 0,
                        transit_mode=act.get("transit_mode") or act.get("transitMode") or "WALK",
                        transit_source=act.get("transit_source") or "ESTIMATED",
                        transit_confidence=act.get("transit_confidence") or "ESTIMATED",
                        timezone=act.get("timezone"),
                        start_at=_parse_iso_dt(act.get("start_at") or act.get("startAt")),
                        end_at=_parse_iso_dt(act.get("end_at") or act.get("endAt")),
                        estimated_transit=act.get("estimated_transit") or act.get("estimatedTransit"),
                        generation_source=act.get("generation_source") or act.get("generationSource") or "AI_GENERATED",
                        location_source=act.get("location_source") or act.get("locationSource") or "GEOCODED",
                        content_source=act.get("content_source") or act.get("contentSource") or "PLANNER_ACTION",
                        sort_order=idx
                    )
                    db.add(new_act)
                    db.flush()
                    retained_act_ids.add(new_act.id)

            # DELETE removed activities
            for act_id, act_obj in existing_acts.items():
                if act_id not in retained_act_ids:
                    db.delete(act_obj)


def record_initial_revision(
    db: Session,
    trip_id: str,
    user_id: str,
    model: str = "deterministic-planner-v1"
) -> Tuple[TripSnapshot, int]:
    """
    Records the authoritative initial revision v1 for a newly created trip.
    """
    trip = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not trip:
        raise ValueError(f"Trip {trip_id} not found")
    days_data = serialize_trip_days(trip)
    return create_revision(
        db=db,
        trip_id=trip_id,
        user_id=user_id,
        action_type="INITIAL_CREATION",
        days_data=days_data,
        summary="Initial trip creation and itinerary generation",
        instruction="Initial trip creation",
        model=model,
        actor_type="USER",
        parent_version=None
    )


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
    Append-Only Undo Implementation (Requirements 1, 2, 4, 5, 6).
    
    Invariants:
    1. Revisions are strictly append-only. Old revisions are NEVER modified or marked 'reverted'.
    2. Given current revision vN:
       - If vN is a normal mutation, target revision to restore is vN.parent_version.
       - If vN is already an UNDO revision (which restored vK), the next target to restore is vK.parent_version.
    3. Loads target revision vP (parent/target state).
    4. Applies vP.days_data to the Trip via apply_activity_diff().
    5. Appends a brand NEW revision v(N+1):
       - version = N + 1
       - parent_version = N
       - restored_from_version = vP.version
       - action_type = "UNDO"
       - action = "undo"
       - summary = f"Restored trip state to revision {vP.version}"
       - days_data = vP.days_data
    6. Commits / flushes atomically under the row lock.
    """
    # 1. Lock the parent Itinerary row
    trip = db.query(Itinerary).filter(Itinerary.id == trip_id).with_for_update().first()
    if not trip:
        raise ValueError(f"Trip {trip_id} not found")

    curr = get_current_revision(db, trip_id)
    if not curr:
        raise ValueError("No trip revisions found for this trip")

    if target_version is not None:
        target_snap = (
            db.query(TripSnapshot)
            .filter(TripSnapshot.trip_id == trip_id, TripSnapshot.version == target_version)
            .first()
        )
        if not target_snap:
            raise ValueError(f"Target revision v{target_version} not found")
    else:
        # Determine target version to restore following the parent_version chain
        if curr.action_type != "UNDO":
            target_ver = curr.parent_version
        else:
            base_ver = curr.restored_from_version or curr.parent_version
            if not base_ver:
                raise ValueError("No previous trip revision available to undo")
            base_snap = (
                db.query(TripSnapshot)
                .filter(TripSnapshot.trip_id == trip_id, TripSnapshot.version == base_ver)
                .first()
            )
            target_ver = base_snap.parent_version if base_snap else None

        if not target_ver or target_ver < 1:
            raise ValueError("No previous trip revision available to undo")

        target_snap = (
            db.query(TripSnapshot)
            .filter(TripSnapshot.trip_id == trip_id, TripSnapshot.version == target_ver)
            .first()
        )
        if not target_snap:
            raise ValueError(f"Target parent revision v{target_ver} not found")

    # 2. Apply target snapshot days_data to the database
    apply_activity_diff(db, trip, target_snap.days_data)

    # 3. Create a brand NEW append-only UNDO revision
    next_ver = curr.version + 1
    new_undo_snap = TripSnapshot(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        version=next_ver,
        parent_version=curr.version,
        restored_from_version=target_snap.version,
        user_id=user_id,
        action="undo",
        action_type="UNDO",
        actor_type="USER",
        instruction=f"Undo to revision {target_snap.version}",
        model="deterministic-planner-v1",
        summary=f"Restored trip state to revision {target_snap.version}",
        days_data=target_snap.days_data
    )
    db.add(new_undo_snap)
    db.flush()

    return new_undo_snap, target_snap.version
