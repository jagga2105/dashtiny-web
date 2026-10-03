from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from app.services.providers.base import FlightProvider, HotelProvider, ActivityProvider


class CuratedFlightProvider(FlightProvider):
    """
    Curated adapter representing standardized flight offers with explicit CURATED provenance.
    Never labeled as live provider inventory.
    """
    def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: Optional[str] = None,
        return_date: Optional[str] = None,
        passengers: int = 1,
        cabin_class: str = "economy",
        trip_type: str = "roundtrip"
    ) -> List[Dict[str, Any]]:
        origin_clean = origin.upper().strip() if origin else ""
        dest_clean = destination.upper().strip() if destination else ""
        if not origin_clean or not dest_clean:
            return []

        num_pax = max(1, passengers or 1)
        cabin = (cabin_class or "economy").lower()
        is_roundtrip = (trip_type or "roundtrip").lower() == "roundtrip"

        cabin_multiplier = 2.4 if cabin == "business" else (1.4 if cabin == "premium" else 1.0)
        trip_multiplier = 1.85 if is_roundtrip else 1.0

        now_utc = datetime.now(timezone.utc)
        retrieved_at = now_utc.isoformat()
        expires_at = (now_utc + timedelta(hours=2)).isoformat()

        base_corridors = [
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
                "deep_link": "https://www.akasaair.com",
                "why_recommended": "Lowest base fare on this corridor, arriving right before sunset"
            }
        ]

        offers = []
        for b in base_corridors:
            calculated_total = float(round(b["base_fare"] * cabin_multiplier * trip_multiplier * num_pax))
            per_pax = float(round(calculated_total / num_pax))
            offer_id = f"fl_{origin_clean[:3]}_{dest_clean[:3]}_{b['suffix']}"

            offers.append({
                "offer_id": offer_id,
                "id": offer_id,
                "provider": b["provider"],
                "flight_number": b["flight_number"],
                "origin": origin_clean,
                "destination": dest_clean,
                "departure_date": departure_date or "Upcoming",
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
                "trip_type": "roundtrip" if is_roundtrip else "oneway",
                "currency": "INR",
                "baggage": b["baggage"],
                "cancellation": b["cancellation"],
                "availability_state": "ESTIMATED",
                "provenance": "CURATED",
                "source": "CURATED_DATABASE",
                "retrieved_at": retrieved_at,
                "expires_at": expires_at,
                "deep_link": b["deep_link"],
                "why_recommended": b["why_recommended"]
            })

        return offers


