"""
Flight Search Tool - Aggregation & Normalization Layer
Normalizes offers across Skyscanner, IndiGo, Air India, Akasa into FlightOffer schema.
"""
from typing import List, Dict, Any

def search_flights(
    origin: str = "BLR",
    destination: str = "GOI",
    date: str = None,
    return_date: str = None,
    passengers: int = 1,
    cabin_class: str = "economy",
    trip_type: str = "roundtrip"
) -> List[Dict[str, Any]]:
    """
    Search and normalize flight inventory.
    Returns list of FlightOffer objects with CURATED/DEMO provenance.
    Scales pricing and terms based on passengers, cabin class, and trip type.
    """
    origin_clean = origin.upper().strip() if origin else "BLR"
    dest_clean = destination.upper().strip() if destination else "GOI"
    num_pax = max(1, passengers or 1)
    cabin = (cabin_class or "economy").lower()
    is_roundtrip = (trip_type or "roundtrip").lower() == "roundtrip"

    # Multipliers
    cabin_multiplier = 2.4 if cabin == "business" else (1.4 if cabin == "premium" else 1.0)
    trip_multiplier = 1.85 if is_roundtrip else 1.0

    # Base curated corridor offers
    base_offers = [
        {
            "suffix": "01",
            "provider": "IndiGo Premier",
            "flight_number": "6E-534",
            "departure_time": "06:15 AM",
            "arrival_time": "07:30 AM",
            "duration": "1h 15m (Non-stop)",
            "duration_minutes": 75,
            "stops": 0,
            "base_fare": 3450,
            "baggage": "15kg Checked • 7kg Cabin" if cabin == "economy" else "30kg Checked • 10kg Cabin",
            "cancellation": "Free cancellation within 24 hours",
            "provenance": "CURATED",
            "deep_link": "https://www.goindigo.in",
            "why_recommended": "Morning direct flight with early arrival at destination"
        },
        {
            "suffix": "02",
            "provider": "Air India Express",
            "flight_number": "AI-802",
            "departure_time": "10:45 AM",
            "arrival_time": "12:10 PM",
            "duration": "1h 25m (Non-stop)",
            "duration_minutes": 85,
            "stops": 0,
            "base_fare": 4120,
            "baggage": "20kg Checked • Priority Boarding" if cabin == "economy" else "35kg Checked • Lounge Access",
            "cancellation": "Partially refundable",
            "provenance": "CURATED",
            "deep_link": "https://www.airindia.com",
            "why_recommended": "Generous luggage allowance and comfortable mid-day timing"
        },
        {
            "suffix": "03",
            "provider": "Akasa Air Getaway",
            "flight_number": "QP-1310",
            "departure_time": "04:30 PM",
            "arrival_time": "05:45 PM",
            "duration": "1h 15m (Non-stop)",
            "duration_minutes": 75,
            "stops": 0,
            "base_fare": 2890,
            "baggage": "15kg Checked • USB port charging",
            "cancellation": "Standard fee applies",
            "provenance": "CURATED",
            "deep_link": "https://www.akasaair.com",
            "why_recommended": "Lowest base fare on this corridor, arriving right before sunset"
        }
    ]

    offers = []
    for b in base_offers:
        calculated_total = int(round(b["base_fare"] * cabin_multiplier * trip_multiplier * num_pax))
        per_pax = int(round(calculated_total / num_pax))
        offers.append({
            "id": f"fl_{origin_clean[:3]}_{dest_clean[:3]}_{b['suffix']}",
            "provider": b["provider"],
            "flight_number": b["flight_number"],
            "origin": origin_clean,
            "destination": dest_clean,
            "departure_date": date or "Upcoming",
            "return_date": return_date if is_roundtrip else None,
            "departure_time": b["departure_time"],
            "arrival_time": b["arrival_time"],
            "duration": b["duration"],
            "duration_minutes": b["duration_minutes"],
            "stops": b["stops"],
            "price": calculated_total,
            "per_passenger_price": per_pax,
            "passengers": num_pax,
            "cabin_class": cabin,
            "trip_type": trip_type,
            "currency": "INR",
            "baggage": b["baggage"],
            "cancellation": b["cancellation"],
            "provenance": b["provenance"],
            "deep_link": b["deep_link"],
            "why_recommended": b["why_recommended"]
        })

    return offers
