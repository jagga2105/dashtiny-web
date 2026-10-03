# 🌍 DashTiny — Comprehensive Architecture & State Audit
**Document Date:** October 2026  
**Reference Document:** DashTiny Master Development Guide (Items 0–89)  
**Repository:** [https://github.com/jagga2105/dashtiny-web](https://github.com/jagga2105/dashtiny-web)

---

## 1. Executive Summary

DashTiny is an intelligent travel platform where **`Trip`** is the central domain node. Its purpose is to unify discovery, planning, optimization, comparison, booking management, squad collaboration, and memories into a single seamless cockpit.

This document constitutes the authoritative audit of the current repository against the Master Development Guide. It identifies what works, what is incomplete, what is broken, technical debt, and prioritizes the next implementation tasks.

---

## 2. CURRENT: What Works

### Backend & Database Architecture
- **PostgreSQL 22-Table Relational Schema**: Clean SQLAlchemy 2.0 ORM mapping covering:
  - `users`, `user_profiles`, `traveler_memories`
  - `itineraries`, `itinerary_days`, `itinerary_activities`, `trip_snapshots`
  - `bookings`, `booking_aggregation_cache`, `price_alerts`
  - `squad_rooms`, `squad_members`, `squad_expenses`
  - `ai_runs`, `ai_tool_calls`
  - `sanctuaries`, `drive_escapes`, `community_posts`, `post_likes`
  - `reward_vouchers`, `reward_transactions`, `reward_redemptions`
- **Alembic Migrations**:
  - Canonical initial migration `c1bcb4ec0acc_initial_dashtiny_schema.py` executes cleanly from scratch against an empty PostgreSQL database via `python init_db.py` and `alembic upgrade head`.
  - Zero schema drift: `alembic check` reports *"No new upgrade operations detected"*.
- **Database Safety Constraints**:
  - CheckConstraints enforce bounds: `ck_user_trust_score` (0–100), `ck_memory_confidence` (0.0–1.0), `ck_booking_amount` ($\ge 0$), `ck_voucher_coin_cost` ($\ge 0$), `ck_reward_tx_balance_after` ($\ge 0$), `ck_squad_expense_amount` ($\ge 0$), `ck_activity_duration` ($\ge 0$), `ck_activity_transit` ($\ge 0$), `ck_snapshot_version` ($\ge 1$).
  - UniqueConstraints enforce business rules: `uq_trip_snapshot_version`, `uq_reward_voucher_code`, `uq_provider_pnr_ref`, `uq_user_voucher_redemption`, `uq_post_user_like`, `uq_user_memory_key`.
  - Foreign key cascades (`ON DELETE CASCADE`) are active for trips, days, activities, snapshots, and squad rooms.
- **Authoritative Concurrency-Safe Reward Engine**:
  - `award_rewards()` acquires row lock on `UserProfile` (`with_for_update()`) first.
  - Idempotency key verified within the lock; duplicate requests return existing balance without double-awarding coins.
  - Negative coin deductions exceeding balance raise controlled `ValueError("Insufficient reward coins...")`—never silently clamped to zero.
  - `RewardTransaction` insert wrapped in a nested savepoint (`db.begin_nested()`) to defensively catch duplicate idempotency races without invalidating outer caller transactions.
  - `POST /rewards/redeem` locks profile first, prevents duplicate redemptions, and writes audit transactions atomically.
- **Testing & Verification**:
  - 50/50 tests passing in `backend/tests/`:
    - 41 fast in-memory SQLite unit/API tests.
    - 9 real PostgreSQL integration tests (`test_postgres_integration.py`) verifying migration from scratch, TripSnapshot observability, 5 unique constraints, 8 check constraints, FK cascades, and multi-threaded concurrency.

### API & Domain Capabilities
- **Authentication**: Email + password registration/login, Google OAuth login, and Demo login with atomic user + profile creation.
- **Planner Agent (`POST /planner/generate`)**: Canonical `PlannerRequest` with date validation, budget parsing, travel tools (flights, stays, weather, spatial coordinates), and persistence into `itineraries`, `itinerary_days`, and `itinerary_activities`.
- **Trip Workspace (`GET /trips/my-trips`, `GET /trips/{id}`)**: Multi-tab execution cockpit (Plan, Route Map, Bookings, Budget, Squad).
- **Diff-Based AI Modification & Rollback**: `POST /ai/query` executes natural language instructions, increments snapshot version monotonically, retains stable activity IDs, and records observability fields (`action_type`, `actor_type`, `instruction`, `model`). `POST /trips/{id}/undo` restores state from snapshot.
- **Community Feed & Privacy**: `GET /community/feed`, `POST /community/posts`, `POST /community/posts/{id}/like`. Unauthenticated `GET /trips/{id}/public` strictly rejects private trips with HTTP 403. Truthful identity verification displays verified badge only when `user.is_verified == True`.
- **Bookings Aggregation**: Parameterized search for flights & hotels without hardcoded city fallbacks. Booking reference creation with truthful `USER_PROVIDED` / `UNVERIFIED` provenance badge.

---

## 3. INCOMPLETE: Partially Implemented

1. **TripContext Cross-Page Continuity (Master Guide Items 4, 5, 6)**:
   - While URL params (`?tripId=...`) pass trip IDs in some transitions, there is no centralized, client-side canonical `TripContext` provider or Zustand store holding the authoritative active trip across Explore $\rightarrow$ Plan $\rightarrow$ Trips $\rightarrow$ Bookings $\rightarrow$ Community.
   - Example: Navigating from `/trips` to `/bookings` without an explicit query string defaults to `tripsData[0]` instead of the active trip the user was viewing.
2. **Airport Domain (Master Guide Item 36)**:
   - Legacy Angular had a structured airport model with IATA, ICAO, city, country, lat/long, and timezone.
   - Next.js currently has a static file `src/lib/airports.ts` with only ~15 hardcoded airports. There is no backend `/airports/search` or autocomplete endpoint.
3. **Structured Destination Entity (Master Guide Item 35)**:
   - `Itinerary.destination` remains a free-form string (e.g. `"Kyoto"`, `"Tokyo, Japan"`). A normalized `destinations` table with geo-bounds, currency, timezone, and airport associations is not yet modeled.
4. **Contextual Day Suggestions Panel (Master Guide Item 45)**:
   - In the Trip Workspace Day schedule, travelers cannot currently click a contextual "+ Add Stay / Food / Activity" suggestion panel that recommends options tailored to that day's time slot, location, and remaining budget.
5. **Itinerary PDF Export (Master Guide Item 47)**:
   - Trip Workspace lacks an "Export PDF" feature generating a clean offline summary from the authoritative Trip API.
6. **Long-Trip Chunking (Master Guide Item 46)**:
   - Planning requests for 8+ days generate all days in a single monolithic pass without segment continuity validation (e.g. Day 1–3, Day 4–6).

---

## 4. BROKEN: Known Runtime & Logic Problems

1. **Global DAIna $\rightarrow$ Planner Context Loss (Master Guide Items 6, 12)**:
   - In `DAInaChatWidget.tsx`, when an itinerary is proposed in chat, clicking *"Refine in Planner →"* routes to `/planner?tripId=...` or `/planner?destination=...`.
   - However, `/planner/page.tsx` primarily consumes `?query=...` or `?source_trip_id=...`. When `?tripId=...` is passed, the Planner does not fetch and load the existing trip into the Planner canvas; instead, it renders an unpopulated prompt input!
2. **Hardcoded Fallback Highlights in Planner (Master Guide Items 5, 77)**:
   - `src/app/planner/page.tsx` contains `getFallbackHighlights(dest, sourceId)` with hardcoded checks for `"trip_1"`, `"kyoto"`, `"japan"`, `"trip_2"`, and `"goa"`.
   - This directly violates Guide Item 5 (*"Avoid frontend fallbacks such as BLR, Goa, Kyoto..."*) and Item 77 (*"Never fix a bug by hiding it"*). When a network or backend failure occurs, the UI must display a truthful error state with retry, not hardcoded mock highlights.
3. **Trip Checklist Resetting on Refresh (Master Guide Items 4, 76)**:
   - In `src/app/trips/page.tsx`, the packing checklist (`DEFAULT_CHECKLIST`) is held purely in ephemeral React state (`useState(DEFAULT_CHECKLIST)`). User checks/unchecks are never saved to PostgreSQL and reset upon page refresh.

---

## 5. DUPLICATED LOGIC

1. **Travel Intent Parsing (Master Guide Items 10, 11, 12)**:
   - Implemented twice:
     - Client-side: `src/lib/dainaIntentParser.ts` (regex parsing for destination, budget, dates, companions).
     - Server-side: `backend/app/api/v1/chat.py` (regex parsing for destination, budget, days count).
   - This leads to divergent interpretations of the same natural-language prompt between the hero input and chat widget.
2. **API Client Layers (Master Guide Item 50)**:
   - `src/services/api.ts` is the active unified client, while `src/lib/api.ts` exists as a deprecated re-export wrapper.

---

## 6. TECHNICAL DEBT

1. **Monolithic Page Files**:
   - `src/app/trips/page.tsx`: 1,690 lines (88 KB).
   - `src/app/bookings/page.tsx`: 1,095 lines (54 KB).
   - `src/app/planner/page.tsx`: 875 lines (47 KB).
   - `src/app/dashboard/page.tsx`: 927 lines (41 KB).
   - Entire sub-features (interactive SVG route map, squad modal, copilot proposal cards, itinerary day cards) are inlined inside page components rather than split into reusable components.
2. **State Store Divergence (Master Guide Item 49)**:
   - `usePlannerStore.ts` stores `currentItinerary` in Zustand, while `src/app/trips/page.tsx` maintains its own `trips` state and `src/app/planner/page.tsx` maintains separate state. Zustand should hold active trip reference/ID and UI state, with PostgreSQL as the single source of truth.

---

## 7. SECURITY & AUTHORIZATION STATUS

- **Hard Authentication Boundaries**: Verified across `/trips/*`, `/bookings/*`, `/rewards/*`, and `/ai/*`.
- **Public Trip Exposure**: Fixed and verified by tests (`test_private_trip_cannot_be_accessed_via_public_endpoint`). Only trips with `is_public == True` or explicit community publication tokens are exposed.
- **Ownership Verification**: All activity updates/deletions and snapshot rollbacks strictly verify `trip.owner_id == user.id`.
- **Credential Safety**: No hardcoded API keys or legacy Angular credentials present in codebase.

---

## 8. DATA MODEL & SCHEMA GAPS

| Entity | Current Status | Master Guide Alignment | Action Required |
| :--- | :--- | :--- | :--- |
| **`TripChecklist`** | Missing from DB (local React state only) | Attached to `Trip` in domain model | Add `trip_checklist_items` table or JSON field in `itineraries` |
| **`Destination`** | Stored as raw string `itineraries.destination` | Needs structured entity with timezone/bounds | Model `destinations` table in Phase 2 |
| **`Airport`** | Static 15-item TypeScript array | Needs backend model & autocomplete API | Add airport model & search endpoint |
| **`Offer` Schemas** | Ad-hoc dicts in flight/hotel search | Normalized `FlightOffer` & `HotelOffer` | Codify Pydantic/TypeScript offer contracts |

---

## 9. UX & PRODUCT PHILOSOPHY STATUS

- **Visual Style**: Calm, premium warm off-white (`#FAFAF9`), slate typography, orange accent (`#EA580C`), emerald verification badges.
- **Navigation (Master Guide Item 8)**: Clean 4-destination navigation: Explore (`/dashboard`), Plan (`/planner`), Trips (`/trips`), Community (`/community`).
- **Trust Terminology (Master Guide Items 20, 67)**:
  - `VERIFIED`: Provider-confirmed.
  - `CURATED`: DashTiny-selected.
  - `AI_GENERATED`: DAIna-generated recommendation.
  - `ESTIMATED`: Price or duration calculations.
  - `USER_PROVIDED`: Traveler-entered references.
- **Rewards Terminology (Master Guide Item 69)**:
  - Standardized as **Travel Credits** in user-facing UI; need to audit remaining references to "coins" in legacy copy.

---

## 10. AI CAPABILITIES STATUS

- **Planner Agent**:
  - LLM provider abstraction configured via `LLM_PROVIDER` (`gemini`, `groq`, `ollama`, `openai`).
  - Spatial verification ensures activities fall within destination bounds (e.g., rejects Tokyo stops in a Kyoto trip).
  - Snapshot engine creates monotonic versions on every AI mutation (`POST /ai/query`).
  - Server-side Undo (`POST /trips/{id}/undo`) restores exact database state.

---

## 11. PROVIDERS STATUS

- **Flight & Hotel Search**:
  - Deterministic parameter-driven mock engine.
  - Stale search indicators implemented in UI.
  - Live API sandboxes (Amadeus/Skyscanner) deferred to P2 as per architecture roadmap.

---

## 12. LEGACY ANGULAR CONCEPTS: EVALUATION

| Legacy Angular Concept | Recommendation | Rationale |
| :--- | :--- | :--- |
| **Airport Autocomplete** | **ADAPT (P1)** | Essential for realistic flight searches from any global origin. |
| **Contextual Suggestion Panel** | **ADAPT (P1)** | Enhances Trip Workspace by allowing inline additions without typing prompts. |
| **Itinerary PDF Export** | **ADAPT (P1)** | Highly requested traveler utility for offline travel and visa submissions. |
| **Persistent Packing Checklist** | **ADAPT (P0)** | Trip domain includes checklist; currently lost on page refresh. |
| **Long-Trip Chunking** | **ADAPT (P2)** | Essential for 10+ day itineraries to prevent LLM context degradation. |
| **Travel Timeline on Profile** | **ADAPT (P2)** | Strong driver for traveler memory and repeat engagement. |
| **Angular Architecture / RxJS** | **DO NOT PORT** | Violates Master Guide Items 1 & 2. |

---

## 13. PRIORITIZED IMPLEMENTATION PLAN

### Phase 1: P0 — Critical Context & Persistence Invariants (Immediate)
1. **Canonical Client-Side `TripContext`**:
   - Establish unified active trip state in `usePlannerStore` / `TripContext`.
   - Ensure transitions across Planner $\rightarrow$ Trip Workspace $\rightarrow$ Bookings $\rightarrow$ Community seamlessly pass and maintain the active trip without falling back to arbitrary defaults.
2. **Fix Global DAIna $\rightarrow$ Planner Handoff**:
   - When user clicks *"Refine in Planner →"* in chat, `/planner` must load the exact created trip and its days/activities into the interactive Planner canvas.
3. **Purge Hardcoded Fallback Itineraries in Planner**:
   - Remove `getFallbackHighlights()` in `src/app/planner/page.tsx`.
   - Replace with truthful loading, error, and empty states.
4. **Persist Trip Checklist to Database**:
   - Add checklist persistence (e.g. `checklist_items` JSON column or relation on `Itinerary`) so packing/document progress is retained across devices and sessions.

### Phase 2: P1 — Core Experience & Tooling
5. **Backend Airport Search & Autocomplete API**:
   - Add `/api/v1/airports/search?q=` with structured airport data (IATA, name, city, country, lat/long) adapted from legacy reference.
6. **Contextual Day Suggestion Panel in Trip Workspace**:
   - Add inline "+ Add Stay", "+ Add Meal", "+ Add Activity" suggestions tailored to the active day's location and remaining budget.
7. **Itinerary PDF Export**:
   - Add clean print/PDF export in Trip Workspace rendered from server trip data.
8. **Standardize Travel Credits Vocabulary**:
   - Ensure all UI surfaces and tooltips consistently use "Travel Credits".

### Phase 3: P2 — Advanced Capabilities
9. **Long-Trip Planning Segment Chunking** (for trips > 7 days).
10. **Profile Travel Timeline & Memory Management**.
11. **Live Partner API Sandbox Adapters**.
