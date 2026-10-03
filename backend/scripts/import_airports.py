#!/usr/bin/env python3
"""
DashTiny L1 — Airport & Location Domain Migration Script
Imports and normalizes legacy airport reference datasets into PostgreSQL.

Sources audited:
1. src/assets/indiaAirport.json (244 records)
2. src/app/data/airportData.ts (78 records)
3. airports.db (0 bytes, empty placeholder - discarded)
4. flights.db (empty tables - discarded)

Usage:
  python backend/scripts/import_airports.py [--dry-run]
"""

import os
import sys
import json
import re
import argparse
from typing import Dict, Any, List, Tuple

# Ensure backend root is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine
from app.models.models import Airport

# Canonical coordinates for major Indian & international airports
CANONICAL_COORDINATES: Dict[str, Tuple[float, float, str, str]] = {
    # Domestic Hubs
    "DEL": (28.5562, 77.1000, "Asia/Kolkata", "Indira Gandhi International Airport"),
    "BOM": (19.0896, 72.8656, "Asia/Kolkata", "Chhatrapati Shivaji Maharaj International Airport"),
    "BLR": (13.1986, 77.7066, "Asia/Kolkata", "Kempegowda International Airport"),
    "MAA": (12.9941, 80.1709, "Asia/Kolkata", "Chennai International Airport"),
    "CCU": (22.6547, 88.4467, "Asia/Kolkata", "Netaji Subhash Chandra Bose International Airport"),
    "HYD": (17.2403, 78.4294, "Asia/Kolkata", "Rajiv Gandhi International Airport"),
    "COK": (10.1518, 76.4019, "Asia/Kolkata", "Cochin International Airport"),
    "GOI": (15.3808, 73.8314, "Asia/Kolkata", "Dabolim Airport"),
    "GOX": (15.7667, 73.8667, "Asia/Kolkata", "Manohar International Airport (Mopa)"),
    "AMD": (23.0772, 72.6347, "Asia/Kolkata", "Sardar Vallabhbhai Patel International Airport"),
    "PNQ": (18.5822, 73.9197, "Asia/Kolkata", "Pune International Airport"),
    "JAI": (26.8242, 75.8122, "Asia/Kolkata", "Jaipur International Airport"),
    "LKO": (26.7606, 80.8893, "Asia/Kolkata", "Chaudhary Charan Singh International Airport"),
    "IXC": (30.6735, 76.7885, "Asia/Kolkata", "Shaheed Bhagat Singh International Airport"),
    "TRV": (8.4821, 76.9200, "Asia/Kolkata", "Thiruvananthapuram International Airport"),
    "ATQ": (31.7096, 74.7973, "Asia/Kolkata", "Sri Guru Ram Dass Jee International Airport"),
    "GAU": (26.1061, 91.5859, "Asia/Kolkata", "Lokpriya Gopinath Bordoloi International Airport"),
    "BBI": (20.2444, 85.8178, "Asia/Kolkata", "Biju Patnaik International Airport"),
    "PAT": (25.5913, 85.0880, "Asia/Kolkata", "Jay Prakash Narayan Airport"),
    "IXR": (23.3143, 85.3217, "Asia/Kolkata", "Birsa Munda Airport"),
    "VNS": (25.4524, 82.8593, "Asia/Kolkata", "Lal Bahadur Shastri International Airport"),
    "IXB": (26.6812, 88.3286, "Asia/Kolkata", "Bagdogra International Airport"),
    "SXR": (33.9871, 74.7744, "Asia/Kolkata", "Sheikh ul-Alam International Airport"),
    "IXL": (34.1359, 77.5465, "Asia/Kolkata", "Kushok Bakula Rimpochee Airport"),
    "IXJ": (32.6891, 74.8374, "Asia/Kolkata", "Jammu Airport"),
    "DED": (30.1897, 78.1803, "Asia/Kolkata", "Dehradun (Jolly Grant) Airport"),
    "UDR": (24.6177, 73.8961, "Asia/Kolkata", "Maharana Pratap Airport"),
    "IDR": (22.7217, 75.8011, "Asia/Kolkata", "Devi Ahilya Bai Holkar Airport"),
    "BHO": (23.2875, 77.3378, "Asia/Kolkata", "Raja Bhoj Airport"),
    "NAG": (21.0922, 79.0472, "Asia/Kolkata", "Dr. Babasaheb Ambedkar International Airport"),
    "VTZ": (17.7212, 83.2245, "Asia/Kolkata", "Visakhapatnam International Airport"),
    "CJB": (11.0300, 77.0434, "Asia/Kolkata", "Coimbatore International Airport"),
    "IXE": (12.9613, 74.8901, "Asia/Kolkata", "Mangalore International Airport"),
    "CCJ": (11.1368, 75.9553, "Asia/Kolkata", "Calicut International Airport"),
    "IXM": (9.8345, 78.0934, "Asia/Kolkata", "Madurai Airport"),
    "TRZ": (10.7654, 78.7097, "Asia/Kolkata", "Tiruchirappalli International Airport"),
    "TIR": (13.6325, 79.5433, "Asia/Kolkata", "Tirupati Airport"),
    "VGA": (16.5304, 80.7968, "Asia/Kolkata", "Vijayawada Airport"),
    "RPR": (21.1804, 81.7388, "Asia/Kolkata", "Swami Vivekananda Airport"),
    "JDH": (26.2511, 73.0489, "Asia/Kolkata", "Jodhpur Airport"),
    "JAI": (26.8242, 75.8122, "Asia/Kolkata", "Jaipur International Airport"),
    "SHL": (25.7036, 91.9789, "Asia/Kolkata", "Shillong Airport"),
    "AJL": (23.8407, 92.6199, "Asia/Kolkata", "Lengpui Airport"),
    "IMF": (24.7600, 93.8967, "Asia/Kolkata", "Bir Tikendrajit International Airport"),
    "DMU": (25.8839, 93.7711, "Asia/Kolkata", "Dimapur Airport"),
    "IXA": (23.8869, 91.2405, "Asia/Kolkata", "Maharaja Bir Bikram Airport"),
    "IXZ": (11.6414, 92.7297, "Asia/Kolkata", "Veer Savarkar International Airport"),
    "AGX": (10.8236, 72.1764, "Asia/Kolkata", "Agatti Airport"),
    "DHM": (32.1651, 76.2634, "Asia/Kolkata", "Kangra (Dharamshala) Airport"),
    "KUU": (31.8767, 77.1544, "Asia/Kolkata", "Kullu Manali (Bhuntar) Airport"),
    # International Gateways
    "DXB": (25.2532, 55.3657, "Asia/Dubai", "Dubai International Airport"),
    "DOH": (25.2731, 51.6081, "Asia/Qatar", "Hamad International Airport"),
    "AUH": (24.4330, 54.6511, "Asia/Dubai", "Zayed International Airport"),
    "SIN": (1.3644, 103.9915, "Asia/Singapore", "Singapore Changi Airport"),
    "BKK": (13.6900, 100.7501, "Asia/Bangkok", "Suvarnabhumi Airport"),
    "DMK": (13.9126, 100.6067, "Asia/Bangkok", "Don Mueang International Airport"),
    "KUL": (2.7456, 101.7072, "Asia/Kuala_Lumpur", "Kuala Lumpur International Airport"),
    "LHR": (51.4700, -0.4543, "Europe/London", "London Heathrow Airport"),
    "LGW": (51.1537, -0.1821, "Europe/London", "London Gatwick Airport"),
    "JFK": (40.6413, -73.7781, "America/New_York", "John F. Kennedy International Airport"),
    "EWR": (40.6895, -74.1745, "America/New_York", "Newark Liberty International Airport"),
    "SFO": (37.6213, -122.3790, "America/Los_Angeles", "San Francisco International Airport"),
    "CDG": (49.0097, 2.5479, "Europe/Paris", "Paris Charles de Gaulle Airport"),
    "FRA": (50.0379, 8.5622, "Europe/Berlin", "Frankfurt Airport"),
    "AMS": (52.3105, 4.7683, "Europe/Amsterdam", "Amsterdam Airport Schiphol"),
    "NRT": (35.7720, 140.3929, "Asia/Tokyo", "Narita International Airport"),
    "HND": (35.5494, 139.7798, "Asia/Tokyo", "Tokyo Haneda Airport"),
    "SYD": (-33.9399, 151.1753, "Australia/Sydney", "Sydney Kingsford Smith Airport"),
    "MEL": (-37.6690, 144.8410, "Australia/Melbourne", "Melbourne Airport"),
    "DPS": (-8.7482, 115.1672, "Asia/Makassar", "Ngurah Rai (Bali) International Airport"),
    "MLE": (4.1918, 73.5291, "Indian/Maldives", "Velana (Malé) International Airport"),
    "CMB": (7.1808, 79.8841, "Asia/Colombo", "Bandaranaike International Airport"),
    "KTM": (27.6966, 85.3591, "Asia/Kathmandu", "Tribhuvan International Airport"),
}

