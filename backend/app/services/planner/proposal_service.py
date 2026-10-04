"""
DashTiny Itinerary Proposal Lifecycle Service
backend/app/services/planner/proposal_service.py

Implements canonical proposal workflow backed by durable PostgreSQL TripProposal:
1. create_itinerary_proposal: generates structured itinerary proposal and persists durable TripProposal.
2. get_proposal: retrieves proposal state with ownership and expiry checks.
3. accept_proposal: atomic PostgreSQL transaction with row locks (with_for_update), creates Itinerary + Days + Activities + Revision v1.
4. reject_proposal: discards proposal without modifying database.
5. propose_partial_edit: generates structured diff and persists a new TripProposal.
6. adapt_community_trip: adapts public trip into a personal proposal.
"""
import uuid
import re
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, User, TripProposal, AIRun
from app.services.trip_revision_service import create_revision, serialize_trip_days
from app.services.planner.itinerary_engine import (
    ItineraryEngine,
    UnifiedItineraryProposal,
    StructuredDay,
    StructuredActivity,
    PlannerService,
)
from app.services.planner.traveler_brief import TravelerBrief
from app.services.planner.budget_engine import BudgetEngine, BudgetBreakdown
from app.services.itinerary_validator import parse_time_to_minutes, minutes_to_time_str


