"""
Restaurant & Culinary Search Tool
Normalizes dining recommendations with coordinates, meal types, and dietary options.
"""
from typing import List, Dict, Any

def search_restaurants(destination: str, meal_type: str = "dinner", dietary: str = None) -> List[Dict[str, Any]]:
    """
    Returns curated gastronomic spots with provenance and location coordinates.
    """
    dest_lower = destination.lower() if destination else "goa"
    
    if "manali" in dest_lower:
        return [
            {
                "name": "Cafe 1947",
                "cuisine": "Woodfired Italian & Trout",
                "location": "Old Manali Riverside",
                "lat": 32.257,
                "lng": 77.183,
                "price_level": "₹₹",
                "avg_cost_for_two": 1400,
                "provenance": "CURATED",
                "why_recommended": "Riverside stone patio with bubbling Beas river waters and live acoustic sets"
            },
            {
                "name": "Johnson's Cafe & Bar",
                "cuisine": "Baked Trout & Continental",
                "location": "Circuit House Road, Manali",
                "lat": 32.247,
                "lng": 77.187,
                "price_level": "₹₹₹",
                "avg_cost_for_two": 1800,
                "provenance": "CURATED",
                "why_recommended": "Legendary fresh Himalayan trout recipes in an emerald garden lawn"
            }
        ]

    return [
        {
            "name": "The Fisherman's Wharf",
            "cuisine": "Authentic Goan Seafood & Coastal Curries",
            "location": "Cavelossim Riverside, South Goa",
            "lat": 15.176,
            "lng": 73.948,
            "price_level": "₹₹₹",
            "avg_cost_for_two": 2200,
            "provenance": "CURATED",
            "why_recommended": "Scenic riverfront deck serving crab xec-xec and kingfish peri-peri"
        },
        {
            "name": "Gunpowder",
            "cuisine": "Peninsular Coastal Delights & Malabar Parottas",
            "location": "Assagao, North Goa",
            "lat": 15.589,
            "lng": 73.782,
            "price_level": "₹₹",
            "avg_cost_for_two": 1600,
            "provenance": "CURATED",
            "why_recommended": "Atmospheric courtyard dining inside an ancient Portuguese heritage home"
        },
        {
            "name": "Olive Bar & Kitchen Cliff",
            "cuisine": "Mediterranean Sunset Tapas & Cocktails",
            "location": "Vagator Cliff, North Goa",
            "lat": 15.598,
            "lng": 73.737,
            "price_level": "₹₹₹₹",
            "avg_cost_for_two": 3200,
            "provenance": "CURATED",
            "why_recommended": "Premier sunset cliff panorama with Aegean white-stone arches and chill house music"
        }
    ]
