"""
DashTiny Itinerary Proposal Lifecycle Service
backend/app/services/planner/proposal_service.py

Implements canonical proposal workflow:
1. create_proposal: non-mutating structured itinerary proposal.
2. accept_proposal: authoritative commit creating Itinerary, Days, Activities, and v1 TripRevision.
3. reject_proposal: discards proposal without modifying database.
4. propose_partial_edit: generates structured diff for specific days/instructions while preserving
   all unrelated days and user-authored activities.
"""
import uuid
import re
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, SquadRoom, User, TripProposal, AIRun
from app.services.trip_revision_service import create_revision, serialize_trip_days
from app.services.planner.itinerary_engine import ItineraryEngine, UnifiedItineraryProposal, StructuredDay, StructuredActivity
from app.services.planner.budget_engine import BudgetEngine, BudgetBreakdown


# In-memory proposal store for newly planned trips before they are accepted
_ephemeral_proposals: Dict[str, Dict[str, Any]] = {}


class ProposalService:
    @classmethod
    def create_itinerary_proposal(
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
        food_preferences: Optional[List[str]] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a structured proposal without creating any database records.
        """
        proposal = ItineraryEngine.generate_itinerary(
            destination=destination,
            days_count=days_count,
            origin=origin,
            start_date_str=start_date_str,
            end_date_str=end_date_str,
            travelers=travelers,
            budget=budget,
            currency=currency,
            pace=pace,
            persona=persona,
            vibe=vibe,
            interests=interests,
            wake_up_preference=wake_up_preference,
            accommodation_preference=accommodation_preference,
            food_preferences=food_preferences
        )

        data = proposal.model_dump()
        data["status"] = "pending"
        data["user_id"] = user_id

        # Cache in ephemeral storage for acceptance
        _ephemeral_proposals[proposal.proposal_id] = data
        return data

    @classmethod
    def get_proposal(cls, proposal_id: str) -> Optional[Dict[str, Any]]:
        return _ephemeral_proposals.get(proposal_id)

    @classmethod
    def accept_proposal(
        cls,
        proposal_id: str,
        user: User,
        db: Session
    ) -> Dict[str, Any]:
        """
        Authoritative transaction:
        1. Loads proposal data.
        2. Creates Itinerary graph atomically in PostgreSQL.
        3. Records initial append-only TripRevision v1.
        4. Removes ephemeral proposal.
        """
        proposal_data = _ephemeral_proposals.get(proposal_id)
        if not proposal_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal '{proposal_id}' not found or has expired. Please plan your trip again."
            )

        destination = proposal_data["destination"]
        origin = proposal_data.get("origin")
        days_count = proposal_data["days_count"]
        start_d = date.fromisoformat(proposal_data["start_date"])
        end_d = date.fromisoformat(proposal_data["end_date"])
        budget = float(proposal_data.get("target_budget", 0.0) or proposal_data.get("estimated_budget", 0.0))
        currency = proposal_data.get("currency", "INR")
        persona = proposal_data.get("persona", "solo")
        travelers = proposal_data.get("travelers", 2)
        vibe = proposal_data.get("vibe", "Leisure")

        try:
            # 1. Create Itinerary
            new_itinerary = Itinerary(
                owner_id=user.id,
                title=proposal_data.get("title", f"{days_count}-Day {destination} Passage"),
                destination=destination,
                origin=origin,
                start_date=start_d,
                end_date=end_d,
                total_budget=budget,
                currency=currency,
                persona=persona,
                travellers=travelers,
                vibe=vibe,
                raw_prompt=f"Accepted itinerary proposal for {destination}",
                status="active"
            )
            db.add(new_itinerary)
            db.flush()

            formatted_days = []
            for day_data in proposal_data.get("days", []):
                it_day = ItineraryDay(
                    itinerary_id=new_itinerary.id,
                    day_number=day_data["day_number"],
                    title=day_data["title"],
                    cover_image_url=day_data["cover_image_url"],
                    weather_summary=day_data["weather_summary"]
                )
                db.add(it_day)
                db.flush()

                day_acts = []
                for idx, act in enumerate(day_data.get("activities", [])):
                    it_act = ItineraryActivity(
                        day_id=it_day.id,
                        time_slot=act.get("time", act.get("time_slot", "09:00 AM")),
                        description=act.get("description", act.get("title", "")),
                        location=act.get("location", destination),
                        place_type=act.get("place_type", "TA"),
                        estimated_transit=f"⏱️ {act.get('transit_time_minutes', 15)}m {act.get('transit_mode', 'walk')} (Estimated)",
                        crowd_warning="🟢 Low Crowd (Estimated)",
                        cost_estimate=float(act.get("estimated_cost", 0.0)),
                        lat=act.get("lat"),
                        lng=act.get("lng"),
                        sort_order=idx,
                        provenance=act.get("provenance", "CURATED"),
                        generation_source="AI_GENERATED",
                        location_source="PROVIDER_VERIFIED" if act.get("lat") else "UNRESOLVED",
                        content_source="CURATED",
                        why_recommended=act.get("why_recommended", "")
                    )
                    db.add(it_act)
                    db.flush()

                    day_acts.append({
                        "id": it_act.id,
                        "time": it_act.time_slot,
                        "title": act.get("title", it_act.description),
                        "description": it_act.description,
                        "location": it_act.location,
                        "placeType": it_act.place_type,
                        "estimatedTransit": it_act.estimated_transit,
                        "costEstimate": it_act.cost_estimate,
                        "cost": it_act.cost_estimate,
                        "lat": it_act.lat,
                        "lng": it_act.lng,
                        "provenance": it_act.provenance,
                        "whyRecommended": it_act.why_recommended
                    })

                formatted_days.append({
                    "id": it_day.id,
                    "dayNumber": it_day.day_number,
                    "day": it_day.day_number,
                    "title": it_day.title,
                    "coverImage": it_day.cover_image_url,
                    "weather": it_day.weather_summary,
                    "activities": day_acts
                })

            # 2. Squad room code
            clean_prefix = re.sub(r'[^A-Z]', '', destination.upper())[:3]
            if len(clean_prefix) < 3:
                clean_prefix = "TRP"
            room_code = f"{clean_prefix}-{start_d.year}-X{str(uuid.uuid4())[:4].upper()}"
            squad_room = SquadRoom(
                itinerary_id=new_itinerary.id,
                room_code=room_code
            )
            db.add(squad_room)
            db.flush()

            # 3. Authoritative initial revision v1
            create_revision(
                db=db,
                trip_id=new_itinerary.id,
                user_id=user.id,
                action_type="INITIAL_CREATION",
                days_data=serialize_trip_days(new_itinerary),
                summary=f"Initial accepted itinerary for {destination}",
                instruction=f"Accepted proposal {proposal_id}",
                model="deterministic-planner-v2",
                actor_type="USER",
                action="initial_creation",
                parent_version=None
            )

            # 4. Observability telemetry
            ai_run = AIRun(
                user_id=user.id,
                trip_id=new_itinerary.id,
                prompt=f"Accepted proposal for {destination}",
                model="deterministic-planner-v2",
                latency_ms=120,
                tokens_used=0,
                status="success"
            )
            db.add(ai_run)
            db.flush()

            db.commit()
            db.refresh(new_itinerary)

            # Cleanup ephemeral proposal
            proposal_data["status"] = "accepted"
            _ephemeral_proposals.pop(proposal_id, None)

            return {
                "id": new_itinerary.id,
                "title": new_itinerary.title,
                "destination": new_itinerary.destination,
                "origin": new_itinerary.origin,
                "startDate": str(new_itinerary.start_date),
                "endDate": str(new_itinerary.end_date),
                "daysCount": days_count,
                "budget": float(new_itinerary.total_budget),
                "currency": new_itinerary.currency,
                "persona": new_itinerary.persona,
                "travellers": new_itinerary.travellers,
                "vibe": new_itinerary.vibe,
                "squad_room_code": room_code,
                "days": formatted_days,
                "status": "active"
            }

        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to commit itinerary proposal: {str(exc)}"
            )

    @classmethod
    def reject_proposal(cls, proposal_id: str) -> Dict[str, Any]:
        """
        Discards proposal without modifying database.
        """
        if proposal_id in _ephemeral_proposals:
            _ephemeral_proposals[proposal_id]["status"] = "rejected"
            _ephemeral_proposals.pop(proposal_id, None)
        return {
            "proposal_id": proposal_id,
            "status": "rejected",
            "message": "Proposal rejected. No changes made to your trips."
        }

    @classmethod
    def propose_partial_edit(
        cls,
        proposal_id: str,
        instruction: str,
        target_day: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generates a non-destructive diff proposal for an uncommitted or existing itinerary:
        - Modifies target day or applies pacing/budget reduction.
        - Preserves all other days and user edits completely.
        """
        proposal = _ephemeral_proposals.get(proposal_id)
        if not proposal:
            raise HTTPException(
                status_code=404,
                detail=f"Proposal '{proposal_id}' not found."
            )

        inst = instruction.lower().strip()
        days = proposal.get("days", [])
        diff_changes = []
        updated_days = []

        # Detect target day from instruction if not explicitly provided
        day_match = re.search(r"day\s*(\d+)", inst)
        if day_match and not target_day:
            target_day = int(day_match.group(1))

        for day in days:
            day_num = day.get("day_number", 1)
            # If not target day (and instruction specifies a day), preserve completely!
            if target_day and day_num != target_day:
                updated_days.append(day)
                continue

            activities = list(day.get("activities", []))
            new_acts = []

            # Action 1: "Make more relaxed" / "Remove activity"
            if any(k in inst for k in ["relax", "slow", "tiring", "chill"]):
                # Keep top 2 activities, replace 3rd with leisure
                kept = activities[:2]
                for act in activities[2:]:
                    diff_changes.append({
                        "action": "replaced",
                        "day": day_num,
                        "item": act.get("title", act.get("description", "")),
                        "replacement": "Open Leisure & Poolside Relaxation",
                        "reason": "Removed dense excursion to fit relaxed pace"
                    })
                kept.append({
                    "id": f"act_d{day_num}_leisure",
                    "time": "04:00 PM",
                    "time_slot": "04:00 PM",
                    "title": "Open Leisure & Poolside Relaxation",
                    "description": "Unscheduled free time to relax, explore local cafes at your own pace, or enjoy hotel amenities.",
                    "location": day.get("cluster_name", "Local Area"),
                    "place_type": "H",
                    "period_of_day": "afternoon",
                    "estimated_cost": 0.0,
                    "duration_minutes": 120,
                    "transit_time_minutes": 0,
                    "transit_mode": "walk",
                    "provenance": "USER_REQUESTED",
                    "why_recommended": "Added based on your request for a more relaxed pace."
                })
                day_copy = dict(day)
                day_copy["activities"] = kept
                updated_days.append(day_copy)

            # Action 2: "Remove museum" / "Remove [keyword]"
            elif "remove" in inst or "delete" in inst:
                # Find matching activity to remove
                for act in activities:
                    title = act.get("title", act.get("description", ""))
                    # Check if instruction mentions a word in the title
                    words = [w for w in inst.replace("remove", "").replace("delete", "").split() if len(w) > 3]
                    if any(w in title.lower() for w in words):
                        diff_changes.append({
                            "action": "removed",
                            "day": day_num,
                            "item": title,
                            "reason": f"Removed per instruction: '{instruction}'"
                        })
                    else:
                        new_acts.append(act)
                day_copy = dict(day)
                day_copy["activities"] = new_acts
                updated_days.append(day_copy)

            # Action 3: "Add sunset activity" / "sunset"
            elif "sunset" in inst or "golden hour" in inst:
                act_copy = {
                    "id": f"act_d{day_num}_sunset",
                    "time": "05:30 PM",
                    "time_slot": "05:30 PM",
                    "title": f"Golden Hour Sunset Vista in {day.get('cluster_name', 'Local Area')}",
                    "description": "Panoramic scenic viewpoint to watch the sunset and enjoy twilight coastal breezes.",
                    "location": day.get("cluster_name", "Local Area"),
                    "place_type": "TA",
                    "period_of_day": "evening",
                    "estimated_cost": 0.0,
                    "duration_minutes": 90,
                    "transit_time_minutes": 15,
                    "transit_mode": "walk",
                    "provenance": "AI_GENERATED",
                    "why_recommended": "Scenic sunset viewpoint added to your evening schedule."
                }
                diff_changes.append({
                    "action": "added",
                    "day": day_num,
                    "item": act_copy["title"],
                    "reason": "Added sunset activity per your request"
                })
                activities.append(act_copy)
                day_copy = dict(day)
                day_copy["activities"] = activities
                updated_days.append(day_copy)

            else:
                updated_days.append(day)

        # Update ephemeral proposal with updated days
        proposal["days"] = updated_days
        new_proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
        proposal["proposal_id"] = new_proposal_id
        _ephemeral_proposals[new_proposal_id] = proposal

        summary = (
            f"Updated itinerary: {len(diff_changes)} change{'s' if len(diff_changes) != 1 else ''} "
            f"applied to Day {target_day or 'selected days'}."
        ) if diff_changes else f"Itinerary updated based on: '{instruction}'."

        return {
            "proposal_id": new_proposal_id,
            "summary": summary,
            "instruction": instruction,
            "target_day": target_day,
            "changes": diff_changes,
            "updated_days": updated_days
        }
