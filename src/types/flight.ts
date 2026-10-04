/**
 * DashTiny L2 — Canonical Flight Search & Offer Frontend Domain Types
 * Defines the contract between FastAPI backend and Next.js frontend.
 */

export interface AirportMetadata {
  code: string;
  name: string;
  city: string;
  country: string;
}

export interface FlightStopDetail {
  airport: string;
  city?: string;
  duration_minutes: number;
}

export interface FlightSegment {
  origin: string;
  destination: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  duration_minutes: number;
  stops: number;
  stop_details?: FlightStopDetail[];
}

export interface FlightOffer {
  offer_id: string;
  provider: string;
  airline: string;
  flight_number: string;
  origin: string;
  destination: string;
  origin_airport: AirportMetadata;
  destination_airport: AirportMetadata;
  departure_date: string;
  return_date?: string | null;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  stops: number;
  stop_details: FlightStopDetail[];
  passengers: number;
  cabin_class: 'economy' | 'premium_economy' | 'business' | 'first' | string;
  trip_type: 'oneway' | 'roundtrip';
  price: number;
  per_passenger_price: number;
  currency: string;
  baggage: string;
  cancellation: string;
  availability_state: 'ESTIMATED' | 'AVAILABLE' | 'LIMITED' | string;
  provenance: 'CURATED' | string;
  source: 'CURATED_DATABASE' | string;
  retrieved_at: string;
  expires_at: string;
  deep_link: string;
  why_recommended: string;
  outbound: FlightSegment;
  inbound?: FlightSegment | null;
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first' | string;
  tripType: 'oneway' | 'roundtrip';
}

export interface FlightSearchResponse {
  search?: {
    origin: string;
    destination: string;
    departure_date: string;
    return_date?: string | null;
    passengers: number;
    cabin_class: string;
    trip_type: string;
  };
  search_params?: {
    origin: string;
    destination: string;
    departure_date: string;
    return_date?: string | null;
    passengers: number;
    cabin_class: string;
    trip_type: string;
  };
  search_id?: string;
  total_count?: number;
  offers: FlightOffer[];
  provenance?: string;
  availability_state?: string;
  retrieved_at?: string;
  expires_at?: string;
}

export type TimeSlotId = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface FlightFilterState {
  stops: number[]; // e.g. [0] for Non-stop, [1] for 1 stop, [2] for 2+ stops
  airlines: string[];
  maxPrice: number;
  departureSlots: TimeSlotId[];
  arrivalSlots: TimeSlotId[];
}

export type FlightSortOption = 'cheapest' | 'fastest' | 'balanced' | 'earliest' | 'latest';

export interface FlightComparisonState {
  selectedOffers: FlightOffer[];
  isOpen: boolean;
}

export { DEFAULT_FLIGHT_FILTERS } from '@/lib/flight/filtering';
