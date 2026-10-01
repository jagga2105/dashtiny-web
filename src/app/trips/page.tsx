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
  Sparkles,
  Users,
  Plane,
  Utensils,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Send,
  Compass,
  DollarSign,
  TrendingDown,
  Layers,
  Trash2,
  RefreshCw,
  MoveHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { SquadRoomHub } from '@/components/squad/SquadRoomHub';
import { GroupCollaborationModal } from '@/components/planner/GroupCollaborationModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiService } from '@/services/api';

type TripTab = 'itinerary' | 'overview' | 'map' | 'bookings' | 'budget' | 'squad';

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
  const [activeTab, setActiveTab] = useState<TripTab>('itinerary');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTripIndex, setActiveTripIndex] = useState(0);
  const [realBookings, setRealBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Day filter for Itinerary & Interactive Map
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | 'all'>('all');
  const [hoveredWaypoint, setHoveredWaypoint] = useState<any | null>(null);
  const [expandedWhy, setExpandedWhy] = useState<{ [key: string]: boolean }>({});

  // DashTiny Embedded Copilot Action State
  const [copilotInput, setCopilotInput] = useState('');
  const [isExecutingCopilot, setIsExecutingCopilot] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [lastDiffResult, setLastDiffResult] = useState<{ summary: string; changes: AIDiffChange[] } | null>(null);

  const [checklist, setChecklist] = useState([
    { id: 'c1', task: 'Valid Passport & Photo ID', done: true, category: 'Docs' },
    { id: 'c2', task: 'Flight Boarding Pass / Ticket Downloaded', done: true, category: 'Tickets' },
    { id: 'c3', task: 'Hotel / Sanctuary Booking Voucher', done: true, category: 'Hotel' },
    { id: 'c4', task: 'Pack Sunscreen, Walking Shoes & Sunglasses', done: false, category: 'Packing' },
    { id: 'c5', task: 'Camera, Chargers & Universal Adapter', done: false, category: 'Equipment' },
    { id: 'c6', task: 'Notify Bank / Credit Card for Travel', done: true, category: 'Finance' },
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
      console.error('Failed to load trips:', err);
      setError('Unable to connect to DashTiny travel services. Please check your connection.');
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
        setCopilotError('DAIna could not apply this adjustment right now. Please try a different request.');
      }
    } catch (err) {
      console.error('Failed to execute AI Copilot diff:', err);
      setCopilotError('DAIna is temporarily unavailable. Please try again.');
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

  // Helper: map activity place codes to human tags and icons
  const getPlaceCategory = (code?: string) => {
    const c = (code || '').toUpperCase();
    if (c === 'R' || c === 'DINING' || c === 'RESTAURANT') {
      return { label: 'Dining', icon: Utensils, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    if (c === 'H' || c === 'HOTEL' || c === 'STAY') {
      return { label: 'Stay', icon: Luggage, color: 'text-sky-700 bg-sky-50 border-sky-200' };
    }
    if (c === 'T' || c === 'TRANSIT') {
      return { label: 'Transit', icon: Plane, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
    }
    return { label: 'Activity', icon: Compass, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  // Helper: provenance badge
  const getProvenanceBadge = (prov?: string) => {
    const p = (prov || 'CURATED').toUpperCase().replace(' ', '_');
    if (p === 'PROVIDER_VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          Verified
        </span>
      );
    }
    if (p === 'AI_GENERATED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-semibold">
          <Sparkles className="w-3 h-3 text-orange-500" />
          AI Pick
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-medium">
        <CheckCircle2 className="w-3 h-3 text-slate-500" />
        Curated
      </span>
    );
  };

  // Map calculation helpers
  const getMapPoints = () => {
    if (!currentTrip) return { validPoints: [], allActivities: [] };
    const daysToShow = selectedDayIdx === 'all'
      ? (currentTrip.days || [])
      : (currentTrip.days || []).filter((d: any) => d.dayNumber === selectedDayIdx);

    const allActivities = daysToShow.flatMap((d: any) =>
      (d.activities || []).map((a: any, idx: number) => ({
        ...a,
        dayNumber: d.dayNumber,
        seqNum: idx + 1,
      }))
    );

    const validPoints = allActivities.filter((a: any) => a.lat != null && a.lng != null);
    return { validPoints, allActivities };
  };

  const { validPoints, allActivities: mapActivities } = getMapPoints();
  const hasCoordinates = validPoints.length > 0;

  const minLat = hasCoordinates ? Math.min(...validPoints.map((a: any) => Number(a.lat))) : 0;
  const maxLat = hasCoordinates ? Math.max(...validPoints.map((a: any) => Number(a.lat))) : 1;
  const minLng = hasCoordinates ? Math.min(...validPoints.map((a: any) => Number(a.lng))) : 0;
  const maxLng = hasCoordinates ? Math.max(...validPoints.map((a: any) => Number(a.lng))) : 1;

  const getX = (lng: number) => {
    const span = maxLng - minLng || 0.04;
    return Math.min(88, Math.max(12, 15 + ((lng - minLng) / span) * 70));
  };
  const getY = (lat: number) => {
    const span = maxLat - minLat || 0.04;
    return Math.min(85, Math.max(15, 85 - ((lat - minLat) / span) * 70));
  };

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
        {/* Loading Shimmer Skeleton */}
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

        {/* Connection Failure Error State */}
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
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-5 py-2 cursor-pointer"
            >
              Retry Connection
            </Button>
          </div>
        )}

        {/* Authentic Empty State when User has no trips */}
        {!loading && !error && trips.length === 0 && (
          <div className="p-12 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-5 max-w-lg mx-auto my-12">
            <div className="w-16 h-16 rounded-3xl bg-orange-50 border border-orange-200 text-orange-600 mx-auto flex items-center justify-center">
              <Luggage className="w-8 h-8 text-orange-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif-editorial font-bold text-slate-900">
                Your Next Adventure Starts Here
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Tell DAIna where you want to go. We&apos;ll build a personalized itinerary with flights, stays, and daily experiences tailored to your style.
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => router.push('/planner')}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-6 py-2.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Plan My First Trip →
              </Button>
            </div>
          </div>
        )}

        {/* ACTIVE TRIP WORKSPACE COCKPIT */}
        {!loading && !error && trips.length > 0 && currentTrip && (
          <>
            {/* TRIP COCKPIT HEADER */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold uppercase tracking-wide">
                      Active Trip Workspace
                    </span>
                    <span className="text-xs text-slate-400 font-medium">• Saved automatically</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900 tracking-tight">
                    {currentTrip.destination}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium flex flex-wrap items-center gap-2">
                    <span>{currentTrip.startDate} – {currentTrip.endDate}</span>
                    <span>•</span>
                    <span>{currentTrip.travelers || 2} travelers</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-900">
                      ₹{Number(currentTrip.budget || 50000).toLocaleString('en-IN')} estimated
                    </span>
                  </p>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsGroupModalOpen(true)}
                    className="bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5 text-orange-600" />
                    Squad Room
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/planner')}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    New Trip
                  </Button>
                </div>
              </div>

              {/* Trip Switcher Selector (if multiple trips) */}
              {trips.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 no-scrollbar">
                  <span className="text-[11px] font-medium text-slate-400 shrink-0">Switch Trip:</span>
                  {trips.map((t, idx) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTripIndex(idx)}
                      className={`px-3 py-1 rounded-xl text-xs transition-all shrink-0 cursor-pointer ${
                        activeTripIndex === idx
                          ? 'bg-orange-100 text-orange-900 font-semibold border border-orange-200'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {t.destination} ({t.days?.length || 3} Days)
                    </button>
                  ))}
                </div>
              )}

              {/* Primary Cockpit Navigation Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar pt-1">
                {[
                  { id: 'itinerary' as TripTab, label: 'Itinerary Schedule', icon: CalendarDays },
                  { id: 'overview' as TripTab, label: 'Overview', icon: Luggage },
                  { id: 'map' as TripTab, label: 'Interactive Map', icon: Compass },
                  { id: 'bookings' as TripTab, label: `Bookings (${realBookings.length})`, icon: Ticket },
                  { id: 'budget' as TripTab, label: 'Budget & Split', icon: DollarSign },
                  { id: 'squad' as TripTab, label: 'Squad Room', icon: Users },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-2 px-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-white text-orange-600 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB: ITINERARY SCHEDULE (COCKPIT CORE) */}
            {activeTab === 'itinerary' && (
              <div className="space-y-6">
                {/* Day Selector Pills */}
                <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 no-scrollbar">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedDayIdx('all')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer font-semibold ${
                        selectedDayIdx === 'all'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      All Days ({currentTrip.days?.length || 0})
                    </button>
                    {currentTrip.days?.map((d: any) => (
                      <button
                        key={d.dayNumber}
                        onClick={() => setSelectedDayIdx(d.dayNumber)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer font-semibold shrink-0 ${
                          selectedDayIdx === d.dayNumber
                            ? 'bg-orange-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        Day {d.dayNumber}
                      </button>
                    ))}
                  </div>

                  <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                    Click an action button to manipulate activities via DAIna
                  </span>
                </div>

                {/* 2-COLUMN DESKTOP COCKPIT: Timeline (60%) + Sticky Map (40%) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* LEFT COLUMN: Sequential Itinerary Activity Cards */}
                  <div className="lg:col-span-7 space-y-6">
                    {(selectedDayIdx === 'all'
                      ? currentTrip.days || []
                      : (currentTrip.days || []).filter((d: any) => d.dayNumber === selectedDayIdx)
                    ).map((day: any) => (
                      <div key={day.dayNumber} className="space-y-3">
                        {/* Day Header Banner */}
                        <div className="flex items-center justify-between bg-slate-100/80 px-4 py-2.5 rounded-2xl border border-slate-200/80">
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wide">
                              Day {day.dayNumber}
                            </span>
                            <h3 className="text-sm font-serif-editorial font-bold text-slate-900">
                              {day.title}
                            </h3>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {day.weather || 'Sunny · 28°C'}
                          </span>
                        </div>

                        {/* Activity Cards List */}
                        <div className="space-y-3">
                          {day.activities?.map((act: any, aIdx: number) => {
                            const cat = getPlaceCategory(act.placeType);
                            const CatIcon = cat.icon;
                            const isWhyOpen = expandedWhy[act.id || `${day.dayNumber}-${aIdx}`];

                            return (
                              <Card
                                key={act.id || aIdx}
                                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                                  hoveredWaypoint?.id === act.id
                                    ? 'border-orange-500 bg-orange-50/40 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                                onMouseEnter={() => act.lat && act.lng && setHoveredWaypoint(act)}
                                onMouseLeave={() => setHoveredWaypoint(null)}
                              >
                                <div className="space-y-3">
                                  {/* Top Line: Time + Category + Provenance */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                                        {act.time}
                                      </span>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cat.color}`}>
                                        <CatIcon className="w-3 h-3" />
                                        {cat.label}
                                      </span>
                                    </div>
                                    <div>{getProvenanceBadge(act.provenance)}</div>
                                  </div>

                                  {/* Middle Content: Title, Location, Cost, Transit */}
                                  <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-slate-900">
                                      {act.description}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                        <span>{act.location}</span>
                                      </span>
                                      {act.costEstimate > 0 && (
                                        <span>• Est: ₹{act.costEstimate}</span>
                                      )}
                                      {act.estimatedTransit && (
                                        <span className="font-mono text-[11px] text-slate-400">
                                          ({act.estimatedTransit})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Subtle Why Section (Collapsible / Subtle Secondary) */}
                                  {act.whyRecommended && (
                                    <div className="pt-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedWhy((prev) => ({
                                            ...prev,
                                            [act.id || `${day.dayNumber}-${aIdx}`]: !isWhyOpen,
                                          }))
                                        }
                                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
                                      >
                                        <Sparkles className="w-3 h-3 text-orange-500" />
                                        <span>Why DashTiny chose this</span>
                                        {isWhyOpen ? (
                                          <ChevronUp className="w-3 h-3" />
                                        ) : (
                                          <ChevronDown className="w-3 h-3" />
                                        )}
                                      </button>
                                      {isWhyOpen && (
                                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mt-1.5 leading-relaxed">
                                          {act.whyRecommended}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Activity Direct Manipulation Action Buttons */}
                                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
                                    <button
                                      type="button"
                                      disabled={isExecutingCopilot}
                                      onClick={() =>
                                        handleExecuteCopilotAction(
                                          `Reschedule ${act.description} to a different time slot today`
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer font-medium disabled:opacity-50"
                                      title="Reschedule this activity"
                                    >
                                      <MoveHorizontal className="w-3 h-3 text-slate-500" />
                                      <span>Move</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isExecutingCopilot}
                                      onClick={() =>
                                        handleExecuteCopilotAction(
                                          `Replace ${act.description} with another nearby experience in ${act.location}`
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer font-medium disabled:opacity-50"
                                      title="Find an alternative activity"
                                    >
                                      <RefreshCw className="w-3 h-3 text-slate-500" />
                                      <span>Replace</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isExecutingCopilot}
                                      onClick={() =>
                                        handleExecuteCopilotAction(
                                          `Remove ${act.description} from Day ${day.dayNumber}`
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer font-medium disabled:opacity-50"
                                      title="Remove from itinerary"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove</span>
                                    </button>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RIGHT COLUMN: Persistent Sticky Interactive Route Map */}
                  <div className="lg:col-span-5 sticky top-24 space-y-4">
                    <Card className="p-4 sm:p-5 rounded-3xl bg-slate-950 border border-slate-800 text-white shadow-xl relative overflow-hidden">
                      {/* Radar Grid Texture */}
                      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0d_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                      {/* Header bar */}
                      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <h4 className="font-serif-editorial font-bold text-xs uppercase tracking-wider text-slate-200">
                            Route Map • Day {selectedDayIdx === 'all' ? 'All' : selectedDayIdx}
                          </h4>
                        </div>
                        <span className="text-[11px] font-mono text-orange-400">
                          {validPoints.length} Stops Plotted
                        </span>
                      </div>

                      {/* SVG Tactical Route Map Stage */}
                      <div className="relative h-72 sm:h-80 w-full z-10 my-2">
                        {hasCoordinates ? (
                          <>
                            {/* SVG Connection Lines */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                              {validPoints.map((act: any, idx: number) => {
                                if (idx === 0) return null;
                                const prev = validPoints[idx - 1];
                                const x1 = `${getX(Number(prev.lng))}%`;
                                const y1 = `${getY(Number(prev.lat))}%`;
                                const x2 = `${getX(Number(act.lng))}%`;
                                const y2 = `${getY(Number(act.lat))}%`;
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
                                    strokeOpacity="0.7"
                                  />
                                );
                              })}
                            </svg>

                            {/* Waypoint Pins */}
                            {validPoints.map((act: any, idx: number) => {
                              const posX = getX(Number(act.lng));
                              const posY = getY(Number(act.lat));
                              const isHovered = hoveredWaypoint?.id === act.id;

                              return (
                                <div
                                  key={act.id || idx}
                                  style={{ left: `${posX}%`, top: `${posY}%` }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                                  onMouseEnter={() => setHoveredWaypoint(act)}
                                  onMouseLeave={() => setHoveredWaypoint(null)}
                                >
                                  {/* Node badge */}
                                  <div
                                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-[11px] transition-all border shadow-md ${
                                      isHovered
                                        ? 'bg-orange-500 text-white scale-125 border-white ring-2 ring-orange-500/50'
                                        : 'bg-slate-900 text-orange-400 border-orange-500/60 hover:scale-110'
                                    }`}
                                  >
                                    {act.seqNum || idx + 1}
                                  </div>

                                  {/* Tooltip on hover */}
                                  <div
                                    className={`absolute left-1/2 -translate-x-1/2 bottom-9 w-48 p-2.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-xl text-left pointer-events-none transition-all ${
                                      isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                                    }`}
                                  >
                                    <p className="text-[10px] font-mono text-orange-400 font-semibold">{act.time}</p>
                                    <p className="text-xs font-semibold text-white truncate">{act.description}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{act.location}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                            <Compass className="w-8 h-8 text-orange-400 mb-2" />
                            <p className="text-xs font-semibold text-slate-300">
                              Locations cataloged for {currentTrip.destination}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                              Waypoints appear as verified coordinates are slotted into this itinerary.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Map Footer Bar */}
                      <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                        <span>Pacing: Optimized for minimal transit</span>
                        <button
                          onClick={() => setActiveTab('map')}
                          className="text-orange-400 hover:text-orange-300 font-semibold cursor-pointer underline"
                        >
                          Full Map View →
                        </button>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* DOCKED COPILOT ACTION SURFACE (AT BASE OF ITINERARY) */}
                <Card className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                        <Sparkles className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-serif-editorial font-bold text-slate-900 text-sm">
                          ✨ What would you like to change?
                        </h3>
                        <p className="text-xs text-slate-500">
                          Tell DAIna how to adjust your trip. Pacing, budget, and route updates apply instantly.
                        </p>
                      </div>
                    </div>

                    {/* Quick suggestion chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { label: 'Make tomorrow cheaper', icon: TrendingDown },
                        { label: 'Avoid long walks', icon: Zap },
                        { label: 'Add one local food experience', icon: Utensils },
                        { label: 'Move beach visit to sunset', icon: Sun },
                      ].map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={isExecutingCopilot}
                          onClick={() => handleExecuteCopilotAction(chip.label)}
                          className="px-3 py-1.5 rounded-full bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-800 border border-slate-200 text-xs font-medium shrink-0 transition-all cursor-pointer disabled:opacity-50"
                        >
                          ✦ {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt Bar */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Add an authentic lunch spot within 10 min walk of our afternoon stop..."
                      value={copilotInput}
                      onChange={(e) => setCopilotInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleExecuteCopilotAction()}
                      disabled={isExecutingCopilot}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
                    />
                    <Button
                      onClick={() => handleExecuteCopilotAction()}
                      disabled={isExecutingCopilot || !copilotInput.trim()}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-5 py-2.5 shadow-sm cursor-pointer"
                    >
                      {isExecutingCopilot ? (
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" /> Adjusting...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" /> Adjust Trip
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Copilot Error Message */}
                  {copilotError && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between">
                      <span>{copilotError}</span>
                      <button onClick={() => setCopilotError(null)} className="text-amber-700 font-bold cursor-pointer">✕</button>
                    </div>
                  )}

                  {/* Real-time Diff Review Banner */}
                  {lastDiffResult && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-900">
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-semibold text-slate-800 shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <strong>{ch.action.toUpperCase()}:</strong> {ch.item || ch.details}
                            {ch.from && ch.to && <span className="text-slate-500 font-mono">({ch.from} → {ch.to})</span>}
                            {ch.saving_amount && <span className="text-emerald-700 font-bold">(Saved ₹{ch.saving_amount})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  {/* Hero Cover Banner */}
                  <div className="relative h-64 rounded-3xl overflow-hidden shadow-sm border border-slate-200">
                    <Image
                      src={currentTrip.cover_image || currentTrip.days?.[0]?.coverImage || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80"}
                      alt={currentTrip.destination}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white">
                      <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-[10px] font-semibold uppercase">
                          Confirmed Itinerary
                        </span>
                        <h3 className="text-2xl font-serif-editorial font-bold">{currentTrip.destination}</h3>
                        <p className="text-xs text-slate-200">
                          {currentTrip.startDate} – {currentTrip.endDate} • Budget: ₹{currentTrip.budget?.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setActiveTab('itinerary')}
                        className="bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold"
                      >
                        View Schedule →
                      </Button>
                    </div>
                  </div>

                  {/* Day Highlights Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-serif-editorial font-bold text-slate-900">Itinerary Highlights</h3>
                    <div className="space-y-3">
                      {currentTrip.days?.map((day: any, idx: number) => (
                        <Card key={idx} className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-orange-600">Day {day.dayNumber} · {day.title}</span>
                            <span className="text-xs text-slate-500">{day.weather}</span>
                          </div>
                          <div className="space-y-1 pt-1">
                            {day.activities?.map((act: any, aIdx: number) => (
                              <div key={aIdx} className="flex items-center justify-between text-xs text-slate-700">
                                <span className="font-semibold text-slate-900">{act.time} — {act.description}</span>
                                <span className="text-[11px] text-slate-400">{act.location}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Pre-Trip Checklist */}
                <div className="space-y-6">
                  <Card className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-sm font-bold font-serif-editorial text-slate-900">Pre-Trip Checklist</h4>
                      <span className="text-xs text-orange-600 font-semibold">
                        {checklist.filter((c) => c.done).length}/{checklist.length} Done
                      </span>
                    </div>
                    <div className="space-y-2">
                      {checklist.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => toggleChecklist(item.id)}
                          className={`w-full text-left p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer ${
                            item.done
                              ? 'bg-emerald-50/40 border-emerald-200 text-slate-400 line-through'
                              : 'bg-slate-50 border-slate-200 text-slate-800 font-medium'
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

            {/* TAB: INTERACTIVE MAP (FULL TACTICAL VIEW) */}
            {activeTab === 'map' && (
              <div className="space-y-6">
                <Card className="p-6 rounded-3xl bg-slate-950 border border-slate-800 text-white relative overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-serif-editorial font-bold text-white">Spatial Route Radar</h3>
                      <p className="text-xs text-slate-400">Waypoints and transit connections for {currentTrip.destination}</p>
                    </div>
                    <span className="font-mono text-xs text-orange-400">{validPoints.length} Geocoded Pins</span>
                  </div>

                  <div className="relative h-96 w-full my-4">
                    {hasCoordinates ? (
                      <>
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          {validPoints.map((act: any, idx: number) => {
                            if (idx === 0) return null;
                            const prev = validPoints[idx - 1];
                            const x1 = `${getX(Number(prev.lng))}%`;
                            const y1 = `${getY(Number(prev.lat))}%`;
                            const x2 = `${getX(Number(act.lng))}%`;
                            const y2 = `${getY(Number(act.lat))}%`;
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
                                strokeOpacity="0.7"
                              />
                            );
                          })}
                        </svg>

                        {validPoints.map((act: any, idx: number) => (
                          <div
                            key={act.id || idx}
                            style={{ left: `${getX(Number(act.lng))}%`, top: `${getY(Number(act.lat))}%` }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                            onMouseEnter={() => setHoveredWaypoint(act)}
                            onMouseLeave={() => setHoveredWaypoint(null)}
                          >
                            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white font-bold text-xs flex items-center justify-center shadow-lg">
                              {act.seqNum || idx + 1}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Compass className="w-10 h-10 text-orange-400 mb-2" />
                        <p className="text-sm font-semibold text-slate-300">Coordinates mapped to {currentTrip.destination}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Waypoints Sequence List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-serif-editorial font-bold text-slate-900">Waypoint Stops</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {mapActivities.map((act: any, idx: number) => (
                      <Card key={act.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-white">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-xs">
                            {act.seqNum || idx + 1}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 font-semibold">{act.time}</span>
                        </div>
                        <h5 className="text-xs font-semibold text-slate-900 line-clamp-1">{act.description}</h5>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                          <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                          <span>{act.location}</span>
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: BOOKINGS & PASSES */}
            {activeTab === 'bookings' && (() => {
              const displayBookings = (currentTrip.bookings && currentTrip.bookings.length > 0) ? currentTrip.bookings : realBookings;
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-serif-editorial font-bold text-slate-900">Tickets & Accommodations</h3>
                      <p className="text-xs text-slate-500">Reservations attached to this Trip Workspace</p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push(`/bookings?tripId=${currentTrip.id || ''}`)}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
                    >
                      + Add Flight or Stay
                    </Button>
                  </div>

                  {displayBookings.length === 0 ? (
                    <Card className="p-8 text-center space-y-3 rounded-3xl bg-white border border-slate-200 shadow-sm">
                      <Ticket className="w-10 h-10 text-orange-400 mx-auto" />
                      <h4 className="text-base font-semibold text-slate-800">No Reservations Linked Yet</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Search and compare flights or hotels to attach your confirmed reservation reference to this trip.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push(`/bookings?tripId=${currentTrip.id || ''}`)}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs mt-2"
                      >
                        Compare Flights & Stays
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayBookings.map((b: any) => (
                        <Card key={b.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold uppercase border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              {b.status || 'CONFIRMED'}
                            </span>
                            <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                              Ref: {b.pnr_ref}
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-slate-900">{b.title}</h4>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                            <span>Provider: {b.provider}</span>
                            <span className="font-semibold text-orange-600">
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

            {/* TAB: BUDGET & SPLIT */}
            {activeTab === 'budget' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { category: 'Stays & Lodging', amount: '₹22,000', pct: '52%', count: '2 Nights' },
                    { category: 'Dining & Cafes', amount: '₹9,500', pct: '23%', count: '5 Meals' },
                    { category: 'Activities & Tours', amount: '₹6,000', pct: '14%', count: '3 Passes' },
                    { category: 'Transit', amount: '₹4,500', pct: '11%', count: 'Local cabs' }
                  ].map((b, i) => (
                    <Card key={i} className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">{b.category}</span>
                      <p className="text-xl font-serif-editorial font-bold text-slate-900">{b.amount}</p>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                        <span>{b.count}</span>
                        <span className="font-semibold text-orange-600">{b.pct}</span>
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

            {/* TAB: SQUAD ROOM */}
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
