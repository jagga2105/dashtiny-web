'use client';

import React, { useState } from 'react';
import { ProposalOverview } from './ProposalOverview';
import { ProposalBudget } from './ProposalBudget';
import { ProposalDaySelector } from './ProposalDaySelector';
import { ProposalDayTimeline } from './ProposalDayTimeline';
import { ProposalQuality } from './ProposalQuality';
import { ProposalActions } from './ProposalActions';
import { ProposalRevisionInput } from './ProposalRevisionInput';

export interface StructuredActivity {
  id: string;
  time: string;
  time_slot?: string;
  title: string;
  description: string;
  location: string;
  place_type?: string;
  placeType?: string;
  period_of_day?: 'morning' | 'afternoon' | 'evening';
  estimated_cost?: number;
  cost_estimate?: number;
  cost?: number;
  duration_minutes?: number;
  transit_time_minutes?: number;
  transit_mode?: string;
  lat?: number | null;
  lng?: number | null;
  provenance?: string;
  source?: string;
  why_recommended?: string;
  whyRecommended?: string;
  cluster?: string;
}

export interface StructuredDay {
  day_number: number;
  day?: number;
  date?: string;
  title: string;
  day_title?: string;
  day_theme?: string;
  dayTheme?: string;
  cluster_name?: string;
  location?: string;
  cover_image_url?: string;
  weather_summary?: string;
  weather_advisory?: string;
  daily_estimated_cost?: number;
  daily_travel_time_minutes?: number;
  daily_distance_km?: number | null;
  morning_summary?: string;
  afternoon_summary?: string;
  evening_summary?: string;
  activities: StructuredActivity[];
}

export interface BudgetCategory {
  category: string;
  label: string;
  amount: number;
  per_day?: number;
  currency?: string;
  provenance?: string;
  notes?: string;
}

export interface BudgetBreakdown {
  accommodation?: number;
  food?: number;
  activities?: number;
  local_transport?: number;
  intercity_transport?: number;
  miscellaneous?: number;
  total_estimated: number;
  currency: string;
  label?: string;
  is_over_budget: boolean;
  overage_amount: number;
  guardrail_status?: string;
  guardrail_message?: string | null;
  categories?: BudgetCategory[];
}

export interface ValidationReport {
  is_valid: boolean;
  quality_score: number;
  duplicates_detected: string[];
  timing_overlaps: string[];
  geographic_warnings: string[];
  pacing_notes: string[];
}

export interface UnifiedProposalData {
  proposal_id: string;
  title: string;
  destination: string;
  origin?: string;
  start_date?: string;
  end_date?: string;
  days_count: number;
  travelers: number;
  pace: string;
  persona: string;
  vibe: string;
  interests: string[];
  target_budget: number;
  estimated_budget: number;
  currency: string;
  budget_breakdown: BudgetBreakdown;
  validation: ValidationReport;
  planning_notes: string[];
  days: StructuredDay[];
  created_at: string;
}

interface ItineraryProposalReviewProps {
  proposal: UnifiedProposalData;
  onAccept: () => void;
  onReject: () => void;
  onPartialEdit: (instruction: string, targetDay?: number) => void;
  onBackToEdit: () => void;
  isAccepting: boolean;
  isEditing: boolean;
}

export function ItineraryProposalReview({
  proposal,
  onAccept,
  onReject,
  onPartialEdit,
  onBackToEdit,
  isAccepting,
  isEditing,
}: ItineraryProposalReviewProps) {
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [isRefiningOpen, setIsRefiningOpen] = useState<boolean>(false);

  const selectedDay = proposal.days?.find(
    (d) => (d.day_number || d.day) === selectedDayNumber
  ) || proposal.days?.[0] || {
    day_number: 1,
    title: 'Arrival & Welcome',
    activities: [],
  };

  const handleApplyRefine = (instruction: string, targetDay?: number) => {
    onPartialEdit(instruction, targetDay);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="itinerary-proposal-review">
      {/* 1. Proposal Overview: Viewport 1 First Impression */}
      <ProposalOverview proposal={proposal} />

      {/* 2. Primary Actions Bar */}
      <ProposalActions
        onAccept={onAccept}
        onToggleRefine={() => setIsRefiningOpen(!isRefiningOpen)}
        onEditPreferences={onBackToEdit}
        onReject={onReject}
        isAccepting={isAccepting}
        isRefiningOpen={isRefiningOpen}
      />

      {/* 3. Conversational Revision Input (Revealed on click or preset) */}
      <ProposalRevisionInput
        isOpen={isRefiningOpen}
        onClose={() => setIsRefiningOpen(false)}
        onSubmit={handleApplyRefine}
        isEditing={isEditing}
        daysCount={proposal.days_count}
        selectedDayNumber={selectedDayNumber}
      />

      {/* 4. Budget UX: Estimated total vs Target budget & compact categories */}
      <ProposalBudget
        budgetBreakdown={proposal.budget_breakdown}
        targetBudget={proposal.target_budget}
        estimatedBudget={proposal.estimated_budget}
        currency={proposal.currency}
        onAction={handleApplyRefine}
      />

      {/* 5. Compact Day Navigation Selector */}
      {proposal.days && proposal.days.length > 0 && (
        <ProposalDaySelector
          days={proposal.days}
          selectedDayNumber={selectedDayNumber}
          onSelectDay={(dayNum) => setSelectedDayNumber(dayNum)}
        />
      )}

      {/* 6. Selected Day Schedule Timeline */}
      <ProposalDayTimeline
        day={selectedDay}
        currency={proposal.currency}
      />

      {/* 7. Secondary Technical Diagnostic Information (lower on page) */}
      <ProposalQuality validation={proposal.validation} />
    </div>
  );
}
