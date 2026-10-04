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
| **Phase 1** | **Traveler Profile & Personalization Foundation** | `COMPLETED` | Extended `UserProfile` schema, `/api/v1/profile` API, profile page, dislikes/likes scoring |
| **Phase 2** | **Trip Visibility & Discovery Boundaries** | `COMPLETED` | Tri-state visibility (`PUBLIC`, `FRIENDS_ONLY`, `PRIVATE`), server-authoritative filtering |
| **Phase 3** | **Deterministic Matching Engine** | `COMPLETED` | Explainable compatibility scoring, dislike exclusion, re-ranked community feed |
| **Phase 4** | **"Show Interest" Flow & Friends Social Graph** | `COMPLETED` | `Friendship`, `TripInterestRequest`, creator review breakdown, approval to Squad member |
| **Phase 5** | **Squad Governance & Group Profile Aggregation** | `COMPLETED` | Squad ownership, member roles, group preference aggregation (shared likes vs dislikes) |
| **Phase 6** | **Collaborative Itinerary Editing with DAIna** | `COMPLETED` | Member suggestion $\to$ DAIna revision proposal $\to$ creator approval/vote $\to$ version $v(N+1)$ |
| **Phase 7** | **Community Quality & Notifications System** | `COMPLETED` | `Notification` model, inbox feed, real-time/polling alerts for invites, suggestions, votes |
| **Phase 8** | **End-to-End UX & Mobile Verification** | `COMPLETED` | Multi-viewport tests (360px, 390px, 768px), zero horizontal overflow, full scenario pass |

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

### [x] Phase 1 — Traveler Profile & Personalization Foundation (COMPLETED)
**Goal**: Make traveler preferences authoritative, persistent, and directly influential in itinerary synthesis and scoring.

- [x] **Database Migration**:
  - Extended `UserProfile` in `backend/app/models/models.py`:
    - `interests`: JSON array of strings
    - `likes`: JSON array of strings (e.g. `nightlife`, `beaches`, `seafood`, `photography`)
    - `dislikes`: JSON array of strings (e.g. `religious`, `pilgrimage`, `crowds`, `long_walks`)
    - `travel_style`: String (`solo`, `couple`, `family`, `digital_nomad`, `backpacker`, `luxury`, `adventure`, `leisure`)
    - `pace`: String (`relaxed`, `balanced`, `packed`, `fast`, `slow`)
    - `food_preferences`: JSON array of strings (`vegetarian`, `vegan`, `seafood`, `halal`, `local_eats`)
    - `activity_preferences`: JSON array of strings
    - `accommodation_preference`: String (`hostel`, `budget`, `comfort`, `boutique`, `luxury`, `resort`, `villa`)
    - `transport_preference`: String (`walking`, `public_transit`, `cab`, `rental_car`, `mix`, `scooter`)
    - `budget_tier`: String (`budget`, `moderate`, `premium`, `luxury`, `comfort`, `ultra_luxury`)
    - `social_preferences`: JSON object (`open_to_squad`, `meet_travelers`, `share_rides`)
  - Created Alembic migration `a1b2c3d4e5f6_add_traveler_personalization_profile_fields.py` and upgraded PostgreSQL head.
- [x] **Backend Profile Endpoints**:
  - `GET /api/v1/profile`: Retrieve authenticated user's complete profile and preferences.
  - `PUT /api/v1/profile`: Update authenticated user's preferences with strict validation.
  - `GET /api/v1/profile/{user_id}`: Safe public profile view with privacy boundaries.
- [x] **Itinerary Personalization Integration**:
  - Updated `proposal_service.py` and `itinerary_engine.py` to auto-fetch and merge stored `UserProfile` preferences when prompt leaves fields implicit.
  - Updated `DestinationIntelligence.score_candidate`:
    - Dislike suppression: Apply harsh penalty (-60.0) on candidates matching traveler dealbreakers.
    - Like amplification: Add +20.0 bonus for candidates matching traveler explicit passions.
