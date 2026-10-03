"""
Airport Data Seeder (backend/app/db/seed_airports.py)
Seeds canonical Indian and international airports into PostgreSQL airports table.
Cleans legacy airport data (rejecting unassigned IATA codes) and populates search_text for fast prefix/substring search.
"""
import json
import os
import uuid
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import Airport


CANONICAL_AIRPORTS: List[Dict[str, Any]] = [
    # Top Tier Indian Hubs & Destinations
    {"iata_code": "DEL", "icao_code": "VIDP", "name": "Indira Gandhi International Airport", "city": "Delhi", "state_region": "Delhi", "country": "India", "country_code": "IN", "latitude": 28.5562, "longitude": 77.1000, "timezone": "Asia/Kolkata"},
    {"iata_code": "BOM", "icao_code": "VABB", "name": "Chhatrapati Shivaji Maharaj International Airport", "city": "Mumbai", "state_region": "Maharashtra", "country": "India", "country_code": "IN", "latitude": 19.0896, "longitude": 72.8656, "timezone": "Asia/Kolkata"},
    {"iata_code": "BLR", "icao_code": "VOBL", "name": "Kempegowda International Airport", "city": "Bengaluru", "state_region": "Karnataka", "country": "India", "country_code": "IN", "latitude": 13.1986, "longitude": 77.7066, "timezone": "Asia/Kolkata"},
    {"iata_code": "GOI", "icao_code": "VAGO", "name": "Dabolim Airport / Manohar International", "city": "Goa", "state_region": "Goa", "country": "India", "country_code": "IN", "latitude": 15.3808, "longitude": 73.8314, "timezone": "Asia/Kolkata"},
    {"iata_code": "GOX", "icao_code": "VOGA", "name": "Manohar International Airport (Mopa)", "city": "Goa", "state_region": "Goa", "country": "India", "country_code": "IN", "latitude": 15.7486, "longitude": 73.8744, "timezone": "Asia/Kolkata"},
    {"iata_code": "HYD", "icao_code": "VOHS", "name": "Rajiv Gandhi International Airport", "city": "Hyderabad", "state_region": "Telangana", "country": "India", "country_code": "IN", "latitude": 17.2403, "longitude": 78.4294, "timezone": "Asia/Kolkata"},
    {"iata_code": "MAA", "icao_code": "VOMM", "name": "Chennai International Airport", "city": "Chennai", "state_region": "Tamil Nadu", "country": "India", "country_code": "IN", "latitude": 12.9941, "longitude": 80.1709, "timezone": "Asia/Kolkata"},
    {"iata_code": "CCU", "icao_code": "VECC", "name": "Netaji Subhash Chandra Bose International Airport", "city": "Kolkata", "state_region": "West Bengal", "country": "India", "country_code": "IN", "latitude": 22.6547, "longitude": 88.4467, "timezone": "Asia/Kolkata"},
    {"iata_code": "COK", "icao_code": "VOCI", "name": "Cochin International Airport", "city": "Kochi", "state_region": "Kerala", "country": "India", "country_code": "IN", "latitude": 10.1518, "longitude": 76.3930, "timezone": "Asia/Kolkata"},
    {"iata_code": "AMD", "icao_code": "VAAH", "name": "Sardar Vallabhbhai Patel International Airport", "city": "Ahmedabad", "state_region": "Gujarat", "country": "India", "country_code": "IN", "latitude": 23.0772, "longitude": 72.6347, "timezone": "Asia/Kolkata"},
    {"iata_code": "PNQ", "icao_code": "VAPO", "name": "Pune Airport", "city": "Pune", "state_region": "Maharashtra", "country": "India", "country_code": "IN", "latitude": 18.5822, "longitude": 73.9197, "timezone": "Asia/Kolkata"},
    {"iata_code": "JAI", "icao_code": "VIJP", "name": "Jaipur International Airport", "city": "Jaipur", "state_region": "Rajasthan", "country": "India", "country_code": "IN", "latitude": 26.8242, "longitude": 75.8122, "timezone": "Asia/Kolkata"},
    {"iata_code": "SXR", "icao_code": "VISR", "name": "Sheikh ul-Alam International Airport", "city": "Srinagar", "state_region": "Jammu & Kashmir", "country": "India", "country_code": "IN", "latitude": 33.9871, "longitude": 74.7741, "timezone": "Asia/Kolkata"},
    {"iata_code": "IXL", "icao_code": "VILH", "name": "Kushok Bakula Rimpochee Airport", "city": "Leh", "state_region": "Ladakh", "country": "India", "country_code": "IN", "latitude": 34.1359, "longitude": 77.5465, "timezone": "Asia/Kolkata"},
    {"iata_code": "UDR", "icao_code": "VAUD", "name": "Maharana Pratap Airport", "city": "Udaipur", "state_region": "Rajasthan", "country": "India", "country_code": "IN", "latitude": 24.6178, "longitude": 73.8961, "timezone": "Asia/Kolkata"},
    {"iata_code": "VNS", "icao_code": "VEBN", "name": "Lal Bahadur Shastri International Airport", "city": "Varanasi", "state_region": "Uttar Pradesh", "country": "India", "country_code": "IN", "latitude": 25.4524, "longitude": 82.8593, "timezone": "Asia/Kolkata"},
    {"iata_code": "DED", "icao_code": "VIDN", "name": "Jolly Grant Airport", "city": "Dehradun", "state_region": "Uttarakhand", "country": "India", "country_code": "IN", "latitude": 30.1897, "longitude": 78.1803, "timezone": "Asia/Kolkata"},
    {"iata_code": "KUU", "icao_code": "VIBR", "name": "Bhuntar Airport (Kullu Manali)", "city": "Kullu Manali", "state_region": "Himachal Pradesh", "country": "India", "country_code": "IN", "latitude": 31.8767, "longitude": 77.1542, "timezone": "Asia/Kolkata"},
    {"iata_code": "IXZ", "icao_code": "VOPB", "name": "Veer Savarkar International Airport", "city": "Port Blair", "state_region": "Andaman & Nicobar Islands", "country": "India", "country_code": "IN", "latitude": 11.6410, "longitude": 92.7297, "timezone": "Asia/Kolkata"},
    {"iata_code": "MYQ", "icao_code": "VOMY", "name": "Mysore Airport", "city": "Mysuru", "state_region": "Karnataka", "country": "India", "country_code": "IN", "latitude": 12.2300, "longitude": 76.6500, "timezone": "Asia/Kolkata"},
    {"iata_code": "IXC", "icao_code": "VICG", "name": "Shaheed Bhagat Singh International Airport", "city": "Chandigarh", "state_region": "Punjab", "country": "India", "country_code": "IN", "latitude": 30.6735, "longitude": 76.7885, "timezone": "Asia/Kolkata"},
    {"iata_code": "LKO", "icao_code": "VILK", "name": "Chaudhary Charan Singh International Airport", "city": "Lucknow", "state_region": "Uttar Pradesh", "country": "India", "country_code": "IN", "latitude": 26.7606, "longitude": 80.8893, "timezone": "Asia/Kolkata"},
    {"iata_code": "GAU", "icao_code": "VEGT", "name": "Lokpriya Gopinath Bordoloi International Airport", "city": "Guwahati", "state_region": "Assam", "country": "India", "country_code": "IN", "latitude": 26.1061, "longitude": 91.5859, "timezone": "Asia/Kolkata"},
    {"iata_code": "BBI", "icao_code": "VEBS", "name": "Biju Patnaik International Airport", "city": "Bhubaneswar", "state_region": "Odisha", "country": "India", "country_code": "IN", "latitude": 20.2444, "longitude": 85.8178, "timezone": "Asia/Kolkata"},
    {"iata_code": "TRV", "icao_code": "VOTV", "name": "Thiruvananthapuram International Airport", "city": "Thiruvananthapuram", "state_region": "Kerala", "country": "India", "country_code": "IN", "latitude": 8.4821, "longitude": 76.9200, "timezone": "Asia/Kolkata"},
    {"iata_code": "CCJ", "icao_code": "VOCL", "name": "Calicut International Airport", "city": "Kozhikode", "state_region": "Kerala", "country": "India", "country_code": "IN", "latitude": 11.1369, "longitude": 75.9553, "timezone": "Asia/Kolkata"},
    {"iata_code": "IXE", "icao_code": "VOML", "name": "Mangaluru International Airport", "city": "Mangaluru", "state_region": "Karnataka", "country": "India", "country_code": "IN", "latitude": 12.9613, "longitude": 74.8901, "timezone": "Asia/Kolkata"},
    {"iata_code": "IXR", "icao_code": "VERC", "name": "Birsa Munda Airport", "city": "Ranchi", "state_region": "Jharkhand", "country": "India", "country_code": "IN", "latitude": 23.3143, "longitude": 85.3217, "timezone": "Asia/Kolkata"},
    {"iata_code": "PAT", "icao_code": "VEPT", "name": "Jay Prakash Narayan Airport", "city": "Patna", "state_region": "Bihar", "country": "India", "country_code": "IN", "latitude": 25.5913, "longitude": 85.0880, "timezone": "Asia/Kolkata"},
    {"iata_code": "NAG", "icao_code": "VANP", "name": "Dr. Babasaheb Ambedkar International Airport", "city": "Nagpur", "state_region": "Maharashtra", "country": "India", "country_code": "IN", "latitude": 21.0922, "longitude": 79.0472, "timezone": "Asia/Kolkata"},
    {"iata_code": "IDR", "icao_code": "VAID", "name": "Devi Ahilya Bai Holkar Airport", "city": "Indore", "state_region": "Madhya Pradesh", "country": "India", "country_code": "IN", "latitude": 22.7217, "longitude": 75.8011, "timezone": "Asia/Kolkata"},
    {"iata_code": "BHO", "icao_code": "VABP", "name": "Raja Bhoj Airport", "city": "Bhopal", "state_region": "Madhya Pradesh", "country": "India", "country_code": "IN", "latitude": 23.2875, "longitude": 77.3378, "timezone": "Asia/Kolkata"},
    {"iata_code": "BDQ", "icao_code": "VABO", "name": "Vadodara Airport", "city": "Vadodara", "state_region": "Gujarat", "country": "India", "country_code": "IN", "latitude": 22.3362, "longitude": 73.2263, "timezone": "Asia/Kolkata"},
    {"iata_code": "STV", "icao_code": "VASU", "name": "Surat Airport", "city": "Surat", "state_region": "Gujarat", "country": "India", "country_code": "IN", "latitude": 21.1142, "longitude": 72.7419, "timezone": "Asia/Kolkata"},
    {"iata_code": "ATQ", "icao_code": "VIAR", "name": "Sri Guru Ram Dass Jee International Airport", "city": "Amritsar", "state_region": "Punjab", "country": "India", "country_code": "IN", "latitude": 31.7096, "longitude": 74.7973, "timezone": "Asia/Kolkata"},
    {"iata_code": "IXB", "icao_code": "VEBD", "name": "Bagdogra International Airport", "city": "Siliguri / Darjeeling", "state_region": "West Bengal", "country": "India", "country_code": "IN", "latitude": 26.6812, "longitude": 88.3286, "timezone": "Asia/Kolkata"},

    # Key International Hubs & Sanctuaries
    {"iata_code": "DXB", "icao_code": "OMDB", "name": "Dubai International Airport", "city": "Dubai", "state_region": "Dubai", "country": "United Arab Emirates", "country_code": "AE", "latitude": 25.2532, "longitude": 55.3657, "timezone": "Asia/Dubai"},
    {"iata_code": "SIN", "icao_code": "WSSS", "name": "Singapore Changi Airport", "city": "Singapore", "state_region": "Singapore", "country": "Singapore", "country_code": "SG", "latitude": 1.3644, "longitude": 103.9915, "timezone": "Asia/Singapore"},
    {"iata_code": "BKK", "icao_code": "VTBS", "name": "Suvarnabhumi Airport", "city": "Bangkok", "state_region": "Bangkok", "country": "Thailand", "country_code": "TH", "latitude": 13.6900, "longitude": 100.7501, "timezone": "Asia/Bangkok"},
    {"iata_code": "DPS", "icao_code": "WADD", "name": "Ngurah Rai International Airport", "city": "Bali", "state_region": "Bali", "country": "Indonesia", "country_code": "ID", "latitude": -8.7482, "longitude": 115.1672, "timezone": "Asia/Makassar"},
    {"iata_code": "HND", "icao_code": "RJTT", "name": "Tokyo Haneda Airport", "city": "Tokyo", "state_region": "Tokyo", "country": "Japan", "country_code": "JP", "latitude": 35.5494, "longitude": 139.7798, "timezone": "Asia/Tokyo"},
    {"iata_code": "NRT", "icao_code": "RJAA", "name": "Narita International Airport", "city": "Tokyo", "state_region": "Chiba", "country": "Japan", "country_code": "JP", "latitude": 35.7647, "longitude": 140.3863, "timezone": "Asia/Tokyo"},
    {"iata_code": "KIX", "icao_code": "RJBB", "name": "Kansai International Airport", "city": "Osaka / Kyoto", "state_region": "Osaka", "country": "Japan", "country_code": "JP", "latitude": 34.4347, "longitude": 135.2442, "timezone": "Asia/Tokyo"},
    {"iata_code": "LHR", "icao_code": "EGLL", "name": "London Heathrow Airport", "city": "London", "state_region": "England", "country": "United Kingdom", "country_code": "GB", "latitude": 51.4700, "longitude": -0.4543, "timezone": "Europe/London"},
    {"iata_code": "CDG", "icao_code": "LFPG", "name": "Charles de Gaulle Airport", "city": "Paris", "state_region": "Île-de-France", "country": "France", "country_code": "FR", "latitude": 49.0097, "longitude": 2.5479, "timezone": "Europe/Paris"},
    {"iata_code": "AMS", "icao_code": "EHAM", "name": "Amsterdam Airport Schiphol", "city": "Amsterdam", "state_region": "North Holland", "country": "Netherlands", "country_code": "NL", "latitude": 52.3105, "longitude": 4.7683, "timezone": "Europe/Amsterdam"},
    {"iata_code": "FCO", "icao_code": "LIRF", "name": "Leonardo da Vinci–Fiumicino Airport", "city": "Rome", "state_region": "Lazio", "country": "Italy", "country_code": "IT", "latitude": 41.8003, "longitude": 12.2389, "timezone": "Europe/Rome"},
    {"iata_code": "ZRH", "icao_code": "LSZH", "name": "Zurich Airport", "city": "Zurich", "state_region": "Zurich", "country": "Switzerland", "country_code": "CH", "latitude": 47.4582, "longitude": 8.5555, "timezone": "Europe/Zurich"},
    {"iata_code": "BCN", "icao_code": "LEBL", "name": "Josep Tarradellas Barcelona–El Prat Airport", "city": "Barcelona", "state_region": "Catalonia", "country": "Spain", "country_code": "ES", "latitude": 41.2974, "longitude": 2.0833, "timezone": "Europe/Madrid"},
]


