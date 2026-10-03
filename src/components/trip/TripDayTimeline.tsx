'use client';

import React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TripActivityCard } from './TripActivityCard';
import { TripMap } from './TripMap';
import { TripChecklist } from './TripChecklist';
import { TripCopilot } from './TripCopilot';
import { CopilotProposal, AIDiffChange } from './TripProposalCard';

interface TripDayTimelineProps {
  currentTrip: any;
  selectedDayIdx: number | 'all';
  setSelectedDayIdx: (idx: number | 'all') => void;
  activityActionError: string | null;
  setActivityActionError: (err: string | null) => void;
  hoveredWaypoint: any;
  setHoveredWaypoint: (wp: any) => void;
  selectedStop: any;
  setSelectedStop: (stop: any) => void;
  expandedWhy: Record<string, boolean>;
  setExpandedWhy: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  validPoints: any[];
  mapActivities: any[];
  hasCoordinates: boolean;
  getX: (lng: number) => number;
  getY: (lat: number) => number;
  checklist: Array<{ id: string; task: string; done: boolean; category: string }>;
  toggleChecklist: (id: string) => void;
  copilotInput: string;
  setCopilotInput: (val: string) => void;
  isExecutingCopilot: boolean;
  copilotError: string | null;
  setCopilotError: (err: string | null) => void;
  pendingProposal: CopilotProposal | null;
  lastDiffResult: { summary: string; changes: AIDiffChange[]; canUndo?: boolean; previousTrip?: any } | null;
  handleExecuteCopilotAction: (customInstruction?: string) => void;
  handleApplyProposal: () => void;
  handleRejectProposal: () => void;
  handleUndoCopilotDiff: () => void;
  handleRemoveActivity: (act: any, dayIdx: number, itemIdx: number) => void;
  setActiveTab: (tab: any) => void;
}