INTERNATIONAL_METADATA: Dict[str, Tuple[str, str, str, str]] = {
    # code: (name, city, country, country_code)
    "DXB": ("Dubai International Airport", "Dubai", "United Arab Emirates", "AE"),
    "DOH": ("Hamad International Airport", "Doha", "Qatar", "QA"),
    "AUH": ("Zayed International Airport", "Abu Dhabi", "United Arab Emirates", "AE"),
    "SIN": ("Singapore Changi Airport", "Singapore", "Singapore", "SG"),
    "BKK": ("Suvarnabhumi Airport", "Bangkok", "Thailand", "TH"),
    "DMK": ("Don Mueang International Airport", "Bangkok", "Thailand", "TH"),
    "KUL": ("Kuala Lumpur International Airport", "Kuala Lumpur", "Malaysia", "MY"),
    "LHR": ("London Heathrow Airport", "London", "United Kingdom", "GB"),
    "LGW": ("London Gatwick Airport", "London", "United Kingdom", "GB"),
    "JFK": ("John F. Kennedy International Airport", "New York", "United States", "US"),
    "EWR": ("Newark Liberty International Airport", "Newark", "United States", "US"),
    "SFO": ("San Francisco International Airport", "San Francisco", "United States", "US"),
    "CDG": ("Paris Charles de Gaulle Airport", "Paris", "France", "FR"),
    "FRA": ("Frankfurt Airport", "Frankfurt", "Germany", "DE"),
    "AMS": ("Amsterdam Airport Schiphol", "Amsterdam", "Netherlands", "NL"),
    "NRT": ("Narita International Airport", "Tokyo", "Japan", "JP"),
    "HND": ("Tokyo Haneda Airport", "Tokyo", "Japan", "JP"),
    "SYD": ("Sydney Kingsford Smith Airport", "Sydney", "Australia", "AU"),
    "MEL": ("Melbourne Airport", "Melbourne", "Australia", "AU"),
    "DPS": ("Ngurah Rai (Bali) International Airport", "Denpasar", "Indonesia", "ID"),
    "MLE": ("Velana (Malé) International Airport", "Malé", "Maldives", "MV"),
    "CMB": ("Bandaranaike International Airport", "Colombo", "Sri Lanka", "LK"),
    "KTM": ("Tribhuvan International Airport", "Kathmandu", "Nepal", "NP"),
}