def load_legacy_airports_if_available() -> List[Dict[str, Any]]:
    """Loads and cleans legacy airports from indiaAirport.json if present."""
    candidates = [
        "/Users/kumkumpandey/dashtiny_angular_reference/src/assets/indiaAirport.json",
        "/Users/kumkumpandey/Downloads/dashtiny_mvp_angular/src/assets/indiaAirport.json"
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    cleaned = []
                    seen_iata = set()
                    for item in raw_data:
                        v = item.get("value", {})
                        iata = (v.get("iata") or "").strip().upper()
                        # Strictly accept valid 3-letter alphabetic IATA codes
                        if len(iata) == 3 and iata.isalpha() and iata not in seen_iata:
                            seen_iata.add(iata)
                            city = (v.get("location") or "").strip()
                            name = (v.get("airport") or f"{city} Airport").strip()
                            state = (v.get("state") or "").strip()
                            cleaned.append({
                                "iata_code": iata,
                                "icao_code": (v.get("icao") or "").strip() or None,
                                "name": name,
                                "city": city or name,
                                "state_region": state or None,
                                "country": "India",
                                "country_code": "IN",
                                "latitude": None,
                                "longitude": None,
                                "timezone": "Asia/Kolkata"
                            })
                    return cleaned
            except Exception:
                pass
    return []


def seed_airports(db: Session, force: bool = False) -> int:
    """
    Seeds airports into the PostgreSQL database.
    Idempotent: skips existing IATA codes.
    """
    count = db.query(Airport).count()
    if count > 0 and not force:
        return count

    # Combine canonical airports with cleaned legacy data
    all_data = {a["iata_code"]: a for a in CANONICAL_AIRPORTS}
    legacy = load_legacy_airports_if_available()
    for leg in legacy:
        iata = leg["iata_code"]
        if iata not in all_data:
            all_data[iata] = leg

    inserted = 0
    for iata, item in all_data.items():
        existing = db.query(Airport).filter(Airport.iata_code == iata).first()
        if not existing:
            search_str = f"{iata} {item['city']} {item['name']} {item.get('state_region') or ''} {item.get('country') or ''}".lower()
            airport = Airport(
                id=str(uuid.uuid4()),
                iata_code=iata,
                icao_code=item.get("icao_code"),
                name=item["name"],
                city=item["city"],
                state_region=item.get("state_region"),
                country=item.get("country", "India"),
                country_code=item.get("country_code", "IN"),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
                timezone=item.get("timezone", "Asia/Kolkata"),
                search_text=search_str,
                is_active=True
            )
            db.add(airport)
            inserted += 1

    db.commit()
    return db.query(Airport).count()
