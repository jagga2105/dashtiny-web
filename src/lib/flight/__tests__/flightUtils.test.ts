import { describe, it, expect } from 'vitest';
import {
  filterFlightOffers,
  getAvailableAirlines,
  getPriceBounds,
  isTimeInSlot,
  DEFAULT_FLIGHT_FILTERS,
} from '../filtering';
import {
  computeFlightDecisionMetrics,
  sortFlightOffers,
  formatFlightDuration,
  computeFactualWhyThisFits,
} from '../ranking';
import { FlightOffer } from '@/types/flight';

const MOCK_OFFERS: FlightOffer[] = [
  {
    offer_id: 'fl_indigo_del_bom',
    provider: 'IndiGo',
    airline: 'IndiGo',
    flight_number: '6E-501',
    origin: 'DEL',
    destination: 'BOM',
    origin_airport: { code: 'DEL', name: 'Indira Gandhi', city: 'Delhi', country: 'India' },
    destination_airport: { code: 'BOM', name: 'CSMIA', city: 'Mumbai', country: 'India' },
    departure_date: '2026-10-20',
    return_date: '2026-10-25',
    departure_time: '06:30',
    arrival_time: '08:45',
    duration_minutes: 135,
    stops: 0,
    stop_details: [],
    passengers: 1,
    cabin_class: 'economy',
    trip_type: 'roundtrip',
    price: 4500,
    per_passenger_price: 4500,
    currency: 'INR',
    baggage: '15kg check-in',
    cancellation: 'Refundable with fee',
    availability_state: 'ESTIMATED',
    provenance: 'CURATED',
    source: 'CURATED_DATABASE',
    retrieved_at: '2026-10-20T00:00:00Z',
    expires_at: '2026-10-20T02:00:00Z',
    deep_link: 'https://www.goindigo.in',
    why_recommended: 'Balanced option',
  },
  {
    offer_id: 'fl_airindia_del_bom',
    provider: 'Air India',
    airline: 'Air India',
    flight_number: 'AI-805',
    origin: 'DEL',
    destination: 'BOM',
    origin_airport: { code: 'DEL', name: 'Indira Gandhi', city: 'Delhi', country: 'India' },
    destination_airport: { code: 'BOM', name: 'CSMIA', city: 'Mumbai', country: 'India' },
    departure_date: '2026-10-20',
    return_date: '2026-10-25',
    departure_time: '20:00',
    arrival_time: '22:10',
    duration_minutes: 130,
    stops: 0,
    stop_details: [],
    passengers: 1,
    cabin_class: 'economy',
    trip_type: 'roundtrip',
    price: 5200,
    per_passenger_price: 5200,
    currency: 'INR',
    baggage: '25kg check-in',
    cancellation: 'Free cancellation within 24h',
    availability_state: 'ESTIMATED',
    provenance: 'CURATED',
    source: 'CURATED_DATABASE',
    retrieved_at: '2026-10-20T00:00:00Z',
    expires_at: '2026-10-20T02:00:00Z',
    deep_link: 'https://www.airindia.com',
    why_recommended: 'Fastest flight',
  },
  {
    offer_id: 'fl_spicejet_del_bom',
    provider: 'SpiceJet',
    airline: 'SpiceJet',
    flight_number: 'SG-819',
    origin: 'DEL',
    destination: 'BOM',
    origin_airport: { code: 'DEL', name: 'Indira Gandhi', city: 'Delhi', country: 'India' },
    destination_airport: { code: 'BOM', name: 'CSMIA', city: 'Mumbai', country: 'India' },
    departure_date: '2026-10-20',
    return_date: '2026-10-25',
    departure_time: '14:15',
    arrival_time: '18:30',
    duration_minutes: 255,
    stops: 1,
    stop_details: [{ airport: 'JAI', duration_minutes: 45 }],
    passengers: 1,
    cabin_class: 'economy',
    trip_type: 'roundtrip',
    price: 3900,
    per_passenger_price: 3900,
    currency: 'INR',
    baggage: '15kg check-in',
    cancellation: 'Non-refundable',
    availability_state: 'ESTIMATED',
    provenance: 'CURATED',
    source: 'CURATED_DATABASE',
    retrieved_at: '2026-10-20T00:00:00Z',
    expires_at: '2026-10-20T02:00:00Z',
    deep_link: 'https://www.spicejet.com',
    why_recommended: 'Lowest fare',
  },
];

