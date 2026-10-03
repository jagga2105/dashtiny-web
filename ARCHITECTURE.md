# 🌍 DashTiny — Locked Product Architecture & Engineering Blueprint (v1)

> **The Golden Engineering Rule**:  
> *"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."*

---

## 1. Experience-First Architecture: The Central Object is `Trip`

The core architectural pivot is that **Trip** is the central node of the graph. Everything else attaches to the **Trip**.

```
User
 │
 ├── Profile / Preferences / Memory
 │
 └── Trips
      │
      ├── Destination
      ├── Travelers
      ├── Dates
      ├── Flights
      ├── Stays
      ├── Activities
      ├── Restaurants
      ├── Itinerary
      ├── Budget
      ├── Expenses
      ├── Documents
      ├── Weather
      ├── Bookings
      ├── Memories
      └── Collaborators
```

DashTiny does not treat Explore, Planner, Bookings, and Community as disjointed mini-apps. They are all lenses into discovering, assembling, optimizing, and executing a **Trip**.

---

## 2. Realistic & Focused MVP Scope

### 🎯 MVP Core (Lock for Release)
1. **Explore**: Destination discovery + personalized recommendations + ambient travel radar.
2. **AI Planner**: The primary differentiator — multi-day itinerary architect generating structured objects.
3. **Trip Workspace**: The heart of DashTiny. The generated itinerary becomes a persistent, interactive, editable trip canvas.
4. **Search & Compare**: Curated and demo inventory aggregation (`CURATED / DEMO`) for flights, stays/hotels, and experiences via normalized provider schemas (live OTA provider integrations deferred to later phase).
5. **Booking Redirect / Partner Deep-linking**: Standardized booking reference capture without carrying full OTA liabilities initially.
6. **Trip Dashboard**: One unified cockpit for everything attached to the active trip.

### 🐣 MVP-Lite (Secondary / Lightweight)
- **Community**: Public itinerary templates, photo moments, saved trips, and comments.

### ⏳ Defer to Later Phases
- Rewards coin economy (keep simple pts counter for now)
- Complex open-ended chatbot (replace with contextual Trip AI actions)
- Autonomous checkout/booking execution
- Creator marketplace
- Business travel & corporate invoicing
- WhatsApp / Voice AI integrations
- Complex ML price prediction

---

## 3. AI Architecture: Orchestration Layer, Not Source of Truth

Never let the LLM hallucinate inventory, prices, schedules, or routes. The LLM is an orchestration intelligence that coordinates tools, validates facts, and shapes user-friendly structured responses.

```
                   ┌─────────────────────┐
                   │     User Query      │
                   └──────────┬──────────┘
                              ↓
                   ┌─────────────────────┐
                   │  Intent / Context   │
                   │      Router         │
                   └──────────┬──────────┘
                              ↓
              ┌───────────────┼────────────────┐
              ↓               ↓                ↓
        Memory Service    Travel Data       RAG (Tiered)
              ↓               ↓                ↓
              └───────────────┼────────────────┘
                              ↓
                     Planner / Agent
                              ↓
                  Tool / Action Execution
                              ↓
                    Validation Layer
                              ↓
                    Structured Response
                              ↓
                     Interactive UI
```

---

## 4. The Dedicated AI Tool Layer

Instead of dozens of sprawling unmaintainable agents, LangGraph orchestrates a concise, deterministic Tool Layer:

```
backend/app/ai/
├── agents/
│   └── planner_agent.py
├── prompts/
├── memory/
├── rag/
└── tools/
    ├── flight_search.py       # Live flight provider aggregation
    ├── hotel_search.py        # Hotel & villa inventory lookup
    ├── restaurant_search.py   # Dining & culinary recommendations
    ├── maps.py                # Geocoding, coordinates, transit duration
    ├── weather.py             # Forecasts, season advisories
    ├── currency.py            # Live exchange rates & conversions
    ├── visa.py                # Official entry policies & passport rules
    ├── itinerary.py           # Schedule slotting & timeline optimizer
    ├── budget.py              # Cost estimation & category distribution
    ├── booking.py             # Partner deep links & PNR references
    └── calendar.py            # iCal / Google Calendar sync exports
```

---

## 5. Architectural Trust Boundaries & Provenance

Every single data item presented in the UI carries its provenance class:

| Provenance Tier | Category | Examples | UI Treatment |
| :--- | :--- | :--- | :--- |
| **`VERIFIED`** | Provider Inventory, Official Policy, Maps, Weather | Flight prices, hotel availability, visa requirements, route distances | Green verification badge, provider citation, exact timestamp |
| **`AI GENERATED`** | Recommendations, Summaries, Itinerary Wording, Route Optimization | Daily narrative, personalized pacing, activity sequence | Subtle AI aura, editable pills, "Why recommended" tooltip |
| **`USER GENERATED`** | Community Posts, Traveler Reviews, Photos, Memories | Tips from fellow travelers, user photos, ratings | Explorer trust score, traveler avatar, trip report tag |

```json
{
  "type": "hotel_recommendation",
  "name": "Taj Exotica Resort & Spa",
  "price": 18500,
  "currency": "INR",
  "source": "provider",
  "source_id": "taj_exotica_south_goa",
  "confidence": "verified",
  "reason": [
    "Within your luxury budget tier",
    "4.98 guest rating across 1,200+ reviews",
    "2.1 km from planned Benaulim beach walk"
  ]
}
```

---

## 6. Provider Abstraction & Normalized Schemas

Do not tightly couple DashTiny to Booking.com, Skyscanner, or Airbnb APIs directly in UI code. Use a provider abstraction layer that normalizes all external inventory into DashTiny internal schemas:

```
Booking Service
      │
      ├── Flight Providers   (Skyscanner, Google Flights, IndiGo, Air India)
      ├── Hotel Providers    (Booking.com, Agoda, Airbnb, Luxury Direct)
      ├── Activity Providers (Viator, GetYourGuide, Local Operators)
      └── Transport Providers(Local Cabs, Self-drive, Rail)
```

### Core Normalized Schemas:
- `FlightOffer` (Canonical 29-field contract across Provider / FastAPI / Frontend):
  - `offer_id`, `provider`, `airline`, `flight_number`, `origin`, `destination`
  - `origin_airport` (code, name, city, country), `destination_airport` (code, name, city, country)
  - `departure_date`, `return_date`, `departure_time`, `arrival_time`, `duration_minutes`
  - `stops`, `stop_details` (airport, city, duration_minutes), `passengers`, `cabin_class`, `trip_type`
  - `price`, `per_passenger_price`, `currency`, `baggage`, `cancellation`
  - `availability_state` (`ESTIMATED` / `AVAILABLE` / `LIMITED`)
  - `provenance` (`CURATED`), `source` (`CURATED_DATABASE`), `retrieved_at`, `expires_at`
  - `deep_link` ("Continue to provider"), `why_recommended`
- `HotelOffer`: Name, star rating, address, room type, amenities, cancellation policy, per-night price, deep link.
- `ActivityOffer`: Title, category, duration, meeting point, inclusions, price, deep link.
- `TransportOffer`: Vehicle type, pickup, drop-off, driver details, price.

### L2 Flight Search Request Validation:
- Strict validation via `FlightSearchRequest`:
  - `origin` & `destination`: required 3-letter uppercase IATA code, `origin != destination`. Must resolve through L1 Airport Autocomplete (zero fallback to GOI).
  - `departure_date`: ISO format `YYYY-MM-DD`, strictly `>= today`.
  - `roundtrip`: `return_date` required, strictly `> departure_date`.
  - `oneway`: `return_date` must be null.
  - `passengers`: 1 to 9 travelers.
  - `cabin_class`: `economy`, `premium_economy`, `business`, `first`.
  - `trip_type`: `oneway`, `roundtrip`.
  - Invalid requests return HTTP 422 Unprocessable Content. No silent corrections.

### L2 Proposal & Append-Only Revision Integration:
- Selecting an offer generates a `TripProposal` with `proposal_type="ATTACH_FLIGHT_OFFER"`.
- Review in UI shows diff preview, parent version, and honest `CURATED` provenance.
- On proposal acceptance:
  - Slots Day 1 transit activity into the itinerary.
  - Records a pending transport reference (`status="pending"`, `provenance="CURATED"`).
  - Creates an append-only `TripRevision` (`action_type="ATTACH_FLIGHT_OFFER"`).
  - No fake verified bookings created.

---

## 7. Separate Search from Booking

1. **SEARCH**: Query provider adapters in parallel -> Normalize to DashTiny schema -> Compare & filter -> Render comparison cards.
2. **BOOK**: User selects offer -> Redirect via partner deep-link with affiliate/tracking token OR booking API -> Partner confirms -> DashTiny captures PNR/booking reference -> Attached to `Trip` in PostgreSQL.

---

## 8. Database Domain Model

Structure the relational schema into logical functional domains:

### `IDENTITY`
- `users` (id, email, password_hash, full_name, role, created_at)
- `profiles` (user_id, bio, avatar_url, trust_score, verified)
- `preferences` (user_id, budget_tier, preferred_airlines, dietary, pacing)
- `oauth_accounts` (user_id, provider, provider_account_id)

### `TRAVEL` (The Core)
- `trips` (id, user_id, title, destination, start_date, end_date, budget, status, cover_image)
- `trip_members` (trip_id, user_id, role, joined_at)
- `destinations` (id, name, state, country, lat, lng, hero_image, vibe)
- `trip_days` (id, trip_id, day_number, date, title, weather)
- `trip_items` (id, trip_day_id, item_type, title, start_time, duration_minutes, lat, lng, estimated_cost, source_type)

### `LOCATION (Reference Domain)`
- `airports` (id, iata_code, icao_code, name, city, state_region, country, country_code, latitude, longitude, timezone, search_text, is_active, provenance, created_at, updated_at)

### `INVENTORY`
- `flight_offers`
- `hotel_offers`
- `activity_offers`
- `restaurant_offers`

### `BOOKING`
- `bookings` (id, trip_id, user_id, category, provider, title, amount, status, pnr_ref, booking_url)
- `booking_items`
- `booking_documents` (id, booking_id, document_url, doc_type)

### `FINANCE`
- `budgets` (id, trip_id, total_budget, currency)
- `budget_items` (id, budget_id, category, allocated_amount)
- `expenses` (id, trip_id, paid_by_user_id, amount, category, description, date)
- `expense_splits` (id, expense_id, user_id, owed_amount, settled)

### `AI OBSERVABILITY & REPRODUCIBILITY`
- `ai_runs` (id, user_id, trip_id, prompt, model, latency_ms, tokens_used, cost, status)
- `ai_tool_calls` (id, run_id, tool_name, input_payload, output_payload, latency_ms, error)
- `memories` (id, user_id, category, key, value, confidence, last_updated)
- `conversations` & `messages`
- `recommendations` (id, trip_id, item_type, payload, score, provenance)

---

## 9. RAG Source Authority Governance

Never dump all scraped text, user comments, and official embassy policies into a single vector index with equal weight. RAG must enforce 4 tiered source classes:

- **TIER 1 (Authoritative)**: Government embassies, immigration bureaus, airlines, hotel direct contracts, official tourism boards. *Mandatory for visas, passport rules, safety advisories.*
- **TIER 2 (Verified)**: Curated travel guides (Lonely Planet, Michelin, Conde Nast, curated DashTiny guides).
- **TIER 3 (Community)**: Reddit, traveler posts, reviews, local tips.
- **TIER 4 (User Data)**: Traveler's private notes, past trip itineraries, uploaded tickets.

---

## 10. Structured Traveler Memory

Model memory into deterministic, typed schemas instead of free-form text dumps:

1. **Explicit Preferences**: Budget range, preferred airlines, seat preference (window/aisle), hotel class (boutique/luxury/resort), dietary restrictions, travel pace.
2. **Behavioral Signals**: Destinations viewed, hotels bookmarked, activities clicked, search frequency.
3. **Trip History**: Past destinations visited, past booking amounts, actual expenses incurred, completed itineraries.
4. **Derived Preferences**: Budget sensitivity score (0-1), luxury affinity, adventure propensity, family vs solo frequency.

Enables queries like: *"Recommend something like my last vacation in Bali, but with shorter flight time and under ₹35k."*

---

## 11. Structured Planner Output Schema

The AI Planner generates typed, machine-readable JSON objects that power the interactive map, timeline, budget calculator, and calendar export simultaneously:

```json
{
  "trip": {
    "title": "Bespoke 4-Day Goa Coastal & Heritage Passage",
    "destination": "Goa, India",
    "start_date": "2026-10-15",
    "end_date": "2026-10-19",
    "travellers": 2,
    "vibe": "Luxury Coastal Leisure"
  },
  "days": [
    {
      "day_number": 1,
      "date": "2026-10-15",
      "weather": "28°C Pleasant 🌤️",
      "items": [
        {
          "type": "hotel_checkin",
          "title": "Check-in at Taj Exotica Resort & Spa",
          "start_time": "11:00",
          "duration_minutes": 60,
          "location": { "name": "Benaulim, South Goa", "lat": 15.267, "lng": 73.924 },
          "cost": 18500,
          "source": "VERIFIED",
          "place_type": "H"
        },
        {
          "type": "dining",
          "title": "Chef’s Table Coastal Seafood Lunch",
          "start_time": "13:30",
          "duration_minutes": 90,
          "location": { "name": "Fisherman's Wharf", "lat": 15.228, "lng": 73.945 },
          "cost": 2200,
          "source": "AI_RECOMMENDED",
          "place_type": "R"
        },
        {
          "type": "activity",
          "title": "Sunset Heritage Walk at Cabo de Rama Cliff",
          "start_time": "17:00",
          "duration_minutes": 120,
          "location": { "name": "Cabo de Rama Fort", "lat": 15.088, "lng": 73.921 },
          "cost": 0,
          "source": "VERIFIED",
          "place_type": "TA"
        }
      ]
    }
  ],
  "budget": {
    "currency": "INR",
    "estimated_total": 42000,
    "breakdown": {
      "stays": 24000,
      "dining": 9000,
      "activities": 4000,
      "local_transit": 5000
    }
  }
}
```

---

## 12. The Core Screen: The Trip Workspace

The **Trip Workspace** is the heart of DashTiny. It replaces disjointed dashboards with a focused execution cockpit:

```
┌─────────────────────────────────────────────────────────────┐
│ ✦ Bespoke Goa Getaway • Oct 15–19 • 2 Travelers             │
│ ₹42,000 estimated • 2 Confirmed Bookings (IndiGo + Taj)    │
├─────────────────────────────────────────────────────────────┤
│ Overview     Day Schedule     Bookings     Budget     Map   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TODAY (Day 1)                                              │
│                                                             │
│  11:00  [H]  Taj Exotica Check-in (Pvt Villa)               │
│  13:30  [R]  Chef’s Table Coastal Seafood                   │
│  17:00  [TA] Cabo de Rama Sunset Cliff Walk                 │
│                                                             │
│                    INTERACTIVE MAP                          │
│              [Live Route • Radar Coordinates]               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ✨ DashTiny Copilot: "Make today less tiring" | "Swap for sunset"│
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Embedded AI Throughout the UX (Not an Isolated Chatbot)

- **Explore**: *"Why am I seeing this?"* -> Shows memory reasoning (e.g. *"You favored quiet beach villas over party hubs on your last 2 searches"*).
- **Planner**: *"Make this trip ₹8,000 cheaper without dropping 4-star stays."*
- **Schedule**: *"Move the beach visit to sunset and find dining within 10 min walk."*
- **Budget**: *"Where can our squad save on flights?"*
- **Active Trip**: *"I have 2 hours free before dinner. What can we visit nearby?"*
- **Community**: *"Fork this 5-day Kerala itinerary into my active Trip Workspace."*

---

## 14. Canonical AI Proposal Lifecycle (`Proposal → Accept → Revision`)

In DashTiny, AI never directly mutates a Trip. AI proposes structured diffs, the traveler reviews them in the UI, and only an explicit Accept action executes an authoritative mutation:

```
User instruction (DAIna)
         ↓
POST /api/v1/ai/proposals
(Trip unchanged, no revision created, TripProposal persisted)
         ↓
Traveler inspects proposal card in UI
(Summary, changes, budget impact, verification provenance, base version)
         ↓
    ┌────────────┴────────────┐
    ↓                         ↓
[Accept]                  [Reject]
    ↓                         ↓