export const TripDayTimeline: React.FC<TripDayTimelineProps> = ({
  currentTrip,
  selectedDayIdx,
  setSelectedDayIdx,
  activityActionError,
  setActivityActionError,
  hoveredWaypoint,
  setHoveredWaypoint,
  selectedStop,
  setSelectedStop,
  expandedWhy,
  setExpandedWhy,
  validPoints,
  mapActivities,
  hasCoordinates,
  getX,
  getY,
  checklist,
  toggleChecklist,
  copilotInput,
  setCopilotInput,
  isExecutingCopilot,
  copilotError,
  setCopilotError,
  pendingProposal,
  lastDiffResult,
  handleExecuteCopilotAction,
  handleApplyProposal,
  handleRejectProposal,
  handleUndoCopilotDiff,
  handleRemoveActivity,
  setActiveTab,
}) => {
  const activeDayObj = selectedDayIdx !== 'all'
    ? currentTrip.days?.find((d: any) => d.dayNumber === selectedDayIdx)
    : currentTrip.days?.[0];
  const dayTitle = selectedDayIdx === 'all'
    ? `Curated ${currentTrip.days?.length || 0}-Day Itinerary`
    : `Day ${selectedDayIdx}: ${activeDayObj?.title || 'Daily Experience'}`;
  const daySubtitle = selectedDayIdx === 'all'
    ? `${mapActivities.length} planned experiences · Optimized walking & transit corridor`
    : `${activeDayObj?.activities?.length || 0} stops scheduled · ${activeDayObj?.weather || 'Pleasant weather forecast'}`;

  return (
    <div className="space-y-6">
      {/* Action Feedback Banner (Deletion / Restoration Rollback alerts) */}
      {activityActionError && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
          <span>⚠️ {activityActionError}</span>
          <button
            onClick={() => setActivityActionError(null)}
            className="text-amber-700 font-bold hover:text-amber-900 px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Day Experience Focus Banner */}
      <div className="relative h-36 sm:h-44 rounded-2xl overflow-hidden shadow-xs border border-slate-200">
        <Image
          src={activeDayObj?.coverImage || currentTrip.cover_image || "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80"}
          alt={dayTitle}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-black/30 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 flex flex-col sm:flex-row sm:items-end justify-between gap-2 text-white">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded-full bg-orange-600 text-[10px] font-semibold uppercase tracking-wider">
              {selectedDayIdx === 'all' ? 'Full Itinerary' : `Day ${selectedDayIdx}`}
            </span>
            <h2 className="text-xl sm:text-2xl font-serif-editorial font-bold">{dayTitle}</h2>
            <p className="text-xs text-slate-200 font-medium">{daySubtitle}</p>
          </div>
        </div>
      </div>

      {/* Day Navigation Cockpit: Stepper + Jump Dropdown + Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Left: Day Stepper & Quick Dropdown */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => {
                if (selectedDayIdx === 'all' || selectedDayIdx === 1) {
                  setSelectedDayIdx('all');
                } else {
                  setSelectedDayIdx(selectedDayIdx - 1);
                }
              }}
              disabled={selectedDayIdx === 'all'}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              aria-label="Previous day"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 text-xs font-bold text-slate-800 flex items-center gap-1">
              {selectedDayIdx === 'all' ? (
                <span>All ({currentTrip.days?.length || 0}) Days</span>
              ) : (
                <span>Day {selectedDayIdx} of {currentTrip.days?.length || 0}</span>
              )}
            </div>

            <button
              onClick={() => {
                if (selectedDayIdx === 'all') {
                  setSelectedDayIdx(1);
                } else if (typeof selectedDayIdx === 'number' && selectedDayIdx < (currentTrip.days?.length || 0)) {
                  setSelectedDayIdx(selectedDayIdx + 1);
                }
              }}
              disabled={typeof selectedDayIdx === 'number' && selectedDayIdx >= (currentTrip.days?.length || 0)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              aria-label="Next day"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Compact Jump Dropdown for multi-day itineraries */}
          {(currentTrip.days?.length || 0) > 4 && (
            <select
              value={selectedDayIdx}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDayIdx(val === 'all' ? 'all' : Number(val));
              }}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              aria-label="Jump to specific day"
            >
              <option value="all">All Days ({currentTrip.days?.length || 0})</option>
              {currentTrip.days?.map((d: any) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  Day {d.dayNumber}: {d.title ? d.title.slice(0, 24) : `Day ${d.dayNumber}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Quick Day Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          <button
            onClick={() => setSelectedDayIdx('all')}
            className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer font-semibold shrink-0 ${
              selectedDayIdx === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All
          </button>
          {currentTrip.days?.map((d: any) => (
            <button
              key={d.dayNumber}
              onClick={() => setSelectedDayIdx(d.dayNumber)}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer font-semibold shrink-0 ${
                selectedDayIdx === d.dayNumber
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Day {d.dayNumber}
            </button>
          ))}
        </div>
      </div>

      {/* 2-COLUMN DESKTOP COCKPIT: Timeline (60%) + Sticky Map (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Sequential Itinerary Activity Cards */}
        <div className="lg:col-span-7 space-y-6">
          {(selectedDayIdx === 'all'
            ? currentTrip.days || []
            : (currentTrip.days || []).filter((d: any) => d.dayNumber === selectedDayIdx)
          ).map((day: any, dIdx: number) => (
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
                  {day.weather || 'Weather unavailable'}
                </span>
              </div>

              {/* Activity Cards List */}
              <div className="space-y-3">
                {day.activities?.map((act: any, aIdx: number) => {
                  const isWhyOpen = expandedWhy[act.id || `${day.dayNumber}-${aIdx}`];

                  return (
                    <TripActivityCard
                      key={act.id || aIdx}
                      activity={act}
                      dayNumber={day.dayNumber}
                      dIdx={dIdx}
                      aIdx={aIdx}
                      isHovered={hoveredWaypoint?.id === act.id}
                      isWhyOpen={isWhyOpen}
                      onToggleWhy={() =>
                        setExpandedWhy((prev) => ({
                          ...prev,
                          [act.id || `${day.dayNumber}-${aIdx}`]: !isWhyOpen,
                        }))
                      }
                      onMouseEnter={() => act.lat && act.lng && setHoveredWaypoint(act)}
                      onMouseLeave={() => setHoveredWaypoint(null)}
                      onMove={() =>
                        handleExecuteCopilotAction(
                          `Reschedule ${act.description} to a different time slot today`
                        )
                      }
                      onReplace={() =>
                        handleExecuteCopilotAction(
                          `Replace ${act.description} with another nearby experience in ${act.location}`
                        )
                      }
                      onRemove={() => handleRemoveActivity(act, dIdx, aIdx)}
                      isExecutingCopilot={isExecutingCopilot}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT COLUMN: Persistent Sticky Interactive Route Map & Checklist */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
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
            onViewFullRoute={() => setActiveTab('map')}
          />

          <TripChecklist
            checklist={checklist}
            toggleChecklist={toggleChecklist}
          />
        </div>
      </div>

      {/* DOCKED COPILOT ACTION SURFACE (AT BASE OF ITINERARY) */}
      <TripCopilot
        copilotInput={copilotInput}
        setCopilotInput={setCopilotInput}
        isExecutingCopilot={isExecutingCopilot}
        copilotError={copilotError}
        setCopilotError={setCopilotError}
        pendingProposal={pendingProposal}
        lastDiffResult={lastDiffResult}
        onExecuteAction={handleExecuteCopilotAction}
        onApplyProposal={handleApplyProposal}
        onRejectProposal={handleRejectProposal}
        onUndoDiff={handleUndoCopilotDiff}
        onDismissDiff={() => {}}
      />
    </div>
  );
};
