'use client';

import React from 'react';
import { Compass, MapPin, Navigation, ExternalLink, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface TripMapProps {
  destination: string;
  selectedDayIdx: number | 'all';
  validPoints: any[];
  mapActivities: any[];
  hasCoordinates: boolean;
  hoveredWaypoint: any;
  setHoveredWaypoint: (wp: any) => void;
  selectedStop: any;
  setSelectedStop: (stop: any) => void;
  getX: (lng: number) => number;
  getY: (lat: number) => number;
  onViewFullRoute?: () => void;
  isFullView?: boolean;
}

export const TripMap: React.FC<TripMapProps> = ({
  destination,
  selectedDayIdx,
  validPoints,
  mapActivities,
  hasCoordinates,
  hoveredWaypoint,
  setHoveredWaypoint,
  selectedStop,
  setSelectedStop,
  getX,
  getY,
  onViewFullRoute,
  isFullView = false,
}) => {
  if (isFullView) {
    return (
      <div className="space-y-6">
        <Card className="p-6 rounded-3xl bg-white border border-slate-200 text-slate-900 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-base font-serif-editorial font-bold text-slate-900">
                {selectedDayIdx === 'all' ? 'All Days Route' : `Day ${selectedDayIdx} Route`}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Trip route · Approximate route based on mapped stops · {destination}
              </p>
            </div>
            <div className="flex flex-col sm:items-end">
              <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                {validPoints.length} of {mapActivities.length} stops mapped
              </span>
              {validPoints.length < mapActivities.length && (
                <span className="text-[10px] text-slate-500 pt-0.5">
                  Some locations still need verified coordinates
                </span>
              )}
            </div>
          </div>

          <div className="relative h-96 w-full my-4 rounded-2xl bg-amber-50/20 border border-slate-100 overflow-hidden">
            {hasCoordinates ? (
              <>
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {validPoints.map((act: any, idx: number) => {
                    if (idx === 0) return null;
                    const prev = validPoints[idx - 1];
                    if (selectedDayIdx === 'all' && act.dayNumber !== prev.dayNumber) {
                      return null;
                    }
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
                        strokeWidth="2.5"
                        strokeDasharray="5 5"
                        strokeOpacity="0.8"
                      />
                    );
                  })}
                </svg>

                {validPoints.map((act: any, idx: number) => {
                  const isSelected = hoveredWaypoint?.id === act.id || hoveredWaypoint?.description === act.description;
                  return (
                    <button
                      key={act.id || idx}
                      type="button"
                      aria-label={`Stop ${act.seqNum || idx + 1}: ${act.description} at ${act.time}`}
                      style={{ left: `${getX(Number(act.lng))}%`, top: `${getY(Number(act.lat))}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 transition-all p-1 min-w-[28px] min-h-[28px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl ${
                        isSelected ? 'scale-125 z-30' : 'hover:scale-110'
                      }`}
                      onClick={() => setHoveredWaypoint(isSelected ? null : act)}
                      onMouseEnter={() => setHoveredWaypoint(act)}
                    >
                      <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shadow-md transition-colors ${
                        isSelected ? 'bg-orange-600 text-white ring-2 ring-orange-400' : 'bg-white text-orange-600 border border-orange-200'
                      }`}>
                        {act.seqNum || idx + 1}
                      </div>
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Compass className="w-10 h-10 text-orange-400 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Coordinates mapped to {destination}</p>
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
    );
  }

  // Sidebar / Sticky view
  return (
    <Card className="p-4 sm:p-5 rounded-3xl bg-slate-950 border border-slate-800 text-white shadow-xl relative overflow-hidden">
      {/* Radar Grid Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0d_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <h4 className="font-serif-editorial font-bold text-xs uppercase tracking-wider text-slate-200">
            Trip route • Day {selectedDayIdx === 'all' ? 'All' : selectedDayIdx}
          </h4>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-mono text-orange-400">
            {validPoints.length} of {mapActivities.length} stops mapped
          </span>
          <span className="text-[9px] text-slate-400">
            Approximate route based on mapped stops
          </span>
        </div>
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
                if (selectedDayIdx === 'all' && act.dayNumber !== prev.dayNumber) {
                  return null;
                }
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
              const isSelected = selectedStop?.id === act.id;

              return (
                <button
                  type="button"
                  key={act.id || idx}
                  style={{ left: `${posX}%`, top: `${posY}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 min-w-[28px] min-h-[28px] flex items-center justify-center p-0.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  aria-label={`Stop ${act.seqNum || idx + 1}: ${act.description} at ${act.location}`}
                  onClick={() => setSelectedStop(selectedStop?.id === act.id ? null : act)}
                  onMouseEnter={() => setHoveredWaypoint(act)}
                  onMouseLeave={() => setHoveredWaypoint(null)}
                  onFocus={() => setHoveredWaypoint(act)}
                  onBlur={() => setHoveredWaypoint(null)}
                >
                  {/* Node badge */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-[11px] transition-all border shadow-md ${
                      isSelected
                        ? 'bg-orange-500 text-white scale-125 border-white ring-4 ring-orange-500/50 z-30'
                        : isHovered
                        ? 'bg-orange-500 text-white scale-115 border-white ring-2 ring-orange-500/50'
                        : 'bg-slate-900 text-orange-400 border-orange-500/60 hover:scale-110'
                    }`}
                  >
                    {act.seqNum || idx + 1}
                  </div>

                  {/* Tooltip on hover/focus when not selected */}
                  {!selectedStop && (
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 bottom-9 w-48 p-2.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-xl text-left pointer-events-none transition-all ${
                        isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                      }`}
                    >
                      <p className="text-[10px] font-mono text-orange-400 font-semibold">{act.time}</p>
                      <p className="text-xs font-semibold text-white truncate">{act.description}</p>
                      <p className="text-[10px] text-slate-400 truncate">{act.location}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <Compass className="w-8 h-8 text-orange-400 mb-2" />
            <p className="text-xs font-semibold text-slate-300">
              Locations cataloged for {destination}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              Waypoints appear as verified coordinates are slotted into this itinerary.
            </p>
          </div>
        )}
      </div>

      {/* Selected Stop Interactive Inspector Card */}
      {selectedStop && (
        <div className="relative z-20 my-2 p-3.5 rounded-2xl bg-slate-900/95 border border-orange-500/40 shadow-xl space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-500 text-white font-bold text-xs flex items-center justify-center">
                {selectedStop.seqNum || validPoints.findIndex((p: any) => p.id === selectedStop.id) + 1}
              </span>
              <div>
                <span className="text-[10px] font-mono text-orange-400 font-semibold uppercase tracking-wider block">
                  {selectedStop.time || 'Scheduled Stop'}
                </span>
                <h5 className="text-xs font-bold text-white leading-tight">
                  {selectedStop.description}
                </h5>
              </div>
            </div>
            <button
              onClick={() => setSelectedStop(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close stop details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <p className="text-slate-300 text-[11px] flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>{selectedStop.location}</span>
            </p>
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
              <span className="text-orange-400 font-semibold">Why it's here: </span>
              {selectedStop.why || selectedStop.notes || `Curated stop slotted in planned sequence for ${destination}.`}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedStop.description} ${selectedStop.location} ${destination}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Navigate in Maps</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
            </a>
            <button
              onClick={() => setSelectedStop(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Map Footer Bar */}
      <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
        <span>Pacing: Planned sequence (DAIna's planned order)</span>
        {onViewFullRoute && (
          <button
            onClick={onViewFullRoute}
            className="text-orange-400 hover:text-orange-300 font-semibold cursor-pointer underline"
          >
            Full Route View →
          </button>
        )}
      </div>
    </Card>
  );
};
