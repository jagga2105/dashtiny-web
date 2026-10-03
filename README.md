# 🌍 DashTiny — Intelligent Travel Platform

> **Golden Engineering Rule**:  
> *"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."*

---

## 📌 Vision

DashTiny is an intelligent travel companion that unifies discovery, itinerary planning, inventory comparison, group collaboration, and active trip management into a single seamless platform.

It is **not** another generic online travel agency (OTA).  
It is **not** an open-ended hallucinating chatbot.

DashTiny eliminates the cognitive burden of juggling dozens of disjointed websites (Google Flights, Booking.com, Airbnb, TripAdvisor, Maps, Weather, and Visa portals) by organizing everything around a single persistent object: the **Trip**.

---

## 🏗️ Architecture: Experience-First Trip Graph

Every module in DashTiny — Explore, Planner, Search & Compare, Squad, and Trips — is an operational lens into assembling, optimizing, and executing a **Trip**:

```
User (Traveler Memory & Explicit Preferences)
 └── Trips
      ├── Destination & Route Geometry
      ├── Party Sizing (Solo / Couples / Family / Squad)
      ├── Dates & Time Pacing
      ├── Curated Hotel & Sanctuary Offers
      ├── Itinerary Days & Time-Slotted Activities
      ├── Budget Breakdown & Squad Expense Ledger
      ├── Weather Advisories & Geocoded Coordinates
      └── AI Observability & Provenance Telemetry
```

---

## 🛡️ Architectural Trust Boundaries & Provenance

DashTiny never presents hallucinated inventory, fabricated coordinates, or disguised data. Every data point in the UI carries an explicit provenance tier:

| Tier | Category | Examples | UI Treatment |
| :--- | :--- | :--- | :--- |
| **`VERIFIED`** | Official Policy, Geocoded Coordinates | Visa requirements, official embassy advisories, verified geocoded GPS | Green verification badge, official source citation, exact timestamp |
| **`CURATED`** | Curated Travel Catalog & Demo Inventory | Hand-selected local sanctuaries, heritage dining, catalog flight and stay offers (explicitly labeled `CURATED`, estimated availability, catalog pricing; **live external OTA provider integrations are not yet active**) | Curated badge, editorial review note, estimated fare pill |
| **`AI GENERATED`** | Pacing, Narrative, Route Optimization | Daily narrative, activity sequencing, slot allocation proposals | Subtle AI aura, editable pills, "Why recommended" tooltip |
| **`USER GENERATED`** | Community Posts, Traveler Reviews | Tips from fellow travelers, squad memories | Explorer trust score, traveler avatar |

> **Inventory Status Notice**: Live OTA provider connections (Booking.com, Skyscanner, Airbnb) are deferred to later phases. Current search endpoints query DashTiny's normalized provider abstraction (`CuratedFlightProvider`, `CuratedHotelProvider`) returning curated catalog offers.

---

## 🤖 Canonical AI Mutation Flow: Single Path Governance

DashTiny enforces exactly one authoritative mutation path for all AI adjustments:

```
Traveler Action / Copilot Prompt
             ↓
  POST /api/v1/ai/proposals
  (Calculates diffs, verifies geocodes in research layer; Trip remains UNTOUCHED)
             ↓
  Traveler inspects Proposal Card in UI
  (Summary, itemized additions/replacements, budget impact, parent version)
             ↓
  POST /api/v1/ai/proposals/{id}/accept
  (Row lock on Trip -> verifies parent version -> executes diff via TripRevisionService -> commits append-only TripRevision -> returns resulting Trip)
```

- Direct mutation from `POST /api/v1/ai/query` is completely disabled; it functions strictly as a non-mutating compatibility wrapper returning proposals.
- External API calls (such as geocoding) are strictly kept out of database mutation transactions; coordinates are resolved during proposal synthesis.
- Initial Trip creation immediately registers version 1 (`INITIAL_CREATION`), removing lazy baseline creation.

---

## ✈️ Flight Search, Comparison & Trip Attachment (L2)

DashTiny provides a modernized flight search and comparison experience integrated directly with the active **Trip Workspace**:

1. **Normalized Provider Abstraction**:
   - `GET /api/v1/bookings/search/flights` queries the canonical provider abstraction layer (`FlightProvider`).
   - Responses are normalized into 29-field `FlightOffer` objects with honest metadata envelopes (`total_offers`, `providers_queried`, `provenance="CURATED"`, `availability_state="ESTIMATED"`).
   - Modeled after contemporary carriers (IndiGo, Air India, Akasa Air, SpiceJet, Air India Express) with dynamic flight duration calculated from route coordinates. Zero defunct airlines (Vistara, Go First).
2. **Search & Filter UX**:
   - Powered by L1 PostgreSQL `AirportAutocomplete` with keyboard navigation and zero fallback to dummy codes.
   - Comprehensive filtering: stops (non-stop, 1 stop, 2+ stops), airlines, departure time slots, and dynamic price slider.
   - 5-way sorting: Cheapest, Fastest, Balanced, Earliest Departure, and Latest Departure.
   - Side-by-side comparison tray and modal for up to 3 flight offers highlighting differences in price, duration, baggage, and cancellation terms.
3. **Trip Context & Proposal Integration**:
   - Searches prefill origin, destination, and dates directly from the traveler's active Trip.
   - Selecting a flight triggers the canonical AI Proposal flow (`ATTACH_FLIGHT_OFFER`): non-mutating preview with budget impact, row locking on acceptance, automated Day 1 transit activity scheduling, pending `Booking` record creation, and append-only `TripRevision`.

---

