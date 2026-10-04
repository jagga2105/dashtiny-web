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
from app.models.models import (
    User, Itinerary, SquadRoom, SquadMember, SquadExpense,
    SquadSuggestion, SquadVote, TripProposal
)
from app.services.planner.squad_aggregator import SquadProfileAggregator
from app.api.v1.ai import create_ai_proposal, accept_ai_proposal, AIProposalRequest
from app.services.trip_revision_service import get_current_version, record_initial_revision
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/squads", tags=["Squad Co-Exploration & Split Ledger"])


# --- Schemas ---
class CreateSquadRequest(BaseModel):
    itinerary_id: str
    room_code: Optional[str] = None


class AddMemberRequest(BaseModel):
    user_id: str
    role: Optional[str] = "member"


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(co_planner|member)$")


class TransferOwnershipRequest(BaseModel):
    new_owner_id: str


class AddExpenseRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., gt=0, description="Expense amount must be greater than 0")
    category: str = Field(..., min_length=1, max_length=50)
    paid_by_user_id: Optional[str] = None


class CreateSuggestionRequest(BaseModel):
    instruction: str = Field(..., min_length=3, max_length=1000, description="Natural language suggestion for DAIna")


class VoteSuggestionRequest(BaseModel):
    vote: str = Field(..., pattern="^(up|down)$")


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


