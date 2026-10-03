/**
 * DashTiny L2 — Comprehensive Flight Search, Filter, Sort, Comparison & Proposal Vitest Suite
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FlightSearchForm } from '../FlightSearchForm';
import { FlightResults } from '../FlightResults';
import { FlightTripContext } from '../FlightTripContext';
import { FlightOffer, FlightSearchResponse } from '@/types/flight';

vi.mock('@/services/api', () => ({
  apiService: {
    getAirport: vi.fn().mockImplementation((code: string) => {
      if (code === 'DEL') {
        return Promise.resolve({
          id: 'del-1',
          iata_code: 'DEL',
          name: 'Indira Gandhi International Airport',
          city: 'Delhi',
          country: 'India',
        });
      }
      if (code === 'BOM') {
        return Promise.resolve({
          id: 'bom-1',
          iata_code: 'BOM',
          name: 'Chhatrapati Shivaji Maharaj International Airport',
          city: 'Mumbai',
          country: 'India',
        });
      }
      return Promise.resolve(null);
    }),
    searchLocations: vi.fn().mockResolvedValue([]),
    createFlightOfferProposal: vi.fn(),
    acceptAIProposal: vi.fn(),
  },
}));

// Mock Mock Data for Flights
const MOCK_OFFERS: FlightOffer[] = [
  {
    offer_id: 'fl_offer_6e_501',
    provider: 'IndiGo',
    airline: 'IndiGo',
    flight_number: '6E-501',
    origin: 'DEL',
    destination: 'BOM',
    origin_airport: {
      code: 'DEL',
      name: 'Indira Gandhi International Airport',
      city: 'Delhi',
      country: 'India',
    },
    destination_airport: {
      code: 'BOM',
      name: 'Chhatrapati Shivaji Maharaj International Airport',
      city: 'Mumbai',
      country: 'India',
    },
    departure_date: '2026-10-20',
    return_date: '2026-10-25',
    departure_time: '06:00',
    arrival_time: '08:15',
    duration_minutes: 135,
    stops: 0,
    stop_details: [],
    passengers: 1,
    cabin_class: 'economy',
    trip_type: 'roundtrip',
    price: 4500,
    per_passenger_price: 4500,
    currency: 'INR',
    baggage: '15kg check-in included',
    cancellation: 'Standard cancellation terms',
    availability_state: 'ESTIMATED',
    provenance: 'CURATED',
    source: 'CURATED_DATABASE',
    retrieved_at: '2026-10-20T00:00:00Z',
    expires_at: '2026-10-20T02:00:00Z',
    deep_link: 'https://www.goindigo.in',
    why_recommended: 'Balanced option: Direct morning departure',
  },
  {
    offer_id: 'fl_offer_ai_805',
    provider: 'Air India',
    airline: 'Air India',
    flight_number: 'AI-805',
    origin: 'DEL',
    destination: 'BOM',
    origin_airport: {
      code: 'DEL',
      name: 'Indira Gandhi International Airport',
      city: 'Delhi',
      country: 'India',
    },
    destination_airport: {
      code: 'BOM',
      name: 'Chhatrapati Shivaji Maharaj International Airport',
      city: 'Mumbai',
      country: 'India',
    },
    departure_date: '2026-10-20',
    return_date: '2026-10-25',
    departure_time: '18:30',
    arrival_time: '20:50',
    duration_minutes: 140,
    stops: 0,
    stop_details: [],
    passengers: 1,
    cabin_class: 'economy',
    trip_type: 'roundtrip',
    price: 5200,
    per_passenger_price: 5200,
    currency: 'INR',
    baggage: '25kg check-in included',
    cancellation: 'Refundable with fee',
    availability_state: 'ESTIMATED',
    provenance: 'CURATED',
    source: 'CURATED_DATABASE',
    retrieved_at: '2026-10-20T00:00:00Z',
    expires_at: '2026-10-20T02:00:00Z',
    deep_link: 'https://www.airindia.com',
    why_recommended: 'Higher baggage allowance',
  },
  {
    offer_id: 'fl_offer_qp_1102',
    provider: 'Akasa Air',
    airline: 'Akasa Air',
    flight_number: 'QP-1102',
    origin: 'DEL',
    destination: 'BOM',
    origin_airport: {
      code: 'DEL',
      name: 'Indira Gandhi International Airport',
      city: 'Delhi',
      country: 'India',
    },
    destination_airport: {
      code: 'BOM',
      name: 'Chhatrapati Shivaji Maharaj International Airport',
      city: 'Mumbai',
      country: 'India',
    },
    departure_date: '2026-10-20',
    return_date: '2026-10-25',
    departure_time: '13:15',
    arrival_time: '17:45',
    duration_minutes: 270,
    stops: 1,
    stop_details: [{ airport: 'AMD', duration_minutes: 60 }],
    passengers: 1,
    cabin_class: 'economy',
    trip_type: 'roundtrip',
    price: 3900,
    per_passenger_price: 3900,
    currency: 'INR',
    baggage: '15kg check-in included',
    cancellation: 'Non-refundable',
    availability_state: 'ESTIMATED',
    provenance: 'CURATED',
    source: 'CURATED_DATABASE',
    retrieved_at: '2026-10-20T00:00:00Z',
    expires_at: '2026-10-20T02:00:00Z',
    deep_link: 'https://www.akasaair.com',
    why_recommended: 'Budget-friendly corridor fare',
  },
];

const MOCK_SEARCH_RESPONSE: FlightSearchResponse = {
  search: {
    origin: 'DEL',
    destination: 'BOM',
    departure_date: '2026-10-20',
    return_date: '2026-10-25',
    passengers: 1,
    cabin_class: 'economy',
    trip_type: 'roundtrip',
  },
  offers: MOCK_OFFERS,
  provenance: 'CURATED',
  availability_state: 'ESTIMATED',
  retrieved_at: '2026-10-20T00:00:00Z',
  expires_at: '2026-10-20T02:00:00Z',
};

describe('DashTiny L2 — Flight Search Frontend Components', () => {
  describe('1. FlightSearchForm', () => {
    it('renders search form with all primary controls', () => {
      render(
        <FlightSearchForm
          initialOrigin="DEL"
          initialDestination="BOM"
          initialDepartureDate="2026-10-20"
          initialReturnDate="2026-10-25"
          onSearch={vi.fn()}
        />
      );

      expect(screen.getByTestId('flight-search-form')).toBeTruthy();
      expect(screen.getByRole('button', { name: /search flights/i })).toBeTruthy();
      expect(screen.getByTestId('trip-type-roundtrip')).toBeTruthy();
      expect(screen.getByTestId('trip-type-oneway')).toBeTruthy();
    });

    it('validates required origin and destination and triggers onSearch when valid', async () => {
      const handleSearch = vi.fn();
      render(
        <FlightSearchForm
          initialOrigin="DEL"
          initialDestination="BOM"
          initialDepartureDate="2026-10-20"
          initialReturnDate="2026-10-25"
          onSearch={handleSearch}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /search flights/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSearch).toHaveBeenCalledTimes(1);
        expect(handleSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            origin: 'DEL',
            destination: 'BOM',
            departureDate: '2026-10-20',
            returnDate: '2026-10-25',
            tripType: 'roundtrip',
          })
        );
      });
    });

    it('rejects origin === destination with client-side validation error', async () => {
      const handleSearch = vi.fn();
      render(
        <FlightSearchForm
          initialOrigin="DEL"
          initialDestination="DEL"
          initialDepartureDate="2026-10-20"
          initialReturnDate="2026-10-25"
          onSearch={handleSearch}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /search flights/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/origin and destination airports cannot be the same/i)).toBeTruthy();
        expect(handleSearch).not.toHaveBeenCalled();
      });
    });
  });

  describe('2. FlightTripContext', () => {
    it('renders active trip summary and supports switching and unlinking trips', () => {
      const activeTrips = [
        {
          id: 'trip_1',
          title: 'Goa Coastal Escape',
          destination: 'GOI',
          startDate: '2026-10-20',
          endDate: '2026-10-25',
          travellers: 2,
        },
        {
          id: 'trip_2',
          title: 'Mumbai Business Visit',
          destination: 'BOM',
          startDate: '2026-11-01',
          endDate: '2026-11-05',
          travellers: 1,
        },
      ];

      const handleSelectTrip = vi.fn();
      const handleClearTrip = vi.fn();

      render(
        <FlightTripContext
          activeTrips={activeTrips}
          selectedTripId="trip_1"
          onSelectTrip={handleSelectTrip}
          onClearTrip={handleClearTrip}
        />
      );

      expect(screen.getByTestId('flight-trip-context')).toBeTruthy();
      expect(screen.getByText(/2 Travelers/i)).toBeTruthy();

      const unlinkBtn = screen.getByRole('button', { name: /unlink trip/i });
      fireEvent.click(unlinkBtn);
      expect(handleClearTrip).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. FlightResults: Loading, Error & Empty States', () => {
    it('renders loading indicator when isLoading is true', () => {
      render(
        <FlightResults
          searchResponse={null}
          isLoading={true}
          onSelectOffer={vi.fn()}
        />
      );
      expect(screen.getByTestId('flight-search-loading')).toBeTruthy();
      expect(screen.getByText(/searching contemporary airline corridors/i)).toBeTruthy();
    });

    it('renders error notice when error prop is provided', () => {
      render(
        <FlightResults
          searchResponse={null}
          isLoading={false}
          error="Network timeout connecting to travel catalog"
          onSelectOffer={vi.fn()}
        />
      );
      expect(screen.getByTestId('flight-search-error')).toBeTruthy();
      expect(screen.getByText(/network timeout connecting to travel catalog/i)).toBeTruthy();
    });

    it('renders initial prompt when searchResponse is null and not loading', () => {
      render(
        <FlightResults
          searchResponse={null}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );
      expect(screen.getByText(/ready to search flights/i)).toBeTruthy();
    });
  });

  describe('4. FlightResults: Filters, Sort & Badges', () => {
    it('renders offers list, honest provenance badges and recommendation tags', () => {
      render(
        <FlightResults
          searchResponse={MOCK_SEARCH_RESPONSE}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );

      expect(screen.getByTestId('flight-results-container')).toBeTruthy();
      expect(screen.getByTestId('flight-provenance-banner')).toBeTruthy();
      expect(screen.getAllByText(/curated catalog/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/estimated availability/i).length).toBeGreaterThanOrEqual(1);

      // Check offers
      expect(screen.getByTestId('flight-card-fl_offer_6e_501')).toBeTruthy();
      expect(screen.getByTestId('flight-card-fl_offer_ai_805')).toBeTruthy();
      expect(screen.getByTestId('flight-card-fl_offer_qp_1102')).toBeTruthy();
    });

    it('filters offers by non-stop only', async () => {
      render(
        <FlightResults
          searchResponse={MOCK_SEARCH_RESPONSE}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );

      // Initially all 3 offers are rendered
      expect(screen.getByTestId('flight-card-fl_offer_qp_1102')).toBeTruthy();

      // Click "Non-stop" filter checkbox
      const nonStopFilter = screen.getByTestId('filter-stop-0');
      fireEvent.click(nonStopFilter);

      await waitFor(() => {
        // Akasa Air has 1 stop, should be filtered out
        expect(screen.queryByTestId('flight-card-fl_offer_qp_1102')).toBeNull();
        // IndiGo and Air India are non-stop, should remain visible
        expect(screen.getByTestId('flight-card-fl_offer_6e_501')).toBeTruthy();
        expect(screen.getByTestId('flight-card-fl_offer_ai_805')).toBeTruthy();
      });
    });

    it('sorts offers by cheapest fare', async () => {
      render(
        <FlightResults
          searchResponse={MOCK_SEARCH_RESPONSE}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );

      // Click "Cheapest" sort button
      const cheapestSortBtn = screen.getByTestId('sort-cheapest');
      fireEvent.click(cheapestSortBtn);

      await waitFor(() => {
        const cards = screen.getAllByTestId(/^flight-card-/);
        // Akasa Air is ₹3,900, should be first
        expect(cards[0].getAttribute('data-testid')).toBe('flight-card-fl_offer_qp_1102');
      });
    });

    it('sorts offers by fastest duration', async () => {
      render(
        <FlightResults
          searchResponse={MOCK_SEARCH_RESPONSE}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );

      // Click "Fastest" sort button
      const fastestSortBtn = screen.getByTestId('sort-fastest');
      fireEvent.click(fastestSortBtn);

      await waitFor(() => {
        const cards = screen.getAllByTestId(/^flight-card-/);
        // IndiGo is 135 mins, should be first
        expect(cards[0].getAttribute('data-testid')).toBe('flight-card-fl_offer_6e_501');
      });
    });
  });

  describe('5. Flight Comparison Flow', () => {
    it('allows toggling comparison up to 3 offers and opens comparison modal', async () => {
      render(
        <FlightResults
          searchResponse={MOCK_SEARCH_RESPONSE}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );

      // Toggle compare on IndiGo
      const compareCheckbox1 = screen.getByTestId('compare-checkbox-fl_offer_6e_501');
      fireEvent.click(compareCheckbox1);

      // Check floating comparison tray appears
      await waitFor(() => {
        expect(screen.getByTestId('floating-comparison-tray')).toBeTruthy();
        expect(screen.getByText(/1 flight in comparison/i)).toBeTruthy();
      });

      // Toggle compare on Air India
      const compareCheckbox2 = screen.getByTestId('compare-checkbox-fl_offer_ai_805');
      fireEvent.click(compareCheckbox2);

      await waitFor(() => {
        expect(screen.getByText(/2 flights in comparison/i)).toBeTruthy();
      });

      // Open comparison modal
      const openModalBtn = screen.getByTestId('open-comparison-btn');
      fireEvent.click(openModalBtn);

      await waitFor(() => {
        expect(screen.getByTestId('flight-comparison-modal')).toBeTruthy();
        expect(screen.getByText(/compare flights side-by-side/i)).toBeTruthy();
        expect(screen.getAllByText(/25kg check-in included/i).length).toBeGreaterThanOrEqual(1);
      });

      // Close modal
      const closeBtn = screen.getByTestId('close-comparison-btn');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('flight-comparison-modal')).toBeNull();
      });
    });
  });

  describe('6. Offer Selection & Proposal Integration', () => {
    it('calls onSelectOffer when user clicks Select Flight', () => {
      const handleSelect = vi.fn();
      render(
        <FlightResults
          searchResponse={MOCK_SEARCH_RESPONSE}
          isLoading={false}
          onSelectOffer={handleSelect}
        />
      );

      const selectBtn = screen.getByTestId('select-flight-fl_offer_6e_501');
      fireEvent.click(selectBtn);

      expect(handleSelect).toHaveBeenCalledTimes(1);
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          offer_id: 'fl_offer_6e_501',
          airline: 'IndiGo',
          price: 4500,
        })
      );
    });

    it('renders "Continue to provider" link with honest outbound target', () => {
      render(
        <FlightResults
          searchResponse={MOCK_SEARCH_RESPONSE}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );

      const outboundLink = screen.getByTestId('deep-link-fl_offer_6e_501');
      expect(outboundLink.getAttribute('href')).toBe('https://www.goindigo.in');
      expect(outboundLink.textContent).toContain('Continue to provider');
    });
  });

  describe('7. Stale Search Detection', () => {
    it('shows stale search notice banner when isStale is true and supports refreshing', () => {
      const handleRefresh = vi.fn();
      render(
        <FlightResults
          searchResponse={MOCK_SEARCH_RESPONSE}
          isLoading={false}
          isStale={true}
          onRefreshSearch={handleRefresh}
          onSelectOffer={vi.fn()}
        />
      );

      expect(screen.getByTestId('stale-search-banner')).toBeTruthy();
      expect(screen.getByText(/search parameters updated/i)).toBeTruthy();

      const refreshBtn = screen.getByTestId('refresh-search-btn');
      fireEvent.click(refreshBtn);
      expect(handleRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
