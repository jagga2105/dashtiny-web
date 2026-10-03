from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import User
from app.api.deps import get_current_user
from app.ai.agents.planner_agent import build_itinerary_with_planner_agent

router = APIRouter(prefix="/planner", tags=["DAIna AI Getaway Architect"])

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

@router.post("/generate")
def generate_itinerary(
    request: PlannerRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate dynamic getaway itinerary tailored to any destination via Planner Agent and persist in PostgreSQL.
    Consumes complete PlannerRequest, validating date consistency and threading travellers to tools.
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
