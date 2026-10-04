import { FlightOffer, FlightSegment } from '@/types/flight';

/**
 * DashTiny Canonical Test Fixture
 * Provides fully typed, valid FlightOffer instances conforming to L2.3 domain contracts.
 * Eliminates ad-hoc type casting ('as unknown as FlightOffer') in test suites.
 */
export function createMockFlightOffer(overrides: Partial<FlightOffer> = {}): FlightOffer {
  const origin = overrides.origin || 'DEL';
  const destination = overrides.destination || 'BOM';
  const departureDate = overrides.departure_date || '2026-10-20';
  const returnDate = overrides.return_date || null;
  const isRoundtrip = overrides.trip_type === 'roundtrip' || !!returnDate;

  const outboundSegment: FlightSegment = overrides.outbound || {
    origin,
    destination,
    departure_date: departureDate,
    departure_time: overrides.departure_time || '06:15 AM',
    arrival_date: overrides.departure_date || departureDate,
    arrival_time: overrides.arrival_time || '08:35 AM',
    duration_minutes: overrides.duration_minutes || 140,
    stops: overrides.stops ?? 0,
    stop_details: overrides.stop_details || [],
  };

  const inboundSegment: FlightSegment | null = overrides.inbound !== undefined
    ? overrides.inbound
    : (isRoundtrip
        ? {
            origin: destination,
            destination: origin,
            departure_date: returnDate || '2026-10-25',
            departure_time: '06:20 PM',
            arrival_date: returnDate || '2026-10-25',
            arrival_time: '08:40 PM',
            duration_minutes: overrides.duration_minutes || 140,
            stops: 0,
            stop_details: [],
          }
        : null);

  return {
    offer_id: overrides.offer_id || `fl_${origin}_${destination}_01`,
    provider: overrides.provider || 'DashTiny Curated Catalog',
    airline: overrides.airline || 'IndiGo',
    flight_number: overrides.flight_number || '6E-501',
    origin,
    destination,
    origin_airport: overrides.origin_airport || {
      code: origin,
      name: `${origin} International Airport`,
      city: origin === 'DEL' ? 'Delhi' : 'Origin City',
      country: 'India',
    },
    destination_airport: overrides.destination_airport || {
      code: destination,
      name: `${destination} International Airport`,
      city: destination === 'BOM' ? 'Mumbai' : 'Dest City',
      country: 'India',
    },
    departure_date: departureDate,
    return_date: returnDate,
    departure_time: overrides.departure_time || '06:15 AM',
    arrival_time: overrides.arrival_time || '08:35 AM',
    duration_minutes: overrides.duration_minutes || 140,
    stops: overrides.stops ?? 0,
    stop_details: overrides.stop_details || [],
    passengers: overrides.passengers ?? 1,
    cabin_class: overrides.cabin_class || 'economy',
    trip_type: isRoundtrip ? 'roundtrip' : 'oneway',
    price: overrides.price ?? 5400,
    per_passenger_price: overrides.per_passenger_price ?? 5400,
    currency: overrides.currency || 'INR',
    baggage: overrides.baggage ?? '15kg Checked • 7kg Cabin',
    cancellation: overrides.cancellation ?? 'Free cancellation within 24 hours of booking',
    availability_state: overrides.availability_state || 'ESTIMATED',
    provenance: overrides.provenance || 'CURATED',
    source: overrides.source || 'CURATED_DATABASE',
    retrieved_at: overrides.retrieved_at || '2026-10-04T00:00:00Z',
    expires_at: overrides.expires_at || '2026-10-04T02:00:00Z',
    deep_link: overrides.deep_link || 'https://www.goindigo.in',
    why_recommended: overrides.why_recommended || 'Direct morning flight under 3 hours',
    outbound: outboundSegment,
    inbound: inboundSegment,
    ...overrides,
  };
}
