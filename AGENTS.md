# 🌍 DashTiny — Locked Product Architecture & Engineering Blueprint (v1)

> **Golden Engineering Rule**:  
> *"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."*

---

## 1. Experience-First Architecture: Central Object is `Trip`

The core architectural pivot is that **Trip** is the central node of the platform graph. Everything else attaches to the **Trip**.

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

### 🎯 MVP Core (Locked for Current Release)
1. **Explore**: Destination discovery + personalized recommendations + ambient travel radar.
2. **AI Planner**: The primary differentiator — multi-day itinerary architect generating structured objects.
3. **Trip Workspace**: The heart of DashTiny. The generated itinerary becomes a persistent, interactive, editable trip canvas.
4. **Search & Compare**: Curated and demo inventory aggregation (`CURATED / DEMO`) for flights, stays/hotels, and experiences via normalized provider schemas (live OTA integrations deferred to later phase).
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
- `FlightOffer`: Departure, arrival, stops, duration, baggage allowance, cancellation terms, price, deep link.
- `HotelOffer`: Name, star rating, address, room type, amenities, cancellation policy, per-night price, deep link.
- `ActivityOffer`: Title, category, duration, meeting point, inclusions, price, deep link.
- `TransportOffer`: Vehicle type, pickup, drop-off, driver details, price.

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

---

## 11. Structured Planner Output Schema

The AI Planner generates typed, machine-readable JSON objects that power the interactive map, timeline, budget calculator, and calendar export simultaneously.

---

## 12. The Core Screen: The Trip Workspace

The **Trip Workspace** is the heart of DashTiny. It replaces disjointed dashboards with a focused execution cockpit:
`Overview | Day Schedule | Bookings | Budget | Map | Ask DashTiny`

---

## 13. Embedded AI Throughout the UX (Not an Isolated Chatbot)

- **Explore**: *"Why am I seeing this?"*
- **Planner**: *"Make this trip ₹8,000 cheaper without dropping 4-star stays."*
- **Schedule**: *"Move the beach visit to sunset and find dining within 10 min walk."*
- **Budget**: *"Where can our squad save on flights?"*
- **Active Trip**: *"I have 2 hours free before dinner. What can we visit nearby?"*
- **Community**: *"Fork this 5-day Kerala itinerary into my active Trip Workspace."*

---

## 14. Canonical AI Proposal Lifecycle (`Proposal → Accept → Revision`)

In DashTiny, AI never directly mutates a Trip. The single authoritative lifecycle is:
1. **Proposal Generation (`POST /api/v1/ai/proposals`)**: DAIna generates a structured diff proposal without mutating the Trip or creating history records.
2. **Review in UI**: The traveler inspects the proposal card showing summary, activity diffs, budget impact, verification provenance, and parent version.
3. **Acceptance (`POST /api/v1/ai/proposals/{proposal_id}/accept`)**:
   - Acquires PostgreSQL row lock (`with_for_update()`) on `itineraries`.
   - Validates `proposal.parent_version == current_version`. If a concurrent change occurred, returns `HTTP 409 Conflict`.
   - Executes diff via `TripRevisionService`.
   - Creates append-only `TripRevision` (`version = N + 1`, `action_type = "AI_MODIFY_ITINERARY"`).
   - Records AI telemetry run and marks proposal accepted.
   - Commits PostgreSQL transaction atomically.
4. **Rejection (`POST /api/v1/ai/proposals/{proposal_id}/reject`)**: Discards proposal without modifying Trip or revisions.
5. **Append-Only History & Multi-Step Undo**:
   - Snapshots are never mutated or set to `action = "reverted"`.
   - Undoing (`POST /api/v1/trips/{id}/undo`) creates a new revision `v(N+1)` with `action_type = "UNDO"` restoring `v(target)`. Multiple undos follow the `parent_version` chain backward while appending new records.
6. **Compatibility Wrapper**: `POST /api/v1/ai/query` behaves as a non-mutating compatibility wrapper returning proposals.

---

## 15. The North-Star Product Loop & Strategic Moat

$$\text{Moat} = \text{Traveler Memory} + \text{Trip Graph} + \text{Real-time Inventory} + \text{Trust Governance} + \text{Workspace Actions}$$
