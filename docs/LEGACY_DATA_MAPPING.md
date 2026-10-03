# 🗄️ DashTiny — Legacy Data Mapping & Migration Blueprint

> **Sources**:  
> - `airports.db` & `flights.db` (Legacy SQLite root files)  
> - `db.js` (Legacy Mongoose / MongoDB schema)  
> - `src/assets/indiaAirport.json` & `src/app/data/airportData.ts` (Legacy airport data arrays)  
> - `src/app/data/flightData.ts` (Legacy flight dataset)  
> - `src/app/services/itinerary-generator.service.ts` & `src/assets/trip/open-api.json` (Legacy itinerary structures)

---

## 1. Airport & Location Intelligence Mapping

### 1.1 Legacy Data Audit (Verified Counts)
1. **`airports.db`**: An empty 0-byte SQLite file present in the legacy repository root (discarded; 0 records).
2. **`flights.db` (`airports` table)**:
   ```sql
   CREATE TABLE airports (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     code TEXT NOT NULL,
     lat TEXT NOT NULL,
     lon TEXT NOT NULL,
     name TEXT NOT NULL,
     city TEXT NOT NULL,
     state TEXT NOT NULL,
     country TEXT NOT NULL,
     woeid TEXT NOT NULL,
     tz TEXT NOT NULL,
     phone TEXT,
     type TEXT NOT NULL,
     email TEXT,
     url TEXT,
     runway_length TEXT,
     elev TEXT,
     icao TEXT,
     direct_flights TEXT,
     carriers TEXT
   );
   ```
   *(Note: This SQLite table has 0 rows; the application used client-side data arrays at runtime).*
3. **`src/assets/indiaAirport.json`**: 244 total JSON entries:
   - 2 empty placeholder objects (`{}`)
   - 151 records with valid 3-letter IATA codes
   - 93 records with unassigned/non-operational codes (`—` or `-` for defense, airstrips, or proposed fields)
   - 147 unique valid IATA codes
   - 4 duplicate IATAs (`IXI`, `DED`, `TIR`, `CBD`)
4. **`src/app/data/airportData.ts`**: 78 total TypeScript records:
   - 78 valid unique 3-letter IATA codes
   - 4 entries had blank names (`SHL`, `TCR`, `TRZ`) and 1 had blank state (`IXI`), which were enriched from `indiaAirport.json`.
5. **Consolidated Ingestion Dataset**:
   - 148 unique domestic Indian airports (merged from `indiaAirport.json` and `airportData.ts`).
   - 23 high-volume international gateway hubs (e.g. `DXB`, `SIN`, `LHR`, `NRT`, `HND`, `BKK`, `DPS`).
   - **171 total unique reference airports** imported into PostgreSQL.

### 1.2 Target PostgreSQL Schema (`airports`)
To eliminate all runtime dependencies on SQLite and client-side JSON files, airports are normalized into PostgreSQL:

```sql
CREATE TABLE airports (
    id VARCHAR(36) PRIMARY KEY,              -- UUID / deterministic key (e.g. 'ap_del_vidp')
    iata_code VARCHAR(3) NOT NULL UNIQUE,     -- 'DEL', 'BOM', 'BLR'
    icao_code VARCHAR(4),                     -- 'VIDP', 'VABB'
    name VARCHAR(255) NOT NULL,               -- 'Indira Gandhi International Airport'
    city VARCHAR(100) NOT NULL,               -- 'New Delhi'
    state_region VARCHAR(100),                -- 'Delhi'
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    country_code VARCHAR(2) NOT NULL DEFAULT 'IN',
    latitude DOUBLE PRECISION,                -- 28.5562
    longitude DOUBLE PRECISION,               -- 77.1000
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    search_text VARCHAR(500) NOT NULL,        -- 'del new delhi indira gandhi international vidp india in'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    provenance VARCHAR(50) NOT NULL DEFAULT 'REFERENCE_DATASET',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX ix_airports_iata_code ON airports(iata_code);
CREATE INDEX ix_airports_city ON airports(city);
CREATE INDEX ix_airports_country ON airports(country);
CREATE INDEX ix_airports_search_text ON airports(search_text);
CREATE INDEX ix_airports_is_active ON airports(is_active);
CREATE INDEX ix_airports_city_iata ON airports(city, iata_code);
```