- [x] **Frontend Profile Page**:
  - Created `src/app/profile/page.tsx` with clean, modern tabs:
    - *Travel Style & Pace* (Relaxed, Balanced, Packed with start time & stop count explanations)
    - *Passions & Dealbreakers* (explicit likes bonus & dislikes penalty chips with popular presets)
    - *Stay & Dining Habits* (Stays, Cuisine, Local transit)
    - *Squad & Collaboration Boundaries* (Open to squads, meet travelers, share rides)
  - Added API service methods `getProfile`, `updateProfile`, `getPublicProfile` in `src/services/api.ts`.
  - Added direct link to `/profile` in `TopNavbar.tsx` user dropdown with "AI DNA" badge.
- [x] **Tests**:
  - Backend tests: `backend/tests/unit/test_profile_personalization.py` (Profile CRUD, privacy masking, auto-inheritance into proposal generation, and dislike suppression verification all passing).
  - Backend suite: 155 unit tests passing.
  - Frontend typecheck (`npx tsc --noEmit`) and Vitest suite (78 tests passing).

---

### [x] Phase 2 — Trip Visibility & Discovery Boundaries
**Goal**: Enforce tri-state trip visibility boundaries at the database and API layers.

- [x] **Database Migration**:
  - Added `visibility` column to `Itinerary`: String (`PUBLIC`, `FRIENDS_ONLY`, `PRIVATE`), indexed and guarded by check constraint `ck_itinerary_visibility`.
  - Added `Friendship` model with unique pair constraint and status check.
  - Created Alembic migration `b2c3d4e5f6a7_add_trip_visibility_and_friendships.py` and upgraded PostgreSQL head.
- [x] **Server-Authoritative Enforcement**:
  - Updated `GET /api/v1/trips/{trip_id}`:
    - Owner or Squad member: Always granted access.
    - `PUBLIC`: Accessible by any authenticated/public user.
    - `FRIENDS_ONLY`: Accessible only if requester has an accepted `Friendship` with the trip owner.
    - `PRIVATE`: Forbidden (HTTP 403) to non-members.
  - Updated `GET /api/v1/community/feed`:
    - Automatically filters out any post referencing trips where `visibility == 'PRIVATE'`.
  - Added `PATCH /api/v1/trips/{trip_id}/visibility` endpoint allowing trip owner to update visibility (`PUBLIC`, `FRIENDS_ONLY`, `PRIVATE`) and synchronizing `is_public`.
- [x] **Frontend UI**:
  - Added interactive Tri-State Visibility Control dropdown to `TripHeader.tsx` (Public / Friends Only / Private with distinct icons and descriptions).
  - Wired `updateTripVisibility` API into `src/services/api.ts` and `src/app/trips/page.tsx`.
- [x] **Tests**:
  - Added `backend/tests/unit/test_trip_visibility.py` covering public access, private boundaries (403 for strangers), friends-only access flow upon friendship acceptance, patch visibility validation, and private feed leak prevention (5/5 passed).
  - All 160 backend unit tests passing.
  - Frontend typecheck and 78 vitest tests passing.

---

### [x] Phase 3 — Deterministic Matching Engine
**Goal**: Create an explainable matching engine that ranks trips in Community and evaluates compatibility for prospective travelers.

- [x] **Matching Engine Service** (`backend/app/services/matching_engine.py`):
  - Function `calculate_traveler_trip_compatibility(user_profile, trip, trip_owner_profile) -> CompatibilityReport`:
    - Interest overlap score (0–35 pts)
    - Dislike exclusion: If trip has categories matching user dislikes $\to$ score capped at max 28 with dealbreaker flag
    - Pace compatibility (0–20 pts): Exact (20 pts), Compatible (13 pts), Opposite (4 pts)
    - Budget tier alignment (0–15 pts): Aligned (15 pts), Similar (9 pts), Divergent (3 pts)
    - Travel style / Persona match (0–15 pts)
    - Food / dining preference match (0–15 pts)
    - Deterministic explanations (`shared_interests`, `shared_vibe`, `dealbreakers`, `explanation`)
- [x] **Community Feed Ranking**:
  - Updated `GET /api/v1/community/feed` to accept authenticated user context via `get_optional_user`.
  - Re-ranks discoverable trips by non-dealbreakers and compatibility score.
  - Returns explainable badges and dealbreaker conflict indicators.
- [x] **Frontend UI**:
  - Added compatibility badges (High Resonance / Match / Dealbreaker Conflict) and natural explanation callouts with shared passion chips to `src/app/community/page.tsx`.
