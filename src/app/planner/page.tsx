'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Sparkles,
  CheckCircle2,
  Luggage,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Check,
  Loader2,
  Compass,
  Sliders,
  Wallet,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { Button } from '@/components/ui/Button';
import { usePlannerStore } from '@/store/usePlannerStore';
import { apiService, AirportLocation } from '@/services/api';
import { Trip } from '@/types/trip';
import {
  StructuredPlannerForm,
  StructuredPlannerFormValues,
} from '@/components/planner/StructuredPlannerForm';
import {
  ItineraryProposalReview,
  UnifiedProposalData,
} from '@/components/planner/ItineraryProposalReview';

const PIPELINE_STAGES = [
  'Understanding your trip & preferences...',
  'Planning neighborhoods & geographic clusters...',
  'Building daily schedule & executable time slots...',
  'Checking travel times & transit feasibility...',
  'Balancing budget & cost guardrails...',
  'Preparing your itinerary proposal...',
];

function PlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('query') || '';
  const paramTripId = searchParams.get('tripId') || searchParams.get('trip_id') || '';
  const sourceTripId = searchParams.get('source_trip_id') || '';
  const paramDestination = searchParams.get('destination') || '';
  const paramDuration = searchParams.get('duration') || '';
  const paramBudget = searchParams.get('budget') || '';
  const paramVibe = searchParams.get('vibe') || '';
  const paramInterests = searchParams.get('interests') || '';
  const paramAuthor = searchParams.get('author') || '';
  const isAdapting = Boolean(sourceTripId || searchParams.get('adapt') === 'true');

  const { setCurrentItinerary, addItinerary } = usePlannerStore();

  // Active Proposal State (Held before database commitment)
  const [activeProposal, setActiveProposal] = useState<UnifiedProposalData | null>(null);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState<boolean>(false);
  const [generationStageIndex, setGenerationStageIndex] = useState<number>(0);
  const [isAcceptingProposal, setIsAcceptingProposal] = useState<boolean>(false);
  const [isEditingProposal, setIsEditingProposal] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Initial Values
  const [formInitialValues, setFormInitialValues] = useState<Partial<StructuredPlannerFormValues>>({
    destination: paramDestination,
    daysCount: paramDuration ? parseInt(paramDuration, 10) : 4,
    budget: paramBudget ? parseInt(paramBudget, 10) : 50000,
    interests: paramInterests ? paramInterests.split(',') : ['food', 'beaches'],
    rawPrompt: initialQuery,
  });

  // Source Trip Adaptation Highlights
  const [sourceTripData, setSourceTripData] = useState<any>(null);
  const [sourceHighlights, setSourceHighlights] = useState<any[]>([]);
  const [isLoadingSourceTrip, setIsLoadingSourceTrip] = useState(false);
  const [sourceTripError, setSourceTripError] = useState<string | null>(null);

  // Animate generation pipeline stages
  useEffect(() => {
    let interval: any = null;
    if (isGeneratingProposal) {
      setGenerationStageIndex(0);
      interval = setInterval(() => {
        setGenerationStageIndex((prev) => (prev < PIPELINE_STAGES.length - 1 ? prev + 1 : prev));
      }, 700);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGeneratingProposal]);

  // Load real public trip itinerary snapshot for adaptation if requested
  useEffect(() => {
    async function loadSourceTrip() {
      if (!isAdapting || !sourceTripId) return;
      setSourceTripError(null);
      setIsLoadingSourceTrip(true);
      try {
        const snapshot = await apiService.getPublicTrip(sourceTripId);
        if (snapshot && Array.isArray(snapshot.stops) && snapshot.stops.length > 0) {
          setSourceTripData(snapshot);
          setSourceHighlights(
            snapshot.stops.map((s: any) => ({
              id: s.id,
              day: s.day,
              title: s.title,
              tag: s.tag,
              location: s.location,
              keep: true,
            }))
          );
        }
      } catch (err: any) {
        console.warn('Could not load public trip snapshot:', err);
        setSourceTripError("Original itinerary couldn't be loaded.");
      } finally {
        setIsLoadingSourceTrip(false);
      }
    }
    loadSourceTrip();
  }, [isAdapting, sourceTripId]);

  // Direct load if tripId is provided in URL
  useEffect(() => {
    async function loadTripDetails() {
      if (!paramTripId) return;
      try {
        const details = await apiService.getTripDetails(paramTripId);
        if (details && details.id) {
          router.push(`/trips?tripId=${details.id}`);
        }
      } catch (err) {
        console.warn('Could not load trip from paramTripId:', err);
      }
    }
    loadTripDetails();
  }, [paramTripId, router]);

  // 1. Generate Structured Itinerary Proposal (Does NOT mutate DB)
  const handleGenerateProposal = async (values: StructuredPlannerFormValues) => {
    setIsGeneratingProposal(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        destination: values.destination,
        days_count: values.daysCount,
        origin: values.originAirport?.iata_code || values.origin || undefined,
        travelers: values.travelers,
        budget: values.budget,
        currency: values.currency || 'INR',
        pace: values.pace || 'balanced',
        interests: values.interests || ['food', 'beaches'],
        wake_up_preference: values.wakeUpPreference || 'balanced',
        accommodation_preference: values.accommodationPreference || 'comfort',
        food_preferences: values.foodPreferences || ['any'],
        raw_prompt: values.rawPrompt,
        vibe: values.pace === 'relaxed' ? 'Leisure' : values.pace === 'packed' ? 'Adventure' : 'Balanced',
      };

      // If adapting, append kept highlights
      const keptHighlights = sourceHighlights.filter((h) => h.keep).map((h) => h.title);
      if (isAdapting && keptHighlights.length > 0) {
        payload.planning_notes = [`Adapted from community trip with ${keptHighlights.length} preserved stops`];
      }

      const proposal = await apiService.createItineraryProposal(payload);

      if (proposal && proposal.proposal_id) {
        setActiveProposal(proposal as UnifiedProposalData);
        // Scroll smoothly to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error('No proposal received from planner engine.');
      }
    } catch (err: any) {
      console.error('Failed to generate proposal:', err);
      setErrorMsg(
        err.message || 'Unable to generate itinerary proposal. Please verify the destination and retry.'
      );
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  // 2. Authoritative Acceptance: Commits to PostgreSQL atomically & records Revision v1
  const handleAcceptProposal = async () => {
    if (!activeProposal) return;
    setIsAcceptingProposal(true);
    setErrorMsg(null);

    try {
      const committedTrip = await apiService.acceptItineraryProposal(activeProposal.proposal_id);

      if (committedTrip && committedTrip.id) {
        const formatted: Trip = {
          id: committedTrip.id,
          title: committedTrip.title,
          destination: committedTrip.destination,
          origin: committedTrip.origin,
          startDate: committedTrip.startDate,
          endDate: committedTrip.endDate,
          travellers: committedTrip.travellers ?? activeProposal.travelers,
          budget: committedTrip.budget ?? activeProposal.estimated_budget,
          currency: committedTrip.currency || 'INR',
          persona: committedTrip.persona || activeProposal.persona,
          vibe: committedTrip.vibe || activeProposal.vibe,
          days: committedTrip.days || [],
          bookings: [],
          squad: {
            id: 'sq_initial',
            itineraryId: committedTrip.id,
            roomCode: committedTrip.squad_room_code,
            members: [],
          },
          snapshots: [],
        };

        addItinerary(formatted);
        setCurrentItinerary(formatted);

        // Direct navigation to Trip Workspace cockpit
        router.push(`/trips?tripId=${committedTrip.id}`);
      } else {
        throw new Error('Could not commit itinerary proposal to trip database.');
      }
    } catch (err: any) {
      console.error('Failed to accept proposal:', err);
      setErrorMsg(
        err.message || 'Failed to accept itinerary proposal. Please check connection and retry.'
      );
    } finally {
      setIsAcceptingProposal(false);
    }
  };

  // 3. Discard Proposal (Non-mutating reject)
  const handleRejectProposal = async () => {
    if (!activeProposal) return;
    try {
      await apiService.rejectItineraryProposal(activeProposal.proposal_id);
    } catch (err) {
      console.warn('Reject cleanup warning:', err);
    }
    setActiveProposal(null);
  };

  // 4. Propose Partial Edit (AI generates diff proposal, still non-mutating)
  const handlePartialEditProposal = async (instruction: string, targetDay?: number) => {
    if (!activeProposal) return;
    setIsEditingProposal(true);
    setErrorMsg(null);

    try {
      const editedProposal = await apiService.editItineraryProposal(
        activeProposal.proposal_id,
        instruction,
        targetDay
      );
      if (editedProposal && editedProposal.proposal_id) {
        setActiveProposal(editedProposal as UnifiedProposalData);
      }
    } catch (err: any) {
      console.error('Failed to apply partial edit:', err);
      setErrorMsg(err.message || 'Could not refine itinerary. Please retry with a different prompt.');
    } finally {
      setIsEditingProposal(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 space-y-8">
        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Community Source Trip Loading or Error */}
        {isAdapting && isLoadingSourceTrip && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-2 text-xs text-slate-500 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500" />
            <p>Loading community trip stops to adapt...</p>
          </div>
        )}

        {isAdapting && sourceTripError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{sourceTripError}</span>
          </div>
        )}

        {/* View Mode 1: Active Trip Proposal Review */}
        {activeProposal ? (
          <ItineraryProposalReview
            proposal={activeProposal}
            onAccept={handleAcceptProposal}
            onReject={handleRejectProposal}
            onPartialEdit={handlePartialEditProposal}
            onBackToEdit={() => setActiveProposal(null)}
            isAccepting={isAcceptingProposal}
            isEditing={isEditingProposal}
          />
        ) : (
          /* View Mode 2: Progressive Structured Planner Input */
          <div className="space-y-8">
            {/* Header: Inspiration and Purpose */}
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-200/80 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                <span>
                  {isAdapting ? 'Adapt Community Getaway' : 'Intelligent Itinerary Architect'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-serif-editorial font-bold text-slate-900 tracking-tight">
                {isAdapting ? 'Customize & Adapt Getaway' : 'Plan your getaway'}
              </h1>
              <p className="text-slate-600 text-sm max-w-2xl leading-relaxed">
                Describe your trip naturally or refine your exact dates, budget, and travel pace.
                DAIna will assemble a structured day-by-day plan with neighborhood clustering, travel buffers, and budget guardrails.
              </p>
            </div>

            {/* Pipeline Generation Progress Banner */}
            {isGeneratingProposal && (
              <div className="p-8 rounded-3xl bg-linear-to-b from-orange-500/10 via-amber-500/5 to-white border border-orange-200 text-center space-y-4 shadow-sm animate-in fade-in">
                <div className="w-10 h-10 rounded-full border-3 border-orange-500 border-t-transparent animate-spin mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 font-serif-editorial">
                    {PIPELINE_STAGES[generationStageIndex]}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Assembling multi-day schedule, neighborhood routes, transit buffers, and cost estimates.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1.5 pt-2">
                  {PIPELINE_STAGES.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === generationStageIndex
                          ? 'w-8 bg-orange-600'
                          : idx < generationStageIndex
                          ? 'w-3 bg-orange-300'
                          : 'w-2 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Dual Input Form: Natural Language + Progressive Preferences */}
            {!isGeneratingProposal && (
              <StructuredPlannerForm
                initialValues={formInitialValues}
                onSubmitProposal={handleGenerateProposal}
                isGenerating={isGeneratingProposal}
                generationStepText={PIPELINE_STAGES[generationStageIndex]}
              />
            )}
          </div>
        )}
      </main>

      <DAInaChatWidget />
      <BottomNav />
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center font-bold text-slate-700">
          Loading Getaway Planner...
        </div>
      }
    >
      <PlannerContent />
    </Suspense>
  );
}
