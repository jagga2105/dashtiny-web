import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.api.v1.auth import get_current_user
from app.models.models import User, Itinerary, SquadRoom, SquadMember, SquadExpense

router = APIRouter(prefix="/squads", tags=["Squad Co-Exploration & Split Ledger"])


# --- Schemas ---
class CreateSquadRequest(BaseModel):
    itinerary_id: str
    room_code: Optional[str] = None


class AddMemberRequest(BaseModel):
    user_id: str
    role: Optional[str] = "member"


class TransferOwnershipRequest(BaseModel):
    new_owner_id: str


class AddExpenseRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., gt=0, description="Expense amount must be greater than 0")
    category: str = Field(..., min_length=1, max_length=50)
    paid_by_user_id: Optional[str] = None


# --- Helper ---
def _get_squad_and_membership(squad_id: str, user: User, db: Session):
    squad = db.query(SquadRoom).filter(SquadRoom.id == squad_id).first()
    if not squad:
        raise HTTPException(status_code=404, detail="Squad room not found")

    membership = (
        db.query(SquadMember)
        .filter(SquadMember.squad_id == squad_id, SquadMember.user_id == user.id)
        .first()
    )

    itinerary = db.query(Itinerary).filter(Itinerary.id == squad.itinerary_id).first()
    is_trip_owner = itinerary and itinerary.owner_id == user.id

    if not membership and not is_trip_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not a member of this squad or trip owner."
        )

    return squad, membership, is_trip_owner


# --- Endpoints ---
@router.post("", status_code=status.HTTP_201_CREATED)
def create_squad(
    request: CreateSquadRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a squad room attached to an itinerary.
    User must be the trip owner.
    Serializes creation under Itinerary row lock to prevent race conditions.
    """
    itinerary = (
        db.query(Itinerary)
        .filter(Itinerary.id == request.itinerary_id)
        .with_for_update()
        .first()
    )
    if not itinerary:
        raise HTTPException(status_code=404, detail="Trip not found")

    if itinerary.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the trip owner can create a squad room."
        )

    existing = db.query(SquadRoom).filter(SquadRoom.itinerary_id == request.itinerary_id).first()
    if existing:
        return {
            "status": "exists",
            "message": "Squad room already exists for this trip",
            "squad_id": existing.id,
            "room_code": existing.room_code
        }

    room_code = request.room_code or f"SQUAD-{uuid.uuid4().hex[:6].upper()}"

    squad = SquadRoom(
        itinerary_id=itinerary.id,
        room_code=room_code
    )
    db.add(squad)

    try:
        db.flush()
        # Server rule: Creator is unconditionally the squad owner
        owner_member = SquadMember(
            squad_id=squad.id,
            user_id=user.id,
            role="owner"
        )
        db.add(owner_member)
        db.commit()
        db.refresh(squad)
    except IntegrityError:
        db.rollback()
        # Handle concurrent race where another transaction created the room
        existing = db.query(SquadRoom).filter(SquadRoom.itinerary_id == request.itinerary_id).first()
        if existing:
            return {
                "status": "exists",
                "message": "Squad room already exists for this trip",
                "squad_id": existing.id,
                "room_code": existing.room_code
            }
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Squad room or code conflict occurred during creation."
        )

    return {
        "status": "success",
        "squad_id": squad.id,
        "itinerary_id": squad.itinerary_id,
        "room_code": squad.room_code,
        "created_at": str(squad.created_at)
    }


@router.get("/{squad_id}")
def get_squad(
    squad_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get squad room details.
    """
    squad, membership, is_owner = _get_squad_and_membership(squad_id, user, db)
    members_count = db.query(func.count(SquadMember.id)).filter(SquadMember.squad_id == squad.id).scalar() or 0

    return {
        "id": squad.id,
        "itinerary_id": squad.itinerary_id,
        "room_code": squad.room_code,
        "members_count": members_count,
        "created_at": str(squad.created_at)
    }


@router.get("/{squad_id}/members")
def get_squad_members(
    squad_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List members of a squad.
    """
    squad, _, _ = _get_squad_and_membership(squad_id, user, db)
    members = db.query(SquadMember).filter(SquadMember.squad_id == squad.id).all()

    return [
        {
            "id": m.id,
            "user_id": m.user_id,
            "name": m.user.full_name if m.user else "Explorer",
            "email": m.user.email if m.user else "",
            "role": m.role,
            "joined_at": str(m.joined_at)
        }
        for m in members
    ]


@router.post("/{squad_id}/members", status_code=status.HTTP_201_CREATED)
def add_squad_member(
    squad_id: str,
    request: AddMemberRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a member to the squad room.
    Only squad owner or trip owner can add members.
    Server rule: invited member role is always 'member' (client role is ignored).
    """
    squad, membership, is_trip_owner = _get_squad_and_membership(squad_id, user, db)

    is_squad_owner = membership and membership.role == "owner"
    if not is_squad_owner and not is_trip_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the squad owner can add members."
        )

    target_user = db.query(User).filter(User.id == request.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    existing_member = (
        db.query(SquadMember)
        .filter(SquadMember.squad_id == squad_id, SquadMember.user_id == request.user_id)
        .first()
    )
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this squad."
        )

    # Server rule: Client input must NEVER be trusted to assign privileged roles.
    # Invited member is strictly assigned role="member".
    new_member = SquadMember(
        squad_id=squad.id,
        user_id=request.user_id,
        role="member"
    )
    db.add(new_member)
    try:
        db.commit()
        db.refresh(new_member)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this squad."
        )

    return {
        "status": "success",
        "member_id": new_member.id,
        "user_id": new_member.user_id,
        "role": new_member.role,
        "joined_at": str(new_member.joined_at)
    }


