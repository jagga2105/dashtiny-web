from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Sanctuary, DriveEscape, PriceAlert

router = APIRouter(prefix="/explore", tags=["Explore & Sanctuaries"])

@router.get("/sanctuaries")
def get_sanctuaries(vibe: Optional[str] = "all", db: Session = Depends(get_db)):
    """
    Get dynamic sanctuaries curated by DAIna AI.
    """
    query = db.query(Sanctuary)
    if vibe and vibe != "all":
        query = query.filter(Sanctuary.vibe == vibe)
    sanctuaries = query.all()
    
    # Fallback to rich dynamic sanctuaries if table is empty
    if not sanctuaries:
        return [
            {
                "id": "sanc_01",
                "title": "Private Cliffside Villa & Sunset Infinity Pool",
                "location": "North Goa, India",
                "vibe": "beach",
                "duration": "3 Days • 2 Nights",
                "price": "₹14,500 / squad",
                "rating": "4.95 ★",
                "reviews": "142 Verified",
                "image": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80",
                "tag": "🔥 Top Sunset Vibe",
                "highlights": ["Private Pool Access", "Floating Breakfast", "Scooter Included"],
                "insiderTips": ["Best golden hour view from northern deck at 5:45 PM"]
            },
            {
                "id": "sanc_02",
                "title": "Floating Glass Igloo & Aurora Sky Lounge",
                "location": "Gulmarg, Kashmir",
                "vibe": "mountains",
                "duration": "4 Days • 3 Nights",
                "price": "₹28,900 / couple",
                "rating": "4.98 ★",
                "reviews": "98 Verified",
                "image": "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80",
                "tag": "🏔️ Snow & Stars",
                "highlights": ["360° Glass Roof", "Heated Plunge Pool", "Gondola Phase 2 Passes"],
                "insiderTips": ["Request Glass Cabin 4 for panoramic sunrise view of Apharwat Peak"]
            },
            {
                "id": "sanc_03",
                "title": "Heritage Coffee Estate & Waterfall Sanctuary",
                "location": "Coorg, Karnataka",
                "vibe": "wellness",
                "duration": "2 Days • 1 Night",
                "price": "₹8,400 / weekend",
                "rating": "4.91 ★",
                "reviews": "210 Verified",
                "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
                "tag": "🍃 Organic Retreat",
                "highlights": ["Private Stream Dip", "Bean-to-Cup Roasting", "Bonfire Acoustic Evening"]
            }
        ]
    return sanctuaries

@router.get("/drives")
def get_drive_escapes(city: Optional[str] = "Bengaluru", db: Session = Depends(get_db)):
    """
    Get 2-hour & 4-hour drive escapes relative to home city.
    """
    drives = db.query(DriveEscape).all()
    if not drives:
        return [
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
    return drives