describe('Flight Utility Functions', () => {
  describe('filtering.ts', () => {
    it('isTimeInSlot identifies correct hours', () => {
      expect(isTimeInSlot('05:30', 'early_morning')).toBe(true);
      expect(isTimeInSlot('08:00', 'morning')).toBe(true);
      expect(isTimeInSlot('14:30', 'afternoon')).toBe(true);
      expect(isTimeInSlot('19:45', 'evening')).toBe(true);
      expect(isTimeInSlot('23:15', 'night')).toBe(true);
      expect(isTimeInSlot('14:30', 'morning')).toBe(false);
    });

    it('filters by stops', () => {
      const nonStopOnly = filterFlightOffers(MOCK_OFFERS, {
        ...DEFAULT_FLIGHT_FILTERS,
        stops: [0],
      });
      expect(nonStopOnly.length).toBe(2);
      expect(nonStopOnly.every((o) => o.stops === 0)).toBe(true);

      const oneStopOnly = filterFlightOffers(MOCK_OFFERS, {
        ...DEFAULT_FLIGHT_FILTERS,
        stops: [1],
      });
      expect(oneStopOnly.length).toBe(1);
      expect(oneStopOnly[0].airline).toBe('SpiceJet');
    });

    it('filters by airline', () => {
      const indigoOnly = filterFlightOffers(MOCK_OFFERS, {
        ...DEFAULT_FLIGHT_FILTERS,
        airlines: ['IndiGo'],
      });
      expect(indigoOnly.length).toBe(1);
      expect(indigoOnly[0].airline).toBe('IndiGo');
    });

    it('filters by maxPrice', () => {
      const cheapOnly = filterFlightOffers(MOCK_OFFERS, {
        ...DEFAULT_FLIGHT_FILTERS,
        maxPrice: 4000,
      });
      expect(cheapOnly.length).toBe(1);
      expect(cheapOnly[0].price).toBe(3900);
    });

    it('filters by departureSlots and arrivalSlots', () => {
      const morningDep = filterFlightOffers(MOCK_OFFERS, {
        ...DEFAULT_FLIGHT_FILTERS,
        departureSlots: ['morning'],
      });
      expect(morningDep.length).toBe(1);
      expect(morningDep[0].airline).toBe('IndiGo');

      const nightArr = filterFlightOffers(MOCK_OFFERS, {
        ...DEFAULT_FLIGHT_FILTERS,
        arrivalSlots: ['night'],
      });
      expect(nightArr.length).toBe(1);
      expect(nightArr[0].airline).toBe('Air India');
    });

    it('computes available airlines and price bounds', () => {
      const airlines = getAvailableAirlines(MOCK_OFFERS);
      expect(airlines.length).toBe(3);
      expect(airlines.map((a) => a.name)).toContain('IndiGo');

      const bounds = getPriceBounds(MOCK_OFFERS);
      expect(bounds.minPrice).toBe(3900);
      expect(bounds.maxPrice).toBe(5200);
    });
  });

  describe('ranking.ts', () => {
    it('computes decision metrics deterministically', () => {
      const metrics = computeFlightDecisionMetrics(MOCK_OFFERS);
      expect(metrics.cheapestOffer?.offer_id).toBe('fl_spicejet_del_bom');
      expect(metrics.lowestFare).toBe(3900);
      expect(metrics.fastestOffer?.offer_id).toBe('fl_airindia_del_bom');
      expect(metrics.fastestDuration).toBe(130);
      // Balanced prefers non-stop under 3h with lowest score (price + dur*10 + stop*1500)
      // IndiGo: 4500 + 1350 = 5850. Air India: 5200 + 1300 = 6500.
      expect(metrics.balancedOffer?.offer_id).toBe('fl_indigo_del_bom');
    });

    it('sorts by cheapest, fastest, earliest, latest, and balanced', () => {
      const cheapest = sortFlightOffers(MOCK_OFFERS, 'cheapest');
      expect(cheapest[0].price).toBe(3900);

      const fastest = sortFlightOffers(MOCK_OFFERS, 'fastest');
      expect(fastest[0].duration_minutes).toBe(130);

      const earliest = sortFlightOffers(MOCK_OFFERS, 'earliest');
      expect(earliest[0].departure_time).toBe('06:30');

      const latest = sortFlightOffers(MOCK_OFFERS, 'latest');
      expect(latest[0].departure_time).toBe('20:00');

      const balanced = sortFlightOffers(MOCK_OFFERS, 'balanced', 'fl_indigo_del_bom');
      expect(balanced[0].offer_id).toBe('fl_indigo_del_bom');
    });

    it('formats flight duration cleanly', () => {
      expect(formatFlightDuration(135)).toBe('2h 15m');
      expect(formatFlightDuration(60)).toBe('1h');
      expect(formatFlightDuration(0)).toBe('—');
    });

    it('computes factual why-this-fits explanation without marketing buzzwords', () => {
      const metrics = computeFlightDecisionMetrics(MOCK_OFFERS);
      const balancedReason = computeFactualWhyThisFits(MOCK_OFFERS[0], metrics);
      expect(balancedReason).toContain('Direct transit under 3 hours');

      const cheapestReason = computeFactualWhyThisFits(MOCK_OFFERS[2], metrics);
      expect(cheapestReason).toContain('Lowest fare');
    });
  });
});
