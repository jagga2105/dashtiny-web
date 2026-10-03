from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import RewardVoucher, User, UserProfile
from app.api.deps import get_current_user

router = APIRouter(prefix="/rewards", tags=["Rewards & Gold Coin Vault"])

class RedeemVoucherRequest(BaseModel):
    voucher_id: str

def ensure_vouchers(db: Session):
    defaults = [
        RewardVoucher(
            id="vch_01",
            brand="Taj Hotels & Palaces",
            discount="₹3,000 Off Luxury Stays",
            coin_cost=150,
            category="Stays",
            code="TAJ-DASHTINY-3K"
        ),
        RewardVoucher(
            id="vch_02",
            brand="IndiGo Getaway Pass",
            discount="15% Cashback on Flights",
            coin_cost=200,
            category="Flights",
            code="6E-ESCAPE-15"
        ),
        RewardVoucher(
            id="vch_03",
            brand="Airbnb Sanctuaries",
            discount="₹2,500 Squad Discount",
            coin_cost=100,
            category="Villas",
            code="AIRBNB-SQUAD-25"
        )
    ]
    for d in defaults:
        existing = db.query(RewardVoucher).filter(RewardVoucher.id == d.id).first()
        if not existing:
            db.add(d)
    db.commit()
    return db.query(RewardVoucher).all()

@router.get("/vault")
def get_reward_vault(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user gold coin balance, active vouchers, and earn challenges.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id, reward_coins=300)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    coins = profile.reward_coins
    vouchers = ensure_vouchers(db)

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
                "code": v.code
            }
            for v in vouchers
        ]
    }

@router.post("/redeem")
def redeem_reward_voucher(
    request: RedeemVoucherRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Redeem voucher and deduct reward coins from PostgreSQL.
    """
    ensure_vouchers(db)
    voucher = db.query(RewardVoucher).filter(RewardVoucher.id == request.voucher_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")

    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id, reward_coins=300)
        db.add(profile)
        db.commit()

    if profile.reward_coins < voucher.coin_cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient Gold Coins. You have {profile.reward_coins} coins, but need {voucher.coin_cost} coins."
        )

    profile.reward_coins -= voucher.coin_cost
    db.commit()

    return {
        "status": "redeemed",
        "voucher_code": voucher.code,
        "brand": voucher.brand,
        "discount": voucher.discount,
        "remaining_coins": profile.reward_coins,
        "remaining_credits": profile.reward_coins,
        "message": f"Voucher unlocked! Use promo code {voucher.code} at checkout."
    }
