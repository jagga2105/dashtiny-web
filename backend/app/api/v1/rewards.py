from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import RewardVoucher, RewardTransaction, RewardRedemption, User, UserProfile
from app.api.deps import get_current_user

router = APIRouter(prefix="/rewards", tags=["Rewards & Gold Coin Vault"])

class RedeemVoucherRequest(BaseModel):
    voucher_id: str

@router.get("/vault")
def get_reward_vault(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pure read endpoint: Get user gold coin balance, active vouchers, and redemption status.
    Never mutates the database on GET requests.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    coins = profile.reward_coins if profile else 0

    vouchers = db.query(RewardVoucher).all()

    # Query existing redemptions for this user
    redemptions = db.query(RewardRedemption).filter(RewardRedemption.user_id == user.id).all()
    redeemed_voucher_ids = {r.voucher_id: r for r in redemptions}

    return {
        "gold_coins": coins,
        "current_tier": "Gold Explorer" if coins < 750 else "Platinum Wanderer",
        "next_tier": "Platinum Wanderer (750 coins)",
        "vouchers": [
            {
                "id": v.id,
                "brand": v.brand,
                "discount": v.discount,
                "coin_cost": v.coin_cost,
                "category": v.category,
                "code": v.code,
                "is_redeemed": v.id in redeemed_voucher_ids
            }
            for v in vouchers
        ],
        "my_redemptions": [
            {
                "id": r.id,
                "voucher_id": r.voucher_id,
                "voucher_code": r.voucher_code,
                "coins_spent": r.coins_spent,
                "status": r.status,
                "redeemed_at": str(r.redeemed_at)
            }
            for r in redemptions
        ]
    }

@router.post("/redeem")
def redeem_reward_voucher(
    request: RedeemVoucherRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Redeem voucher with concurrency protection:
    Acquires row lock on UserProfile first, checks for duplicate redemptions,
    validates coin balance, persists RewardRedemption + RewardTransaction,
    and commits atomically with defensive IntegrityError handling.
    """
    from sqlalchemy.exc import IntegrityError

    voucher = db.query(RewardVoucher).filter(RewardVoucher.id == request.voucher_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")

    # 1. Concurrency safe: acquire row lock on UserProfile FIRST
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).with_for_update().first()
    if not profile:
        profile = UserProfile(user_id=user.id, reward_coins=0)
        db.add(profile)
        db.flush()

    # 2. Check if already redeemed by this user AFTER acquiring lock
    existing_redemption = db.query(RewardRedemption).filter(
        RewardRedemption.user_id == user.id,
        RewardRedemption.voucher_id == voucher.id
    ).first()
    if existing_redemption:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have already redeemed this voucher ({existing_redemption.voucher_code}). Each voucher can only be unlocked once."
        )

    # 3. Check sufficient coin balance
    if (profile.reward_coins or 0) < voucher.coin_cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient Gold Coins. You have {profile.reward_coins or 0} coins, but need {voucher.coin_cost} coins."
        )

    # 4. Deduct balance
    profile.reward_coins -= voucher.coin_cost

    # 5. Persist redemption record
    redemption = RewardRedemption(
        user_id=user.id,
        voucher_id=voucher.id,
        coins_spent=voucher.coin_cost,
        voucher_code=voucher.code,
        status="redeemed"
    )
    db.add(redemption)

    # 6. Persist audit ledger transaction
    tx = RewardTransaction(
        user_id=user.id,
        delta=-voucher.coin_cost,
        balance_after=profile.reward_coins,
        type="VOUCHER_REDEEMED",
        reason=f"Redeemed {voucher.brand} voucher: {voucher.discount}",
        reference_type="reward_voucher",
        reference_id=voucher.id,
        idempotency_key=f"redemption_{user.id}_{voucher.id}",
        metadata_json={"voucher_code": voucher.code, "brand": voucher.brand, "coin_cost": voucher.coin_cost}
    )
    db.add(tx)

    # 7. Single atomic commit with defensive IntegrityError catch
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have already redeemed this voucher. Each voucher can only be unlocked once."
        )

    return {
        "status": "redeemed",
        "voucher_code": voucher.code,
        "brand": voucher.brand,
        "discount": voucher.discount,
        "remaining_coins": profile.reward_coins,
        "remaining_credits": profile.reward_coins,
        "message": f"Voucher unlocked! Use promo code {voucher.code} at checkout."
    }

@router.get("/transactions")
def get_reward_transactions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get audit ledger of reward coin movements for authenticated user.
    """
    txs = db.query(RewardTransaction).filter(
        RewardTransaction.user_id == user.id
    ).order_by(RewardTransaction.created_at.desc()).limit(50).all()
    return [
        {
            "id": tx.id,
            "delta": tx.delta,
            "balance_after": tx.balance_after,
            "type": tx.type,
            "reason": tx.reason,
            "reference_type": tx.reference_type,
            "reference_id": tx.reference_id,
            "created_at": str(tx.created_at)
        }
        for tx in txs
    ]