- [x] **Tests**:
  - `backend/tests/unit/test_matching_engine.py` passing 4/4 tests (interest overlap, dealbreaker suppression, pace/budget divergence, community feed re-ranking).
  - All 164 backend unit tests passing.
  - Frontend typecheck and 78 vitest tests passing.

---

### [x] Phase 4 — "Show Interest" Flow & Friends Social Graph
**Goal**: Transition trip discovery into structured connection and squad formation.

- [x] **Database Models**:
  - `Friendship` (`id`, `user_id`, `friend_id`, `status` ['pending', 'accepted', 'rejected', 'blocked'], `created_at`, `updated_at`).
  - `TripInterestRequest` (`id`, `trip_id`, `user_id`, `message`, `status` ['pending', 'approved', 'rejected'], `compatibility_score`, `compatibility_breakdown`, `created_at`).
  - Alembic migration `c3d4e5f6a7b8_add_trip_interest_requests.py` applied cleanly.
- [x] **Friends API** (`backend/app/api/v1/friends.py`):
  - `GET /api/v1/friends`: List accepted friends, incoming and outgoing requests.
  - `POST /api/v1/friends/request`: Send friend request by ID or email (handles reciprocal requests).
  - `POST /api/v1/friends/requests/{request_id}/respond`: Accept or reject request.
  - `DELETE /api/v1/friends/{friend_id}`: Remove friendship.
- [x] **Show Interest API** (`backend/app/api/v1/trips.py`):
  - `POST /api/v1/trips/{trip_id}/interest`: Applicant submits interest with message and auto-computes snapshot compatibility breakdown.
  - `GET /api/v1/trips/{trip_id}/interest`: Creator or squad members view pending applicants with applicant profile, compatibility breakdown, and dealbreakers.
  - `POST /api/v1/trips/{trip_id}/interest/{request_id}/respond`:
    - If `approve`: Auto-creates `SquadRoom` if needed and adds applicant as `SquadMember` with role `member`.
    - If `reject`: Updates status to `rejected`.
- [x] **Frontend UI**:
  - "Request to Join" button on Community trip cards with `InterestModal` dialog showing host info, AI compatibility radar, dealbreaker warnings, and introduction message input.
  - `SquadRoomHub.tsx` "Join Requests" tab displaying applicant profiles, compatibility badges, dealbreaker warnings, notes, and "Approve into Squad" / "Decline" actions.
  - `TripWorkspace` (`src/app/trips/page.tsx`) passes active `tripId` to `SquadRoomHub`.
- [x] **Tests**:
  - `backend/tests/unit/test_friends_and_interest.py` passing 5/5 tests (friend request creation, reciprocal auto-acceptance, trip interest flow with auto-squad addition, and creator-only security enforcement).
  - All 169 backend unit tests passing.
  - Frontend typecheck and 78 vitest tests passing.

---

### [x] Phase 5 — Squad Governance & Group Profile Aggregation
**Goal**: Transform Squad from a simple member list into an intelligent, consensus-driven group workspace.

- [x] **Squad Profile Aggregation Engine** (`backend/app/services/planner/squad_aggregator.py`):
  - Aggregates traveler preferences across creator and all squad members:
    - `harmonized_pace`: Consensus pace accommodating relaxed/slow members for squad comfort.
    - `shared_passions`: Interests shared by $\ge 2$ members and ranked interest distribution.
    - `universal_exclusions`: Strict union of member dislikes with attribution (DAIna and Planner automatically penalize/exclude matching activities).
    - `combined_dietary`: Unified dietary and food preferences across all members.
    - `narrative`: Cohesive human-readable group summary.
- [x] **Squad Governance & Roles**:
  - `GET /api/v1/squads/{squad_id}/profile`: Returns aggregated group profile.
  - `GET /api/v1/squads/by-trip/{trip_id}`: Look up or auto-initialize squad room and return profile.
  - `PUT /api/v1/squads/{squad_id}/members/{user_id}/role`: Owner promotes/demotes between `co_planner` and `member`.
  - `DELETE /api/v1/squads/{squad_id}/members/{user_id}`: Owner removes member or member self-leaves.