@router.post("/{squad_id}/transfer-ownership")
def transfer_squad_ownership(
    squad_id: str,
    request: TransferOwnershipRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Privileged operation: Transfer squad ownership to another active squad member.
    Can only be performed by the current squad owner or trip owner.
    """
    squad, membership, is_trip_owner = _get_squad_and_membership(squad_id, user, db)

    is_squad_owner = membership and membership.role == "owner"
    if not is_squad_owner and not is_trip_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the current squad owner or trip owner can transfer ownership."
        )

    if user.id == request.new_owner_id:
        return {"status": "success", "message": "User is already the owner"}

    target_member = (
        db.query(SquadMember)
        .filter(SquadMember.squad_id == squad_id, SquadMember.user_id == request.new_owner_id)
        .with_for_update()
        .first()
    )
    if not target_member:
        raise HTTPException(
            status_code=404,
            detail="Target user is not an active member of this squad."
        )

    # Demote previous squad owners to member
    current_owners = (
        db.query(SquadMember)
        .filter(SquadMember.squad_id == squad_id, SquadMember.role == "owner")
        .with_for_update()
        .all()
    )
    for owner in current_owners:
        owner.role = "member"

    target_member.role = "owner"
    db.commit()

    return {
        "status": "success",
        "message": f"Squad ownership successfully transferred to user {request.new_owner_id}",
        "new_owner_id": request.new_owner_id
    }


@router.delete("/{squad_id}/members/{user_id}")
def remove_squad_member(
    squad_id: str,
    user_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a member from the squad room.
    Owner can remove any member; members can remove themselves.
    """
    squad, membership, is_trip_owner = _get_squad_and_membership(squad_id, user, db)

    is_squad_owner = membership and membership.role == "owner"
    is_self = user.id == user_id

    if not is_squad_owner and not is_trip_owner and not is_self:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to remove this member."
        )

    target_membership = (
        db.query(SquadMember)
        .filter(SquadMember.squad_id == squad_id, SquadMember.user_id == user_id)
        .first()
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="Member not found in squad")

    db.delete(target_membership)
    db.commit()

    return {"status": "success", "message": "Member removed from squad"}


