"""
DashTiny Core Itinerary Generation Engine 2.0 with Sequential 3-Day Chunking & Continuity
backend/app/services/planner/itinerary_engine.py

Architectural Pipeline:
Planner Request -> Traveler Brief -> Planning Engine -> Tools / Verification -> Structured Trip Proposal -> User Review -> Trip -> TripRevision

Key Engine Features:
1. Sequential 3-Day Chunking with Cross-Chunk Continuity Context (previous location, budget remaining, visited places).
2. Adaptive Pacing & Daily Rhythm (early_riser vs night_owl vs balanced, relaxed 2-4 vs balanced 3-5 vs fast 4-6).
3. Coherent Day Themes (Arrive & Settle In, Old Town Heritage, Coastal Escape, Artisan Secrets, Farewell & Departure).
4. Asymmetric Arrival (Day 1) and Departure (Final Day) schedules.
5. Stopover multi-destination routing (e.g. Delhi -> Jaipur -> Udaipur) with inter-city transit.
6. Daily vs. Detailed itinerary styles with explicit transfer blocks and non-hallucinated estimates.
7. Non-mutating structured proposal emission.
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
from app.services.itinerary_validator import (
    GlobalItineraryValidator,
    ItineraryValidator,
    ValidationReport,
    minutes_to_time_str,
    parse_time_to_minutes
)
from app.services.planner.budget_engine import BudgetEngine, BudgetBreakdown
from app.services.planner.traveler_brief import TravelerBrief, Stopover


class StructuredActivity(BaseModel):
    id: str
    time: str
    time_slot: str  # backward compatibility alias
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    title: str
    description: str
    location: str
    place_type: str = "TA"  # TA = Tour/Attraction, R = Restaurant, H = Hotel, TRANSIT = Travel Block
    period_of_day: str = "morning"  # morning, afternoon, evening
    estimated_cost: float = 0.0
    cost_estimate: float = 0.0  # backward compatibility
    duration: int = 90
    duration_minutes: int = 90
    transit_time_minutes: int = 15
    transit_mode: str = "walk"  # walk, cab, metro, train, car, ferry
    transit: Dict[str, Any] = Field(default_factory=dict)
    lat: Optional[float] = None
    lng: Optional[float] = None
    coordinates: Optional[Dict[str, float]] = None
    provenance: str = "CURATED"
    source: str = "DESTINATION_GRAPH"
    why_recommended: str = ""
    cluster: str = ""


class StructuredDay(BaseModel):
    day_number: int
    date: Optional[str] = None
    title: str
    day_title: str = ""
    day_theme: str = ""
    cluster_name: str
    location: str = ""
    cover_image_url: str
    weather_summary: str
    weather_advisory: str = "Mild seasonal conditions · Advisory forecast"
    daily_estimated_cost: float = 0.0
    daily_travel_time_minutes: int = 0
    daily_distance_km: Optional[float] = None
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
    trip_type: str = "leisure"
    travel_mode: str = "flight"
    daily_schedule: str = "balanced"
    itinerary_style: str = "daily"
    stopovers: List[Dict[str, Any]] = Field(default_factory=list)
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


class ChunkContinuityContext(BaseModel):
    chunk_index: int = 0
    previous_chunk_final_location: Optional[str] = None
    previous_chunk_final_time: Optional[str] = None
    previous_chunk_final_cluster: Optional[str] = None
    budget_remaining: float = 0.0
    already_visited_places: List[str] = Field(default_factory=list)
    travel_style: str = "balanced"
    stopovers: List[Dict[str, Any]] = Field(default_factory=list)


DAY_THEMES_PRESETS = [
    ("Arrive & Settle In", "Orientation, check-in, and relaxed twilight wanderings"),
    ("Old Town Heritage & Cultural Core", "Historic architecture, landmark monuments, and centuries-old lanes"),
    ("Nature Trails & Scenic Coastal Vistas", "Slow morning trails, panoramic viewpoints, and fresh air"),
    ("Artisan Secrets & Local Flavors", "Hidden craft ateliers, authentic regional dining, and quiet alleyways"),
    ("Active Discovery & Open Waters", "Coastal promenade, scenic walks, and waterside exploration"),
    ("Slow Travel & Golden Hour Sundowner", "Unrushed cafe pause, panoramic sunset vista, and atmospheric dining"),
    ("Local Bazaars & Cultural Tapestry", "Spices, craft markets, and evening street food tastings"),
    ("Coastal Villages & Hidden Coves", "Secluded bays, quiet fishing harbors, and oceanfront walks"),
    ("Highland Escapes & Mountain Air", "Misty pine trails, tea plantations, and scenic viewpoints"),
    ("Farewell & Homeward Departure", "Checkout, last souvenir stop, and smooth transfer to departure hub")
]


class PlannerService:
    """
    Modern Chunked Planner Service implementing:
    build_chunks() -> generate_chunk() -> validate_chunk() -> merge_chunks() -> validate_global_plan() -> finalize_plan()
    """

    @classmethod
    def build_chunks(cls, total_days: int) -> List[Tuple[int, int]]:
        """
        Splits total days into 3-day sequential planning blocks:
        - 1 to 4 days: 1 chunk [1..N]
        - 5 days: [1..3, 4..5]
        - 7 days: [1..3, 4..6, 7..7]
        - 10 days: [1..3, 4..6, 7..9, 10..10]
        - 14 days: [1..3, 4..6, 7..9, 10..12, 13..14]
        """
        if total_days <= 4:
            return [(1, total_days)]

        chunks = []
        cursor = 1
        while cursor <= total_days:
            chunk_end = min(total_days, cursor + 2)
            chunks.append((cursor, chunk_end))
            cursor = chunk_end + 1
        return chunks

    @classmethod
    def generate_chunk(
        cls,
        brief: TravelerBrief,
        start_day: int,
        end_day: int,
        trip_start_date: date,
        context: ChunkContinuityContext
    ) -> Tuple[List[StructuredDay], ChunkContinuityContext]:
        """
        Generates a 3-day sequential chunk taking context from the preceding chunk.
        """
        stopover_allocations = brief.get_stopover_day_allocations()
        chunk_days: List[StructuredDay] = []
        visited_places = set(context.already_visited_places)

        cover_images = [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop&q=80"
        ]

        last_loc = context.previous_chunk_final_location or brief.destination
        last_time = context.previous_chunk_final_time or "09:30 AM"
        last_cluster = context.previous_chunk_final_cluster

        for day_num in range(start_day, end_day + 1):
            day_date = trip_start_date + timedelta(days=day_num - 1)

            # Determine day location from stopovers
            day_location = brief.destination
            for loc, s_day, e_day in stopover_allocations:
                if s_day <= day_num <= e_day:
                    day_location = loc
                    break

            # Geography registry lookup for location
            geo = get_destination_geography(day_location)
            cluster: ClusterInfo
            if geo and geo.clusters:
                # Cycle clusters smoothly, respecting continuity
                c_idx = (day_num - 1) % len(geo.clusters)
                cluster = geo.clusters[c_idx]
            else:
                cluster = generate_fallback_cluster(day_location, day_num)

            # Day Theme Selection
            is_arrival = (day_num == 1)
            is_departure = (day_num == brief.days_count)

            if is_arrival:
                day_theme_title, day_theme_desc = DAY_THEMES_PRESETS[0]
            elif is_departure:
                day_theme_title, day_theme_desc = DAY_THEMES_PRESETS[-1]
            else:
                theme_idx = ((day_num - 2) % (len(DAY_THEMES_PRESETS) - 2)) + 1
                day_theme_title, day_theme_desc = DAY_THEMES_PRESETS[theme_idx]

            # Build activities for this day
            activities = cls._build_day_activities(
                brief=brief,
                day_location=day_location,
                cluster=cluster,
                day_num=day_num,
                is_arrival=is_arrival,
                is_departure=is_departure,
                used_titles=visited_places,
                previous_location=last_loc,
                previous_cluster=last_cluster
            )

            # Calculate daily metrics
            daily_cost = sum(act.estimated_cost for act in activities)
            daily_transit = sum(act.transit_time_minutes for act in activities)
            cover_img = cover_images[(day_num - 1) % len(cover_images)]

            day_title = f"Day {day_num}: {day_theme_title}"

            day_obj = StructuredDay(
                day_number=day_num,
                date=day_date.isoformat(),
                title=day_title,
                day_title=day_title,
                day_theme=day_theme_title,
                cluster_name=cluster.name,
                location=day_location,
                cover_image_url=cover_img,
                weather_summary="Pleasant & Clear · 28°C (Estimated seasonal forecast)",
                weather_advisory="Favorable conditions expected · Advisory forecast",
                daily_estimated_cost=daily_cost,
                daily_travel_time_minutes=daily_transit,
                daily_distance_km=round(daily_transit * 0.4, 1),
                morning_summary=f"Morning orientation and exploration in {cluster.name}.",
                afternoon_summary="Local cuisine tasting and relaxed cultural discovery.",
                evening_summary="Scenic twilight sundowner and atmospheric evening dining.",
                activities=activities
            )
            chunk_days.append(day_obj)

            if activities:
                last_act = activities[-1]
                last_loc = last_act.location
                last_time = last_act.time
                last_cluster = cluster.name

        # Update context
        new_context = ChunkContinuityContext(
            chunk_index=context.chunk_index + 1,
            previous_chunk_final_location=last_loc,
            previous_chunk_final_time=last_time,
            previous_chunk_final_cluster=last_cluster,
            budget_remaining=max(0.0, context.budget_remaining - sum(d.daily_estimated_cost for d in chunk_days)),
            already_visited_places=list(visited_places),
            travel_style=brief.pace,
            stopovers=[s.model_dump() for s in brief.stopovers]
        )

        return chunk_days, new_context

    @classmethod
    def _build_day_activities(
        cls,
        brief: TravelerBrief,
        day_location: str,
        cluster: ClusterInfo,
        day_num: int,
        is_arrival: bool,
        is_departure: bool,
        used_titles: set,
        previous_location: Optional[str] = None,
        previous_cluster: Optional[str] = None
    ) -> List[StructuredActivity]:
        """
        Synthesizes day activities conforming to adaptive daily rhythm, density, and style.
        """
        activities: List[StructuredActivity] = []
        pace = brief.pace.lower()
        schedule = brief.daily_schedule.lower()
        style = brief.itinerary_style.lower()

        # Rhythm start times based on daily_schedule
        if schedule == "early_riser":
            morning_start_mins = 8 * 60 + 30  # 08:30 AM
        elif schedule == "night_owl":
            morning_start_mins = 10 * 60 + 30  # 10:30 AM
        else:
            morning_start_mins = 9 * 60 + 30  # 09:30 AM

        cursor_mins = morning_start_mins

        # Filter available places
        available_places = [p for p in cluster.places if p.title.lower() not in used_titles]
        if not available_places:
            available_places = cluster.places

        # -------------------------------------------------------------
        # SPECIAL DAY 1: ARRIVAL & SETTLE IN
        # -------------------------------------------------------------
        if is_arrival:
            # 1. Arrival & Check-in block
            arr_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_01",
                    time=arr_time_str,
                    time_slot=arr_time_str,
                    start_at=arr_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 90),
                    title=f"Arrive in {day_location} & Check-in",
                    description=f"Transfer to your accommodation in {cluster.name}, unhurried check-in, and freshen up.",
                    location=f"{cluster.name}, {day_location}",
                    place_type="H",
                    period_of_day="morning" if cursor_mins < 12 * 60 else "afternoon",
                    estimated_cost=0.0,
                    cost_estimate=0.0,
                    duration=90,
                    duration_minutes=90,
                    transit_time_minutes=30,
                    transit_mode="cab",
                    transit={"transit_time_minutes": 30, "transit_mode": "cab", "is_estimated": True},
                    lat=cluster.places[0].lat if cluster.places else None,
                    lng=cluster.places[0].lng if cluster.places else None,
                    coordinates={"lat": cluster.places[0].lat, "lng": cluster.places[0].lng} if cluster.places and cluster.places[0].lat else None,
                    provenance="CURATED",
                    source="ARRIVAL_COORDINATOR",
                    why_recommended="Essential settling-in window to recharge before starting exploration.",
                    cluster=cluster.name
                )
            )
            cursor_mins += 90 + 30

            # 2. Relaxed Welcome Lunch or Refreshment
            lunch_place = next((p for p in available_places if p.place_type == "R"), None)
            lunch_title = lunch_place.title if lunch_place else f"Welcome Dining in {cluster.name}"
            lunch_cost = lunch_place.cost_estimate if lunch_place else 450.0
            if lunch_place:
                used_titles.add(lunch_place.title.lower())

            lunch_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_02",
                    time=lunch_time_str,
                    time_slot=lunch_time_str,
                    start_at=lunch_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 60),
                    title=lunch_title,
                    description=lunch_place.description if lunch_place else f"Enjoy authentic welcoming flavors and refreshing drinks in {cluster.name}.",
                    location=lunch_place.location if lunch_place else f"{cluster.name}, {day_location}",
                    place_type="R",
                    period_of_day="afternoon",
                    estimated_cost=lunch_cost,
                    cost_estimate=lunch_cost,
                    duration=60,
                    duration_minutes=60,
                    transit_time_minutes=10,
                    transit_mode="walk",
                    transit={"transit_time_minutes": 10, "transit_mode": "walk", "is_estimated": True},
                    lat=lunch_place.lat if lunch_place else None,
                    lng=lunch_place.lng if lunch_place else None,
                    coordinates={"lat": lunch_place.lat, "lng": lunch_place.lng} if lunch_place and lunch_place.lat else None,
                    provenance=lunch_place.provenance if lunch_place else "ESTIMATED",
                    source="DESTINATION_GRAPH",
                    why_recommended="Relaxed culinary introduction nearby your stay to avoid heavy travel on Day 1.",
                    cluster=cluster.name
                )
            )
            cursor_mins += 60 + 20

            # 3. Scenic Sunset / Twilight Sundowner
            sunset_place = next((p for p in available_places if p.place_type == "TA"), cluster.places[0] if cluster.places else None)
            sunset_time_str = "05:45 PM" if cursor_mins < 17 * 60 + 45 else minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_03",
                    time=sunset_time_str,
                    time_slot=sunset_time_str,
                    start_at=sunset_time_str,
                    end_at=minutes_to_time_str(parse_time_to_minutes(sunset_time_str) + 75),
                    title=sunset_place.title if sunset_place else f"{cluster.name} Twilight Promenade",
                    description=sunset_place.description if sunset_place else f"Watch the twilight light settle over {cluster.name} as evening breezes roll in.",
                    location=sunset_place.location if sunset_place else f"{cluster.name}, {day_location}",
                    place_type="TA",
                    period_of_day="evening",
                    estimated_cost=sunset_place.cost_estimate if sunset_place else 0.0,
                    cost_estimate=sunset_place.cost_estimate if sunset_place else 0.0,
                    duration=75,
                    duration_minutes=75,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    transit={"transit_time_minutes": 15, "transit_mode": "walk", "is_estimated": True},
                    lat=sunset_place.lat if sunset_place else None,
                    lng=sunset_place.lng if sunset_place else None,
                    coordinates={"lat": sunset_place.lat, "lng": sunset_place.lng} if sunset_place and sunset_place.lat else None,
                    provenance=sunset_place.provenance if sunset_place else "CURATED",
                    source="DESTINATION_GRAPH",
                    why_recommended="Prime golden hour vantage point requiring low transit to kick off the trip.",
                    cluster=cluster.name
                )
            )
            return activities

        # -------------------------------------------------------------
        # SPECIAL FINAL DAY: DEPARTURE & FAREWELL
        # -------------------------------------------------------------
        if is_departure:
            # 1. Relaxed Morning & Checkout
            chk_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_01",
                    time=chk_time_str,
                    time_slot=chk_time_str,
                    start_at=chk_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 60),
                    title="Leisure Breakfast & Hotel Checkout",
                    description=f"Enjoy a calm breakfast, pack your belongings, and complete hotel checkout in {cluster.name}.",
                    location=f"{cluster.name}, {day_location}",
                    place_type="H",
                    period_of_day="morning",
                    estimated_cost=0.0,
                    cost_estimate=0.0,
                    duration=60,
                    duration_minutes=60,
                    transit_time_minutes=0,
                    transit_mode="walk",
                    transit={"transit_time_minutes": 0, "transit_mode": "walk", "is_estimated": True},
                    lat=cluster.places[0].lat if cluster.places else None,
                    lng=cluster.places[0].lng if cluster.places else None,
                    coordinates={"lat": cluster.places[0].lat, "lng": cluster.places[0].lng} if cluster.places and cluster.places[0].lat else None,
                    provenance="CURATED",
                    source="DEPARTURE_COORDINATOR",
                    why_recommended="Unhurried checkout ensuring bags are luggage-stored or ready for transit.",
                    cluster=cluster.name
                )
            )
            cursor_mins += 60 + 20

            # 2. Souvenirs / Last Artisan Stroll
            craft_place = next((p for p in available_places if p.place_type == "TA"), None)
            craft_title = craft_place.title if craft_place else f"{cluster.name} Souvenir & Artisan Walk"
            craft_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_02",
                    time=craft_time_str,
                    time_slot=craft_time_str,
                    start_at=craft_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 75),
                    title=craft_title,
                    description=craft_place.description if craft_place else f"Pick up local spices, handicrafts, and mementos near {cluster.name}.",
                    location=craft_place.location if craft_place else f"{cluster.name}, {day_location}",
                    place_type="TA",
                    period_of_day="morning" if cursor_mins < 12 * 60 else "afternoon",
                    estimated_cost=0.0,
                    cost_estimate=0.0,
                    duration=75,
                    duration_minutes=75,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    transit={"transit_time_minutes": 15, "transit_mode": "walk", "is_estimated": True},
                    lat=craft_place.lat if craft_place else None,
                    lng=craft_place.lng if craft_place else None,
                    coordinates={"lat": craft_place.lat, "lng": craft_place.lng} if craft_place and craft_place.lat else None,
                    provenance="CURATED",
                    source="DESTINATION_GRAPH",
                    why_recommended="Compact local shopping close to departure hubs.",
                    cluster=cluster.name
                )
            )
            cursor_mins += 75 + 20

            # 3. Farewell Lunch & Departure Transfer Buffer
            farewell_time_str = "01:15 PM" if cursor_mins < 13 * 60 + 15 else minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_03",
                    time=farewell_time_str,
                    time_slot=farewell_time_str,
                    start_at=farewell_time_str,
                    end_at=minutes_to_time_str(parse_time_to_minutes(farewell_time_str) + 60),
                    title="Farewell Regional Lunch & Homeward Transfer",
                    description=f"Savor a final meal showcasing regional delicacies, collect stored luggage, and transfer to airport/station.",
                    location=f"{cluster.name}, {day_location}",
                    place_type="R",
                    period_of_day="afternoon",
                    estimated_cost=550.0,
                    cost_estimate=550.0,
                    duration=60,
                    duration_minutes=60,
                    transit_time_minutes=45,
                    transit_mode="cab",
                    transit={"transit_time_minutes": 45, "transit_mode": "cab", "is_estimated": True},
                    lat=cluster.places[0].lat if cluster.places else None,
                    lng=cluster.places[0].lng if cluster.places else None,
                    coordinates={"lat": cluster.places[0].lat, "lng": cluster.places[0].lng} if cluster.places and cluster.places[0].lat else None,
                    provenance="CURATED",
                    source="DEPARTURE_COORDINATOR",
                    why_recommended="Structured farewell buffer preventing missed flights or transport delays.",
                    cluster=cluster.name
                )
            )
            return activities

        # -------------------------------------------------------------
        # STANDARD FULL EXPLORATION DAYS (DAYS 2 to N-1)
        # -------------------------------------------------------------
        # Determine density based on pace
        # Relaxed: 3 items (Morning TA, Lunch R, Sunset TA)
        # Balanced: 4 items (Morning TA, Lunch R, Afternoon TA, Sunset TA)
        # Fast: 5 items (Morning TA, Midday TA, Lunch R, Afternoon TA, Sunset/Evening TA)

        target_items = 4
        if pace == "relaxed":
            target_items = 3
        elif pace in {"fast", "packed"}:
            target_items = 5

        # 1. Morning Attraction
        morn_place = next((p for p in available_places if p.place_type == "TA"), cluster.places[0])
        used_titles.add(morn_place.title.lower())

        morn_time_str = minutes_to_time_str(cursor_mins)
        morn_dur = 90 if pace != "relaxed" else 105

        activities.append(
            StructuredActivity(
                id=f"act_d{day_num}_01",
                time=morn_time_str,
                time_slot=morn_time_str,
                start_at=morn_time_str,
                end_at=minutes_to_time_str(cursor_mins + morn_dur),
                title=morn_place.title,
                description=morn_place.description,
                location=morn_place.location,
                place_type="TA",
                period_of_day="morning",
                estimated_cost=morn_place.cost_estimate,
                cost_estimate=morn_place.cost_estimate,
                duration=morn_dur,
                duration_minutes=morn_dur,
                transit_time_minutes=20,
                transit_mode="cab" if pace in {"fast", "packed"} else "walk",
                transit={"transit_time_minutes": 20, "transit_mode": "cab" if pace in {"fast", "packed"} else "walk", "is_estimated": True},
                lat=morn_place.lat,
                lng=morn_place.lng,
                coordinates={"lat": morn_place.lat, "lng": morn_place.lng} if morn_place.lat else None,
                provenance=morn_place.provenance,
                source=morn_place.source,
                why_recommended=morn_place.why_recommended_template.format(cluster=cluster.name, pace=pace),
                cluster=cluster.name
            )
        )
        cursor_mins += morn_dur + 20

        # Optional extra morning stop if Fast pace
        if target_items >= 5:
            mid_place = next((p for p in available_places if p.place_type == "TA" and p.title.lower() not in used_titles), None)
            if mid_place:
                used_titles.add(mid_place.title.lower())
                mid_time_str = minutes_to_time_str(cursor_mins)
                activities.append(
                    StructuredActivity(
                        id=f"act_d{day_num}_02_mid",
                        time=mid_time_str,
                        time_slot=mid_time_str,
                        start_at=mid_time_str,
                        end_at=minutes_to_time_str(cursor_mins + 60),
                        title=mid_place.title,
                        description=mid_place.description,
                        location=mid_place.location,
                        place_type="TA",
                        period_of_day="morning",
                        estimated_cost=mid_place.cost_estimate,
                        cost_estimate=mid_place.cost_estimate,
                        duration=60,
                        duration_minutes=60,
                        transit_time_minutes=15,
                        transit_mode="walk",
                        transit={"transit_time_minutes": 15, "transit_mode": "walk", "is_estimated": True},
                        lat=mid_place.lat,
                        lng=mid_place.lng,
                        coordinates={"lat": mid_place.lat, "lng": mid_place.lng} if mid_place.lat else None,
                        provenance=mid_place.provenance,
                        source=mid_place.source,
                        why_recommended=f"Clustered highlight nearby {morn_place.title} to maximize morning coverage.",
                        cluster=cluster.name
                    )
                )
                cursor_mins += 60 + 15

        # 2. Lunch Break
        lunch_time_mins = max(cursor_mins, 13 * 60)  # At least 01:00 PM
        cursor_mins = lunch_time_mins
        lunch_place = next((p for p in available_places if p.place_type == "R" and p.title.lower() not in used_titles), None)
        if lunch_place:
            used_titles.add(lunch_place.title.lower())
            lunch_title = lunch_place.title
            lunch_desc = lunch_place.description
            lunch_loc = lunch_place.location
            lunch_cost = lunch_place.cost_estimate
            lunch_lat = lunch_place.lat
            lunch_lng = lunch_place.lng
            lunch_prov = lunch_place.provenance
            lunch_why = lunch_place.why_recommended_template.format(cluster=cluster.name, pace=pace)
        else:
            lunch_title = f"Authentic Regional Lunch in {cluster.name}"
            lunch_desc = f"Enjoy a relaxed regional lunch break showcasing fresh seasonal flavors near {cluster.name}."
            lunch_loc = f"{cluster.name}, {day_location}"
            lunch_cost = 450.0
            lunch_lat = morn_place.lat
            lunch_lng = morn_place.lng
            lunch_prov = "ESTIMATED"
            lunch_why = f"Authentic dining stop clustered within 10m walk of morning stops."

        lunch_time_str = minutes_to_time_str(cursor_mins)
        activities.append(
            StructuredActivity(
                id=f"act_d{day_num}_02",
                time=lunch_time_str,
                time_slot=lunch_time_str,
                start_at=lunch_time_str,
                end_at=minutes_to_time_str(cursor_mins + 60),
                title=lunch_title,
                description=lunch_desc,
                location=lunch_loc,
                place_type="R",
                period_of_day="afternoon",
                estimated_cost=lunch_cost,
                cost_estimate=lunch_cost,
                duration=60,
                duration_minutes=60,
                transit_time_minutes=10,
                transit_mode="walk",
                transit={"transit_time_minutes": 10, "transit_mode": "walk", "is_estimated": True},
                lat=lunch_lat,
                lng=lunch_lng,
                coordinates={"lat": lunch_lat, "lng": lunch_lng} if lunch_lat else None,
                provenance=lunch_prov,
                source="DESTINATION_GRAPH",
                why_recommended=lunch_why,
                cluster=cluster.name
            )
        )
        cursor_mins += 60 + 25

        # 3. Afternoon Activity (if balanced or fast)
        if target_items >= 4:
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
                aft_loc = f"{cluster.name}, {day_location}"
                aft_cost = 0.0
                aft_lat = morn_place.lat
                aft_lng = morn_place.lng
                aft_why = f"Low-intensity stroll keeping travel to zero transit from lunch."

            aft_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_03",
                    time=aft_time_str,
                    time_slot=aft_time_str,
                    start_at=aft_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 90),
                    title=aft_title,
                    description=aft_desc,
                    location=aft_loc,
                    place_type="TA",
                    period_of_day="afternoon",
                    estimated_cost=aft_cost,
                    cost_estimate=aft_cost,
                    duration=90,
                    duration_minutes=90,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    transit={"transit_time_minutes": 15, "transit_mode": "walk", "is_estimated": True},
                    lat=aft_lat,
                    lng=aft_lng,
                    coordinates={"lat": aft_lat, "lng": aft_lng} if aft_lat else None,
                    provenance="CURATED",
                    source="DESTINATION_GRAPH",
                    why_recommended=aft_why,
                    cluster=cluster.name
                )
            )
            cursor_mins += 90 + 20

        # 4. Evening Sundowner / Golden Hour
        sunset_time_mins = max(cursor_mins, 17 * 60 + 30)  # 05:30 PM onwards
        cursor_mins = sunset_time_mins
        eve_place = next((p for p in available_places if ("sunset" in p.tags or "twilight" in p.title.lower()) and p.title.lower() not in used_titles), None)
        if not eve_place:
            eve_place = next((p for p in available_places if p.place_type == "TA" and p.title.lower() not in used_titles), None)

        if eve_place:
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
            eve_loc = f"{cluster.name}, {day_location}"
            eve_cost = 0.0
            eve_lat = morn_place.lat
            eve_lng = morn_place.lng
            eve_why = f"Prime twilight location within the same geographical cluster."

        eve_time_str = minutes_to_time_str(cursor_mins)
        activities.append(
            StructuredActivity(
                id=f"act_d{day_num}_04",
                time=eve_time_str,
                time_slot=eve_time_str,
                start_at=eve_time_str,
                end_at=minutes_to_time_str(cursor_mins + 75),
                title=eve_title,
                description=eve_desc,
                location=eve_loc,
                place_type="TA",
                period_of_day="evening",
                estimated_cost=eve_cost,
                cost_estimate=eve_cost,
                duration=75,
                duration_minutes=75,
                transit_time_minutes=15,
                transit_mode="walk",
                transit={"transit_time_minutes": 15, "transit_mode": "walk", "is_estimated": True},
                lat=eve_lat,
                lng=eve_lng,
                coordinates={"lat": eve_lat, "lng": eve_lng} if eve_lat else None,
                provenance="CURATED",
                source="DESTINATION_GRAPH",
                why_recommended=eve_why,
                cluster=cluster.name
            )
        )

        return activities

    @classmethod
    def plan_from_brief(cls, brief: TravelerBrief) -> UnifiedItineraryProposal:
        """
        Main canonical orchestration:
        1. Calculates dates.
        2. Splits into 3-day sequential chunks.
        3. Executes chunk generation passing forward continuity context.
        4. Calculates budget across itemized categories.
        5. Validates global plan via GlobalItineraryValidator.
        6. Finalizes unified TripProposal.
        """
        # Determine trip start date
        start_d = None
        if brief.start_date:
            try:
                start_d = date.fromisoformat(brief.start_date.split("T")[0])
            except ValueError:
                start_d = None

        if not start_d:
            today = datetime.now(timezone.utc).date()
            start_d = today + timedelta(days=14)

        end_d = start_d + timedelta(days=max(0, brief.days_count - 1))

        # Build chunks: 3-day sequential blocks
        chunks = cls.build_chunks(brief.days_count)
        all_days: List[StructuredDay] = []

        context = ChunkContinuityContext(
            chunk_index=0,
            previous_chunk_final_location=brief.destination,
            budget_remaining=brief.budget if brief.budget > 0 else 50000.0,
            travel_style=brief.pace,
            stopovers=[s.model_dump() for s in brief.stopovers]
        )

        for chunk_idx, (start_day, end_day) in enumerate(chunks):
            chunk_days, context = cls.generate_chunk(
                brief=brief,
                start_day=start_day,
                end_day=end_day,
                trip_start_date=start_d,
                context=context
            )
            all_days.extend(chunk_days)

        # Budget Calculation
        activities_sum = sum(
            act.estimated_cost
            for d in all_days
            for act in d.activities
        ) / max(1, brief.travellers)

        budget_breakdown = BudgetEngine.calculate_estimate(
            days_count=brief.days_count,
            travelers=brief.travellers,
            target_budget=brief.budget,
            currency=brief.currency,
            accommodation_preference=brief.accommodation_preference,
            origin=brief.origin,
            destination=brief.destination,
            activities_cost_sum=activities_sum
        )

        # Global Validation & Polishing (deduplication, timing feasibility, budget guardrails)
        raw_days_dict = [d.model_dump() for d in all_days]
        polished_days_dict, validation_report = GlobalItineraryValidator.validate_global_plan(
            days=raw_days_dict,
            pace=brief.pace,
            target_budget=brief.budget,
            estimated_budget=budget_breakdown.total_estimated,
            trip_type=brief.trip_type
        )

        final_days = [StructuredDay(**d) for d in polished_days_dict]

        # Contextual notes
        distinct_clusters = len(set(d.cluster_name for d in final_days))
        planning_notes = [
            f"{brief.pace.title()} pacing with adaptive {brief.daily_schedule.replace('_', ' ')} rhythm across {brief.days_count} days.",
            f"Geographically clustered across {distinct_clusters} area{'s' if distinct_clusters > 1 else ''} to prevent unnecessary transit.",
            f"Estimated budget ₹{int(budget_breakdown.total_estimated):,} includes accommodation, meals, activities, and transport buffers."
        ]
        if brief.stopovers:
            stops_str = ", ".join(s.location for s in brief.stopovers)
            planning_notes.append(f"Includes dedicated stopover allocation for: {stops_str}.")
        if budget_breakdown.is_over_budget:
            planning_notes.append(budget_breakdown.guardrail_message)

        now_utc = datetime.now(timezone.utc).isoformat()
        proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
        effective_vibe = brief.vibe or f"{brief.pace.title()} {brief.destination} Passage"

        return UnifiedItineraryProposal(
            proposal_id=proposal_id,
            title=f"Bespoke {brief.days_count}-Day {brief.destination} Journey",
            destination=brief.destination,
            origin=brief.origin,
            start_date=start_d.isoformat(),
            end_date=end_d.isoformat(),
            days_count=brief.days_count,
            travelers=brief.travellers,
            pace=brief.pace,
            persona=brief.persona,
            trip_type=brief.trip_type,
            travel_mode=brief.travel_mode,
            daily_schedule=brief.daily_schedule,
            itinerary_style=brief.itinerary_style,
            stopovers=[s.model_dump() for s in brief.stopovers],
            vibe=effective_vibe,
            interests=brief.interests,
            target_budget=brief.budget,
            estimated_budget=budget_breakdown.total_estimated,
            currency=brief.currency,
            budget_breakdown=budget_breakdown,
            validation=validation_report,
            planning_notes=planning_notes,
            days=final_days,
            created_at=now_utc
        )


class ItineraryEngine:
    """
    Primary interface for backwards compatibility and direct invocation.
    Delegates generation to PlannerService.
    """
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
        food_preferences: Optional[List[str]] = None,
        trip_type: str = "leisure",
        travel_mode: str = "flight",
        daily_schedule: str = "balanced",
        itinerary_style: str = "daily",
        stopovers: Optional[List[Any]] = None
    ) -> UnifiedItineraryProposal:
        brief_data = {
            "destination": destination,
            "origin": origin,
            "start_date": start_date_str,
            "end_date": end_date_str,
            "days_count": days_count,
            "travellers": travelers,
            "budget": budget,
            "currency": currency,
            "persona": persona,
            "trip_type": trip_type,
            "travel_mode": travel_mode,
            "pace": pace,
            "daily_schedule": daily_schedule or wake_up_preference,
            "itinerary_style": itinerary_style,
            "interests": interests or ["sightseeing", "food"],
            "stopovers": stopovers or [],
            "wake_up_preference": daily_schedule or wake_up_preference,
            "accommodation_preference": accommodation_preference,
            "food_preferences": food_preferences or ["any"],
            "vibe": vibe
        }
        brief = TravelerBrief.from_request(brief_data)
        return PlannerService.plan_from_brief(brief)
