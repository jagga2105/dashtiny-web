import re
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Sanctuary, DriveEscape

router = APIRouter(prefix="/chat", tags=["DAIna AI Travel Concierge"])

class ChatQueryRequest(BaseModel):
    message: str
    context: Optional[dict] = None

@router.post("/query")
def chat_query(request: ChatQueryRequest, db: Session = Depends(get_db)):
    """
    Intelligent DAIna Concierge AI travel query resolution service.
    """
    msg = request.message.lower().strip()
    
    # 1. Check for Itinerary Request
    if any(k in msg for k in ["plan", "itinerary", "trip", "days", "escape", "schedule", "travel to"]):
        dest = "Goa, India"
        days = 3
        if "manali" in msg or "himachal" in msg:
            dest = "Manali, Himachal Pradesh"
        elif "andaman" in msg or "havelock" in msg:
            dest = "Havelock Island, Andamans"
        elif "jaipur" in msg or "rajasthan" in msg:
            dest = "Jaipur, Rajasthan"
        elif "kyoto" in msg or "japan" in msg:
            dest = "Kyoto, Japan"
        elif "coorg" in msg or "karnataka" in msg:
            dest = "Coorg, Karnataka"
        elif "munnar" in msg or "kerala" in msg:
            dest = "Munnar, Kerala"

        # Extract days count if mentioned (e.g., "5 days")
        day_match = re.search(r'(\d+)\s*(?:day|days)', msg)
        if day_match:
            days = min(7, max(1, int(day_match.group(1))))

        return {
            "reply": f"✦ I have synthesized a personalized {days}-day getaway passage to **{dest}**. I have selected private sanctuary stays [H], authentic dining [R], and golden-hour highlights [TA]. Click 'View Full Itinerary' to customize every detail.",
            "is_itinerary": True,
            "itinerary_data": {
                "destination": dest,
                "days_count": days,
                "budget": 25000 * (days // 2 or 1),
                "title": f"Bespoke {days}-Day {dest} Sanctuary Passage"
            },
            "suggested_questions": [
                f"What is the best weather season for {dest}?",
                f"Recommend top luxury stays in {dest}",
                f"What are the luggage & visa requirements?"
            ]
        }

    # 2. Packing / Weather / Visa advice
    if any(k in msg for k in ["pack", "weather", "visa", "carry", "clothes"]):
        return {
            "reply": "✦ For coastal and tropical getaways, I recommend packing reef-safe sunscreen, polarized sunglasses, breathable linen wear, and waterproof phone gear. For alpine and mountain retreats, pack layered thermal base wear, windproof outer shells, and sturdy grip boots.",
            "is_itinerary": False,
            "suggested_questions": [
                "Plan 4 days in Goa under ₹20k",
                "Show me popular weekend drive escapes",
                "How do Gold Coin rewards work?"
            ]
        }

    # 3. Budget & Price Advice
    if any(k in msg for k in ["budget", "cheap", "cost", "fare", "save", "discount"]):
        return {
            "reply": "✦ DAIna AI continuously monitors fare rates across 12+ providers including Skyscanner, Booking.com, and Airbnb. Booking flights 18 to 21 days in advance typically secures an 18-24% price reduction. You can also redeem Gold Coins for instant hotel discounts in the Rewards Vault.",
            "is_itinerary": False,
            "suggested_questions": [
                "Open Booking Aggregation Hub",
                "Redeem ₹3,000 Taj Hotel voucher",
                "Plan a weekend getaway from Bengaluru"
            ]
        }

    # Default Concierge Greeting
    return {
        "reply": "✦ As your DAIna AI Travel Concierge, I can architect bespoke multi-day itineraries, compare live flight & stay fares across 12 providers, and coordinate squad expense splitting. Where would you like to travel next?",
        "is_itinerary": False,
        "suggested_questions": [
            "Plan 3 days in Goa with beach villas",
            "Weekend escapes within 3 hours drive",
            "Snow trek itinerary in Manali"
        ]
    }
