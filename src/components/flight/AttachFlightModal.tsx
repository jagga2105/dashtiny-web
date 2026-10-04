'use client';

import React from 'react';
import { Plane, X } from 'lucide-react';
import { FlightOffer } from '@/types/flight';
import { Button } from '@/components/ui/Button';
import { formatFriendlyDate } from '@/lib/formatDate';
import { formatCurrency } from '@/lib/formatCurrency';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

interface AttachFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: FlightOffer | null;
  activeTrips: Array<{ id: string; title?: string; destination: string }>;
  selectedTripId: string;
  onSelectTripId: (id: string) => void;
  departureDate?: string;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function AttachFlightModal({
  isOpen,
  onClose,
  offer,
  activeTrips,
  selectedTripId,
  onSelectTripId,
  departureDate,
  onSubmit,
  isSubmitting,
}: AttachFlightModalProps) {
  const { containerRef } = useAccessibleModal({ isOpen, onClose });

  if (!isOpen || !offer) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      data-testid="attach-flight-modal"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attach-flight-title"
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 focus:outline-none"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div
            id="attach-flight-title"
            className="flex items-center gap-2 text-slate-900 font-serif-editorial font-bold text-base sm:text-lg"
          >
            <Plane className="w-5 h-5 text-orange-500" />
            <span>Attach flight to Trip</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attach flight dialog"
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Trip Context */}
        <div className="space-y-1.5 text-xs">
          <label htmlFor="attach-trip-selector" className="font-semibold text-slate-700">
            Attach this flight to:
          </label>
          {activeTrips.length > 0 ? (
            <select
              id="attach-trip-selector"
              value={selectedTripId}
              onChange={(e) => onSelectTripId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              data-testid="attach-trip-selector"
            >
              {activeTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || t.destination} · {t.destination}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px]">
              No active trips found. Please select or create a trip first to attach transport options.
            </p>
          )}
        </div>

        {/* Flight Info Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="font-semibold text-slate-800">Flight:</div>
          <div className="font-bold text-sm text-slate-900">
            {offer.airline} {offer.flight_number}
          </div>
          <div className="flex items-center justify-between text-slate-600 text-[11px]">
            <span>
              {offer.origin} → {offer.destination}
            </span>
            <span>{formatFriendlyDate(departureDate || offer.departure_time)}</span>
          </div>
          <div className="font-mono text-orange-600 font-bold text-sm pt-1 border-t border-slate-200">
            {formatCurrency(offer.price, offer.currency)} total
          </div>
        </div>

        {/* Catalog Status */}
        <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200/80 text-[11px] text-slate-600 space-y-0.5">
          <span className="font-semibold text-slate-700 block">Catalog status:</span>
          <span>Curated · Estimated availability</span>
        </div>

        {/* Non-Booking Trust Notice */}
        <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
          <p className="font-semibold">Selecting a flight does not book it.</p>
          <p className="text-amber-800 leading-relaxed">
            It adds the flight to your Trip after you approve the Trip change. No booking has been made by DashTiny.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            isLoading={isSubmitting}
            disabled={!selectedTripId && activeTrips.length === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-sm"
            data-testid="create-trip-proposal-btn"
          >
            Create Trip Proposal →
          </Button>
        </div>
      </div>
    </div>
  );
}
