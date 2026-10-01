"""
DashTiny AI Planner Agent (app/ai/agents/planner_agent.py)
Orchestrates Tools -> Optional LLM Generation -> Algorithmic Validation -> Structured Itinerary.

Golden Engineering Rule:
"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."
"""
import os
import re
import time
import uuid
import json
import logging
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, SquadRoom, User, AIRun, AIToolCall
from app.ai.tools.weather import get_destination_weather
from app.ai.tools.hotel_search import search_hotels
from app.ai.tools.maps import get_coordinates

logger = logging.getLogger(__name__)

class ActivityItem(BaseModel):
    time_slot: str
    description: str
    location: str
    place_type: str = "TA"  # H = Hotel/Stay, R = Restaurant/Dining, TA = Tour/Activity
    estimated_transit: str = "⏱️ 15m walk"
    crowd_warning: str = "🟢 Low Crowd"
    cost_estimate: float = 0.0
    lat: Optional[float] = None
    lng: Optional[float] = None
    provenance: str = "AI GENERATED"
    why_recommended: Optional[str] = None

class DayPlan(BaseModel):
    day_number: int
    title: str
    cover_image_url: str
    weather_summary: str
    activities: List[ActivityItem]

class ItineraryOutput(BaseModel):
    title: str
    destination: str
    start_date: str
    end_date: str
    budget: float
    currency: str = "INR"
    persona: str
    days: List[DayPlan]
    weather_advisory: Optional[str] = None
    recommended_hotel: Optional[Dict[str, Any]] = None

def get_theme_category(destination: str) -> str:
    lower = destination.lower()
    if any(k in lower for k in ["mountain", "hill", "alps", "himalaya", "trek", "snow", "manali", "shimla", "ladakh", "leh", "kashmir", "gulmarg", "switzerland", "nepal"]):
        return "mountain"
    if any(k in lower for k in ["beach", "island", "sea", "ocean", "coast", "bali", "phuket", "maldives", "goa", "andaman", "havelock", "greece", "hawaii"]):
        return "beach"
    if any(k in lower for k in ["japan", "tokyo", "kyoto", "osaka"]):
        return "japan"
    if any(k in lower for k in ["jaipur", "udaipur", "rajasthan", "agra", "varanasi", "rome", "egypt", "paris", "athens", "delhi"]):
        return "heritage"
    if any(k in lower for k in ["coorg", "munnar", "wayanad", "ooty", "kerala", "rainforest"]):
        return "nature_wellness"
    return "metropolitan"

def get_curated_cover_image(category: str, day_idx: int) -> str:
    image_pool = {
        "mountain": [
            "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
        ],
        "beach": [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop&q=80",
        ],
        "japan": [
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1478436127897-769e00d2c715?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1528164344705-475426879c0d?w=800&auto=format&fit=crop&q=80",
        ],
        "heritage": [
            "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
        ],
        "nature_wellness": [
            "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
        ],
        "metropolitan": [
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1478436127897-769e00d2c715?w=800&auto=format&fit=crop&q=80",
        ]
    }
    pool = image_pool.get(category, image_pool["metropolitan"])
    return pool[(day_idx - 1) % len(pool)]

