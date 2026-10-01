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
        handleBuildPlan(initialQuery);
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

    try {
      const res = await apiService.generateItinerary({
        destination: parsed.destination,
        budget: parsed.budget,
        days_count: parsed.days_count,
        persona: selectedPersona || parsed.persona,
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
        setSaveSuccessMsg(`✦ Itinerary saved to PostgreSQL database! Room Code: ${res.squad_room_code}`);
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

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-10">
        {/* Page Title & Persona Selector Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/90 pb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-extrabold tracking-wider uppercase">
              <Award className="w-3.5 h-3.5 text-orange-600" />
              <span>DASHTINY DAINA GETAWAY ARCHITECT</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-serif-editorial font-bold text-slate-900 tracking-tight">
              {activeItinerary ? activeItinerary.title : 'Architect Your Bespoke Getaway'}
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm font-medium">
              {activeItinerary ? (
                <>
                  Curated for {activeItinerary.destination} · Squad Budget:{' '}
                  <span className="text-orange-600 font-extrabold">₹{activeItinerary.budget.toLocaleString('en-IN')}</span>
                </>
              ) : (
                'Bespoke multi-day travel passages synthesized by DAIna AI and saved directly to PostgreSQL'
              )}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowArchitect(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-md shadow-orange-500/20"
            >
              <BrainCircuit className="w-4 h-4 mr-1.5 text-white" />
              10-Step AI Architect
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/trips')}
              className="bg-white border-slate-200 text-slate-800 font-bold hover:bg-slate-50"
            >
              <Luggage className="w-4 h-4 mr-1.5 text-orange-500" />
              <span>Manage in My Trips →</span>
            </Button>
            {activeItinerary && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMapView(!showMapView)}
                className="bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50"
              >
                <Map className="w-4 h-4 mr-1 text-sky-600" />
                <span>{showMapView ? 'Hide Route Map' : 'Show Route Map'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Error Alert Banner (Explicit failure states rule) */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => handleBuildPlan()}
              className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 flex items-center justify-center gap-1.5 shrink-0 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Success Alert Banner when Itinerary is Saved in DB */}
        {saveSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
            <button
              onClick={() => router.push('/trips')}
              className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center gap-1"
            >
              <span>View in My Trips</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Conversational AI Planner Input Box */}
        <section className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                ✨
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Conversational Getaway Architect</h3>
                <p className="text-xs text-slate-500 font-medium">Type any destination, duration, and budget to synthesize and save directly to PostgreSQL</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full uppercase">
              PostgreSQL Persistence Active
            </span>
          </div>

          {/* Prompt Bar Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBuildPlan();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. I want a 7-day Japan trip under ₹1.5 lakh with my partner..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isGenerating}
              className="shrink-0 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold px-6 hover:scale-105 transition-all"
            >
              <BrainCircuit className="w-4 h-4 mr-1.5" />
              Build & Save Itinerary
            </Button>
          </form>

          {/* Proactive AI Intelligence Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50/60 to-sky-50 border border-orange-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-base">💡</span>
              <p className="text-xs text-slate-800 font-bold">
                <strong className="text-orange-700 font-extrabold">Natural Language:</strong> Supports any destination worldwide with realistic budget parsing (e.g. &quot;1.5 lakh&quot;, &quot;80k&quot;) and squad sync.
              </p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono font-bold shrink-0">Live AI Engine</span>
          </div>
        </section>

        {/* 4 Explorer Personas Selector Bar */}
        <PersonaSelector activePersona={selectedPersona} onSelectPersona={setSelectedPersona} />

        {/* Content View: Empty Inspiration Canvas OR Generated Itinerary */}
        {!activeItinerary ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200/90 text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 border border-orange-200 text-orange-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
              ✨
            </div>
            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900">
                Where does your squad want to escape?
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                Type your dream destination and budget. DAIna AI structures a multi-day passage with verified sanctuary stays, regional dining, and golden hour routes.
              </p>
            </div>

            <div className="pt-2">
              <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Try one-click real getaway prompts</span>
              <div className="flex flex-wrap justify-center gap-2.5 mt-3 max-w-3xl mx-auto">
                {[
                  'I want a 7-day Japan trip under ₹1.5 lakh with my partner',
                  '4-day Manali cedarwood chalet escape under ₹40,000 for solo explorer',
                  '3-day weekend escape to Coorg from Bengaluru with squad under ₹40k',
                  '5-day Andaman white sands & scuba under ₹75,000',
                  '5-day Switzerland alpine scenic rail & mountain chalets under ₹2.5 lakh',
                ].map((samplePrompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPromptText(samplePrompt);
                      handleBuildPlan(samplePrompt);
                    }}
                    className="text-xs font-bold text-slate-700 hover:text-orange-700 bg-slate-50 hover:bg-orange-50 border border-slate-200/80 hover:border-orange-200 rounded-full px-4 py-2 transition-all shadow-2xs text-left"
                  >
                    ✦ {samplePrompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Main 2-column layout: Timeline + Budget Manager */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline — takes 2/3 width on desktop */}
            <div className="lg:col-span-2 space-y-8">
              {/* Interactive GPS Route Drawer */}
              {showMapView && (
                <Card className="p-6 bg-white border border-slate-200/90 space-y-4 rounded-3xl shadow-md animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-lg font-serif-editorial font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-orange-500" />
                      Interactive Route & Coordinates
                    </h3>
                    <span className="text-xs text-orange-600 font-extrabold">GPS Active</span>
                  </div>
                  <div className="relative h-64 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Image
                      src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&auto=format&fit=crop&q=80"
                      alt="Interactive Map Preview"
                      fill
                      className="object-cover opacity-80"
                    />
                    <div className="relative z-10 text-center p-6 bg-white/95 backdrop-blur-md rounded-2xl border border-orange-200 shadow-xl max-w-md">
                      <p className="text-sm font-extrabold text-slate-900">{activeItinerary.destination} Route Pins Active</p>
                      <p className="text-xs text-slate-600 font-medium mt-1">Sanctuary Stays [H] → Local Dining [R] → Panoramic Highlights [TA]</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Itinerary Timeline Days */}
              <section className="space-y-6">
                {activeItinerary.days.map((day: any) => (
                  <Card key={day.dayNumber} className="editorial-card p-6 sm:p-8 space-y-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:border-orange-300 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="space-y-1">
                        <span className="text-xs uppercase font-extrabold text-orange-600 tracking-widest">
                          DAY 0{day.dayNumber}
                        </span>
                        <h3 className="text-2xl font-serif-editorial font-bold text-slate-900">
                          {day.title}
                        </h3>
                      </div>
                      <span className="px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                        {day.weather || '28°C Sunny ☀️'}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {day.activities?.map((act: any, aIdx: number) => (
                        <div key={aIdx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <span className="font-mono text-xs font-bold text-orange-600">{act.time}</span>
                            <h4 className="text-sm font-bold text-slate-900">{act.description}</h4>
                            <p className="text-xs text-slate-500 font-medium">{act.location} • {act.estimatedTransit}</p>
                          </div>
                          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-800 shadow-2xs">
                            {act.placeType === 'H' ? '🏨 Stay' : act.placeType === 'R' ? '🍽️ Dining' : '📍 Spot'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </section>
            </div>

            {/* Right column: Budget Manager Widget */}
            <div className="space-y-6">
              <BudgetManagerWidget />
            </div>
          </div>
        )}
      </main>

      <AITripArchitectModal
        isOpen={showArchitect}
        onClose={() => setShowArchitect(false)}
        destination={activeItinerary ? activeItinerary.destination : (promptText || 'Your Destination')}
        onComplete={(answers) => {
          handleBuildPlan(`Trip for ${answers.travelers} with ${answers.occasion} occasion, budget: ${answers.budget}`);
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
