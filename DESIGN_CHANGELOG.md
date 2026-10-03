# 🌍 DashTiny Web — Active Design System & Architecture Changelog

This document logs the active design language, typography tokens, color palette, and component patterns across **DashTiny** (Intelligent Travel Platform & AI Companion DAIna).

---

## 🎨 Active Design Language & Aesthetic Tokens

- **Design Philosophy**: Calm, premium, visual-first editorial travel companion. 
  - *"One primary action per screen. Never overwhelm users. Travel is emotional. Every screen should inspire."*
- **Typography**:
  - **Display / Editorial Headings**: Google `Outfit` (`--font-display` / `.font-display`, aliased to `.font-serif-editorial` for compatibility) — Modern, humanist, warm geometric display sans-serif (weights: 400 to 900).
  - **Body / Interface Copy**: Google `Plus Jakarta Sans` (`--font-sans`) — Highly legible, contemporary typography for UI components and reading (weights: 400 to 800).
- **Color Palette**:
  - **Canvas Background**: Warm Alabaster Off-White (`#FAFAF9` and `#F8FAFC`) with subtle ambient atmospheric glows (`bg-orange-200/20`, `bg-sky-200/20`).
  - **Brand Primary Accent**: DashTiny Vibrant Orange (`#FF5A00` / `orange-500`, `orange-600`).
  - **Status & Trust Colors**:
    - **Verified & Confirmed**: Emerald Royale (`#059669` / `emerald-600`, `emerald-50`).
    - **Transit & Discovery**: Sky Blue (`#0284C7` / `sky-600`, `sky-50`).
    - **Unverified & Saved References**: Slate Neutral (`slate-600`, `slate-100`, `border-slate-300`).
    - **Curated Catalog**: Indigo / Violet (`indigo-600`, `indigo-50`).
    - **Alerts & Warnings**: Rose (`rose-600`, `rose-50`) & Amber (`amber-600`, `amber-50`).

---

## 🛡️ Architectural Trust & Provenance UI Rules

Every single data element presented in the DashTiny interface carries its provenance class:

| Provenance Tier | Visual Badge | Provenance Tag | Meaning / Rules |
| :--- | :--- | :--- | :--- |
| **`VERIFIED`** | Green badge with `ShieldCheck` | `✓ Provider verified` | Live provider inventory with confirmed booking or real-time API quote. |
| **`AI GENERATED`** | Orange pill with `Sparkles` | `✨ AI Pick` | Personalized recommendation, daily narrative, route pacing. Has "Why recommended" tooltip. |
| **`CURATED`** | Amber/Indigo pill with `BookmarkCheck` | `✓ Curated catalog` | Sourced from DashTiny's internal curated destination & sample catalog. Marked as estimated price. |
| **`SAVED REFERENCE`**| Slate ticket badge with `Ticket` | `Saved Reference · Unverified` | User-entered PNR / booking reference not yet verified with external provider. |

---

## 🗺️ Page-by-Page Editorial Implementation

1. **Top & Bottom Navigation** (`src/components/layout/TopNavbar.tsx` & `BottomNav.tsx`):
   - Clean horizontal pill header on `#FAFAF9` with DashTiny logo, active trip indicator, and DAIna status pill.
   - Fixed mobile bottom navigation with quick access to Explore (`/dashboard`), Plan (`/planner`), Trips (`/trips`), and Community (`/community`). Bookings is accessible contextually from dashboard comparisons and trip workspace tabs.
2. **Explore & Dashboard** (`src/app/dashboard/page.tsx` & `src/app/page.tsx`):
   - Hero destination search with natural language parsing.
   - Vibe filter chips (All, Beach, Mountains, Culture, Weekend Drives, International).
   - Dynamic destination cards with rich imagery, pricing, and provenance signals.
   - **Split data lifecycle**: Static data (trips and drive escapes) loads once on mount; vibe changes refetch only dynamic destination sanctuaries.
   - Structured canonical destination model (`destination_name`, `city`, `region`, `country`) used for deterministic planner handoffs.
3. **AI Travel Planner** (`src/app/planner/page.tsx`):
   - Natural language input with live intent parser (`destination`, `days`, `travellers`, `budget`, `vibe`).
   - Explicit conversational ambiguity state when prompt lacks destination ("Where would you like to go?" with suggestion chips; no silent hidden default fallback).
   - "Adapt this itinerary" fork flow when handed off from Community posts with interactive day-by-day preview and keep/omit stop selection.
   - Human loading language ("Working out the best option… Checking your budget and route").
