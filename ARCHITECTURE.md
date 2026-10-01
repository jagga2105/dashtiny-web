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
4. **Search & Compare**: Live inventory aggregation for flights, stays/hotels, and experiences.
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

## 14. Conversational / Action API (`POST /ai/query`) Returning Diffs

When editing a trip with AI, never regenerate the entire itinerary from scratch. Use an action model that calculates constraints and returns **what changed**:

```json
// POST /api/v1/ai/query
{
  "trip_id": "trip_goa_01",
  "instruction": "Make Day 2 morning more relaxed and move beach to sunset"
}

// Response:
{
  "summary": "Adjusted Day 2: Moved Palolem Beach to sunset (17:00) and replaced morning trek with leisurely brunch at Art Resort Cafe.",
  "changes": [
    { "action": "rescheduled", "item": "Palolem Beach Stroll", "from": "09:30", "to": "17:00" },
    { "action": "added", "item": "Brunch at Art Resort Cafe", "time": "11:00", "duration_minutes": 75 },
    { "action": "removed", "item": "Butterfly Beach 4-hour Trek" }
  ],
  "budget_impact": -800,
  "updated_day": { ... }
}
```

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
