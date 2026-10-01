import re
import uuid
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.models import Itinerary, ItineraryDay, ItineraryActivity, SquadRoom, User
from app.api.deps import get_current_user

router = APIRouter(prefix="/planner", tags=["DAIna AI Getaway Architect"])

class PlannerRequest(BaseModel):
    destination: str
    origin: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_count: int = 4
    travellers: int = 2
    budget: float = 0.0
    currency: str = "INR"
    persona: str = "solo"
    vibe: Optional[str] = None
    interests: Optional[List[str]] = None
    raw_prompt: Optional[str] = None
    prompt: Optional[str] = None

# Backward compatibility alias
GenerateItineraryRequest = PlannerRequest

# Curated authentic hub templates
DESTINATION_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "japan": {
        "days": [
            {
                "title": "Tokyo Modern Neon & Shinjuku Golden Gai Alleyways",
                "image": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
                "weather": "18°C Pleasant 🌸",
                "activities": [
                    {"time": "10:30 AM", "desc": "Check-in at High-Floor City View Sanctuary", "loc": "Shinjuku, Tokyo", "type": "H", "transit": "⏱️ 50m from Narita/Haneda", "crowd": "🟢 Low Crowd"},
                    {"time": "01:00 PM", "desc": "Authentic Tsukiji Outer Market Fresh Nigiri Tasting", "loc": "Tsukiji Waterfront", "type": "R", "transit": "⏱️ 20m subway", "crowd": "🟡 Moderate Crowd"},
                    {"time": "05:00 PM", "desc": "Sunset Skyline Observation Deck & Golden Gai Izakaya Walk", "loc": "Roppongi Hills & Shinjuku", "type": "TA", "transit": "⏱️ 15m walk", "crowd": "🔥 Popular Twilight Spot"}
                ]
            },
            {
                "title": "Kyoto Bamboo Groves & Traditional Ryokan Bath",
                "image": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
                "weather": "17°C Serene ⛩️",
                "activities": [
                    {"time": "08:30 AM", "desc": "Shinkansen Bullet Train to Kyoto & Arashiyama Bamboo Stroll", "loc": "Arashiyama Grove", "type": "TA", "transit": "⏱️ 2h 15m Shinkansen", "crowd": "🟢 Early Morning Solitude"},
                    {"time": "01:00 PM", "desc": "Multi-course Kaiseki Garden Lunch & Matcha Ceremony", "loc": "Gion Historic Quarter", "type": "R", "transit": "⏱️ 25m transit", "crowd": "🟢 Secluded"},
                    {"time": "05:30 PM", "desc": "Check-in at Cedarwood Onsen Ryokan with Mineral Baths", "loc": "Higashiyama Hills", "type": "H", "transit": "⏱️ 15m taxi", "crowd": "🟢 Private Access"}
                ]
            },
            {
                "title": "Fushimi Inari Torii Gates & Historic Gion Teahouse Walk",
                "image": "https://images.unsplash.com/photo-1478436127897-769e00d2c715?w=800&auto=format&fit=crop&q=80",
                "weather": "19°C Clear Skies ☀️",
                "activities": [
                    {"time": "07:30 AM", "desc": "Vermilion Path Walk through 10,000 Torii Gates", "loc": "Fushimi Inari Shrine", "type": "TA", "transit": "⏱️ 10m train", "crowd": "🟢 Zero Crowds at Dawn"},
                    {"time": "12:30 PM", "desc": "Handcrafted Soba Noodles & Seasonal Vegetable Tempura", "loc": "Nishiki Market Area", "type": "R", "transit": "⏱️ 15m transit", "crowd": "🟡 Lively Market"},
                    {"time": "04:30 PM", "desc": "Preserved Wooden Machiya Houses & Twilight Photography", "loc": "Ninenzaka & Sannenzaka", "type": "TA", "transit": "⏱️ 10m walk", "crowd": "🟡 Moderate Sunset Crowd"}
                ]
            }
        ]
    },
    "goa": {
        "days": [
            {
                "title": "Coastal Arrival & Chapora Sunset Deck",
                "image": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
                "weather": "28°C Sunny ☀️",
                "activities": [
                    {"time": "10:30 AM", "desc": "Check-in at Ocean Cliff Boutique Villa", "loc": "Vagator Beach", "type": "H", "transit": "⏱️ 40m from GOI Airport", "crowd": "🟢 Low Crowd"},
                    {"time": "01:30 PM", "desc": "Authentic Goan Thali & Fresh Catch Tasting", "loc": "Anjuna Coastal Cafe", "type": "R", "transit": "⏱️ 15m drive", "crowd": "🟡 Moderate Crowd"},
                    {"time": "05:30 PM", "desc": "Golden Hour Sunset Stroll at Chapora Fort", "loc": "Chapora Ridge", "type": "TA", "transit": "⏱️ 10m drive", "crowd": "🔥 Peak Sunset Crowd (Arrive early)"}
                ]
            },
            {
                "title": "Private Catamaran Passage & Reef Scuba",
                "image": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80",
                "weather": "27°C Light Breeze 🌤️",
                "activities": [
                    {"time": "09:00 AM", "desc": "Private Catamaran Cruise to Grande Island with Reef Scuba", "loc": "Grande Island", "type": "TA", "transit": "⏱️ 35m boat passage", "crowd": "🟢 Low Crowd"},
                    {"time": "02:00 PM", "desc": "Beachside Grilled Lobster & Coconut Water", "loc": "Benaulim White Sands", "type": "R", "transit": "⏱️ 20m drive", "crowd": "🟢 Low Crowd"},
                    {"time": "07:30 PM", "desc": "Latin Quarter Fontainhas Heritage Walk & Live Jazz", "loc": "Panaji Heritage Quarter", "type": "TA", "transit": "⏱️ 25m drive", "crowd": "🟡 Moderate Crowd"}
                ]
            }
        ]
    },
    "manali": {
        "days": [
            {
                "title": "Alpine Arrival & Old Manali Vintage Cafes",
                "image": "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80",
                "weather": "14°C Crisp Alpine 🏔️",
                "activities": [
                    {"time": "11:00 AM", "desc": "Check-in at Cedarwood Pine Chalet", "loc": "Old Manali", "type": "H", "transit": "⏱️ 1h from Kullu Airport", "crowd": "🟢 Low Crowd"},
                    {"time": "01:30 PM", "desc": "Himalayan Trout & Woodfired Pizza Lunch", "loc": "Old Manali Strip", "type": "R", "transit": "⏱️ 5m walk", "crowd": "🟡 Moderate Crowd"},
                    {"time": "04:30 PM", "desc": "Hadimba Forest Temple Pine Grove Walk", "loc": "Hadimba Sanctuary", "type": "TA", "transit": "⏱️ 15m walk", "crowd": "🟡 Moderate Crowd"}
                ]
            },
            {
                "title": "Solang Valley Snow Gliding & High Passes",
                "image": "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
                "weather": "10°C Mountain Chill ❄️",
                "activities": [
                    {"time": "09:00 AM", "desc": "Tandem Paragliding & High Valley ATV Trek", "loc": "Solang Valley Deck", "type": "TA", "transit": "⏱️ 35m mountain drive", "crowd": "🔥 Popular Morning Slot"},
                    {"time": "02:00 PM", "desc": "Traditional Himachali Dham Feast", "loc": "Naggar Heritage Road", "type": "R", "transit": "⏱️ 25m drive", "crowd": "🟢 Low Crowd"},
                    {"time": "06:00 PM", "desc": "Artisanal Hot Cider & Bonfire Evening", "loc": "Resort Valley Balcony", "type": "H", "transit": "⏱️ On-site", "crowd": "🟢 Secluded"}
                ]
            }
        ]
    },
    "kashmir": {
        "days": [
            {
                "title": "Dal Lake Wooden Shikara & Floating Sanctuary",
                "image": "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=800&auto=format&fit=crop&q=80",
                "weather": "16°C Gentle Mountain 🏔️",
                "activities": [
                    {"time": "11:00 AM", "desc": "Check-in at Carved Cedarwood Luxury Houseboat", "loc": "Dal Lake, Nigeen", "type": "H", "transit": "⏱️ 30m from Srinagar Airport", "crowd": "🟢 Low Crowd"},
                    {"time": "01:30 PM", "desc": "Multi-course Wazwan Tasting Feast with Kashmiri Kahwa", "loc": "Lal Chowk Heritage", "type": "R", "transit": "⏱️ 15m shikara ride", "crowd": "🟡 Moderate Crowd"},
                    {"time": "05:00 PM", "desc": "Sunset Shikara Cruise through Floating Lotus Gardens", "loc": "Dal Lake Waters", "type": "TA", "transit": "⏱️ Direct boarding", "crowd": "🟢 Serene"}
                ]
            },
            {
                "title": "Gulmarg Apharwat Gondola & Alpine Meadow Trek",
                "image": "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
                "weather": "11°C Crisp Peak ❄️",
                "activities": [
                    {"time": "08:30 AM", "desc": "Highest Gondola Ride (Phase 2) to Apharwat Peak", "loc": "Gulmarg Mountain Station", "type": "TA", "transit": "⏱️ 1h 20m drive from Srinagar", "crowd": "🔥 Popular Morning Slot"},
                    {"time": "01:30 PM", "desc": "Rogan Josh & Warm Sheermal Bread at Pine Cottage", "loc": "Gulmarg Golf Meadows", "type": "R", "transit": "⏱️ 10m walk", "crowd": "🟢 Low Crowd"},
                    {"time": "04:30 PM", "desc": "Pony Trail through Wild Pine Groves & Snow Fields", "loc": "Khilanmarg Trail", "type": "TA", "transit": "⏱️ 15m trek", "crowd": "🟢 Scenic & Peaceful"}
                ]
            }
        ]
    },
    "andaman": {
        "days": [
            {
                "title": "Radhanagar Turquoise Beach & Rain Forest Chalet",
                "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
                "weather": "29°C Tropical Ocean 🌊",
                "activities": [
                    {"time": "11:00 AM", "desc": "Catamaran Ferry to Havelock & Eco Villa Check-in", "loc": "Havelock Island Beach 5", "type": "H", "transit": "⏱️ 90m Makruzz ferry from Port Blair", "crowd": "🟢 Low Crowd"},
                    {"time": "01:30 PM", "desc": "Catch of the Day Grilled Red Snapper & Tender Coconut", "loc": "Something Different Beach Cafe", "type": "R", "transit": "⏱️ 10m drive", "crowd": "🟢 Low Crowd"},
                    {"time": "05:00 PM", "desc": "Rated Asia's Best Sunset at Radhanagar White Sand Beach", "loc": "Beach No. 7, Radhanagar", "type": "TA", "transit": "⏱️ 20m scooter drive", "crowd": "🟡 Moderate Sunset Crowd"}
                ]
            },
            {
                "title": "Elephant Beach Coral Reef Snorkel & Mangrove Kayak",
                "image": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80",
                "weather": "28°C Sunshine ☀️",
                "activities": [
                    {"time": "08:30 AM", "desc": "Speedboat to Elephant Beach for Guided Coral Snorkeling", "loc": "Elephant Beach Lagoon", "type": "TA", "transit": "⏱️ 25m boat ride", "crowd": "🟢 Early Morning"},
                    {"time": "02:00 PM", "desc": "Woodfired Crab & Andaman Coconut Curry", "loc": "Govind Nagar Bay", "type": "R", "transit": "⏱️ 15m ride", "crowd": "🟢 Low Crowd"},
                    {"time": "07:30 PM", "desc": "Night Bioluminescence Kayaking through Mangroves", "loc": "Havelock West Coast", "type": "TA", "transit": "⏱️ 10m ride", "crowd": "🟢 Exclusive Small Group"}
                ]
            }
        ]
    }
}

