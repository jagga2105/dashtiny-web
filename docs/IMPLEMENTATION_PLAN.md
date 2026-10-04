# 🌍 DashTiny — Master Implementation Plan

> **North Star**:  
> *"DashTiny helps the right people create the right trip together."*  
> Near-term focus is strictly on:
> 1. **Excellent personalized itinerary** (P0 quality, explicit likes/dislikes, pace, budget, day semantics)
> 2. **Intelligent Squad collaboration around that itinerary** (suggestions, DAIna revision proposals, votes, versioning)
> 3. **Highly relevant trip discovery & explainable matching** (profile-driven community feed, visibility boundaries, "Show Interest" flow)
> 4. **Booking remains strictly frozen** with user-facing *"Bookings are coming soon — stay tuned."*

---

## 📊 Master Phase Tracker

| Phase | Description | Status | Verification Target |
| :--- | :--- | :---: | :--- |
| **Phase 0** | **Architecture Audit & Codebase Discovery** | `COMPLETED` | Complete audit report; mapping table; zero premature refactors |
| **Phase 1** | **Traveler Profile & Personalization Foundation** | `PENDING` | Extended `UserProfile` schema, `/api/v1/profile` API, profile page, dislikes/likes scoring |
| **Phase 2** | **Trip Visibility & Discovery Boundaries** | `PENDING` | Tri-state visibility (`PUBLIC`, `FRIENDS_ONLY`, `PRIVATE`), server-authoritative filtering |
| **Phase 3** | **Deterministic Matching Engine** | `PENDING` | Explainable compatibility scoring, dislike exclusion, re-ranked community feed |
| **Phase 4** | **"Show Interest" Flow & Friends Social Graph** | `PENDING` | `Friendship`, `TripInterestRequest`, creator review breakdown, approval to Squad member |
| **Phase 5** | **Squad Governance & Group Profile Aggregation** | `PENDING` | Squad ownership, member roles, group preference aggregation (shared likes vs dislikes) |
| **Phase 6** | **Collaborative Itinerary Editing with DAIna** | `PENDING` | Member suggestion $\to$ DAIna revision proposal $\to$ creator approval/vote $\to$ version $v(N+1)$ |
| **Phase 7** | **Community Quality & Notifications System** | `PENDING` | `Notification` model, inbox feed, real-time/polling alerts for invites, suggestions, votes |
| **Phase 8** | **End-to-End UX & Mobile Verification** | `PENDING` | Multi-viewport tests (360px, 390px, 768px), zero horizontal overflow, full scenario pass |

---

## 🛡️ Non-Negotiables & Invariant Guardrails

1. **Booking Freeze**: DO NOT integrate live booking APIs or payments. UI communicates *"Bookings are coming soon — stay tuned."* Provider abstractions remain underneath for future use.
2. **One Canonical Itinerary Pipeline**: `Intent → Destination Intelligence → Candidate Places → LLM / deterministic synthesis → Constraint validation → Tool verification → Budget → Quality score → TripProposal`.
3. **No Fake Destination Data**: Unknown destinations return `DestinationResearchIncompleteError` (HTTP 422). Never invent attractions.
4. **Durable Proposals in PostgreSQL**: All proposal mutations are atomic with row locking (`with_for_update()`) and strict ownership validation (`proposal.user_id == current_user.id`).
5. **Personal by Default**: No automatic `SquadRoom` is created upon trip creation. Group planning is strictly opt-in.
6. **Append-Only Revisions**: Itinerary states are immutable snapshots (`TripSnapshot`). Never overwrite historical versions. Stale proposals (`parent_version != current_version`) are rejected.

---

## 📑 Phase Details & Checklist

---

### [x] Phase 0 — Architecture Audit & Codebase Discovery
- [x] **Database Audit**: Inspected SQLAlchemy models in `backend/app/models/models.py`. Verified Alembic migrations at head `e8293751a02b`.
- [x] **Backend API Audit**: Inspected routers in `backend/app/api/v1/` (trips, community, squad, auth, planner, ai, bookings).
- [x] **Frontend Audit**: Inspected pages in `src/app/`, components in `src/components/`, and state stores in `src/store/`.
- [x] **Mapping Matrix**: Mapped existing concepts to code; documented missing capabilities (Profile preferences, Friend graph, Notifications, Suggestions/Voting tables).
- [x] **Test Verification**: Verified existing test suites pass (39/39 backend unit tests, 78/78 frontend vitest tests, 0 TypeScript errors).
- [x] **Agent Report**: Formatted Phase 0 report delivered and documented.

