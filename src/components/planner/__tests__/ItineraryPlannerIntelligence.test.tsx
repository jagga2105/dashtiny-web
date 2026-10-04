import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  StructuredPlannerForm,
} from '../StructuredPlannerForm';
import {
  ItineraryProposalReview,
  UnifiedProposalData,
} from '../ItineraryProposalReview';

// Mock Lucide icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
  };
});

describe('DashTiny Itinerary Intelligence — Planner UI & Proposal Lifecycle', () => {
  const mockProposal: UnifiedProposalData = {
    proposal_id: 'prop_test_123',
    title: 'Goa Coastal Getaway',
    destination: 'Goa',
    origin: 'DEL',
    days_count: 5,
    travelers: 2,
    pace: 'relaxed',
    persona: 'couple',
    vibe: 'Leisure',
    interests: ['beaches', 'food'],
    target_budget: 50000,
    estimated_budget: 46800,
    currency: 'INR',
    budget_breakdown: {
      accommodation: 22000,
      food: 11000,
      activities: 4800,
      local_transport: 4000,
      intercity_transport: 3000,
      miscellaneous: 2000,
      total_estimated: 46800,
      currency: 'INR',
      label: 'ESTIMATED',
      is_over_budget: false,
      overage_amount: 0,
    },
    validation: {
      is_valid: true,
      quality_score: 95,
      duplicates_detected: [],
      timing_overlaps: [],
      geographic_warnings: [],
      pacing_notes: ['Balanced schedule with coastal clustering'],
    },
    planning_notes: [
      'Relaxed pace with 2–4 activities/day',
      'Geographic clustering: Day 1 Central, Day 2 North, Day 3 South',
      'Rest buffers and transit time included',
    ],
    days: [
      {
        day_number: 1,
        title: 'Central Panjim & Mandovi Heritage',
        cluster_name: 'Central Goa (Panjim & Old Goa)',
        weather_summary: 'Pleasant 29°C · Coastal breeze',
        activities: [
          {
            id: 'act_1',
            time: '09:30 AM',
            title: 'Fontainhas Latin Quarter Stroll',
            description: 'Explore pastel Portuguese villas and colonial architecture',
            location: 'Fontainhas, Panjim',
            place_type: 'TA',
            period_of_day: 'morning',
            estimated_cost: 0,
            duration_minutes: 90,
            transit_time_minutes: 20,
            transit_mode: 'walk',
            lat: 15.498,
            lng: 73.827,
            provenance: 'CURATED',
            why_recommended: 'Iconic heritage walk with pedestrian-friendly shaded lanes',
          },
          {
            id: 'act_2',
            time: '12:30 PM',
            title: 'Authentic Goan Thali Lunch at Viva Panjim',
            description: 'Traditional fish curry, kokum sol kadhi and poi bread',
            location: 'Panjim Latin Quarter',
            place_type: 'R',
            period_of_day: 'afternoon',
            estimated_cost: 900,
            duration_minutes: 60,
            transit_time_minutes: 10,
            transit_mode: 'walk',
            lat: 15.499,
            lng: 73.829,
            provenance: 'CURATED',
            why_recommended: 'Renowned heritage dining spot serving authentic Goan cuisine',
          },
        ],
      },
      {
        day_number: 2,
        title: 'North Goa Golden Beaches & Forts',
        cluster_name: 'North Goa (Anjuna, Vagator & Aguada)',
        weather_summary: 'Sunny 30°C',
        activities: [
          {
            id: 'act_3',
            time: '10:00 AM',
            title: 'Fort Aguada & Lighthouse Historic Viewpoint',
            description: '17th-century Portuguese fortress with Arabian Sea views',
            location: 'Sinquerim, Candolim',
            place_type: 'TA',
            period_of_day: 'morning',
            estimated_cost: 300,
            duration_minutes: 90,
            transit_time_minutes: 35,
            transit_mode: 'cab',
            lat: 15.492,
            lng: 73.773,
            provenance: 'CURATED',
            why_recommended: 'Historic landmark with coastal views matching relaxed pace',
          },
        ],
      },
    ],
    created_at: new Date().toISOString(),
  };

  describe('1. StructuredPlannerForm Component', () => {
    it('renders dual input options: natural language prompt and progressive controls', () => {
      render(
        <StructuredPlannerForm
          onSubmitProposal={vi.fn()}
          isGenerating={false}
        />
      );

      expect(screen.getByPlaceholderText(/e\.g\. 5 day Goa trip from Delhi/i)).toBeDefined();
      expect(screen.getByText(/Destination & Corridor/i)).toBeDefined();
      expect(screen.getByTestId('create-itinerary-proposal-btn')).toBeDefined();
    });

    it('extracts intent from natural language input and updates summary card', async () => {
      render(
        <StructuredPlannerForm
          onSubmitProposal={vi.fn()}
          isGenerating={false}
        />
      );

      const textarea = screen.getByPlaceholderText(/e\.g\. 5 day Goa trip from Delhi/i);
      fireEvent.change(textarea, {
        target: { value: '5 day Goa trip from Delhi for two people under 50k, relaxed, beaches and good food' },
      });

      // Shows what was understood in the card
      await waitFor(() => {
        expect(screen.getByTestId('understood-intent-card')).toBeDefined();
        expect(screen.getByText(/I understood:/i)).toBeDefined();
        expect(screen.getByText(/Goa · 5 days · 2 travelers · ₹50,000/i)).toBeDefined();
      });
    });

    it('submits structured values when traveler clicks Create Itinerary Proposal', () => {
      const handleSubmit = vi.fn();
      render(
        <StructuredPlannerForm
          initialValues={{ destination: 'Goa', daysCount: 5, budget: 50000, travelers: 2 }}
          onSubmitProposal={handleSubmit}
          isGenerating={false}
        />
      );

      const submitBtn = screen.getByTestId('create-itinerary-proposal-btn');
      fireEvent.click(submitBtn);

      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: 'Goa',
          daysCount: 5,
          budget: 50000,
          travelers: 2,
        })
      );
    });
  });

  describe('2. ItineraryProposalReview Component', () => {
    it('renders trip summary, budget breakdown with ESTIMATED label, and planning notes', () => {
      render(
        <ItineraryProposalReview
          proposal={mockProposal}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onPartialEdit={vi.fn()}
          onBackToEdit={vi.fn()}
          isAccepting={false}
          isEditing={false}
        />
      );

      expect(screen.getByText(/TRIP PROPOSAL READY FOR REVIEW/i)).toBeDefined();
      expect(screen.getByText(/Goa Coastal Getaway/i)).toBeDefined();
      expect(screen.getByText(/Estimated Trip Budget/i)).toBeDefined();
      expect(screen.getAllByText(/ESTIMATED/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Accommodations/i)).toBeDefined();
      expect(screen.getByText(/Dining & Food/i)).toBeDefined();
      expect(screen.getByText(/Activities & Entry/i)).toBeDefined();
      expect(screen.getByText(/Local Transit/i)).toBeDefined();
    });

    it('renders structured activity items with transit time, place badge, provenance and why recommended', () => {
      render(
        <ItineraryProposalReview
          proposal={mockProposal}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onPartialEdit={vi.fn()}
          onBackToEdit={vi.fn()}
          isAccepting={false}
          isEditing={false}
        />
      );

      expect(screen.getByText(/Fontainhas Latin Quarter Stroll/i)).toBeDefined();
      expect(screen.getByText(/Authentic Goan Thali Lunch at Viva Panjim/i)).toBeDefined();
      expect(screen.getAllByText(/Why recommended:/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Estimated transit: 20 min via walk/i)).toBeDefined();
      expect(screen.getByText(/Central Goa \(Panjim & Old Goa\)/i)).toBeDefined();
    });

    it('displays budget overrun guardrail when estimated cost exceeds target', () => {
      const overBudgetProposal: UnifiedProposalData = {
        ...mockProposal,
        target_budget: 35000,
        estimated_budget: 48000,
        budget_breakdown: {
          ...mockProposal.budget_breakdown,
          is_over_budget: true,
          overage_amount: 13000,
          total_estimated: 48000,
        },
      };

      const handleEdit = vi.fn();

      render(
        <ItineraryProposalReview
          proposal={overBudgetProposal}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onPartialEdit={handleEdit}
          onBackToEdit={vi.fn()}
          isAccepting={false}
          isEditing={false}
        />
      );

      expect(screen.getByText(/Budget Advisory: Itinerary is ₹13,000 over your target/i)).toBeDefined();
      const reduceBtn = screen.getByRole('button', { name: /Reduce Cost Proposal/i });
      expect(reduceBtn).toBeDefined();

      fireEvent.click(reduceBtn);
      expect(handleEdit).toHaveBeenCalledWith(
        expect.stringContaining('cheaper'),
        undefined
      );
    });

    it('triggers onAccept when traveler clicks Accept Itinerary button', () => {
      const handleAccept = vi.fn();
      render(
        <ItineraryProposalReview
          proposal={mockProposal}
          onAccept={handleAccept}
          onReject={vi.fn()}
          onPartialEdit={vi.fn()}
          onBackToEdit={vi.fn()}
          isAccepting={false}
          isEditing={false}
        />
      );

      const acceptBtns = screen.getAllByRole('button', { name: /Accept Itinerary/i });
      fireEvent.click(acceptBtns[0]);
      expect(handleAccept).toHaveBeenCalled();
    });

    it('triggers onReject when traveler clicks Discard button', () => {
      const handleReject = vi.fn();
      render(
        <ItineraryProposalReview
          proposal={mockProposal}
          onAccept={vi.fn()}
          onReject={handleReject}
          onPartialEdit={vi.fn()}
          onBackToEdit={vi.fn()}
          isAccepting={false}
          isEditing={false}
        />
      );

      const discardBtn = screen.getByRole('button', { name: /Discard/i });
      fireEvent.click(discardBtn);
      expect(handleReject).toHaveBeenCalled();
    });
  });
});