4. **Trip Workspace** (`src/app/trips/page.tsx`):
   - Unified execution cockpit for active trips.
   - Day schedule navigation supporting both a `< Day X of N >` stepper, multi-day jump dropdown, and quick day pills.
   - Day schedule with non-destructive activity removal, 5-state deletion machine (`idle` → `deleting` → `deleted` → `undoing` → `failed`), and rollback on API failure.
   - Interactive Route Map with tap/click stop inspection, contextual "Why it's here" explanation, and direct "Navigate in Maps" deep link.
   - Canonical `currentTripBookings` merging direct trip bookings and user-saved bookings for persistent pre-trip checklist tracking.
5. **Search & Compare Bookings** (`src/app/bookings/page.tsx`):
   - Full search contract matching (dates, passengers, room types, guests, origins, destinations) with centralized airport code mapping (`src/lib/airports.ts`).
   - Transparent catalog notice ("Compare travel options in DashTiny's current catalog") and stale search indicators when query inputs change.
   - Scoped redirection to `/trips?tripId=<id>` when attaching confirmed references to active trips.
6. **Community** (`src/app/community/page.tsx`):
   - Active vibe category filtering across shared traveler trips.
   - New posts start at 0 likes; server-synchronized reward coins.
   - "Adapt this itinerary" action carrying structured payloads to Planner for day-by-day preview and customization.

---

## ⚡ P0 Trip Revision & AI Consistency Architecture

1. **Single Authoritative Mutation Channel**:
   - All domain changes (activities, budget, dates, AI modifications, undos) execute strictly via `TripRevisionService`.
   - Revisions are strictly append-only: historical snapshots are never altered, deleted, or marked `reverted`.
2. **AI Proposal Lifecycle (`Proposal → Accept → Revision`)**:
   - `POST /api/v1/ai/proposals` generates a structured diff without mutating the Trip or creating history.
   - The UI surfaces a proposal card with summary, changes diff, budget impact, verification provenance, and base version pill.
   - `[Accept]` locks the Trip row (`with_for_update()`), checks `parent_version == current_version`, applies diffs, increments version to $v(N+1)$, and commits atomically. Stale proposals return `409 Conflict`.
   - `[Reject]` marks the proposal rejected without altering Trip state.
   - `/api/v1/ai/query` is a non-mutating compatibility wrapper returning proposals.
3. **Deterministic Multi-Step Undo**:
   - Undoing creates a new revision `v(N+1)` with `action_type = "UNDO"` restoring `v(target)`.
   - Multiple undos follow the `parent_version` chain backward, preserving complete and transparent audit trails.
4. **Canonical Types & Zero Fallbacks**:
   - Unified `@/types/trip` models (`Trip`, `TripDay`, `TripActivity`, `TripRevision`, `TripProposal`) used across all frontend stores and views.
   - Removed misleading client and backend fallbacks (`travellers or 2`, `duration or 3`, `"DASH-ROOM"`, "latest trip").
5. **Inventory Honesty & Provider Abstraction**:
   - Search & compare inventory explicitly designated as `CURATED` offers with `ESTIMATED` availability and catalog pricing, never disguised as live OTA inventory. Live external OTA integrations are not yet active.
   - Provider abstraction layer (`FlightProvider`, `HotelProvider`) wires directly to `CuratedFlightProvider` and `CuratedHotelProvider`.
6. **Location Domain & PostgreSQL Airports**:
   - Replaced client-side airport registry as source of truth with PostgreSQL `airports` table and APIs (`/locations/search`, `/locations/airports/{iata_code}`).
   - Unknown destination codes remain clean (`""`); no silent fallback to Goa (`GOI`).
7. **Modular Trip Workspace Extraction**:
   - Extracted `src/app/trips/page.tsx` into modular domain subcomponents in `@/components/trip`: `TripHeader`, `TripDayTimeline`, `TripActivityCard`, `TripCopilot`, `TripProposalCard`, `TripMap`, `TripBookings`, `TripBudget`, `TripChecklist`, `TripHistory`.
   - Zero change to API contracts or UI behavior; pure maintainability and structural clarity.
8. **Pure PostgreSQL Mutations**:
   - External lookups (e.g., geocoding) moved strictly to proposal/research layer (`create_ai_proposal`). Database transactions inside `TripRevisionService` execute with zero external network dependencies.
   - Revision state semantics unified: `TripRevision N` captures canonical resulting Trip state **AFTER** mutation $N$.