---

### [ ] Phase 1 — Traveler Profile & Personalization Foundation
**Goal**: Make traveler preferences authoritative, persistent, and directly influential in itinerary synthesis and scoring.

- [ ] **Database Migration**:
  - Extend `UserProfile` in `backend/app/models/models.py`:
    - `interests`: JSON array of strings
    - `likes`: JSON array of strings (e.g. `nightlife`, `beaches`, `seafood`, `photography`)
    - `dislikes`: JSON array of strings (e.g. `religious`, `pilgrimage`, `crowds`, `long_walks`)
    - `travel_style`: String (`solo`, `couple`, `family`, `digital_nomad`, `backpacker`, `luxury`)
    - `pace`: String (`relaxed`, `balanced`, `packed`)
    - `food_preferences`: JSON array of strings (`vegetarian`, `vegan`, `seafood`, `halal`, `local_eats`)
    - `activity_preferences`: JSON array of strings
    - `accommodation_preference`: String (`hostel`, `budget`, `comfort`, `boutique`, `luxury`, `resort`)
    - `transport_preference`: String (`walking`, `public_transit`, `cab`, `rental_car`, `mix`)
    - `budget_tier`: String (`budget`, `moderate`, `premium`, `luxury`)
    - `social_preferences`: JSON object (`open_to_meetups`, `squad_size_pref`, `bio`)
  - Create Alembic migration for new columns.
- [ ] **Backend Profile Endpoints**:
  - `GET /api/v1/profile`: Retrieve authenticated user's complete profile and preferences.
  - `PUT /api/v1/profile`: Update authenticated user's preferences with strict validation.
- [ ] **Itinerary Personalization Integration**:
  - Update `proposal_service.py` and `itinerary_engine.py` to auto-fetch and merge stored `UserProfile` preferences when prompt leaves fields implicit.
  - Update `DestinationIntelligence.score_candidate`:
    - Dislike suppression: Apply harsh penalty (-50.0) or complete filter on candidates matching traveler dislikes (e.g., religious/pilgrimage for party travelers).
    - Like amplification: Add +20.0 bonus for candidates matching traveler explicit likes.
- [ ] **Frontend Profile Page**:
  - Create `src/app/profile/page.tsx` with clean, modern tabs:
    - *Travel Style & Pace* (Relaxed, Balanced, Packed)
    - *Passions & Likes* (tags / chips)
    - *Dislikes & Dealbreakers* (explicit exclusion tags)
    - *Food & Dining Preferences*
    - *Stay & Transit Habits*
  - Add API service methods `getProfile` and `updateProfile`.
- [ ] **Tests**:
  - Backend tests: Profile CRUD, dislike exclusion, like amplification, fallback when profile empty.
  - Frontend tests: Profile form rendering, preference updating, validation.

---

### [ ] Phase 2 — Trip Visibility & Discovery Boundaries
**Goal**: Enforce tri-state trip visibility boundaries at the database and API layers.

- [ ] **Database Migration**:
  - Add `visibility` column to `Itinerary`: Enum/String (`PUBLIC`, `FRIENDS_ONLY`, `PRIVATE`), defaulting to `PRIVATE` for drafts, `PUBLIC` for published community trips.
  - Add CheckConstraint: `visibility IN ('PUBLIC', 'FRIENDS_ONLY', 'PRIVATE')`.
  - Maintain backward compatibility with `is_public` as a computed property or synced field.
- [ ] **Server-Authoritative Enforcement**:
  - Update `GET /api/v1/trips/{trip_id}`:
    - Owner or Squad member: Always granted access.
    - `PUBLIC`: Accessible by any authenticated/public user.
    - `FRIENDS_ONLY`: Accessible only if requester has an accepted `Friendship` with the trip owner.
    - `PRIVATE`: Forbidden (HTTP 403) to non-members.
  - Update `GET /api/v1/community/feed`:
    - Only returns `PUBLIC` trips, or `FRIENDS_ONLY` trips where current user is friends with creator.
    - Never leaks `PRIVATE` trips.
  - Add `PATCH /api/v1/trips/{trip_id}/visibility` endpoint.
- [ ] **Frontend UI**:
  - Add Visibility Selector to `TripHeader` and trip settings modal (Public / Friends Only / Private).
  - Clear visual privacy badges on trip cards.