def clean_text(s: str) -> str:
    if not s:
        return ""
    # Strip HTML, normalize whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def is_valid_iata(code: str) -> bool:
    if not code:
        return False
    return bool(re.match(r"^[A-Z]{3}$", code.strip().upper()))


def is_valid_coord(lat: float, lon: float) -> bool:
    if lat is None or lon is None:
        return False
    return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0


def load_legacy_airport_data(legacy_dir: str):
    json_path = os.path.join(legacy_dir, "indiaAirport.json")
    ts_path = os.path.join(legacy_dir, "airportData.ts")

    # Fallback to local app/db/legacy
    if not os.path.exists(json_path):
        json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "db", "legacy", "indiaAirport.json"))
    if not os.path.exists(ts_path):
        ts_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "db", "legacy", "airportData.ts"))

    india_raw = []
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            india_raw = json.load(f)

    ts_raw = []
    if os.path.exists(ts_path):
        with open(ts_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Extract code, name, city, state, country
            matches = re.finditer(
                r'\"code\":\s*\"([^\"]*)\",\s*\"name\":\s*\"([^\"]*)\",\s*\"city\":\s*\"([^\"]*)\",\s*\"state\":\s*\"([^\"]*)\",\s*\"country\":\s*\"([^\"]*)\"',
                content
            )
            for m in matches:
                ts_raw.append({
                    "code": m.group(1).strip().upper(),
                    "name": m.group(2).strip(),
                    "city": m.group(3).strip(),
                    "state": m.group(4).strip(),
                    "country": m.group(5).strip() or "India"
                })

    return india_raw, ts_raw


def run_import(dry_run: bool = False):
    print("=" * 70)
    print("🌍 DashTiny L1 — Airport & Location Domain Importer")
    print("=" * 70)

    legacy_dir = "/Users/kumkumpandey/Downloads/dashtiny_mvp_angular/src/assets"
    alt_legacy_dir = "/Users/kumkumpandey/Downloads/dashtiny_mvp_angular"
    
    india_raw, ts_raw = load_legacy_airport_data(legacy_dir)
    if not india_raw and os.path.exists(alt_legacy_dir):
        india_raw, ts_raw = load_legacy_airport_data(os.path.join(alt_legacy_dir, "src", "assets"))

    print(f"Loaded raw records from legacy indiaAirport.json: {len(india_raw)}")
    print(f"Loaded raw records from legacy airportData.ts: {len(ts_raw)}")

    normalized_airports: Dict[str, Dict[str, Any]] = {}
    skipped_records: List[Tuple[str, str, str]] = []  # (source, reason, raw)
    duplicates_count = 0
    invalid_coords_count = 0

    # 1. Process airportData.ts (Clean baseline of Indian commercial airports)
    for entry in ts_raw:
        code = entry.get("code", "").strip().upper()
        if not is_valid_iata(code):
            skipped_records.append(("airportData.ts", f"Invalid IATA format '{code}'", str(entry)))
            continue

        name = clean_text(entry.get("name", ""))
        city = clean_text(entry.get("city", ""))
        state = clean_text(entry.get("state", ""))
        country = clean_text(entry.get("country", "India"))

        if not name or name == "India":
            name = f"{city} Airport" if city else f"{code} Airport"

        coord_info = CANONICAL_COORDINATES.get(code)
        lat = coord_info[0] if coord_info else None
        lon = coord_info[1] if coord_info else None
        tz = coord_info[2] if coord_info else "Asia/Kolkata"
        if coord_info and coord_info[3]:
            name = coord_info[3]  # Prefer canonical official airport title

        normalized_airports[code] = {
            "iata_code": code,
            "icao_code": None,
            "name": name,
            "city": city or name,
            "state_region": state,
            "country": country,
            "country_code": "IN",
            "latitude": lat,
            "longitude": lon,
            "timezone": tz,
            "is_active": True,
            "provenance": "REFERENCE_DATASET",
        }

    # 2. Process indiaAirport.json (Detailed ICAO codes, operational status, additional domestic fields)
    for item in india_raw:
        val = item.get("value", {})
        raw_iata = clean_text(val.get("iata", "")).upper()
        raw_name = clean_text(val.get("airport", ""))
        raw_city = clean_text(val.get("location", ""))
        raw_icao = clean_text(val.get("icao", "")).upper()
        status = clean_text(val.get("airportstatus", ""))
        state = clean_text(val.get("state", ""))

        if not raw_iata or raw_iata in ["—", "-", "N/A", "NONE"]:
            skipped_records.append((
                "indiaAirport.json",
                f"No official IATA assigned (status='{status}', type='{val.get('airporttype')}')",
                f"{raw_city} - {raw_name}"
            ))
            continue

        if not is_valid_iata(raw_iata):
            skipped_records.append(("indiaAirport.json", f"Invalid IATA code '{raw_iata}'", str(val)))
            continue

        # If duplicate within indiaAirport.json or already in ts_raw
        if raw_iata in normalized_airports:
            duplicates_count += 1
            rec = normalized_airports[raw_iata]
            if raw_icao and len(raw_icao) == 4 and not rec.get("icao_code"):
                rec["icao_code"] = raw_icao
            if not rec.get("state_region") and state:
                rec["state_region"] = state
            continue

        # New airport from indiaAirport.json
        name = raw_name or f"{raw_city} Airport"
        icao = raw_icao if len(raw_icao) == 4 else None
        coord_info = CANONICAL_COORDINATES.get(raw_iata)
        lat = coord_info[0] if coord_info else None
        lon = coord_info[1] if coord_info else None
        tz = coord_info[2] if coord_info else "Asia/Kolkata"
        if coord_info and coord_info[3]:
            name = coord_info[3]

        normalized_airports[raw_iata] = {
            "iata_code": raw_iata,
            "icao_code": icao,
            "name": name,
            "city": raw_city or name,
            "state_region": state,
            "country": "India",
            "country_code": "IN",
            "latitude": lat,
            "longitude": lon,
            "timezone": tz,
            "is_active": (status.lower() != "non operational" and status.lower() != "closed"),
            "provenance": "REFERENCE_DATASET",
        }

    # 3. Add canonical International hubs
    for code, (name, city, country, country_code) in INTERNATIONAL_METADATA.items():
        if code not in normalized_airports:
            coord_info = CANONICAL_COORDINATES.get(code)
            lat = coord_info[0] if coord_info else None
            lon = coord_info[1] if coord_info else None
            tz = coord_info[2] if coord_info else "UTC"

            normalized_airports[code] = {
                "iata_code": code,
                "icao_code": None,
                "name": name,
                "city": city,
                "state_region": None,
                "country": country,
                "country_code": country_code,
                "latitude": lat,
                "longitude": lon,
                "timezone": tz,
                "is_active": True,
                "provenance": "REFERENCE_DATASET",
            }

    # 4. Generate search_text and validate coordinates
    for code, rec in normalized_airports.items():
        parts = [
            rec["city"],
            rec["name"],
            rec["iata_code"],
            rec.get("icao_code") or "",
            rec.get("state_region") or "",
            rec["country"],
        ]
        rec["search_text"] = " ".join([p for p in parts if p]).lower().strip()

        # Coordinate check
        lat = rec.get("latitude")
        lon = rec.get("longitude")
        if lat is not None and lon is not None:
            if not is_valid_coord(lat, lon):
                invalid_coords_count += 1
                rec["latitude"] = None
                rec["longitude"] = None

    valid_count = len(normalized_airports)
    inserted_count = 0
    updated_count = 0

    print(f"\nAudit Summary:")
    print(f"  Valid normalized airports to upsert: {valid_count}")
    print(f"  Duplicates handled: {duplicates_count}")
    print(f"  Skipped invalid/unassigned records: {len(skipped_records)}")
    print(f"  Invalid coordinates detected: {invalid_coords_count}")

    if dry_run:
        print("\n[DRY RUN] No database changes committed.")
        return

    # 5. Database Upsert
    db: Session = SessionLocal()
    try:
        for code, data in normalized_airports.items():
            existing = db.query(Airport).filter(Airport.iata_code == code).first()
            if existing:
                existing.name = data["name"]
                existing.city = data["city"]
                existing.state_region = data.get("state_region")
                existing.country = data["country"]
                existing.country_code = data["country_code"]
                if data.get("icao_code"):
                    existing.icao_code = data["icao_code"]
                if data.get("latitude") is not None:
                    existing.latitude = data["latitude"]
                    existing.longitude = data["longitude"]
                if data.get("timezone"):
                    existing.timezone = data["timezone"]
                existing.search_text = data["search_text"]
                existing.is_active = data["is_active"]
                existing.provenance = data["provenance"]
                updated_count += 1
            else:
                airport = Airport(**data)
                db.add(airport)
                inserted_count += 1

        db.commit()
        print(f"\nDatabase Upsert Complete:")
        print(f"  Inserted: {inserted_count}")
        print(f"  Updated:  {updated_count}")
        print(f"  Total in DB: {db.query(Airport).count()}")
    except Exception as e:
        db.rollback()
        print(f"Database error during import: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import legacy airports into PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Inspect without committing to DB")
    args = parser.parse_args()
    run_import(dry_run=args.dry_run)
