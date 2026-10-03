'use client';

import React from 'react';
import { Briefcase, Calendar, Users, MapPin, X, ArrowRight, Sparkles } from 'lucide-react';

export interface ActiveTripSummary {
  id: string;
  title: string;
  destination: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  travellers?: number;
}

interface FlightTripContextProps {
  activeTrips: ActiveTripSummary[];
  selectedTripId: string;
  onSelectTrip: (tripId: string) => void;
  onClearTrip?: () => void;
  onApplyTripDates?: (start: string, end?: string) => void;
  onApplyTripTravelers?: (travelers: number) => void;
  suggestedAirport?: { iata_code: string; name: string; city: string } | null;
  onApplySuggestedAirport?: (iata_code: string) => void;
  className?: string;
}

export function FlightTripContext({
  activeTrips,
  selectedTripId,
  onSelectTrip,
  onClearTrip,
  onApplyTripDates,
  onApplyTripTravelers,
  suggestedAirport,
  onApplySuggestedAirport,
  className = '',
}: FlightTripContextProps) {
  if (activeTrips.length === 0) return null;

  const currentTrip = activeTrips.find((t) => t.id === selectedTripId);

  return (
    <div
      className={`p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 ${className}`}
      data-testid="flight-trip-context"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
          <Briefcase className="w-4 h-4 text-orange-500" />
          <span>Active Trip Context</span>
          {currentTrip && (
            <span className="text-[11px] font-normal text-slate-500">
              · Planning from your Trip
            </span>
          )}
        </div>
        {selectedTripId && onClearTrip && (
          <button
            type="button"
            onClick={onClearTrip}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
            title="Search flights without trip attachment"
          >
            <X className="w-3 h-3" />
            Unlink trip
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Trip Selector Dropdown */}
        <div className="flex-1 min-w-[260px]">
          <select
            value={selectedTripId}
            onChange={(e) => onSelectTrip(e.target.value)}
            className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            data-testid="trip-context-selector"
          >
            <option value="">No trip selected (Standalone search)</option>
            {activeTrips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title || trip.destination} · {trip.destination} ({trip.startDate || 'Dates flexible'})
              </option>
            ))}
          </select>
        </div>

        {/* Current Trip Metadata & Quick Actions */}
        {currentTrip && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Route */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl">
              <MapPin className="w-3.5 h-3.5 text-orange-500" />
              <span>{currentTrip.origin || 'Any Origin'}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span>{currentTrip.destination}</span>
            </div>

            {/* Dates Action */}
            {currentTrip.startDate && (
              <div className="flex items-center gap-1">
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {currentTrip.startDate} {currentTrip.endDate ? `– ${currentTrip.endDate}` : ''}
                </span>
                {onApplyTripDates && (
                  <button
                    type="button"
                    onClick={() => onApplyTripDates(currentTrip.startDate!, currentTrip.endDate)}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    title="Populate search form with trip dates"
                  >
                    Use Trip dates
                  </button>
                )}
              </div>
            )}

            {/* Travelers Action */}
            {typeof currentTrip.travellers === 'number' && currentTrip.travellers > 0 && (
              <div className="flex items-center gap-1">
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                  <Users className="w-3 h-3 text-slate-400" />
                  {currentTrip.travellers} {currentTrip.travellers === 1 ? 'traveler' : 'travelers'}
                </span>
                {onApplyTripTravelers && (
                  <button
                    type="button"
                    onClick={() => onApplyTripTravelers(currentTrip.travellers!)}
                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    title="Populate passengers count from trip"
                  >
                    Use Trip travelers
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggested Destination Airport Banner (Prevents silent resolution) */}
      {currentTrip && suggestedAirport && (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-orange-50/70 border border-orange-200/80 text-xs text-orange-950"
          data-testid="suggested-airport-banner"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>
              Trip destination is <strong>{currentTrip.destination}</strong>. Suggested primary airport is{' '}
              <strong>{suggestedAirport.name} ({suggestedAirport.iata_code})</strong>.
            </span>
          </div>
          {onApplySuggestedAirport && (
            <button
              type="button"
              onClick={() => onApplySuggestedAirport(suggestedAirport.iata_code)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              Use {suggestedAirport.iata_code}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
