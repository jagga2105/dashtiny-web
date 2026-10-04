/**
 * DashTiny L2.3 — Flight Trust, Polish & Accessibility Vitest Suite
 *
 * Covers:
 * - USD/EUR/GBP/INR currency formatting
 * - Round-trip toggle keeping return date empty (no hidden +5-day assumption)
 * - Comparison missing baggage/cancellation rendering "Not provided" (no invented policies)
 * - Ambiguous Trip city rendering suggestions without silent auto-selection
 * - Mobile filter drawer (open, close on Escape/Apply, accessible dialog)
 * - Deferred categories (trains, buses, cabs) marked disabled / coming soon
 * - Selection & Proposal flow attaching flight to trip with ZERO fake PNR / fake confirmation
 * - Local date calculation (never uses UTC toISOString T split)
 * - Modal accessibility (role="dialog", aria-modal="true", aria-labelledby, Escape closes)
 * - Round-trip segment display (Outbound & Return legs)
 * - Search response trust contract (no upgrading CURATED/ESTIMATED into VERIFIED/LIVE)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { formatCurrency } from '@/lib/formatCurrency';
import { getLocalTodayDate, addDaysToDate } from '@/lib/formatDate';
import { FlightSearchForm } from '../FlightSearchForm';
import { FlightComparison } from '../FlightComparison';
import { FlightTripContext } from '../FlightTripContext';
import { FlightResults } from '../FlightResults';
import { FlightOfferCard } from '../FlightOfferCard';
import { AttachFlightModal } from '../AttachFlightModal';
import { TripProposalModal } from '../TripProposalModal';
import BookingsPage from '@/app/bookings/page';
import { FlightOffer } from '@/types/flight';
import { createMockFlightOffer } from '@/lib/flight/testFixtures';
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
    searchFlights: vi.fn(),
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
          departure_time: '06:00 AM',
          provenance: 'CURATED',
          availability_state: 'ESTIMATED',
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

describe('DashTiny L2.3 — Trust, Precision & UX Polish Vitest Suite', () => {
  beforeEach(() => {
    vi.mocked(apiService.searchFlights).mockResolvedValue({
      search: {
        origin: 'DEL',
        destination: 'BOM',
        departure_date: '2026-10-20',
        return_date: null,
        passengers: 1,
        cabin_class: 'economy',
        trip_type: 'oneway',
      },
      offers: [
        createMockFlightOffer({
          offer_id: 'fl_offer_6e_501',
          provider: 'DashTiny Curated Catalog',
          airline: 'IndiGo',
          flight_number: '6E-501',
          origin: 'DEL',
          destination: 'BOM',
          departure_date: '2026-10-20',
          departure_time: '06:00 AM',
          arrival_time: '08:15 AM',
          duration_minutes: 135,
          stops: 0,
          cabin_class: 'economy',
          price: 5400,
          currency: 'INR',
          deep_link: 'https://goindigo.in',
          provenance: 'CURATED',
          availability_state: 'ESTIMATED',
        }),
      ],
      retrieved_at: '2026-10-04T00:00:00Z',
      expires_at: '2026-10-04T02:00:00Z',
      provenance: 'CURATED',
      availability_state: 'ESTIMATED',
    });
  });

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
    const offerWithMissingInclusions = createMockFlightOffer({
      offer_id: 'fl_offer_test_missing',
      provider: 'DashTiny Curated Catalog',
      airline: 'Test Airlines',
      flight_number: 'TA-101',
      origin: 'DEL',
      destination: 'BOM',
      price: 5200,
      currency: 'INR',
      deep_link: 'https://example.com/book',
      baggage: undefined,
      cancellation: undefined,
    });

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
      createMockFlightOffer({
        offer_id: 'dummy-1',
        provider: 'DashTiny Curated Catalog',
        airline: 'IndiGo',
        flight_number: '6E-101',
        origin: 'DEL',
        destination: 'BOM',
        price: 4500,
        currency: 'INR',
      }),
    ];

    const mockResponse = {
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

  describe('7. Selection & Proposal flow and L4 Booking Freeze', () => {
    it('honors L4 booking freeze: communicates that bookings are coming soon and displays frozen cards', async () => {
      render(<BookingsPage />);

      expect(screen.getByTestId('bookings-coming-soon-banner')).toBeTruthy();
      expect(screen.getAllByText(/Bookings are coming soon — stay tuned/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/We're building trusted booking integrations/i).length).toBeGreaterThan(0);
      expect(screen.getByTestId('flights-frozen-card')).toBeTruthy();

      // Switch to hotels tab and verify frozen status
      const hotelsTab = screen.getByTestId('category-tab-hotels');
      fireEvent.click(hotelsTab);
      expect(screen.getByTestId('hotels-frozen-card')).toBeTruthy();
    });

    it('attaches curated flight via modal with ZERO fake PNR / fake confirmation', async () => {
      const mockOffer = createMockFlightOffer({
        offer_id: 'fl_offer_6e_501',
        airline: 'IndiGo',
        flight_number: '6E-501',
        provenance: 'CURATED',
        availability_state: 'ESTIMATED',
      });
      const onSubmit = vi.fn();
      render(
        <AttachFlightModal
          isOpen={true}
          onClose={vi.fn()}
          offer={mockOffer}
          activeTrips={[{ id: 'trip-test-1', title: 'Mumbai Trip', destination: 'BOM' }]}
          selectedTripId="trip-test-1"
          onSelectTripId={vi.fn()}
          departureDate="2026-10-20"
          onSubmit={onSubmit}
          isSubmitting={false}
        />
      );

      expect(screen.getByText(/Attach this flight to:/i)).toBeTruthy();
      expect(screen.getByText(/Curated · Estimated availability/i)).toBeTruthy();

      const createBtn = screen.getByTestId('create-trip-proposal-btn');
      fireEvent.click(createBtn);
      expect(onSubmit).toHaveBeenCalled();

      // Crucial trust invariants: NO fake PNR, NO confirmed booking code
      expect(screen.queryByText(/PROP-/i)).toBeNull();
      expect(screen.queryByText(/PNR:/i)).toBeNull();
      expect(screen.queryByText(/Booking Confirmed!/i)).toBeNull();
    });
  });

  describe('8. Local Date & Timezone Integrity', () => {
    it('getLocalTodayDate returns YYYY-MM-DD representing local calendar day', () => {
      const today = getLocalTodayDate();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const d = new Date();
      const expectedYear = d.getFullYear();
      const expectedMonth = String(d.getMonth() + 1).padStart(2, '0');
      const expectedDay = String(d.getDate()).padStart(2, '0');
      expect(today).toBe(`${expectedYear}-${expectedMonth}-${expectedDay}`);
    });

    it('addDaysToDate cleanly adds days across month/year boundaries', () => {
      expect(addDaysToDate('2026-10-31', 1)).toBe('2026-11-01');
      expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDaysToDate('2026-02-28', 1)).toBe('2026-03-01');
    });
  });

  describe('9. Accessible Modal Contracts', () => {
    it('FlightComparison has dialog role, aria-modal, aria-labelledby, and closes on Escape', () => {
      const onClose = vi.fn();
      const offer = createMockFlightOffer({ offer_id: 'comp-1' });

      render(
        <FlightComparison
          isOpen={true}
          onClose={onClose}
          selectedOffers={[offer]}
          onRemoveOffer={vi.fn()}
          onSelectOffer={vi.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('flight-comparison-title');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('AttachFlightModal has dialog role, aria-modal, aria-labelledby, and closes on Escape', () => {
      const onClose = vi.fn();
      const offer = createMockFlightOffer({ offer_id: 'att-1' });

      render(
        <AttachFlightModal
          isOpen={true}
          onClose={onClose}
          offer={offer}
          activeTrips={[{ id: 't1', destination: 'BOM', title: 'Mumbai Trip' }]}
          selectedTripId="t1"
          onSelectTripId={vi.fn()}
          onSubmit={vi.fn()}
          isSubmitting={false}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('attach-flight-title');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('TripProposalModal has dialog role, aria-modal, aria-labelledby, and closes on Escape', () => {
      const onClose = vi.fn();
      const mockProposal = {
        id: 'prop-1',
        parent_version: 1,
        changes: {
          flight_offer: {
            offer_id: 'fl-1',
            airline: 'IndiGo',
            flight_number: '6E-501',
            price: 5400,
            currency: 'INR',
            origin: 'DEL',
            destination: 'BOM',
            departure_time: '06:00 AM',
            provenance: 'CURATED',
            availability_state: 'ESTIMATED',
          },
        },
      };

      render(
        <TripProposalModal
          isOpen={true}
          onClose={onClose}
          activeProposal={mockProposal}
          onAccept={vi.fn()}
          isSubmitting={false}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('trip-proposal-title');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('10. Round-Trip Segment Display vs One-Way', () => {
    it('renders Outbound and Return segments on round-trip flight card', () => {
      const roundtripOffer = createMockFlightOffer({
        offer_id: 'rt-offer-1',
        origin: 'DEL',
        destination: 'GOI',
        departure_date: '2026-11-01',
        return_date: '2026-11-06',
        trip_type: 'roundtrip',
        outbound: {
          origin: 'DEL',
          destination: 'GOI',
          departure_date: '2026-11-01',
          departure_time: '06:15',
          arrival_date: '2026-11-01',
          arrival_time: '08:50',
          duration_minutes: 155,
          stops: 0,
        },
        inbound: {
          origin: 'GOI',
          destination: 'DEL',
          departure_date: '2026-11-06',
          departure_time: '18:20',
          arrival_date: '2026-11-06',
          arrival_time: '20:50',
          duration_minutes: 150,
          stops: 0,
        },
      });

      render(
        <FlightOfferCard
          offer={roundtripOffer}
          onSelectOffer={vi.fn()}
          onToggleCompare={vi.fn()}
          isCompared={false}
        />
      );

      // Verify both Outbound and Return labels are rendered
      expect(screen.getByText('Outbound')).toBeTruthy();
      expect(screen.getByText('Return')).toBeTruthy();
      expect(screen.getByText(/06:15\s*→\s*08:50/)).toBeTruthy();
      expect(screen.getByText(/18:20\s*→\s*20:50/)).toBeTruthy();
    });

    it('renders single segment without Return label on one-way flight card', () => {
      const onewayOffer = createMockFlightOffer({
        offer_id: 'ow-offer-1',
        origin: 'DEL',
        destination: 'GOI',
        departure_time: '06:15',
        arrival_time: '08:50',
        trip_type: 'oneway',
        return_date: null,
        inbound: null,
        outbound: {
          origin: 'DEL',
          destination: 'GOI',
          departure_date: '2026-11-01',
          departure_time: '06:15',
          arrival_date: '2026-11-01',
          arrival_time: '08:50',
          duration_minutes: 155,
          stops: 0,
        },
      });

      render(
        <FlightOfferCard
          offer={onewayOffer}
          onSelectOffer={vi.fn()}
          onToggleCompare={vi.fn()}
          isCompared={false}
        />
      );

      // No Return segment should be rendered
      expect(screen.queryByText('Return')).toBeNull();
      expect(screen.getByText('06:15')).toBeTruthy();
      expect(screen.getByText('08:50')).toBeTruthy();
    });
  });

  describe('11. Comparison Modal Round-Trip & Honest Attributes', () => {
    it('displays Outbound, Return, Total fare, Duration, Stops, Baggage, Cancellation, and Catalog provenance', () => {
      const roundtripOffer = createMockFlightOffer({
        offer_id: 'comp-rt-1',
        trip_type: 'roundtrip',
        price: 9800,
        currency: 'INR',
        outbound: {
          origin: 'DEL',
          destination: 'GOI',
          departure_date: '2026-11-01',
          departure_time: '06:15',
          arrival_date: '2026-11-01',
          arrival_time: '08:50',
          duration_minutes: 155,
          stops: 0,
        },
        inbound: {
          origin: 'GOI',
          destination: 'DEL',
          departure_date: '2026-11-06',
          departure_time: '18:20',
          arrival_date: '2026-11-06',
          arrival_time: '20:50',
          duration_minutes: 150,
          stops: 0,
        },
        baggage: '15kg check-in',
        cancellation: 'Refundable with standard fee',
      });

      render(
        <FlightComparison
          isOpen={true}
          onClose={vi.fn()}
          selectedOffers={[roundtripOffer]}
          onRemoveOffer={vi.fn()}
          onSelectOffer={vi.fn()}
        />
      );

      // Verify rows
      expect(screen.getByText('Outbound')).toBeTruthy();
      expect(screen.getByText('Return')).toBeTruthy();
      expect(screen.getByText('Total fare')).toBeTruthy();
      expect(screen.getByText('Total duration')).toBeTruthy();
      expect(screen.getByText('Baggage')).toBeTruthy();
      expect(screen.getByText('Cancellation')).toBeTruthy();
      expect(screen.getByText('Catalog provenance')).toBeTruthy();
      expect(screen.getByText(/CURATED\s*·\s*ESTIMATED/)).toBeTruthy();
    });
  });

  describe('12. Search Response Trust Contract', () => {
    it('preserves CURATED and ESTIMATED without ever upgrading to VERIFIED or LIVE', () => {
      const offer = createMockFlightOffer({
        provenance: 'CURATED',
        availability_state: 'ESTIMATED',
      });

      render(
        <FlightOfferCard
          offer={offer}
          onSelectOffer={vi.fn()}
          onToggleCompare={vi.fn()}
          isCompared={false}
        />
      );

      expect(screen.getByText(/Curated catalog/i)).toBeTruthy();
      expect(screen.queryByText(/verified/i)).toBeNull();
      expect(screen.queryByText(/live inventory/i)).toBeNull();
    });
  });
});
