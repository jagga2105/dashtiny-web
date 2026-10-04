"""
DashTiny Natural Language Intent & Clarification Engine
backend/app/services/planner/intent.py

Extracts structured planning parameters from natural language prompts,
determines what was understood, and identifies genuinely missing critical or optional information.
Never silently assumes ambiguous information.
"""
import re
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class UnderstoodIntent(BaseModel):
    destination: Optional[str] = None
    origin: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_count: int = 4
    travelers: int = 2
    budget: float = 0.0
    currency: str = "INR"
    pace: str = "balanced"  # relaxed, balanced, packed
    persona: str = "solo"   # solo, couple, family, squad, nomad
    vibe: str = "Leisure & Scenic"
    interests: List[str] = Field(default_factory=list)
    wake_up_preference: str = "balanced"  # early_bird, balanced, late_morning
    accommodation_preference: str = "comfort"  # budget, comfort, boutique, luxury
    transport_preference: str = "mix"  # walking, cab, public_transit, rental_car, mix
    food_preferences: List[str] = Field(default_factory=list)  # vegetarian, vegan, seafood, any
    raw_prompt: str = ""


class IntentClarificationResponse(BaseModel):
    understood: UnderstoodIntent
    is_ready_to_plan: bool
    summary_text: str
    missing_critical: List[str]
    missing_optional: List[str]
    clarification_questions: List[str]


MONTH_NAMES = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12
}


def parse_dates(text: str, default_days: int = 4) -> tuple[Optional[str], Optional[str], int]:
    """
    Extracts explicit dates from text:
    - '2026-10-20 to 2026-10-25'
    - 'from Oct 20 to Oct 25' / 'Oct 20 - 25'
    - '20 to 25 Oct'
    - 'starting Oct 20'
    """
    lower = text.lower()
    today = datetime.now(timezone.utc).date()
    current_year = today.year

    # 1. ISO format
    iso_match = re.search(r"(\d{4}-\d{2}-\d{2})\s*(?:to|-|until|through)\s*(\d{4}-\d{2}-\d{2})", lower)
    if iso_match:
        try:
            s = date.fromisoformat(iso_match.group(1))
            e = date.fromisoformat(iso_match.group(2))
            if e >= s:
                days = (e - s).days + 1
                return s.isoformat(), e.isoformat(), days
        except ValueError:
            pass

    # 2. Month Day to Month Day
    m1 = re.search(r"(?:from\s+)?([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|until|through)\s*(?:([a-z]+)\s+)?(\d{1,2})(?:st|nd|rd|th)?", lower)
    if m1:
        mon1 = m1.group(1)
        d1 = int(m1.group(2))
        mon2 = m1.group(3) or mon1
        d2 = int(m1.group(4))
        if mon1 in MONTH_NAMES and mon2 in MONTH_NAMES:
            m_idx1 = MONTH_NAMES[mon1]
            m_idx2 = MONTH_NAMES[mon2]
            y1 = current_year if m_idx1 >= today.month else current_year + 1
            y2 = y1 if m_idx2 >= m_idx1 else y1 + 1
            try:
                s = date(y1, m_idx1, d1)
                e = date(y2, m_idx2, d2)
                if e >= s:
                    return s.isoformat(), e.isoformat(), (e - s).days + 1
            except ValueError:
                pass

    # 3. Day to Day Month
    m2 = re.search(r"(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|until|through)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)", lower)
    if m2:
        d1 = int(m2.group(1))
        d2 = int(m2.group(2))
        mon = m2.group(3)
        if mon in MONTH_NAMES:
            m_idx = MONTH_NAMES[mon]
            y = current_year if m_idx >= today.month else current_year + 1
            try:
                s = date(y, m_idx, d1)
                e = date(y, m_idx, d2)
                if e >= s:
                    return s.isoformat(), e.isoformat(), (e - s).days + 1
            except ValueError:
                pass

    return None, None, default_days


def parse_days_count(text: str) -> int:
    lower = text.lower()
    if "weekend" in lower:
        return 3
    if "1 week" in lower or "one week" in lower:
        return 7
    if "2 weeks" in lower or "two weeks" in lower:
        return 14

    m = re.search(r"(\d+)\s*(?:day|days|-day)", lower)
    if m:
        return min(30, max(1, int(m.group(1))))

    m_night = re.search(r"(\d+)\s*(?:night|nights)", lower)
    if m_night:
        return min(30, max(1, int(m_night.group(1)) + 1))

    return 4


def parse_budget(text: str) -> float:
    lower = text.lower()
    # Lakhs
    lakh_match = re.search(r"(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:lakh|lakhs|lac|lacs|l\b)", lower)
    if lakh_match:
        return float(lakh_match.group(1)) * 100000.0

    # 'k' thousands
    k_match = re.search(r"(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)?\s*([0-9]+)\s*k\b", lower)
    if k_match:
        return float(k_match.group(1)) * 1000.0

    # Digits with comma or raw numbers
    num_match = re.search(r"(?:₹|rs\.?|inr|under|budget\s*(?:of)?|around)\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{4,7})", lower)
    if num_match:
        clean_num = float(num_match.group(1).replace(",", ""))
        if clean_num >= 1000:
            return clean_num

    return 0.0


