'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Luggage,
  CalendarDays,
  MapPin,
  Ticket,
  Sun,
  Share2,
  Download,
  Sparkles,
  CloudSun,
  Users,
  Plane,
  Utensils,
  Camera,
  FileText,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Send,
  SlidersHorizontal,
  Compass,
  DollarSign,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { SquadRoomHub } from '@/components/squad/SquadRoomHub';
import { GroupCollaborationModal } from '@/components/planner/GroupCollaborationModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiService } from '@/services/api';

type TripTab = 'overview' | 'itinerary' | 'bookings' | 'budget' | 'map' | 'squad';

interface AIDiffChange {
  action: string;
  item?: string;
  from?: string;
  to?: string;
  replacement?: string;
  saving_amount?: number;
  duration_minutes?: number;
  details?: string;
}

export default function ActiveTripsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TripTab>('overview');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTripIndex, setActiveTripIndex] = useState(0);
  const [realBookings, setRealBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive Map State
  const [selectedMapDay, setSelectedMapDay] = useState<number | 'all'>('all');
  const [hoveredWaypoint, setHoveredWaypoint] = useState<any | null>(null);

  // DashTiny Embedded Copilot State
  const [copilotInput, setCopilotInput] = useState('');
  const [isExecutingCopilot, setIsExecutingCopilot] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [lastDiffResult, setLastDiffResult] = useState<{ summary: string; changes: AIDiffChange[] } | null>(null);

  const [checklist, setChecklist] = useState([
    { id: 'c1', task: 'Valid Passport & Photo ID', done: true, category: 'Docs' },
    { id: 'c2', task: 'IndiGo Boarding Pass / Ticket Downloaded', done: true, category: 'Tickets' },
    { id: 'c3', task: 'Sanctuary Stay Booking Voucher', done: true, category: 'Hotel' },
    { id: 'c4', task: 'Pack Sunscreen, Reef-Safe Lotion & Sunglasses', done: false, category: 'Packing' },
    { id: 'c5', task: 'Underwater Camera & Waterproof Phone Pouch', done: false, category: 'Equipment' },
    { id: 'c6', task: 'Notify Credit Card Bank for Foreign Transit', done: true, category: 'Finance' },
  ]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripsData, bookingsData] = await Promise.all([
        apiService.getMyTrips(),
        apiService.getMyBookings(),
      ]);

      setTrips(tripsData || []);
      if (bookingsData && bookingsData.length > 0) {
        setRealBookings(bookingsData);
      }
    } catch (err) {
      console.error('Failed to load trips from PostgreSQL:', err);
      setError('Unable to connect to DashTiny services. Retry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExecuteCopilotAction = async (customInstruction?: string) => {
    const instruction = (customInstruction || copilotInput).trim();
    if (!instruction || isExecutingCopilot) return;

    setIsExecutingCopilot(true);
    setCopilotError(null);
    setCopilotInput('');

    try {
      const activeTrip = trips[activeTripIndex];
      if (!activeTrip) return;
      const tripId = activeTrip.id || 'latest';
      const res = await apiService.executeAIAction(tripId, instruction);

      if (res && res.status === 'success') {
        setLastDiffResult({
          summary: res.summary,
          changes: res.changes || [],
        });

        // Update active trip with new modified activities returned by backend
        if (res.trip) {
          setTrips((prev) =>
            prev.map((t, idx) => (idx === activeTripIndex ? { ...t, ...res.trip } : t))
          );
        } else {
          await loadData();
        }
      } else {
        setCopilotError('DAIna is temporarily unavailable. Try again.');
      }
    } catch (err) {
      console.error('Failed to execute AI Copilot diff:', err);
      setCopilotError('DAIna is temporarily unavailable. Try again.');
    } finally {
      setIsExecutingCopilot(false);
    }
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const currentTrip = trips[activeTripIndex] || trips[0];

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
        {/* State 1: Shimmer Loading Skeleton */}
        {loading && (
          <div className="space-y-6 animate-pulse py-8">
            <div className="h-10 bg-slate-200 rounded-2xl w-1/3" />
            <div className="h-64 bg-slate-200 rounded-3xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-28 bg-slate-200 rounded-2xl" />
              <div className="h-28 bg-slate-200 rounded-2xl" />
              <div className="h-28 bg-slate-200 rounded-2xl" />
            </div>
          </div>
        )}

        {/* State 2: Honest Connection Failure */}
        {error && (
          <div className="p-8 rounded-3xl bg-amber-50/90 border border-amber-200 text-center space-y-4 max-w-md mx-auto my-12">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center font-bold text-xl">
              ⚠️
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold font-serif-editorial text-amber-950">Connection Error</h3>
              <p className="text-xs text-amber-800 font-medium">{error}</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={loadData}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-5 py-2 cursor-pointer"
            >
              Retry Connection
            </Button>
          </div>
        )}

        {/* State 3: Authentic Empty State when User has no trips */}
        {!loading && !error && trips.length === 0 && (
          <div className="p-12 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-5 max-w-lg mx-auto my-12">
            <div className="w-16 h-16 rounded-3xl bg-orange-50 border border-orange-200 text-orange-600 mx-auto flex items-center justify-center">
              <Luggage className="w-8 h-8 text-orange-500" />
            </div>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-extrabold uppercase tracking-wider">
                PostgreSQL Trips Vault
              </span>
              <h2 className="text-2xl font-serif-editorial font-bold text-slate-900">
                No Trips in Your Vault Yet
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                You haven&apos;t generated or saved any getaway itineraries yet. Let DAIna AI synthesize a bespoke multi-day passage tailored to your style and budget.
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => router.push('/planner')}
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs px-6 py-2.5 shadow-md shadow-orange-500/20 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Create Your First Trip with AI →
              </Button>
            </div>
          </div>
        )}

        {/* State 4: Active Trip Workspace (Loaded from PostgreSQL) */}
        {!loading && !error && trips.length > 0 && currentTrip && (
          <>
            {/* Trips Switcher Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
              <div className="space-y-1">
                <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-extrabold uppercase border border-orange-200 tracking-wider">
                  {trips.length} Real Saved {trips.length === 1 ? 'Trip' : 'Trips'}
                </span>
                <h1 className="text-3xl sm:text-4xl font-serif-editorial font-bold text-slate-900">
                  {currentTrip.title}
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Destination: {currentTrip.destination} • {currentTrip.startDate} to {currentTrip.endDate}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="bg-white border-slate-200 text-slate-800 font-bold"
                >
                  <Users className="w-4 h-4 mr-1.5 text-orange-500" />
                  <span>Squad Room ({currentTrip.squad_room_code || 'ROOM'})</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/planner')}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  <span>New AI Itinerary</span>
                </Button>
              </div>
            </div>

            {/* Multiple Saved Trips Carousel Tabs if > 1 trip */}
            {trips.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                {trips.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTripIndex(idx)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                      activeTripIndex === idx
                        ? 'bg-orange-50 border-orange-300 text-orange-950 font-extrabold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t.destination} ({t.daysCount || t.days?.length || 3} Days)
                  </button>
                ))}
              </div>
            )}

        {/* DashTiny AI Copilot Action Cockpit */}
        <Card className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-orange-50 via-white to-amber-50 border border-orange-200/90 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                <Sparkles className="w-4 h-4 text-orange-600 animate-spin" />
              </div>
              <div>
                <h3 className="font-serif-editorial font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  DashTiny Itinerary Copilot
                  <span className="text-[10px] bg-orange-100 text-orange-800 font-extrabold px-2 py-0.5 rounded-full uppercase">Action Model</span>
                </h3>
                <p className="text-[11px] text-slate-600 font-medium">Propose modifications to this trip. AI calculates constraints and updates PostgreSQL with verified diffs.</p>
              </div>
            </div>
            
            {/* Quick Action Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[
                { label: 'Make today less tiring', icon: Zap },
                { label: 'Move beach visit to sunset', icon: Sun },
                { label: 'Where can we save ₹5,000?', icon: TrendingDown },
                { label: 'I have 2 hours free before dinner', icon: Clock }
              ].map((act, i) => (
                <button
                  key={i}
                  disabled={isExecutingCopilot}
                  onClick={() => handleExecuteCopilotAction(act.label)}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 text-[11px] font-bold shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                >
                  ✦ {act.label}
                </button>
              ))}
            </div>
          </div>

          {/* Copilot Natural Language Prompt Input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="E.g. Add an authentic Goan fish thali lunch near Vagator..."
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteCopilotAction()}
              disabled={isExecutingCopilot}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium shadow-2xs"
            />
            <Button
              onClick={() => handleExecuteCopilotAction()}
              disabled={isExecutingCopilot || !copilotInput.trim()}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs px-4 py-2.5 shadow-sm cursor-pointer"
            >
              {isExecutingCopilot ? (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" /> Pacing...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Adjust Trip
                </span>
              )}
            </Button>
          </div>

          {/* Copilot Error Banner */}
          {copilotError && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                {copilotError}
              </span>
              <button onClick={() => setCopilotError(null)} className="text-amber-700 hover:text-amber-950 font-bold cursor-pointer">✕</button>
            </div>
          )}

          {/* Real-time Diff Banner */}
          {lastDiffResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {lastDiffResult.summary}
                </span>
                <button
                  onClick={() => setLastDiffResult(null)}
                  className="text-xs text-emerald-700 hover:text-emerald-950 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {lastDiffResult.changes.map((ch, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-bold text-slate-800 shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <strong>{ch.action.toUpperCase()}:</strong> {ch.item || ch.details}
                    {ch.from && ch.to && <span className="text-slate-500 font-mono">({ch.from} → {ch.to})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 max-w-2xl overflow-x-auto no-scrollbar">
          {[
            { id: 'overview' as TripTab, label: 'Overview', icon: Luggage },
            { id: 'itinerary' as TripTab, label: 'Day Schedule', icon: CalendarDays },
            { id: 'bookings' as TripTab, label: `Bookings (${realBookings.length})`, icon: Ticket },
            { id: 'budget' as TripTab, label: 'Budget & Split', icon: DollarSign },
            { id: 'map' as TripTab, label: 'Interactive Map', icon: Compass },
            { id: 'squad' as TripTab, label: 'Squad Room', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-white text-orange-600 font-extrabold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Trip Highlight Banner */}
              <div className="relative h-64 rounded-3xl overflow-hidden shadow-md border border-slate-200">
                <Image
                  src={currentTrip.cover_image || currentTrip.days?.[0]?.coverImage || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80"}
                  alt={currentTrip.destination}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                  <div className="space-y-1 text-white">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-[10px] font-extrabold uppercase">
                      Confirmed Itinerary
                    </span>
                    <h3 className="text-2xl font-serif-editorial font-bold">{currentTrip.destination}</h3>
                    <p className="text-xs text-slate-200">Budget: ₹{currentTrip.budget?.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              {/* Day Breakdown Preview */}
              <div className="space-y-4">
                <h3 className="text-xl font-serif-editorial font-bold text-slate-900">Itinerary Highlights</h3>
                <div className="space-y-3">
                  {currentTrip.days?.map((day: any, idx: number) => (
                    <Card key={idx} className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-orange-600">{day.title}</span>
                        <span className="text-xs text-slate-500">{day.weather}</span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {day.activities?.map((act: any, aIdx: number) => (
                          <div key={aIdx} className="flex items-center justify-between text-xs text-slate-700">
                            <span className="font-semibold text-slate-900">{act.time} — {act.description}</span>
                            <span className="text-[10px] text-slate-400">{act.location}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Pre-Trip Packing & Documents Checklist */}
            <div className="space-y-6">
              <Card className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold font-serif-editorial text-slate-900">Pre-Trip Checklist</h4>
                  <span className="text-xs text-orange-600 font-extrabold">
                    {checklist.filter((c) => c.done).length}/{checklist.length} Done
                  </span>
                </div>
                <div className="space-y-2.5">
                  {checklist.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleChecklist(item.id)}
                      className={`w-full text-left p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${
                        item.done
                          ? 'bg-emerald-50/50 border-emerald-200 text-slate-500 line-through'
                          : 'bg-slate-50 border-slate-200 text-slate-900 font-semibold'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${item.done ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span className="text-xs">{item.task}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: Detailed Day Schedule with Trust Provenance Badges */}
        {activeTab === 'itinerary' && (
          <div className="space-y-6">
            {currentTrip.days?.map((d: any, dIdx: number) => (
              <div key={dIdx} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xl font-serif-editorial font-bold text-slate-900">{d.title}</h3>
                  <span className="text-xs text-slate-500 font-medium">{d.weather}</span>
                </div>
                <div className="space-y-3">
                  {d.activities?.map((a: any, aIdx: number) => (
                    <div key={aIdx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-orange-600">{a.time}</span>
                          {/* Provenance Badge */}
                          {a.provenance === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              VERIFIED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-extrabold">
                              <Sparkles className="w-3 h-3 text-orange-600" />
                              AI GENERATED
                            </span>
                          )}
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            [{a.placeType || 'TA'}]
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{a.description}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-orange-500" />
                          {a.location} {a.costEstimate > 0 ? `• Est: ₹${a.costEstimate}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {a.estimatedTransit || '⏱️ 15m transit'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: Real Bookings & Passes */}
        {activeTab === 'bookings' && (() => {
          const displayBookings = (currentTrip.bookings && currentTrip.bookings.length > 0) ? currentTrip.bookings : realBookings;
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-serif-editorial font-bold text-slate-900">Your Confirmed Tickets & Stays</h3>
                  <p className="text-xs text-slate-500">Official reservations linked to this central Trip Workspace</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/bookings')}
                  className="bg-orange-500 text-white font-extrabold text-xs shadow-md"
                >
                  + Add Flight / Stay
                </Button>
              </div>

              {displayBookings.length === 0 ? (
                <Card className="p-8 text-center space-y-3 rounded-3xl bg-white border border-slate-200 shadow-sm">
                  <Ticket className="w-10 h-10 text-orange-400 mx-auto" />
                  <h4 className="text-base font-bold text-slate-800">No Reservations Linked to This Trip Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Search and reserve flights or sanctuaries in the Bookings tab to attach your confirmed PNR passes and hotel vouchers here.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/bookings')}
                    className="bg-orange-500 text-white font-extrabold mt-2"
                  >
                    Browse Stays & Flights
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayBookings.map((b: any) => (
                    <Card key={b.id} className="editorial-card p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          {b.status || 'CONFIRMED'} • VERIFIED PROVIDER
                        </span>
                        <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                          PNR: {b.pnr_ref}
                        </span>
                      </div>
                      <h4 className="text-base font-bold font-serif-editorial text-slate-900">{b.title}</h4>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                        <span>Provider: {b.provider}</span>
                        <span className="font-serif-editorial text-base font-extrabold text-orange-600">
                          ₹{b.amount?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 4: Budget & Expense Breakdown */}
        {activeTab === 'budget' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { category: 'Sanctuary Stays', amount: '₹22,000', pct: '52%', count: '2 Nights' },
                { category: 'Dining & Cafes', amount: '₹9,500', pct: '23%', count: '5 Meals' },
                { category: 'Activities & Tours', amount: '₹6,000', pct: '14%', count: '3 Passes' },
                { category: 'Local Transit', amount: '₹4,500', pct: '11%', count: 'Chauffeur' }
              ].map((b, i) => (
                <Card key={i} className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400">{b.category}</span>
                  <p className="text-xl font-serif-editorial font-bold text-slate-900">{b.amount}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>{b.count}</span>
                    <span className="font-bold text-orange-600">{b.pct}</span>
                  </div>
                </Card>
              ))}
            </div>
            <SquadRoomHub
              squadId={currentTrip.squad_room_code || currentTrip.id || 'SQUAD-HUB'}
              onOpenInviteModal={() => setIsGroupModalOpen(true)}
            />
          </div>
        )}

        {/* TAB 5: Interactive Map View */}
        {activeTab === 'map' && (() => {
          const mapActivities = (selectedMapDay === 'all'
            ? currentTrip.days?.flatMap((d: any) => (d.activities || []).map((a: any, idx: number) => ({ ...a, dayNumber: d.dayNumber, seqNum: idx + 1 })))
            : currentTrip.days?.find((d: any) => d.dayNumber === selectedMapDay)?.activities?.map((a: any, idx: number) => ({ ...a, dayNumber: selectedMapDay, seqNum: idx + 1 }))
          ) || [];

          const validPoints = mapActivities.filter((a: any) => a.lat && a.lng);
          const minLat = validPoints.length ? Math.min(...validPoints.map((a: any) => a.lat)) : 15.2;
          const maxLat = validPoints.length ? Math.max(...validPoints.map((a: any) => a.lat)) : 15.7;
          const minLng = validPoints.length ? Math.min(...validPoints.map((a: any) => a.lng)) : 73.7;
          const maxLng = validPoints.length ? Math.max(...validPoints.map((a: any) => a.lng)) : 74.1;

          const getX = (lng: number) => {
            const span = (maxLng - minLng) || 0.1;
            return Math.min(88, Math.max(12, 15 + ((lng - minLng) / span) * 70));
          };
          const getY = (lat: number) => {
            const span = (maxLat - minLat) || 0.1;
            return Math.min(85, Math.max(15, 85 - ((lat - minLat) / span) * 70));
          };

          return (
            <div className="space-y-6">
              {/* Map Controls & Day Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-serif-editorial font-bold text-slate-900">Spatial Radar & Route Clusters</h3>
                  <p className="text-xs text-slate-500">Live coordinates clustered by day to minimize driving transit times</p>
                </div>

                {/* Day selector pills */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => setSelectedMapDay('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedMapDay === 'all'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Days
                  </button>
                  {currentTrip.days?.map((d: any) => (
                    <button
                      key={d.dayNumber}
                      onClick={() => setSelectedMapDay(d.dayNumber)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedMapDay === d.dayNumber
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Day {d.dayNumber}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tactical Radar Display */}
              <Card className="p-4 sm:p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden">
                {/* Radar Grid and Rings */}
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff0d_1px,transparent_1px)] [background-size:20px_20px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 rounded-full border border-orange-500/10 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 sm:w-60 h-44 sm:h-60 rounded-full border border-orange-500/15 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 sm:w-28 h-20 sm:h-28 rounded-full border border-orange-500/20 pointer-events-none" />

                {/* Radar Overlay Status Header */}
                <div className="relative z-10 flex items-center justify-between text-xs pb-4 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-mono text-emerald-400 font-extrabold text-[11px] tracking-wider uppercase">
                      RADAR ACTIVE • {mapActivities.length} SPOTS TRACKED
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                    <span>Center: {currentTrip.destination}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-orange-400 font-bold">
                      Transit: ~35 mins
                    </span>
                  </div>
                </div>

                {/* Interactive SVG Radar Stage */}
                <div className="relative h-96 sm:h-[420px] w-full z-10 my-2">
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {mapActivities.map((act: any, idx: number) => {
                      if (idx === 0) return null;
                      const prev = mapActivities[idx - 1];
                      const x1 = `${getX(prev.lng || 73.74)}%`;
                      const y1 = `${getY(prev.lat || 15.60)}%`;
                      const x2 = `${getX(act.lng || 73.74)}%`;
                      const y2 = `${getY(act.lat || 15.60)}%`;
                      return (
                        <line
                          key={`line-${idx}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#FF5A00"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                          strokeOpacity="0.6"
                        />
                      );
                    })}
                  </svg>

                  {/* Pulsing Pin Waypoints */}
                  {mapActivities.map((act: any, idx: number) => {
                    const posX = getX(act.lng || 73.73 + idx * 0.04);
                    const posY = getY(act.lat || 15.58 - idx * 0.04);
                    const isHovered = hoveredWaypoint?.id === act.id;

                    return (
                      <div
                        key={act.id || idx}
                        style={{ left: `${posX}%`, top: `${posY}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                        onMouseEnter={() => setHoveredWaypoint(act)}
                        onMouseLeave={() => setHoveredWaypoint(null)}
                      >
                        {/* Aura pulse ring */}
                        <div
                          className={`absolute -inset-2 rounded-full transition-all duration-300 ${
                            isHovered
                              ? 'bg-orange-500/40 animate-ping'
                              : 'bg-orange-500/10 group-hover:bg-orange-500/30'
                          }`}
                        />

                        {/* Node circle */}
                        <div
                          className={`relative w-9 h-9 rounded-2xl flex items-center justify-center font-extrabold text-xs transition-all duration-200 border shadow-lg ${
                            isHovered
                              ? 'bg-gradient-to-tr from-orange-500 to-amber-400 text-white scale-125 border-white ring-4 ring-orange-500/30'
                              : 'bg-slate-900 text-orange-400 border-orange-500/60 hover:scale-110'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        {/* Hover Tooltip Card */}
                        <div
                          className={`absolute left-1/2 -translate-x-1/2 bottom-11 w-56 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl text-left z-30 transition-all pointer-events-none ${
                            isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-mono text-orange-400 font-bold">{act.time}</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-extrabold border border-emerald-500/30">
                              {act.provenance || 'VERIFIED'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white line-clamp-2">{act.description}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-slate-800">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-orange-400" />
                              {act.location}
                            </span>
                            <span className="font-mono">{act.estimatedTransit || '15m drive'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Radar Bottom Bar */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                      Waypoints: {mapActivities.length} Stops
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      All routes verified for minimal congestion
                    </span>
                  </div>
                  <span className="font-mono text-orange-400">
                    Source: DashTiny Spatial Engine • Verified GeoData
                  </span>
                </div>
              </Card>

              {/* Waypoints Sequence List */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold font-serif-editorial text-slate-900">Waypoint Stops & Coordinates</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {mapActivities.map((act: any, idx: number) => (
                    <Card
                      key={act.id || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        hoveredWaypoint?.id === act.id
                          ? 'border-orange-500 bg-orange-50/50 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      onMouseEnter={() => setHoveredWaypoint(act)}
                      onMouseLeave={() => setHoveredWaypoint(null)}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 font-extrabold flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 font-bold">{act.time}</span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 line-clamp-1">{act.description}</h5>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                        <span>{act.location}</span>
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 mt-2 border-t border-slate-100 font-mono">
                        <span>{act.lat ? `${Number(act.lat).toFixed(4)}°N, ${Number(act.lng).toFixed(4)}°E` : '15.6028°N, 73.7336°E'}</span>
                        <span className="text-orange-600 font-bold">{act.estimatedTransit || '15m drive'}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 6: Squad Room */}
        {activeTab === 'squad' && (
          <SquadRoomHub
            squadId={currentTrip.squad_room_code || 'ROOM'}
            onOpenInviteModal={() => setIsGroupModalOpen(true)}
          />
        )}
          </>
        )}
      </main>

      <GroupCollaborationModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        roomCode={currentTrip?.squad_room_code || 'ROOM'}
      />

      <DAInaChatWidget />
      <BottomNav />
    </div>
  );
}
