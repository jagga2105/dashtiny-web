import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from app.schemas.flight import FlightOffer, FlightSegment
from app.services.providers.base import FlightProvider, HotelProvider, ActivityProvider
from app.db.database import SessionLocal
from app.models.models import Airport


# Estimated standard non-stop duration in minutes between major corridors
CORRIDOR_DURATIONS: Dict[str, int] = {
    "DEL_BOM": 130, "BOM_DEL": 125,
    "DEL_BLR": 165, "BLR_DEL": 160,
    "DEL_GOI": 155, "GOI_DEL": 150,
    "DEL_GOX": 150, "GOX_DEL": 145,
    "BOM_GOI": 75,  "GOI_BOM": 75,
    "BOM_GOX": 70,  "GOX_BOM": 70,
    "BLR_GOI": 75,  "GOI_BLR": 75,
    "BLR_BOM": 100, "BOM_BLR": 100,
    "DEL_CCU": 135, "CCU_DEL": 135,
    "DEL_HYD": 130, "HYD_DEL": 125,
    "DEL_MAA": 170, "MAA_DEL": 165,
    "DEL_COK": 195, "COK_DEL": 190,
    "DEL_AMD": 95,  "AMD_DEL": 90,
    "DEL_PNQ": 125, "PNQ_DEL": 120,
    "DEL_JAI": 60,  "JAI_DEL": 60,
    "DEL_IXC": 55,  "IXC_DEL": 55,
    "DEL_SXR": 90,  "SXR_DEL": 85,
    "DEL_DXB": 240, "DXB_DEL": 225,
    "DEL_SIN": 330, "SIN_DEL": 345,
    "DEL_LHR": 550, "LHR_DEL": 510,
    "DEL_BKK": 255, "BKK_DEL": 270,
}


def _resolve_airport_ref(iata: str, db: Optional[Any] = None) -> Optional[Dict[str, str]]:
    """
    Resolves airport authority strictly from canonical PostgreSQL Airport domain.
    Never uses hardcoded aliases or secondary runtime registries.
    """
    clean = iata.upper().strip() if iata else ""
    if not clean:
        return None

    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        airport = db.query(Airport).filter(Airport.iata_code == clean).first()
        if airport:
            return {
                "code": airport.iata_code,
                "name": airport.name,
                "city": airport.city,
                "country": airport.country or "India"
            }
        return None
    except Exception:
        return None
    finally:
        if close_db and db:
            db.close()


def generate_deterministic_offer_id(
    provider: str,
    airline: str,
    flight_number: str,
    origin: str,
    destination: str,
    departure_date: str,
    return_date: Optional[str],
    cabin_class: str,
    passengers: int,
    trip_type: str,
    blueprint_suffix: str
) -> str:
    """
    Deterministic hashing of complete offer identity across search contexts.
    
    CRITICAL ARCHITECTURAL SEMANTICS:
    offer_id = deterministic quote identity (a specific quoted search result matching route,
    dates, passenger count, cabin class, trip type, and inventory blueprint).
    offer_id != permanent physical flight identity (physical aircraft, tail number, or route).
    
    Guarantees:
    - Same exact search context -> same offer_id
    - Different departure date -> different offer_id
    - Different return date -> different offer_id
    - Different cabin -> different offer_id
    - Different passengers -> different offer_id
    - Different trip type -> different offer_id
    """
    raw_seed = (
        f"{provider.strip()}|{airline.strip()}|{flight_number.strip()}|"
        f"{origin.strip().upper()}|{destination.strip().upper()}|"
        f"{departure_date.strip()}|{(return_date or '').strip()}|"
        f"{cabin_class.strip().lower()}|{passengers}|{trip_type.strip().lower()}|"
        f"{blueprint_suffix.strip()}"
    )
    digest = hashlib.sha256(raw_seed.encode("utf-8")).hexdigest()[:16]
    return f"fl_{digest}"


def _format_time_with_duration(base_time_str: str, duration_mins: int) -> str:
    """Calculates arrival time string (e.g. '08:35 AM') from departure time and duration."""
    try:
        t = datetime.strptime(base_time_str, "%I:%M %p")
        arr = t + timedelta(minutes=duration_mins)
        return arr.strftime("%I:%M %p")
    except Exception as e:
        raise ValueError(f"Invalid departure time format: '{base_time_str}'") from e


