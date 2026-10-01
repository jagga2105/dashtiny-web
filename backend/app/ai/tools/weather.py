"""
Weather Tool - Seasonal Intelligence & Packing Advisories (backend/app/ai/tools/weather.py)
Truth boundary: Returns CURATED seasonal profiles for known hubs, and DEMO estimates for others.
Real API queries to OpenWeather/WeatherAPI would carry PROVIDER_VERIFIED.
"""
from typing import Dict, Any

CURATED_WEATHER: Dict[str, Dict[str, Any]] = {
    "manali": {
        "destination": "Manali, Himachal Pradesh",
        "current_temp": "14°C",
        "forecast": "Crisp mountain breeze with clear blue skies",
        "condition": "Alpine Sunshine ☀️",
        "uv_index": 5,
        "air_quality": "AQI 22 (Pristine)",
        "provenance": "CURATED",
        "packing_advisory": "Pack layered fleeces, windbreakers, and sturdy hiking shoes."
    },
    "kashmir": {
        "destination": "Gulmarg & Srinagar, Kashmir",
        "current_temp": "12°C",
        "forecast": "Chilly alpine mornings with sunny afternoons",
        "condition": "Crisp Mountain Breeze 🏔️",
        "uv_index": 4,
        "air_quality": "AQI 15 (Pristine)",
        "provenance": "CURATED",
        "packing_advisory": "Pack thermal innerwear, cashmere wraps, and waterproof walking boots."
    },
    "gulmarg": {
        "destination": "Gulmarg, Kashmir",
        "current_temp": "10°C",
        "forecast": "Cold alpine breeze, clear skies over Apharwat Peak",
        "condition": "Snow & Sun ❄️☀️",
        "uv_index": 4,
        "air_quality": "AQI 14 (Pristine)",
        "provenance": "CURATED",
        "packing_advisory": "Pack heavy woolens, insulated snow boots, and polarized sunglasses for snow glare."
    },
    "kyoto": {
        "destination": "Kyoto, Japan",
        "current_temp": "19°C",
        "forecast": "Mild seasonal breeze with clear skies",
        "condition": "Pleasant Autumn 🍁",
        "uv_index": 4,
        "air_quality": "AQI 18 (Pristine)",
        "provenance": "CURATED",
        "packing_advisory": "Pack lightweight trench coat, comfortable walking trainers, and light umbrella."
    },
    "tokyo": {
        "destination": "Tokyo, Japan",
        "current_temp": "20°C",
        "forecast": "Pleasant city temperature with moderate humidity",
        "condition": "Clear Skies 🏙️",
        "uv_index": 5,
        "air_quality": "AQI 25 (Good)",
        "provenance": "CURATED",
        "packing_advisory": "Pack versatile city layers, slip-on shoes for temple visits, and a daypack."
    },
    "goa": {
        "destination": "Goa, India",
        "current_temp": "28°C",
        "forecast": "Warm tropical sun with gentle coastal evening breeze",
        "condition": "Tropical Sunshine 🌴",
        "uv_index": 7,
        "air_quality": "AQI 28 (Excellent)",
        "provenance": "CURATED",
        "packing_advisory": "Pack breathable cotton/linen apparel, polarized sunglasses, and reef-friendly SPF 50 sunscreen."
    },
    "jaipur": {
        "destination": "Jaipur, Rajasthan",
        "current_temp": "27°C",
        "forecast": "Dry sunny days with cool desert evenings",
        "condition": "Warm & Sunny ☀️",
        "uv_index": 6,
        "air_quality": "AQI 75 (Moderate)",
        "provenance": "CURATED",
        "packing_advisory": "Pack breathable cottons for daytime fort walks and a light shawl or jacket for desert evenings."
    },
    "coorg": {
        "destination": "Coorg, Karnataka",
        "current_temp": "21°C",
        "forecast": "Misty coffee estate breeze with occasional light drizzle",
        "condition": "Misty Retreat ☕",
        "uv_index": 4,
        "air_quality": "AQI 16 (Pristine)",
        "provenance": "CURATED",
        "packing_advisory": "Pack light knitwear, water-resistant trail shoes, and rain protection."
    }
}

def get_destination_weather(destination: str, month: str = None) -> Dict[str, Any]:
    """
    Returns authentic seasonal weather advisory.
    Uses CURATED profiles for established destinations, or DEMO heuristic for others.
    """
    dest_lower = destination.lower() if destination else ""
    for key, data in CURATED_WEATHER.items():
        if key in dest_lower:
            return dict(data)
    
    # Generic DEMO estimate for unrecognized destinations
    clean_dest = destination.title() if destination else "Your Destination"
    is_cold = any(k in dest_lower for k in ["mountain", "alps", "snow", "trek", "himalaya", "ladakh", "switzerland"])
    is_beach = any(k in dest_lower for k in ["beach", "island", "sea", "ocean", "bali", "maldives", "andaman"])

    if is_cold:
        return {
            "destination": clean_dest,
            "current_temp": "12°C",
            "forecast": "Alpine weather with brisk mountain air",
            "condition": "Crisp Alpine 🏔️",
            "uv_index": 5,
            "air_quality": "AQI 20 (Pristine)",
            "provenance": "DEMO",
            "packing_advisory": "Pack thermal layers, fleece jacket, windbreaker, and sturdy grip shoes."
        }
    elif is_beach:
        return {
            "destination": clean_dest,
            "current_temp": "29°C",
            "forecast": "Tropical coastal sunshine with evening sea breeze",
            "condition": "Sunny Beachfront 🏖️",
            "uv_index": 8,
            "air_quality": "AQI 25 (Good)",
            "provenance": "DEMO",
            "packing_advisory": "Pack breathable linen wear, swimwear, hat, sunglasses, and high-SPF sunscreen."
        }
    else:
        return {
            "destination": clean_dest,
            "current_temp": "22°C",
            "forecast": "Pleasant moderate temperatures suitable for walking tours",
            "condition": "Pleasant 🌤️",
            "uv_index": 5,
            "air_quality": "AQI 35 (Good)",
            "provenance": "DEMO",
            "packing_advisory": "Pack comfortable walking shoes, versatile casual layers, and a light jacket."
        }
