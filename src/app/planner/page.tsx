'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { MapPin, Map, Award, BrainCircuit, Upload, Sparkles, CheckCircle2, Luggage, ArrowRight, AlertTriangle, RefreshCw } from 'lucide-react';
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
  const { currentItinerary, setCurrentItinerary, addItinerary } = usePlannerStore();
  const { isAuthenticated } = useAuthStore();
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>('solo');
  const [showMapView, setShowMapView] = useState(false);
  const [showArchitect, setShowArchitect] = useState(false);
  const [promptText, setPromptText] = useState(initialQuery);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or fetch latest itinerary from PostgreSQL
  useEffect(() => {
    async function loadLatest() {
      if (initialQuery) {
        setPromptText(initialQuery);
        // Do not auto-generate on load; user sees "Here's what I understood" and clicks Create my trip
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
  }, [initialQuery]);

  const handleBuildPlan = async (queryText?: string) => {
    const textToUse = queryText || promptText;
    if (!textToUse.trim()) return;

    setIsGenerating(true);
    setSaveSuccessMsg(null);
    setErrorMsg(null);

    // Real natural language request parsing
    const parsed = parseTravelPrompt(textToUse);

    // Synchronize persona: if prompt specifies companions or persona, prioritize it and sync UI
    const hasExplicitPersonaInPrompt = /(solo|alone|partner|couple|romantic|wife|husband|girlfriend|boyfriend|family|kids|children|parents|squad|friends|gang|buddies|nomad|workation)/i.test(textToUse);
    const effectivePersona = hasExplicitPersonaInPrompt ? parsed.persona : (selectedPersona || parsed.persona);
    if (hasExplicitPersonaInPrompt && parsed.persona) {
      setSelectedPersona(parsed.persona as PersonaType);
    }

    try {
      const res = await apiService.generateItinerary({
        destination: parsed.destination,
        origin: parsed.origin,
        start_date: parsed.start_date,
        end_date: parsed.end_date,
        days_count: parsed.days_count,
        travellers: parsed.travellers,
        budget: parsed.budget,
        currency: parsed.currency || 'INR',
        persona: effectivePersona,
        vibe: parsed.vibe,
        interests: parsed.interests,
        raw_prompt: textToUse,
        prompt: textToUse,
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
        setSaveSuccessMsg(`✦ Itinerary saved to your Trip Workspace! Room Code: ${res.squad_room_code}`);
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
            <span>AI Travel Planner</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif-editorial font-bold text-slate-900 tracking-tight">
            Plan a trip
          </h1>
          <p className="text-slate-600 text-sm">
            Tell DAIna what you're looking for. We'll build a personalized day-by-day plan with stays, dining, and activities.
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
              <span>Open in Trip Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Primary Conversational Input Card */}
        <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="trip-prompt" className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Tell DAIna about your trip
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
                disabled={!promptText.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors cursor-pointer text-xs"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {isGenerating ? 'Building your trip...' : 'Create my trip'}
              </Button>
            </div>
          </form>

          {/* Conversational Confirmation Card */}
          {parsedIntent && parsedIntent.destination && (
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
                  📍 {parsedIntent.destination}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                  ⏱️ {parsedIntent.days_count} Days
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                  👥 {parsedIntent.travellers} {parsedIntent.travellers === 1 ? 'traveler' : 'travelers'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                  💰 ₹{parsedIntent.budget.toLocaleString('en-IN')}
                </span>
                {parsedIntent.origin && (
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                    🛫 From {parsedIntent.origin}
                  </span>
                )}
                {parsedIntent.vibe && (
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-2xs">
                    ✨ {parsedIntent.vibe}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-orange-200/60">
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
                  Create my trip →
                </Button>
              </div>
            </div>
          )}

          {/* Calm, Human Loading Indicator Sequence */}
          {isGenerating && (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3 animate-in fade-in">
              <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Generating your trip with DAIna...</p>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <p>• Finding the best flow for your budget</p>
                  <p>• Checking travel context and local pacing</p>
                  <p>• Balancing your food, photography and culture interests</p>
                </div>
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
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shrink-0 cursor-pointer"
                onClick={() => router.push(activeItinerary?.id ? `/trips?tripId=${activeItinerary.id}` : '/trips')}
              >
                <Luggage className="w-4 h-4 mr-1.5" />
                Manage in Trip Workspace →
              </Button>
            </div>

            <div className="space-y-4">
              {activeItinerary.days.map((day: any) => (
                <div key={day.dayNumber} className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">Day {day.dayNumber}</span>
                      <h3 className="text-lg font-semibold text-slate-900">{day.title}</h3>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">{day.weather || 'Pleasant 🌤️'}</span>
                  </div>

                  <div className="space-y-2.5">
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
                </div>
              ))}
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