- [x] **Frontend Squad Hub Polish**:
  - Connected `SquadRoomHub.tsx` to real squad profile API (`apiService.getSquadByTrip` and `apiService.getSquadProfile`).
  - Added **Squad Consensus Profile & Radar** card displaying:
    - Harmonized Pacing pillar with rationale
    - Shared Passions & Interests pillar with dietary tags
    - Universal Exclusions pillar with member attribution
    - Squad Member Governance & Roles roster with Owner role controls (promote to Co-Planner, set as Member, remove).
- [x] **Tests**:
  - `backend/tests/unit/test_squad_aggregation_and_governance.py` passing 4/4 tests.
  - All 173 backend unit tests passing.
  - Frontend TypeScript check (`tsc`) and 78 vitest tests passing.

---

### [x] Phase 6 — Collaborative Itinerary Editing with DAIna
**Goal**: Enable squad members to suggest changes that DAIna synthesizes into proposals for group review, voting, and atomic revision.

- [x] **Database Models**:
  - `SquadSuggestion` (`id`, `squad_id`, `user_id`, `instruction`, `status` ['open', 'proposal_generated', 'accepted', 'rejected', 'withdrawn'], `proposal_id`, `created_at`, `updated_at`).
  - `SquadVote` (`id`, `squad_id`, `suggestion_id`, `proposal_id`, `user_id`, `vote` ['up', 'down'], `created_at`).
  - Alembic migration `d4e5f6a7b8c9_add_squad_suggestions_and_votes.py` applied cleanly.
- [x] **DAIna Squad Suggestion Pipeline**:
  - `POST /api/v1/squads/{squad_id}/suggestions`: Member submits suggestion (e.g., *"Make Day 1 less tiring and add private villa chill"*).
  - DAIna action engine evaluates suggestion against active itinerary, geocoding and weather tools.
  - DAIna generates a durable `TripProposal` revision referencing `parent_version`. Author automatically receives default upvote.
  - `GET /api/v1/squads/{squad_id}/suggestions`: Lists suggestions with vote counts (`upvotes`, `downvotes`, `user_vote`) and DAIna diffs.
  - `POST /api/v1/squads/{squad_id}/suggestions/{suggestion_id}/vote`: Squad members vote up or down.
  - `POST /api/v1/squads/{squad_id}/suggestions/{suggestion_id}/accept`: Squad owner or Co-Planner approves suggestion, invoking canonical `accept_ai_proposal` to commit $v(N+1)$ revision snapshot with row locking.
  - `POST /api/v1/squads/{squad_id}/suggestions/{suggestion_id}/reject`: Squad owner, Co-Planner, or author rejects/withdraws suggestion.
- [x] **Frontend Collaborative Workspace**:
  - Connected `SquadRoomHub.tsx` Tab 1 to live suggestions and voting endpoints via `apiService` methods.
  - "Ask DAIna to Propose an Itinerary Revision" prompt input and submission form.
  - Collaborative suggestions feed with DAIna diff preview pills, vote counters, author info, and status badges.
  - Upvote / Downvote interactive buttons.
  - "Accept into Itinerary (vN+1)" one-click action for Co-Planners and Trip Owner.
- [x] **Tests**:
  - `backend/tests/unit/test_squad_suggestions_and_voting.py` passing 6/6 tests.
  - Full backend test suite passing 179/179 unit tests.
  - Frontend TypeScript check (`tsc`) and 78/78 vitest tests passing.

---

### [x] Phase 7 — Community Quality & Notifications System
**Goal**: Keep travelers informed about squad invitations, applications, suggestions, and itinerary changes.

- [x] **Database Model**:
  - `Notification` (`id`, `user_id`, `type`, `title`, `body`, `payload`, `is_read`, `created_at`).
  - Indexes on `(user_id, is_read)` and `(user_id, created_at)`.
  - Alembic migration `e5f6a7b8c9d0_add_notifications_table.py` applied cleanly.
  - Event triggers integrated via `NotificationService`:
    - `INTEREST_RECEIVED`: Trip owner notified when someone expresses interest.
    - `INTEREST_APPROVED`, `INTEREST_REJECTED`: Applicant notified when trip creator acts.
    - `FRIEND_REQUEST`, `FRIEND_ACCEPTED`: Social graph connection updates.
    - `SQUAD_SUGGESTION_CREATED`: Squad members notified of new itinerary suggestions.
    - `ITINERARY_REVISED`: Squad members notified when canonical revision is locked.
