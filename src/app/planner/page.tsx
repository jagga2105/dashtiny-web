'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { MapPin, Map, Award, BrainCircuit, Upload, Sparkles, CheckCircle2, Luggage, ArrowRight } from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { GroupCollaborationModal } from '@/components/planner/GroupCollaborationModal';
import { AITripArchitectModal } from '@/components/planner/AITripArchitectModal';
import { BudgetManagerWidget } from '@/components/ui/BudgetManagerWidget';
import { PersonaSelector, PersonaType } from '@/components/ui/PersonaSelector';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { usePlannerStore } from '@/store/usePlannerStore';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

function PlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('query') || '';
  const { currentItinerary, setCurrentItinerary, addItinerary } = usePlannerStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>('solo');
  const [showMapView, setShowMapView] = useState(false);
  const [showArchitect, setShowArchitect] = useState(false);
  const [promptText, setPromptText] = useState(initialQuery);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Initialize or fetch latest itinerary from PostgreSQL
  useEffect(() => {
    async function loadLatest() {
      if (initialQuery) {
        setPromptText(initialQuery);
        handleBuildPlan(initialQuery);
      } else {
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
      }
    }
    loadLatest();
  }, [initialQuery]);

  const handleBuildPlan = async (queryText?: string) => {
    const textToUse = queryText || promptText;
    if (!textToUse.trim()) return;

    setIsGenerating(true);
    setSaveSuccessMsg(null);

    // Extract destination name
    let dest = 'Goa, India';
    if (textToUse.toLowerCase().includes('manali')) dest = 'Manali, Himachal Pradesh';
    else if (textToUse.toLowerCase().includes('andaman') || textToUse.toLowerCase().includes('havelock')) dest = 'Havelock Island, Andamans';
    else if (textToUse.toLowerCase().includes('coorg')) dest = 'Coorg, Karnataka';
    else if (textToUse.toLowerCase().includes('kyoto')) dest = 'Kyoto, Japan';
    else if (textToUse.toLowerCase().includes('jaipur')) dest = 'Jaipur, Rajasthan';

    let daysCount = 4;
    const match = textToUse.match(/(\d+)\s*(?:day|days)/i);
    if (match) daysCount = parseInt(match[1], 10);

    try {
      const res = await apiService.generateItinerary({
        destination: dest,
        budget: 35000 * (Math.floor(daysCount / 2) || 1),
        days_count: daysCount,
        persona: selectedPersona,
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
    } finally {
      setIsGenerating(false);
    }
  };

  const activeItinerary = currentItinerary || {
    id: 'it_default',
    title: 'Custom Luxury Passage to Goa & Heritage Coast',
    destination: 'Goa, India',
    startDate: '2026-10-16',
    endDate: '2026-10-19',
    budget: 45000,
    days: [
      {
        dayNumber: 1,
        title: 'Day 1: Arrival & Golden Hour Beach Lounge',
        weather: '28°C Sunny ☀️',
        activities: [
          { time: '10:00 AM', description: 'Private Check-in at Boutique Ocean Villa', location: 'Calangute, North Goa', placeType: 'H' as const, estimatedTransit: '⏱️ 45 min drive from airport', crowdWarning: '🟢 Low Crowd' },
          { time: '01:30 PM', description: 'Fresh Local Curry & Seafood Tasting', location: 'Anjuna Beach', placeType: 'R' as const, estimatedTransit: '⏱️ 15 min drive', crowdWarning: '🟡 Moderate Crowd' },
          { time: '05:30 PM', description: 'Golden Hour Sunset Photography at Chapora Fort', location: 'Chapora Fort', placeType: 'TA' as const, estimatedTransit: '⏱️ 10 min drive', crowdWarning: '🔥 Peak Sunset Crowd (5:00 PM - 6:30 PM)' },
        ],
      },
    ],
  };

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
              {activeItinerary.title}
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm font-medium">
              Curated for {activeItinerary.destination} · Squad Budget: <span className="text-orange-600 font-extrabold">₹{activeItinerary.budget.toLocaleString('en-IN')}</span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMapView(!showMapView)}
              className="bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50"
            >
              <Map className="w-4 h-4 mr-1 text-sky-600" />
              <span>{showMapView ? 'Hide Route Map' : 'Show Route Map'}</span>
            </Button>
          </div>
        </div>

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
                <p className="text-xs text-slate-500 font-medium">Type your destination or budget to architect and save a real multi-day itinerary</p>
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
              placeholder="e.g. 3 days in Goa with beach sunset dining & private scuba..."
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
                <strong className="text-orange-700 font-extrabold">Pro Tip:</strong> Mid-week departures save up to 24% on luxury villas. Generated plans automatically split costs in your Squad Room.
              </p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono font-bold shrink-0">Live Algorithm</span>
          </div>
        </section>

        {/* 4 Explorer Personas Selector Bar */}
        <PersonaSelector activePersona={selectedPersona} onSelectPersona={setSelectedPersona} />

        {/* Main 2-column layout: Timeline + Budget Manager */}
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
                    <p className="text-sm font-extrabold text-slate-900">Live Destination Pins Active</p>
                    <p className="text-xs text-slate-600 font-medium mt-1">Ocean Villas [H] → Beach Shacks [R] → Cliffside Sunset [TA]</p>
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
      </main>

      <AITripArchitectModal
        isOpen={showArchitect}
        onClose={() => setShowArchitect(false)}
        destination={activeItinerary.destination}
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