class CuratedHotelProvider(HotelProvider):
    """
    Curated adapter representing standardized hotel offers with explicit CURATED provenance.
    Never labeled as live provider inventory.
    """
    def search_hotels(
        self,
        destination: str,
        guests: int = 2,
        check_in: Optional[str] = None,
        check_out: Optional[str] = None,
        room_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        dest_clean = destination.strip() if destination else ""
        if not dest_clean:
            return []

        now_utc = datetime.now(timezone.utc)
        retrieved_at = now_utc.isoformat()
        expires_at = (now_utc + timedelta(hours=4)).isoformat()

        dest_lower = dest_clean.lower()
        if "goa" in dest_lower:
            stays = [
                {
                    "id": "ht_goa_01",
                    "name": "W Goa Beachfront Villa Resort",
                    "provider": "Booking.com Partner",
                    "rating": 4.8,
                    "review_count": 890,
                    "price_per_night": 14500,
                    "room_type": "Ocean View Villa Suite",
                    "amenities": ["Direct Beach Access", "Infinity Pool", "Ayurvedic Spa", "Breakfast Included"],
                    "cancellation": "Free cancellation up to 48 hours before check-in",
                    "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop&q=80",
                    "deep_link": "https://www.booking.com",
                    "why_recommended": "Prime Vagator sunset view with world-class wellness amenities"
                },
                {
                    "id": "ht_goa_02",
                    "name": "Heritage Portuguese Villa by Ahilya",
                    "provider": "Airbnb Superhost",
                    "rating": 4.9,
                    "review_count": 340,
                    "price_per_night": 8200,
                    "room_type": "Heritage 2-Bedroom Courtyard",
                    "amenities": ["Private Plunge Pool", "Chef On Demand", "High-Speed WiFi", "Lush Garden"],
                    "cancellation": "Moderate cancellation policy",
                    "image": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80",
                    "deep_link": "https://www.airbnb.com",
                    "why_recommended": "Authentic 19th century Goan colonial charm in peaceful Assagao"
                }
            ]
        elif "japan" in dest_lower or "tokyo" in dest_lower or "kyoto" in dest_lower:
            stays = [
                {
                    "id": "ht_jp_01",
                    "name": "Hoshinoya Kyoto Traditional Ryokan",
                    "provider": "Agoda Luxury",
                    "rating": 4.95,
                    "review_count": 620,
                    "price_per_night": 32000,
                    "room_type": "Riverside Tatami Pavilion",
                    "amenities": ["Private Onsen", "Kaiseki Dining", "River Boat Arrival", "Zen Garden"],
                    "cancellation": "Strict cancellation policy",
                    "image": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80",
                    "deep_link": "https://www.agoda.com",
                    "why_recommended": "Sanctuary reachable only by wooden boat along Oi River in Arashiyama"
                },
                {
                    "id": "ht_jp_02",
                    "name": "Ace Hotel Kyoto",
                    "provider": "Booking.com Direct",
                    "rating": 4.7,
                    "review_count": 1120,
                    "price_per_night": 16500,
                    "room_type": "Historic Building King Room",
                    "amenities": ["Kengo Kuma Architecture", "Rooftop Bar", "Stumptown Coffee", "Bicycle Rental"],
                    "cancellation": "Free cancellation up to 24 hours before check-in",
                    "image": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80",
                    "deep_link": "https://www.booking.com",
                    "why_recommended": "Blend of traditional Japanese craft and contemporary boutique aesthetic"
                }
            ]
        else:
            stays = [
                {
                    "id": f"ht_{dest_clean[:3].lower()}_01",
                    "name": f"The Grand Palace {dest_clean}",
                    "provider": "Booking.com Partner",
                    "rating": 4.7,
                    "review_count": 480,
                    "price_per_night": 7500,
                    "room_type": "Deluxe King City View",
                    "amenities": ["Central Location", "Swimming Pool", "Complimentary Breakfast", "Free Cancellation"],
                    "cancellation": "Free cancellation within 48 hours",
                    "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80",
                    "deep_link": "https://www.booking.com",
                    "why_recommended": f"Centrally located near top cultural landmarks in {dest_clean}"
                }
            ]

        results = []
        for s in stays:
            results.append({
                "offer_id": s["id"],
                "id": s["id"],
                "name": s["name"],
                "provider": s["provider"],
                "destination": dest_clean,
                "price": float(s["price_per_night"]),
                "price_per_night": float(s["price_per_night"]),
                "currency": "INR",
                "rating": s["rating"],
                "review_count": s["review_count"],
                "room_type": s["room_type"],
                "amenities": s["amenities"],
                "cancellation": s["cancellation"],
                "image": s["image"],
                "availability_state": "ESTIMATED",
                "provenance": "CURATED",
                "source": "CURATED_DATABASE",
                "retrieved_at": retrieved_at,
                "expires_at": expires_at,
                "deep_link": s["deep_link"],
                "why_recommended": s["why_recommended"]
            })

        return results


class CuratedActivityProvider(ActivityProvider):
    """
    Curated adapter representing standardized experience offers with explicit CURATED provenance.
    """
    def search_activities(
        self,
        destination: str,
        category: Optional[str] = None,
        date: Optional[str] = None,
        guests: int = 1
    ) -> List[Dict[str, Any]]:
        dest_clean = destination.strip() if destination else ""
        if not dest_clean:
            return []

        now_utc = datetime.now(timezone.utc)
        retrieved_at = now_utc.isoformat()
        expires_at = (now_utc + timedelta(hours=6)).isoformat()

        activities = [
            {
                "offer_id": f"act_{dest_clean[:3].lower()}_01",
                "id": f"act_{dest_clean[:3].lower()}_01",
                "title": f"Guided Heritage & Street Food Discovery in {dest_clean}",
                "provider": "Viator Local Experiences",
                "category": category or "Food & Culture",
                "duration": "3 hours",
                "price": 1800.0 * max(1, guests),
                "currency": "INR",
                "availability_state": "AVAILABLE",
                "provenance": "CURATED",
                "source": "CURATED_DATABASE",
                "retrieved_at": retrieved_at,
                "expires_at": expires_at,
                "deep_link": "https://www.viator.com",
                "why_recommended": "Small-group intimate experience with a verified local historian"
            }
        ]
        return activities