@router.get("/{squad_id}/profile")
def get_squad_profile(
    squad_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get aggregated consensus profile for the squad:
    - Member roster with pace and individual preferences
    - Harmonized group pace (respects slowest/relaxed member)
    - Shared passions and ranked interests
    - Universal exclusions (dislikes of any member with attribution)
    - Shared likes and dietary constraints
    - Human-readable narrative explanation
    """
    _get_squad_and_membership(squad_id, user, db)
    try:
        profile = SquadProfileAggregator.aggregate_squad_profile(squad_id, db)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/by-trip/{trip_id}")
def get_squad_by_trip(
    trip_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lookup the squad room for a trip. If caller is trip owner and no room exists yet,
    initializes one deterministically.
    """
    itinerary = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not itinerary:
        raise HTTPException(status_code=404, detail="Trip not found")

    squad = db.query(SquadRoom).filter(SquadRoom.itinerary_id == itinerary.id).first()
    if not squad:
        if itinerary.owner_id == user.id:
            # Auto-create squad room for trip owner
            code = f"SQUAD-{uuid.uuid4().hex[:6].upper()}"
            squad = SquadRoom(itinerary_id=itinerary.id, room_code=code)
            db.add(squad)
            db.flush()
            owner_member = SquadMember(squad_id=squad.id, user_id=user.id, role="owner")
            db.add(owner_member)
            db.commit()
            db.refresh(squad)
        else:
            raise HTTPException(status_code=404, detail="No squad room found for this trip")

    # Authorize caller
    _get_squad_and_membership(squad.id, user, db)
    return SquadProfileAggregator.aggregate_squad_profile(squad.id, db)


@router.put("/{squad_id}/members/{user_id}/role")
def update_member_role(
    squad_id: str,
    user_id: str,
    request: UpdateMemberRoleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update member role in the squad.
    Only the squad owner or trip owner can promote/demote roles between 'co_planner' and 'member'.
    """
    squad, membership, is_trip_owner = _get_squad_and_membership(squad_id, user, db)

    is_squad_owner = membership and membership.role == "owner"
    if not is_squad_owner and not is_trip_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the squad owner can manage member roles."
        )

    target = (
        db.query(SquadMember)
        .filter(SquadMember.squad_id == squad_id, SquadMember.user_id == user_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Member not found in squad")

    if target.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change owner role with this endpoint. Use /transfer-ownership instead."
        )

    target.role = request.role
    db.commit()
    db.refresh(target)

    return {
        "status": "success",
        "member_id": target.id,
        "user_id": target.user_id,
        "new_role": target.role
    }


# --- Squad Suggestions & DAIna Proposals Flow ---
@router.post("/{squad_id}/suggestions", status_code=status.HTTP_201_CREATED)
def create_squad_suggestion(
    squad_id: str,
    request: CreateSuggestionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a suggestion from a squad member to DAIna to propose an itinerary change.
    1. Validates caller is member of the squad.
    2. Ensures the trip has a baseline revision initialized (v1).
    3. Calls create_ai_proposal to generate structured diff and TripProposal record.
    4. Creates SquadSuggestion attached to the squad and proposal.
    5. Automatically records author's upvote.
    6. Returns the suggestion object with DAIna diff preview and vote tally.
    """
    squad, membership, is_trip_owner = _get_squad_and_membership(squad_id, user, db)

    itinerary = db.query(Itinerary).filter(Itinerary.id == squad.itinerary_id).first()
    if not itinerary:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Ensure baseline revision v1 exists for parent locking
    curr_version = get_current_version(db, itinerary.id)
    if curr_version == 0:
        record_initial_revision(db, itinerary.id, itinerary.owner_id)

    # Generate proposal via DAIna action engine
    proposal_resp = create_ai_proposal(
        AIProposalRequest(
            trip_id=itinerary.id,
            instruction=request.instruction.strip(),
            proposal_type="ITINERARY_DIFF"
        ),
        user=user,
        db=db
    )
    proposal_id = proposal_resp.get("proposal_id")

    suggestion = SquadSuggestion(
        squad_id=squad.id,
        user_id=user.id,
        instruction=request.instruction.strip(),
        status="proposal_generated",
        proposal_id=proposal_id
    )
    db.add(suggestion)
    db.flush()

    # Author automatically upvotes their own suggestion
    author_vote = SquadVote(
        squad_id=squad.id,
        suggestion_id=suggestion.id,
        proposal_id=proposal_id,
        user_id=user.id,
        vote="up"
    )
    db.add(author_vote)

    # Notify other squad members of the new suggestion
    NotificationService.notify_squad_suggestion_created(
        db=db,
        squad=squad,
        author=user,
        instruction=suggestion.instruction,
        suggestion_id=suggestion.id
    )

    db.commit()
    db.refresh(suggestion)

    proposal = db.query(TripProposal).filter(TripProposal.id == proposal_id).first() if proposal_id else None

    return {
        "status": "success",
        "suggestion": {
            "id": suggestion.id,
            "squad_id": suggestion.squad_id,
            "user_id": suggestion.user_id,
            "author_name": user.full_name or "Explorer",
            "author_avatar": user.avatar_url,
            "instruction": suggestion.instruction,
            "status": suggestion.status,
            "proposal_id": proposal_id,
            "proposal_summary": proposal.summary if proposal else proposal_resp.get("summary", ""),
            "changes_diff": proposal.changes if proposal else proposal_resp.get("changes", []),
            "parent_version": proposal.parent_version if proposal else proposal_resp.get("parent_version", 1),
            "upvotes": 1,
            "downvotes": 0,
            "user_vote": "up",
            "created_at": str(suggestion.created_at)
        }
    }


@router.get("/{squad_id}/suggestions")
def list_squad_suggestions(
    squad_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all suggestions and DAIna proposals for the squad room.
    Includes vote tallies, proposal diffs, and the caller's vote status.
    """
    squad, _, _ = _get_squad_and_membership(squad_id, user, db)

    suggestions = (
        db.query(SquadSuggestion)
        .filter(SquadSuggestion.squad_id == squad.id)
        .order_by(SquadSuggestion.created_at.desc())
        .all()
    )

    results = []
    for s in suggestions:
        author = db.query(User).filter(User.id == s.user_id).first()
        proposal = db.query(TripProposal).filter(TripProposal.id == s.proposal_id).first() if s.proposal_id else None

        votes = db.query(SquadVote).filter(SquadVote.suggestion_id == s.id).all()
        upvotes = sum(1 for v in votes if v.vote == "up")
        downvotes = sum(1 for v in votes if v.vote == "down")
        my_vote_rec = next((v for v in votes if v.user_id == user.id), None)
        my_vote = my_vote_rec.vote if my_vote_rec else None

        results.append({
            "id": s.id,
            "squad_id": s.squad_id,
            "user_id": s.user_id,
            "author_name": author.full_name if author else "Explorer",
            "author_avatar": author.avatar_url if author else None,
            "instruction": s.instruction,
            "status": s.status,
            "proposal_id": s.proposal_id,
            "proposal_status": proposal.status if proposal else None,
            "proposal_summary": proposal.summary if proposal else None,
            "changes_diff": proposal.changes if proposal else [],
            "parent_version": proposal.parent_version if proposal else None,
            "upvotes": upvotes,
            "downvotes": downvotes,
            "user_vote": my_vote,
            "created_at": str(s.created_at),
            "updated_at": str(s.updated_at)
        })

    return results


@router.post("/{squad_id}/suggestions/{suggestion_id}/vote")
def vote_squad_suggestion(
    squad_id: str,
    suggestion_id: str,
    request: VoteSuggestionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Squad members vote up or down on a suggestion.
    """
    squad, _, _ = _get_squad_and_membership(squad_id, user, db)

    suggestion = (
        db.query(SquadSuggestion)
        .filter(SquadSuggestion.id == suggestion_id, SquadSuggestion.squad_id == squad.id)
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found in this squad")

    if suggestion.status in ("accepted", "rejected", "withdrawn"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Voting is closed because this suggestion is {suggestion.status}."
        )

    existing_vote = (
        db.query(SquadVote)
        .filter(SquadVote.suggestion_id == suggestion.id, SquadVote.user_id == user.id)
        .first()
    )
    if existing_vote:
        existing_vote.vote = request.vote
    else:
        new_vote = SquadVote(
            squad_id=squad.id,
            suggestion_id=suggestion.id,
            proposal_id=suggestion.proposal_id,
            user_id=user.id,
            vote=request.vote
        )
        db.add(new_vote)

    db.commit()

    votes = db.query(SquadVote).filter(SquadVote.suggestion_id == suggestion.id).all()
    upvotes = sum(1 for v in votes if v.vote == "up")
    downvotes = sum(1 for v in votes if v.vote == "down")

    return {
        "status": "success",
        "suggestion_id": suggestion.id,
        "upvotes": upvotes,
        "downvotes": downvotes,
        "user_vote": request.vote
    }


@router.post("/{squad_id}/suggestions/{suggestion_id}/accept")
def accept_squad_suggestion(
    squad_id: str,
    suggestion_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Commits an AI proposal into the canonical itinerary as revision v(N+1).
    Privilege check: Only the squad owner, co-planners, or trip owner can accept suggestions.
    """
    squad, membership, is_trip_owner = _get_squad_and_membership(squad_id, user, db)

    is_squad_owner = membership and membership.role == "owner"
    is_co_planner = membership and membership.role == "co_planner"

    if not is_squad_owner and not is_co_planner and not is_trip_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the squad owner, co-planners, or trip owner can accept suggestions into the itinerary."
        )

    suggestion = (
        db.query(SquadSuggestion)
        .filter(SquadSuggestion.id == suggestion_id, SquadSuggestion.squad_id == squad.id)
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found in this squad")

    if suggestion.status == "accepted":
        raise HTTPException(status_code=400, detail="Suggestion has already been accepted.")

    if not suggestion.proposal_id:
        raise HTTPException(status_code=400, detail="Suggestion has no associated AI proposal to accept.")

    # Call canonical accept_ai_proposal
    acceptance_result = accept_ai_proposal(
        proposal_id=suggestion.proposal_id,
        user=user,
        db=db
    )

    suggestion.status = "accepted"

    # Notify squad members of canonical revision update
    new_ver = get_current_version(db, squad.itinerary_id)
    NotificationService.notify_itinerary_revised(
        db=db,
        squad=squad,
        actor=user,
        new_version=new_ver
    )

    db.commit()

    return {
        "status": "success",
        "message": "Suggestion accepted and itinerary updated to new revision.",
        "suggestion_id": suggestion.id,
        "acceptance": acceptance_result
    }


@router.post("/{squad_id}/suggestions/{suggestion_id}/reject")
def reject_squad_suggestion(
    squad_id: str,
    suggestion_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Rejects/discards a suggestion.
    Allowed by squad owner, co-planner, trip owner, or the suggestion author.
    """
    squad, membership, is_trip_owner = _get_squad_and_membership(squad_id, user, db)

    suggestion = (
        db.query(SquadSuggestion)
        .filter(SquadSuggestion.id == suggestion_id, SquadSuggestion.squad_id == squad.id)
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found in this squad")

    is_squad_owner = membership and membership.role == "owner"
    is_co_planner = membership and membership.role == "co_planner"
    is_author = suggestion.user_id == user.id

    if not is_squad_owner and not is_co_planner and not is_trip_owner and not is_author:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to reject this suggestion."
        )

    if suggestion.proposal_id:
        proposal = db.query(TripProposal).filter(TripProposal.id == suggestion.proposal_id).first()
        if proposal and proposal.status == "pending":
            proposal.status = "rejected"

    suggestion.status = "rejected"
    db.commit()

    return {
        "status": "success",
        "message": "Suggestion rejected.",
        "suggestion_id": suggestion.id
    }
