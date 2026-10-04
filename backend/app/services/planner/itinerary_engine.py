"""
DashTiny Core Itinerary Generation Engine with Long-Trip Chunking
backend/app/services/planner/itinerary_engine.py

Generates structured daily plans matching the canonical schema:
- Multi-day activities with time, duration, transit mode/duration, cost, coordinates, provenance, and why_recommended.
- Chunked generation for trips longer than 4 days:
  e.g. 7 days: [1..3, 4..6, 7], 14 days: [1..3, 4..6, 7..9, 10..12, 13..14].
- Internal merging with deduplication, geographic continuity, and pacing validation.
- Emits unified TripProposal structure without exposing chunk boundaries to travelers.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field

from app.services.planner.destination_registry import (
    get_destination_geography,
    generate_fallback_cluster,
    DestinationGeography,
    ClusterInfo,
    PlaceDetail
)
from app.services.planner.validator import ItineraryValidator, ValidationReport
from app.services.planner.budget_engine import BudgetEngine, BudgetBreakdown


class StructuredActivity(BaseModel):
    id: str
    time: str
    time_slot: str  # backward compatibility alias
    title: str
    description: str
    location: str
    place_type: str = "TA"  # TA = Tour/Attraction, R = Restaurant, H = Hotel
    period_of_day: str = "morning"  # morning, afternoon, evening
    estimated_cost: float = 0.0
    cost_estimate: float = 0.0  # backward compatibility
    duration_minutes: int = 90
    transit_time_minutes: int = 20
    transit_mode: str = "walk"  # walk, cab, metro, ferry
    lat: Optional[float] = None
    lng: Optional[float] = None
    provenance: str = "CURATED"
    source: str = "DESTINATION_GRAPH"
    why_recommended: str = ""
    cluster: str = ""


class StructuredDay(BaseModel):
    day_number: int
    date: Optional[str] = None
    title: str
    cluster_name: str
    cover_image_url: str
    weather_summary: str
    morning_summary: str = ""
    afternoon_summary: str = ""
    evening_summary: str = ""
    activities: List[StructuredActivity] = Field(default_factory=list)


class UnifiedItineraryProposal(BaseModel):
    proposal_id: str
    title: str
    destination: str
    origin: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_count: int
    travelers: int
    pace: str
    persona: str
    vibe: str
    interests: List[str]
    target_budget: float
    estimated_budget: float
    currency: str = "INR"
    budget_breakdown: BudgetBreakdown
    validation: ValidationReport
    planning_notes: List[str]
    days: List[StructuredDay]
    created_at: str


class ItineraryEngine:
    @classmethod
    def generate_itinerary(
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
        food_preferences: Optional[List[str]] = None
    ) -> UnifiedItineraryProposal:
        """
        Main entry point for generating structured multi-day itineraries.
        Employs chunked generation for trips > 4 days to ensure high quality,
        validates the merged result, and returns a unified TripProposal.
        """
        clean_dest = destination.strip().title()
        interests_list = list(interests or ["sightseeing", "food"])
        food_prefs = list(food_preferences or ["any"])
        effective_vibe = vibe or f"{pace.title()} {clean_dest} Getaway"

        # Calculate dates if provided
        start_d = None
        if start_date_str:
            try:
                start_d = date.fromisoformat(start_date_str.split("T")[0])
            except ValueError:
                start_d = None

        if not start_d:
            today = datetime.now(timezone.utc).date()
            start_d = today + timedelta(days=14)

        end_d = start_d + timedelta(days=max(0, days_count - 1))

        # Check destination geography
        geo = get_destination_geography(clean_dest)

        # Execute Chunked Generation for trips > 4 days
        # Chunks: 1..3, 4..6, 7..9, 10..12, 13..14
        raw_days: List[StructuredDay] = []
        chunk_ranges = cls._calculate_chunks(days_count)

        used_activity_titles: set = set()

        for chunk_idx, (start_day, end_day) in enumerate(chunk_ranges):
            chunk_days = cls._generate_chunk(
                destination=clean_dest,
                geo=geo,
                start_day=start_day,
                end_day=end_day,
                trip_start_date=start_d,
                travelers=travelers,
                pace=pace,
                persona=persona,
                interests=interests_list,
                food_prefs=food_prefs,
                wake_up=wake_up_preference,
                used_titles=used_activity_titles
            )
            raw_days.extend(chunk_days)

        # Budget Calculation
        activities_sum = sum(
            act.estimated_cost
            for d in raw_days
            for act in d.activities
        ) / max(1, travelers)

        budget_breakdown = BudgetEngine.calculate_estimate(
            days_count=days_count,
            travelers=travelers,
            target_budget=budget,
            currency=currency,
            accommodation_preference=accommodation_preference,
            origin=origin,
            destination=clean_dest,
            activities_cost_sum=activities_sum
        )

        # Validation & polishing (deduplication, anti-ping-pong, timeline feasibility)
        raw_days_dict = [d.model_dump() for d in raw_days]
        polished_days_dict, validation_report = ItineraryValidator.validate_and_polish(
            days=raw_days_dict,
            pace=pace,
            target_budget=budget,
            estimated_budget=budget_breakdown.total_estimated
        )

        # Convert polished days back to Pydantic objects
        final_days = [StructuredDay(**d) for d in polished_days_dict]

        # Contextual planning notes
        planning_notes = [
            f"{pace.title()} pacing with {len(final_days[0].activities)} primary stops on Day 1.",
            f"Geographically clustered across {len(set(d.cluster_name for d in final_days))} distinct areas to minimize travel time.",
            f"Estimated budget ₹{int(budget_breakdown.total_estimated):,} includes accommodation, dining, activities, and transport buffers."
        ]
        if budget_breakdown.is_over_budget:
            planning_notes.append(budget_breakdown.guardrail_message)

        now_utc = datetime.now(timezone.utc).isoformat()
        proposal_id = f"prop_{uuid.uuid4().hex[:12]}"

        return UnifiedItineraryProposal(
            proposal_id=proposal_id,
            title=f"Bespoke {days_count}-Day {clean_dest} Passage",
            destination=clean_dest,
            origin=origin,
            start_date=start_d.isoformat(),
            end_date=end_d.isoformat(),
            days_count=days_count,
            travelers=travelers,
            pace=pace,
            persona=persona,
            vibe=effective_vibe,
            interests=interests_list,
            target_budget=budget,
            estimated_budget=budget_breakdown.total_estimated,
            currency=currency,
            budget_breakdown=budget_breakdown,
            validation=validation_report,
            planning_notes=planning_notes,
            days=final_days,
            created_at=now_utc
        )

    @staticmethod
    def _calculate_chunks(total_days: int) -> List[Tuple[int, int]]:
        """
        Splits trip into manageable logical chunks:
        - 1 to 4 days: 1 chunk [1..N]
        - 5 days: [1..3, 4..5]
        - 7 days: [1..3, 4..6, 7..7]
        - 14 days: [1..3, 4..6, 7..9, 10..12, 13..14]
        """
        if total_days <= 4:
            return [(1, total_days)]

        chunks = []
        cursor = 1
        while cursor <= total_days:
            # Chunk of 3 days
            chunk_end = min(total_days, cursor + 2)
            chunks.append((cursor, chunk_end))
            cursor = chunk_end + 1
        return chunks

    @classmethod
    def _generate_chunk(
        cls,
        destination: str,
        geo: Optional[DestinationGeography],
        start_day: int,
        end_day: int,
        trip_start_date: date,
        travelers: int,
        pace: str,
        persona: str,
        interests: List[str],
        food_prefs: List[str],
        wake_up: str,
        used_titles: set
    ) -> List[StructuredDay]:
        """
        Synthesizes a chunk of days while consulting previously used activities to prevent repetition.
        """
        chunk_days: List[StructuredDay] = []

        for day_num in range(start_day, end_day + 1):
            day_date = trip_start_date + timedelta(days=day_num - 1)
            cluster: ClusterInfo

            if geo and geo.clusters:
                # Cycle through clusters logically
                cluster_idx = (day_num - 1) % len(geo.clusters)
                cluster = geo.clusters[cluster_idx]
            else:
                cluster = generate_fallback_cluster(destination, day_num)

            # Build activities for this day
            activities = cls._build_day_activities(
                destination=destination,
                cluster=cluster,
                day_num=day_num,
                travelers=travelers,
                pace=pace,
                persona=persona,
                interests=interests,
                food_prefs=food_prefs,
                wake_up=wake_up,
                used_titles=used_titles
            )

            # Build day object
            cover_images = [
                "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
                "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80"
            ]
            cover_img = cover_images[(day_num - 1) % len(cover_images)]

            chunk_days.append(
                StructuredDay(
                    day_number=day_num,
                    date=day_date.isoformat(),
                    title=f"Day {day_num}: {cluster.name}",
                    cluster_name=cluster.name,
                    cover_image_url=cover_img,
                    weather_summary="Pleasant & Clear · 28°C (Estimated seasonal forecast)",
                    morning_summary=f"Morning orientation and exploration in {cluster.name}.",
                    afternoon_summary="Local cuisine tasting and relaxed cultural discovery.",
                    evening_summary="Scenic twilight sundowner and atmospheric evening dining.",
                    activities=activities
                )
            )

        return chunk_days

    @classmethod
    def _build_day_activities(
        cls,
        destination: str,
        cluster: ClusterInfo,
        day_num: int,
        travelers: int,
        pace: str,
        persona: str,
        interests: List[str],
        food_prefs: List[str],
        wake_up: str,
        used_titles: set
    ) -> List[StructuredActivity]:
        """
        Creates the executable activity schedule for one day:
        Morning, Lunch/Dining, Afternoon, Evening/Sunset.
        """
        activities: List[StructuredActivity] = []
        is_veg = "vegetarian" in food_prefs or "vegan" in food_prefs
        pace_lower = pace.lower()

        # Morning start time
        morning_start = "10:00 AM" if wake_up == "late_morning" else ("08:30 AM" if pace_lower == "packed" else "09:30 AM")

        # Pick places from cluster that haven't been used yet
        available_places = [p for p in cluster.places if p.title.lower() not in used_titles]
        if not available_places:
            available_places = cluster.places

        # 1. Morning Activity (Tour/Attraction)
        morn_place = next((p for p in available_places if p.place_type == "TA"), cluster.places[0])
        used_titles.add(morn_place.title.lower())

        activities.append(
            StructuredActivity(
                id=f"act_d{day_num}_01",
                time=morning_start,
                time_slot=morning_start,
                title=morn_place.title,
                description=morn_place.description,
                location=morn_place.location,
                place_type="TA",
                period_of_day="morning",
                estimated_cost=morn_place.cost_estimate,
                cost_estimate=morn_place.cost_estimate,
                duration_minutes=morn_place.duration_minutes,
                transit_time_minutes=15 if day_num > 1 else 0,
                transit_mode="cab" if day_num == 1 else "walk",
                lat=morn_place.lat,
                lng=morn_place.lng,
                provenance=morn_place.provenance,
                source=morn_place.source,
                why_recommended=morn_place.why_recommended_template.format(cluster=cluster.name, pace=pace),
                cluster=cluster.name
            )
        )

        # 2. Lunch Break / Culinary Experience
        lunch_time = "01:00 PM"
        lunch_place = next((p for p in available_places if p.place_type == "R"), None)
        if not lunch_place:
            lunch_title = f"Authentic {'Vegetarian ' if is_veg else ''}Regional Lunch in {cluster.name}"
            lunch_desc = f"Enjoy a relaxed regional lunch break showcasing fresh seasonal flavors near {cluster.name}."
            lunch_loc = f"{cluster.name}, {destination}"
            lunch_cost = 450.0
            lunch_lat = morn_place.lat
            lunch_lng = morn_place.lng
            lunch_prov = "ESTIMATED"
            lunch_why = f"Authentic dining stop clustered within 10m walk of {morn_place.title}"
        else:
            used_titles.add(lunch_place.title.lower())
            lunch_title = lunch_place.title
            lunch_desc = lunch_place.description
            lunch_loc = lunch_place.location
            lunch_cost = lunch_place.cost_estimate
            lunch_lat = lunch_place.lat
            lunch_lng = lunch_place.lng
            lunch_prov = lunch_place.provenance
            lunch_why = lunch_place.why_recommended_template.format(cluster=cluster.name, pace=pace)

        activities.append(
            StructuredActivity(
                id=f"act_d{day_num}_02",
                time=lunch_time,
                time_slot=lunch_time,
                title=lunch_title,
                description=lunch_desc,
                location=lunch_loc,
                place_type="R",
                period_of_day="afternoon",
                estimated_cost=lunch_cost,
                cost_estimate=lunch_cost,
                duration_minutes=60,
                transit_time_minutes=10,
                transit_mode="walk",
                lat=lunch_lat,
                lng=lunch_lng,
                provenance=lunch_prov,
                source="DESTINATION_GRAPH",
                why_recommended=lunch_why,
                cluster=cluster.name
            )
        )

        # 3. Afternoon Activity (if balanced or packed, or if relaxed with leisure pause)
        if pace_lower != "relaxed" or len(cluster.places) > 2:
            afternoon_time = "03:30 PM"
            aft_place = next((p for p in available_places if p.place_type == "TA" and p.title.lower() not in used_titles), None)
            if aft_place:
                used_titles.add(aft_place.title.lower())
                aft_title = aft_place.title
                aft_desc = aft_place.description
                aft_loc = aft_place.location
                aft_cost = aft_place.cost_estimate
                aft_lat = aft_place.lat
                aft_lng = aft_place.lng
                aft_why = aft_place.why_recommended_template.format(cluster=cluster.name, pace=pace)
            else:
                aft_title = f"{cluster.name} Heritage & Artisan Stroll"
                aft_desc = f"Unrushed exploration of local artisan boutiques and quiet lanes in {cluster.name}."
                aft_loc = f"{cluster.name}, {destination}"
                aft_cost = 0.0
                aft_lat = morn_place.lat
                aft_lng = morn_place.lng
                aft_why = f"Low-intensity stroll keeping travel to zero transit from lunch"

            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_03",
                    time=afternoon_time,
                    time_slot=afternoon_time,
                    title=aft_title,
                    description=aft_desc,
                    location=aft_loc,
                    place_type="TA",
                    period_of_day="afternoon",
                    estimated_cost=aft_cost,
                    cost_estimate=aft_cost,
                    duration_minutes=90,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    lat=aft_lat,
                    lng=aft_lng,
                    provenance="CURATED",
                    source="DESTINATION_GRAPH",
                    why_recommended=aft_why,
                    cluster=cluster.name
                )
            )

        # 4. Evening Sundowner / Golden Hour
        eve_time = "05:45 PM"
        eve_place = next((p for p in available_places if "sunset" in p.tags or "twilight" in p.title.lower() or p.place_type == "TA"), None)
        if eve_place and eve_place.title.lower() not in used_titles:
            used_titles.add(eve_place.title.lower())
            eve_title = eve_place.title
            eve_desc = eve_place.description
            eve_loc = eve_place.location
            eve_cost = eve_place.cost_estimate
            eve_lat = eve_place.lat
            eve_lng = eve_place.lng
            eve_why = eve_place.why_recommended_template.format(cluster=cluster.name, pace=pace)
        else:
            eve_title = f"Golden Hour Sunset & Twilight Promenade in {cluster.name}"
            eve_desc = f"Watch the golden hour light drape the landscape followed by twilight breezes in {cluster.name}."
            eve_loc = f"{cluster.name}, {destination}"
            eve_cost = 0.0
            eve_lat = morn_place.lat
            eve_lng = morn_place.lng
            eve_why = f"Prime twilight location within the same geographical cluster"

        activities.append(
            StructuredActivity(
                id=f"act_d{day_num}_04",
                time=eve_time,
                time_slot=eve_time,
                title=eve_title,
                description=eve_desc,
                location=eve_loc,
                place_type="TA",
                period_of_day="evening",
                estimated_cost=eve_cost,
                cost_estimate=eve_cost,
                duration_minutes=75,
                transit_time_minutes=15,
                transit_mode="walk",
                lat=eve_lat,
                lng=eve_lng,
                provenance="CURATED",
                source="DESTINATION_GRAPH",
                why_recommended=eve_why,
                cluster=cluster.name
            )
        )

        return activities
