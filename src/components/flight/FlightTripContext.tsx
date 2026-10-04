'use client';

import React from 'react';
import { Briefcase, Calendar, Users, MapPin, X, ArrowRight, Sparkles } from 'lucide-react';
import { formatFriendlyDateRange } from '@/lib/formatDate';

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
  suggestedOriginAirport?: { iata_code: string; name: string; city: string } | null;
  onApplySuggestedOriginAirport?: (iata_code: string) => void;
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
  suggestedOriginAirport,
  onApplySuggestedOriginAirport,
  suggestedAirport,
  onApplySuggestedAirport,
  className = '',
}: FlightTripContextProps) {
  if (activeTrips.length === 0) return null;

  const currentTrip = activeTrips.find((t) => t.id === selectedTripId);

  return (
    <div
      className={`rounded-2xl bg-stone-100/80 border border-stone-200/70 p-3 sm:px-4 sm:py-2.5 text-xs text-stone-700 space-y-2 ${className}`}
      data-testid="flight-trip-context"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left: Quiet Trip Grounding */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-stone-900">
            <Briefcase className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>Using Trip:</span>
          </div>

          {/* Quick Selector Dropdown */}
          <div className="relative inline-block">
            <select
              value={selectedTripId}
              onChange={(e) => onSelectTrip(e.target.value)}
              className="text-xs font-semibold bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer shadow-2xs"
              data-testid="trip-context-selector"
              aria-label="Select active trip"
            >
              <option value="">No trip selected (Standalone search)</option>
              {activeTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title || trip.destination} · {trip.destination}
                </option>
              ))}
            </select>
          </div>

          {/* Current Trip Metadata */}
          {currentTrip && (
            <div className="flex flex-wrap items-center gap-1.5 text-stone-600">
              <span className="text-stone-300 hidden sm:inline">·</span>
              <span className="font-medium">
                {currentTrip.origin ? `${currentTrip.origin} → ` : ''}
                {currentTrip.destination}
              </span>

              {currentTrip.startDate && (
                <>
                  <span className="text-stone-300">·</span>
                  <span>{formatFriendlyDateRange(currentTrip.startDate, currentTrip.endDate)}</span>
                </>
              )}

              {typeof currentTrip.travellers === 'number' && currentTrip.travellers > 0 && (
                <>
                  <span className="text-stone-300">·</span>
                  <span>
                    {currentTrip.travellers} {currentTrip.travellers === 1 ? 'Traveler' : 'Travelers'}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Context Actions & Unlink */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {currentTrip?.startDate && onApplyTripDates && (
            <button
              type="button"
              onClick={() => onApplyTripDates(currentTrip.startDate!, currentTrip.endDate)}
              className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
              title="Sync search dates with trip dates"
            >
              Use Trip dates
            </button>
          )}

          {typeof currentTrip?.travellers === 'number' && currentTrip.travellers > 0 && onApplyTripTravelers && (
            <button
              type="button"
              onClick={() => onApplyTripTravelers(currentTrip.travellers!)}
              className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
              title="Sync passengers count with trip"
            >
              Use Trip travelers
            </button>
          )}

          {selectedTripId && onClearTrip && (
            <button
              type="button"
              onClick={onClearTrip}
              className="text-[11px] font-medium text-stone-400 hover:text-stone-700 inline-flex items-center gap-0.5 cursor-pointer ml-1"
              title="Search flights without trip attachment"
              aria-label="Unlink trip"
            >
              <X className="w-3 h-3" />
              <span>Unlink trip</span>
            </button>
          )}
        </div>
      </div>

      {/* Suggested Origin Airport Notice */}
      {currentTrip && suggestedOriginAirport && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-200/60 text-[11px] text-stone-700"
          data-testid="suggested-origin-airport-banner"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-orange-600 shrink-0" />
            <span>
              Trip origin = <strong>{suggestedOriginAirport.iata_code} — {suggestedOriginAirport.city || currentTrip.origin}</strong> ({suggestedOriginAirport.name})
            </span>
          </div>
          {onApplySuggestedOriginAirport && (
            <button
              type="button"
              onClick={() => onApplySuggestedOriginAirport(suggestedOriginAirport.iata_code)}
              className="font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
              data-testid="apply-suggested-origin-btn"
            >
              Use {suggestedOriginAirport.iata_code}
            </button>
          )}
        </div>
      )}

      {/* Suggested Destination Airport Notice */}
      {currentTrip && suggestedAirport && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-200/60 text-[11px] text-stone-700"
          data-testid="suggested-airport-banner"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-orange-600 shrink-0" />
            <span>
              Trip destination = <strong>{suggestedAirport.iata_code} — {suggestedAirport.city || currentTrip.destination}</strong> ({suggestedAirport.name})
            </span>
          </div>
          {onApplySuggestedAirport && (
            <button
              type="button"
              onClick={() => onApplySuggestedAirport(suggestedAirport.iata_code)}
              className="font-bold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer"
              data-testid="apply-suggested-dest-btn"
            >
              Use {suggestedAirport.iata_code}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
