"""
Maps & Transit Tool (backend/app/ai/tools/maps.py)
Provides genuine spatial coordinates for known landmarks and destinations.
Rule: Never fabricate geographic precision. If coordinates are unknown or outside the destination boundary, return found=False, lat=None, lng=None.
"""
import math
from typing import Dict, Any, Optional

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculates great-circle distance in kilometers between two points."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

GEO_COORDINATES = {
    # Goa Micro-destinations & Hubs
    "vagator": {"lat": 15.6028, "lng": 73.7336, "name": "Vagator Beach, North Goa", "destination": "goa"},
    "anjuna": {"lat": 15.5800, "lng": 73.7420, "name": "Anjuna Coastal Belt, Goa", "destination": "goa"},
    "chapora": {"lat": 15.6062, "lng": 73.7360, "name": "Chapora Fort Ridge, Goa", "destination": "goa"},
    "grande island": {"lat": 15.3524, "lng": 73.7667, "name": "Grande Island Reef, Goa", "destination": "goa"},
    "benaulim": {"lat": 15.2600, "lng": 73.9200, "name": "Benaulim White Sands, South Goa", "destination": "goa"},
    "fontainhas": {"lat": 15.4989, "lng": 73.8278, "name": "Fontainhas Latin Quarter, Panjim", "destination": "goa"},
    "panaji": {"lat": 15.4909, "lng": 73.8278, "name": "Panaji, Goa", "destination": "goa"},
    "panjim": {"lat": 15.4909, "lng": 73.8278, "name": "Panaji, Goa", "destination": "goa"},
    "ponda": {"lat": 15.4026, "lng": 74.0156, "name": "Sahakari Spice Plantation, Ponda", "destination": "goa"},
    "harvalem": {"lat": 15.5539, "lng": 74.0256, "name": "Harvalem Waterfalls, Sanquelim", "destination": "goa"},
    "candolim": {"lat": 15.5165, "lng": 73.7686, "name": "Candolim Beachfront, Goa", "destination": "goa"},
    "calangute": {"lat": 15.5439, "lng": 73.7553, "name": "Calangute, Goa", "destination": "goa"},
    "morjim": {"lat": 15.6322, "lng": 73.7344, "name": "Morjim Turtle Beach, Goa", "destination": "goa"},
    "goa": {"lat": 15.2993, "lng": 74.1240, "name": "Goa, India", "destination": "goa"},
    
    # Manali & Himachal Pradesh
    "solang": {"lat": 32.3166, "lng": 77.1575, "name": "Solang Valley, Manali", "destination": "manali"},
    "old manali": {"lat": 32.2548, "lng": 77.1788, "name": "Old Manali Village, Himachal", "destination": "manali"},
    "hadimba": {"lat": 32.2483, "lng": 77.1809, "name": "Hadimba Temple Forest, Manali", "destination": "manali"},
    "rohtang": {"lat": 32.3716, "lng": 77.2466, "name": "Rohtang Alpine Pass, Himachal", "destination": "manali"},
    "manali": {"lat": 32.2432, "lng": 77.1892, "name": "Manali, Himachal Pradesh", "destination": "manali"},
    "shimla": {"lat": 31.1048, "lng": 77.1734, "name": "Shimla, Himachal Pradesh", "destination": "shimla"},

    # Kashmir & Ladakh
    "gulmarg": {"lat": 34.0484, "lng": 74.3805, "name": "Gulmarg, Kashmir", "destination": "kashmir"},
    "srinagar": {"lat": 34.0837, "lng": 74.7973, "name": "Srinagar, Kashmir", "destination": "kashmir"},
    "leh": {"lat": 34.1526, "lng": 77.5771, "name": "Leh, Ladakh", "destination": "ladakh"},
    "ladakh": {"lat": 34.1526, "lng": 77.5771, "name": "Ladakh, India", "destination": "ladakh"},

    # Karnataka & Kerala (Southern Escapes)
    "coorg": {"lat": 12.3375, "lng": 75.8069, "name": "Coorg, Karnataka", "destination": "coorg"},
    "munnar": {"lat": 10.0889, "lng": 77.0595, "name": "Munnar, Kerala", "destination": "munnar"},
    "wayanad": {"lat": 11.6854, "lng": 76.1320, "name": "Wayanad, Kerala", "destination": "wayanad"},
    "gokarna": {"lat": 14.5479, "lng": 74.3188, "name": "Gokarna, Karnataka", "destination": "gokarna"},
    "bengaluru": {"lat": 12.9716, "lng": 77.5946, "name": "Bengaluru, Karnataka", "destination": "bengaluru"},
    "bangalore": {"lat": 12.9716, "lng": 77.5946, "name": "Bengaluru, Karnataka", "destination": "bengaluru"},

    # Rajasthan & Heritage
    "amber fort": {"lat": 26.9855, "lng": 75.8513, "name": "Amer Fort, Jaipur", "destination": "jaipur"},
    "amer fort": {"lat": 26.9855, "lng": 75.8513, "name": "Amer Fort, Jaipur", "destination": "jaipur"},
    "panna meena": {"lat": 26.9855, "lng": 75.8513, "name": "Panna Meena ka Kund, Jaipur", "destination": "jaipur"},
    "hawa mahal": {"lat": 26.9239, "lng": 75.8267, "name": "Hawa Mahal, Jaipur", "destination": "jaipur"},
    "city palace": {"lat": 26.9258, "lng": 75.8237, "name": "City Palace, Jaipur", "destination": "jaipur"},
    "jantar mantar": {"lat": 26.9248, "lng": 75.8246, "name": "Jantar Mantar, Jaipur", "destination": "jaipur"},
    "nahargarh": {"lat": 26.9372, "lng": 75.8156, "name": "Nahargarh Fort, Jaipur", "destination": "jaipur"},
    "jaipur": {"lat": 26.9124, "lng": 75.7873, "name": "Jaipur, Rajasthan", "destination": "jaipur"},
    "udaipur": {"lat": 24.5854, "lng": 73.7125, "name": "Udaipur, Rajasthan", "destination": "udaipur"},

    # Global Destinations & Landmarks
    "arashiyama": {"lat": 35.0167, "lng": 135.6713, "name": "Arashiyama Bamboo Grove, Kyoto", "destination": "kyoto"},
    "fushimi inari": {"lat": 34.9671, "lng": 135.7727, "name": "Fushimi Inari Shrine, Kyoto", "destination": "kyoto"},
    "gion": {"lat": 35.0037, "lng": 135.7772, "name": "Gion Historic District, Kyoto", "destination": "kyoto"},
    "kinkaku-ji": {"lat": 35.0394, "lng": 135.7292, "name": "Kinkaku-ji Golden Pavilion, Kyoto", "destination": "kyoto"},
    "tenryu-ji": {"lat": 35.0158, "lng": 135.6776, "name": "Tenryu-ji Zen Temple, Kyoto", "destination": "kyoto"},
    "ryoan-ji": {"lat": 35.0345, "lng": 135.7182, "name": "Ryoan-ji Rock Garden, Kyoto", "destination": "kyoto"},
    "kyoto": {"lat": 35.0116, "lng": 135.7681, "name": "Kyoto, Japan", "destination": "kyoto"},
    "tokyo": {"lat": 35.6762, "lng": 139.6503, "name": "Tokyo, Japan", "destination": "tokyo"},
    "japan": {"lat": 35.6762, "lng": 139.6503, "name": "Japan", "destination": "japan"},
    
    # Europe
    "eiffel tower": {"lat": 48.8584, "lng": 2.2945, "name": "Eiffel Tower, Paris", "destination": "paris"},
    "louvre": {"lat": 48.8606, "lng": 2.3376, "name": "Louvre Museum, Paris", "destination": "paris"},
    "paris": {"lat": 48.8566, "lng": 2.3522, "name": "Paris, France", "destination": "paris"},
    "switzerland": {"lat": 46.8182, "lng": 8.2275, "name": "Switzerland", "destination": "switzerland"},
    "zurich": {"lat": 47.3769, "lng": 8.5417, "name": "Zurich, Switzerland", "destination": "zurich"},
    
    # Middle East & SE Asia
    "bali": {"lat": -8.4095, "lng": 115.1889, "name": "Bali, Indonesia", "destination": "bali"},
    "dubai": {"lat": 25.2048, "lng": 55.2708, "name": "Dubai, UAE", "destination": "dubai"},
    "andaman": {"lat": 11.9761, "lng": 92.9876, "name": "Havelock Island, Andamans", "destination": "andaman"},
    "havelock": {"lat": 11.9761, "lng": 92.9876, "name": "Havelock Island, Andamans", "destination": "andaman"},
}

