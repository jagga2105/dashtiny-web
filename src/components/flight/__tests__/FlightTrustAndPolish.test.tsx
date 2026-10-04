/**
 * DashTiny L2.2 — Flight Trust, UX Polish and Finalization Vitest Suite
 *
 * Covers:
 * - USD/EUR/GBP/INR currency formatting
 * - Round-trip toggle keeping return date empty (no hidden +5-day assumption)
 * - Comparison missing baggage/cancellation rendering "Not provided" (no invented policies)
 * - Ambiguous Trip city rendering suggestions without silent auto-selection
 * - Mobile filter drawer (open, close on Escape/Apply, accessible dialog)
 * - Deferred categories (trains, buses, cabs) marked disabled / coming soon
 * - Selection & Proposal flow attaching flight to trip with ZERO fake PNR / fake confirmation
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { formatCurrency } from '@/lib/formatCurrency';
import { FlightSearchForm } from '../FlightSearchForm';
import { FlightComparison } from '../FlightComparison';
import { FlightTripContext } from '../FlightTripContext';
import { FlightResults } from '../FlightResults';
import BookingsPage from '@/app/bookings/page';
import { FlightOffer } from '@/types/flight';
import { apiService } from '@/services/api';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/bookings',
}));

// Mock apiService
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
    getMyTrips: vi.fn().mockResolvedValue([
      {
        id: 'trip-test-1',
        title: 'Mumbai Exploration',
        destination: 'BOM',
        origin: 'DEL',
        startDate: '2026-10-20',
        endDate: '2026-10-25',
        travellers: 2,
        status: 'planning',
      },
    ]),
    getMyBookings: vi.fn().mockResolvedValue([]),
    searchFlights: vi.fn().mockResolvedValue({
      offers: [
        {
          offer_id: 'fl_offer_6e_501',
          provider: 'IndiGo',
          airline: 'IndiGo',
          flight_number: '6E-501',
          origin: 'DEL',
          destination: 'BOM',
          departure_time: '2026-10-20T06:00:00Z',
          arrival_time: '2026-10-20T08:15:00Z',
          duration_minutes: 135,
          stops: 0,
          cabin_class: 'economy',
          price: 5400,
          currency: 'INR',
          booking_url: 'https://goindigo.in',
          provenance: 'CURATED',
          availability_state: 'ESTIMATED',
        },
      ],
      total_count: 1,
      currency: 'INR',
      origin: 'DEL',
      destination: 'BOM',
      departure_date: '2026-10-20',
      travelers: 1,
      cabin_class: 'economy',
      search_id: 'search-101',
      retrieved_at: '2026-10-04T00:00:00Z',
      provenance: 'CURATED',
      availability_state: 'ESTIMATED',
    }),
    createFlightOfferProposal: vi.fn().mockResolvedValue({
      id: 'prop-xyz-123',
      proposal_id: 'prop-xyz-123',
      trip_id: 'trip-test-1',
      parent_version: 1,
      summary: 'Attach flight 6E-501 to Mumbai Exploration',
      status: 'pending',
      action_type: 'ATTACH_TRANSPORT',
      changes: {
        flight_offer: {
          offer_id: 'fl_offer_6e_501',
          airline: 'IndiGo',
          flight_number: '6E-501',
          origin: 'DEL',
          destination: 'BOM',
          price: 5400,
          currency: 'INR',
        },
      },
      provenance: {
        inventory_tier: 'CURATED',
        verification_status: 'ESTIMATED',
      },
    }),
    acceptAIProposal: vi.fn().mockResolvedValue({
      success: true,
      version: 2,
      trip_id: 'trip-test-1',
      action_type: 'ATTACH_TRANSPORT',
      proposal_id: 'prop-xyz-123',
    }),
  },
}));

describe('DashTiny L2.2 — Trust, Precision & UX Polish Vitest Suite', () => {
  describe('1. Currency Formatter (USD, EUR, GBP, INR)', () => {
    it('formats USD correctly with $ symbol', () => {
      const formatted = formatCurrency(120, 'USD');
      expect(formatted).toMatch(/\$120/);
    });

    it('formats EUR correctly with € symbol', () => {
      const formatted = formatCurrency(95, 'EUR');
      expect(formatted).toMatch(/(?:€\s?95|95\s?€)/);
    });

    it('formats GBP correctly with £ symbol', () => {
      const formatted = formatCurrency(80, 'GBP');
      expect(formatted).toMatch(/£80/);
    });

    it('formats INR correctly with ₹ symbol and Indian grouping', () => {
      const formatted = formatCurrency(6500, 'INR');
      expect(formatted).toMatch(/₹6,500/);
    });

    it('defaults gracefully to INR when currency is omitted', () => {
      const formatted = formatCurrency(4200);
      expect(formatted).toMatch(/₹4,200/);
    });
  });

  describe('2. Round-trip toggle keeps return date empty (no hidden +5-day assumption)', () => {
    it('leaves return date empty when user switches from one-way to round-trip', () => {
      render(
        <FlightSearchForm
          initialOrigin="DEL"
          initialDestination="BOM"
          initialDepartureDate="2026-10-20"
          initialReturnDate=""
          initialTripType="oneway"
          isLoading={false}
          onSearch={vi.fn()}
        />
      );

      // Find trip type radio/button for roundtrip
      const roundtripRadio = screen.getByTestId('trip-type-roundtrip');
      fireEvent.click(roundtripRadio);

      // The return date input should NOT have an auto-generated +5-day value
      const returnDateInput = screen.getByTestId('flight-return-date-input') as HTMLInputElement;
      expect(returnDateInput.value).toBe('');
    });
  });

  describe('3. Comparison: missing baggage and cancellation render "Not provided"', () => {
    const offerWithMissingInclusions: FlightOffer = {
      offer_id: 'fl_offer_test_missing',
      provider: 'TestAir',
      airline: 'Test Airlines',
      flight_number: 'TA-101',
      origin: 'DEL',
      destination: 'BOM',
      departure_time: '2026-10-20T08:00:00Z',
      arrival_time: '2026-10-20T10:15:00Z',
      duration_minutes: 135,
      stops: 0,
      cabin_class: 'economy',
      price: 5200,
      currency: 'INR',
      deep_link: 'https://example.com/book',
      // Explicitly missing inclusions and cancellation
      inclusions: {
        cabin_baggage: undefined as unknown as string,
        checkin_baggage: undefined as unknown as string,
      },
      cancellation: undefined as unknown as string,
      provenance: 'CURATED',
      availability_state: 'ESTIMATED',
    } as unknown as FlightOffer;

    it('renders "Not provided" for missing baggage and cancellation policy without inventing terms', () => {
      render(
        <FlightComparison
          isOpen={true}
          onClose={vi.fn()}
          selectedOffers={[offerWithMissingInclusions]}
          onRemoveOffer={vi.fn()}
          onSelectOffer={vi.fn()}
        />
      );

      // Verify "Not provided" appears in comparison table
      const notProvidedElements = screen.getAllByText('Not provided');
      expect(notProvidedElements.length).toBeGreaterThanOrEqual(2);

      // Verify that invented fallbacks DO NOT appear
      expect(screen.queryByText('Standard allowance')).toBeNull();
      expect(screen.queryByText('Standard terms')).toBeNull();
    });
  });

  describe('4. Ambiguous Trip city displays suggestion, not auto-selection', () => {
    const mockTrips = [
      {
        id: 'trip-mum',
        title: 'Mumbai Weekend Getaway',
        destination: 'Mumbai',
        origin: 'Delhi',
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        travellers: 2,
      },
    ];

    it('displays explicit suggestion banners when origin/destination are non-IATA cities and requires user click', () => {
      const onApplySuggestedOrigin = vi.fn();
      const onApplySuggestedDest = vi.fn();

      render(
        <FlightTripContext
          activeTrips={mockTrips}
          selectedTripId="trip-mum"
          onSelectTrip={vi.fn()}
          onClearTrip={vi.fn()}
          onApplyTripDates={vi.fn()}
          onApplyTripTravelers={vi.fn()}
          suggestedOriginAirport={{ iata_code: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi' }}
          onApplySuggestedOriginAirport={onApplySuggestedOrigin}
          suggestedAirport={{ iata_code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai' }}
          onApplySuggestedAirport={onApplySuggestedDest}
        />
      );

      // Verify suggestion banner content
      expect(screen.getByText(/Trip origin =/i)).toBeTruthy();
      expect(screen.getByText(/DEL — Delhi/i)).toBeTruthy();
      expect(screen.getByTestId('apply-suggested-origin-btn')).toBeTruthy();

      expect(screen.getByText(/Trip destination =/i)).toBeTruthy();
      expect(screen.getByText(/BOM — Mumbai/i)).toBeTruthy();
      expect(screen.getByTestId('apply-suggested-dest-btn')).toBeTruthy();

      // Ensure callbacks were NOT called automatically
      expect(onApplySuggestedOrigin).not.toHaveBeenCalled();
      expect(onApplySuggestedDest).not.toHaveBeenCalled();

      // Click to use suggested origin BOM/DEL
      fireEvent.click(screen.getByTestId('apply-suggested-origin-btn'));
      expect(onApplySuggestedOrigin).toHaveBeenCalledWith('DEL');

      fireEvent.click(screen.getByTestId('apply-suggested-dest-btn'));
      expect(onApplySuggestedDest).toHaveBeenCalledWith('BOM');
    });
  });

  describe('5. Mobile Filter Drawer behavior', () => {
    const dummyOffers: FlightOffer[] = [
      {
        offer_id: 'dummy-1',
        provider: 'IndiGo',
        airline: 'IndiGo',
        flight_number: '6E-101',
        origin: 'DEL',
        destination: 'BOM',
        departure_time: '2026-10-20T06:00:00Z',
        arrival_time: '2026-10-20T08:15:00Z',
        duration_minutes: 135,
        stops: 0,
        cabin_class: 'economy',
        price: 4500,
        currency: 'INR',
        deep_link: 'https://indigo.in',
        provenance: 'CURATED',
        availability_state: 'ESTIMATED',
      } as unknown as FlightOffer,
    ];

    const mockResponse: any = {
      search: {
        origin: 'DEL',
        destination: 'BOM',
        departure_date: '2026-10-20',
        passengers: 1,
        cabin_class: 'economy',
        trip_type: 'oneway',
      },
      offers: dummyOffers,
      total_count: 1,
      currency: 'INR',
      origin: 'DEL',
      destination: 'BOM',
      departure_date: '2026-10-20',
      travelers: 1,
      cabin_class: 'economy',
      search_id: 'search-123',
      retrieved_at: '2026-10-04T00:00:00Z',
      expires_at: '2026-10-04T01:00:00Z',
      provenance: 'CURATED',
      availability_state: 'ESTIMATED',
    };

    it('opens mobile filter drawer upon tapping Filters button and closes on Escape or Apply', async () => {
      render(
        <FlightResults
          searchResponse={mockResponse as any}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );

      // Sheet should not be present initially
      expect(screen.queryByTestId('mobile-filters-sheet')).toBeNull();

      // Tap mobile filter button
      const mobileFilterTrigger = screen.getByTestId('mobile-filter-trigger');
      fireEvent.click(mobileFilterTrigger);

      // Sheet should now be visible as a dialog
      const sheet = screen.getByTestId('mobile-filters-sheet');
      expect(sheet).toBeTruthy();
      expect(sheet.getAttribute('role')).toBe('dialog');
      expect(sheet.getAttribute('aria-modal')).toBe('true');

      // Tap Apply filters button
      const applyBtn = screen.getByTestId('apply-mobile-filters-btn');
      fireEvent.click(applyBtn);

      // Sheet should close
      expect(screen.queryByTestId('mobile-filters-sheet')).toBeNull();

      // Reopen and test Escape key close
      fireEvent.click(mobileFilterTrigger);
      expect(screen.getByTestId('mobile-filters-sheet')).toBeTruthy();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('mobile-filters-sheet')).toBeNull();
    });
  });

  describe('6. Deferred booking categories (Trains, Buses, Cabs)', () => {
    it('disables trains, buses, and cabs with coming soon indicator without dead clickable functionality', async () => {
      render(<BookingsPage />);

      // Find category tabs container
      const categoryTabs = screen.getByTestId('booking-category-tabs');
      expect(categoryTabs).toBeTruthy();

      // Trains, buses, cabs should have coming soon indicator and disabled styling
      const trainsTab = screen.getByText('Trains').closest('div');
      expect(trainsTab).toBeTruthy();
      expect(trainsTab?.className).toContain('cursor-not-allowed');
      expect(trainsTab?.getAttribute('title')).toMatch(/coming soon/i);

      const busesTab = screen.getByText('Buses').closest('div');
      expect(busesTab).toBeTruthy();
      expect(busesTab?.className).toContain('cursor-not-allowed');
      expect(busesTab?.getAttribute('title')).toMatch(/coming soon/i);

      const cabsTab = screen.getByText('Cabs').closest('div');
      expect(cabsTab).toBeTruthy();
      expect(cabsTab?.className).toContain('cursor-not-allowed');
      expect(cabsTab?.getAttribute('title')).toMatch(/coming soon/i);
    });
  });

  describe('7. Selection & Proposal flow: attaches flight to trip with ZERO fake PNR / fake confirmation', () => {
    it('attaches curated flight to trip revision, showing honest trust banner and NO fake PNR', async () => {
      render(<BookingsPage />);

      // Wait for trips context
      await waitFor(() => {
        expect(screen.getByTestId('flight-trip-context')).toBeTruthy();
      });

      // Wait for airport context to sync
      await waitFor(() => {
        expect(screen.getByDisplayValue(/DEL/i)).toBeTruthy();
      });

      // Submit search form
      const searchBtn = screen.getByTestId('search-flights-submit');
      fireEvent.click(searchBtn);

      // Wait for flight results
      await waitFor(() => {
        expect(screen.getByTestId('flight-card-fl_offer_6e_501')).toBeTruthy();
      });

      // Click "Select Flight"
      const selectBtn = screen.getByTestId('select-flight-fl_offer_6e_501');
      fireEvent.click(selectBtn);

      // Verify the 2-step selection modal opens with honest text
      await waitFor(() => {
        expect(screen.getByText(/Attach this flight to:/i)).toBeTruthy();
        expect(screen.getByText(/Curated · Estimated availability/i)).toBeTruthy();
      });

      const tripSelector = screen.getByTestId('attach-trip-selector') as HTMLSelectElement;
      expect(tripSelector.value).toBe('trip-test-1');

      // Click "Create Trip Proposal"
      const createPropBtn = screen.getByTestId('create-trip-proposal-btn') as HTMLButtonElement;
      fireEvent.click(createPropBtn);

      await waitFor(() => {
        expect(apiService.createFlightOfferProposal).toHaveBeenCalled();
        expect(screen.getByText(/This change will attach the selected transport option to your Trip/i)).toBeTruthy();
        expect(screen.getByText(/No provider booking will occur/i)).toBeTruthy();
      });

      // Click "Accept Proposal & Update Trip"
      const acceptBtn = screen.getByTestId('accept-proposal-btn');
      fireEvent.click(acceptBtn);

      // Verify post-acceptance state
      await waitFor(() => {
        expect(screen.getByTestId('flight-attached-banner')).toBeTruthy();
        expect(screen.getByText(/Flight attached to Trip/i)).toBeTruthy();
        expect(screen.getByText(/Revision v2/i)).toBeTruthy();
        expect(screen.getByText(/No booking has been made by DashTiny/i)).toBeTruthy();
        expect(screen.getByText(/Continue to the provider to book/i)).toBeTruthy();
      });

      // Crucial trust invariants: NO fake PNR, NO confirmed booking code
      expect(screen.queryByText(/PROP-/i)).toBeNull();
      expect(screen.queryByText(/PNR:/i)).toBeNull();
      expect(screen.queryByText(/Booking Confirmed!/i)).toBeNull();
    });
  });
});