POST /ai/proposals/{id}/accept    POST /ai/proposals/{id}/reject
1. Lock Trip row (FOR UPDATE)     Mark proposal status = "rejected"
2. Verify proposal.parent_version == Trip.current_version (409 on conflict)
3. Apply diff via TripRevisionService
4. Create append-only TripRevision (version = N+1, action_type = AI_MODIFY_ITINERARY)
5. Persist AI telemetry run & mark proposal accepted
6. Commit PostgreSQL transaction
```

### Append-Only Revision & Multi-Step Undo Model
1. **Resulting State Semantics**: `TripRevision N` stores the complete canonical Trip state **AFTER** mutation $N$. Revisions serialize and capture the post-mutation resulting state, never the pre-mutation state.
2. **Initial Baseline at Creation**: As soon as a Trip is created, `INITIAL_CREATION` revision $v_1$ is committed alongside the trip and its days. AI proposal generation strictly inspects existing revisions and never lazily mutates trip history.
3. **No External Lookups in DB Mutations**: Geocoding and location verification take place strictly in the proposal/research layer (`create_ai_proposal`). The resulting proposal diff contains pre-verified coordinates (`lat`, `lng`, `location_source="GEOCODED"`). `TripRevisionService.apply_activity_diff()` executes as a pure, fast PostgreSQL mutation without external network dependencies.
4. **Append-Only History**: Historical `TripSnapshot` records are strictly immutable. They are never modified or flagged with `action = "reverted"`.
5. **Deterministic Versioning**: Every mutation (initial creation, manual activity add/delete/reorder, AI proposal accept) increments the monotonic version $v(N+1)$ with `parent_version = N`.
6. **Multi-Step Undo & Server Authority**: Undoing (`POST /api/v1/trips/{id}/undo`) creates a brand new revision with `action_type = "UNDO"` and records `restored_from_version = target_version`. Consecutive undos follow the `parent_version` chain backward ($v_4 \to v_3 \to v_2 \to v_1$) while appending new snapshots ($v_5, v_6, v_7$). The UI fetches canonical server state after undo rather than reconstructing deleted items client-side.
7. **Compatibility Wrapper**: `POST /api/v1/ai/query` behaves strictly as a non-mutating compatibility wrapper around proposal generation, returning `proposal_id` and structured diffs without mutating the database.

---

## 14.1 Provider Abstraction & Location Domain Architecture

### Provider Abstraction Wiring
Search endpoints (`/api/v1/bookings/search/flights`, `/api/v1/bookings/search/hotels`) are decoupled from specific booking engines through `FlightProvider` and `HotelProvider` abstract base classes, wired to `CuratedFlightProvider` and `CuratedHotelProvider`.
- All returned offers carry `CURATED` provenance, `ESTIMATED` availability, and current catalog pricing.
- Live OTA provider integrations (e.g., live Skyscanner, Booking.com, Airbnb APIs) are deferred to subsequent development phases.

### Location Domain & Airport Search
Airports and transportation hubs are persisted in the PostgreSQL `airports` table:
- `GET /api/v1/locations/search?q=` provides server-authoritative autocomplete across IATA code, name, city, state, and country.
- `GET /api/v1/locations/airports/{iata_code}` retrieves airport details by canonical code.
- Client airport helpers (`src/lib/airports.ts`) do not guess or fallback to Goa (`GOI`) for unknown destinations; unresolved locations remain clean (`""`).


---

## 15. The North-Star Product Loop & Strategic Moat

```
                     DISCOVER
                        ↓
                   GET INSPIRED
                        ↓
                      PLAN
                        ↓
                    OPTIMIZE
                        ↓
                     COMPARE
                        ↓
                      BOOK
                        ↓
                    EXPERIENCE
                        ↓
                     CAPTURE
                        ↓
                      SHARE
                        ↓
                  REMEMBER / LEARN
                        ↓
                  PERSONALIZE NEXT
                        ↺
```

### The DashTiny Moat
Anyone can build an AI chatbot. DashTiny's enduring moat is:
$$\text{Moat} = \text{Traveler Memory} + \text{Trip Graph} + \text{Real-time Inventory} + \text{Trust Governance} + \text{Workspace Actions}$$

---

## 16. Canonical Trip Context & Privacy Safety Governance

### 16.1 Canonical `TripSummary` API Contract
To prevent inconsistent client fallbacks across pages (e.g., guessing origins, assuming 1 or 2 travelers, or missing budget limits), all DashTiny layers communicate via a canonical `TripSummary` DTO:

```typescript
interface TripSummary {
  id: string;
  title: string;
  destination: string;
  destination_id?: string;
  origin?: string;          // e.g., "DEL", "BLR", "BOM"
  start_date: string;
  end_date: string;
  travellers: number;       // Party size (1..N)
  budget: number;
  currency: string;
  persona: string;          // solo, couple, family, nomad, business
  vibe?: string;            // cultural, beach, adventure, luxury
  status: 'draft' | 'active' | 'completed';
  is_public: boolean;       // Privacy boundary enforcement
  source_trip_id?: string;  // Lineage tracking for adapted itineraries
  bookingsCount?: number;
  daysCount?: number;
}
```
All frontend surfaces (`Dashboard`, `Planner`, `Bookings`, `Community`, `Trips`, `DAIna`) consume this singular model.

### 16.2 Public Trip Privacy & Snapshot Safety
Unauthenticated public access via `GET /api/v1/trips/{trip_id}/public` is strictly governed:
1. **Privacy Boundary**: An itinerary is only returned if `is_public == True` or explicitly linked as the `source_trip_id` of a published `CommunityPost`. Private, draft, or unshared itineraries return `HTTP 404 Not Found`.
2. **Safe ORM Serialization**: Relational entities (`ItineraryActivity`) are queried and safely serialized with attribute fallbacks, avoiding `AttributeError` on ORM models.
3. **Deterministic Identifier Matching**: Querying by destination substring is prohibited; snapshots only resolve against exact database IDs or explicit demo identifiers (`trip_1`, `trip_2`).
4. **Adaptation Integrity**: The frontend never replaces a failed public trip lookup with hardcoded Kyoto highlights; it surfaces an explicit error state and retry control. Only explicit demo links (`demo=true`) use curated demo highlights.

### 16.3 Booking Flow Truth & Provider Deep-Linking
1. **Context Continuity**: Navigating to Bookings from a Trip automatically populates `flightOrigin = trip.origin` and `passengers = trip.travellers` without arbitrary hardcoding.
2. **User-Initiated Search**: Search queries fire on explicit user action ("Search flights" / "Update results"), preventing premature empty-query network errors and keystroke spam.
3. **Honest Deep-Linking**: Partner offers feature two distinct actions:
   - `[ Book on Provider ↗ ]`: Opens the third-party booking portal via deep-link.
   - `[ Already booked? Add confirmation reference ]`: Explicitly acknowledges that booking occurs externally and lets the traveler attach their PNR/confirmation reference to DashTiny.

---

## 17. Location & Airport Discovery Domain Architecture (L1 Migration)

### 17.1 Canonical Location Pipeline
```
Legacy Sources (indiaAirport.json + airportData.ts)
                    ↓
