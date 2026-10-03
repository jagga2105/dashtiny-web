from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.models import UserProfile, RewardTransaction


class InsufficientRewardBalanceError(ValueError):
    """
    Controlled domain exception raised when a reward coin/credit deduction exceeds available balance.
    Inherits from ValueError to preserve backward-compatibility with generic exception handlers.
    """
    def __init__(self, current_balance: int, delta: int, message: Optional[str] = None):
        self.current_balance = current_balance
        self.delta = delta
        self.required_deduction = abs(delta)
        msg = message or (
            f"Insufficient reward coins. Required deduction: {self.required_deduction}, "
            f"Available balance: {current_balance}"
        )
        super().__init__(msg)


# Semantic domain alias
InsufficientCreditsError = InsufficientRewardBalanceError


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

    Lock Order & Concurrency Design:
    1. Lock UserProfile row first (via with_for_update()).
    2. Check idempotency key: if existing, return (current_balance, False).
    3. Validate that negative awards do not exceed balance (no silent clamping to 0).
       Raises InsufficientRewardBalanceError immediately without mutating balance
       or creating any transaction records, leaving caller transactions rollback-safe.
    4. Persist RewardTransaction and update balance.
    5. Defensively handle IntegrityError for concurrent duplicate idempotency keys.
    6. Caller owns the transaction (no commit inside award_rewards).

    Returns:
        (balance_after, was_awarded: bool)
    """
    # 1. Acquire row lock on UserProfile FIRST to serialize concurrent requests for this user
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).with_for_update().first()
    current_balance = (profile.reward_coins or 0) if profile else 0

    # 2. Check idempotency key inside the row lock
    if idempotency_key:
        existing_tx = db.query(RewardTransaction).filter(
            RewardTransaction.idempotency_key == idempotency_key
        ).first()
        if existing_tx:
            return current_balance, False

    # 3. Reject negative deductions when balance is insufficient (no silent clamping to 0)
    if delta < 0 and (current_balance + delta) < 0:
        raise InsufficientRewardBalanceError(
            current_balance=current_balance,
            delta=delta
        )

    # Ensure profile row exists now that validation has passed
    if not profile:
        profile = UserProfile(user_id=user_id, reward_coins=0)
        db.add(profile)
        db.flush()

    new_balance = current_balance + delta
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

    try:
        # Use a SAVEPOINT to defensively catch duplicate idempotency_key races without invalidating outer transaction
        with db.begin_nested():
            db.add(tx)
            db.flush()
    except IntegrityError:
        # Re-query balance in case of concurrent duplicate key resolution
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        return (profile.reward_coins if profile else current_balance), False

    return new_balance, True