- [ ] **Tests**:
  - Backend tests: Public access, Friends-only granted to friends, Friends-only denied to strangers, Private denied to non-members.

---

### [ ] Phase 3 — Deterministic Matching Engine
**Goal**: Create an explainable matching engine that ranks trips in Community and evaluates compatibility for prospective travelers.

- [ ] **Matching Engine Service** (`backend/app/services/matching_engine.py`):
  - Function `calculate_traveler_trip_compatibility(user_profile, trip, trip_owner_profile) -> CompatibilityReport`:
    - Interest overlap score (0–35 pts)
    - Dislike exclusion: If trip has categories matching user dislikes $\to$ score severely penalized or excluded
    - Pace compatibility (0–20 pts)
    - Budget tier alignment (0–15 pts)
    - Travel style / Persona match (0–15 pts)
    - Food / dining preference match (0–15 pts)
    - Deterministic explanations (`shared_interests`, `shared_vibe`, `potential_differences`)
- [ ] **Community Feed Ranking**:
  - Update `GET /api/v1/community/feed` to accept authenticated user context.
  - Re-rank discoverable trips by compatibility score.
  - Suppress incompatible trips (e.g. religious pilgrimage trip for a user who explicitly dislikes pilgrimage).
  - Return explainable badge: *"Recommended because you both enjoy nightlife, beaches and social travel."*
- [ ] **Tests**:
  - Unit tests: Higher rank for compatible trips, dislike exclusion prevents display, deterministic explanation generation.

---

### [ ] Phase 4 — "Show Interest" Flow & Friends Social Graph
**Goal**: Transition trip discovery into structured connection and squad formation.

- [ ] **Database Models**:
  - `Friendship` (`id`, `user_id`, `friend_id`, `status` ['pending', 'accepted', 'rejected', 'blocked'], `created_at`, `updated_at`).
  - `TripInterestRequest` (`id`, `trip_id`, `applicant_id`, `message`, `status` ['pending', 'approved', 'rejected'], `compatibility_score`, `compatibility_breakdown`, `created_at`).
  - Alembic migration for both tables.
- [ ] **Friends API** (`backend/app/api/v1/friends.py`):
  - `GET /api/v1/friends`: List accepted friends.
  - `POST /api/v1/friends/request`: Send friend request.
  - `POST /api/v1/friends/respond`: Accept or reject request.
  - `POST /api/v1/trips/{trip_id}/invite-friend`: Invite friend to trip.
- [ ] **Show Interest API**:
  - `POST /api/v1/trips/{trip_id}/interest`: Applicant submits interest with message.
  - `GET /api/v1/trips/{trip_id}/interest-requests`: Creator views pending applicants with compatibility breakdown.
  - `POST /api/v1/trips/{trip_id}/interest-requests/{request_id}/respond`:
    - If `approved`: Automatically adds applicant to `SquadMember` as `member`.
    - If `rejected`: Updates status to `rejected`.
- [ ] **Frontend UI**:
  - "Show Interest" button on Community trip cards with note modal.
  - Creator "Squad Applicants" review drawer on `TripWorkspace` with compatibility badges.
  - Friend management dialog and invite-friend modal.
- [ ] **Tests**:
  - Flow test: Show interest $\to$ Creator receives breakdown $\to$ Approve $\to$ Squad member added.
  - Duplicate request prevention, permission validation.

---

### [ ] Phase 5 — Squad Governance & Group Profile Aggregation
**Goal**: Transform Squad from a simple member list into an intelligent, consensus-driven group workspace.

- [ ] **Squad Profile Aggregation Engine** (`backend/app/services/planner/squad_aggregator.py`):
  - Aggregate preferences across creator and all squad members:
    - `shared_interests`: Union of common tags.
    - `group_pace`: Harmonized pace (accommodates slowest/relaxed pace).
    - `combined_dislikes`: Universal exclusion list (if any member dislikes religious sites or long walking, flag/penalize those stops).
    - `budget_boundary`: Min/max constraints of group.
- [ ] **Squad Governance & Roles**:
  - Role enforcement: `owner` (trip creator), `co_planner`, `member`.
  - Member removal / leave squad endpoint with proper cascade.
- [ ] **Frontend Squad Hub Polish**:
  - Connect `SquadRoomHub.tsx` to real backend APIs (retiring mock localStorage).
  - Display Group Travel Profile summary showing shared interests and individual constraints.
