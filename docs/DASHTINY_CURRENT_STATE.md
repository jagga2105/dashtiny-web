# 🌍 DashTiny — Comprehensive Architecture & State Audit
**Document Date:** October 2026  
**Reference Document:** DashTiny Master Development Guide & Next Phase Blueprint  
**Repository:** [https://github.com/jagga2105/dashtiny-web](https://github.com/jagga2105/dashtiny-web)  
**Canonical Branch:** `main`  
**Core Architectural Pivot:** *"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."*

---

## 1. Executive Summary

DashTiny is an intelligent travel platform where **`Trip`** (`itineraries` table) is the central domain node. The platform brings together destination exploration, AI-assisted itinerary building, booking reference aggregation, community sharing, squad split ledgers, and traveler memory into a unified cockpit.

This document provides a truthful, complete audit of the codebase as of the current milestone, documenting implemented features, partially implemented features, demo/curated mocks, missing functionality, API contracts, database relationships, mutation paths, and technical debt.

---

## 2. Actual Current Architecture

### 2.1 Backend Architecture
- **Framework**: FastAPI (Python 3.11) with SQLAlchemy 2.0 ORM.
- **Database**: PostgreSQL 16 (relational primary store) with Alembic migration versioning.
- **Session & Concurrency**:
  - Row-level locking (`with_for_update()`) on `UserProfile` (rewards) and `Itinerary` (versioned snapshots).
  - Explicit CheckConstraints and UniqueConstraints at the database level.
- **AI Architecture**:
  - Deterministic action tool layer (`app/ai/tools/itinerary.py`, `maps.py`, `weather.py`, `flight_search.py`, `hotel_search.py`).
  - Observability via `ai_runs` and `ai_tool_calls` tables recording prompts, latencies, tools called, and payloads.

### 2.2 Frontend Architecture
- **Framework**: Next.js 15 (App Router) with React 19, TypeScript, and TailwindCSS.
- **State Management**: Zustand stores (`useAuthStore`, `usePlannerStore`).
- **Design System**: Editorial aesthetic with Google Fonts (`Outfit` for display headings, `Plus Jakarta Sans` for body copy), warm alabaster `#FAFAF9` canvas, DashTiny orange `#FF5A00` accent, and Emerald `#059669` verification badges.

---

## 3. Database Relationships & Domain Model

The schema is managed by Alembic (`c1bcb4ec0acc` -> `291779e6eb26` -> `e766197b12d3`):

```
User (users)
  ├── 1:1  UserProfile (user_profiles)
  ├── 1:N  Itinerary (itineraries) [owner_id]
  │         ├── 1:N  ItineraryDay (itinerary_days) [itinerary_id]
  │         │         └── 1:N  ItineraryActivity (itinerary_activities) [day_id]
  │         ├── 1:1  SquadRoom (squad_rooms) [itinerary_id]
  │         │         ├── 1:N  SquadMember (squad_members) [squad_id, user_id]
  │         │         └── 1:N  SquadExpense (squad_expenses) [squad_id, paid_by_user_id]
  │         ├── 1:N  Booking (bookings) [trip_id]
  │         ├── 1:N  TripSnapshot (trip_snapshots) [trip_id, version]
  │         └── 1:N  CommunityPost (community_posts) [source_trip_id]
  ├── 1:N  Booking (bookings) [user_id]
  ├── 1:N  TravelerMemory (traveler_memories) [user_id, category, key]
  ├── 1:N  RewardTransaction (reward_transactions) [user_id]
  ├── 1:N  RewardRedemption (reward_redemptions) [user_id, voucher_id]
  ├── 1:N  PostLike (post_likes) [post_id, user_id]
  └── 1:N  PriceAlert (price_alerts) [user_id]
```

### Safety Constraints Active in PostgreSQL
- `ck_user_trust_score`: `trust_score >= 0.0 AND trust_score <= 100.0`
- `ck_user_profile_reward_coins`: `reward_coins >= 0`
- `ck_itinerary_budget`: `total_budget >= 0`
- `ck_day_number`: `day_number >= 1`
- `ck_activity_cost`: `cost_estimate >= 0`
- `ck_activity_duration`: `duration_minutes >= 0`
- `ck_activity_transit`: `transit_minutes >= 0`
- `ck_booking_amount`: `amount >= 0`
- `ck_squad_expense_amount`: `amount >= 0`
- `ck_voucher_coin_cost`: `coin_cost >= 0`
- `ck_reward_tx_balance_after`: `balance_after >= 0`
- `ck_snapshot_version`: `version >= 1`
- `uq_trip_snapshot_version`: `UNIQUE(trip_id, version)`
- `uq_provider_pnr_ref`: `UNIQUE(provider, pnr_ref)`
- `uq_post_user_like`: `UNIQUE(post_id, user_id)`
- `uq_user_voucher_redemption`: `UNIQUE(user_id, voucher_id)`
- `uq_user_memory_key`: `UNIQUE(user_id, category, key)`

---

## 4. Current API Contracts & Endpoints

| Endpoint | Method | Status | Provenance & Trust Behavior |
| :--- | :--- | :--- | :--- |
| `/auth/register` | `POST` | Implemented | Generates bcrypt hash; creates User + UserProfile atomically. |
| `/auth/login` | `POST` | Implemented | Validates bcrypt hash. **Defect**: sets password on first login for passwordless users. |
| `/auth/demo` | `POST` | Implemented | Creates sandbox user. **Defect**: not gated by `DEMO_MODE=true` setting. |
| `/auth/google` | `POST` | Stubbed (501) | **Defect**: Frontend catches 501 and silently logs into demo mode. |
| `/auth/me` | `GET` | Implemented | Returns authenticated user profile and live coin balance. |
| `/planner/generate` | `POST` | Implemented | Validates dates, generates days/activities, persists to PostgreSQL. |
| `/trips/my-trips` | `GET` | Implemented | Eager loads trips, days, activities, bookings, squad. |
| `/trips/{id}` | `GET` | Implemented | **Defect**: Inefficient inner query for activities in days loop (N+1). |
| `/trips/{id}/public` | `GET` | Implemented | Enforces `is_public` or community publication boundary. |
| `/trips/{id}/activities` | `POST` | Implemented | **Defect**: Silently falls back `day_id` -> `day_number` -> Day 1. |
| `/trips/{id}/activities/{act_id}` | `DELETE` | Implemented | Persistently removes activity; enforces trip ownership. |
| `/trips/{id}/undo` | `POST` | Implemented | **Defect**: Replaces trip with snapshot and marks snapshot as `reverted` (destructive undo). |
| `/ai/query` | `POST` | Implemented | **Defect**: Immediately mutates trip instead of proposal -> accept workflow; accepts `trip_id="latest"`. |
| `/bookings/search/flights` | `GET` | Curated/Demo | Curated mock corridors with passenger/cabin scaling. |
| `/bookings/search/hotels` | `GET` | Curated/Demo | Curated mock stays with guest/room scaling. |
| `/bookings/create` | `POST` | Implemented | Stores booking reference with `SAVED_REFERENCE` / `USER_PROVIDED`. Awards +50 coins via ledger. |
| `/community/feed` | `GET` | Implemented | Reads public community posts, enriches with dynamic user trust score. |
| `/community/posts` | `POST` | Implemented | Links post to owned trip, marks trip public, awards +20 coins via ledger. |
| `/community/posts/{id}/like` | `POST` | Implemented | Enforces unique like in `post_likes`. **Defect**: `count += 1` read-modify-write concurrency flaw. |
| `/squads/{id}/summary` | `GET` | Stubbed | **Defect**: Hardcoded mock response (`"GOA-2026-X9"`, `"Kumkum Pandey"`). |
| `/squads/{id}/expenses` | `POST` | Stubbed | **Defect**: Hardcoded mock response (`"exp_new_01"`). |
| `/rewards/vouchers` | `GET` | Implemented | Reads seeded `RewardVoucher` catalog. |
| `/rewards/transactions` | `GET` | Implemented | Authoritative ledger history for user. |
| `/rewards/redeem` | `POST` | Implemented | Deducts coins under row lock, creates redemption record. |

---

## 5. Functionality Categorization

### 5.1 Fully Implemented
- **PostgreSQL Persistence & Migrations**: Reproducible 22-table schema with Alembic versioning.
- **CheckConstraints & UniqueConstraints**: Full database-level bounds and uniqueness validation.
- **Authoritative Rewards Ledger**: Concurrency-safe `award_rewards` with row locks, negative balance rejection, and idempotency.
- **Dynamic Author Trust**: Derived on the fly from the `users` table (`trust_score`, `is_verified`).
- **Private Trip Boundary**: Unauthenticated requests to private trips return HTTP 404 / 403.
- **Trip Workspace Day Navigation**: Day stepping, multi-day jump, non-destructive activity removal.

### 5.2 Partially Implemented / Defects Requiring Correction
1. **AI Trip Mutation Flow (Item 8)**: `POST /ai/query` mutates the trip immediately. Must be replaced with `POST /ai/proposals` (diff only) $\rightarrow$ explicit user approval via `POST /ai/proposals/{id}/accept`.
2. **Trip Revision Service & Append-Only Undo (Items 9 & 10)**: Snapshot creation logic is inlined in `ai.py` and `trips.py`. Undo mutates the snapshot record to `"reverted"` rather than appending an `UNDO` revision.
3. **Authentication Boundaries (Item 4)**:
   - Google login in frontend catches failure and silently signs in as Demo Explorer.
   - Demo mode `/auth/demo` is not gated by `DEMO_MODE=true` environment setting.
   - Passwordless accounts silently accept first supplied password in `/auth/login`.
4. **Hidden Trip Defaults (Item 5)**: `POST /ai/query` accepts `"latest"`, `""`, or `null`. Frontend constructs `activeTrip.id || 'latest'`.
5. **Fake Factual Fallbacks (Item 6)**: Trips API and frontend fallback to `"28°C Sunny ☀️"`. Weather and inventory must report `"Weather unavailable"` or explicit `ESTIMATED`/`CURATED` provenance.
6. **Frontend Reward Manipulation (Item 7)**: Frontend calls `updateCoins(+20)` or `updateCoins(-cost)` locally instead of relying strictly on server balance.
7. **Activity Placement Fallback (Item 11)**: `POST /trips/{id}/activities` falls back from `day_id` to `day_number` to Day 1.
8. **N+1 Query in Trip Details (Item 12)**: `GET /trips/{id}` queries activities inside a per-day loop.
9. **Community Like Concurrency (Item 17)**: `post.likes_count = post.likes_count + 1` read-modify-write without atomic update; exposes `comments_count = 0`.
10. **Curated Inventory Abstraction (Item 18)**: Flight and hotel tools return raw dicts instead of normalized `FlightProvider` / `HotelProvider` offer models.

### 5.3 Demo / Curated Mocks
- **Flight & Hotel Search**: Parameterized mock catalog (`CURATED`).
- **Weather Tool**: Curated seasonal profiles for 8 hubs, heuristic fallback (`DEMO`) for unknown destinations.
- **Public Community Snapshots**: `trip_1` (Kyoto) and `trip_2` (Goa) hardcoded snapshots.

### 5.4 Missing Functionality
- Real Squad API backed by PostgreSQL (`POST /squads`, `POST /squads/{id}/members`, `GET /squads/{id}/summary`, `POST /squads/{id}/expenses`).
- Community Forking API (`POST /community/posts/{id}/fork`) creating a new trip owned by the current user.
- Health check endpoint (`GET /health`) checking database and Redis connectivity.
- Canonical frontend TypeScript domain types (`src/types/trip.ts`).

---

## 6. Critical Mutation Paths

### 6.1 Authentication Path
```
Client Request -> POST /auth/register or /auth/login
  -> Password verified via bcrypt
  -> JWT access token minted with sub=user.id
  -> Returned with serialize_user(user, db)
```

### 6.2 Trip Creation Path
```
Client Request -> POST /planner/generate
  -> Validates dates, budget, travelers
  -> Calls travel tools (weather, stays, flights, coordinates)
  -> Inserts Itinerary, ItineraryDay, ItineraryActivity
  -> Creates SquadRoom
  -> Commits atomically
```

### 6.3 Current AI Mutation Path (FLAWED)
```
Client -> POST /ai/query { trip_id, instruction }
  -> Trip locked via with_for_update()
  -> Allocates TripSnapshot
  -> Modifies ItineraryActivity rows in-place (MUTATES TRIP IMMEDIATELY)
  -> Logs AIRun and AIToolCall
  -> Commits immediately
```

### 6.4 Required Proposal -> Accept Path (TARGET ARCHITECTURE)
```
Client -> POST /api/v1/ai/proposals { trip_id, instruction }
  -> Validates trip ownership
  -> Generates diff: { proposal_id, changes, before, after, verification, provenance }
  -> PERSISTS PROPOSAL RECORD WITHOUT MUTATING TRIP
Client -> User reviews diff in UI
Client -> POST /api/v1/ai/proposals/{proposal_id}/accept
  -> Locks Trip row
  -> Verifies proposal matches current revision
  -> TripRevisionService.create_revision(type="AI_PROPOSAL_ACCEPTED")
  -> Applies activity diff
  -> Commits atomically
```

### 6.5 Reward Mutation Path (AUTHORITATIVE)
```
Client Action (Booking saved, Trip shared, Voucher redeemed)
  -> Calls backend endpoint
  -> award_rewards(user_id, delta, idempotency_key, reference)
  -> Row lock on UserProfile (with_for_update)
  -> Inserts RewardTransaction
  -> Updates UserProfile.reward_coins
  -> Commits atomically
  -> Returns authoritative total_coins
  -> Frontend: setCoins(serverBalance)
```

---

## 7. Known Technical Debt
1. **Monolithic Page Files**: `src/app/trips/page.tsx` (>1,600 lines), `src/app/bookings/page.tsx` (>1,000 lines).
2. **Zustand vs PostgreSQL Divergence**: Stores hold itinerary copies that can get stale if not re-synchronized from GET `/trips/{id}`.
3. **Misleading Marketing Terms**: Instances of "verified gastronomy", "Sunny 28°C", "real-time" across planner copy that lack live provider backing.
4. **CORS Hardcoding**: Backend CORS allows wildcard origins rather than reading from environment.

---
*End of Audit. Next phase engineering proceeds with P0 migration reliability, auth boundaries, AI proposal engine, Trip revision service, and real Squad API.*