### 1.3 Field Transformation & Curated Enrichment Matrix

To prevent misleading claims of "verified" live data while providing high-quality geographic data, L1 explicitly documents legacy source values versus curated reference enrichment:

| Target PostgreSQL Field | Source Origin | Transform / Sanitization Rule |
| :--- | :--- | :--- |
| `iata_code` | `LEGACY` (`airportData.ts` / `indiaAirport.json`) | Validated 3 uppercase alphabetic characters (`^[A-Z]{3}$`). Unique constraint enforced. |
| `icao_code` | `LEGACY` (`indiaAirport.json`) | 4 uppercase characters (`^[A-Z]{4}$`) or `NULL` if missing. |
| `name` | `LEGACY` or `CURATED` (`CANONICAL_COORDINATES`) | Prefer official airport title from `CANONICAL_COORDINATES` (e.g. "Indira Gandhi International Airport"); fallback to legacy string with cleaned whitespace. |
| `city` | `LEGACY` or `CURATED` (`CURATED_CITIES`) | Normalized traveler recognition (e.g. `GOI` / `GOX` mapped to "Goa" instead of municipality "Vasco Da Gama"). |
| `state_region` | `LEGACY` (`indiaAirport.json` / `airportData.ts`) | Title case state name (e.g. "Delhi", "Goa", "Maharashtra"). |
| `country` | `LEGACY` / `CURATED` | "India" for domestic records, country name from `INTERNATIONAL_METADATA` for international hubs. |
| `country_code` | `LEGACY` / `CURATED` | ISO 3166-1 alpha-2 ("IN", "AE", "SG", "GB", "US", etc.). |
| `latitude`, `longitude` | `CURATED` (`CANONICAL_COORDINATES`) | Accurate decimal degrees from reference coordinate table. Validated within $[-90, 90]$ and $[-180, 180]$. |
| `timezone` | `CURATED` (`CANONICAL_COORDINATES`) | Standard IANA timezone string ("Asia/Kolkata", "Asia/Dubai", "Europe/London"). |
| `search_text` | Computed | Lowercase token index: `${iata} ${city} ${name} ${icao} ${state} ${country} ${country_code}` for fast prefix and substring filtering. |
| `provenance` | Governed Constant | **`REFERENCE_DATASET`**. Never marked `VERIFIED` without an authoritative live contract. |
| `is_active` | `LEGACY` / Governed | `TRUE` for commercial airports; `FALSE` for decommissioned or unverified strips. |

### 1.4 Single Ingestion Authority Pipeline & Read-Only Runtime Guarantee

```
  backend/app/db/legacy/indiaAirport.json
  backend/app/db/legacy/airportData.ts
               │
               ▼
  backend/scripts/import_airports.py (Canonical Ingestion Authority)
               │ (Thin delegation wrapper: backend/app/db/seed_airports.py)
               ▼
      PostgreSQL airports Table
               │
               ▼
  GET /api/v1/locations/search?q=  (Strictly Read-Only)
  GET /api/v1/locations/airports/{iata} (Strictly Read-Only)
```

1. **Single Authority**: `backend/scripts/import_airports.py` is the sole ingestion pipeline. `backend/app/db/seed_airports.py` is a thin compatibility wrapper that delegates directly to `import_airports_data(db)`. No duplicate hardcoded airport databases exist.
2. **Repository Portability**: All legacy data files are referenced relative to the module root (`DEFAULT_LEGACY_DIR = BACKEND_ROOT / "app" / "db" / "legacy"`). Zero developer-specific absolute paths remain.
3. **Strict Read-Only Runtime**: Request handlers (`GET /locations/search` and `GET /locations/airports/{iata}`) NEVER create records or execute `seed_airports()`. When the table is empty, search returns `[]` and lookup returns `404`. Seeding is strictly an explicit administrative/initialization step.
4. **Popular Hubs Flow**: An empty query (`GET /locations/search?q=`) returns curated popular hubs (`DEL`, `BOM`, `BLR`, `GOI`, `HYD`, etc.). When travelers focus an empty input in `AirportAutocomplete`, the frontend queries this endpoint to present top hubs immediately.