def synthesize_dynamic_destination_days(dest_name: str, days_count: int, daily_budget: float) -> List[Dict[str, Any]]:
    """
    Synthesizes intelligent, paced, realistic daily travel itineraries for ANY global or domestic destination.
    """
    clean_dest = dest_name.title().strip()
    
    # Select category theme heuristic
    lower = clean_dest.lower()
    is_mountain = any(k in lower for k in ["mountain", "hill", "alps", "himalaya", "trek", "shimla", "ladakh", "leh", "kashmir", "coorg", "munnar", "ooty", "switzerland", "nepal"])
    is_beach = any(k in lower for k in ["beach", "island", "sea", "ocean", "coast", "bali", "phuket", "maldives", "goa", "andaman", "pondicherry", "greece", "hawaii"])
    is_heritage = any(k in lower for k in ["jaipur", "udaipur", "rajasthan", "agra", "varanasi", "rome", "egypt", "kyoto", "delhi", "athens"])

    theme_images = {
        "mountain": [
            "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80"
        ],
        "beach": [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80"
        ],
        "heritage": [
            "https://images.unsplash.com/photo-1478436127897-769e00d2c715?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&auto=format&fit=crop&q=80"
        ],
        "general": [
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=80"
        ]
    }

    if is_mountain:
        category = "mountain"
        weather_default = "15°C Crisp Alpine 🏔️"
    elif is_beach:
        category = "beach"
        weather_default = "28°C Tropical Breeze 🌴"
    elif is_heritage:
        category = "heritage"
        weather_default = "24°C Sunny & Clear 🏛️"
    else:
        category = "general"
        weather_default = "22°C Pleasant 🌤️"

    images = theme_images[category]

    themes = [
        ("Arrival & Historic Promenade", "Iconic Old Town Discovery & Twilight Vista"),
        ("Nature Expeditions & Scenic Trails", "Private Guided Passage & Regional Cuisine"),
        ("Architectural Marvels & Artisan Markets", "Handcrafted Cultural Heritage & Sunset Lounge"),
        ("Hidden Sanctuaries & Tranquil Waters", "Local Gastronomy Tasting & Panoramic Overlook"),
        ("Panoramic Ridges & Leisure Stroll", "Culinary Masterclass & Evening Acoustic Session"),
        ("Offbeat Villages & Scenic Valleys", "Boutique Stays & Stargazing Balcony"),
        ("Departure Reflection & Souvenir Walk", "Farewell Brunch & Scenic Overlook")
    ]

    days = []
    for day_idx in range(1, days_count + 1):
        theme_tup = themes[(day_idx - 1) % len(themes)]
        img = images[(day_idx - 1) % len(images)]
        day_title = f"{clean_dest}: {theme_tup[0]}"

        acts = [
            {
                "time": "09:30 AM",
                "desc": f"Morning check-in at boutique sanctuary retreat & orientation walk in {clean_dest}",
                "loc": f"Central District, {clean_dest}",
                "type": "H",
                "transit": "⏱️ 30m from arrival hub",
                "crowd": "🟢 Low Crowd"
            },
            {
                "time": "01:00 PM",
                "desc": f"Authentic regional gastronomy lunch & chef's specialty tasting in {clean_dest}",
                "loc": f"Historic Promenade, {clean_dest}",
                "type": "R",
                "transit": "⏱️ 15m walk",
                "crowd": "🟡 Moderate Crowd"
            },
            {
                "time": "05:00 PM",
                "desc": f"{theme_tup[1]} with golden-hour photography opportunities across {clean_dest}",
                "loc": f"Panoramic Vantage Deck, {clean_dest}",
                "type": "TA",
                "transit": "⏱️ 15m transit",
                "crowd": "🔥 Popular Twilight Hour"
            }
        ]

        days.append({
            "title": day_title,
            "image": img,
            "weather": weather_default,
            "activities": acts
        })

    return days

from app.ai.agents.planner_agent import build_itinerary_with_planner_agent

@router.post("/generate")
def generate_itinerary(
    request: PlannerRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate dynamic getaway itinerary tailored to any destination via Planner Agent and persist in PostgreSQL.
    """
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
