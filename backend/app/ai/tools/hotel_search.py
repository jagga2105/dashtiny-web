"""
Hotel & Villa Search Tool - Aggregation & Normalization Layer (backend/app/ai/tools/hotel_search.py)
Truth boundary: Returns CURATED showcase hotel inventory for verified hubs, or DEMO for prototypes.
Real external provider aggregations (via Booking.com/Agoda partner APIs) will carry PROVIDER_VERIFIED.
"""
from typing import List, Dict, Any

CURATED_HOTELS: Dict[str, List[Dict[str, Any]]] = {
    "manali": [
        {
            "id": "ht_manali_01",
            "name": "The Himalayan Castle & Alpine Spa",
            "star_rating": 4.9,
            "address": "Hadimba Road, Manali, Himachal Pradesh",
            "room_type": "Grand Deluxe Mountain View Chalet",
            "price_per_night": 9500,
            "currency": "INR",
            "amenities": ["Snow View Balcony", "Fireplace", "Heated Pool", "Step-Free Access"],
            "cancellation": "Free cancellation until 48 hours before check-in",
            "provenance": "CURATED",
            "source": "Curated Boutique Registry",
            "lat": 32.243,
            "lng": 77.189,
            "deep_link": "https://www.booking.com",
            "why_recommended": "Stunning snow peak panorama and peaceful pine forest trail setting"
        },
        {
            "id": "ht_manali_02",
            "name": "Larisa Resort & Apple Orchard Villa",
            "star_rating": 4.8,
            "address": "Haripur, Manali Valley",
            "room_type": "Private Cottage Suite",
            "price_per_night": 7200,
            "currency": "INR",
            "amenities": ["Orchard View", "Organic Dining", "Spa & Sauna"],
            "cancellation": "Flexible check-in",
            "provenance": "CURATED",
            "source": "Curated Boutique Registry",
            "lat": 32.195,
            "lng": 77.170,
            "deep_link": "https://www.airbnb.com",
            "why_recommended": "Organic farm-to-table breakfast and authentic Himalayan wood architecture"
        }
    ],
    "kashmir": [
        {
            "id": "ht_kashmir_01",
            "name": "The Khyber Himalayan Resort & Spa",
            "star_rating": 4.96,
            "address": "Near Gondola Phase 1, Gulmarg, Kashmir",
            "room_type": "Luxury Apharwat Pine View Room",
            "price_per_night": 24500,
            "currency": "INR",
            "amenities": ["Heated Indoor Glass Pool", "Ski-in / Ski-out Access", "L&apos;Occitane Spa"],
            "cancellation": "Free cancellation up to 7 days before check-in",
            "provenance": "CURATED",
            "source": "Curated Luxury Stays",
            "lat": 34.0484,
            "lng": 74.3805,
            "deep_link": "https://www.khyberhotels.com",
            "why_recommended": "Legendary snow-capped luxury resort perched minutes from Gulmarg Gondola"
        }
    ],
    "gulmarg": [
        {
            "id": "ht_gulmarg_01",
            "name": "The Khyber Himalayan Resort & Spa",
            "star_rating": 4.96,
            "address": "Near Gondola Phase 1, Gulmarg, Kashmir",
            "room_type": "Luxury Apharwat Pine View Room",
            "price_per_night": 24500,
            "currency": "INR",
            "amenities": ["Heated Indoor Glass Pool", "Ski-in / Ski-out Access", "L&apos;Occitane Spa"],
            "cancellation": "Free cancellation up to 7 days before check-in",
            "provenance": "CURATED",
            "source": "Curated Luxury Stays",
            "lat": 34.0484,
            "lng": 74.3805,
            "deep_link": "https://www.khyberhotels.com",
            "why_recommended": "Legendary snow-capped luxury resort perched minutes from Gulmarg Gondola"
        }
    ],
    "kyoto": [
        {
            "id": "ht_kyoto_01",
            "name": "Hoshinoya Kyoto Riverside Ryokan",
            "star_rating": 4.98,
            "address": "Arashiyama, Kyoto, Japan",
            "room_type": "Riverside Traditional Japanese Pavilion",
            "price_per_night": 45000,
            "currency": "INR",
            "amenities": ["Private Wooden Boat Access", "Cedarwood Baths", "Kaiseki Breakfast"],
            "cancellation": "14-day cancellation policy",
            "provenance": "CURATED",
            "source": "Curated Ryokan Guide",
            "lat": 35.0116,
            "lng": 135.6778,
            "deep_link": "https://www.hoshinoresorts.com",
            "why_recommended": "Arrive by private wooden riverboat into a secluded 400-year-old riverside sanctuary"
        }
    ],
    "goa": [
        {
            "id": "ht_goa_01",
            "name": "Taj Exotica Resort & Spa",
            "star_rating": 4.98,
            "address": "Calwaddo, Benaulim, South Goa",
            "room_type": "Private Ocean View Villa",
            "price_per_night": 18500,
            "currency": "INR",
            "amenities": ["Private Pool", "Private Beach Access", "Michelin Dining", "Wheelchair Friendly"],
            "cancellation": "Free cancellation until 24 hours before check-in",
            "provenance": "CURATED",
            "source": "Curated Luxury Stays",
            "lat": 15.267,
            "lng": 73.924,
            "deep_link": "https://www.tajhotels.com",
            "why_recommended": "Top-tier sanctuary with uninterrupted Arabian Sea horizon and 2.1km private coastal trail"
        },
        {
            "id": "ht_goa_02",
            "name": "W Goa Cliffside Sanctuary",
            "star_rating": 4.85,
            "address": "Vagator Beach, North Goa",
            "room_type": "Fabulous Sunset Chalet",
            "price_per_night": 14200,
            "currency": "INR",
            "amenities": ["Rock Pool Lounge", "Sunset Deck", "Spa", "Pet Friendly"],
            "cancellation": "Refundable rate available",
            "provenance": "CURATED",
            "source": "Curated Luxury Stays",
            "lat": 15.602,
            "lng": 73.734,
            "deep_link": "https://www.marriott.com",
            "why_recommended": "Spectacular cliffside sundowner spot with direct path to Chapora Fort"
        },
        {
            "id": "ht_goa_03",
            "name": "Ahilya by the Sea",
            "star_rating": 4.92,
            "address": "Nerul, Dolphin Bay, Goa",
            "room_type": "Boutique Heritage Villa Room",
            "price_per_night": 11500,
            "currency": "INR",
            "amenities": ["Infinity Pools", "Coconut Grove", "Custom Dining"],
            "cancellation": "Standard policy",
            "provenance": "CURATED",
            "source": "Curated Boutique Registry",
            "lat": 15.503,
            "lng": 73.784,
            "deep_link": "https://www.booking.com",
            "why_recommended": "Intimate Portuguese heritage estate perched right on the dolphin bay shoreline"
        }
    ]
}

def search_hotels(destination: str, budget_tier: str = "luxury", guests: int = 2) -> List[Dict[str, Any]]:
    """
    Search curated hotel offers.
    Provenances: CURATED for editorial selections; DEMO for demonstration prototypes.
    """
    dest_lower = destination.lower() if destination else ""
    for key, stays in CURATED_HOTELS.items():
        if key in dest_lower:
            return stays

    clean_dest = destination.title() if destination else "Getaway Destination"
    return [
        {
            "id": f"ht_demo_{clean_dest[:3].lower()}_01",
            "name": f"Boutique Sanctuary & Hillside Villa {clean_dest}",
            "star_rating": 4.85,
            "address": f"Central Sanctuary District, {clean_dest}",
            "room_type": "Premier Scenic Vista Suite",
            "price_per_night": 8500,
            "currency": "INR",
            "amenities": ["Panoramic Balcony", "Complimentary Breakfast", "High-Speed WiFi"],
            "cancellation": "Free cancellation up to 48 hours prior",
            "provenance": "DEMO",
            "source": "DashTiny Showcase Catalog",
            "lat": None,
            "lng": None,
            "deep_link": "https://www.booking.com",
            "why_recommended": f"Prime recommended location for central exploration in {clean_dest}"
        }
    ]