---

## 2. Flight Search & Offers Data Mapping

### 2.1 Legacy Data Audit
1. **`flights.db` (`flights` table)**:
   ```sql
   CREATE TABLE flights (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     airline TEXT NOT NULL,
     flight_number TEXT NOT NULL,
     departure_airport TEXT NOT NULL,
     arrival_airport TEXT NOT NULL,
     departure_time DATETIME NOT NULL,
     arrival_time DATETIME NOT NULL,
     price REAL NOT NULL
   );
   ```
2. **`src/app/data/flightData.ts`**: 806 lines with static flights across IndiGo, Air India, Akasa Air, Vistara, SpiceJet:
   ```typescript
   {
     "id": 1,
     "airlineLogo": "https://d3lzcn6mbbadaf.cloudfront.net/media/details/air_indfia.jpg",
     "airlineName": "Air India",
     "departureCityAirport": "IXC",
     "departureTime": "08:00",
     "arrivalTime": "11:30",
     "arrivalCityAirport": "DEL",
     "stops": 0,
     "departureCity": "Chandigarh Airport",
     "arrivalCity": "Indira Gandhi International Airport",
     "price": "₹25,500",
     "duration": "3h 30m"
   }
   ```

### 2.2 Target Normalized Domain Contract (`FlightOffer`)
The modern architecture abstracts all flight inventory through `FlightProvider` into a standardized dictionary:

```python
class FlightOffer(BaseModel):
    offer_id: str                      # Deterministic hash: f"curated_fl_{origin}_{dest}_{hash}"
    provider: str                      # "IndiGo", "Air India", "Akasa Air"
    airline: str                       # "IndiGo"
    flight_number: str                 # "6E-534"
    departure_time: str                # "06:15 AM"
    arrival_time: str                  # "07:30 AM"
    origin_airport: str                # "DEL"
    destination_airport: str           # "GOI"
    duration_minutes: int              # 75
    stops: int                         # 0
    cabin: str                         # "economy" | "business"
    baggage: str                       # "15kg Checked • 7kg Cabin"
    cancellation: str                  # "Free cancellation within 24 hours"
    price: float                       # 3450.0
    currency: str                      # "INR"
    deep_link: str                     # "https://www.goindigo.in"
    why_recommended: str               # "Morning direct flight with early arrival"
    provenance: str                    # "CURATED" (never "VERIFIED" without live API)
    retrieved_at: str                  # ISO timestamp
    expires_at: str                    # ISO timestamp (UTC + 2h)
```

### 2.3 Field Transformation Matrix

| Legacy `flightData.ts` Field | Target `FlightOffer` Field | Transformation Rule |
| :--- | :--- | :--- |
| `id` | `offer_id` | Server-generated deterministic UUID or corridor hash. |
| `airlineName` | `airline` / `provider` | Normalized airline brand string. |
| (Missing in legacy) | `flight_number` | Standardized airline IATA code + flight digits (e.g. `6E-534`, `AI-802`). |
| `departureCityAirport` | `origin_airport` | Clean 3-letter IATA code. |
| `arrivalCityAirport` | `destination_airport` | Clean 3-letter IATA code. |
| `departureTime`, `arrivalTime` | `departure_time`, `arrival_time` | Clean 12-hour or 24-hour time string. |
| `duration` (`"2h 45m"`) | `duration_minutes` | Parse hours and minutes to total integer minutes: $2 \times 60 + 45 = 165$. |
| `stops` | `stops` | Integer (0 for non-stop, 1, 2). |
| `price` (`"₹22,800"`) | `price` | Strip currency symbols (`₹`, `,`), parse to float (`22800.0`). |
| (Missing in legacy) | `provenance` | Explicitly `"CURATED"` (or `"DEMO"`), avoiding OTA liability. |
| (Missing in legacy) | `deep_link` | Official airline booking portal deep-link. |

