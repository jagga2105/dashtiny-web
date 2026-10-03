# ✈️ DashTiny L2 — Flight Search, Filtering & Trip Integration Audit

> **Reference Repository**: [`jagga2105/dashtiny_mvp_angular`](https://github.com/jagga2105/dashtiny_mvp_angular)  
> **Current Repository**: [`jagga2105/dashtiny-web`](https://github.com/jagga2105/dashtiny-web)  
> **Engineering Principle**: *"AI proposes. Tools verify. Services execute. The database remembers. The UI lets the traveler decide."*  
> **Status**: Completed Audit — Ready for Implementation

---

## 1. Executive Summary

The legacy Angular MVP contained a rich, multi-dimensional flight search concept including typeahead airport inputs, one-way/round-trip toggles, traveller/cabin selectors, client-side faceted filtering (stops, airlines, departure slots, price ranges), and a placeholder flight comparison shell. However, it was crippled by obsolete data (defunct airlines like Go First and Vistara), insecure client-side architecture, unvalidated free-form strings, and disconnected booking flows.

The modern DashTiny architecture establishes an experience-first model:
$$\text{Trip Workspace} \rightarrow \text{Prefilled Search (L1 Airports)} \rightarrow \text{FastAPI Search API} \rightarrow \text{CuratedFlightProvider} \rightarrow \text{Normalized FlightOffer} \rightarrow \text{TripProposal} \rightarrow \text{Append-Only TripRevision}$$

This audit documents the legacy behavior, current implementation, missing gaps, and the modern architectural replacement.

---

## 2. Legacy vs. Current vs. Modern Specification Matrix

| Domain Dimension | Legacy Angular MVP Behavior | Current DashTiny Implementation (`dashtiny-web`) | Missing Behavior / Gap | Modern DashTiny Replacement (L2 Specification) |
| :--- | :--- | :--- | :--- | :--- |
| **Airport Inputs** | Typeahead matching against hardcoded `airportData.ts` and `indiaAirport.json`. Used fragile `extractAirportCode()` string splits. | Reusable `AirportAutocomplete` backed by PostgreSQL `airports` table (171 verified airports via L1). Partially integrated in `/bookings`. | Flight search still accepted arbitrary strings in some query flows; no strict IATA validation on backend. | Use L1 `AirportAutocomplete` exclusively for Origin and Destination. Pass verified 3-letter IATA codes (`DEL`, `BOM`, etc.) to backend. Reject arbitrary strings. |
| **Search Request Validation** | Basic Angular reactive form checks: city length >= 3, YYYY-MM-DD format regex, travellers 1-10. Failed silently or disabled submit button. | Query parameters read without Pydantic schema validation. Missing origin/destination or invalid dates yielded empty list or unhandled exceptions. | No 422 error on invalid inputs; no validation for past departure date, return date before departure, origin == destination, or invalid cabin enums. | Implement strict Pydantic `FlightSearchRequest` query validator. Return HTTP 422 with descriptive error details for any invalid input. Never silently correct user input. |
| **Airline Inventory & Provenance** | `FlightData` contained 807 hardcoded items with historical/obsolete records: **Go First** (liquidated Jan 2025) and **Vistara** (merged into Air India Nov 2024). | `CuratedFlightProvider` returns 3 fixed base corridors (IndiGo, Air India Express, Akasa Air) with `CURATED` provenance. | Corridors were static and did not dynamically reflect origin/destination route details, airport names, or realistic schedules. | Contemporary airline identities (IndiGo, Air India, Air India Express, Akasa Air, SpiceJet). Honest `availability_state = ESTIMATED`, `provenance = CURATED`, `source = CURATED_DATABASE`. |
| **Normalized Flight Offer Contract** | Ad-hoc `FlightList` model (`id, airlineLogo, airlineName, departureCityAirport, departureTime, arrivalTime, stops, stopCity, price, duration`). | Incomplete dictionary in `curated.py` missing canonical fields (`origin_airport`, `destination_airport`, `stop_details`, `cabin_class`). | Frontend and backend had subtle discrepancies in field names (`flightNumber` vs `flight_number`, string vs number `duration_minutes`). | Canonical 29-field `FlightOffer` contract enforced identically in FastAPI Pydantic schema and TypeScript `src/types/flight.ts`. |
| **Search Response Metadata** | Direct array of flight objects with no envelope or search context. | Direct JSON array returned from `GET /api/v1/bookings/search/flights`. | Frontend had to reconstruct search parameters, availability state, and freshness timestamps from individual items. | Standardized response envelope: `{ search: {...}, offers: [...], provenance: "CURATED", availability_state: "ESTIMATED", retrieved_at: "...", expires_at: "..." }`. |
| **Search Form UX** | Angular Material inputs with radio buttons, traveller inc/dec counter, cabin dropdown. | Functional desktop/mobile search card in `bookings/page.tsx` with basic fields. | Monolithic component; lacked accessible comboboxes for airports and clear visual date constraints. | Modernized `FlightSearchForm` built with DashTiny warm-editorial aesthetic: One-way/Round-trip tabs, L1 Autocomplete, date pickers, passenger counter, cabin selector. |
| **Trip Context & Prefill** | No trip concept. Flights existed in complete isolation from any trip or itinerary. | Reads `tripId` query param and preselects trip; resolves destination string via L1 airport lookup. | Did not resolve origin airport cleanly; did not display active trip context bar. | When launched from Trip Workspace (`/bookings?tripId=...`), prefill origin, destination, dates, and travellers. Show prominent "Planning for [Trip Destination]" context pill. |
| **Stale Search Detection** | No stale detection. Changing form fields after submit left old results on screen. | Compares `currentFlightKey` against `lastSearchedFlightKey` and sets `isFlightSearchStale`. | Alert message was minimal and lacked a one-click "Update results" action button. | Prominent visual indicator: "Search parameters updated — re-run search" with instant re-query button. |
| **Sorting Options** | None in legacy app (fixed array order). | Derived inline badges for Lowest Fare, Fastest, and Best Value. | No user-selectable sort dropdown or segmented toggle (Cheapest, Fastest, Balanced, Earliest, Latest). | Client-side deterministic sorting: **Cheapest** (lowest price), **Fastest** (lowest duration_minutes), **Balanced option** (direct, <= 180m, moderate price), **Earliest departure**, **Latest departure**. |
| **Faceted Filtering** | Accordion with Stops (0, 1, 2+), Airlines checkboxes, Price ranges, and Departure time slots (Early Morning, Morning, Afternoon, Evening, Night). | Missing in current `dashtiny-web` bookings page (results displayed as flat list). | No way for users to narrow down 10+ offers by stops, airline, departure/arrival time, or budget. | Client-side `FlightFilters` component: Stops pills, Airline checkboxes with counts, Price slider, and Departure & Arrival time slot filters. |
| **Flight Comparison** | Placeholder shell (`<p>flight-comparision works!</p>`). | None. | Users could not compare two or three flights side-by-side to evaluate baggage, stops, and departure times. | Modern `FlightComparison` drawer/modal allowing up to 3 selected flights compared across 10 structured attributes. |
| **Sponsored Content** | Hardcoded credit card promotional banners (ICICI, Axis, SBI cards) embedded in search flow. | None (clean). | None (good). | Discard legacy sponsored carousels entirely. Only transparent, verified airline inventory is displayed. |
| **Offer Selection & Trip Integration** | Direct simulated booking or alert popup. | Saved booking reference directly to DB with `status = saved_reference`, bypassing AI revision flow. | Selecting a flight directly created a DB record instead of letting the traveler review and approve a Trip proposal. | Clicking "Select Flight" creates a `TripProposal` (`ATTACH_FLIGHT_OFFER`). User reviews before/after diff $\rightarrow$ clicks Accept $\rightarrow$ creates append-only `TripRevision`. |
| **Deep Link & Booking Transparency** | "View Details" button without clear destination. | "Save Reference" and mock links. | Confused searching with booking; claimed booking action without provider integration. | Clear button: "Continue to provider" with external link icon, opening official airline portal (e.g. goindigo.in, airindia.com). |

---

## 3. Detailed Legacy Source Inspections

### 3.1. `src/app/data/flightData.ts` & `src/app/models/flight/flightList.ts`
- **Structure**: Legacy records provided basic flight attributes but lacked operational metadata:
  ```typescript
  export class FlightList {
    id: number;
    airlineLogo: string;
    airlineName: string;
    departureCityAirport: string; // e.g. "IXC"
    departureTime: string;        // e.g. "08:00"
    arrivalTime: string;          // e.g. "11:30"
    arrivalCityAirport: string;   // e.g. "DEL"
    stops: number;
    stopCity: string[];
    stopDuration: number;
    departureCity: string;
    arrivalCity: string;
    price: string;                // e.g. "₹25,500" (raw string with currency symbol)
    duration: string;             // e.g. "3h 30m" (unparsed string)
  }
  ```
- **Airline Data Audit & Safety Concerns**:
  - Contains records for **Go First (G8)**: Ceased operations in May 2023, ordered into formal liquidation by NCLT in January 2025.
  - Contains records for **Vistara (UK)**: Merged into Air India in November 2024; all flights now operate under Air India codes.
  - **Decision**: These obsolete airlines must **NEVER** be surfaced in DashTiny's active search catalog. Only currently operating carriers (IndiGo, Air India, Air India Express, Akasa Air, SpiceJet) with realistic flight numbers are permitted.

### 3.2. `src/app/components/partials/flight/flight-suggestion-form/`
- **Form Controls**: Two-way data binding for `departureCity`, `arrivalCity`, `departureDate`, `returnDate`, `travellers` (1–10), `tripType` (`oneWay` vs `roundTrip`), and `selectedCabinClass`.
- **Validation Logic**:
  ```typescript
  isCityValid(city: string): boolean { return !!city && city.length >= 3; }
  isDateValid(date: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(date); }
  isTravellersValid(t: string): boolean {
    const n = parseInt(t, 10);
    return !isNaN(n) && n >= 1 && n <= 10;
  }
  ```
- **Defects**: Accepted any string with $\ge 3$ characters without verifying if it represented a real airport or city. No check that `departureDate` is in the future or that `returnDate > departureDate`.

### 3.3. `src/app/components/partials/flight/flight-listing/`
- **Filter Groups**:
  1. `Departure Time`: Slot classification using 24h hour parsing:
     - `Early Morning`: 00:00 – 05:59
     - `Morning`: 06:00 – 11:59
     - `Afternoon`: 12:00 – 17:59
     - `Evening`: 18:00 – 21:59
     - `Night`: 22:00 – 23:59
  2. `Stops`: Non-stop (0), 1 stop (1), 2+ stops.
  3. `Airlines`: Dynamic set of distinct airline names.
  4. `Price`: Range tiers derived from dataset min/max.
- **Architectural Strength**: Pure client-side filtering over the loaded result set, avoiding redundant server queries. This pattern will be retained and modernized.

### 3.4. `src/app/components/partials/flight/flight-comparision/`
- Only contained the scaffold `<p>flight-comparision works!</p>`. The actual comparison feature was never built in the legacy application. DashTiny L2 will implement the first real, production-ready flight comparison in DashTiny history.

---

## 4. Current Implementation Code Inspection

### 4.1. `backend/app/services/providers/curated.py`
- Implements `CuratedFlightProvider(FlightProvider)`.
- Calculates total price using multipliers:
  - `cabin_multiplier = 2.4 (business) | 1.4 (premium) | 1.0 (economy)`
  - `trip_multiplier = 1.85 (roundtrip) | 1.0 (oneway)`
- Generates 3 base corridor offers (`IndiGo Premier`, `Air India Express`, `Akasa Air Getaway`).
- **Defects to Fix**:
  - Flight times, durations, and stop details are hardcoded to fixed values (75m–85m) regardless of the route (e.g. DEL $\rightarrow$ BOM vs DEL $\rightarrow$ BLR vs DEL $\rightarrow$ GOI).
  - Missing `origin_airport` and `destination_airport` objects containing full airport metadata.
  - Generates fake `id` alongside `offer_id`.
  - Does not validate that IATA codes exist.

### 4.2. `backend/app/api/v1/bookings.py`
- Exposes `GET /api/v1/bookings/search/flights`.
- Reads query parameters directly without Pydantic validation:
  ```python
  @router.get("/search/flights")
  def search_flights_endpoint(
      origin: str,
      destination: str,
      departure_date: Optional[str] = None,
      return_date: Optional[str] = None,
      passengers: int = 1,
      cabin_class: str = "economy",
      trip_type: str = "roundtrip"
  ):
  ```
- **Defects to Fix**:
  - Missing request contract validation (no 422 on invalid input).
  - Missing structured search metadata wrapper in response.
  - Endpoint path: Standardize to `GET /api/v1/bookings/search/flights`.

### 4.3. `src/app/bookings/page.tsx`
- Monolithic 1,104-line file mixing flights, hotels, trains, buses, cabs, and bookings history.
- Contains basic flight search form and results list.
- Calculates badges (`lowestFareFlight`, `fastestFlight`, `recommendedFlight`) directly in component render loop.
- **Defects to Fix**:
  - Lacks modularity: needs extraction into clean components.
  - Selecting a flight triggers direct DB mutation instead of creating a Trip Proposal.
  - Lacks faceted filters, sort options, and side-by-side comparison modal.

---

## 5. Modern Architecture & Implementation Plan

```mermaid
graph TD
    A[Trip Workspace / Bookings Page] -->|Prefills from Trip| B[FlightSearchForm]
    B -->|Selects via L1 Autocomplete| C[Verified IATA Codes]
    C -->|GET /api/v1/bookings/search/flights| D[FastAPI Endpoint]
    D -->|Validates Pydantic Schema| E[FlightSearchRequest]
    E -->|Delegates to| F[CuratedFlightProvider]
    F -->|Synthesizes normalized offers| G[FlightSearchResponse Envelope]
    G -->|Returns JSON| H[Client State: rawOffers]
    H -->|Client-side filtering| I[FlightFilters: Stops, Airline, Price, Times]
    I -->|Client-side sorting| J[FlightSort: Cheapest, Fastest, Balanced]
    J -->|Render| K[FlightResults Grid]
    K -->|Select up to 3| L[FlightComparison Drawer]
    K -->|Click 'Select Flight'| M[POST /api/v1/ai/proposals: ATTACH_FLIGHT_OFFER]
    M -->|Trip remains unchanged| N[TripProposal Review Card]
    N -->|Traveler clicks 'Accept'| O[POST /api/v1/ai/proposals/{id}/accept]
    O -->|TripRevisionService| P[Append-Only TripRevision vN+1]
```

### 5.1. Normalized Contract (`FlightOffer`)
Must contain all 29 canonical fields:
1. `offer_id`
2. `provider`
3. `airline`
4. `flight_number`
5. `origin` (IATA)
6. `destination` (IATA)
7. `origin_airport` (dict: code, name, city, country)
8. `destination_airport` (dict: code, name, city, country)
9. `departure_date` (ISO date)
10. `return_date` (ISO date or null)
11. `departure_time` (e.g. "06:15 AM" or ISO time)
12. `arrival_time` (e.g. "08:35 AM" or ISO time)
13. `duration_minutes` (integer)
14. `stops` (integer: 0, 1, 2)
15. `stop_details` (list of strings or dicts)
16. `passengers` (integer)
17. `cabin_class` ("economy" | "premium_economy" | "business" | "first")
18. `trip_type` ("oneway" | "roundtrip")
19. `price` (float: total fare)
20. `per_passenger_price` (float)
21. `currency` ("INR")
22. `baggage` (string)
23. `cancellation` (string)
24. `availability_state` ("ESTIMATED")
25. `provenance` ("CURATED")
26. `source` ("CURATED_DATABASE")
27. `retrieved_at` (ISO timestamp)
28. `expires_at` (ISO timestamp)
29. `deep_link` (URL string)
30. `why_recommended` (string)

---

## 6. Audit Conclusion & Next Steps
With this comprehensive audit complete and documented, we can immediately implement the modernized L2 Flight Search domain without touching or destabilizing L1 Location or the existing AI Revision architecture.
