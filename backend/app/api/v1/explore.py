from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Sanctuary, DriveEscape, PriceAlert

router = APIRouter(prefix="/explore", tags=["Explore & Sanctuaries"])

FALLBACK_SANCTUARIES = [
    {
        "id": "sanc_01",
        "title": "Private Cliffside Villa & Sunset Infinity Pool",
        "destination_name": "Goa",
        "city": "North Goa",
        "region": "Goa",
        "country": "India",
        "is_curated": True,
        "provenance": "CURATED",
        "editorial_rating": "DashTiny Editorial Pick",
        "location": "North Goa, India",
        "vibe": "beach",
        "vibes": ["beach", "family", "weekend", "budget"],
        "categories": ["weekend", "family", "budget"],
        "duration": "3 Days • 2 Nights",
        "price": "₹14,500 / squad",
        "image": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
        "tag": "🔥 Top Sunset Vibe",
        "highlights": ["Private Pool Access", "Floating Breakfast", "Scooter Included"],
        "insiderTips": ["Best golden hour view from northern deck at 5:45 PM"]
    },
    {
        "id": "sanc_02",
        "title": "Floating Glass Igloo & Aurora Sky Lounge",
        "destination_name": "Gulmarg",
        "city": "Gulmarg",
        "region": "Kashmir",
        "country": "India",
        "is_curated": True,
        "provenance": "CURATED",
        "editorial_rating": "DashTiny Editorial Pick",
        "location": "Gulmarg, Kashmir",
        "vibe": "mountains",
        "vibes": ["mountains", "culture", "weekend", "international"],
        "categories": ["weekend", "international"],
        "duration": "4 Days • 3 Nights",
        "price": "₹28,900 / couple",
        "image": "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
        "tag": "🏔️ Snow & Stars",
        "highlights": ["360° Glass Roof", "Heated Plunge Pool", "Gondola Phase 2 Passes"],
        "insiderTips": ["Request Glass Cabin 4 for panoramic sunrise view of Apharwat Peak"]
    },
    {
        "id": "sanc_03",
        "title": "Heritage Coffee Estate & Waterfall Sanctuary",
        "destination_name": "Coorg",
        "city": "Coorg",
        "region": "Karnataka",
        "country": "India",
        "is_curated": True,
        "provenance": "CURATED",
        "editorial_rating": "DashTiny Wellness Selection",
        "location": "Coorg, Karnataka",
        "vibe": "wellness",
        "vibes": ["wellness", "nature", "weekend", "family"],
        "categories": ["weekend", "family"],
        "duration": "2 Days • 1 Night",
        "price": "₹8,400 / weekend",
        "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
        "tag": "🍃 Organic Retreat",
        "highlights": ["Private Stream Dip", "Bean-to-Cup Roasting", "Bonfire Acoustic Evening"],
        "insiderTips": ["Take the sunrise estate walk with the resident botanist"]
    },
    {
        "id": "sanc_04",
        "title": "Old Town Machiya & Matcha Zen Garden",
        "destination_name": "Kyoto",
        "city": "Kyoto",
        "region": "Kansai",
        "country": "Japan",
        "is_curated": True,
        "provenance": "CURATED",
        "editorial_rating": "DashTiny Cultural Collection",
        "location": "Higashiyama, Kyoto, Japan",
        "vibe": "culture",
        "vibes": ["culture", "foodie", "international"],
        "categories": ["international", "culture"],
        "duration": "5 Days • 4 Nights",
        "price": "₹42,000 / traveler",
        "image": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
        "tag": "⛩️ Ancient Capital",
        "highlights": ["Private Zen Garden", "Tea Ceremony Master", "Early Access Passes"],
        "insiderTips": ["Visit Fushimi Inari at dawn before the tour groups arrive"]
    }
]

@router.get("/sanctuaries")
def get_sanctuaries(vibe: Optional[str] = "all", db: Session = Depends(get_db)):
    """
    Get dynamic sanctuaries curated by DAIna AI with flexible taxonomy matching.
    Supports vibe, categories, and tags.
    """
    clean_vibe = (vibe or "all").lower().strip()
    
    query = db.query(Sanctuary)
    if clean_vibe != "all":
        query = query.filter(
            or_(
                Sanctuary.vibe.ilike(f"%{clean_vibe}%"),
                Sanctuary.tag.ilike(f"%{clean_vibe}%"),
                Sanctuary.location.ilike(f"%{clean_vibe}%")
            )
        )
    sanctuaries = query.all()
    
    # Fallback to rich dynamic sanctuaries if table is empty
    if not sanctuaries:
        if clean_vibe == "all":
            return FALLBACK_SANCTUARIES
        return [
            s for s in FALLBACK_SANCTUARIES
            if s["vibe"].lower() == clean_vibe
            or clean_vibe in [v.lower() for v in s.get("vibes", [])]
            or clean_vibe in [c.lower() for c in s.get("categories", [])]
            or clean_vibe in s["location"].lower()
            or clean_vibe in s["tag"].lower()
        ]
    return sanctuaries

@router.get("/drives")
def get_drive_escapes(
    origin_city: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get 2-hour & 4-hour drive escapes relative to home origin city.
    """
    target_city = (origin_city or city or "").strip()
    query = db.query(DriveEscape)
    if target_city and target_city.lower() not in ["weekend", "all"]:
        query = query.filter(DriveEscape.name.ilike(f"%{target_city}%"))
    drives = query.all()

    if not drives:
        fallback_drives = [
            {
                "id": "drv_01",
                "name": "Nandi Hills Sunrise & Cloud Deck",
                "dist_time": "1 hr 15 min drive (62 km)",
                "stay_suggestion": "KSTDC Hill Resort & Cafe",
                "vibe_tag": "🌄 Early Bird Escapes",
                "image": "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80"
            },
            {
                "id": "drv_02",
                "name": "Chikmagalur Coffee Ridge Trail",
                "dist_time": "4 hr 15 min drive (240 km)",
                "stay_suggestion": "Serai Luxury Estate Villa",
                "vibe_tag": "☕ Coffee & Mist",
                "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"
            },
            {
                "id": "drv_03",
                "name": "Wayanad Rainforest & Stream Sanctuary",
                "dist_time": "5 hr 30 min drive (275 km)",
                "stay_suggestion": "Vythiri Treehouse Resort",
                "vibe_tag": "🌳 Deep Jungle",
                "image": "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80"
            }
        ]
        return fallback_drives
    return drives

