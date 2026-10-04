import { FlightOffer, FlightSortOption } from '@/types/flight';
import { parseFlightTimeToMinutes } from './filtering';

export interface FlightDecisionMetrics {
  cheapestOffer: FlightOffer | null;
  fastestOffer: FlightOffer | null;
  balancedOffer: FlightOffer | null;
  lowestFare: number | null;
  fastestDuration: number | null;
  balancedFare: number | null;
  balancedDuration: number | null;
}

/**
 * Deterministically computes highlights and key decision metrics
 */
export function computeFlightDecisionMetrics(
  offers: FlightOffer[]
): FlightDecisionMetrics {
  if (!offers || offers.length === 0) {
    return {
      cheapestOffer: null,
      fastestOffer: null,
      balancedOffer: null,
      lowestFare: null,
      fastestDuration: null,
      balancedFare: null,
      balancedDuration: null,
    };
  }

  let cheapest: FlightOffer = offers[0];
  let fastest: FlightOffer = offers[0];

  for (const o of offers) {
    if (o.price < cheapest.price) {
      cheapest = o;
    }
    if (o.duration_minutes < fastest.duration_minutes) {
      fastest = o;
    }
  }

  // Balanced option calculation:
  // Evaluates cost, transit duration, and stop penalty:
  // score = price + (duration_minutes * 10) + (stops > 0 ? 1500 : 0)
  // Non-stop flights under 3h (180 mins) are favored.
  const directOffers = offers.filter((o) => o.stops === 0);
  const pool = directOffers.length > 0 ? directOffers : offers;

  let balanced: FlightOffer = pool[0];
  let lowestScore = Infinity;

  for (const o of pool) {
    const score = o.price + (o.duration_minutes * 10) + (o.stops * 1500);
    if (score < lowestScore) {
      lowestScore = score;
      balanced = o;
    }
  }

  return {
    cheapestOffer: cheapest,
    fastestOffer: fastest,
    balancedOffer: balanced,
    lowestFare: cheapest.price,
    fastestDuration: fastest.duration_minutes,
    balancedFare: balanced.price,
    balancedDuration: balanced.duration_minutes,
  };
}

/**
 * Calculates a monotonic sorting value (in minutes) for a flight departure.
 * Combines structured departure date (if present) with parsed 12-hour/24-hour departure time.
 * Reusable helper ensuring chronological earliest/latest sorting without string localeCompare.
 */
export function getFlightDepartureSortValue(offer: FlightOffer): number {
  const timeMinutes = parseFlightTimeToMinutes(offer.departure_time) ?? 0;
  if (offer.departure_date) {
    const parts = offer.departure_date.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      // Date in ms / 60000 = minutes from UTC epoch, plus time of day in minutes
      const dateInMinutes = Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 60000);
      return dateInMinutes + timeMinutes;
    }
  }
  return timeMinutes;
}

/**
 * Deterministic sort pipeline for FlightOffer items
 */
export function sortFlightOffers(
  offers: FlightOffer[],
  sortOption: FlightSortOption,
  balancedOfferId?: string | null
): FlightOffer[] {
  if (!offers || offers.length <= 1) return offers ? [...offers] : [];

  const list = [...offers];

  switch (sortOption) {
    case 'cheapest':
      list.sort((a, b) => a.price - b.price);
      break;

    case 'fastest':
      list.sort((a, b) => a.duration_minutes - b.duration_minutes);
      break;

    case 'earliest':
      list.sort((a, b) => getFlightDepartureSortValue(a) - getFlightDepartureSortValue(b));
      break;

    case 'latest':
      list.sort((a, b) => getFlightDepartureSortValue(b) - getFlightDepartureSortValue(a));
      break;

    case 'balanced':
    default:
      list.sort((a, b) => {
        // Balanced offer takes priority
        if (balancedOfferId) {
          if (a.offer_id === balancedOfferId) return -1;
          if (b.offer_id === balancedOfferId) return 1;
        }
        // Then prefer non-stop
        if (a.stops !== b.stops) {
          return a.stops - b.stops;
        }
        // Then composite score (price + duration * 10)
        const scoreA = a.price + a.duration_minutes * 10;
        const scoreB = b.price + b.duration_minutes * 10;
        return scoreA - scoreB;
      });
      break;
  }

  return list;
}

/**
 * Formats duration in minutes to readable hours and minutes (e.g., 2h 20m)
 */
export function formatFlightDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
}

/**
 * Generates an honest, factual reason why an offer is notable.
 * Returns null if no specific factual rationale exists (never outputs generic marketing buzzwords).
 */
export function computeFactualWhyThisFits(
  offer: FlightOffer,
  metrics: FlightDecisionMetrics
): string | null {
  if (offer.offer_id === metrics.balancedOffer?.offer_id) {
    return offer.stops === 0 && offer.duration_minutes <= 180
      ? 'Direct transit under 3 hours with balanced fare'
      : 'Balanced duration and fare for this route';
  }
  if (offer.offer_id === metrics.cheapestOffer?.offer_id) {
    return 'Lowest fare among current catalog offers';
  }
  if (offer.offer_id === metrics.fastestOffer?.offer_id) {
    return 'Fastest transit duration in catalog';
  }
  if (offer.stops === 0 && offer.duration_minutes <= 180) {
    return 'Direct and under 3 hours';
  }
  return null;
}
