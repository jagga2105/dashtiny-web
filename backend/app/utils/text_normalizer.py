"""
DashTiny Travel Text Normalizer
backend/app/utils/text_normalizer.py

Provides travel-specific spelling and term normalization:
- Corrects common typos for itinerary, accommodation, destination, restaurant, transportation, etc.
- Normalizes city aliases (e.g. Bangalore -> Bengaluru, Bombay -> Mumbai, Calicut -> Kozhikode).
- Cleans and standardizes travel queries without changing traveler intent or meaning.
"""
import re
from typing import Dict, Tuple

# Travel term typo corrections
TRAVEL_TERM_REPLACEMENTS: Dict[str, str] = {
    # Itinerary
    "itiniary": "itinerary",
    "itinirary": "itinerary",
    "itinerery": "itinerary",
    "itineray": "itinerary",
    "itineraries": "itineraries",
    "itinary": "itinerary",
    "itenerary": "itinerary",
    # Accommodation
    "accomodation": "accommodation",
    "acommodation": "accommodation",
    "acomodation": "accommodation",
    "accomadation": "accommodation",
    # Restaurant / Dining
    "resturant": "restaurant",
    "restraunt": "restaurant",
    "restarant": "restaurant",
    "restaraunt": "restaurant",
    "resturants": "restaurants",
    # Flight
    "flite": "flight",
    "fligts": "flights",
    "fligt": "flight",
    "flyt": "flight",
    # Destination
    "destinaton": "destination",
    "destintion": "destination",
    "destinashon": "destination",
    # Transport
    "transprt": "transport",
    "transportaion": "transportation",
    "transporation": "transportation",
    # Sightseeing / Activity
    "sightseing": "sightseeing",
    "sightseeng": "sightseeing",
    "experence": "experience",
    "experiance": "experience",
}

# Common destination aliases in India & International
DESTINATION_ALIASES: Dict[str, str] = {
    "bangalore": "Bengaluru",
    "bombay": "Mumbai",
    "calcutta": "Kolkata",
    "madras": "Chennai",
    "benares": "Varanasi",
    "banaras": "Varanasi",
    "kashi": "Varanasi",
    "calicut": "Kozhikode",
    "cochin": "Kochi",
    "trivandrum": "Thiruvananthapuram",
    "pondi": "Puducherry",
    "pondicherry": "Puducherry",
    "baroda": "Vadodara",
    "poona": "Pune",
}


def normalize_travel_text(text: str) -> str:
    """
    Normalizes travel terms and typos in a prompt or query while preserving case and meaning.
    """
    if not text:
        return ""

    words = text.split()
    normalized_words = []

    for word in words:
        # Strip trailing punctuation for lookup
        match = re.match(r"^([^\w]*)([\w'-]+)([^\w]*)$", word, re.UNICODE)
        if not match:
            normalized_words.append(word)
            continue

        prefix, core, suffix = match.groups()
        lower_core = core.lower()

        # Check typo replacements
        if lower_core in TRAVEL_TERM_REPLACEMENTS:
            corrected = TRAVEL_TERM_REPLACEMENTS[lower_core]
            # Match title case if original was title case
            if core.istitle():
                corrected = corrected.title()
            elif core.isupper():
                corrected = corrected.upper()
            normalized_words.append(f"{prefix}{corrected}{suffix}")
        elif lower_core in DESTINATION_ALIASES:
            normalized_words.append(f"{prefix}{DESTINATION_ALIASES[lower_core]}{suffix}")
        else:
            normalized_words.append(word)

    return " ".join(normalized_words)


def correct_travel_spelling(word: str) -> str:
    """Corrects spelling of a single travel-related term if known."""
    lower = word.strip().lower()
    return TRAVEL_TERM_REPLACEMENTS.get(lower, word)


def normalize_city_alias(city: str) -> str:
    """Normalizes historical or colloquial city alias to official city name."""
    lower = city.strip().lower()
    return DESTINATION_ALIASES.get(lower, city.title())


def extract_normalized_destination(query: str) -> str:
    """
    Extracts and standardizes destination name from short queries.
    """
    clean = normalize_travel_text(query.strip())
    lower = clean.lower()
    for alias, standard in DESTINATION_ALIASES.items():
        if alias == lower or f"to {alias}" in lower or f"in {alias}" in lower:
            return standard
    return clean.title()