- [ ] **Tests**:
  - Group preference aggregation unit tests, role permission enforcement tests.

---

### [ ] Phase 6 — Collaborative Itinerary Editing with DAIna
**Goal**: Enable squad members to suggest changes that DAIna synthesizes into proposals for group review, voting, and atomic revision.

- [ ] **Database Models**:
  - `SquadSuggestion` (`id`, `squad_id`, `user_id`, `instruction`, `status` ['open', 'proposal_generated', 'accepted', 'rejected', 'withdrawn'], `proposal_id`, `created_at`).
  - `SquadVote` (`id`, `suggestion_id` or `proposal_id`, `user_id`, `vote` ['up', 'down'], `created_at`).
- [ ] **DAIna Squad Suggestion Pipeline**:
  - `POST /api/v1/squads/{squad_id}/suggestions`: Member submits suggestion (e.g., *"Make Day 2 less packed"*).
  - DAIna evaluates suggestion against active itinerary + group profile.
  - DAIna generates a `TripProposal` revision referencing `parent_version`.
  - Creator approves OR squad votes.
  - Acceptance triggers `TripRevisionService` to commit $v(N+1)$ `TripSnapshot`.
- [ ] **Frontend Collaborative Workspace**:
  - Suggestion input box inside Squad tab.
  - Proposal review card inside Squad with vote counters and creator accept button.
  - Real-time or polling refresh of active itinerary upon revision commit.
- [ ] **Tests**:
  - End-to-end collaborative test: Member suggests $\to$ DAIna drafts proposal $\to$ Vote/Accept $\to$ New version committed $\to$ History updated.

---

### [ ] Phase 7 — Community Quality & Notifications System
**Goal**: Keep travelers informed about squad invitations, applications, suggestions, and itinerary changes.

- [ ] **Database Model**:
  - `Notification` (`id`, `user_id`, `type`, `title`, `body`, `payload`, `is_read`, `created_at`).
  - Event triggers for:
    - `INTEREST_RECEIVED`, `INTEREST_APPROVED`, `INTEREST_REJECTED`
    - `FRIEND_REQUEST`, `FRIEND_ACCEPTED`
    - `SQUAD_INVITATION`, `SQUAD_SUGGESTION_CREATED`
    - `SQUAD_VOTE_STARTED`, `ITINERARY_REVISED`
- [ ] **Notifications API**:
  - `GET /api/v1/notifications`: List unread/recent notifications.
  - `POST /api/v1/notifications/{id}/read`: Mark as read.
  - `POST /api/v1/notifications/read-all`: Mark all as read.
- [ ] **Frontend Notification Drawer**:
  - Bell icon in `TopNavbar` with unread badge counter.
  - Flyout drawer with actionable notification links.

---

### [ ] Phase 8 — End-to-End UX & Mobile Verification
**Goal**: Polish and verify the complete traveler journey across all device viewports.

- [ ] **Mobile Responsiveness**:
  - Test viewports: 360px (compact mobile), 390px (standard iPhone), 768px (tablet), 1280px (desktop).
  - Zero horizontal scroll; touch-friendly tap targets ($\ge 44\text{px}$).
- [ ] **Full Scenario Walkthrough**:
  - User completes profile $\to$ User plans Goa trip $\to$ Publishes trip $\to$ Compatible user discovers $\to$ Shows interest $\to$ Creator approves $\to$ User joins Squad $\to$ User suggests Day 2 change $\to$ DAIna generates revision $\to$ Creator accepts $\to$ Version 2 committed.
- [ ] **Final QA & Test Suite Pass**:
  - 100% test pass on backend (`pytest`) and frontend (`vitest`).

---

## 📝 Error & Incident Log

| Date | Phase | Issue Description | Root Cause | Resolution |
| :--- | :---: | :--- | :--- | :--- |
| 2026-10-05 | 0 | `TripRevision` attribute error in unit tests | Model name in schema is `TripSnapshot` | Replaced references in test suite to `TripSnapshot` |
| 2026-10-05 | 0 | `TripProposal` attribute error `proposal_id` | Primary key on model is `id` | Updated test queries to `TripProposal.id == prop_id` |
| 2026-10-05 | 0 | `SquadRoom` attribute error `trip_id` | Foreign key column name is `itinerary_id` | Updated test queries to `SquadRoom.itinerary_id == trip_id` |
