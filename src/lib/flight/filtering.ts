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
 * Robustly parses a flight time string into minutes from midnight (0–1439).
 * Supports 12-hour AM/PM format (e.g., "12:00 AM" -> 0, "01:15 PM" -> 795)
 * as well as 24-hour format (e.g., "05:30" -> 330, "14:30" -> 870).
 *
 * Returns null if the string is empty or invalid.
 */
export function parseFlightTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr.trim();

  // 12-hour format: e.g. "12:00 AM", "01:15 PM", "8:40pm"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

    if (meridiem === 'AM') {
      if (hour === 12) hour = 0;
    } else {
      // PM
      if (hour !== 12) hour += 12;
    }
    return hour * 60 + minute;
  }

  // 24-hour format fallback: e.g. "05:30", "14:30"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  return null;
}

/**
 * Checks whether a timestamp falls within a recognized time corridor using minutes from midnight.
 * Corridors:
 * Early Morning: 00:00–05:59 (0–359 mins)
 * Morning:       06:00–11:59 (360–719 mins)
 * Afternoon:     12:00–17:59 (720–1079 mins)
 * Evening:       18:00–21:59 (1080–1319 mins)
 * Night:         22:00–23:59 (1320–1439 mins)
 */
export function isTimeInSlot(timeStr: string, slotId: TimeSlotId): boolean {
  const mins = parseFlightTimeToMinutes(timeStr);
  if (mins === null) return false;

  switch (slotId) {
    case 'early_morning':
      return mins >= 0 && mins < 360;
    case 'morning':
      return mins >= 360 && mins < 720;
    case 'afternoon':
      return mins >= 720 && mins < 1080;
    case 'evening':
      return mins >= 1080 && mins < 1320;
    case 'night':
      return mins >= 1320 && mins <= 1439;
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