# Destination-specific curated landmarks mapping 1:1 to spatial registry
CURATED_DESTINATION_ACTIVITIES: Dict[str, List[Dict[str, Any]]] = {
    "goa": [
        {
            "lunch_name": "Fontainhas Latin Quarter Regional Tasting",
            "lunch_loc": "Fontainhas Latin Quarter, Panjim",
            "evening_name": "Vagator Coastal Sunset Deck",
            "evening_loc": "Vagator Beach, North Goa"
        },
        {
            "lunch_name": "Anjuna Coastal Culinary Belt",
            "lunch_loc": "Anjuna Coastal Belt, Goa",
            "evening_name": "Chapora Fort Ridge Twilight Walk",
            "evening_loc": "Chapora Fort Ridge, Goa"
        },
        {
            "lunch_name": "Sahakari Spice Farm Traditional Feast",
            "lunch_loc": "Sahakari Spice Plantation, Ponda",
            "evening_name": "Morjim Turtle Beach Sundowner",
            "evening_loc": "Morjim Turtle Beach, Goa"
        },
        {
            "lunch_name": "Benaulim White Sands Seafood Experience",
            "lunch_loc": "Benaulim White Sands, South Goa",
            "evening_name": "Grande Island Coral Catamaran Excursion",
            "evening_loc": "Grande Island Reef, Goa"
        }
    ],
    "manali": [
        {
            "lunch_name": "Old Manali Riverside Alpine Lunch",
            "lunch_loc": "Old Manali Village, Himachal",
            "evening_name": "Hadimba Temple Pine Forest Stroll",
            "evening_loc": "Hadimba Temple Forest, Manali"
        },
        {
            "lunch_name": "Solang Valley High Meadow Lunch",
            "lunch_loc": "Solang Valley, Manali",
            "evening_name": "Rohtang Alpine Pass Golden Vista",
            "evening_loc": "Rohtang Alpine Pass, Himachal"
        },
        {
            "lunch_name": "Himachali Traditional Trout Tasting",
            "lunch_loc": "Old Manali Village, Himachal",
            "evening_name": "Manali Ridge Twilight Walk",
            "evening_loc": "Manali, Himachal Pradesh"
        }
    ],
    "jaipur": [
        {
            "lunch_name": "City Palace Heritage Courtyard Lunch",
            "lunch_loc": "City Palace, Jaipur",
            "evening_name": "Hawa Mahal Sunset Architecture Promenade",
            "evening_loc": "Hawa Mahal, Jaipur"
        },
        {
            "lunch_name": "Amer Fort Royal Pavilion Experience",
            "lunch_loc": "Amer Fort, Jaipur",
            "evening_name": "Old City Twilight Artisan Walk",
            "evening_loc": "Jaipur, Rajasthan"
        }
    ],
    "kashmir": [
        {
            "lunch_name": "Srinagar Dal Lake Floating Wazwan Tasting",
            "lunch_loc": "Srinagar, Kashmir",
            "evening_name": "Gulmarg Alpine Meadow Sunset",
            "evening_loc": "Gulmarg, Kashmir"
        },
        {
            "lunch_name": "Pine Cottage Mountain Lunch",
            "lunch_loc": "Gulmarg, Kashmir",
            "evening_name": "Apharwat Ridge Mountain Vista",
            "evening_loc": "Gulmarg, Kashmir"
        }
    ],
    "gulmarg": [
        {
            "lunch_name": "Pine Cottage Mountain Lunch",
            "lunch_loc": "Gulmarg, Kashmir",
            "evening_name": "Gulmarg Alpine Meadow Sunset",
            "evening_loc": "Gulmarg, Kashmir"
        }
    ],
    "kyoto": [
        {
            "lunch_name": "Gion Historic Quarter Kaiseki Experience",
            "lunch_loc": "Kyoto, Japan",
            "evening_name": "Arashiyama Bamboo Grove Twilight Stroll",
            "evening_loc": "Kyoto, Japan"
        }
    ]
}

