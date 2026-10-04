# 🛫 DashTiny Booking Experience — In-Depth UX Audit
**Repository**: [https://github.com/jagga2105/dashtiny-web](https://github.com/jagga2105/dashtiny-web)  
**Evaluation Scope**: Booking Architecture & Flight Experience Redesign  
**Audit Date**: October 2026

---

## Executive Summary

The DashTiny booking backend, provider normalization abstraction, canonical airport directory, and multi-step AI proposal/revision lifecycle are technically robust and sound. However, the user-facing booking interface currently exhibits the cognitive traits of a hybrid between an Online Travel Agency (OTA) aggregator and an administrative dashboard:
1. **Container Accumulation**: Nested rounded white cards, heavy borders, multiple shadow levels, and badge overload dominate the viewport.
2. **Page Mental Model Disconnect**: The current heading *"Compare Flights & Stays"* frames DashTiny as a conventional search engine rather than an intelligent companion answering *"How do I get to my Trip destination, and what fits my schedule best?"*.
3. **Trip Context Over-Presentation**: The Trip selector resembles a second full search form above the flight search form, creating conflicting input affordances and visual friction.
4. **Card Density in Results**: Decision metrics (Cheapest, Fastest, Balanced) take up three tall, saturated colored boxes before travelers can even see the first flight result.
5. **Comparison & Proposal Clutter**: Compare buttons compete on every card, while attach/proposal modals carry redundant multi-step form aesthetics instead of a calm, single-decision flow.

This audit breaks down each structural dimension and establishes the architectural path for the redesign.

---

## 1. Visual Hierarchy & Mental Model

### Current State:
- The page opens with an informational four-step flow pill (`1 Search options -> 2 Compare & select -> 3 Save confirmation -> 4 Manage in Trip`), followed by a large Trip Context card with dropdowns and route pills, then the Search Form card with cabin and traveler dropdowns.
- This creates 3 successive rectangular cards before reaching any search action.
- The title *"Compare Flights & Stays"* is transactional and OTA-like.

### Redesign Target:
- Shift mental model to travel-first intent: **"Find your way there"** with supporting line: *"Compare current DashTiny travel options and choose what fits your Trip."*
- If a Trip is active, prominently yet quietly ground the page: `Delhi → Goa · 20–25 Oct · 2 travelers [Change Trip]`.
- Make the Search Surface the undisputed visual hero on `#FAFAF9` warm background, eliminating competing boxes.

---

## 2. Cognitive Load & Visual Density

### Current State:
- Every interactive element is enclosed in a bordered, rounded box with shadows (`rounded-2xl`, `bg-white`, `border-slate-200`, `shadow-2xs` or `shadow-sm`).
- Badges appear in multiple colors simultaneously: emerald (`CHEAPEST`), blue (`FASTEST`), orange (`BALANCED`), amber (`Parent v1`), purple, and slate.
- Saturated color competition makes the interface look like a financial trading monitor rather than a calm, serene travel planner.

### Redesign Target:
- Enforce strict container reduction:
  ```text
  Page Background (#FAFAF9 warm neutral)
    └── Hero Search Surface (clean elevated card)
          └── Results Toolbar (quiet horizontal baseline)
                ├── Filter Rail (lightweight 220–250px text/checkbox list)
                └── Flight Cards (spacious editorial cards with prominent timelines)
  ```
- Restrain color hierarchy: Primary accent is **DashTiny Warm Orange**. Green is strictly reserved for confirmed success; amber for warnings/stale states; red for errors.

---

## 3. Repeated Containers & "Card-on-Card" Fatigue

### Current State:
- In `FlightTripContext`: Card containing inner pill containers, inner button containers, and multiple orange alert banners.
- In `FlightSearchForm`: Outer card containing inner segmented control pill, cabin select, traveler select, autocomplete containers, date inputs, and submit button.
- In `FlightResults`: Outer container with search summary card, decision metric cards (3 separate columns), filters sidebar card, and individual flight cards.

### Redesign Target:
- Strip the outer card wrappers from `FlightTripContext` and `FlightResults` headers.
- Embed Trip context compactly directly adjacent to or inside the top toolbar of the Search Surface.
- Reduce metric cards to compact inline decision chips:
  `₹4,850 Cheapest · 2h 20m Fastest · ₹6,100 · 2h 45m Balanced`
- Keep cards solely for atomic content items (the search surface, individual flight offers, and modals).

---

## 4. Scanability & Flight Offer Card Typography

### Current State:
- On each `FlightOfferCard`:
  - Outbound and return legs in roundtrip are squeezed into two mini gray boxes (`bg-slate-50/80 p-2.5 rounded-xl border border-slate-100`).
  - Flight times are displayed in medium text while airline and badges fight for dominance.
  - Price is separated on the right but crowded by secondary per-passenger text, catalog provenance notice, and multiple CTA buttons.

### Redesign Target:
- **Departure & Arrival times must dominate the card** (22–28px font, bold, editorial spacing).
- Visual horizontal timeline with clear direct/stops indicators (`2h 10m · Direct`).
- Clear, distinct `OUTBOUND` and `RETURN` sections for roundtrips without micro-nested borders.
- Price as the second dominant element (22–26px serif/sans-bold).
- Airline represented by restrained initials badge (e.g. `AI`, `6E`) with clean typography—no placeholder icons.
- Fallback for missing baggage/cancellation: `"Baggage: 15kg · Cancellation: Not provided"`.
- Provenance represented concisely: `Curated catalog · Estimated ⓘ`.

---

## 5. CTA Hierarchy & Progressive Disclosure

### Current State:
- Primary CTA (`Select flight`) shares button area with `Compare` toggle and `Continue to provider` external links on every card.
- Search form exposes every field at once with standard native `<select>` controls for cabin class and numeric steppers for passengers.

### Redesign Target:
- **Primary CTA**: Clear `Select flight` button on each card.
- **Compare Action**: Lightweight `[+ Compare]` toggle button; does not dominate the card.
- **Progressive Disclosure in Search**: Compact selector pill for `2 travelers · Economy` that reveals an accessible, quiet popover for adjustments, saving vertical space.

---

## 6. Comparison Behavior & Sticky Tray

### Current State:
- Comparing flights triggers an overlay comparison tray that can overlap elements or require hunting.
- The comparison modal colors entire columns or rows with heavy saturation.

### Redesign Target:
- Sticky bottom tray appears only when 1–3 flights are selected:
  `[ 2 flights selected · ₹4,850 vs ₹6,100 | Compare flights (2/3) ]`
- Redesigned comparison modal:
  - Clean comparison table with sticky feature rows: Price, Duration, Stops, Departure, Arrival, Baggage, Cancellation.
  - Subtle, restrained highlight badges for winning attributes (e.g., *Lowest fare*, *Shortest journey*), avoiding monolithic colored columns.

---

## 7. Provenance & Trust Governance

### Current State:
- Provenance banners previously leaned towards green badge treatments that could mislead travelers into assuming live airline ticketing.
- L2.6 established neutral slate styling, but the layout is still text-heavy.

### Redesign Target:
- Maintain clear truth boundaries:
  `Curated catalog · Estimated ⓘ`
- Interactive tooltip:
  *"This option comes from DashTiny's curated travel catalog. Fare and availability are estimated and should be verified with the provider."*
- Zero green verification badges for catalog data.

---

## 8. Mobile UX & Responsiveness (360px – 1440px)

### Current State:
- At 360px/390px, search forms, trip context, and metric cards stack vertically, pushing actual flight results 3-4 scroll viewports down.
- Filter drawer exists but header padding and buttons can cause tight vertical fitting.

### Redesign Target:
- **Mobile First Scan**:
  - Compact Hero Search surface.
  - Results bar: Count (`24 flights`) + `[ Filters ]` + `[ Sort ]`.
  - Flight cards appear immediately above the fold or after a single swipe.
  - Strict zero-horizontal-overflow enforcement (`w-full`, `overflow-x-hidden` on outer bounds).
  - Comparison sticky tray docks cleanly above bottom navigation with accessible tap targets (min 44px).

---

## 9. Stale State, Loading Skeletons & Diagnostic Empty State

### Current State:
- Stale banner is functional but takes up a full card block.
- Loading indicator is a generic spinner card.
- Empty state offers buttons but can appear generic.

### Redesign Target:
- **Stale Banner**: Sleek, compact amber pill banner:
  `Search changed · These results are for Delhi → Goa · 20 Oct [Update results]`
- **Loading State**: Elegant pulse skeletons (summary line + 3 skeleton flight cards) with calm text: *"Comparing current catalog options…"*.
- **Empty State**: Tailored diagnostic recovery showing only active filters to clear:
  `No flights match these filters · Try: [Clear price filter] [Allow 1 stop] [Reset all filters]`
- **Error State**: Serene recovery card:
  `We couldn't load flight options. Please try the search again. [ Try again ]`

---

## 10. Attach Flow & Proposal Review

### Current State:
- Step 1: `AttachFlightModal` asks to select trip and has full flight details repeated.
- Step 2: `TripProposalModal` repeats flight details and version badges.

### Redesign Target:
- Streamline into a unified, transparent two-phase proposal experience:
  - **Select to Attach**: Lightweight modal: *"Add this flight to Trip: [ Delhi → Goa · 20–25 Oct ] [ Review change ]"*.
  - **Review Proposal**: Clear diff showing the change to the itinerary, the flight specifics, parent version, and the explicit notice:
    *"Selecting a flight does not book it. It adds the flight to your Trip after you approve the Trip change. No booking has been made by DashTiny."*
  - **Success State**: Concise confirmation toast/pill:
    `✓ Flight added to your Trip · Air India AI 864 · Revision v{N} [ Open Trip ] [ Continue browsing ]`

---

## 11. Accessibility Contract Verification

All interactive controls must maintain:
- ARIA semantics: `role="region"`, `role="dialog"`, `role="listbox"`, `role="status"`.
- Keyboard focus rings: `focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none`.
- Live region announcements for results count changes and filter resets (`aria-live="polite"`).
- Accessible modal focus traps, Escape key dismissals, and restoration of focus to triggering elements.

---

## Implementation Roadmap

1. **Architecture & Foundation**:
   - Update `src/app/bookings/page.tsx`: Travel-first heading (*"Find your way there"*), `#FAFAF9` layout rhythm, quiet Trip context grounding, lightweight success banner.
2. **Search Surface Hero**:
   - Redesign `FlightSearchForm.tsx`: Hero visual presentation, progressive disclosure for passengers & cabin class, refined date and airport inputs.
3. **Trip Context Simplification**:
   - Refactor `FlightTripContext.tsx`: Clean, unobtrusive pill banner with inline change action and quick date/traveler sync.
4. **Results Toolbar & Compact Decision Support**:
   - Refactor `FlightResults.tsx`: Compact results header, inline decision chips for Cheapest, Fastest, Balanced (no giant colored cards), refined sticky compare tray.
5. **Flight Offer Card Redesign**:
   - Refactor `FlightOfferCard.tsx`: Timeline-first visual hierarchy, large departure/arrival typography, clear outbound/return blocks, restrained airline initials mark, fallback perks, clean CTAs.
6. **Comparison Modal & Filters Refinement**:
   - Polish `FlightComparison.tsx` and `FlightFilters.tsx`: Subtle winner highlights, lightweight filter sidebar and mobile bottom sheet.
7. **Modals & Lifecycle Polish**:
   - Polish `AttachFlightModal.tsx` and `TripProposalModal.tsx` for seamless, lightweight attach-and-review flow.
8. **Verification & QA**:
   - Comprehensive test suite updates (`FlightFinalIntegrityL26.test.tsx` and new tests).
   - Multi-viewport browser visual QA (360px, 390px, 768px, 1024px, 1440px).
