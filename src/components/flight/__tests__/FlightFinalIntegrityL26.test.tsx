/**
 * DashTiny L2.6 — Flight Final Integrity & UX QA Vitest Suite
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlightProvenance } from '../FlightProvenance';
import { FlightSearchForm } from '../FlightSearchForm';
import { FlightResults } from '../FlightResults';
import { FlightOfferCard } from '../FlightOfferCard';
import { FlightSort } from '../FlightSort';
import { AttachFlightModal } from '../AttachFlightModal';
import { TripProposalModal } from '../TripProposalModal';
import { createMockFlightOffer } from '@/lib/flight/testFixtures';
import { FlightOffer } from '@/types/flight';

vi.mock('@/services/api', () => ({
  apiService: {
    getAirport: vi.fn().mockResolvedValue(null),
    searchLocations: vi.fn().mockResolvedValue([]),
  },
}));

describe('DashTiny L2.6 — Flight Final Integrity & UX QA Suite', () => {
  describe('1. FlightProvenance dynamic rendering & honesty', () => {
    it('renders "Curated catalog" and "Estimated availability" for curated data without green styling', () => {
      render(
        <FlightProvenance
          provenance="CURATED"
          availabilityState="ESTIMATED"
          retrievedAt="2026-10-04T12:00:00Z"
        />
      );

      const banner = screen.getByTestId('flight-provenance-banner');
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('Curated catalog');
      expect(banner.textContent).toContain('Estimated availability');
      // Must not use emerald or green styling
      expect(banner.className).not.toContain('bg-emerald');
      expect(banner.className).not.toContain('text-emerald');
      expect(banner.className).not.toContain('border-emerald');
    });

    it('displays truthful popover explaining source and that it is not live inventory', () => {
      render(
        <FlightProvenance
          provenance="CURATED"
          availabilityState="ESTIMATED"
        />
      );

      const whyTrigger = screen.getByTestId('provenance-why-trigger');
      fireEvent.click(whyTrigger);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeTruthy();
      expect(tooltip.textContent).toContain('Current offer source: Curated DashTiny catalog');
      expect(tooltip.textContent).toContain('Availability: Estimated');
      expect(tooltip.textContent).toContain('This is not live airline inventory.');
    });
  });

  describe('2. Airport directory terminology in search validation', () => {
    it('shows "Select an airport from the airport directory." on empty airport submission', () => {
      render(
        <FlightSearchForm
          initialOrigin=""
          initialDestination=""
          initialDepartureDate="2026-11-20"
          initialReturnDate="2026-11-25"
          onSearch={vi.fn()}
          isLoading={false}
        />
      );

      const form = screen.getByTestId('flight-search-form');
      fireEvent.submit(form);

      const errorAlert = screen.getByTestId('flight-search-validation-error');
      expect(errorAlert).toBeTruthy();
      expect(errorAlert.textContent).toContain('Select an airport from the airport directory.');
      expect(errorAlert.textContent).not.toContain('verified origin airport');
    });
  });

  describe('3. Decision metrics in current results & balanced heuristic', () => {
    const mockOffer1: FlightOffer = createMockFlightOffer({
      offer_id: 'fl_01',
      price: 4500,
      duration_minutes: 180,
      stops: 0,
      airline: 'IndiGo',
    });
    const mockOffer2: FlightOffer = createMockFlightOffer({
      offer_id: 'fl_02',
      price: 7500,
      duration_minutes: 120,
      stops: 0,
      airline: 'Air India',
    });

    it('clarifies "in current results" on decision metric pills and balanced heuristic', () => {
      render(
        <FlightResults
          searchResponse={{
            search_id: 'search-l26',
            offers: [mockOffer1, mockOffer2],
            total_count: 2,
            retrieved_at: '2026-10-04T12:00:00Z',
          }}
          isLoading={false}
          onSelectOffer={vi.fn()}
        />
      );

      const summaryBar = screen.getByTestId('decision-summary-bar');
      expect(summaryBar).toBeTruthy();
      expect(summaryBar.textContent).toContain('CHEAPEST IN CURRENT RESULTS');
      expect(summaryBar.textContent).toContain('FASTEST IN CURRENT RESULTS');
      expect(summaryBar.textContent).toContain('BALANCED IN CURRENT RESULTS');
      expect(summaryBar.textContent).toContain('DashTiny balanced option');
      expect(summaryBar.textContent).toContain('Balanced fare, duration & stops');
    });

    it('FlightSort provides balanced option with heuristic disclaimer tooltip', () => {
      render(
        <FlightSort
          currentSort="balanced"
          onSortChange={vi.fn()}
        />
      );

      const balancedSortBtn = screen.getByTestId('sort-balanced');
      expect(balancedSortBtn.textContent).toContain('DashTiny balanced option');
      expect(balancedSortBtn.getAttribute('title')).toContain(
        'DashTiny balances fare, travel duration and stops. It is a deterministic comparison heuristic, not an objective best-flight claim.'
      );
    });
  });

  describe('4. Baggage & Cancellation fallback to "Not provided"', () => {
    it('renders "Not provided" when baggage or cancellation are missing on FlightOfferCard', () => {
      const offerWithoutPerks: FlightOffer = createMockFlightOffer({
        offer_id: 'fl_no_perks',
        baggage: undefined,
        cancellation: undefined,
      });

      render(
        <FlightOfferCard
          offer={offerWithoutPerks}
          onSelectOffer={vi.fn()}
        />
      );

      expect(screen.getByText('Baggage: Not provided')).toBeTruthy();
      expect(screen.getByText('Cancellation: Not provided')).toBeTruthy();
    });
  });

  describe('5. Modal non-booking and trust disclaimers', () => {
    it('AttachFlightModal displays explicit non-booking notice', () => {
      const offer: FlightOffer = createMockFlightOffer({ offer_id: 'fl_modal' });

      render(
        <AttachFlightModal
          isOpen={true}
          onClose={vi.fn()}
          offer={offer}
          activeTrips={[{ id: 'trip_1', title: 'Goa Holiday', destination: 'Goa' }]}
          selectedTripId="trip_1"
          onSelectTripId={vi.fn()}
          onSubmit={vi.fn()}
          isSubmitting={false}
        />
      );

      expect(screen.getByText('Selecting a flight does not book it.')).toBeTruthy();
      expect(
        screen.getByText(/It adds the flight to your Trip after you approve the Trip change\. No booking has been made by DashTiny\./)
      ).toBeTruthy();
    });

    it('TripProposalModal displays non-booking notice and Trust Guarantee', () => {
      render(
        <TripProposalModal
          isOpen={true}
          onClose={vi.fn()}
          activeProposal={{
            id: 'prop_01',
            parent_version: 1,
            changes: {
              flight_offer: {
                offer_id: 'fl_prop',
                airline: 'IndiGo',
                flight_number: '6E-202',
                price: 5200,
                currency: 'INR',
                origin: 'DEL',
                destination: 'GOI',
                departure_time: '06:00 AM',
                provenance: 'CURATED',
                availability_state: 'ESTIMATED',
              },
            },
          }}
          onAccept={vi.fn()}
          isSubmitting={false}
        />
      );

      expect(screen.getByText('Selecting a flight does not book it.')).toBeTruthy();
      expect(
        screen.getByText(/No booking has been made by DashTiny\. To complete ticketing and secure seats, proceed to the provider\./)
      ).toBeTruthy();
    });
  });
});