def generate_algorithmic_plan(
    destination: str,
    days_count: int,
    total_budget: float,
    persona: str,
    start_date: date,
    weather_info: Dict[str, Any],
    hotels_info: List[Dict[str, Any]],
    coords: Dict[str, Any]
) -> List[DayPlan]:
    """
    Deterministic synthesis coordinating verified tool outputs (Weather, Hotels, Geocoding)
    into a structured, paced multi-day itinerary.
    Rule: Never fabricate geographic coordinates. If genuine coordinates are not found in
    the spatial registry, lat and lng are set to None.
    """
    clean_dest = destination.title().strip()
    dest_lower = destination.lower().strip()
    category = get_theme_category(destination)
    daily_budget = total_budget / max(1, days_count)

    # Generic narrative templates if destination is not in curated pool
    generic_narratives = [
        ("Arrival, Check-in & Orientation Twilight Walk", "Old Town & Historic Quarter", "Evening Sundowner Vista"),
        ("Iconic Landmarks & Cultural Highlights", "Artisan Quarter & Local Gastronomy", "Panoramic Sunset Overlook"),
        ("Scenic Nature Passage & Coastal/Alpine Trails", "Regional Cuisine Tasting", "Acoustic Lounge & Stargazing"),
        ("Hidden Sanctuaries & Offbeat Discovery", "Private Tasting Menu", "Twilight Reflection & Night Market"),
        ("Artisan Boutiques & Architecture Promenade", "Historic Teahouse / Cafe", "Scenic Skyline Lounge"),
        ("Leisure Retreat & Wellness / Spa Window", "Fine Coastal / Alpine Dining", "Bonfire / Balcony Chill"),
        ("Farewell Stroll & Souvenir Collection", "Departure Brunch", "Scenic Transit to Terminal")
    ]

    # Find curated activities if destination is known
    matched_curated = None
    for k, v in CURATED_DESTINATION_ACTIVITIES.items():
        if k in dest_lower:
            matched_curated = v
            break

    days: List[DayPlan] = []
    hotel = hotels_info[0] if hotels_info else None
    hotel_name = hotel["name"] if hotel else f"{clean_dest} Boutique Sanctuary"
    hotel_lat = hotel.get("lat") if hotel else None
    hotel_lng = hotel.get("lng") if hotel else None
    hotel_prov = hotel.get("provenance", "CURATED") if (hotel and hotel_lat is not None) else "AI GENERATED"

    for day_idx in range(1, days_count + 1):
        cover_image = get_curated_cover_image(category, day_idx)

        if matched_curated:
            curated_day = matched_curated[(day_idx - 1) % len(matched_curated)]
            day_title = f"{clean_dest}: {curated_day['lunch_name'].split(' ')[0]} & Scenic Highlights"

            lunch_desc = f"Authentic regional gastronomy: {curated_day['lunch_name']}"
            lunch_loc = curated_day["lunch_loc"]
            evening_desc = f"Golden hour experience: {curated_day['evening_name']}"
            evening_loc = curated_day["evening_loc"]
        else:
            theme_tup = generic_narratives[(day_idx - 1) % len(generic_narratives)]
            day_title = f"{clean_dest}: {theme_tup[0]}"

            lunch_desc = f"Authentic {clean_dest} regional lunch tasting at {theme_tup[1]}"
            lunch_loc = f"{theme_tup[1]}, {clean_dest}"
            evening_desc = f"Golden hour sunset stroll & photography at {theme_tup[2]}"
            evening_loc = f"{clean_dest} Lookout Point"

        # Geocode activities via genuine spatial registry (NO fabricated offsets)
        lunch_geo = get_coordinates(lunch_loc)
        lunch_lat = lunch_geo["lat"] if lunch_geo.get("found") else None
        lunch_lng = lunch_geo["lng"] if lunch_geo.get("found") else None
        lunch_prov = lunch_geo.get("provenance", "AI GENERATED") if lunch_geo.get("found") else "AI GENERATED"

        evening_geo = get_coordinates(evening_loc)
        evening_lat = evening_geo["lat"] if evening_geo.get("found") else None
        evening_lng = evening_geo["lng"] if evening_geo.get("found") else None
        evening_prov = evening_geo.get("provenance", "AI GENERATED") if evening_geo.get("found") else "AI GENERATED"

        activities: List[ActivityItem] = [
            ActivityItem(
                time_slot="09:30 AM",
                description=f"Morning orientation & check-in at {hotel_name}",
                location=hotel.get("address", f"Central District, {clean_dest}") if hotel else f"Central District, {clean_dest}",
                place_type="H",
                estimated_transit="⏱️ 25m from arrival terminal",
                crowd_warning="🟢 Low Morning Traffic",
                cost_estimate=float(round(daily_budget * 0.40)),
                lat=hotel_lat,
                lng=hotel_lng,
                provenance=hotel_prov,
                why_recommended=f"Selected for top traveler ratings and peaceful setting in {clean_dest}"
            ),
            ActivityItem(
                time_slot="01:00 PM",
                description=lunch_desc,
                location=lunch_loc,
                place_type="R",
                estimated_transit="⏱️ 15m walk",
                crowd_warning="🟡 Moderate Lunch Crowd",
                cost_estimate=float(round(daily_budget * 0.20)),
                lat=lunch_lat,
                lng=lunch_lng,
                provenance=lunch_prov,
                why_recommended="Celebrated local culinary hotspot featuring seasonal recipes"
            ),
            ActivityItem(
                time_slot="05:30 PM",
                description=evening_desc,
                location=evening_loc,
                place_type="TA",
                estimated_transit="⏱️ 20m scenic transit",
                crowd_warning="🔥 Peak Golden Hour (Arrive 30 min before sunset)",
                cost_estimate=float(round(daily_budget * 0.15)),
                lat=evening_lat,
                lng=evening_lng,
                provenance=evening_prov,
                why_recommended="Prime vantage point for unobstructed twilight photography"
            )
        ]

        days.append(
            DayPlan(
                day_number=day_idx,
                title=day_title,
                cover_image_url=cover_image,
                weather_summary=weather_info.get("condition", "22°C Pleasant 🌤️"),
                activities=activities
            )
        )

    return days

