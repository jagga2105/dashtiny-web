'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { MapPin, Map, Award, BrainCircuit, Upload, Sparkles, CheckCircle2, Luggage, ArrowRight, AlertTriangle, AlertCircle, RefreshCw, Check, Loader2 } from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { AITripArchitectModal } from '@/components/planner/AITripArchitectModal';
import { BudgetManagerWidget } from '@/components/ui/BudgetManagerWidget';
import { PersonaSelector, PersonaType } from '@/components/ui/PersonaSelector';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { usePlannerStore } from '@/store/usePlannerStore';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';
import { parseTravelPrompt } from '@/lib/dainaIntentParser';

function PlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('query') || '';
  const sourceTripId = searchParams.get('source_trip_id') || '';
  const paramDestination = searchParams.get('destination') || '';
  const paramDuration = searchParams.get('duration') || '';
  const paramBudget = searchParams.get('budget') || '';
  const paramVibe = searchParams.get('vibe') || '';
  const paramInterests = searchParams.get('interests') || '';
  const paramAuthor = searchParams.get('author') || '';
  const isAdapting = Boolean(sourceTripId || searchParams.get('adapt') === 'true');

  const { currentItinerary, setCurrentItinerary, addItinerary } = usePlannerStore();
  const { isAuthenticated } = useAuthStore();
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>('solo');
  const [showMapView, setShowMapView] = useState(false);
  const [showArchitect, setShowArchitect] = useState(false);
  const [promptText, setPromptText] = useState(initialQuery);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sourceTripData, setSourceTripData] = useState<any>(null);
  const [isLoadingSourceTrip, setIsLoadingSourceTrip] = useState(false);
  const [sourceTripError, setSourceTripError] = useState<string | null>(null);
  const [sourceTripReloadKey, setSourceTripReloadKey] = useState(0);
  const isExplicitDemo = searchParams.get('demo') === 'true' || sourceTripId === 'trip_1' || sourceTripId === 'trip_2';
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  const [showUnderstandingDetails, setShowUnderstandingDetails] = useState(false);

  // Fallback stops only when source trip ID is not provided or network is offline
  const getFallbackHighlights = (dest: string, sourceId: string) => {
    const d = (dest || '').toLowerCase();
    if (sourceId === 'trip_1' || d.includes('kyoto') || d.includes('japan')) {
      return [
        { id: 'h1', day: 1, title: 'Check-in at Machiya Townhouse & Gion Evening Stroll', tag: 'Culture & Arrival', location: 'Gion, Kyoto', keep: true },
        { id: 'h2', day: 2, title: 'Early Fushimi Inari (Zero Crowds) & Tofuku-ji Zen Gardens', tag: 'Iconic & Sacred', location: 'Southern Kyoto', keep: true },
        { id: 'h3', day: 3, title: 'Nishiki Market Food Crawl & Philosopher’s Path Walk', tag: 'Gastronomy & Stroll', location: 'Central Kyoto', keep: true },
        { id: 'h4', day: 4, title: 'Arashiyama Bamboo Grove & Tenryu-ji Temple Morning', tag: 'Nature & Heritage', location: 'Arashiyama', keep: true },
        { id: 'h5', day: 5, title: 'Day Excursion to Uji: Byodoin Phoenix Hall & Matcha Tasting', tag: 'Artisanal Excursion', location: 'Uji', keep: true },
        { id: 'h6', day: 6, title: 'Kiyomizu-dera Panoramic Terrace & Pottery Lane Departure', tag: 'Scenic & Farewell', location: 'Higashiyama', keep: true },
      ];
    }
    if (sourceId === 'trip_2' || d.includes('goa')) {
      return [
        { id: 'h1', day: 1, title: 'Check-in at Cliffside Sanctuary & Palolem Sunset Walk', tag: 'Relaxed Arrival', location: 'Palolem Beach', keep: true },
        { id: 'h2', day: 2, title: 'Agonda Beach Kayaking & Authentic Goan Seafood Thali', tag: 'Coastal & Dining', location: 'Agonda', keep: true },
        { id: 'h3', day: 3, title: 'Cabo de Rama Historic Fort & Cliff Cafe Golden Hour', tag: 'Scenic Heritage', location: 'Cabo de Rama', keep: true },
        { id: 'h4', day: 4, title: 'Galgibaga Turtle Sanctuary & Old Bakery Breakfast', tag: 'Slow Travel', location: 'South Goa', keep: true },
      ];
    }
    return [
      { id: 'h1', day: 1, title: `Arrival, Check-in & Scenic Neighborhood Walk in ${dest || 'Destination'}`, tag: 'Arrival', location: dest || 'Local center', keep: true },
      { id: 'h2', day: 2, title: `Iconic Landmark Tour & Verified Local Gastronomy in ${dest || 'Destination'}`, tag: 'Highlights', location: dest || 'Old town', keep: true },
      { id: 'h3', day: 3, title: `Cultural Immersion & Hidden Local Sanctuary in ${dest || 'Destination'}`, tag: 'Discovery', location: dest || 'Artisan quarter', keep: true },
      { id: 'h4', day: 4, title: `Golden Hour Scenic Spot & Farewell Dining Experience`, tag: 'Departure', location: dest || 'Panoramic viewpoint', keep: true },
    ];
  };

  const [sourceHighlights, setSourceHighlights] = useState<any[]>([]);

  // Load real public trip itinerary snapshot from server
  useEffect(() => {
    async function loadSourceTrip() {
      if (!isAdapting) return;
      setSourceTripError(null);
      if (sourceTripId) {
        setIsLoadingSourceTrip(true);
        try {
          const snapshot = await apiService.getPublicTrip(sourceTripId);
          if (snapshot && Array.isArray(snapshot.stops) && snapshot.stops.length > 0) {
            setSourceTripData(snapshot);
            setSourceHighlights(snapshot.stops.map((s: any) => ({
              id: s.id,
              day: s.day,
              title: s.title,
              tag: s.tag,
              location: s.location,
              keep: true,
            })));
            return;
          }
        } catch (err: any) {
          console.warn('Could not load public trip snapshot:', err);
          if (!isExplicitDemo) {
            setSourceTripError("Original itinerary couldn't be loaded. The trip might be private, unpublished, or the server was unreachable.");
            setSourceHighlights([]);
            setSourceTripData(null);
            return;
          }
        } finally {
          setIsLoadingSourceTrip(false);
        }
      }
      if (isExplicitDemo) {
        setSourceHighlights(getFallbackHighlights(paramDestination, sourceTripId));
      }
    }
    loadSourceTrip();
  }, [isAdapting, sourceTripId, paramDestination, isExplicitDemo, sourceTripReloadKey]);

  const toggleHighlight = (id: string) => {
    setSourceHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, keep: !h.keep } : h))
    );
  };

  // Initialize or fetch latest itinerary from PostgreSQL
  useEffect(() => {
    async function loadLatest() {
      if (initialQuery) {
        setPromptText(initialQuery);
      } else if (paramDestination) {
        setPromptText(`Plan a trip to ${paramDestination}${paramDuration ? ` for ${paramDuration} days` : ''}${paramBudget ? ` with budget ₹${parseInt(paramBudget, 10).toLocaleString('en-IN')}` : ''}`);
      } else if (!currentItinerary) {
        try {
          const myTrips = await apiService.getMyTrips();
          if (myTrips && myTrips.length > 0) {
            const latest = myTrips[0];
            setCurrentItinerary({
              id: latest.id,
              title: latest.title,
              destination: latest.destination,
              startDate: latest.startDate,
              endDate: latest.endDate,
              budget: latest.budget,
              days: latest.days || [],
            });
          }
        } catch (err) {
          // If offline or first load, do not fail silently with fake data
          console.warn('Could not fetch existing trips from PostgreSQL:', err);
        }
      }
    }
    loadLatest();
  }, [initialQuery, paramDestination, paramDuration, paramBudget]);

  const handleBuildPlan = async (queryText?: string) => {
    const textToUse = queryText || promptText;
    if (!textToUse.trim() && !paramDestination) return;

    setIsGenerating(true);
    setSaveSuccessMsg(null);
    setErrorMsg(null);

    // Natural language request parsing fallback to structured URL params
    const parsed = parseTravelPrompt(textToUse);
    const dest = parsed.destination || paramDestination;
    
    // Explicit Destination Enforcement — No silent Kyoto default
    if (!dest) {
      setErrorMsg("Please specify a destination (e.g. Kyoto, Goa, Manali, Paris) so DAIna can tailor your itinerary.");
      setIsGenerating(false);
      return;
    }

    const days = parsed.days_count || (paramDuration ? parseInt(paramDuration, 10) : 4);
    const budgetVal = parsed.budget || (paramBudget ? parseInt(paramBudget, 10) : 0);
    const vibeVal = parsed.vibe || paramVibe || 'culture';
    const interestsVal = parsed.interests && parsed.interests.length > 0 ? parsed.interests : (paramInterests ? paramInterests.split(',') : ['culture', 'sightseeing']);

    // Synchronize persona: if prompt specifies companions or persona, prioritize it and sync UI
    const hasExplicitPersonaInPrompt = /(solo|alone|partner|couple|romantic|wife|husband|girlfriend|boyfriend|family|kids|children|parents|squad|friends|gang|buddies|nomad|workation)/i.test(textToUse);
    const effectivePersona = hasExplicitPersonaInPrompt ? parsed.persona : (selectedPersona || parsed.persona);
    if (hasExplicitPersonaInPrompt && parsed.persona) {
      setSelectedPersona(parsed.persona as PersonaType);
    }

    // Adapt source itinerary stops into DAIna generation prompt
    const keptHighlights = sourceHighlights.filter((h) => h.keep).map((h) => h.title);
    const authorName = sourceTripData?.author || paramAuthor || 'community';
    const budgetNotice = budgetVal === 0 ? "You didn't specify a budget. Create a comfortable mid-range plan and estimate the cost." : '';
    const finalPrompt = (isAdapting && keptHighlights.length > 0)
      ? `${textToUse || `Trip to ${dest}`}. Adapting ${authorName}'s source itinerary. Keep core stops: ${keptHighlights.join('; ')}. Personalize pacing, stays, and budget for ${effectivePersona}. ${budgetNotice}`
      : `${textToUse || `Trip to ${dest}`}. ${budgetNotice}`;

    try {
      const res = await apiService.generateItinerary({
        destination: dest,
        origin: parsed.origin,
        start_date: parsed.start_date,
        end_date: parsed.end_date,
        days_count: days,
        travellers: parsed.travellers,
        budget: budgetVal,
        currency: parsed.currency || 'INR',
        persona: effectivePersona,
        vibe: vibeVal,
        interests: interestsVal,
        raw_prompt: finalPrompt,
        prompt: finalPrompt,
      });

      if (res && res.id) {
        const formatted = {
          id: res.id,
          title: res.title,
          destination: res.destination,
          startDate: res.startDate,
          endDate: res.endDate,
          budget: res.budget,
          days: res.days,
        };
        addItinerary(formatted);
        setCurrentItinerary(formatted);
        setSaveSuccessMsg(`✦ Your trip is ready! Room Code: ${res.squad_room_code}`);
      }
    } catch (err: any) {
      console.error('Failed to generate itinerary:', err);
      setErrorMsg(
        err.status === 0
          ? 'Unable to connect to DashTiny services. Please check if the backend server is running and retry.'
          : 'DAIna is temporarily unavailable. Please retry in a moment.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const activeItinerary = currentItinerary;

  // Live parsed intent from user prompt
  const parsedIntent = promptText.trim() ? parseTravelPrompt(promptText) : null;

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 space-y-8">
        {/* Page Title — Clean and direct */}
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAdapting ? 'Adapt Community Itinerary' : 'AI Travel Planner'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif-editorial font-bold text-slate-900 tracking-tight">
            {isAdapting ? 'Adapt this itinerary' : 'Plan a trip'}
          </h1>
          <p className="text-slate-600 text-sm">
            {isAdapting
              ? (paramAuthor
                  ? `Adapting ${paramDestination || 'this'} itinerary from ${paramAuthor} with your preferred pace and budget.`
                  : `Adapting ${paramDestination || 'this'} itinerary with personalized pacing and verified recommendations.`)
              : "Tell DAIna what you're looking for. We'll build a personalized day-by-day plan with stays, dining, and activities."}
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => handleBuildPlan()}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 flex items-center gap-1 text-xs shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Itinerary created and saved automatically!</span>
            </div>
            <button
              onClick={() => router.push(activeItinerary?.id ? `/trips?tripId=${activeItinerary.id}` : '/trips')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <span>Open your trip →</span>
            </button>
          </div>
        )}

        {/* Community Source Trip Loading State */}
        {isAdapting && isLoadingSourceTrip && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-2 text-xs text-slate-500 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500" />
            <p>Loading original trip itinerary from community snapshot...</p>
          </div>
        )}

        {/* Community Source Trip Loading Error */}
        {isAdapting && sourceTripError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{sourceTripError}</span>
            </div>
            <button
              onClick={() => setSourceTripReloadKey((k) => k + 1)}
              className="px-3 py-1 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 flex items-center gap-1 text-xs shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Community Source Itinerary Preview & Adaptation Card */}
        {isAdapting && sourceHighlights.length > 0 && (
          <section className="p-6 rounded-2xl bg-white border border-orange-200/90 shadow-sm space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold uppercase tracking-wider">
                    {sourceTripData?.author || paramAuthor ? `From ${sourceTripData?.author || paramAuthor}'s trip` : 'Original itinerary'}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {sourceTripData?.title || (paramDestination ? `${paramDestination} Journey` : 'Community Journey')}
                  </span>
                </div>
                <h3 className="text-base font-serif-editorial font-bold text-slate-900">
                  Preview &amp; Select Stops to Adapt
                </h3>
              </div>
              <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 shrink-0">
                {sourceHighlights.filter((h) => h.keep).length} of {sourceHighlights.length} stops kept
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Keep the highlights you love from this {sourceTripData?.destination || paramDestination || 'getaway'}, remove stops you don&apos;t want, and DAIna will optimize the schedule and help you find suitable travel options:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {sourceHighlights.map((hl) => (
                <button
                  type="button"
                  key={hl.id}
                  role="checkbox"
                  aria-checked={hl.keep}
                  onClick={() => toggleHighlight(hl.id)}
                  className={`text-left p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-2.5 ${
                    hl.keep
                      ? 'bg-orange-50/40 border-orange-200 text-slate-900 shadow-2xs hover:border-orange-300'
                      : 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-75 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      hl.keep ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {hl.keep && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[10px] text-orange-600">Day {hl.day}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-500">
                          {hl.tag}
                        </span>
                        {hl.location && (
                          <span className="text-[10px] text-slate-400">· {hl.location}</span>
                        )}
                      </div>
                      <p className={`font-semibold ${hl.keep ? 'text-slate-800' : 'text-slate-400'}`}>
                        {hl.title}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      hl.keep ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {hl.keep ? 'Keep' : 'Omitted'}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
              <button
                type="button"
                onClick={() =>
                  setSourceHighlights((prev) =>
                    prev.map((h) => ({ ...h, keep: !prev.every((p) => p.keep) }))
                  )
                }
                className="text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer text-xs"
              >
                {sourceHighlights.every((h) => h.keep) ? 'Deselect all' : 'Select all stops'}
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleBuildPlan()}
                isLoading={isGenerating}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-4 py-1.5 rounded-xl cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Adapt with DAIna ({sourceHighlights.filter((h) => h.keep).length} stops)
              </Button>
            </div>
          </section>
        )}

        {/* Primary Conversational Input Card */}
        <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="trip-prompt" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {isAdapting ? 'Customize your adapted itinerary' : 'Tell DAIna about your trip'}
            </label>
            <span className="text-[11px] text-slate-500 font-medium">
              {activeItinerary ? 'Trip saved automatically' : 'Nothing to set up — just describe your trip'}
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBuildPlan();
            }}
            className="space-y-4"
          >
            <textarea
              id="trip-prompt"
              rows={3}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. I want to spend 7 days in Japan with my partner. Budget ₹1.5L. We love food, photography and quiet places. Leaving from Delhi."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white font-medium resize-none transition-colors"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchitect(true)}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium underline underline-offset-2 cursor-pointer"
                >
                  Help me refine details
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isGenerating}
                disabled={!promptText.trim() && !paramDestination}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors cursor-pointer text-xs"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {isGenerating ? 'Working out the best option…' : (isAdapting ? 'Adapt & create trip' : 'Create my trip')}
              </Button>
            </div>
          </form>

          {/* Conversational Ambiguity State — DAIna asks one focused question */}
          {promptText.trim().length > 3 && (!parsedIntent || !parsedIntent.destination) && !paramDestination && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  I can help with that. Where would you like to go?
                </span>
                <span className="text-[11px] text-amber-800 font-medium">Pick a destination to proceed</span>
              </div>
              <p className="text-xs text-amber-900">
                Tell me your preferred destination, or tap one of these spots matching your vibe:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(parsedIntent?.vibe === 'coastal' || /beach|sea|coast|sand/i.test(promptText)
                  ? [
                      { name: 'South Goa', vibe: 'Quiet beaches & cliffside cafes' },
                      { name: 'Gokarna', vibe: 'Serene coves & temples' },
                      { name: 'Andaman (Havelock)', vibe: 'Turquoise waters & coral reef' },
                      { name: 'Bali', vibe: 'Tropical villas & surf' },
                    ]
                  : /mountain|hill|trek|snow|cold/i.test(promptText)
                  ? [
                      { name: 'Manali', vibe: 'Pine chalets & Solang pass' },
                      { name: 'Dharamshala', vibe: 'Tea gardens & monastery peace' },
                      { name: 'Gulmarg', vibe: 'Alpine meadows & cable cars' },
                    ]
                  : [
                      { name: 'Kyoto, Japan', vibe: 'Historic temples & matcha culture' },
                      { name: 'Udaipur, Rajasthan', vibe: 'Lakeside palaces & heritage' },
                      { name: 'South Goa', vibe: 'Relaxed coastal escape' },
                      { name: 'Coorg', vibe: 'Coffee plantations & mist' },
                    ]
                ).map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      const newPrompt = promptText.trim() ? `${promptText.trim()} to ${item.name}` : `Trip to ${item.name}`;
                      setPromptText(newPrompt);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-amber-100/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3 text-orange-500" />
                    <span>{item.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({item.vibe})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversational Confirmation Card with Clean Traveler Summary */}
          {parsedIntent && (parsedIntent.destination || paramDestination) && (
            <div className="mt-4 p-4 rounded-xl bg-orange-50/70 border border-orange-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  Here&apos;s what I understood
                </span>
                <span className="text-[11px] text-orange-800 font-medium">Ready to create</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-800">
                <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                  📍 {parsedIntent.destination || paramDestination}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                  ⏱️ {parsedIntent.days_count 
                    ? `${parsedIntent.days_count} Days` 
                    : (paramDuration ? `${paramDuration} Days` : '4 Days (default recommendation)')}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                  👥 {parsedIntent.travellers} {parsedIntent.travellers === 1 ? 'traveler' : 'travelers'}
                  {parsedIntent.companionsSource !== 'prompt' && ' (default)'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                  💰 {(parsedIntent.budget > 0 || (paramBudget && parseInt(paramBudget, 10) > 0))
                    ? `₹${(parsedIntent.budget || parseInt(paramBudget || '0', 10)).toLocaleString('en-IN')}`
                    : 'Budget: Not specified'}
                </span>
                {parsedIntent.origin && (
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                    🛫 From {parsedIntent.origin}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                  ✨ {parsedIntent.vibe || paramVibe || 'Leisure & Scenic (default style)'}
                </span>
              </div>

              {/* Expandable Explanation for Traveler Understanding */}
              <div className="flex items-center justify-between pt-2 border-t border-orange-200/60 text-xs">
                <button
                  type="button"
                  onClick={() => setShowUnderstandingDetails(!showUnderstandingDetails)}
                  className="text-[11px] text-orange-800 hover:text-orange-950 font-medium underline cursor-pointer"
                >
                  {showUnderstandingDetails ? 'Hide details' : 'ⓘ How DAIna understood your request'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowArchitect(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    Edit details
                  </button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleBuildPlan()}
                    isLoading={isGenerating}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-4 py-1.5 cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    {isAdapting ? 'Adapt & create trip →' : 'Create my trip →'}
                  </Button>
                </div>
              </div>

              {showUnderstandingDetails && (
                <div className="p-3 rounded-lg bg-white/90 border border-orange-200 text-[11px] text-slate-700 space-y-1.5 animate-in fade-in">
                  <p>• <strong>Trip Duration:</strong> {parsedIntent.days_count ? `${parsedIntent.days_count} days (explicit in request)` : (paramDuration ? `${paramDuration} days` : '4 days (default recommendation — duration not specified)')}</p>
                  <p>• <strong>Travelers:</strong> {parsedIntent.travellers} ({parsedIntent.companionsSource === 'prompt' ? 'explicitly stated in your request' : 'default recommendation for a pair/couple'})</p>
                  <p>• <strong>Budget:</strong> {parsedIntent.budget > 0 ? `₹${parsedIntent.budget.toLocaleString('en-IN')} (explicitly provided)` : 'Not specified — DAIna will create a comfortable mid-range plan and estimate the cost.'}</p>
                  <p>• <strong>Trip Style &amp; Pacing:</strong> {parsedIntent.vibe || 'Leisure & Scenic'} ({parsedIntent.vibe ? 'customized based on your prompt' : 'default recommendation'})</p>
                </div>
              )}
            </div>
          )}

          {/* Calm, Human Loading Indicator Sequence */}
          {isGenerating && (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3 animate-in fade-in">
              <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Working out the best option…</p>
                <p className="text-xs text-slate-500">Checking your budget and route.</p>
              </div>
            </div>
          )}
        </section>

        {/* Quick Inspiration Prompts */}
        <section className="space-y-3">
          <span className="text-xs font-semibold text-slate-500 block">
            Or try an example getaway prompt:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              'I want a 7-day Japan trip under ₹1.5 lakh with my partner, quiet places and food',
              '4-day Manali cedarwood chalet escape under ₹40,000 for solo explorer',
              '3-day weekend escape to Coorg from Bengaluru with squad under ₹40k',
              '5-day Andaman white sands & scuba under ₹75,000',
            ].map((samplePrompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPromptText(samplePrompt);
                  document.getElementById('trip-prompt')?.focus();
                }}
                className="text-xs font-medium text-slate-700 hover:text-orange-600 bg-white hover:bg-orange-50/40 border border-slate-200 rounded-xl p-3 text-left transition-colors cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                ✦ {samplePrompt}
              </button>
            ))}
          </div>
        </section>

        {/* Active Generated Itinerary Preview */}
        {activeItinerary && (
          <section className="space-y-6 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase font-bold text-orange-600 tracking-wider">
                  Generated Itinerary
                </span>
                <h2 className="text-2xl font-serif-editorial font-bold text-slate-900">
                  {activeItinerary.title}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {activeItinerary.destination} · {activeItinerary.days.length} days · ₹{activeItinerary.budget.toLocaleString('en-IN')} estimated
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shrink-0 cursor-pointer shadow-xs"
                onClick={() => router.push(activeItinerary?.id ? `/trips?tripId=${activeItinerary.id}` : '/trips')}
              >
                <Luggage className="w-4 h-4 mr-1.5" />
                Open your trip →
              </Button>
            </div>

            <div className="space-y-4">
              {activeItinerary.days.map((day: any) => {
                const isExpanded = expandedDays[day.dayNumber] ?? (day.dayNumber === 1);
                return (
                  <div key={day.dayNumber} className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-2xs">
                    <div
                      onClick={() => setExpandedDays((prev) => ({ ...prev, [day.dayNumber]: !isExpanded }))}
                      className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Day {day.dayNumber}</span>
                        <h3 className="text-lg font-semibold text-slate-900">{day.title}</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {day.weather || 'Pleasant 🌤️'} · {day.activities?.length || 0} stops planned
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shrink-0">
                        {isExpanded ? 'Collapse' : 'Expand day'}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="p-5 pt-0 space-y-2.5 border-t border-slate-100">
                        {day.activities?.map((act: any, aIdx: number) => {
                          const tagLabel = act.placeType === 'H' ? 'Hotel' : act.placeType === 'R' ? 'Dining' : 'Activity';
                          return (
                            <div key={aIdx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
                              <div className="space-y-0.5">
                                <span className="font-mono text-[11px] font-semibold text-orange-600">{act.time}</span>
                                <p className="font-semibold text-slate-900">{act.description}</p>
                                <p className="text-[11px] text-slate-500">{act.location}</p>
                              </div>
                              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-medium shrink-0">
                                {tagLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <AITripArchitectModal
        isOpen={showArchitect}
        onClose={() => setShowArchitect(false)}
        destination={activeItinerary ? activeItinerary.destination : (promptText || 'Your Destination')}
        onComplete={(answers) => {
          const parts = [];
          if (answers.travelers) parts.push(`${answers.travelers}`);
          if (answers.food) parts.push(`food: ${answers.food}`);
          if (answers.walking) parts.push(`pace: ${answers.walking}`);
          if (answers.budget) parts.push(`budget: ${answers.budget}`);
          const prompt = parts.length > 0 ? parts.join(', ') : 'Refined getaway plan';
          handleBuildPlan(prompt);
        }}
      />

      <DAInaChatWidget />
      <BottomNav />
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold">Loading Getaway Planner...</div>}>
      <PlannerContent />
    </Suspense>
  );
}
