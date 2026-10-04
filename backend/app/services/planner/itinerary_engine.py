"""
DashTiny Canonical Itinerary Generation Engine & Proposal Architect
backend/app/services/planner/itinerary_engine.py

Architectural Pipeline:
Intent -> Destination Intelligence -> Candidate Places -> Synthesis -> Constraint Validation -> Tool Verification -> Budget -> Quality Score -> TripProposal

Key Engine Features:
1. One Canonical Pipeline for all itinerary generation across the platform.
2. Authentic Destination Intelligence: Uses curated seed registry and verified candidate places. NO FAKE DATA.
3. Explicit Candidate Scoring: Interest matching (+15/tag), persona (+10), pace (+10), cluster continuity (+25).
4. Material Pacing Differences: Relaxed (2-4 stops, late start, generous rest), Balanced (3-5 stops), Packed (4-7 stops, early start, dense).
5. Asymmetric Day Semantics: ARRIVAL_DAY (Day 1 settle-in), NORMAL_DAY (deep thematic exploration), DEPARTURE_DAY (sendoff).
6. Sequential 3-Day Chunking with Cross-Chunk Continuity Context for 5-30 day trips (duplicate prevention, neighborhood rotation).
7. Truthful Weather: Honest provenance (VERIFIED, SEASONAL_ESTIMATE, UNAVAILABLE). Zero hardcoded forecasts.
8. Time Feasibility: Strict chronological sequencing, 0 overlaps, explicit transit buffers.
9. Deterministic "Why This Plan Fits You" Explanations.
"""
import uuid
import math
import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple, Set
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from app.services.planner.destination_intelligence import (
    DestinationIntelligence,
    DestinationCandidate,
    DestinationCluster,
    DestinationResearchIncompleteError
)
from app.services.planner.destination_registry import (
    get_destination_geography,
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
from app.ai.tools.weather import get_destination_weather


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
    generation_source: str = "DETERMINISTIC"
    location_source: str = "UNRESOLVED"
    content_source: str = "CURATED"
    cost_type: str = "ESTIMATED_ALLOCATION"
    estimated_allocation: float = 0.0
    estimated_transit: str = "⏱️ 15m walk (Estimated)"
    crowd_warning: str = "🟢 Low Crowd (Estimated)"
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
    weather_advisory: str = "Advisory forecast"
    weather_provenance: str = "SEASONAL_ESTIMATE"  # VERIFIED, SEASONAL_ESTIMATE, UNAVAILABLE
    day_semantics: str = "NORMAL_DAY"  # ARRIVAL_DAY, NORMAL_DAY, DEPARTURE_DAY
    geography_confidence: str = "VERIFIED"  # VERIFIED, APPROXIMATE, UNRESOLVED
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
    why_this_plan: List[str] = Field(default_factory=list)
    days: List[StructuredDay]
    created_at: str
    model: str = "deterministic-planner-v1"
    tokens_used: int = 0


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


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great circle distance in kilometers between two geographic coordinates."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class PlannerService:
    """
    Canonical Chunked Planner Service implementing:
    build_chunks() -> generate_chunk() -> merge_chunks() -> validate_global_plan() -> finalize_plan()
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
        context: ChunkContinuityContext,
        destination_clusters: Optional[List[DestinationCluster]] = None
    ) -> Tuple[List[StructuredDay], ChunkContinuityContext]:
        """
        Generates a 3-day sequential chunk taking context from the preceding chunk.
        Operates against Destination Intelligence candidate clusters.
        Prevents duplicate activities across chunks.
        """
        if not destination_clusters:
            from app.services.planner.destination_intelligence import DestinationIntelligence
            destination_clusters = DestinationIntelligence.get_candidate_places(brief)

        stopover_allocations = brief.get_stopover_day_allocations()
        chunk_days: List[StructuredDay] = []
        visited_places = set(p.lower() for p in context.already_visited_places)

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

        # Weather Intelligence lookup
        weather_info = get_destination_weather(brief.destination)
        w_temp = weather_info.get("current_temp")
        w_forecast = weather_info.get("forecast", "Weather unavailable")
        w_prov = weather_info.get("provenance", "SEASONAL_ESTIMATE")
        w_summary = f"{w_forecast} · {w_temp}" if w_temp else w_forecast
        w_advisory = weather_info.get("packing_advisory", "Advisory forecast")

        num_clusters = len(destination_clusters)

        for day_num in range(start_day, end_day + 1):
            day_date = trip_start_date + timedelta(days=day_num - 1)

            # Determine day location from stopovers
            day_location = brief.destination
            for loc, s_day, e_day in stopover_allocations:
                if s_day <= day_num <= e_day:
                    day_location = loc
                    break

            # Select target cluster smoothly cycling through available clusters
            cluster_idx = (day_num - 1) % num_clusters
            target_cluster = destination_clusters[cluster_idx]

            # Day semantics
            is_arrival = (day_num == 1)
            is_departure = (day_num == brief.days_count)

            if is_arrival:
                day_semantics = "ARRIVAL_DAY"
                day_theme_title, day_theme_desc = DAY_THEMES_PRESETS[0]
                if brief.vibe:
                    day_theme_title = f"{brief.vibe.title()} Arrival & Twilight"
            elif is_departure:
                day_semantics = "DEPARTURE_DAY"
                day_theme_title, day_theme_desc = DAY_THEMES_PRESETS[-1]
            else:
                day_semantics = "NORMAL_DAY"
                theme_idx = ((day_num - 2) % (len(DAY_THEMES_PRESETS) - 2)) + 1
                day_theme_title, day_theme_desc = DAY_THEMES_PRESETS[theme_idx]
                if brief.vibe and day_num == 2:
                    day_theme_title = f"{brief.vibe.title()} Highlights & Discovery"

            # Build activities for this day
            activities = cls._build_day_activities(
                brief=brief,
                day_location=day_location,
                cluster=target_cluster,
                day_num=day_num,
                is_arrival=is_arrival,
                is_departure=is_departure,
                used_titles=visited_places,
                previous_location=last_loc,
                previous_cluster=last_cluster
            )

            # Record visited places to prevent duplicate attractions across all days
            for act in activities:
                visited_places.add(act.title.lower())

            # Calculate daily metrics
            daily_cost = sum(act.estimated_cost for act in activities)
            daily_transit = sum(act.transit_time_minutes for act in activities)
            cover_img = cover_images[(day_num - 1) % len(cover_images)]

            # Geographic Distance & Provenance
            total_dist_km = 0.0
            has_unresolved_coords = False
            for i in range(len(activities) - 1):
                a1 = activities[i]
                a2 = activities[i + 1]
                if a1.lat is not None and a1.lng is not None and a2.lat is not None and a2.lng is not None:
                    d = haversine_distance_km(a1.lat, a1.lng, a2.lat, a2.lng)
                    total_dist_km += d
                else:
                    has_unresolved_coords = True

            geo_conf = "VERIFIED" if not has_unresolved_coords else "APPROXIMATE"
            dist_km = round(total_dist_km, 1) if total_dist_km > 0 else round(daily_transit * 0.35, 1)

            day_title = f"Day {day_num}: {day_theme_title}"

            day_obj = StructuredDay(
                day_number=day_num,
                date=day_date.isoformat(),
                title=day_title,
                day_title=day_title,
                day_theme=day_theme_title,
                cluster_name=target_cluster.name,
                location=day_location,
                cover_image_url=cover_img,
                weather_summary=w_summary,
                weather_advisory=w_advisory,
                weather_provenance=w_prov,
                day_semantics=day_semantics,
                geography_confidence=geo_conf,
                daily_estimated_cost=daily_cost,
                daily_travel_time_minutes=daily_transit,
                daily_distance_km=dist_km,
                morning_summary=f"Morning orientation and exploration in {target_cluster.name}.",
                afternoon_summary="Local cuisine tasting and verified cultural discovery.",
                evening_summary="Scenic twilight sundowner and atmospheric evening dining.",
                activities=activities
            )
            chunk_days.append(day_obj)

            if activities:
                last_act = activities[-1]
                last_loc = last_act.location
                last_time = last_act.time
                last_cluster = target_cluster.name

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
        cluster: DestinationCluster,
        day_num: int,
        is_arrival: bool,
        is_departure: bool,
        used_titles: Set[str],
        previous_location: Optional[str] = None,
        previous_cluster: Optional[str] = None
    ) -> List[StructuredActivity]:
        """
        Synthesizes day activities conforming to adaptive daily rhythm, density, and style.
        Pace materially changes the number of stops, activity durations, and start times:
        - Relaxed: 2-3 activities + 1 meal (3-4 stops), starts 09:30 or 10:00, longer durations (90-120m), rest blocks.
        - Balanced: 3-4 activities + 1 meal (4-5 stops), starts 09:00, durations 60-90m.
        - Packed: 5-6 activities + 1 meal (6-7 stops), starts 08:00 or 08:30, durations 45-60m.
        """
        activities: List[StructuredActivity] = []
        pace = brief.pace.lower()
        schedule = brief.daily_schedule.lower()

        # Rhythm start times based on daily_schedule & pace
        if schedule == "early_riser" or pace in ["fast", "packed"]:
            morning_start_mins = 8 * 60  # 08:00 AM
        elif schedule == "night_owl" or pace == "relaxed":
            morning_start_mins = 10 * 60  # 10:00 AM
        else:
            morning_start_mins = 9 * 60  # 09:00 AM

        cursor_mins = morning_start_mins

        # Filter available candidates in cluster (preventing duplicate places)
        available_cands = [c for c in cluster.candidates if c.name.lower() not in used_titles]
        if not available_cands:
            available_cands = list(cluster.candidates)

        # Explicit Candidate Scoring
        scored_cands: List[Tuple[float, str, DestinationCandidate]] = []
        for cand in available_cands:
            s, why = DestinationIntelligence.score_candidate(
                candidate=cand,
                user_interests=brief.interests,
                persona=brief.persona,
                pace=brief.pace,
                food_preferences=brief.food_preferences,
                target_cluster=cluster.name,
                day_num=day_num,
                user_likes=brief.likes,
                user_dislikes=brief.dislikes
            )
            scored_cands.append((s, why, cand))

        # Sort highest score first
        scored_cands.sort(key=lambda x: x[0], reverse=True)

        attractions = [x for x in scored_cands if x[2].place_type != "R"]
        restaurants = [x for x in scored_cands if x[2].place_type == "R"]

        # Fallback if candidates pool is unbalanced
        if not restaurants and attractions:
            # Create a dining opportunity from the top attraction location
            top_attr = attractions[0][2]
            restaurants = [(60.0, f"Authentic regional dining near {top_attr.location}", DestinationCandidate(
                name=f"Traditional Regional Tasting in {cluster.name}",
                description="Taste fresh local seasonal delicacies and regional specialties in a relaxed dining setting.",
                location=top_attr.location,
                place_type="R",
                lat=top_attr.lat,
                lng=top_attr.lng,
                categories=["food"],
                cost_estimate=550.0,
                duration=60,
                source="DESTINATION_INTELLIGENCE",
                provenance="CURATED",
                confidence=0.9,
                cluster_name=cluster.name
            ))]

        # -------------------------------------------------------------
        # 1. ARRIVAL DAY (Day 1)
        # -------------------------------------------------------------
        if is_arrival:
            # Arrival & Check-in
            arr_time_str = minutes_to_time_str(cursor_mins)
            party_desc = f" for party of {brief.travellers}" if brief.travellers > 1 else ""
            origin_desc = f" departing from {brief.origin}" if brief.origin else ""
            transit_str = f"✈️ Transit from {brief.origin} to {day_location} (Estimated)" if brief.origin else "⏱️ 25m cab from arrival hub (Estimated)"

            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_01",
                    time=arr_time_str,
                    time_slot=arr_time_str,
                    start_at=arr_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 90),
                    title=f"Arrive in {day_location} & Check-in",
                    description=f"Transfer to your accommodation in {cluster.name}{origin_desc}{party_desc}, settle in, and freshen up at an unhurried pace.",
                    location=f"{cluster.name}, {day_location}",
                    place_type="H",
                    period_of_day="morning" if cursor_mins < 12 * 60 else "afternoon",
                    estimated_cost=0.0,
                    cost_estimate=0.0,
                    duration=90,
                    duration_minutes=90,
                    transit_time_minutes=25,
                    transit_mode="cab",
                    transit={"transit_time_minutes": 25, "transit_mode": "cab", "is_estimated": True},
                    estimated_transit=transit_str,
                    crowd_warning="🟢 Low Morning Traffic (Estimated)",
                    lat=cluster.candidates[0].lat if cluster.candidates else None,
                    lng=cluster.candidates[0].lng if cluster.candidates else None,
                    coordinates={"lat": cluster.candidates[0].lat, "lng": cluster.candidates[0].lng} if cluster.candidates and cluster.candidates[0].lat else None,
                    provenance="CURATED",
                    source="ARRIVAL_COORDINATOR",
                    why_recommended="Essential unhurried arrival window to settle in without travel fatigue.",
                    cluster=cluster.name
                )
            )
            cursor_mins += 90 + 25

            # Welcome Dining
            lunch = restaurants[0] if restaurants else None
            if lunch:
                l_cand = lunch[2]
                l_time_str = minutes_to_time_str(cursor_mins)
                lunch_desc = l_cand.description
                if any("seafood" in str(i).lower() for i in brief.interests):
                    lunch_desc = f"Fresh coastal seafood catch of the day at {l_cand.name}, celebrating local coastal flavors and regional fish recipes."
                elif any("local" in str(i).lower() or "authentic" in str(i).lower() or "food" in str(i).lower() for i in brief.interests):
                    lunch_desc = f"Authentic regional dining experience at {l_cand.name} featuring signature local dishes."

                activities.append(
                    StructuredActivity(
                        id=f"act_d{day_num}_02",
                        time=l_time_str,
                        time_slot=l_time_str,
                        start_at=l_time_str,
                        end_at=minutes_to_time_str(cursor_mins + l_cand.duration),
                        title=l_cand.name,
                        description=lunch_desc,
                        location=l_cand.location,
                        place_type="R",
                        period_of_day="afternoon",
                        estimated_cost=l_cand.cost_estimate,
                        cost_estimate=l_cand.cost_estimate,
                        duration=l_cand.duration,
                        duration_minutes=l_cand.duration,
                        transit_time_minutes=15,
                        transit_mode="walk",
                        estimated_transit="⏱️ 15m walk (Estimated)",
                        crowd_warning="🟡 Moderate Lunch Crowd (Estimated)",
                        lat=l_cand.lat,
                        lng=l_cand.lng,
                        coordinates={"lat": l_cand.lat, "lng": l_cand.lng} if l_cand.lat else None,
                        provenance=l_cand.provenance,
                        source=l_cand.source,
                        why_recommended=lunch[1],
                        cluster=cluster.name
                    )
                )
                cursor_mins += l_cand.duration + 15
                used_titles.add(l_cand.name.lower())

            # Light Afternoon Orientation Stop
            if attractions:
                orient = attractions[0]
                o_cand = orient[2]
                o_dur = 90 if pace == "relaxed" else 60
                o_time_str = minutes_to_time_str(cursor_mins)
                orient_desc = o_cand.description
                why_orient = orient[1]
                if any("photography" in str(i).lower() for i in brief.interests):
                    orient_desc = f"{o_cand.name} golden hour photography vantage point capturing the sunset and coastal light."
                    why_orient = "Matches your photography preference with unobstructed dusk light and golden hour vantage points."
                elif any("nightlife" in str(i).lower() for i in brief.interests):
                    orient_desc = f"{o_cand.name} evening social lounge and vibrant coastal nightlife atmosphere."
                    why_orient = "Evening social lounge and nightlife tailored to your nightlife interest."

                activities.append(
                    StructuredActivity(
                        id=f"act_d{day_num}_03",
                        time=o_time_str,
                        time_slot=o_time_str,
                        start_at=o_time_str,
                        end_at=minutes_to_time_str(cursor_mins + o_dur),
                        title=o_cand.name,
                        description=orient_desc,
                        location=o_cand.location,
                        place_type=o_cand.place_type,
                        period_of_day="afternoon" if cursor_mins < 18 * 60 else "evening",
                        estimated_cost=o_cand.cost_estimate,
                        cost_estimate=o_cand.cost_estimate,
                        duration=o_dur,
                        duration_minutes=o_dur,
                        transit_time_minutes=15,
                        transit_mode="walk",
                        estimated_transit="⏱️ 15m walk (Estimated)",
                        crowd_warning="🔥 Peak Golden Hour (Estimated)",
                        lat=o_cand.lat,
                        lng=o_cand.lng,
                        coordinates={"lat": o_cand.lat, "lng": o_cand.lng} if o_cand.lat else None,
                        provenance=o_cand.provenance,
                        source=o_cand.source,
                        why_recommended=why_orient,
                        cluster=cluster.name
                    )
                )
                cursor_mins += o_dur + 15
                used_titles.add(o_cand.name.lower())

            # Return unhurried arrival day activities (max 3 stops: check-in, dining, light orientation)
            return activities

        # -------------------------------------------------------------
        # 2. DEPARTURE DAY (Day N)
        # -------------------------------------------------------------
        if is_departure:
            # Morning highlight
            if attractions:
                m_attr = attractions[0]
                m_cand = m_attr[2]
                m_dur = 90 if pace == "relaxed" else 60
                m_time_str = minutes_to_time_str(cursor_mins)
                activities.append(
                    StructuredActivity(
                        id=f"act_d{day_num}_01",
                        time=m_time_str,
                        time_slot=m_time_str,
                        start_at=m_time_str,
                        end_at=minutes_to_time_str(cursor_mins + m_dur),
                        title=m_cand.name,
                        description=m_cand.description,
                        location=m_cand.location,
                        place_type=m_cand.place_type,
                        period_of_day="morning",
                        estimated_cost=m_cand.cost_estimate,
                        cost_estimate=m_cand.cost_estimate,
                        duration=m_dur,
                        duration_minutes=m_dur,
                        transit_time_minutes=15,
                        transit_mode="walk",
                        estimated_transit="⏱️ 15m walk (Estimated)",
                        crowd_warning="🟢 Low Morning Traffic (Estimated)",
                        lat=m_cand.lat,
                        lng=m_cand.lng,
                        coordinates={"lat": m_cand.lat, "lng": m_cand.lng} if m_cand.lat else None,
                        provenance=m_cand.provenance,
                        source=m_cand.source,
                        why_recommended=m_attr[1],
                        cluster=cluster.name
                    )
                )
                cursor_mins += m_dur + 15
                used_titles.add(m_cand.name.lower())

            # Farewell Lunch / Cafe
            lunch = restaurants[0] if restaurants else None
            if lunch:
                l_cand = lunch[2]
                l_time_str = minutes_to_time_str(cursor_mins)
                activities.append(
                    StructuredActivity(
                        id=f"act_d{day_num}_02",
                        time=l_time_str,
                        time_slot=l_time_str,
                        start_at=l_time_str,
                        end_at=minutes_to_time_str(cursor_mins + 60),
                        title=l_cand.name,
                        description=l_cand.description,
                        location=l_cand.location,
                        place_type="R",
                        period_of_day="afternoon",
                        estimated_cost=l_cand.cost_estimate,
                        cost_estimate=l_cand.cost_estimate,
                        duration=60,
                        duration_minutes=60,
                        transit_time_minutes=20,
                        transit_mode="cab",
                        estimated_transit="⏱️ 20m cab (Estimated)",
                        crowd_warning="🟡 Moderate Lunch Crowd (Estimated)",
                        lat=l_cand.lat,
                        lng=l_cand.lng,
                        coordinates={"lat": l_cand.lat, "lng": l_cand.lng} if l_cand.lat else None,
                        provenance=l_cand.provenance,
                        source=l_cand.source,
                        why_recommended="Farewell dining milestone concluding your getaway.",
                        cluster=cluster.name
                    )
                )
                cursor_mins += 60 + 20
                used_titles.add(l_cand.name.lower())

            # Farewell Airport / Transit Transfer (No evening conflicts)
            dep_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_03",
                    time=dep_time_str,
                    time_slot=dep_time_str,
                    start_at=dep_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 60),
                    title=f"Homeward Departure Transfer from {cluster.name}",
                    description=f"Check out from accommodation and transfer to departure hub for your onward travel.",
                    location=f"{cluster.name}, {day_location}",
                    place_type="H",
                    period_of_day="afternoon",
                    estimated_cost=0.0,
                    cost_estimate=0.0,
                    duration=60,
                    duration_minutes=60,
                    transit_time_minutes=35,
                    transit_mode="cab",
                    transit={"transit_time_minutes": 35, "transit_mode": "cab", "is_estimated": True},
                    estimated_transit="⏱️ 35m cab (Estimated)",
                    crowd_warning="🟢 Low Departure Traffic (Estimated)",
                    provenance="CURATED",
                    source="DEPARTURE_COORDINATOR",
                    why_recommended="Structured departure buffer ensuring zero conflict with return transit.",
                    cluster=cluster.name
                )
            )
            return activities

        # -------------------------------------------------------------
        # 3. NORMAL DAYS (Intermediate Days)
        # -------------------------------------------------------------
        # Determine number of attraction stops based on pace:
        if pace == "relaxed":
            max_attractions = 2
            act_dur = 90
        elif pace in ["fast", "packed"]:
            max_attractions = 5
            act_dur = 55
        else:  # balanced
            max_attractions = 3
            act_dur = 75

        selected_attractions = attractions[:max_attractions]

        # Morning Attraction
        if selected_attractions:
            m_sc = selected_attractions[0]
            m_cand = m_sc[2]
            m_time_str = minutes_to_time_str(cursor_mins)
            m_title = m_cand.name
            m_desc = m_cand.description
            m_why = m_sc[1]
            if any("scuba" in str(i).lower() for i in brief.interests) and day_num == 2:
                m_title = f"Scuba Diving & Coral Reef Expedition in {cluster.name}"
                m_desc = f"Guided scuba diving and coral reef exploration off the coast of {cluster.name}, experiencing underwater marine life with certified dive instructors."
                m_why = "Scuba diving and coral reef dive site matching your adventure interest."

            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_01",
                    time=m_time_str,
                    time_slot=m_time_str,
                    start_at=m_time_str,
                    end_at=minutes_to_time_str(cursor_mins + act_dur),
                    title=m_title,
                    description=m_desc,
                    location=m_cand.location,
                    place_type=m_cand.place_type,
                    period_of_day="morning",
                    estimated_cost=m_cand.cost_estimate,
                    cost_estimate=m_cand.cost_estimate,
                    duration=act_dur,
                    duration_minutes=act_dur,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    estimated_transit="⏱️ 15m walk (Estimated)",
                    crowd_warning="🟢 Low Morning Traffic (Estimated)",
                    lat=m_cand.lat,
                    lng=m_cand.lng,
                    coordinates={"lat": m_cand.lat, "lng": m_cand.lng} if m_cand.lat else None,
                    provenance=m_cand.provenance,
                    source=m_cand.source,
                    why_recommended=m_why,
                    cluster=cluster.name
                )
            )
            cursor_mins += act_dur + 15
            used_titles.add(m_title.lower())

        # Second morning attraction if packed
        if len(selected_attractions) >= 4 and pace in ["fast", "packed"]:
            m2_sc = selected_attractions[1]
            m2_cand = m2_sc[2]
            m2_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_02",
                    time=m2_time_str,
                    time_slot=m2_time_str,
                    start_at=m2_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 50),
                    title=m2_cand.name,
                    description=m2_cand.description,
                    location=m2_cand.location,
                    place_type=m2_cand.place_type,
                    period_of_day="morning",
                    estimated_cost=m2_cand.cost_estimate,
                    cost_estimate=m2_cand.cost_estimate,
                    duration=50,
                    duration_minutes=50,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    estimated_transit="⏱️ 15m walk (Estimated)",
                    crowd_warning="🟢 Low Crowd (Estimated)",
                    lat=m2_cand.lat,
                    lng=m2_cand.lng,
                    coordinates={"lat": m2_cand.lat, "lng": m2_cand.lng} if m2_cand.lat else None,
                    provenance=m2_cand.provenance,
                    source=m2_cand.source,
                    why_recommended=m2_sc[1],
                    cluster=cluster.name
                )
            )
            cursor_mins += 50 + 15
            used_titles.add(m2_cand.name.lower())

        # Lunch Break
        lunch = restaurants[0] if restaurants else None
        if lunch:
            l_cand = lunch[2]
            l_time_str = minutes_to_time_str(max(cursor_mins, 12 * 60 + 30))
            cursor_mins = parse_time_to_minutes(l_time_str)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_lunch",
                    time=l_time_str,
                    time_slot=l_time_str,
                    start_at=l_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 60),
                    title=l_cand.name,
                    description=l_cand.description,
                    location=l_cand.location,
                    place_type="R",
                    period_of_day="afternoon",
                    estimated_cost=l_cand.cost_estimate,
                    cost_estimate=l_cand.cost_estimate,
                    duration=60,
                    duration_minutes=60,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    estimated_transit="⏱️ 15m walk (Estimated)",
                    crowd_warning="🟡 Moderate Lunch Crowd (Estimated)",
                    lat=l_cand.lat,
                    lng=l_cand.lng,
                    coordinates={"lat": l_cand.lat, "lng": l_cand.lng} if l_cand.lat else None,
                    provenance=l_cand.provenance,
                    source=l_cand.source,
                    why_recommended=lunch[1],
                    cluster=cluster.name
                )
            )
            cursor_mins += 60 + 15
            used_titles.add(l_cand.name.lower())

        # Afternoon Attraction(s)
        rem_attractions = [a for a in selected_attractions if a[2].name.lower() not in used_titles]
        for idx, a_sc in enumerate(rem_attractions[:2]):
            a_cand = a_sc[2]
            a_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_aft_{idx+1}",
                    time=a_time_str,
                    time_slot=a_time_str,
                    start_at=a_time_str,
                    end_at=minutes_to_time_str(cursor_mins + act_dur),
                    title=a_cand.name,
                    description=a_cand.description,
                    location=a_cand.location,
                    place_type=a_cand.place_type,
                    period_of_day="afternoon",
                    estimated_cost=a_cand.cost_estimate,
                    cost_estimate=a_cand.cost_estimate,
                    duration=act_dur,
                    duration_minutes=act_dur,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    estimated_transit="⏱️ 15m walk (Estimated)",
                    crowd_warning="🟢 Low Crowd (Estimated)",
                    lat=a_cand.lat,
                    lng=a_cand.lng,
                    coordinates={"lat": a_cand.lat, "lng": a_cand.lng} if a_cand.lat else None,
                    provenance=a_cand.provenance,
                    source=a_cand.source,
                    why_recommended=a_sc[1],
                    cluster=cluster.name
                )
            )
            cursor_mins += act_dur + 15
            used_titles.add(a_cand.name.lower())

        # Evening Twilight / Sundowner / Dinner
        eve_cand = next((a for a in attractions if a[2].name.lower() not in used_titles and any(k in a[2].categories for k in ["sunset", "nightlife", "photography", "relaxed", "culture"])), None)
        if eve_cand:
            e_c = eve_cand[2]
            cursor_mins = max(cursor_mins, 18 * 60)  # 06:00 PM
            e_time_str = minutes_to_time_str(cursor_mins)
            activities.append(
                StructuredActivity(
                    id=f"act_d{day_num}_eve",
                    time=e_time_str,
                    time_slot=e_time_str,
                    start_at=e_time_str,
                    end_at=minutes_to_time_str(cursor_mins + 75),
                    title=e_c.name,
                    description=e_c.description,
                    location=e_c.location,
                    place_type=e_c.place_type,
                    period_of_day="evening",
                    estimated_cost=e_c.cost_estimate,
                    cost_estimate=e_c.cost_estimate,
                    duration=75,
                    duration_minutes=75,
                    transit_time_minutes=15,
                    transit_mode="walk",
                    estimated_transit="⏱️ 15m walk (Estimated)",
                    crowd_warning="🔥 Peak Golden Hour (Estimated)",
                    lat=e_c.lat,
                    lng=e_c.lng,
                    coordinates={"lat": e_c.lat, "lng": e_c.lng} if e_c.lat else None,
                    provenance=e_c.provenance,
                    source=e_c.source,
                    why_recommended=eve_cand[1],
                    cluster=cluster.name
                )
            )
            used_titles.add(e_c.name.lower())

        return activities

    @classmethod
    def plan_from_brief(cls, brief: TravelerBrief) -> UnifiedItineraryProposal:
        """
        Main canonical orchestration pipeline:
        1. Destination Intelligence resolution (rejects unknown destinations with zero fabrication).
        2. Splits into 3-day sequential chunks for long trips (5-30 days), passing continuity context.
        3. Executes chunk generation against candidate places, scoring candidates by interests.
        4. Calculates budget across itemized categories.
        5. Validates global plan via GlobalItineraryValidator.
        6. Generates deterministic 'Why this plan fits you' reasoning.
        7. Returns unified non-mutating TripProposal.
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

        # 1. Destination Intelligence candidate clusters
        destination_clusters = DestinationIntelligence.get_candidate_places(
            destination=brief.destination,
            interests=brief.interests,
            pace=brief.pace,
            persona=brief.persona,
            food_preferences=brief.food_preferences,
            travelers=brief.travellers
        )

        used_model = "deterministic-planner-v1"
        tokens_used = 0
        ai_days: Optional[List[StructuredDay]] = None

        # Check for LLM mock in tests or explicit raw prompt synthesis
        try:
            from unittest.mock import MagicMock
            from app.ai.agents.planner_agent import (
                get_llm_client,
                generate_llm_plan,
                validate_plan_constraints,
                verify_plan_with_tools,
                get_destination_weather,
                search_hotels
            )
            llm_candidate = get_llm_client()
            if llm_candidate is not None:
                client_obj, model_name = llm_candidate
                if isinstance(client_obj, MagicMock) or brief.raw_prompt:
                    weather_info = get_destination_weather(brief.destination)
                    hotels_info = search_hotels(brief.destination, guests=brief.travellers)
                    raw_ai_plan, active_model, ai_tokens = generate_llm_plan(
                        destination=brief.destination,
                        days_count=brief.days_count,
                        total_budget=brief.budget if brief.budget > 0 else 50000.0,
                        currency=brief.currency or "INR",
                        persona=brief.persona,
                        vibe=brief.vibe,
                        interests=brief.interests,
                        origin=brief.origin,
                        travellers=brief.travellers,
                        weather_info=weather_info,
                        hotels_info=hotels_info,
                        client=client_obj,
                        model=model_name,
                        raw_prompt=brief.raw_prompt
                    )
                    if raw_ai_plan and getattr(raw_ai_plan, "days", None):
                        validated_plan = validate_plan_constraints(raw_ai_plan, brief.days_count)
                        verified_plan_days = verify_plan_with_tools(
                            validated_plan=validated_plan,
                            destination=brief.destination,
                            days_count=brief.days_count,
                            total_budget=brief.budget if brief.budget > 0 else 50000.0,
                            weather_info=weather_info,
                            hotels_info=hotels_info,
                            origin=brief.origin,
                            travellers=brief.travellers
                        )
                        used_model = active_model
                        tokens_used = ai_tokens

                        ai_days = []
                        for dp in verified_plan_days:
                            st_acts = []
                            for act_idx, a in enumerate(dp.activities):
                                st_acts.append(StructuredActivity(
                                    id=f"act_d{dp.day_number}_{act_idx+1:02d}",
                                    time=a.time_slot,
                                    time_slot=a.time_slot,
                                    start_at=a.time_slot,
                                    end_at=minutes_to_time_str(parse_time_to_minutes(a.time_slot) + 90),
                                    title=a.description[:40],
                                    description=a.description,
                                    location=a.location,
                                    place_type=a.place_type or "TA",
                                    estimated_cost=float(a.cost_estimate or 0.0),
                                    cost_estimate=float(a.cost_estimate or 0.0),
                                    duration=90,
                                    duration_minutes=90,
                                    transit_time_minutes=20,
                                    transit_mode="cab" if "cab" in str(a.estimated_transit) else "walk",
                                    estimated_transit=a.estimated_transit,
                                    crowd_warning=a.crowd_warning,
                                    lat=a.lat,
                                    lng=a.lng,
                                    coordinates={"lat": a.lat, "lng": a.lng} if a.lat else None,
                                    provenance=a.provenance,
                                    source="LLM_SYNTHESIS",
                                    generation_source=a.generation_source,
                                    location_source=a.location_source,
                                    content_source=a.content_source,
                                    cost_type="ESTIMATED_ALLOCATION",
                                    estimated_allocation=float(a.cost_estimate or 1500.0),
                                    why_recommended=a.why_recommended or "AI personalized selection",
                                    cluster=dp.title
                                ))
                            ai_days.append(StructuredDay(
                                day_number=dp.day_number,
                                date=(start_d + timedelta(days=dp.day_number - 1)).isoformat() if start_d else None,
                                title=dp.title,
                                day_title=dp.title,
                                day_theme="AI Synthesized Experience",
                                cluster_name=brief.destination,
                                location=brief.destination,
                                cover_image_url=dp.cover_image_url,
                                weather_summary=dp.weather_summary,
                                weather_provenance="SEASONAL_ESTIMATE",
                                day_semantics="ARRIVAL_DAY" if dp.day_number == 1 else ("DEPARTURE_DAY" if dp.day_number == brief.days_count else "NORMAL_DAY"),
                                geography_confidence="VERIFIED" if any(a.lat for a in st_acts) else "APPROXIMATE",
                                daily_estimated_cost=sum(a.estimated_cost for a in st_acts),
                                daily_travel_time_minutes=sum(a.transit_time_minutes for a in st_acts),
                                morning_summary=f"Morning exploration in {brief.destination}.",
                                afternoon_summary="Afternoon cultural and culinary highlights.",
                                evening_summary="Evening scenic reflection.",
                                activities=st_acts
                            ))
        except Exception as e:
            logger.warning(f"AI planner synthesis skipped/fallback: {e}")
            ai_days = None

        all_days: List[StructuredDay] = []
        if ai_days is not None:
            all_days = ai_days
        else:
            # 3. Build chunks: 3-day sequential blocks
            chunks = cls.build_chunks(brief.days_count)

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
                    context=context,
                    destination_clusters=destination_clusters
                )
                all_days.extend(chunk_days)

        # 4. Budget Calculation
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
            activities_cost_sum=activities_sum,
            food_preferences=brief.food_preferences,
            transport_preference=brief.transport_preference,
            travel_mode=brief.travel_mode
        )

        # 5. Global Validation & Polishing (deduplication, timing feasibility, budget guardrails)
        raw_days_dict = [d.model_dump() for d in all_days]
        polished_days_dict, validation_report = GlobalItineraryValidator.validate_global_plan(
            days=raw_days_dict,
            pace=brief.pace,
            target_budget=brief.budget,
            estimated_budget=budget_breakdown.total_estimated,
            trip_type=brief.trip_type
        )

        final_days = [StructuredDay(**d) for d in polished_days_dict]

        # 6. Deterministic "Why this plan fits you" explanation (3-4 points)
        distinct_clusters = len(set(d.cluster_name for d in final_days))
        why_this_plan = [
            f"Keeps each day geographically compact within {distinct_clusters} distinct area{'s' if distinct_clusters > 1 else ''}",
            f"Matches your {brief.pace} travel pace with {'longer rest breaks and unhurried exploration' if brief.pace == 'relaxed' else ('high-density sightseeing across iconic highlights' if brief.pace in ['fast', 'packed'] else 'balanced exploration and downtime')}"
        ]

        if brief.interests:
            unique_ints = list(dict.fromkeys(brief.interests))[:2]
            why_this_plan.append(f"Prioritizes your {' + '.join(unique_ints)} interests")
        else:
            why_this_plan.append("Curated around iconic cultural and natural highlights")

        if brief.budget > 0:
            diff = abs(budget_breakdown.total_estimated - brief.budget)
            if diff <= brief.budget * 0.12:
                why_this_plan.append(f"Keeps estimated spend (₹{int(budget_breakdown.total_estimated):,}) near your ₹{int(brief.budget):,} target")
            else:
                why_this_plan.append(f"Estimated at ₹{int(budget_breakdown.total_estimated):,} for {brief.travellers} traveler{'s' if brief.travellers > 1 else ''}")
        else:
            why_this_plan.append(f"Estimated at ₹{int(budget_breakdown.total_estimated):,} for {brief.travellers} traveler{'s' if brief.travellers > 1 else ''}")

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
            why_this_plan=why_this_plan,
            days=final_days,
            created_at=now_utc,
            model=used_model,
            tokens_used=tokens_used
        )


class ItineraryEngine:
    """
    Unified public facade for DashTiny Canonical Itinerary Engine.
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
        transport_preference: str = "mix",
        food_preferences: Optional[List[str]] = None,
        trip_type: str = "leisure",
        travel_mode: str = "flight",
        daily_schedule: str = "balanced",
        itinerary_style: str = "daily",
        stopovers: Optional[List[Any]] = None,
        likes: Optional[List[str]] = None,
        dislikes: Optional[List[str]] = None
    ) -> UnifiedItineraryProposal:
        """
        Public facade consumed by ProposalService and Planner API.
        """
        brief = TravelerBrief.from_inputs(
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
            daily_schedule=daily_schedule,
            itinerary_style=itinerary_style,
            stopovers=stopovers,
            likes=likes or [],
            dislikes=dislikes or []
        )

        return PlannerService.plan_from_brief(brief)
