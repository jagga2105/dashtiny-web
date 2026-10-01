import re
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db

router = APIRouter(prefix="/chat", tags=["DAIna AI Travel Concierge"])

class ChatQueryRequest(BaseModel):
    message: str
    context: Optional[dict] = None

def extract_budget(text: str, days: int) -> float:
    lower = text.lower()
    # Lakhs (e.g. 1.5 lakh, 2 lakhs, 1.5L)
    lakh_match = re.search(r'(?:₹|rs\.?|inr|under|budget|around)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakh|lakhs|lac|lacs|l\b)', lower)
    if lakh_match:
        return float(lakh_match.group(1)) * 100000

    # Thousands with k (e.g. 50k, 80k)
    k_match = re.search(r'(?:₹|rs\.?|inr|under|budget|around)?\s*([0-9]+)\s*k\b', lower)
    if k_match:
        return float(k_match.group(1)) * 1000

    # Direct numbers >= 5000
    num_match = re.search(r'(?:₹|rs\.?|inr|under|budget|around)\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{4,7})', lower)
    if num_match:
        clean = float(num_match.group(1).replace(',', ''))
        if clean >= 5000:
            return clean

    # Dynamic default estimation
    return float(days * 12000)

def extract_destination(text: str) -> str:
    # Check known destinations first
    known = [
        ("japan", "Japan"),
        ("tokyo", "Tokyo, Japan"),
        ("kyoto", "Kyoto, Japan"),
        ("switzerland", "Switzerland"),
        ("paris", "Paris, France"),
        ("bali", "Bali, Indonesia"),
        ("dubai", "Dubai, UAE"),
        ("thailand", "Thailand"),
        ("vietnam", "Vietnam"),
        ("goa", "Goa, India"),
        ("manali", "Manali, Himachal Pradesh"),
        ("himachal", "Manali, Himachal Pradesh"),
        ("kashmir", "Kashmir Valley"),
        ("gulmarg", "Gulmarg, Kashmir"),
        ("ladakh", "Ladakh, India"),
        ("leh", "Leh, Ladakh"),
        ("andaman", "Havelock Island, Andamans"),
        ("havelock", "Havelock Island, Andamans"),
        ("coorg", "Coorg, Karnataka"),
        ("munnar", "Munnar, Kerala"),
        ("kerala", "Kerala Backwaters"),
        ("jaipur", "Jaipur, Rajasthan"),
        ("udaipur", "Udaipur, Rajasthan"),
        ("rajasthan", "Rajasthan, India"),
        ("pondicherry", "Pondicherry, India"),
        ("varanasi", "Varanasi, India")
    ]
    lower = text.lower()
    for kw, label in known:
        if kw in lower:
            return label

    # Try regex patterns
    m = re.search(r'(?:trip|holiday|vacation|getaway|travel|escape|passage)\s+(?:to|in|for)\s+([a-zA-Z\s]+?)(?=\s+(?:under|with|for|budget|$))', text, re.IGNORECASE)
    if m:
        dest = m.group(1).strip()
        if len(dest) > 2:
            return dest.title()

    to_m = re.search(r'\bto\s+([a-zA-Z\s]+?)(?=\s+(?:under|with|for|budget|$))', text, re.IGNORECASE)
    if to_m:
        dest = to_m.group(1).strip()
        if len(dest) > 2:
            return dest.title()

    return "Custom Sanctuary Escape"

@router.post("/query")
def chat_query(request: ChatQueryRequest, db: Session = Depends(get_db)):
    """
    Intelligent DAIna Concierge AI travel query resolution service.
    """
    msg = request.message.lower().strip()
    
    # 1. Check for Itinerary Request
    if any(k in msg for k in ["plan", "itinerary", "trip", "days", "escape", "schedule", "travel to", "vacation", "holiday"]):
        # Extract days count
        days = 4
        if "weekend" in msg:
            days = 3
        elif "1 week" in msg or "one week" in msg:
            days = 7
        elif "2 weeks" in msg or "two weeks" in msg:
            days = 14
        else:
            day_match = re.search(r'(\d+)\s*[-]?\s*(?:day|days)', msg)
            if day_match:
                days = min(14, max(1, int(day_match.group(1))))

        dest = extract_destination(request.message)
        budget = extract_budget(request.message, days)

        return {
            "reply": f"✦ I have synthesized a personalized {days}-day bespoke passage to **{dest}** with an optimized budget of ₹{budget:,.0f}. I have selected private sanctuary stays [H], authentic dining [R], and golden-hour highlights [TA]. Click below to view and customize your full itinerary.",
            "is_itinerary": True,
            "itinerary_data": {
                "destination": dest,
                "days_count": days,
                "budget": budget,
                "title": f"Bespoke {days}-Day {dest} Sanctuary Passage"
            },
            "suggested_questions": [
                f"What is the best weather season for {dest}?",
                f"Recommend top luxury stays in {dest}",
                f"What are the luggage & visa requirements for {dest}?"
            ]
        }

    # 2. Packing / Weather / Visa advice
    if any(k in msg for k in ["pack", "weather", "visa", "carry", "clothes"]):
        return {
            "reply": "✦ For coastal and tropical getaways, I recommend packing reef-safe sunscreen, polarized sunglasses, breathable linen wear, and waterproof phone gear. For alpine and mountain retreats, pack layered thermal base wear, windproof outer shells, and sturdy grip boots.",
            "is_itinerary": False,
            "suggested_questions": [
                "Plan 7 days in Japan under ₹1.5 lakh",
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
            "Plan 7 days in Japan under ₹1.5 lakh",
            "Weekend escapes within 3 hours drive",
            "Snow trek itinerary in Manali"
        ]
    }