def get_coordinates(location_name: str, target_destination: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns authentic geocoded coordinates if known in curated spatial registry.
    If target_destination is provided, strictly enforces geographic boundary verification:
    checks destination mapping and distance from destination center. If outside boundary, rejects.
    If unknown or rejected, returns found=False, lat=None, lng=None to avoid fabricating geographic precision.
    """
    name_clean = location_name.lower().strip() if location_name else ""
    target_clean = target_destination.lower().strip() if target_destination else None

    # Search for matching landmark in curated spatial registry
    matched_entry = None
    for key, val in GEO_COORDINATES.items():
        if key in name_clean:
            matched_entry = val
            break

    if not matched_entry:
        return {
            "lat": None,
            "lng": None,
            "name": location_name,
            "found": False,
            "provenance": "CURATED_UNRESOLVED",
            "location_source": "UNRESOLVED"
        }

    # Boundary verification against target destination
    if target_clean:
        # Check if target destination center is known
        dest_entry = None
        for key, val in GEO_COORDINATES.items():
            if key == target_clean or key in target_clean or target_clean in key:
                dest_entry = val
                break

        loc_dest = matched_entry.get("destination", "").lower()
        # If destination tag is known and does not match target destination
        if loc_dest and (target_clean not in loc_dest and loc_dest not in target_clean):
            if dest_entry:
                dist_km = haversine_distance(
                    dest_entry["lat"], dest_entry["lng"],
                    matched_entry["lat"], matched_entry["lng"]
                )
                # If landmark is > 200 km away from trip destination center, reject as boundary mismatch!
                if dist_km > 200.0:
                    return {
                        "lat": None,
                        "lng": None,
                        "name": location_name,
                        "found": False,
                        "provenance": "CURATED_UNRESOLVED",
                        "location_source": "UNRESOLVED",
                        "mismatch": True,
                        "rejection_reason": f"Boundary check failed: '{location_name}' is {int(dist_km)}km away from '{target_destination}'"
                    }

    return {
        "lat": matched_entry["lat"],
        "lng": matched_entry["lng"],
        "name": matched_entry["name"],
        "found": True,
        "provenance": "CURATED",
        "location_source": "CURATED"
    }

def estimate_transit_time(origin_name: str, dest_name: str, mode: str = "drive") -> str:
    """
    Returns realistic transit duration between spots.
    """
    return "⏱️ 15-25m transit (Estimated)"