---

## 3. Structured Itinerary Data Mapping

### 3.1 Legacy Itinerary Synthesis Audit
In `src/app/services/itinerary-generator.service.ts` and `src/app/components/partials/chat-popup/chat-popup.component.ts`:
- **Chunk Size**: `CHUNK_SIZE = 3` days per LLM invocation.
- **Legacy Prompt Output Schema**:
  ```json
  {
    "type": "itinerary_chunk",
    "dailyItinerary": [
      {
        "day": 1,
        "date": "2025-01-10",
        "activities": [
          {
            "time": "09:00",
            "place_type": "sightseeing",
            "activity": "Visit Amber Fort",
            "location": "Amer, Jaipur",
            "location_coordinates": { "lat": 26.9855, "long": 75.8513 },
            "weather": { "temperature": "24°C", "condition": "Sunny" },
            "estimatedCost": 500
          }
        ]
      }
    ]
  }
  ```

### 3.2 Target DashTiny Domain Relational Schema
In `backend/app/models/models.py`, itineraries are stored across two normalized PostgreSQL tables:

```
Itinerary (Trips)
   └── ItineraryDay (trip_days)
          └── ItineraryActivity (trip_activities)
```

#### Activity Mapping Matrix:
| Legacy Chunk Property | Target `ItineraryActivity` Column | Type & Constraints |
| :--- | :--- | :--- |
| Generated or implicit | `id` | `VARCHAR(36)` Primary Key (Server UUID) |
| `day` | `trip_day_id` | Foreign Key to `trip_days.id` on delete CASCADE |
| `activity` | `title` | `VARCHAR(255)` Not Null |
| (Missing in legacy) | `description` | `TEXT` Rich context & narrative |
| `time` (`"09:00"`) | `start_time` | `VARCHAR(10)` or `TIME` |
| Computed from duration | `duration_minutes` | `INTEGER` CheckConstraint $\ge 0$ |
| (Missing in legacy) | `transit_minutes` | `INTEGER` CheckConstraint $\ge 0$ |
| `location_coordinates.lat` | `lat` | `DOUBLE PRECISION` |
| `location_coordinates.long` | `lng` | `DOUBLE PRECISION` |
| `estimatedCost` | `estimated_cost` | `DOUBLE PRECISION` CheckConstraint $\ge 0$ |
| `place_type` | `category` | `VARCHAR(50)` ('sightseeing', 'dining', 'relaxation', etc.) |
| (Missing in legacy) | `why_recommended` | `TEXT` Explaining rationale |
| (Missing in legacy) | `source_citation` | `VARCHAR(255)` Official guide / local source |
| (Missing in legacy) | `provenance` | `"AI_GENERATED"` |

---

## 4. Migration Execution Plan for Reference Data

1. **Step 1 (L1 Database Ingestion)**:
   - Create PostgreSQL `airports` table with Alembic migration.
   - Run deduplicated data ingestion script merging `indiaAirport.json` + `airportData.ts` + international airport hubs.
   - Build FastAPI `/locations/search` and `/locations/airports/{iata_code}` endpoints.
2. **Step 2 (L2 Flight Provider Normalization)**:
   - Expand `CuratedFlightProvider` using sanitized corridors from `flightData.ts`.
   - Wire `/flights/search` API to accept origin, destination, dates, and passengers.
3. **Step 3 (L4 Chunked Planner Architecture)**:
   - Adapt `ItineraryGeneratorService`'s 3-day chunking logic inside backend `PlannerService`.
   - Prevent duplicate activities and repeated dining across merged chunks.
   - Emit valid `TripProposal` objects for user acceptance.