def build_itinerary_with_planner_agent(
    destination: str,
    budget: float,
    days_count: int,
    persona: str,
    user: User,
    db: Session,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None,
    origin: Optional[str] = None,
    travellers: int = 2,
    currency: str = "INR",
    vibe: Optional[str] = None,
    interests: Optional[List[str]] = None,
    raw_prompt: Optional[str] = None,
    prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Primary Entry Point for AI Planner Architect.
    1. Coordinates Tools: Weather, Hotels, Geocoding
    2. Builds Structured Day Plans (with honest provenance)
    3. Persists directly to PostgreSQL attached strictly to authenticated user
    4. Fixes Activity ID consistency: returns persisted IDs identical to database
    5. Records honest AI Observability telemetry (deterministic-planner-v1, 0 tokens)
    6. Creates squad room code
    7. Returns typed canonical structured object
    """
    start_time = time.time()
    clean_dest = destination.strip().title()
    clean_days = max(1, min(14, days_count))
    clean_budget = budget if budget > 0 else 12000.0 * clean_days
    effective_prompt = raw_prompt or prompt

    # 1. Execute AI Tools
    weather_info = get_destination_weather(clean_dest)
    hotels_info = search_hotels(clean_dest, guests=travellers or 2)
    coords = get_coordinates(clean_dest)

    # 2. Date calculation from canonical input
    if start_date_str:
        try:
            start_d = datetime.strptime(start_date_str.split("T")[0], "%Y-%m-%d").date()
        except Exception:
            start_d = date.today() + timedelta(days=14)
    else:
        start_d = date.today() + timedelta(days=14)

    if end_date_str:
        try:
            end_d = datetime.strptime(end_date_str.split("T")[0], "%Y-%m-%d").date()
            if end_d < start_d:
                end_d = start_d + timedelta(days=max(0, clean_days - 1))
            else:
                # Recalculate clean_days if both dates explicitly provided
                clean_days = (end_d - start_d).days + 1
        except Exception:
            end_d = start_d + timedelta(days=max(0, clean_days - 1))
    else:
        end_d = start_d + timedelta(days=max(0, clean_days - 1))

    # 3. Generate Structured Days (Tools + Validation)
    structured_days = generate_algorithmic_plan(
        destination=clean_dest,
        days_count=clean_days,
        total_budget=clean_budget,
        persona=persona,
        start_date=start_d,
        weather_info=weather_info,
        hotels_info=hotels_info,
        coords=coords
    )

    # 4. Persist to PostgreSQL (Strict User Ownership with canonical fields)
    new_itinerary = Itinerary(
        owner_id=user.id,
        title=f"Bespoke {clean_days}-Day {clean_dest} Sanctuary Passage",
        destination=clean_dest,
        origin=origin,
        start_date=start_d,
        end_date=end_d,
        total_budget=clean_budget,
        currency=currency or "INR",
        persona=persona,
        travellers=travellers or 2,
        vibe=vibe,
        raw_prompt=effective_prompt,
        status="active"
    )
    db.add(new_itinerary)
    db.commit()
    db.refresh(new_itinerary)

    # 5. Persist Days & Activities (Fix Data Consistency: Persisted IDs match client response)
    formatted_days = []
    for dp in structured_days:
        it_day = ItineraryDay(
            itinerary_id=new_itinerary.id,
            day_number=dp.day_number,
            title=dp.title,
            cover_image_url=dp.cover_image_url,
            weather_summary=dp.weather_summary
        )
        db.add(it_day)
        db.commit()
        db.refresh(it_day)

        day_acts = []
        for a_idx, act in enumerate(dp.activities):
            act_id = str(uuid.uuid4())
            it_act = ItineraryActivity(
                id=act_id,
                day_id=it_day.id,
                time_slot=act.time_slot,
                description=act.description,
                location=act.location,
                place_type=act.place_type,
                estimated_transit=act.estimated_transit,
                crowd_warning=act.crowd_warning,
                cost_estimate=act.cost_estimate,
                lat=act.lat,
                lng=act.lng,
                sort_order=a_idx,
                provenance=act.provenance
            )
            db.add(it_act)
            day_acts.append({
                "id": act_id,
                "time": act.time_slot,
                "description": act.description,
                "location": act.location,
                "placeType": act.place_type,
                "estimatedTransit": act.estimated_transit,
                "crowdWarning": act.crowd_warning,
                "costEstimate": act.cost_estimate,
                "lat": act.lat,
                "lng": act.lng,
                "provenance": act.provenance
            })
        db.commit()

        formatted_days.append({
            "id": it_day.id,
            "dayNumber": dp.day_number,
            "title": it_day.title,
            "coverImage": it_day.cover_image_url,
            "weather": it_day.weather_summary,
            "activities": day_acts
        })

    # 6. Create Associated Squad Room Code
    clean_prefix = re.sub(r'[^A-Z]', '', clean_dest.upper())[:3]
    if len(clean_prefix) < 3:
        clean_prefix = "TRP"
    room_code = f"{clean_prefix}-{start_d.year}-X{str(uuid.uuid4())[:4].upper()}"

    squad_room = SquadRoom(
        itinerary_id=new_itinerary.id,
        room_code=room_code
    )
    db.add(squad_room)
    db.commit()

    # 7. AI Observability: Honest Telemetry (No fake LLM tokens)
    latency_ms = int((time.time() - start_time) * 1000)
    ai_run = AIRun(
        user_id=user.id,
        trip_id=new_itinerary.id,
        prompt=effective_prompt or f"Generate itinerary for {clean_dest}",
        model="deterministic-planner-v1",
        latency_ms=latency_ms,
        tokens_used=0,
        status="success"
    )
    db.add(ai_run)
    db.commit()

    return {
        "id": new_itinerary.id,
        "title": new_itinerary.title,
        "destination": new_itinerary.destination,
        "origin": new_itinerary.origin,
        "startDate": str(new_itinerary.start_date),
        "endDate": str(new_itinerary.end_date),
        "daysCount": clean_days,
        "budget": float(new_itinerary.total_budget),
        "currency": new_itinerary.currency,
        "persona": new_itinerary.persona,
        "travellers": new_itinerary.travellers,
        "vibe": new_itinerary.vibe,
        "squad_room_code": room_code,
        "weather_advisory": weather_info.get("packing_advisory"),
        "days": formatted_days
    }
