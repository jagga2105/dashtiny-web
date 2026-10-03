from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.models import UserProfile, RewardTransaction

def award_rewards(
    db: Session,
    user_id: str,
    delta: int,
    reward_type: str,
    reason: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None
) -> Tuple[int, bool]:
    """
    Central Authoritative Reward Engine for DashTiny.
    Ensures that every coin modification updates the user's profile balance
    and persists an immutable RewardTransaction audit record within the current transaction.

    Enforces idempotency:
    If an idempotency_key is provided and has already been recorded in RewardTransaction,
    no duplicate coins are added, returning (current_balance, False).

    Returns:
        (balance_after, was_awarded: bool)
    """
    if idempotency_key:
        existing_tx = db.query(RewardTransaction).filter(
            RewardTransaction.idempotency_key == idempotency_key
        ).first()
        if existing_tx:
            profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
            current_balance = profile.reward_coins if profile else 0
            return current_balance, False

    # Concurrency safe: acquire row lock on UserProfile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).with_for_update().first()
    if not profile:
        profile = UserProfile(user_id=user_id, reward_coins=0)
        db.add(profile)
        db.flush()

    new_balance = max(0, (profile.reward_coins or 0) + delta)
    profile.reward_coins = new_balance

    tx = RewardTransaction(
        user_id=user_id,
        delta=delta,
        balance_after=new_balance,
        type=reward_type,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id,
        idempotency_key=idempotency_key,
        metadata_json=metadata_json or {}
    )
    db.add(tx)
    db.flush()

    return new_balance, True
