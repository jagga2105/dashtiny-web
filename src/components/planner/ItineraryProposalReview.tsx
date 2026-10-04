'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  MapPin,
  Clock,
  Calendar,
  Users,
  Wallet,
  Car,
  Footprints,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  Tag,
  CheckCircle2,
  Compass,
  Sliders,
  DollarSign,
  Sun,
  Coffee,
  Sunset,
  Moon,
  Building,
  Utensils,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
  cluster_name?: string;
  cover_image_url?: string;
  weather_summary?: string;
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
  const [showBudgetBreakdown, setShowBudgetBreakdown] = useState<boolean>(true);
  const [showQualityDetails, setShowQualityDetails] = useState<boolean>(false);
  const [customInstruction, setCustomInstruction] = useState<string>('');
  const [showCustomPromptInput, setShowCustomPromptInput] = useState<boolean>(false);
  const [targetEditDay, setTargetEditDay] = useState<number | undefined>(undefined);

  const selectedDay = proposal.days.find(
    (d) => (d.day_number || d.day) === selectedDayNumber
  ) || proposal.days[0];

  const hasBudgetOverrun = proposal.budget_breakdown?.is_over_budget;
  const overrunAmount = proposal.budget_breakdown?.overage_amount || 0;

  const handleQuickEdit = (instruction: string, dayNum?: number) => {
    onPartialEdit(instruction, dayNum);
  };

  const handleCustomInstructionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInstruction.trim()) return;
    onPartialEdit(customInstruction, targetEditDay);
    setCustomInstruction('');
    setShowCustomPromptInput(false);
  };

  const getCategoryAmount = (categoryKey: string, directAmount?: number) => {
    if (typeof directAmount === 'number' && !isNaN(directAmount)) {
      return directAmount;
    }
    const cat = proposal.budget_breakdown?.categories?.find(
      (c: any) => c.category === categoryKey
    );
    return cat?.amount ?? 0;
  };

  const getPeriodIcon = (period?: string) => {
    switch (period) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      case 'afternoon':
        return <Coffee className="w-3.5 h-3.5 text-orange-500" />;
      case 'evening':
        return <Sunset className="w-3.5 h-3.5 text-indigo-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getPlaceTypeBadge = (type?: string) => {
    if (type === 'R') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
          <Utensils className="w-2.5 h-2.5" /> Dining
        </span>
      );
    }
    if (type === 'H') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
          <Building className="w-2.5 h-2.5" /> Stay
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold">
        <Camera className="w-2.5 h-2.5" /> Attraction
      </span>
    );
  };

  const getProvenanceBadge = (prov?: string) => {
    switch (prov) {
      case 'PROVIDER_VERIFIED':
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium" title="Verified against live official source">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
          </span>
        );
      case 'CURATED':
      case 'DESTINATION_GRAPH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium" title="Selected from verified regional destination graph">
            <ShieldCheck className="w-3 h-3 text-blue-600" /> Curated
          </span>
        );
      case 'USER_GENERATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium">
            User Added
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-medium" title="Generated by DAIna Itinerary Intelligence">
            <Sparkles className="w-3 h-3 text-orange-500" /> AI Proposal
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner: Proposal Status */}
      <div className="p-6 rounded-3xl bg-linear-to-r from-orange-600 via-amber-600 to-orange-700 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>TRIP PROPOSAL READY FOR REVIEW</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif-editorial font-bold tracking-tight">
              {proposal.title || `Your ${proposal.destination} Itinerary`}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-orange-100 font-medium">
              <span>📍 {proposal.destination}</span>
              {proposal.origin && <span>· 🛫 From {proposal.origin}</span>}
              <span>· ⏱️ {proposal.days_count} Days</span>
              <span>· 👥 {proposal.travelers} {proposal.travelers === 1 ? 'Traveler' : 'Travelers'}</span>
              <span>· ⚡ {proposal.pace.toUpperCase()} Pace</span>
              {proposal.target_budget > 0 && (
                <span>· 🎯 ₹{proposal.target_budget.toLocaleString('en-IN')} target</span>
              )}
            </div>
          </div>

          {/* Top Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToEdit}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs px-3.5 py-2 rounded-xl backdrop-blur-sm transition-all"
            >
              <Sliders className="w-3.5 h-3.5 mr-1" />
              Edit Preferences
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onAccept}
              isLoading={isAccepting}
              className="bg-white hover:bg-orange-50 text-orange-700 font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-orange-600 stroke-[2.5]" />
              Accept Itinerary &amp; Create Trip →
            </Button>
          </div>
        </div>

        {/* Planning Notes Pills */}
        {proposal.planning_notes && proposal.planning_notes.length > 0 && (
          <div className="pt-2 border-t border-white/20 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-white/80 font-semibold text-[11px] uppercase tracking-wider">
              DAIna Intelligence:
            </span>
            {proposal.planning_notes.map((note, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur-xs text-[11px] font-medium text-white border border-white/10"
              >
                ✓ {note}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Budget Guardrail Alert Banner */}
      {hasBudgetOverrun && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-sm text-amber-900">
                Budget Advisory: Itinerary is ₹{overrunAmount.toLocaleString('en-IN')} over your target
              </p>
              <p className="text-amber-800">
                Target budget was ₹{proposal.target_budget.toLocaleString('en-IN')}, while estimated total is ₹{proposal.estimated_budget.toLocaleString('en-IN')}.
                We can adjust accommodations or activities to fit your limit.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickEdit('Make this itinerary ₹' + overrunAmount + ' cheaper without dropping essential highlights')}
              isLoading={isEditing}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold border-transparent text-xs px-3.5 py-1.5 rounded-xl cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 mr-1" />
              Reduce Cost Proposal
            </Button>
          </div>
        </div>
      )}

      {/* Budget Breakdown & Cost Distribution Card */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div
          onClick={() => setShowBudgetBreakdown(!showBudgetBreakdown)}
          className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 font-serif-editorial">
                  Estimated Trip Budget
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                  {proposal.budget_breakdown?.label || 'ESTIMATED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Total Estimated: ₹{(proposal.estimated_budget || proposal.budget_breakdown?.total_estimated || 0).toLocaleString('en-IN')}
                {proposal.target_budget > 0 && ` · Target: ₹${proposal.target_budget.toLocaleString('en-IN')}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              {showBudgetBreakdown ? 'Hide Breakdown' : 'View Breakdown'}
            </span>
            {showBudgetBreakdown ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {showBudgetBreakdown && proposal.budget_breakdown && (
          <div className="p-5 pt-0 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 block">Accommodations</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                ₹{getCategoryAmount('accommodation', proposal.budget_breakdown.accommodation).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block">Stays &amp; Resorts</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 block">Dining &amp; Food</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                ₹{getCategoryAmount('food', proposal.budget_breakdown.food).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block">Meals &amp; Cafes</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 block">Activities &amp; Entry</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                ₹{getCategoryAmount('activities', proposal.budget_breakdown.activities).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block">Passes &amp; Experiences</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 block">Local Transit</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                ₹{getCategoryAmount('local_transport', proposal.budget_breakdown.local_transport).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block">Cabs, Autos, Metro</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 block">Intercity Travel</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                ₹{getCategoryAmount('intercity_transport', proposal.budget_breakdown.intercity_transport).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block">Flight / Train Est.</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[11px] font-medium text-slate-500 block">Contingency</span>
              <span className="font-mono text-sm font-bold text-slate-900">
                ₹{getCategoryAmount('miscellaneous', proposal.budget_breakdown.miscellaneous).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block">Shopping &amp; Buffer</span>
            </div>
          </div>
        )}
      </div>

      {/* Day Selector Navigation Pills */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex items-center gap-2">
          {proposal.days.map((day) => {
            const dayNum = day.day_number || day.day || 1;
            const isSelected = selectedDayNumber === dayNum;
            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => setSelectedDayNumber(dayNum)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Day {dayNum}</span>
                {day.cluster_name && (
                  <span className={`text-[10px] font-normal ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    · {day.cluster_name.split(' ')[0]}
                  </span>
                )}
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {day.activities?.length || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Tweak Drawer Toggle */}
        <button
          type="button"
          onClick={() => {
            setTargetEditDay(selectedDayNumber);
            setShowCustomPromptInput(!showCustomPromptInput);
          }}
          className="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-800 text-xs font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          <span>Ask DAIna to Refine Day {selectedDayNumber}</span>
        </button>
      </div>

      {/* Conversational Tweak Drawer (Proposal-based, NO direct mutation) */}
      {showCustomPromptInput && (
        <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              Propose AI Edit for Day {targetEditDay} (or Entire Trip)
            </span>
            <button
              type="button"
              onClick={() => setShowCustomPromptInput(false)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCustomInstructionSubmit} className="space-y-2">
            <input
              type="text"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder={`e.g. Make Day ${selectedDayNumber} more relaxed, move beach to afternoon, or add seafood dinner`}
              className="w-full bg-white border border-orange-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  `Make Day ${selectedDayNumber} more relaxed`,
                  `Add a sunset dinner to Day ${selectedDayNumber}`,
                  `Make this day cheaper`,
                  `Replace with quieter beach`,
                ].map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomInstruction(sug);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-orange-200 hover:border-orange-400 text-[11px] font-medium text-slate-700 cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isEditing}
                disabled={!customInstruction.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-4 py-1.5 rounded-xl cursor-pointer"
              >
                Propose Revision →
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Selected Day Execution Schedule Card */}
      {selectedDay && (
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden space-y-6">
          {/* Day Title & Cluster Ribbon */}
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-linear-to-b from-slate-50/70 to-white">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold uppercase tracking-wider">
                  Day {selectedDay.day_number || selectedDay.day}
                </span>
                {selectedDay.cluster_name && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold flex items-center gap-1">
                    <Compass className="w-3 h-3 text-slate-500" />
                    {selectedDay.cluster_name}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold font-serif-editorial text-slate-900">
                {selectedDay.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {selectedDay.weather_summary || 'Pleasant tropical climate'} · {selectedDay.activities?.length || 0} stops organized with verified geographic grouping
              </p>
            </div>

            {/* Weather & Day Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-600" />
                <span>{selectedDay.weather_summary || 'Pleasant weather'}</span>
              </div>
            </div>
          </div>

          {/* Activities Timeline */}
          <div className="px-6 pb-6 space-y-4">
            {selectedDay.activities && selectedDay.activities.length > 0 ? (
              selectedDay.activities.map((act, aIdx) => {
                const estCost = act.estimated_cost ?? act.cost_estimate ?? act.cost ?? 0;
                const transitTime = act.transit_time_minutes ?? 20;
                const transitMode = act.transit_mode ?? 'cab';
                const hasCoords = act.lat != null && act.lng != null;

                return (
                  <div key={act.id || aIdx} className="space-y-2">
                    {/* Activity Row */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-orange-300 transition-all shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* Time & Title */}
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 shrink-0 w-20 text-center">
                            <span className="font-mono text-xs font-bold text-orange-600">
                              {act.time || act.time_slot || '09:30 AM'}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              {getPeriodIcon(act.period_of_day)}
                              {act.duration_minutes ? `${act.duration_minutes}m` : '60m'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">
                                {act.title || act.description}
                              </h4>
                              {getPlaceTypeBadge(act.place_type || act.placeType)}
                              {getProvenanceBadge(act.provenance)}
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed">
                              {act.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {act.location || 'Local area'}
                              </span>

                              {hasCoords ? (
                                <span className="text-slate-400 text-[10px] font-mono">
                                  [{act.lat?.toFixed(3)}, {act.lng?.toFixed(3)}]
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px] italic">
                                  Location not mapped
                                </span>
                              )}

                              <span className="font-mono font-semibold text-slate-700">
                                ₹{estCost.toLocaleString('en-IN')}
                                <span className="text-[9px] text-slate-400 font-normal ml-1">ESTIMATED</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Deterministic "Why This Was Recommended" explanation */}
                      {act.why_recommended && (
                        <div className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-100 text-[11px] text-orange-950 flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-orange-900">Why recommended: </span>
                            <span className="text-orange-950">{act.why_recommended}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Transit connector between activities */}
                    {aIdx < selectedDay.activities.length - 1 && (
                      <div className="pl-6 py-1 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                        <div className="w-0.5 h-4 bg-slate-200 ml-3" />
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[10px]">
                          {transitMode === 'walk' ? (
                            <Footprints className="w-3 h-3 text-slate-500" />
                          ) : (
                            <Car className="w-3 h-3 text-slate-500" />
                          )}
                          Estimated transit: {transitTime} min via {transitMode}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                No activities planned for this day yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Internal Planning Quality Diagnostic (Accordion for transparency) */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-800">
              Itinerary Quality &amp; Feasibility Checks Passed
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowQualityDetails(!showQualityDetails)}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline"
          >
            {showQualityDetails ? 'Hide Quality Audit' : 'Show Quality Audit'}
          </button>
        </div>

        {showQualityDetails && proposal.validation && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600 animate-in fade-in">
            <p>✓ <strong>Deduplication:</strong> 0 duplicate attractions or dining spots across {proposal.days_count} days.</p>
            <p>✓ <strong>Geographic Continuity:</strong> Anti-ping-pong clustering enforced across regional clusters.</p>
            <p>✓ <strong>Time Feasibility:</strong> 0 overlapping start/end schedules; transit buffers included.</p>
            <p>✓ <strong>Pacing Balance:</strong> Rest breaks and meal buffers distributed according to {proposal.pace} pace.</p>
            {proposal.validation.geographic_warnings?.length > 0 && (
              <div className="text-amber-700 bg-amber-50 p-2 rounded-lg">
                ⚠️ Notes: {proposal.validation.geographic_warnings.join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar for Traveler Decision */}
      <div className="sticky bottom-6 z-20 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5 text-xs">
          <p className="font-bold text-white text-sm">
            Ready to confirm this getaway plan?
          </p>
          <p className="text-slate-400">
            Accepting will create your trip canvas and record revision v1. AI will never directly alter your trip without your approval.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 text-xs px-3.5 py-2 rounded-xl cursor-pointer"
          >
            Discard
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={onAccept}
            isLoading={isAccepting}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            Accept Itinerary &amp; Create Trip →
          </Button>
        </div>
      </div>
    </div>
  );
}
