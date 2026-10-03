'use client';

import React from 'react';
import { Briefcase, Calendar, Users, MapPin, X } from 'lucide-react';

interface ActiveTripSummary {
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
}

export function FlightTripContext({
  activeTrips,
  selectedTripId,
  onSelectTrip,
  onClearTrip,
}: FlightTripContextProps) {
  if (activeTrips.length === 0) return null;

  const currentTrip = activeTrips.find((t) => t.id === selectedTripId);

  return (
    <div
      className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5"
      data-testid="flight-trip-context"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <Briefcase className="w-4 h-4 text-orange-500" />
          <span>Active Trip Context:</span>
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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={selectedTripId}
          onChange={(e) => onSelectTrip(e.target.value)}
          className="flex-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          data-testid="trip-context-selector"
        >
          <option value="">No trip selected (Standalone search)</option>
          {activeTrips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.title || trip.destination} · {trip.destination} ({trip.startDate || 'Dates flexible'})
            </option>
          ))}
        </select>

        {currentTrip && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600 bg-orange-50/60 border border-orange-100 px-3 py-1.5 rounded-xl shrink-0">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-orange-500" />
              {currentTrip.destination}
            </span>
            {currentTrip.startDate && (
              <span className="flex items-center gap-1 border-l border-orange-200 pl-2">
                <Calendar className="w-3 h-3 text-orange-500" />
                {currentTrip.startDate}
              </span>
            )}
            {typeof currentTrip.travellers === 'number' && (
              <span className="flex items-center gap-1 border-l border-orange-200 pl-2">
                <Users className="w-3 h-3 text-orange-500" />
                {currentTrip.travellers} {currentTrip.travellers === 1 ? 'traveler' : 'travelers'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