## ⚡ Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: TailwindCSS with CSS variables & dark glassmorphic design system
- **State & Data**: React hooks, centralized API client, native Fetch
- **Motion & Icons**: Framer Motion, Lucide React

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **ORM & Database**: SQLAlchemy 2.0 with PostgreSQL (In-memory SQLite for testing)
- **Cache & PubSub**: Redis
- **Security**: Strict JWT authentication (HS256) via environment configuration
- **Validation**: Pydantic v2 schemas with 422 HTTP validation
- **Testing**: Pytest with automated integration test suite

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL & Redis (optional for local dev / testing)

### 2. ⚡ One-Command All-in-One Runner (Recommended)
You can start PostgreSQL, apply all migrations, seed reference datasets, launch the FastAPI backend, and start the Next.js frontend with a single command:

```bash
./start.sh
# or
npm run dev:all
```

This central script:
- Verifies and starts PostgreSQL (Homebrew or Docker).
- Automatically applies all Alembic migrations (`alembic upgrade head`).
- Seeds default vouchers and canonical airport datasets into `dashtiny_db`.
- Starts the FastAPI backend with hot-reload on `http://localhost:8000` (docs: `/docs`).
- Starts Next.js on `http://localhost:3000` with Turbopack.
- Gracefully shuts down all services cleanly upon `Ctrl+C` without dangling ports.

---

### 3. Individual Component Setup

#### Frontend Setup
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
pip install pytest httpx

# Configure environment
cp .env.example .env
# Edit .env to set your SECRET_KEY and database credentials

# Run database migrations with Alembic
alembic upgrade head
# Or run init_db.py which executes all Alembic migrations and seeds default vouchers
python3 init_db.py
# (Optional) Seed rich catalog getaways and demo user
python3 seed_data.py

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
API Documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 4. Running Backend Tests
```bash
cd backend

# Fast Unit Tests (In-memory SQLite)
./venv/bin/pytest tests/unit -v

# Real PostgreSQL Integration Tests
POSTGRES_TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dashtiny_empty_test" ./venv/bin/pytest tests/integration -v

# Verify Migration Integrity
./venv/bin/python scripts/verify_migrations.py
```

---

## 📡 API Reference Overview

For full technical specifications and governance rules, consult [ARCHITECTURE.md](file:///Users/kumkumpandey/Applications/dashtiny-web/ARCHITECTURE.md) and [docs/DASHTINY_CURRENT_STATE.md](file:///Users/kumkumpandey/Applications/dashtiny-web/docs/DASHTINY_CURRENT_STATE.md).

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/auth/register` | `POST` | Create a new traveler account |
| `/api/v1/auth/login` | `POST` | Authenticate with password or sandbox OTP and receive JWT |
| `/api/v1/auth/demo` | `POST` | Development/sandbox demo login (strictly gated behind `DEMO_MODE=true`) |
| `/api/v1/planner/generate` | `POST` | Synthesize multi-day itinerary with hybrid deterministic & optional LLM generation and spatial verification |
| `/api/v1/trips/my-trips` | `GET` | Fetch authenticated user's trips as canonical `TripSummary` objects |
| `/api/v1/trips/{id}` | `GET` | Retrieve complete trip workspace with days, activities, and budget (eagerly loaded) |
| `/api/v1/trips/{id}/public` | `GET` | Privacy-governed public trip snapshot (strictly requires explicit publication) |
| `/api/v1/trips/{id}/revisions` | `GET` | List versioned append-only Trip snapshots for audit and undo |
| `/api/v1/trips/{id}/undo` | `POST` | Server-authoritative append-only revision rollback |
| `/api/v1/locations/search` | `GET` | Autocomplete airports and hubs from PostgreSQL location domain |
| `/api/v1/locations/airports/{iata_code}` | `GET` | Retrieve airport metadata by IATA code |
| `/api/v1/ai/proposals` | `POST` | Generate structured diff proposal without mutating Trip |
| `/api/v1/ai/proposals/{id}/accept` | `POST` | Atomically lock Trip row, verify parent version, apply diff, create TripRevision, and record telemetry |
| `/api/v1/ai/proposals/{id}/reject` | `POST` | Mark proposal rejected without mutating Trip |
| `/api/v1/ai/query` | `POST` | Non-mutating backward-compatible wrapper returning proposals (Trip unchanged) |
| `/api/v1/bookings/search/flights` | `GET` | Query normalized curated flight offers (`CURATED / DEMO`) via provider abstraction layer |
| `/api/v1/bookings/search/hotels` | `GET` | Query normalized curated stay offers (`CURATED / DEMO`) via provider abstraction layer |
| `/api/v1/bookings/create` | `POST` | Attach booking reference to trip with server-authoritative reward coin tracking |
| `/api/v1/community/feed` | `GET` | Curated community feed with canonical `CommunityTripCard` attributes |
| `/api/v1/community/posts` | `POST` | Publish travel story linked to an active DashTiny trip (`source_trip_id`) |
| `/api/v1/community/posts/{id}/like` | `POST` | Concurrency-safe atomic post liking |
| `/api/v1/community/posts/{id}/fork` | `POST` | Fork public trip into private user-owned trip canvas |
| `/api/v1/squads` | `POST`, `GET` | Create squad room and list squads for trip |
| `/api/v1/squads/{id}/expenses` | `POST`, `GET` | Log squad expense and list expenses |
| `/api/v1/squads/{id}/summary` | `GET` | Database-calculated split math and member balances |
| `/health` | `GET` | Health endpoint reporting database and redis connectivity |

---

## 📄 License
DashTiny is developed under the MIT License.