One-Time Ingestion (backend/scripts/import_airports.py)
                    ↓
Normalized PostgreSQL Domain (airports table, Alembic 3900ef1a1170)
                    ↓
FastAPI Location Service (GET /api/v1/locations/search & /airports/{iata})
                    ↓
Unified API Client (apiService.searchLocations & apiService.getAirport)
                    ↓
Next.js Reusable Autocomplete (AirportAutocomplete component)
                    ↓
Planner & Bookings Integration (Flight Origin / Destination)
```

### 17.2 Deterministic Ranking Algorithm
Airport autocomplete queries execute database-side ranking using SQL `case`:
1. **Weight 100**: Exact 3-letter IATA code match (`upper(iata_code) = upper(:q)`)
2. **Weight 90**: Exact airport name match (`lower(name) = lower(:q)`)
3. **Weight 80**: Exact city name match (`lower(city) = lower(:q)`)
4. **Weight 70**: IATA code prefix match (`iata_code ilike :prefix`)
5. **Weight 60**: City name prefix match (`city ilike :prefix`)
6. **Weight 50**: Airport name prefix match (`name ilike :prefix`)
7. **Weight 40**: Token substring match in normalized `search_text`

Bounded result limit defaults to 10 (maximum 50). Deactivated airports (`is_active = False`) are excluded.

### 17.3 Provenance & Zero Silent Fallbacks
- Airport reference data carries explicit provenance: `provenance = "REFERENCE_DATASET"`.
- Coordinates are authoritative reference values, not live telemetry.
- **Zero Fallback Rule**: Unknown destination or origin inputs remain strictly unresolved (`null` / empty string). The legacy practice of silently mapping unknown cities to Goa (`GOI`) is permanently abolished.

### 17.4 What Was Intentionally NOT Ported
| Legacy Component | Rejection Rationale |
| :--- | :--- |
| **Angular Service (`airport-data.service.ts`)** | Replaced by Next.js React component + `apiService.searchLocations`. |
| **RxJS Observables & BehaviorSubjects** | Replaced by React state hooks, debounced fetch, and standard async/await. |
| **SQLite Runtime (`airports.db`, `flights.db`)** | Discarded; SQLite is strictly prohibited in runtime. PostgreSQL is single source of truth. |
| **Client-Side Hardcoded Registry (`src/lib/airports.ts`)** | Deprecated; downgraded to a legacy compatibility shim. Must not override backend search. |
| **Legacy Express Davinci Server (`server.js`)** | Deprecated legacy wrapper; replaced by FastAPI + LangGraph. |
| **Legacy Mongoose Backend (`db.js`)** | Discarded MongoDB; PostgreSQL with relational foreign keys and migrations is used. |
| **Client-side API Credentials** | Plaintext keys from legacy `environment.ts` were discarded; backend `.env` manages secrets. |

4. **Server-Authoritative Rewards**: Booking references and community actions reflect server-calculated reward coin balances (`setCoins(response.total_coins)`), eliminating double-awarding and client-side balance desynchronization.

