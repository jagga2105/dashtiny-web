'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Luggage, Sparkles } from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { SquadRoomHub } from '@/components/squad/SquadRoomHub';
import { GroupCollaborationModal } from '@/components/planner/GroupCollaborationModal';
import { Button } from '@/components/ui/Button';
import { apiService } from '@/services/api';
import {
  TripHeader,
  TripTab,
  TripDayTimeline,
  TripMap,
  TripBookings,
  TripBudget,
  TripHistory,
  CopilotProposal,
  AIDiffChange,
} from '@/components/trip';

const DEFAULT_CHECKLIST = [
  { id: 'c1', task: 'Valid Passport & Photo ID', done: false, category: 'Docs' },
  { id: 'c2', task: 'Flight Boarding Pass / Ticket Downloaded', done: false, category: 'Tickets' },
  { id: 'c3', task: 'Hotel / Sanctuary Booking Voucher', done: false, category: 'Hotel' },
  { id: 'c4', task: 'Pack Sunscreen, Walking Shoes & Sunglasses', done: false, category: 'Packing' },
  { id: 'c5', task: 'Camera, Chargers & Universal Adapter', done: false, category: 'Equipment' },
  { id: 'c6', task: 'Notify Bank / Credit Card for Travel', done: false, category: 'Finance' },
];

function TripsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get('tripId');

  const [activeTab, setActiveTab] = useState<TripTab>('plan');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTripIndex, setActiveTripIndex] = useState(0);
  const [realBookings, setRealBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removedActivity, setRemovedActivity] = useState<{ activity: any; dayIndex: number; itemIndex: number } | null>(null);
  const [deletionStatus, setDeletionStatus] = useState<'idle' | 'deleting' | 'deleted' | 'undoing' | 'failed'>('idle');
  const [activityActionError, setActivityActionError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);

  // Day filter for Itinerary & Interactive Map
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | 'all'>('all');
  const [hoveredWaypoint, setHoveredWaypoint] = useState<any | null>(null);
  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [expandedWhy, setExpandedWhy] = useState<{ [key: string]: boolean }>({});

  // DashTiny Embedded Copilot Action State
  const [copilotInput, setCopilotInput] = useState('');
  const [isExecutingCopilot, setIsExecutingCopilot] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<CopilotProposal | null>(null);
  const [lastDiffResult, setLastDiffResult] = useState<{ summary: string; changes: AIDiffChange[]; canUndo?: boolean; previousTrip?: any } | null>(null);

  const currentTrip = trips[activeTripIndex] || trips[0];

  // Canonical strictly trip-scoped bookings: combines direct embedded bookings and realBookings matching currentTrip.id
  const currentTripBookings = useMemo(() => {
    if (!currentTrip?.id) return [];
    const direct = currentTrip.bookings || [];
    const fromReal = realBookings.filter((b: any) => b.trip_id === currentTrip.id);
    const map = new Map<string, any>();
    [...direct, ...fromReal].forEach((b) => {
      if (!b) return;
      const key = b.id || b.pnr_ref || `${b.category}_${b.title}`;
      map.set(key, b);
    });
    return Array.from(map.values());
  }, [currentTrip, realBookings]);

  // Persistent removal of itinerary activity with state machine & automatic rollback on failure
  const handleRemoveActivity = async (act: any, dayIdx: number, itemIdx: number) => {
    if (!currentTrip?.id || !act.id) return;
    setActivityActionError(null);
    setDeletionStatus('deleting');
    setRemovedActivity({ activity: act, dayIndex: dayIdx, itemIndex: itemIdx });

    // Optimistic UI update
    setTrips((prevTrips) => {
      const copy = [...prevTrips];
      const curTrip = { ...copy[activeTripIndex] };
      const days = [...curTrip.days];
      const targetDay = { ...days[dayIdx] };
      targetDay.activities = (targetDay.activities || targetDay.items || []).filter((item: any) => item.id !== act.id);
      days[dayIdx] = targetDay;
      curTrip.days = days;
      copy[activeTripIndex] = curTrip;
      return copy;
    });

    // Persist mutation to backend
    try {
      await apiService.removeTripActivity(currentTrip.id, act.id);
      setDeletionStatus('deleted');
    } catch (err) {
      console.error('Failed to remove activity on server:', err);
      // Automatic rollback on failure: re-insert item into state
      setTrips((prevTrips) => {
        const copy = [...prevTrips];
        const curTrip = { ...copy[activeTripIndex] };
        const days = [...curTrip.days];
        const targetDay = { ...days[dayIdx] };
        const acts = [...(targetDay.activities || targetDay.items || [])];
        acts.splice(itemIdx, 0, act);
        targetDay.activities = acts;
        days[dayIdx] = targetDay;
        curTrip.days = days;
        copy[activeTripIndex] = curTrip;
        return copy;
      });
      setRemovedActivity(null);
      setDeletionStatus('failed');
      setActivityActionError('Failed to remove activity from trip. Changes have been restored.');
    }
  };

  // Restore deleted activity via authoritative append-only undo on backend
  const handleUndoRemove = async () => {
    if (!removedActivity || !currentTrip || deletionStatus !== 'deleted') return;
    setActivityActionError(null);
    setDeletionStatus('undoing');

    try {
      // 1. Authoritative append-only undo via TripRevisionService
      await apiService.undoTripAction(currentTrip.id);
      // 2. Fetch canonical Trip from server and replace local state
      await loadData();
      setDeletionStatus('idle');
      setRemovedActivity(null);
    } catch (err: any) {
      console.error('Failed to undo activity removal on server:', err);
      setDeletionStatus('failed');
      setActivityActionError('Failed to undo activity removal on server. Please try again.');
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tripsData, bookingsData] = await Promise.all([
        apiService.getMyTrips(),
        apiService.getMyBookings(),
      ]);

      const loaded = tripsData || [];
      setTrips(loaded);
      if (bookingsData && bookingsData.length > 0) {
        setRealBookings(bookingsData);
      }

      // If URL param specifies tripId, automatically focus on it
      if (loaded.length > 0 && tripIdParam) {
        const matchIdx = loaded.findIndex((t: any) => t.id === tripIdParam);
        if (matchIdx >= 0) {
          setActiveTripIndex(matchIdx);
        }
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

  // When tripIdParam changes dynamically, switch active trip index
  useEffect(() => {
    if (tripIdParam && trips.length > 0) {
      const matchIdx = trips.findIndex((t: any) => t.id === tripIdParam);
      if (matchIdx >= 0 && matchIdx !== activeTripIndex) {
        setActiveTripIndex(matchIdx);
      }
    }
  }, [tripIdParam, trips, activeTripIndex]);

  // Reset selected stop when switching days or trips
  useEffect(() => {
    setSelectedStop(null);
  }, [selectedDayIdx, activeTripIndex]);

  // Load and derive persistent checklist from canonical currentTripBookings
  useEffect(() => {
    if (!currentTrip?.id) return;
    try {
      const stored = localStorage.getItem(`dashtiny_checklist_${currentTrip.id}`);
      let userChecks: Record<string, boolean> = {};
      if (stored) {
        userChecks = JSON.parse(stored);
      }
      const hasFlightBooking = currentTripBookings.some((b: any) => b.category === 'flight');
      const hasHotelBooking = currentTripBookings.some((b: any) => b.category === 'hotel');

      setChecklist(
        DEFAULT_CHECKLIST.map((item) => {
          let isDone = Boolean(userChecks[item.id]);
          if (item.id === 'c2' && hasFlightBooking) isDone = true;
          if (item.id === 'c3' && hasHotelBooking) isDone = true;
          return { ...item, done: isDone };
        })
      );
    } catch {
      // Fallback to default clean state
    }
  }, [currentTrip?.id, currentTripBookings]);

  const toggleChecklist = (id: string) => {
    setChecklist((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      if (currentTrip?.id) {
        const stateMap = updated.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.done }), {});
        localStorage.setItem(`dashtiny_checklist_${currentTrip.id}`, JSON.stringify(stateMap));
      }
      return updated;
    });
  };

  const handleExecuteCopilotAction = async (customInstruction?: string) => {
    const instruction = (customInstruction || copilotInput).trim();
    if (!instruction || isExecutingCopilot) return;

    setIsExecutingCopilot(true);
    setCopilotError(null);
    setCopilotInput('');

    try {
      const activeTrip = trips[activeTripIndex];
      if (!activeTrip || !activeTrip.id) {
        setCopilotError('Please select a saved trip first before requesting AI adjustments.');
        return;
      }

      // Propose -> Approval -> Commit: create proposal without mutating the Trip
      const res = await apiService.createAIProposal(activeTrip.id, instruction);

      if (res && res.proposal_id) {
        const afterDays = res.after?.days || activeTrip.days;
        const beforeCost = (res.before?.days || []).reduce((sum: number, d: any) =>
          sum + (d.activities || []).reduce((s: number, a: any) => s + (a.cost || a.cost_estimate || 0), 0), 0);
        const afterCost = (res.after?.days || []).reduce((sum: number, d: any) =>
          sum + (d.activities || []).reduce((s: number, a: any) => s + (a.cost || a.cost_estimate || 0), 0), 0);
        const budgetImpact = afterCost - beforeCost;

        setPendingProposal({
          proposalId: res.proposal_id,
          summary: res.summary,
          changes: res.changes || [],
          proposedTrip: {
            ...activeTrip,
            days: afterDays,
          },
          previousTrip: JSON.parse(JSON.stringify(activeTrip)),
          parentVersion: res.parent_version,
          verification: res.verification,
          provenance: res.provenance,
          budgetImpact: budgetImpact !== 0 ? budgetImpact : undefined,
        });
      } else {
        setCopilotError('DAIna could not generate a proposal right now. Please try a different request.');
      }
    } catch (err: any) {
      console.error('Failed to create AI Copilot proposal:', err);
      setCopilotError(err?.message || 'DAIna is temporarily unavailable. Please try again.');
    } finally {
      setIsExecutingCopilot(false);
    }
  };

  const handleApplyProposal = async () => {
    if (!pendingProposal) return;
    const applied = pendingProposal;
    setPendingProposal(null);

    try {
      if (applied.proposalId) {
        // Accept proposal on backend: atomically commits append-only revision
        const acceptRes = await apiService.acceptAIProposal(applied.proposalId);
        if (acceptRes && acceptRes.trip) {
          setTrips((prev) =>
            prev.map((t, idx) => (idx === activeTripIndex ? { ...t, ...acceptRes.trip } : t))
          );
        } else {
          await loadData();
        }
      } else {
        await loadData();
      }

      setLastDiffResult({
        summary: applied.summary,
        changes: applied.changes,
        canUndo: true,
        previousTrip: applied.previousTrip,
      });
    } catch (err: any) {
      console.error('Failed to accept AI proposal:', err);
      setCopilotError(err?.message || 'Failed to commit proposed changes to the trip.');
    }
  };

  const handleRejectProposal = async () => {
    if (pendingProposal?.proposalId) {
      try {
        await apiService.rejectAIProposal(pendingProposal.proposalId);
      } catch (err) {
        console.warn('Failed to reject proposal on server:', err);
      }
    }
    setPendingProposal(null);
  };

  const handleUndoCopilotDiff = async () => {
    if (!currentTrip?.id) return;
    try {
      await apiService.undoTripAction(currentTrip.id);
      await loadData();
      setLastDiffResult(null);
    } catch (err) {
      console.error('Failed to undo trip changes on server:', err);
      if (lastDiffResult?.previousTrip) {
        setTrips((prev) =>
          prev.map((t, idx) => (idx === activeTripIndex ? lastDiffResult.previousTrip : t))
        );
        setLastDiffResult(null);
      }
    }
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
            <TripHeader
              currentTrip={currentTrip}
              trips={trips}
              activeTripIndex={activeTripIndex}
              setActiveTripIndex={setActiveTripIndex}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              bookingsCount={currentTripBookings.length}
              onOpenSquadModal={() => setIsGroupModalOpen(true)}
              onNewTrip={() => router.push('/planner')}
            />

            {/* TAB: PLAN (COCKPIT CORE) */}
            {activeTab === 'plan' && (
              <TripDayTimeline
                currentTrip={currentTrip}
                selectedDayIdx={selectedDayIdx}
                setSelectedDayIdx={setSelectedDayIdx}
                activityActionError={activityActionError}
                setActivityActionError={setActivityActionError}
                hoveredWaypoint={hoveredWaypoint}
                setHoveredWaypoint={setHoveredWaypoint}
                selectedStop={selectedStop}
                setSelectedStop={setSelectedStop}
                expandedWhy={expandedWhy}
                setExpandedWhy={setExpandedWhy}
                validPoints={validPoints}
                mapActivities={mapActivities}
                hasCoordinates={hasCoordinates}
                getX={getX}
                getY={getY}
                checklist={checklist}
                toggleChecklist={toggleChecklist}
                copilotInput={copilotInput}
                setCopilotInput={setCopilotInput}
                isExecutingCopilot={isExecutingCopilot}
                copilotError={copilotError}
                setCopilotError={setCopilotError}
                pendingProposal={pendingProposal}
                lastDiffResult={lastDiffResult}
                handleExecuteCopilotAction={handleExecuteCopilotAction}
                handleApplyProposal={handleApplyProposal}
                handleRejectProposal={handleRejectProposal}
                handleUndoCopilotDiff={handleUndoCopilotDiff}
                handleRemoveActivity={handleRemoveActivity}
                setActiveTab={setActiveTab}
              />
            )}

            {/* TAB: INTERACTIVE MAP (FULL TACTICAL VIEW) */}
            {activeTab === 'map' && (
              <TripMap
                destination={currentTrip.destination}
                selectedDayIdx={selectedDayIdx}
                validPoints={validPoints}
                mapActivities={mapActivities}
                hasCoordinates={hasCoordinates}
                hoveredWaypoint={hoveredWaypoint}
                setHoveredWaypoint={setHoveredWaypoint}
                selectedStop={selectedStop}
                setSelectedStop={setSelectedStop}
                getX={getX}
                getY={getY}
                isFullView={true}
              />
            )}

            {/* TAB: BOOKINGS & PASSES */}
            {activeTab === 'bookings' && (
              <TripBookings
                tripId={currentTrip.id}
                bookings={currentTripBookings}
                onAddBooking={() => router.push(`/bookings?tripId=${currentTrip.id || ''}`)}
              />
            )}

            {/* TAB: BUDGET & SPLIT */}
            {activeTab === 'budget' && (
              <TripBudget
                currentTrip={currentTrip}
                currentTripBookings={currentTripBookings}
                onOpenInviteModal={() => setIsGroupModalOpen(true)}
              />
            )}

            {/* TAB: PEOPLE / SQUAD */}
            {activeTab === 'people' && (
              <SquadRoomHub
                squadId={currentTrip.squad_room_code || 'ROOM'}
                onOpenInviteModal={() => setIsGroupModalOpen(true)}
              />
            )}

            {/* TAB: APPEND-ONLY REVISION HISTORY */}
            {activeTab === 'history' && (
              <TripHistory
                tripId={currentTrip.id}
                onStateRestored={loadData}
              />
            )}
          </>
        )}
      </main>

      {/* Undo Snackbar for Non-Destructive Itinerary Deletion */}
      {removedActivity && deletionStatus === 'deleted' && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-950 text-white shadow-xl border border-slate-800 animate-in fade-in slide-in-from-bottom-2"
        >
          <span className="text-xs font-medium">Activity removed</span>
          <button
            type="button"
            onClick={handleUndoRemove}
            className="text-xs font-bold text-orange-400 hover:text-orange-300 underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded px-1"
          >
            Undo
          </button>
        </aside>
      )}

      {deletionStatus === 'undoing' && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-800 animate-in fade-in slide-in-from-bottom-2 text-xs font-medium"
        >
          <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <span>Restoring activity...</span>
        </aside>
      )}

      <GroupCollaborationModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        roomCode={currentTrip?.squad_room_code || 'ROOM'}
      />

      <BottomNav />
    </div>
  );
}

export default function ActiveTripsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center text-xs text-slate-500 font-medium">
          Loading Trip Workspace...
        </div>
      }
    >
      <TripsContent />
    </Suspense>
  );
}
