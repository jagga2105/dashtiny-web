from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.models import Itinerary, TripSnapshot


def allocate_and_create_trip_snapshot(
    db: Session,
    trip_id: str,
    user_id: str,
    days_data: List[Dict[str, Any]],
    action: str = "ai_query",
    action_type: str = "AI_MODIFY_ITINERARY",
    actor_type: str = "USER",
    instruction: Optional[str] = None,
    model: str = "deterministic-planner-v1",
    summary: Optional[str] = None
) -> Tuple[TripSnapshot, int]:
    """
    Concurrency-Safe Trip Snapshot Allocation:
    1. Locks the parent Itinerary row with with_for_update() to serialize
       version allocation per trip across concurrent transactions.
    2. Calculates max(version) under the exclusive parent row lock.
    3. Allocates next_version = max_version + 1.
    4. Adds TripSnapshot to session within caller's atomic transaction.
    5. Caller owns the transaction (atomic with trip mutation and AI audit logs).

    Returns:
        (TripSnapshot, allocated_version)
    """
    # 1. Lock the parent Trip row to serialize snapshot version allocation
    trip = db.query(Itinerary).filter(Itinerary.id == trip_id).with_for_update().first()
    if not trip:
        raise ValueError(f"Trip '{trip_id}' not found for snapshot version allocation")

    # 2. Query MAX version under row lock
    max_ver = db.query(func.max(TripSnapshot.version)).filter(
        TripSnapshot.trip_id == trip_id
    ).scalar() or 0
    next_ver = max_ver + 1

    # 3. Create snapshot with atomically allocated version
    instr_clean = instruction or ""
    snap_summary = summary or (
        f"Snapshot v{next_ver} before: {instr_clean[:60]}" if instr_clean else f"Snapshot v{next_ver}"
    )

    snapshot = TripSnapshot(
        trip_id=trip_id,
        version=next_ver,
        user_id=user_id,
        action=action,
        action_type=action_type,
        actor_type=actor_type,
        instruction=instruction,
        model=model,
        summary=snap_summary,
        days_data=days_data
    )
    db.add(snapshot)
    return snapshot, next_ver