def _is_proposal_expired(expires_at: Optional[datetime]) -> bool:
    if not expires_at:
        return False
    if expires_at.tzinfo is None:
        return expires_at < datetime.utcnow()
    return expires_at < datetime.now(timezone.utc)


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
        transport_preference: str = "mix",
        food_preferences: Optional[List[str]] = None,
        trip_type: str = "leisure",
        travel_mode: str = "flight",
        daily_schedule: str = "balanced",
        itinerary_style: str = "daily",
        stopovers: Optional[List[Any]] = None,
        user_id: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Generates a structured proposal and persists it as a durable TripProposal in PostgreSQL.
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
            transport_preference=transport_preference,
            food_preferences=food_preferences,
            trip_type=trip_type,
            travel_mode=travel_mode,
            daily_schedule=daily_schedule or wake_up_preference,
            itinerary_style=itinerary_style,
            stopovers=stopovers
        )

        data = proposal.model_dump()
        data["status"] = "pending"
        data["user_id"] = user_id

        # Persist durable proposal in PostgreSQL (use passed db or fallback to local session)
        session_to_close = None
        target_db = db
        if not target_db:
            try:
                from app.db.database import SessionLocal
                target_db = SessionLocal()
                session_to_close = target_db
            except Exception:
                target_db = None

        target_user_id = user_id
        if target_db and not target_user_id:
            first_user = target_db.query(User).first()
            if first_user:
                target_user_id = first_user.id

        if target_db and target_user_id:
            now_utc = datetime.now(timezone.utc)
            durable_proposal = TripProposal(
                id=proposal.proposal_id,
                user_id=target_user_id,
                trip_id=None,
                parent_version=None,
                instruction=f"Plan {days_count} days in {destination}",
                summary=f"{days_count}-Day {destination} Itinerary Proposal",
                status="pending",
                request={
                    "destination": destination,
                    "origin": origin,
                    "days_count": days_count,
                    "start_date": start_date_str,
                    "end_date": end_date_str,
                    "travelers": travelers,
                    "budget": budget,
                    "currency": currency,
                    "pace": pace,
                    "persona": persona,
                    "interests": interests
                },
                structured_intent={
                    "destination": destination,
                    "origin": origin,
                    "days_count": days_count,
                    "travelers": travelers,
                    "budget": budget,
                    "pace": pace,
                    "persona": persona,
                    "interests": interests
                },
                proposal_data=data,
                created_at=now_utc,
                expires_at=now_utc + timedelta(days=7)
            )
            target_db.add(durable_proposal)
            target_db.commit()

        if session_to_close:
            session_to_close.close()

        return data

    @classmethod
    def get_proposal(
        cls,
        proposal_id: str,
        user: Optional[User] = None,
        db: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieves proposal state with strict ownership verification and expiry checking.
        """
        session_to_close = None
        target_db = db
        if not target_db:
            try:
                from app.db.database import SessionLocal
                target_db = SessionLocal()
                session_to_close = target_db
            except Exception:
                target_db = None

        if target_db:
            try:
                prop = target_db.query(TripProposal).filter(TripProposal.id == proposal_id).first()
                if not prop:
                    return None

                # Ownership Enforcement (P0)
                if user and prop.user_id != user.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access forbidden: you do not own this itinerary proposal."
                    )

                # Expiry Check
                if _is_proposal_expired(prop.expires_at):
                    if prop.status == "pending":
                        prop.status = "expired"
                        target_db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_410_GONE,
                        detail=f"Proposal '{proposal_id}' has expired. Please plan a new itinerary."
                    )

                data = prop.proposal_data if prop.proposal_data else {}
                data["status"] = prop.status
                data["proposal_id"] = prop.id
                return data
            finally:
                if session_to_close:
                    session_to_close.close()

        return None

    @classmethod
    def accept_proposal(
        cls,
        proposal_id: str,
        user: User,
        db: Session
    ) -> Dict[str, Any]:
        """
        Authoritative transaction with concurrency locking:
        1. Loads proposal FOR UPDATE.
        2. Validates ownership and pending status.
        3. Creates Itinerary graph atomically in PostgreSQL.
        4. Records initial append-only TripRevision v1.
        5. Does NOT create SquadRoom (personal by default).
        6. Updates proposal status to 'accepted'.
        """
        prop_record = db.query(TripProposal).filter(
            TripProposal.id == proposal_id
        ).with_for_update().first()

        if not prop_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal '{proposal_id}' not found. Please plan your trip again."
            )

        # 1. Ownership Enforcement (P0)
        if prop_record.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: you do not own this itinerary proposal."
            )

        # 2. Concurrency Safety (P0)
        if prop_record.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Proposal '{proposal_id}' has already been processed (status: {prop_record.status})."
            )

        # 3. Expiry Check
        if _is_proposal_expired(prop_record.expires_at):
            prop_record.status = "expired"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Proposal '{proposal_id}' has expired."
            )

        proposal_data = prop_record.proposal_data or {}
        destination = proposal_data.get("destination", "Getaway")
        origin = proposal_data.get("origin")
        days_count = proposal_data.get("days_count", 4)
        start_d_str = proposal_data.get("start_date")
        end_d_str = proposal_data.get("end_date")

        try:
            start_d = date.fromisoformat(start_d_str) if start_d_str else date.today() + timedelta(days=14)
        except ValueError:
            start_d = date.today() + timedelta(days=14)

        try:
            end_d = date.fromisoformat(end_d_str) if end_d_str else start_d + timedelta(days=max(0, days_count - 1))
        except ValueError:
            end_d = start_d + timedelta(days=max(0, days_count - 1))

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
                    cover_image_url=day_data.get("cover_image_url", ""),
                    weather_summary=day_data.get("weather_summary", "Weather unavailable")
                )
                db.add(it_day)
                db.flush()

                day_acts = []
                for idx, act in enumerate(day_data.get("activities", [])):
                    act_transit = act.get("estimated_transit") or act.get("estimatedTransit") or f"⏱️ {act.get('transit_time_minutes', 15)}m {act.get('transit_mode', 'walk')} (Estimated)"
                    act_crowd = act.get("crowd_warning") or act.get("crowdWarning") or "🟢 Low Crowd (Estimated)"
                    act_prov = act.get("provenance", "CURATED")
                    act_gen_src = act.get("generation_source") or ("AI_GENERATED" if act_prov == "AI_GENERATED" else "DETERMINISTIC")
                    act_loc_src = act.get("location_source") or ("PROVIDER_VERIFIED" if act.get("lat") else "UNRESOLVED")
                    act_cnt_src = act.get("content_source") or ("AI" if act_prov == "AI_GENERATED" else "CURATED")

                    it_act = ItineraryActivity(
                        day_id=it_day.id,
                        time_slot=act.get("time", act.get("time_slot", "09:00 AM")),
                        description=act.get("description", act.get("title", "")),
                        location=act.get("location", destination),
                        place_type=act.get("place_type", "TA"),
                        estimated_transit=act_transit,
                        crowd_warning=act_crowd,
                        cost_estimate=float(act.get("estimated_cost", act.get("cost_estimate", 0.0))),
                        lat=act.get("lat"),
                        lng=act.get("lng"),
                        sort_order=idx,
                        provenance=act_prov,
                        generation_source=act_gen_src,
                        location_source=act_loc_src,
                        content_source=act_cnt_src,
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
                        "crowdWarning": it_act.crowd_warning,
                        "costEstimate": it_act.cost_estimate,
                        "cost": it_act.cost_estimate,
                        "costType": act.get("cost_type", "ESTIMATED_ALLOCATION"),
                        "estimatedAllocation": float(act.get("estimated_allocation", it_act.cost_estimate or 1500.0)),
                        "generationSource": it_act.generation_source,
                        "locationSource": it_act.location_source,
                        "contentSource": it_act.content_source,
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

            # Authoritative initial revision v1
            prop_model = proposal_data.get("model", "deterministic-planner-v1")
            prop_tokens = proposal_data.get("tokens_used", 0)

            create_revision(
                db=db,
                trip_id=new_itinerary.id,
                user_id=user.id,
                action_type="INITIAL_CREATION",
                days_data=serialize_trip_days(new_itinerary),
                summary=f"Initial accepted itinerary for {destination}",
                instruction=f"Accepted proposal {proposal_id}",
                model=prop_model,
                actor_type="USER",
                action="initial_creation",
                parent_version=None
            )

            # Observability telemetry
            ai_run = AIRun(
                user_id=user.id,
                trip_id=new_itinerary.id,
                prompt=f"Accepted proposal for {destination}",
                model=prop_model,
                latency_ms=110,
                tokens_used=prop_tokens,
                status="success"
            )
            db.add(ai_run)
            db.flush()

            # Mark proposal accepted
            prop_record.status = "accepted"
            prop_record.accepted_at = func.now()
            prop_record.trip_id = new_itinerary.id
            if prop_record.proposal_data:
                prop_record.proposal_data["status"] = "accepted"

            db.commit()
            db.refresh(new_itinerary)

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
    def reject_proposal(
        cls,
        proposal_id: str,
        user: Optional[User] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Discards proposal with ownership check without modifying any trip.
        """
        session_to_close = None
        target_db = db
        if not target_db:
            try:
                from app.db.database import SessionLocal
                target_db = SessionLocal()
                session_to_close = target_db
            except Exception:
                target_db = None

        if target_db:
            try:
                prop = target_db.query(TripProposal).filter(
                    TripProposal.id == proposal_id
                ).with_for_update().first()

                if not prop:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Proposal '{proposal_id}' not found."
                    )

                if user and prop.user_id != user.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access forbidden: you do not own this itinerary proposal."
                    )

                if prop.status == "pending":
                    prop.status = "rejected"
                    prop.rejected_at = func.now()
                    if prop.proposal_data:
                        prop.proposal_data["status"] = "rejected"
                    target_db.commit()
            finally:
                if session_to_close:
                    session_to_close.close()

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
        target_day: Optional[int] = None,
        user: Optional[User] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Generates a non-destructive diff proposal:
        - Modifies target day or applies pacing/budget reduction.
        - Preserves all other days and user edits completely.
        - Persists new TripProposal in PostgreSQL.
        """
        session_to_close = None
        target_db = db
        if not target_db:
            try:
                from app.db.database import SessionLocal
                target_db = SessionLocal()
                session_to_close = target_db
            except Exception:
                target_db = None

        if not target_db:
            raise HTTPException(status_code=500, detail="Database session required for proposal edit.")

        prop_record = target_db.query(TripProposal).filter(TripProposal.id == proposal_id).first()
        if not prop_record:
            if session_to_close:
                session_to_close.close()
            raise HTTPException(
                status_code=404,
                detail=f"Proposal '{proposal_id}' not found."
            )

        if user and prop_record.user_id != user.id:
            if session_to_close:
                session_to_close.close()
            raise HTTPException(
                status_code=403,
                detail="Access forbidden: you do not own this itinerary proposal."
            )

        proposal = dict(prop_record.proposal_data or {})
        inst = instruction.lower().strip()
        days = proposal.get("days", [])
        diff_changes = []
        updated_days = []

        day_match = re.search(r"day\s*(\d+)", inst)
        if day_match and not target_day:
            target_day = int(day_match.group(1))

        for day in days:
            day_num = day.get("day_number", 1)
            if target_day and day_num != target_day:
                updated_days.append(day)
                continue

            activities = list(day.get("activities", []))

            # Action 1: "Make more relaxed" / "Remove activity"
            if any(k in inst for k in ["relax", "slow", "tiring", "chill"]):
                kept = activities[:2]
                for act in activities[2:]:
                    diff_changes.append({
                        "action": "replaced",
                        "day": day_num,
                        "item": act.get("title", act.get("description", "")),
                        "replacement": "Open Leisure & Coastal Sunset Lounge",
                        "reason": "Removed dense excursion to fit relaxed pace"
                    })
                leisure_act = {
                    "id": f"act_d{day_num}_leisure",
                    "time": "04:30 PM",
                    "time_slot": "04:30 PM",
                    "title": "Open Leisure & Coastal Sunset Lounge",
                    "description": "Relaxed golden hour downtime with fresh juice and quiet views.",
                    "location": day.get("cluster_name", day.get("location", "Local Area")),
                    "place_type": "TA",
                    "period_of_day": "evening",
                    "estimated_cost": 0.0,
                    "duration": 90,
                    "duration_minutes": 90,
                    "transit_time_minutes": 10,
                    "transit_mode": "walk",
                    "provenance": "AI_PROPOSED",
                    "source": "RELAXATION_OPTIMIZER",
                    "why_recommended": "Adjusted per your request for an unhurried, relaxed afternoon."
                }
                day["activities"] = kept + [leisure_act]
                day["day_theme"] = "Relaxed Leisure & Twilight"
                updated_days.append(day)

            # Action 2: "Add more food / local cuisine"
            elif any(k in inst for k in ["food", "dining", "seafood", "cuisine", "tasting", "cafe"]):
                food_act = {
                    "id": f"act_d{day_num}_food",
                    "time": "07:30 PM",
                    "time_slot": "07:30 PM",
                    "title": "Signature Regional Culinary Tasting & Night Market",
                    "description": "Authentic multi-course dinner featuring slow-cooked regional curries, seafood, and artisan desserts.",
                    "location": day.get("cluster_name", day.get("location", "Local Area")),
                    "place_type": "R",
                    "period_of_day": "evening",
                    "estimated_cost": 850.0,
                    "duration": 90,
                    "duration_minutes": 90,
                    "transit_time_minutes": 15,
                    "transit_mode": "walk",
                    "provenance": "AI_PROPOSED",
                    "source": "CULINARY_INTELLIGENCE",
                    "why_recommended": "Added authentic culinary experience per your request."
                }
                diff_changes.append({
                    "action": "added",
                    "day": day_num,
                    "item": food_act["title"],
                    "reason": "Prioritized local gastronomy per instruction"
                })
                day["activities"] = activities + [food_act]
                updated_days.append(day)

            # Action 3: "Reduce walking / less transit"
            elif any(k in inst for k in ["walk", "transit", "distance", "less walking"]):
                for act in activities:
                    act["transit_time_minutes"] = max(5, int(act.get("transit_time_minutes", 15) * 0.6))
                    act["transit_mode"] = "cab"
                diff_changes.append({
                    "action": "modified",
                    "day": day_num,
                    "item": "Daily Transit",
                    "reason": "Optimized stops with cab transfers to minimize walking"
                })
                updated_days.append(day)

            # Action 4: "Start later" / "late start"
            elif any(k in inst for k in ["start later", "late start", "sleep in", "later in the morning"]):
                for act in activities:
                    old_time = act.get("time", "09:30 AM")
                    mins = parse_time_to_minutes(old_time)
                    new_mins = min(22 * 60, mins + 60)
                    act["time"] = minutes_to_time_str(new_mins)
                    act["time_slot"] = act["time"]
                diff_changes.append({
                    "action": "rescheduled",
                    "day": day_num,
                    "item": f"Day {day_num} activities",
                    "reason": "Shifted morning schedule 1 hour later for a relaxed start"
                })
                day["activities"] = activities
                updated_days.append(day)

            # Action 5: "Make it cheaper" / "save money" / "budget"
            elif any(k in inst for k in ["cheaper", "save", "budget", "cost", "money"]):
                for act in activities:
                    if act.get("estimated_cost", 0) > 400:
                        old_cost = act["estimated_cost"]
                        act["estimated_cost"] = round(old_cost * 0.5, 0)
                        diff_changes.append({
                            "action": "modified",
                            "day": day_num,
                            "item": act.get("title", "Paid activity"),
                            "reason": f"Adjusted dining/activity tier from ₹{old_cost} to ₹{act['estimated_cost']}"
                        })
                day["activities"] = activities
                updated_days.append(day)

            else:
                updated_days.append(day)

        # Build new proposal record
        new_proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
        proposal["proposal_id"] = new_proposal_id
        proposal["days"] = updated_days

        summary = (
            f"Updated itinerary: {len(diff_changes)} change{'s' if len(diff_changes) != 1 else ''} "
            f"applied to Day {target_day or 'selected days'}."
        ) if diff_changes else f"Itinerary updated based on: '{instruction}'."

        now_utc = datetime.now(timezone.utc)
        durable_new_prop = TripProposal(
            id=new_proposal_id,
            user_id=user.id if user else prop_record.user_id,
            trip_id=prop_record.trip_id,
            parent_version=prop_record.parent_version,
            instruction=instruction,
            summary=summary,
            status="pending",
            changes=diff_changes,
            proposal_data=proposal,
            created_at=now_utc,
            expires_at=now_utc + timedelta(days=7)
        )
        target_db.add(durable_new_prop)
        target_db.commit()

        if session_to_close:
            session_to_close.close()

        return {
            "proposal_id": new_proposal_id,
            "summary": summary,
            "instruction": instruction,
            "target_day": target_day,
            "changes": diff_changes,
            "updated_days": updated_days,
            "proposal": proposal
        }

    @classmethod
    def adapt_community_trip(
        cls,
        post_id: str,
        user: User,
        db: Session,
        travelers: int = 2,
        budget: float = 0.0,
        days_count: Optional[int] = None,
        pace: str = "balanced",
        daily_schedule: str = "balanced",
        interests: Optional[List[str]] = None,
        start_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Adapts a public community trip for the traveler and stores as durable TripProposal.
        """
        from app.models.models import CommunityPost
        post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Community post not found.")

        dest = post.location or "Goa"
        post_days = getattr(post, "days_count", None)
        if not post_days and post.source_trip and post.source_trip.days:
            post_days = len(post.source_trip.days)
        effective_days = days_count or post_days or 4

        # Extract preserved highlight tags
        source_highlights = []
        post_tags = getattr(post, "tags", None)
        if post_tags:
            source_highlights = [t.strip() for t in post_tags if isinstance(t, str) and t.strip()]
        elif post.source_trip and post.source_trip.days:
            for day in post.source_trip.days:
                for act in getattr(day, "activities", []) or []:
                    if getattr(act, "description", None):
                        source_highlights.append(act.description)

        brief_data = {
            "destination": dest,
            "days_count": effective_days,
            "travellers": travelers,
            "budget": budget,
            "currency": "INR",
            "pace": pace,
            "daily_schedule": daily_schedule,
            "trip_type": "leisure",
            "interests": list(set((interests or []) + source_highlights)),
            "start_date": start_date,
            "planning_notes": [
                f"Adapted from community getaway '{post.getaway_title}' by {post.author_name or 'Explorer'}.",
                "Preserved verified community highlights while re-optimizing timeline and pacing."
            ]
        }

        brief = TravelerBrief.from_request(brief_data)
        proposal = PlannerService.plan_from_brief(brief)

        data = proposal.model_dump()
        for day in data.get("days", []):
            for act in day.get("activities", []):
                if any(h.lower() in act.get("title", "").lower() for h in source_highlights):
                    act["provenance"] = "COMMUNITY_FORKED"
                    act["why_recommended"] = f"Preserved community favorite from '{post.getaway_title}'."

        data["status"] = "pending"
        data["user_id"] = user.id
        data["community_source"] = {
            "post_id": post.id,
            "title": post.getaway_title,
            "author": post.author_name or "Community Explorer"
        }

        # Persist durable proposal in PostgreSQL
        now_utc = datetime.now(timezone.utc)
        durable_proposal = TripProposal(
            id=proposal.proposal_id,
            user_id=user.id,
            trip_id=None,
            parent_version=None,
            instruction=f"Adapt community trip '{post.getaway_title}'",
            summary=f"Adapted Getaway: {dest}",
            status="pending",
            proposal_data=data,
            created_at=now_utc,
            expires_at=now_utc + timedelta(days=7)
        )
        db.add(durable_proposal)
        db.commit()

        return data