- [x] **Notifications API**:
  - `GET /api/v1/notifications`: List notifications with unread counter.
  - `POST /api/v1/notifications/{id}/read`: Mark notification as read.
  - `POST /api/v1/notifications/read-all`: Mark all notifications as read.
  - `DELETE /api/v1/notifications/{id}`: Delete individual notification.
- [x] **Frontend Notification Drawer**:
  - Bell icon in `TopNavbar.tsx` with animated unread badge indicator.
  - Flyout notification drawer with type-specific color icons (`Sparkles`, `UserPlus`, `Users`, `Bell`).
  - "Mark all read" quick action button.
  - Deep-link redirection to trips and profile workspaces.
  - Ambient 20-second background polling for real-time alerts.
- [x] **Tests**:
  - `backend/tests/unit/test_notifications.py` passing 4/4 tests.
  - Full backend test suite passing 183/183 unit tests.
  - Frontend TypeScript check (`tsc`) and 78/78 vitest tests passing.

---

### [x] Phase 8 — End-to-End UX & Mobile Verification (COMPLETED)
**Goal**: Polish and verify the complete traveler journey across all device viewports.

- [x] **Mobile Responsiveness**:
  - Test viewports: 360px (compact mobile), 390px (standard iPhone), 768px (tablet), 1280px (desktop).
  - Zero horizontal scroll verified in browser subagent visual audit.
  - Touch-friendly tap targets ($\ge 44\text{px}$) applied across `TopNavbar` notifications bell, user menu, squad room tabs, and suggestion voting buttons.
  - Clamped width constraints (`w-[calc(100vw-2rem)] sm:w-96 max-w-sm`) applied on notification flyout and profile drawers to eliminate edge clipping on narrow viewports.
- [x] **Full Scenario Walkthrough**:
  - Automated full-lifecycle integration test `backend/tests/unit/test_e2e_traveler_lifecycle.py` passing:
    1. User A (Creator) initializes profile with pace (`relaxed`), passions (`beaches`, `seafood`, `photography`), and dealbreakers (`crowded_temples`).
    2. User A creates and publishes a Goa trip with `PUBLIC` visibility.
    3. User B (Explorer) initializes compatible profile with matching pace and passions.
    4. User B discovers Goa trip in `/api/v1/community/feed` with explainable compatibility score ($>70\%$) and no dealbreakers.
    5. User B submits "Show Interest" request to join Squad.
    6. User A receives `INTEREST_RECEIVED` notification and approves User B.
    7. User B receives `INTEREST_APPROVED` notification and enters Squad Room.
    8. Squad Consensus Radar reflects 2 members with harmonized `relaxed` pace and shared likes.
    9. User A promotes User B to `co_planner`.
    10. User B submits collaborative itinerary suggestion to DAIna.
    11. DAIna synthesizes `TripProposal` revision diff; squad members upvote.
    12. Co-Planner accepts suggestion into itinerary, committing revision snapshot $v(2)$ under row lock.
    13. Squad members receive `ITINERARY_REVISED` notification and mark all as read.
- [x] **Final QA & Test Suite Pass**:
  - 100% test pass on backend: 184/184 unit tests passing (`pytest backend/tests/unit/`).
  - 100% test pass on frontend: 78/78 vitest tests passing (`npm test`).
  - 0 TypeScript errors (`npx tsc --noEmit` exits 0).

---

## 📝 Error & Incident Log

| Date | Phase | Issue Description | Root Cause | Resolution |
| :--- | :---: | :--- | :--- | :--- |
| 2026-10-05 | 0 | `TripRevision` attribute error in unit tests | Model name in schema is `TripSnapshot` | Replaced references in test suite to `TripSnapshot` |
| 2026-10-05 | 0 | `TripProposal` attribute error `proposal_id` | Primary key on model is `id` | Updated test queries to `TripProposal.id == prop_id` |
| 2026-10-05 | 0 | `SquadRoom` attribute error `trip_id` | Foreign key column name is `itinerary_id` | Updated test queries to `SquadRoom.itinerary_id == trip_id` |
| 2026-10-05 | 8 | `AttributeError: 'UserProfile' object has no attribute 'avatar_url'` in `squad.py` | `avatar_url` is stored on `User` model, not `UserProfile` | Updated `user.profile.avatar_url` references to `user.avatar_url` in suggestion endpoints |

