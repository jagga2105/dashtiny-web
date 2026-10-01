"""
Flight Search Tool - Aggregation & Normalization Layer
Normalizes offers across Skyscanner, IndiGo, Air India, Akasa into FlightOffer schema.
"""
from typing import List, Dict, Any

def search_flights(origin: str, destination: str, date: str = None) -> List[Dict[str, Any]]:
    """
    Search and normalize flight inventory.
    Returns list of FlightOffer objects with CURATED/DEMO provenance.
    """
    origin_clean = origin.upper() if origin else "BLR"
    dest_clean = destination.upper() if destination else "GOI"
    
    # Curated corridor inventory matrix
    offers = [
        {
            "id": f"fl_{origin_clean[:3]}_{dest_clean[:3]}_01",
            "provider": "IndiGo Premier",
            "flight_number": "6E-534",
            "origin": origin_clean,
            "destination": dest_clean,
            "departure_time": "06:15 AM",
            "arrival_time": "07:30 AM",
            "duration": "1h 15m (Non-stop)",
            "stops": 0,
            "price": 3450,
            "currency": "INR",
            "baggage": "15kg Checked • 7kg Cabin",
            "cancellation": "Free cancellation within 24 hours",
            "provenance": "CURATED",
            "deep_link": "https://www.goindigo.in",
            "why_recommended": "Fastest morning direct flight with high on-time reliability"
        },
        {
            "id": f"fl_{origin_clean[:3]}_{dest_clean[:3]}_02",
            "provider": "Air India Express",
            "flight_number": "AI-802",
            "origin": origin_clean,
            "destination": dest_clean,
            "departure_time": "10:45 AM",
            "arrival_time": "12:10 PM",
            "duration": "1h 25m (Non-stop)",
            "stops": 0,
            "price": 4120,
            "currency": "INR",
            "baggage": "20kg Checked • Lounge Access eligible",
            "cancellation": "Partially refundable",
            "provenance": "CURATED",
            "deep_link": "https://www.airindia.com",
            "why_recommended": "Generous luggage allowance and comfortable mid-day timing"
        },
        {
            "id": f"fl_{origin_clean[:3]}_{dest_clean[:3]}_03",
            "provider": "Akasa Air Getaway",
            "flight_number": "QP-1310",
            "origin": origin_clean,
            "destination": dest_clean,
            "departure_time": "04:30 PM",
            "arrival_time": "05:45 PM",
            "duration": "1h 15m (Non-stop)",
            "stops": 0,
            "price": 2890,
            "currency": "INR",
            "baggage": "15kg Checked • USB port charging",
            "cancellation": "Standard fee applies",
            "provenance": "CURATED",
            "deep_link": "https://www.akasaair.com",
            "why_recommended": "Lowest fare on this corridor, arriving right before sunset"
        }
    ]
    return offers
