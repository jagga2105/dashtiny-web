import { FlightOffer, FlightFilterState, TimeSlotId } from '@/types/flight';

export const DEFAULT_FLIGHT_FILTERS: FlightFilterState = {
  stops: [],
  airlines: [],
  maxPrice: 100000,
  departureSlots: [],
  arrivalSlots: [],
};

export const DEPARTURE_SLOTS: { id: TimeSlotId; label: string; desc: string }[] = [
  { id: 'early_morning', label: 'Early Morning', desc: 'Before 6 AM' },
  { id: 'morning', label: 'Morning', desc: '6 AM – 12 PM' },
  { id: 'afternoon', label: 'Afternoon', desc: '12 PM – 6 PM' },
  { id: 'evening', label: 'Evening', desc: '6 PM – 10 PM' },
  { id: 'night', label: 'Night', desc: 'After 10 PM' },
];

export const ARRIVAL_SLOTS: { id: TimeSlotId; label: string; desc: string }[] = [
  { id: 'early_morning', label: 'Early Morning', desc: 'Before 6 AM' },
  { id: 'morning', label: 'Morning', desc: '6 AM – 12 PM' },
  { id: 'afternoon', label: 'Afternoon', desc: '12 PM – 6 PM' },
  { id: 'evening', label: 'Evening', desc: '6 PM – 10 PM' },
  { id: 'night', label: 'Night', desc: 'After 10 PM' },
];

/**
 * Checks whether an HH:MM timestamp falls within a recognized time corridor
 */
export function isTimeInSlot(timeStr: string, slotId: TimeSlotId): boolean {
  if (!timeStr) return false;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return false;
  const hour = parseInt(match[1], 10);

  switch (slotId) {
    case 'early_morning':
      return hour < 6;
    case 'morning':
      return hour >= 6 && hour < 12;
    case 'afternoon':
      return hour >= 12 && hour < 18;
    case 'evening':
      return hour >= 18 && hour < 22;
    case 'night':
      return hour >= 22;
    default:
      return true;
  }
}

/**
 * Pure filter pipeline for normalized FlightOffer items
 */
export function filterFlightOffers(
  offers: FlightOffer[],
  filters: FlightFilterState
): FlightOffer[] {
  if (!offers || offers.length === 0) return [];

  return offers.filter((offer) => {
    // 1. Stops filter
    if (filters.stops && filters.stops.length > 0) {
      const matchesStop = filters.stops.some((s) => {
        if (s >= 2) return offer.stops >= 2;
        return offer.stops === s;
      });
      if (!matchesStop) return false;
    }

    // 2. Airline multi-select
    if (filters.airlines && filters.airlines.length > 0) {
      if (!filters.airlines.includes(offer.airline)) return false;
    }

    // 3. Max price threshold
    if (typeof filters.maxPrice === 'number' && filters.maxPrice > 0) {
      if (offer.price > filters.maxPrice) return false;
    }

    // 4. Departure time slot
    if (filters.departureSlots && filters.departureSlots.length > 0) {
      const matchesDeparture = filters.departureSlots.some((slot) =>
        isTimeInSlot(offer.departure_time, slot)
      );
      if (!matchesDeparture) return false;
    }

    // 5. Arrival time slot
    if (filters.arrivalSlots && filters.arrivalSlots.length > 0) {
      const matchesArrival = filters.arrivalSlots.some((slot) =>
        isTimeInSlot(offer.arrival_time, slot)
      );
      if (!matchesArrival) return false;
    }

    return true;
  });
}

/**
 * Derives available airlines and offer counts from the raw results
 */
export function getAvailableAirlines(
  offers: FlightOffer[]
): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const o of offers) {
    map.set(o.airline, (map.get(o.airline) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Calculates catalog price boundaries
 */
export function getPriceBounds(
  offers: FlightOffer[]
): { minPrice: number; maxPrice: number } {
  if (!offers || offers.length === 0) {
    return { minPrice: 0, maxPrice: 50000 };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const o of offers) {
    if (o.price < min) min = o.price;
    if (o.price > max) max = o.price;
  }
  return {
    minPrice: min === Infinity ? 0 : min,
    maxPrice: max === -Infinity ? 50000 : max,
  };
}