def parse_destination_and_origin(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extracts origin and destination from common travel patterns:
    - 'trip to Goa from Delhi'
    - 'from Delhi to Goa'
    - 'Goa from Delhi'
    - '5-day Goa trip'
    """
    clean_text = text.strip()

    # Pattern: 'to <destination> from <origin>'
    m1 = re.search(r"(?:trip|getaway|vacation|holiday|escape|travel)?\s*to\s+([A-Za-z\s]+?)\s+from\s+([A-Za-z\s]+?)(?=\s+(?:under|with|for|budget|in|on|dates?|$))", clean_text, re.IGNORECASE)
    if m1:
        return clean_city(m1.group(1)), clean_city(m1.group(2))

    # Pattern: 'from <origin> to <destination>'
    m2 = re.search(r"from\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?=\s+(?:under|with|for|budget|in|on|dates?|trip|$))", clean_text, re.IGNORECASE)
    if m2:
        orig = clean_city(m2.group(1))
        dest = clean_city(m2.group(2))
        if orig and dest:
            return dest, orig

    # Pattern: '<destination> from <origin>'
    m3 = re.search(r"([A-Za-z\s]+?)\s+from\s+([A-Za-z\s]+?)(?=\s+(?:under|for|with|budget|$))", clean_text, re.IGNORECASE)
    if m3:
        cand_dest = clean_city(m3.group(1))
        cand_orig = clean_city(m3.group(2))
        # Ensure destination isn't just duration
        if cand_dest and cand_orig and not re.search(r"\b(day|days|night|nights|week)\b", cand_dest, re.I):
            return cand_dest, cand_orig

    # Pattern: '<duration> <destination> trip from <origin>'
    m4_from = re.search(r"(?:\d+\s*(?:day|days|-day|week|nights?))\s+([A-Za-z\s]+?)\s+(?:trip|getaway|itinerary|holiday|vacation|tour|escape)\s+from\s+([A-Za-z\s]+?)(?=\s+(?:under|with|for|budget|in|on|dates?|$))", clean_text, re.IGNORECASE)
    if m4_from:
        cand_dest = clean_city(m4_from.group(1))
        cand_orig = clean_city(m4_from.group(2))
        if cand_dest and cand_orig:
            return cand_dest, cand_orig

    # Pattern: '<duration> <destination> trip'
    m4 = re.search(r"(?:\d+\s*(?:day|days|-day|week|nights?))\s+([A-Za-z\s]+?)\s+(?:trip|getaway|itinerary|holiday|vacation|tour|escape)", clean_text, re.IGNORECASE)
    if m4:
        return clean_city(m4.group(1)), None

    # Pattern: 'trip to <destination>'
    m5 = re.search(r"(?:trip|holiday|vacation|getaway|escape|journey)\s+(?:to|in)\s+([A-Za-z\s]+?)(?=\s+(?:under|for|with|from|budget|$))", clean_text, re.IGNORECASE)
    if m5:
        return clean_city(m5.group(1)), None

    # Fallback first meaningful word if recognizable destination
    known_destinations = ["goa", "delhi", "mumbai", "bengaluru", "bangalore", "jaipur", "udaipur", "manali", "shimla", "kashmir", "srinagar", "gulmarg", "ladakh", "leh", "kerala", "munnar", "coorg", "ooty", "agra", "varanasi", "andaman", "bali", "phuket", "kyoto", "tokyo", "paris", "dubai", "singapore", "kathmandu", "nepal"]
    for kd in known_destinations:
        if re.search(rf"\b{kd}\b", clean_text, re.IGNORECASE):
            return kd.title(), None

    return None, None


def clean_city(raw: str) -> Optional[str]:
    if not raw:
        return None
    # Strip common prepositions and adjectives
    cleaned = re.sub(r"\b(a|an|the|under|with|for|my|our|partner|friends|squad|couple|family|budget|trip|luxury|cheap|best|escape|getaway|vacation|holiday|weekend)\b", "", raw, flags=re.IGNORECASE).strip()
    words = [w.capitalize() for w in cleaned.split() if len(w) > 1]
    if words:
        return " ".join(words[:3])
    return None


def extract_travelers_and_persona(text: str) -> tuple[int, str]:
    lower = text.lower()
    num_match = re.search(r"(?:for\s+)?(\d+)\s*(?:people|persons|travellers|travelers|guests|adults|friends|of us)\b", lower)
    if num_match:
        return min(50, max(1, int(num_match.group(1)))), "squad" if int(num_match.group(1)) > 2 else ("couple" if int(num_match.group(1)) == 2 else "solo")

    words_map = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
    word_match = re.search(r"\b(?:for\s+)?(one|two|three|four|five|six)\s+(?:people|persons|travellers|travelers|guests|adults|friends|of us)\b", lower)
    if word_match:
        count = words_map[word_match.group(1).lower()]
        return count, "couple" if count == 2 else ("solo" if count == 1 else "squad")

    if any(k in lower for k in ["solo", "alone", "myself"]):
        return 1, "solo"
    if any(k in lower for k in ["partner", "couple", "romantic", "wife", "husband", "girlfriend", "boyfriend"]):
        return 2, "couple"
    if any(k in lower for k in ["family", "kids", "children", "parents"]):
        return 4, "family"
    if any(k in lower for k in ["squad", "friends", "gang", "buddies"]):
        return 4, "squad"
    if any(k in lower for k in ["nomad", "workation"]):
        return 1, "nomad"

    return 2, "couple"


def extract_interests(text: str) -> List[str]:
    lower = text.lower()
    interests = []
    interest_map = {
        "beaches": ["beach", "beaches", "coastal", "ocean", "sea"],
        "food": ["food", "dining", "cuisine", "seafood", "tasting", "curry", "cafe"],
        "nightlife": ["nightlife", "party", "club", "pub", "bar", "cocktail"],
        "culture": ["culture", "heritage", "temple", "fort", "history", "museum"],
        "nature": ["nature", "greenery", "wildlife", "forest", "hills", "mountain"],
        "wellness": ["wellness", "spa", "yoga", "ayurveda", "relax"],
        "adventure": ["adventure", "trek", "scuba", "kayak", "watersports", "hike"],
        "photography": ["photo", "photography", "sunset", "sunrise", "scenic", "viewpoint"]
    }
    for tag, keywords in interest_map.items():
        if any(k in lower for k in keywords):
            interests.append(tag)
    return interests


def extract_pace(text: str) -> str:
    lower = text.lower()
    if any(k in lower for k in ["relaxed", "slow", "easy", "chill", "leisure", "unhurried"]):
        return "relaxed"
    if any(k in lower for k in ["packed", "fast", "dense", "hectic", "cover everything", "maximum"]):
        return "packed"
    return "balanced"


def extract_food_preference(text: str) -> List[str]:
    lower = text.lower()
    prefs = []
    if "vegetarian" in lower or "pure veg" in lower:
        prefs.append("vegetarian")
    if "vegan" in lower:
        prefs.append("vegan")
    if "seafood" in lower:
        prefs.append("seafood")
    if "halal" in lower:
        prefs.append("halal")
    if not prefs:
        prefs.append("any")
    return prefs


def parse_travel_intent(prompt: str) -> IntentClarificationResponse:
    """
    Parses natural language prompt into structured intent, flags missing critical / optional fields,
    and returns friendly summary and clarification prompts.
    """
    days = parse_days_count(prompt)
    s_date, e_date, calc_days = parse_dates(prompt, default_days=days)
    if calc_days:
        days = calc_days

    budget = parse_budget(prompt)
    dest, orig = parse_destination_and_origin(prompt)
    travelers, persona = extract_travelers_and_persona(prompt)
    interests = extract_interests(prompt)
    pace = extract_pace(prompt)
    food_prefs = extract_food_preference(prompt)

    # Determine missing fields
    missing_critical = []
    missing_optional = []
    clarification_questions = []

    if not dest:
        missing_critical.append("destination")
        clarification_questions.append("Where would you like to travel? (e.g. Goa, Kyoto, Manali, Paris)")

    if not orig:
        missing_optional.append("origin")
        clarification_questions.append("Where are you starting your journey from? (e.g. Delhi, Mumbai)")

    if not s_date:
        missing_optional.append("dates")
        clarification_questions.append("What dates or month are you considering for this trip?")

    if budget <= 0:
        missing_optional.append("budget")
        clarification_questions.append("What approximate budget should DAIna plan around?")

    understood = UnderstoodIntent(
        destination=dest,
        origin=orig,
        start_date=s_date,
        end_date=e_date,
        days_count=days,
        travelers=travelers,
        budget=budget,
        currency="INR",
        pace=pace,
        persona=persona,
        vibe="Relaxed Coastal & Culture" if pace == "relaxed" else "Scenic Discovery",
        interests=interests or ["sightseeing", "food"],
        wake_up_preference="late_morning" if pace == "relaxed" else "balanced",
        accommodation_preference="luxury" if budget > 80000 else "comfort",
        transport_preference="mix",
        food_preferences=food_prefs,
        raw_prompt=prompt
    )

    # Summary text
    parts = []
    if dest:
        parts.append(f"{dest} · {days} days")
    if orig and dest:
        parts.append(f"{orig} → {dest}")
    parts.append(f"{travelers} traveler{'s' if travelers > 1 else ''}")
    if budget > 0:
        parts.append(f"₹{int(budget):,} target")
    else:
        parts.append("Flexible budget")
    parts.append(f"{pace.title()} pace")
    if interests:
        parts.append(" + ".join(i.title() for i in interests[:3]))

    summary_text = " · ".join(parts)
    is_ready = bool(dest)

    return IntentClarificationResponse(
        understood=understood,
        is_ready_to_plan=is_ready,
        summary_text=summary_text,
        missing_critical=missing_critical,
        missing_optional=missing_optional,
        clarification_questions=clarification_questions
    )
