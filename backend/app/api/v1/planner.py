"""
DashTiny AI Planner API (backend/app/api/v1/planner.py)
Orchestrates:
1. POST /api/v1/planner/parse-intent: Natural language prompt -> structured intent + clarification
2. POST /api/v1/planner/proposals: Non-mutating structured itinerary proposal generation (with long-trip chunking)
3. POST /api/v1/planner/proposals/{proposal_id}/accept: Authoritative commit creating Trip + v1 revision
4. POST /api/v1/planner/proposals/{proposal_id}/reject: Discard proposal without modifying any Trip
5. POST /api/v1/planner/proposals/{proposal_id}/edit: Partial day editing creating structured diffs
6. POST /api/v1/planner/generate: Backward-compatible endpoint for existing test suite
"""
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import User
from app.api.deps import get_current_user
from app.ai.agents.planner_agent import build_itinerary_with_planner_agent
from app.services.planner.intent import parse_travel_intent, IntentClarificationResponse
from app.services.planner.proposal_service import ProposalService
from app.services.planner.budget_engine import BudgetEngine, BudgetBreakdown


router = APIRouter(prefix="/planner", tags=["DAIna AI Getaway Architect"])


class ParseIntentRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)


class ItineraryProposalRequest(BaseModel):
    destination: str = Field(..., min_length=1, max_length=200)
    origin: Optional[str] = Field(None, max_length=200)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_count: int = Field(4, ge=1, le=30)
    travellers: int = Field(2, ge=1, le=50)
    budget: float = Field(0.0, ge=0.0, le=100_000_000.0)
    currency: str = Field("INR", max_length=10)
    pace: str = Field("balanced", max_length=50)  # relaxed, balanced, packed
    persona: str = Field("solo", max_length=50)
    vibe: Optional[str] = Field(None, max_length=100)
    interests: Optional[List[str]] = None
    wake_up_preference: str = Field("balanced", max_length=50)
    accommodation_preference: str = Field("comfort", max_length=50)
    transport_preference: str = Field("mix", max_length=50)
    food_preferences: Optional[List[str]] = None
    raw_prompt: Optional[str] = None


class PartialEditRequest(BaseModel):
    instruction: str = Field(..., min_length=1, max_length=500)
    target_day: Optional[int] = Field(None, ge=1, le=30)


class PlannerRequest(BaseModel):
    destination: str = Field(..., min_length=1, max_length=200)
    origin: Optional[str] = Field(None, max_length=200)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_count: int = Field(4, ge=1, le=30)
    travellers: int = Field(2, ge=1, le=50)
    budget: float = Field(0.0, ge=0.0, le=100_000_000.0)
    currency: str = Field("INR", max_length=10)
    persona: str = Field("solo", max_length=50)
    vibe: Optional[str] = Field(None, max_length=100)
    interests: Optional[List[str]] = None
    raw_prompt: Optional[str] = None
    prompt: Optional[str] = None


# Backward compatibility alias
GenerateItineraryRequest = PlannerRequest


@router.post("/parse-intent", response_model=IntentClarificationResponse)
def parse_intent_endpoint(request: ParseIntentRequest):
    """
    Parses natural language prompt into structured travel intent,
    identifies what was understood, and highlights any missing critical or optional information.
    """
    return parse_travel_intent(request.prompt)


@router.post("/proposals")
def create_itinerary_proposal_endpoint(
    request: ItineraryProposalRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates a structured, multi-day itinerary proposal:
    - Chunked generation for trips > 4 days (e.g. 7 days, 14 days)
    - Validates against duplicate activities, time overlaps, and ping-pong transit
    - Produces itemized category budget breakdown with guardrails
    - Does NOT mutate any Trip in the database!
    """
    # Validate dates
    if request.start_date:
        try:
            sd = date.fromisoformat(request.start_date.split("T")[0])
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid start_date '{request.start_date}'. Expected format: YYYY-MM-DD"
            )
    if request.end_date:
        try:
            ed = date.fromisoformat(request.end_date.split("T")[0])
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid end_date '{request.end_date}'. Expected format: YYYY-MM-DD"
            )
    if request.start_date and request.end_date:
        if ed < sd:
            raise HTTPException(
                status_code=422,
                detail="Inconsistent dates: end_date cannot be earlier than start_date"
            )

    return ProposalService.create_itinerary_proposal(
        destination=request.destination,
        days_count=request.days_count,
        origin=request.origin,
        start_date_str=request.start_date,
        end_date_str=request.end_date,
        travelers=request.travellers,
        budget=request.budget,
        currency=request.currency,
        pace=request.pace,
        persona=request.persona,
        vibe=request.vibe,
        interests=request.interests,
        wake_up_preference=request.wake_up_preference,
        accommodation_preference=request.accommodation_preference,
        food_preferences=request.food_preferences,
        user_id=user.id
    )


@router.get("/proposals/{proposal_id}")
def get_proposal_endpoint(
    proposal_id: str,
    user: User = Depends(get_current_user)
):
    """
    Retrieves proposal state for review.
    """
    proposal = ProposalService.get_proposal(proposal_id)
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proposal '{proposal_id}' not found."
        )
    return proposal


@router.post("/proposals/{proposal_id}/accept")
def accept_proposal_endpoint(
    proposal_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authoritative acceptance:
    - Atomically creates the Itinerary in PostgreSQL
    - Records initial append-only TripRevision v1
    - Returns the created Trip
    """
    return ProposalService.accept_proposal(
        proposal_id=proposal_id,
        user=user,
        db=db
    )


@router.post("/proposals/{proposal_id}/reject")
def reject_proposal_endpoint(
    proposal_id: str,
    user: User = Depends(get_current_user)
):
    """
    Discards proposal without modifying any Trip.
    """
    return ProposalService.reject_proposal(proposal_id)


@router.post("/proposals/{proposal_id}/edit")
def edit_proposal_endpoint(
    proposal_id: str,
    request: PartialEditRequest,
    user: User = Depends(get_current_user)
):
    """
    Applies partial AI modification to specific day while preserving all unrelated days and user edits.
    Returns a new proposal with diffs.
    """
    return ProposalService.propose_partial_edit(
        proposal_id=proposal_id,
        instruction=request.instruction,
        target_day=request.target_day
    )


@router.post("/generate")
def generate_itinerary(
    request: PlannerRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate dynamic getaway itinerary tailored to any destination via Planner Agent and persist in PostgreSQL.
    Consumes complete PlannerRequest, validating date consistency and threading travellers to tools.
    Preserved for 100% backward compatibility with existing tests.
    """
    if request.start_date:
        try:
            sd = datetime.strptime(request.start_date.split("T")[0], "%Y-%m-%d").date()
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid start_date '{request.start_date}'. Expected format: YYYY-MM-DD"
            )

    if request.end_date:
        try:
            ed = datetime.strptime(request.end_date.split("T")[0], "%Y-%m-%d").date()
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid end_date '{request.end_date}'. Expected format: YYYY-MM-DD"
            )

    if request.start_date and request.end_date:
        if ed < sd:
            raise HTTPException(
                status_code=422,
                detail="Inconsistent dates: end_date cannot be earlier than start_date"
            )

    return build_itinerary_with_planner_agent(
        destination=request.destination,
        budget=request.budget,
        days_count=request.days_count,
        persona=request.persona,
        user=user,
        db=db,
        start_date_str=request.start_date,
        end_date_str=request.end_date,
        origin=request.origin,
        travellers=request.travellers,
        currency=request.currency,
        vibe=request.vibe,
        interests=request.interests,
        raw_prompt=request.raw_prompt,
        prompt=request.prompt
    )
