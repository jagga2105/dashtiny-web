'use client';

import React from 'react';
import { X, Check, ExternalLink, Sparkles } from 'lucide-react';
import { FlightOffer } from '@/types/flight';
import { formatFlightDuration } from '@/lib/flight/ranking';
import { formatCurrency } from '@/lib/formatCurrency';

interface FlightComparisonProps {
  selectedOffers: FlightOffer[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveOffer: (offerId: string) => void;
  onSelectOffer: (offer: FlightOffer) => void;
  className?: string;
}

export function FlightComparison({
  selectedOffers = [],
  isOpen,
  onClose,
  onRemoveOffer,
  onSelectOffer,
  className = '',
}: FlightComparisonProps) {
  if (!isOpen || !selectedOffers || selectedOffers.length === 0) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 ${className}`}
      data-testid="flight-comparison-modal"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-bold font-serif-editorial text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Compare Flights Side-by-Side</span>
            </h2>
            <p className="text-xs text-slate-500">
              Comparing {selectedOffers.length} of 3 flights across schedule, pricing, and baggage.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close comparison"
            data-testid="close-comparison-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Comparison Grid with Sticky First Column */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-6 touch-pan-x">
          <div
            className="min-w-[560px] sm:min-w-[640px] grid grid-cols-[120px,repeat(var(--cols),1fr)] sm:grid-cols-[140px,repeat(var(--cols),1fr)] gap-3 sm:gap-4 items-start"
            style={{ '--cols': selectedOffers.length } as React.CSSProperties}
          >
            {/* Header row */}
            <div className="sticky left-0 bg-white z-20 font-bold text-xs text-slate-400 pt-3">
              Flight Offer
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={offer.offer_id}
                className="p-3 rounded-2xl bg-orange-50/50 border border-orange-100 relative"
              >
                <button
                  type="button"
                  onClick={() => onRemoveOffer(offer.offer_id)}
                  className="absolute top-2 right-2 text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer hover:bg-white/80"
                  title="Remove from comparison"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="font-bold text-sm text-slate-900 pr-5 truncate">
                  {offer.airline}
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {offer.flight_number}
                </div>
                <div className="text-[11px] font-semibold text-orange-600 mt-1 capitalize">
                  {offer.cabin_class ? offer.cabin_class.replace('_', ' ') : 'Economy'}
                </div>
              </div>
            ))}

            {/* Row 1: Schedule */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Schedule
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`sched-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-xs text-slate-800"
              >
                <div className="font-bold text-slate-900">
                  {offer.departure_time} → {offer.arrival_time}
                </div>
                <div className="text-[11px] text-slate-500">
                  {offer.origin} to {offer.destination}
                </div>
              </div>
            ))}

            {/* Row 2: Duration */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Duration
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`dur-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-800"
              >
                {formatFlightDuration(offer.duration_minutes)}
              </div>
            ))}

            {/* Row 3: Stops */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Stops
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`stops-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-xs"
              >
                <span
                  className={`font-semibold ${
                    offer.stops === 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {offer.stops === 0 ? 'Non-stop' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`}
                </span>
                {offer.stop_details && offer.stop_details.length > 0 && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Via {offer.stop_details.map((s) => s.airport).join(', ')}
                  </p>
                )}
              </div>
            ))}

            {/* Row 4: Baggage */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Baggage
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`bag-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-xs text-slate-700"
              >
                {offer.baggage || <span className="text-slate-400 italic">Not provided</span>}
              </div>
            ))}

            {/* Row 5: Cancellation Policy */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Cancellation
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`canc-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-xs text-slate-700"
              >
                {offer.cancellation || <span className="text-slate-400 italic">Not provided</span>}
              </div>
            ))}

            {/* Row 6: Total Price */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Total Price
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`price-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100"
              >
                <div className="text-base font-bold text-slate-900 font-serif-editorial">
                  {formatCurrency(offer.price, offer.currency)}
                </div>
                {offer.passengers > 1 && offer.per_passenger_price && (
                  <div className="text-[10px] text-slate-500">
                    {formatCurrency(offer.per_passenger_price, offer.currency)} / pax
                  </div>
                )}
              </div>
            ))}

            {/* Row 7: Provenance */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Catalog Tier
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`prov-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-[11px] text-slate-600"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                  Curated Catalog ({offer.availability_state})
                </span>
              </div>
            ))}

            {/* Action Row */}
            <div className="sticky left-0 bg-white z-20 pt-3 border-t border-slate-100" />
            {selectedOffers.map((offer) => (
              <div
                key={`act-${offer.offer_id}`}
                className="pt-3 border-t border-slate-100 space-y-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectOffer(offer);
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                  data-testid={`comparison-select-${offer.offer_id}`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Select Flight</span>
                </button>
                {offer.deep_link ? (
                  <a
                    href={offer.deep_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <span>Continue to provider</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
