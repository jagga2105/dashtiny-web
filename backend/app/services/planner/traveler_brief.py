"""
DashTiny Canonical Traveler Brief Model
backend/app/services/planner/traveler_brief.py

Defines the typed internal contract for travel planning intent:
- Captures full traveler dimensions: trip_type, travel_mode, pace, daily_schedule, itinerary_style, stopovers.
- Converts HTTP PlannerRequest or ItineraryProposalRequest into canonical TravelerBrief.
- Validates constraints (days >= 1, travellers >= 1, budget >= 0, valid pace/schedule/style enum values).
- Provides helper methods for destination clusters and stopover day allocations.
"""
from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime, timedelta, timezone

from app.utils.text_normalizer import normalize_travel_text


VALID_TRIP_TYPES = {"leisure", "adventure", "romantic", "business", "backpacking", "luxury", "family"}
VALID_TRAVEL_MODES = {"flight", "train", "bus", "car", "mixed"}
VALID_PACES = {"fast", "packed", "balanced", "relaxed", "slow"}
VALID_SCHEDULES = {"early_riser", "balanced", "night_owl"}
VALID_STYLES = {"daily", "detailed"}


class Stopover(BaseModel):
    location: str
    nights: Optional[int] = None
    sequence: int = 1


class TravelerBrief(BaseModel):
    destination: str
    origin: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_count: int = Field(default=4, ge=1, le=30)
    travellers: int = Field(default=2, ge=1, le=50)
    budget: float = Field(default=0.0, ge=0.0)
    currency: str = Field(default="INR")
    persona: str = Field(default="solo")
    trip_type: str = Field(default="leisure")
    travel_mode: str = Field(default="flight")
    pace: str = Field(default="balanced")
    daily_schedule: str = Field(default="balanced")
    itinerary_style: str = Field(default="daily")
    interests: List[str] = Field(default_factory=list)
    stopovers: List[Stopover] = Field(default_factory=list)
    wake_up_preference: str = Field(default="balanced")
    accommodation_preference: str = Field(default="comfort")
    transport_preference: str = Field(default="mix")
    food_preferences: List[str] = Field(default_factory=list)
    likes: List[str] = Field(default_factory=list)
    dislikes: List[str] = Field(default_factory=list)
    vibe: Optional[str] = None
    raw_prompt: Optional[str] = None
    planning_notes: List[str] = Field(default_factory=list)

    @field_validator("destination")
    @classmethod
    def validate_destination(cls, v: str) -> str:
        clean = normalize_travel_text(v.strip())
        if not clean:
            raise ValueError("Destination is required")
        return clean.title()

    @field_validator("trip_type")
    @classmethod
    def validate_trip_type(cls, v: str) -> str:
        lower = (v or "leisure").strip().lower()
        return lower if lower in VALID_TRIP_TYPES else "leisure"

    @field_validator("travel_mode")
    @classmethod
    def validate_travel_mode(cls, v: str) -> str:
        lower = (v or "flight").strip().lower()
        return lower if lower in VALID_TRAVEL_MODES else "flight"

    @field_validator("pace")
    @classmethod
    def validate_pace(cls, v: str) -> str:
        lower = (v or "balanced").strip().lower()
        if lower in {"fast", "packed"}:
            return "packed"
        if lower in {"relaxed", "slow"}:
            return "relaxed"
        return "balanced"

    @field_validator("daily_schedule")
    @classmethod
    def validate_schedule(cls, v: str) -> str:
        lower = (v or "balanced").strip().lower()
        if lower in {"early_bird", "early"}:
            return "early_riser"
        if lower in {"night_owl", "late", "late_morning"}:
            return "night_owl"
        return lower if lower in VALID_SCHEDULES else "balanced"

    @field_validator("itinerary_style")
    @classmethod
    def validate_style(cls, v: str) -> str:
        lower = (v or "daily").strip().lower()
        return lower if lower in VALID_STYLES else "daily"

    @classmethod
    def from_inputs(
        cls,
        destination: str,
        days_count: int = 4,
        origin: Optional[str] = None,
        start_date_str: Optional[str] = None,
        end_date_str: Optional[str] = None,
        travelers: int = 2,
        budget: float = 0.0,
        currency: str = "INR",
        pace: str = "balanced",
        persona: str = "solo",
        vibe: Optional[str] = None,
        interests: Optional[List[str]] = None,
        wake_up_preference: str = "balanced",
        accommodation_preference: str = "comfort",
        transport_preference: str = "mix",
        food_preferences: Optional[List[str]] = None,
        trip_type: str = "leisure",
        travel_mode: str = "flight",
        daily_schedule: str = "balanced",
        itinerary_style: str = "daily",
        stopovers: Optional[List[Any]] = None,
        **kwargs
    ) -> "TravelerBrief":
        """
        Convenience factory constructing TravelerBrief from individual arguments.
        """
        data = {
            "destination": destination,
            "days_count": days_count,
            "origin": origin,
            "start_date": start_date_str or kwargs.get("start_date"),
            "end_date": end_date_str or kwargs.get("end_date"),
            "travellers": travelers if travelers is not None else kwargs.get("travellers", 2),
            "budget": budget,
            "currency": currency,
            "pace": pace,
            "persona": persona,
            "vibe": vibe,
            "interests": interests or ["sightseeing", "food"],
            "wake_up_preference": wake_up_preference,
            "accommodation_preference": accommodation_preference,
            "transport_preference": transport_preference,
            "food_preferences": food_preferences or ["any"],
            "likes": kwargs.get("likes") or [],
            "dislikes": kwargs.get("dislikes") or [],
            "trip_type": trip_type,
            "travel_mode": travel_mode,
            "daily_schedule": daily_schedule,
            "itinerary_style": itinerary_style,
            "stopovers": stopovers or [],
            **kwargs
        }
        return cls.from_request(data)

    @classmethod
    def from_request(cls, req: Any) -> "TravelerBrief":
        """
        Constructs a canonical TravelerBrief from FastAPI request schemas or dicts.
        """
        data = req.model_dump() if hasattr(req, "model_dump") else dict(req)

        # Normalize schedule / wake_up
        schedule = data.get("daily_schedule") or data.get("wake_up_preference") or "balanced"
        if schedule in {"early_bird", "early"}:
            schedule = "early_riser"
        elif schedule in {"late_morning", "night_owl", "late"}:
            schedule = "night_owl"

        # Normalize travel mode
        travel_mode = data.get("travel_mode") or "flight"
        if data.get("transport_preference") in {"train", "rail"}:
            travel_mode = "train"
        elif data.get("transport_preference") in {"car", "cab", "drive"}:
            travel_mode = "car"

        # Parse stopovers if provided as list of dicts
        stopovers_raw = data.get("stopovers") or []
        parsed_stopovers: List[Stopover] = []
        for idx, s in enumerate(stopovers_raw):
            if isinstance(s, dict):
                parsed_stopovers.append(
                    Stopover(
                        location=s.get("location", ""),
                        nights=s.get("nights"),
                        sequence=s.get("sequence", idx + 1)
                    )
                )
            elif isinstance(s, Stopover):
                parsed_stopovers.append(s)

        # Derive start & end dates if not given
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        days = data.get("days_count") or 4
        if not start_date:
            today = datetime.now(timezone.utc).date()
            start_date = (today + timedelta(days=14)).isoformat()
        if not end_date and start_date:
            try:
                s_d = date.fromisoformat(start_date.split("T")[0])
                end_date = (s_d + timedelta(days=max(0, days - 1))).isoformat()
            except ValueError:
                pass

        # Normalize food preferences
        raw_food = data.get("food_preferences") or []
        food_list = [f.strip().lower() for f in raw_food if f]
        if not food_list:
            food_list = ["any"]

        return cls(
            destination=data.get("destination", "Goa"),
            origin=data.get("origin"),
            start_date=start_date,
            end_date=end_date,
            days_count=days,
            travellers=data.get("travellers", 2),
            budget=float(data.get("budget", 0.0)),
            currency=data.get("currency", "INR"),
            persona=data.get("persona", "solo"),
            trip_type=data.get("trip_type", "leisure"),
            travel_mode=travel_mode,
            pace=data.get("pace", "balanced"),
            daily_schedule=schedule,
            itinerary_style=data.get("itinerary_style", "daily"),
            interests=data.get("interests") or ["sightseeing", "food"],
            stopovers=parsed_stopovers,
            wake_up_preference=schedule,
            accommodation_preference=data.get("accommodation_preference", "comfort"),
            transport_preference=data.get("transport_preference", "mix"),
            food_preferences=food_list,
            likes=data.get("likes") or [],
            dislikes=data.get("dislikes") or [],
            vibe=data.get("vibe"),
            raw_prompt=data.get("raw_prompt") or data.get("prompt"),
            planning_notes=data.get("planning_notes") or []
        )

    def get_stopover_day_allocations(self) -> List[Tuple[str, int, int]]:
        """
        Distributes days across primary destination and stopovers:
        Returns list of (location, start_day, end_day).
        """
        if not self.stopovers:
            return [(self.destination, 1, self.days_count)]

        allocations: List[Tuple[str, int, int]] = []
        current_day = 1
        total_days = self.days_count

        # Check total requested nights in stopovers
        assigned_nights = sum(s.nights for s in self.stopovers if s.nights is not None)
        remaining_days = max(1, total_days - assigned_nights)

        for s in self.stopovers:
            nights = s.nights if s.nights is not None else max(1, remaining_days // max(1, len(self.stopovers)))
            end_day = min(total_days, current_day + nights - 1)
            allocations.append((s.location.title(), current_day, end_day))
            current_day = end_day + 1
            if current_day > total_days:
                break

        # If days remain, allocate to destination
        if current_day <= total_days:
            allocations.append((self.destination, current_day, total_days))

        return allocations
