/**
 * Canonical DashTiny Frontend Domain Types
 * Single Source of Truth for Trip graph, Itineraries, Revisions, Proposals, and Bookings.
 */

export type ProvenanceTier =
  | "VERIFIED"
  | "CURATED"
  | "AI_GENERATED"
  | "USER_GENERATED"
  | "ESTIMATED"
  | "DEMO"
  | "DETERMINISTIC"
  | "UNRESOLVED";

export interface TripActivity {
  id: string;
  time: string;
  description: string;
  location: string;
  placeType: string;
  cost: number;
  lat: number | null;
  lng: number | null;
  provenance: ProvenanceTier | string;
  generationSource?: string;
  locationSource?: string;
  contentSource?: string;
  whyRecommended?: string;
  sourceCitation?: string;
  startAt?: string | null;
  endAt?: string | null;
  timezone?: string | null;
  durationMinutes?: number;
  transitMinutes?: number;
  transitMode?: string;
  transitSource?: string;
  transitConfidence?: string;
  crowdWarning?: string | null;
  estimatedTransit?: string | null;
}

export interface TripDay {
  id: string;
  dayNumber: number;
  title: string;
  coverImage?: string | null;
  weather: string;
  activities: TripActivity[];
}

export interface TripBooking {
  id: string;
  tripId?: string | null;
  userId: string;
  category: "flight" | "hotel" | "train" | "bus" | "cab" | "activity" | "insurance" | string;
  provider: string;
  title: string;
  amount: number;
  currency: string;
  status: "draft" | "saved_reference" | "pending" | "confirmed" | "cancelled";
  pnrRef?: string | null;
  provenance: "USER_PROVIDED" | "SAVED_REFERENCE" | "CURATED" | "PARTNER_VERIFIED" | "PROVIDER_VERIFIED";
  details?: Record<string, any>;
  createdAt?: string;
}

export interface TripSquadMember {
  id: string;
  userId: string;
  name: string;
  email?: string;
  role: "owner" | "member";
  paid?: number;
  balance?: number;
  joinedAt?: string;
}

export interface TripSquad {
  id: string;
  itineraryId: string;
  roomCode: string;
  totalSpent?: number;
  perPersonShare?: number;
  members: TripSquadMember[];
}

export interface TripRevision {
  id: string;
  version: number;
  parentVersion?: number | null;
  action: string;
  actionType?: string;
  summary?: string;
  isReverted?: boolean;
  createdAt: string;
}

export interface ProposalChange {
  action: "add" | "modify" | "delete" | "reorder" | string;
  dayNumber?: number;
  timeSlot?: string;
  activityId?: string;
  description?: string;
  whyRecommended?: string;
  cost?: number;
}

export interface TripProposal {
  proposalId: string;
  tripId: string;
  summary: string;
  changes: ProposalChange[];
  before: { days: TripDay[] };
  after: { days: TripDay[] };
  verification: Record<string, any>;
  provenance: Record<string, any>;
  parentVersion: number;
  createdAt?: string;
}

export interface RewardBalance {
  totalCoins: number;
  tier: string;
  lastAwarded?: number;
}

export interface CommunityTrip {
  id: string;
  authorId: string;
  sourceTripId?: string | null;
  authorName: string;
  authorAvatar: string;
  trustScore: string;
  authorTrustScore: number;
  getawayTitle: string;
  destination: string;
  location: string;
  imageUrl: string;
  content: string;
  duration: string;
  budgetEst: string;
  tripStyle: string[];
  isIdentityVerified: boolean;
  isTripCompleted: boolean;
  likesCount: number;
  commentsCount: number | null;
  companionsNeeded: number;
  createdAt: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  origin?: string;
  startDate: string;
  endDate: string;
  travellers: number;
  budget: number;
  currency: string;
  vibe?: string;
  persona?: string;
  isPublic?: boolean;
  days: TripDay[];
  bookings?: TripBooking[];
  squad?: TripSquad | null;
  snapshots?: TripRevision[];
}