def _stable_hash_int(seed: str, modulo: int) -> int:
    """Deterministic positive integer from sha256 hash across process restarts."""
    h = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(h[:8], 16) % modulo


def _calculate_arrival_date(dep_date_str: str, dep_time_str: str, duration_mins: int) -> str:
    """Calculates arrival date string (YYYY-MM-DD) from departure date and duration."""
    try:
        dt = datetime.strptime(f"{dep_date_str} {dep_time_str}", "%Y-%m-%d %I:%M %p")
        arr_dt = dt + timedelta(minutes=duration_mins)
        return arr_dt.strftime("%Y-%m-%d")
    except Exception as e:
        raise ValueError(f"Invalid departure date/time format: '{dep_date_str} {dep_time_str}'") from e


class CuratedFlightProvider(FlightProvider):
    """
    Curated adapter representing standardized flight offers with explicit CURATED provenance.
    Synthesizes deterministic, reference airline catalog offers.
    Adheres strictly to current-date airline safety (IndiGo, Air India, Air India Express, Akasa Air, SpiceJet).
    Never exposes defunct carriers (Vistara, Go First).
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
        trip_type: str = "roundtrip",
        db: Optional[Any] = None
    ) -> List[FlightOffer]:
        origin_clean = origin.upper().strip() if origin else ""
        dest_clean = destination.upper().strip() if destination else ""
        if not origin_clean or not dest_clean or origin_clean == dest_clean:
            return []

        # Resolve airport information strictly using canonical PostgreSQL Airport domain
        origin_info = _resolve_airport_ref(origin_clean, db)
        dest_info = _resolve_airport_ref(dest_clean, db)

        # If airport is not recognized in canonical database, return empty results
        if not origin_info or not dest_info:
            return []

        num_pax = max(1, min(9, passengers or 1))
        cabin = (cabin_class or "economy").lower()
        if cabin == "premium":
            cabin = "premium_economy"
        is_roundtrip = (trip_type or "roundtrip").lower() == "roundtrip"

        # Search request validation owns required values; provider must never invent dates
        if not departure_date:
            return []

        if is_roundtrip and not return_date:
            return []

        effective_dep_date = departure_date
        effective_return_date = return_date if is_roundtrip else None

        cabin_multiplier = {
            "economy": 1.0,
            "premium_economy": 1.45,
            "business": 2.5,
            "first": 3.8
        }.get(cabin, 1.0)
        trip_multiplier = 1.85 if is_roundtrip else 1.0

        now_utc = datetime.now(timezone.utc)
        retrieved_at = now_utc.isoformat()
        expires_at = (now_utc + timedelta(hours=2)).isoformat()

        # Determine corridor duration and base fare
        origin_code = origin_info.get("code", origin_clean)
        dest_code = dest_info.get("code", dest_clean)
        corridor_key = f"{origin_code}_{dest_code}"

        # P0: Unsupported corridor -> return [] without synthesizing fake durations.
        if corridor_key not in CORRIDOR_DURATIONS:
            return []

        base_duration = CORRIDOR_DURATIONS[corridor_key]

        # For round-trip, ensure return corridor is also supported
        ret_corridor_key = f"{dest_code}_{origin_code}"
        if is_roundtrip and ret_corridor_key not in CORRIDOR_DURATIONS:
            return []

        ret_base_duration = CORRIDOR_DURATIONS.get(ret_corridor_key, base_duration) if is_roundtrip else 0
        
        # Base fare calculation anchored in duration
        base_corridor_fare = max(2800, int(base_duration * 28 + 400))

        # 5 Contemporary Indian & Regional Carriers (Normalized provider identity)
        catalog_blueprints = [
            {
                "suffix": "01",
                "airline": "IndiGo",
                "provider": "DashTiny Curated Catalog",
                "flight_number": f"6E-{2000 + _stable_hash_int(corridor_key + '_1', 800)}",
                "dep_time": "06:15 AM",
                "ret_dep_time": "06:20 PM",
                "stops": 0,
                "layover": 0,
                "base_fare": base_corridor_fare + 250,
                "baggage": "15kg Checked • 7kg Cabin" if cabin == "economy" else "30kg Checked • 10kg Cabin",
                "cancellation": "Free cancellation within 24 hours of booking",
                "deep_link": "https://www.goindigo.in",
                "why_recommended": "Direct morning flight under 3 hours" if base_duration <= 180 else "Direct morning flight"
            },
            {
                "suffix": "02",
                "airline": "Air India",
                "provider": "DashTiny Curated Catalog",
                "flight_number": f"AI-{800 + _stable_hash_int(corridor_key + '_2', 150)}",
                "dep_time": "10:30 AM",
                "ret_dep_time": "02:15 PM",
                "stops": 0,
                "layover": 0,
                "base_fare": base_corridor_fare + 750,
                "baggage": "20kg Checked • 7kg Cabin" if cabin == "economy" else "35kg Checked • 12kg Cabin • Lounge Access",
                "cancellation": "Refundable with nominal partner fee",
                "deep_link": "https://www.airindia.com",
                "why_recommended": "Direct flight with 20kg checked baggage included"
            },
            {
                "suffix": "03",
                "airline": "Akasa Air",
                "provider": "DashTiny Curated Catalog",
                "flight_number": f"QP-{1300 + _stable_hash_int(corridor_key + '_3', 200)}",
                "dep_time": "03:45 PM",
                "ret_dep_time": "08:10 PM",
                "stops": 0,
                "layover": 0,
                "base_fare": max(2600, base_corridor_fare - 350),
                "baggage": "15kg Checked • 7kg Cabin • USB port charging",
                "cancellation": "Standard fee applies",
                "deep_link": "https://www.akasaair.com",
                "why_recommended": "Lowest fare among current catalog options"
            },
            {
                "suffix": "04",
                "airline": "SpiceJet",
                "provider": "DashTiny Curated Catalog",
                "flight_number": f"SG-{350 + _stable_hash_int(corridor_key + '_4', 300)}",
                "dep_time": "12:40 PM",
                "ret_dep_time": "05:45 PM",
                "stops": 1,
                "layover": 50,
                "base_fare": max(2400, base_corridor_fare - 500),
                "baggage": "15kg Checked • 7kg Cabin",
                "cancellation": "Standard airline terms apply",
                "deep_link": "https://www.spicejet.com",
                "why_recommended": "Connecting option with single stop"
            },
            {
                "suffix": "05",
                "airline": "Air India Express",
                "provider": "DashTiny Curated Catalog",
                "flight_number": f"IX-{1100 + _stable_hash_int(corridor_key + '_5', 250)}",
                "dep_time": "07:15 PM",
                "ret_dep_time": "10:30 PM",
                "stops": 0,
                "layover": 0,
                "base_fare": base_corridor_fare + 100,
                "baggage": "15kg Checked • 7kg Cabin" if cabin == "economy" else "30kg Checked • 10kg Cabin",
                "cancellation": "Partially refundable",
                "deep_link": "https://www.airindiaexpress.com",
                "why_recommended": "Direct evening flight"
            }
        ]

        offers: List[FlightOffer] = []
        for b in catalog_blueprints:
            dur_mins = base_duration + (b["layover"] if b["stops"] > 0 else 0)
            arr_time = _format_time_with_duration(b["dep_time"], dur_mins)
            arr_date = _calculate_arrival_date(effective_dep_date, b["dep_time"], dur_mins)
            
            calculated_total = float(round(b["base_fare"] * cabin_multiplier * trip_multiplier * num_pax))
            per_pax = float(round(calculated_total / num_pax))
            
            offer_id = generate_deterministic_offer_id(
                provider=b["provider"],
                airline=b["airline"],
                flight_number=b["flight_number"],
                origin=origin_clean,
                destination=dest_clean,
                departure_date=effective_dep_date,
                return_date=effective_return_date,
                cabin_class=cabin,
                passengers=num_pax,
                trip_type="roundtrip" if is_roundtrip else "oneway",
                blueprint_suffix=b["suffix"]
            )

            stop_details = []
            if b["stops"] > 0:
                layover_hub = "HYD" if "HYD" not in (origin_clean, dest_clean) else "BOM"
                hub_info = _resolve_airport_ref(layover_hub, db)
                stop_details = [{
                    "airport": layover_hub,
                    "city": hub_info.get("city", layover_hub) if hub_info else layover_hub,
                    "duration_minutes": b["layover"]
                }]

            outbound_segment = FlightSegment(
                origin=origin_clean,
                destination=dest_clean,
                departure_date=effective_dep_date,
                departure_time=b["dep_time"],
                arrival_date=arr_date,
                arrival_time=arr_time,
                duration_minutes=dur_mins,
                stops=b["stops"],
                stop_details=stop_details,
                flight_number=b["flight_number"],
                airline=b["airline"]
            )

            inbound_segment = None
            if is_roundtrip and effective_return_date:
                ret_dur_mins = ret_base_duration + (b["layover"] if b["stops"] > 0 else 0)
                ret_dep_time = b.get("ret_dep_time", "06:20 PM")
                ret_arr_time = _format_time_with_duration(ret_dep_time, ret_dur_mins)
                ret_arr_date = _calculate_arrival_date(effective_return_date, ret_dep_time, ret_dur_mins)
                ret_stop_details = []
                if b["stops"] > 0:
                    ret_layover_hub = "HYD" if "HYD" not in (origin_clean, dest_clean) else "BOM"
                    ret_hub_info = _resolve_airport_ref(ret_layover_hub, db)
                    ret_stop_details = [{
                        "airport": ret_layover_hub,
                        "city": ret_hub_info.get("city", ret_layover_hub) if ret_hub_info else ret_layover_hub,
                        "duration_minutes": b["layover"]
                    }]
                
                # Canonical inbound return flight identity
                fn_digits = ''.join(c for c in b["flight_number"] if c.isdigit())
                fn_prefix = ''.join(c for c in b["flight_number"] if not c.isdigit())
                ret_flight_num = f"{fn_prefix}{int(fn_digits) + 1}" if fn_digits else f"{b['flight_number']}-R"

                inbound_segment = FlightSegment(
                    origin=dest_clean,
                    destination=origin_clean,
                    departure_date=effective_return_date,
                    departure_time=ret_dep_time,
                    arrival_date=ret_arr_date,
                    arrival_time=ret_arr_time,
                    duration_minutes=ret_dur_mins,
                    stops=b["stops"],
                    stop_details=ret_stop_details,
                    flight_number=ret_flight_num,
                    airline=b["airline"]
                )

            offers.append(FlightOffer(
                offer_id=offer_id,
                provider=b["provider"],
                airline=b["airline"],
                flight_number=b["flight_number"],
                origin=origin_clean,
                destination=dest_clean,
                origin_airport=origin_info,
                destination_airport=dest_info,
                departure_date=effective_dep_date,
                return_date=effective_return_date if is_roundtrip else None,
                departure_time=b["dep_time"],
                arrival_time=arr_time,
                duration_minutes=dur_mins,
                stops=b["stops"],
                stop_details=stop_details,
                passengers=num_pax,
                cabin_class=cabin,
                trip_type="roundtrip" if is_roundtrip else "oneway",
                price=calculated_total,
                per_passenger_price=per_pax,
                currency="INR",
                baggage=b["baggage"],
                cancellation=b["cancellation"],
                availability_state="ESTIMATED",
                provenance="CURATED",
                source="CURATED_DATABASE",
                retrieved_at=retrieved_at,
                expires_at=expires_at,
                deep_link=b["deep_link"],
                why_recommended=b["why_recommended"],
                outbound=outbound_segment,
                inbound=inbound_segment
            ))

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

        clean_guests = max(1, guests or 2)
        nights = 1
        if check_in and check_out:
            try:
                d_in = datetime.fromisoformat(str(check_in).strip().split('T')[0])
                d_out = datetime.fromisoformat(str(check_out).strip().split('T')[0])
                delta = (d_out - d_in).days
                if delta > 0:
                    nights = delta
            except Exception:
                nights = 1

        results = []
        for s in stays:
            r_type = s["room_type"]
            if room_type:
                r_type = f"{room_type} — {s['room_type']}"
            price_night = float(s["price_per_night"])
            total_price = price_night * nights

            results.append({
                "offer_id": s["id"],
                "id": s["id"],
                "name": s["name"],
                "provider": s["provider"],
                "destination": dest_clean,
                "price": total_price,
                "price_per_night": price_night,
                "nightly_rate": price_night,
                "total_price": total_price,
                "total_amount": total_price,
                "currency": "INR",
                "rating": s["rating"],
                "review_count": s["review_count"],
                "room_type": r_type,
                "guests_capacity": clean_guests,
                "check_in": str(check_in) if check_in else None,
                "check_out": str(check_out) if check_out else None,
                "nights": nights,
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
