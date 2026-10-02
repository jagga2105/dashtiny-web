# 🌍 DashTiny Web — Active Design System & Architecture Changelog

This document logs the active design language, typography tokens, color palette, and component patterns across **DashTiny** (Intelligent Travel Platform & AI Companion DAIna).

---

## 🎨 Active Design Language & Aesthetic Tokens

- **Design Philosophy**: Calm, premium, visual-first editorial travel companion. 
  - *"One primary action per screen. Never overwhelm users. Travel is emotional. Every screen should inspire."*
- **Typography**:
  - **Display / Editorial Headings**: Google `Outfit` (`--font-display` / `font-serif-editorial`) — Modern, humanist, warm geometric display sans-serif (weights: 400 to 900).
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
| **`CURATED`** | Indigo pill with `BookmarkCheck` | `✓ Curated by DashTiny` | Sourced from DashTiny's internal curated destination registry. |
| **`SAVED REFERENCE`**| Slate ticket badge with `Ticket` | `Saved Reference · Unverified` | User-entered PNR / booking reference not yet verified with external provider. |

---

## 🗺️ Page-by-Page Editorial Implementation

1. **Top & Bottom Navigation** (`src/components/layout/TopNavbar.tsx` & `BottomNav.tsx`):
   - Clean horizontal pill header on `#FAFAF9` with DashTiny logo, active trip indicator, and DAIna status pill.
   - Fixed mobile bottom navigation with quick access to Explore, Planner, Trips, Bookings, and Community.
2. **Explore & Dashboard** (`src/app/dashboard/page.tsx` & `src/app/page.tsx`):
   - Hero destination search with natural language parsing.
   - Vibe filter chips (All, Beach, Mountains, Culture, Weekend Drives, International).
   - Dynamic destination cards with rich imagery, pricing, and provenance signals.
   - Static data loads once on mount; vibe changes refetch only destination sanctuaries.
3. **AI Travel Planner** (`src/app/planner/page.tsx`):
   - Natural language input with live intent parser (`destination`, `days`, `travellers`, `budget`, `vibe`).
   - Explicit conversational ambiguity state when prompt lacks destination ("Where would you like to go?" with suggestion chips).
   - "Adapt this itinerary" fork flow when handed off from Community posts.
   - Human loading language ("Working out the best option… Checking your budget and route").
4. **Trip Workspace** (`src/app/trips/page.tsx`):
   - Unified execution cockpit for active trips.
   - Day schedule with non-destructive activity removal, 5-state deletion machine (`idle` → `deleting` → `deleted` → `undoing` → `failed`), and rollback on API failure.
   - Calm editorial "Today's route" map view (replacing dark tactical radar).
   - Bookings tab strictly scoped to `currentTrip.id` with unverified badges for saved references.
   - Budget tab with starting heuristic estimate notice ("Starting estimate: Category allocation breakdown based on total trip budget").
5. **Search & Compare Bookings** (`src/app/bookings/page.tsx`):
   - Full search contract matching (dates, passengers, room types, guests, origins, destinations).
   - Flight & hotel comparison cards with provider deep links and saved booking reference capture.
6. **Community** (`src/app/community/page.tsx`):
   - Verified traveler getaway posts with authenticated unique post likes (`PostLike`).
   - "Adapt this itinerary" action carrying structured payloads to Planner.
   - Squad companion invites ("Invite to trip") without fake unearned coin awards.