@router.get("/{squad_id}/expenses")
def list_squad_expenses(
    squad_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all expenses recorded for the squad.
    """
    squad, _, _ = _get_squad_and_membership(squad_id, user, db)

    expenses = (
        db.query(SquadExpense)
        .filter(SquadExpense.squad_id == squad.id)
        .order_by(SquadExpense.created_at.desc())
        .all()
    )

    return [
        {
            "id": e.id,
            "description": e.description,
            "amount": float(e.amount),
            "category": e.category,
            "paid_by_user_id": e.paid_by_user_id,
            "paid_by_name": e.paid_by_user.full_name if e.paid_by_user else "Explorer",
            "created_at": str(e.created_at)
        }
        for e in expenses
    ]


@router.post("/{squad_id}/expenses", status_code=status.HTTP_201_CREATED)
def add_squad_expense(
    squad_id: str,
    request: AddExpenseRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record an expense in the squad split ledger.
    Rejects negative or 0 amounts.
    Payer must be a valid squad member.
    """
    if request.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expense amount must be strictly positive (> 0)."
        )

    # Lock squad row to serialize concurrent expense balance calculations
    squad = db.query(SquadRoom).filter(SquadRoom.id == squad_id).with_for_update().first()
    if not squad:
        raise HTTPException(status_code=404, detail="Squad room not found")

    _get_squad_and_membership(squad_id, user, db)

    payer_id = request.paid_by_user_id or user.id
    payer_member = (
        db.query(SquadMember)
        .filter(SquadMember.squad_id == squad_id, SquadMember.user_id == payer_id)
        .first()
    )
    if not payer_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payer {payer_id} is not an active squad member."
        )

    expense = SquadExpense(
        squad_id=squad.id,
        paid_by_user_id=payer_id,
        description=request.description.strip(),
        amount=round(request.amount, 2),
        category=request.category.strip().lower()
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    return {
        "status": "success",
        "expense": {
            "id": expense.id,
            "description": expense.description,
            "amount": float(expense.amount),
            "category": expense.category,
            "paid_by": expense.paid_by_user_id,
            "created_at": str(expense.created_at)
        }
    }


@router.get("/{squad_id}/summary")
def get_squad_summary(
    squad_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authoritative financial split calculations:
    - Calculates exact total spent from PostgreSQL squad_expenses
    - Calculates exact per-person equal share across all squad_members
    - Computes net balance (paid - share) for each squad member
    """
    squad, _, _ = _get_squad_and_membership(squad_id, user, db)

    members = db.query(SquadMember).filter(SquadMember.squad_id == squad.id).all()
    member_count = len(members)

    total_spent_val = (
        db.query(func.coalesce(func.sum(SquadExpense.amount), Decimal(0)))
        .filter(SquadExpense.squad_id == squad.id)
        .scalar()
    )
    total_spent = float(total_spent_val)

    per_person_share = round(total_spent / member_count, 2) if member_count > 0 else 0.0

    # Calculate spent per member
    spending_by_user = dict(
        db.query(SquadExpense.paid_by_user_id, func.sum(SquadExpense.amount))
        .filter(SquadExpense.squad_id == squad.id)
        .group_by(SquadExpense.paid_by_user_id)
        .all()
    )

    member_summaries = []
    for m in members:
        paid = float(spending_by_user.get(m.user_id, Decimal(0)))
        balance = round(paid - per_person_share, 2)
        member_summaries.append({
            "id": m.user_id,
            "name": m.user.full_name if m.user else "Explorer",
            "email": m.user.email if m.user else "",
            "role": m.role,
            "paid": paid,
            "balance": balance
        })

    return {
        "squad_id": squad.id,
        "room_code": squad.room_code,
        "total_spent": total_spent,
        "member_count": member_count,
        "per_person_share": per_person_share,
        "members": member_summaries
    }
