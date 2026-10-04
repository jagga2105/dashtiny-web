'use client';

import React from 'react';
import { X, Check, ExternalLink, Sparkles } from 'lucide-react';
import { FlightOffer } from '@/types/flight';
import { formatFlightDuration } from '@/lib/flight/ranking';
import { formatCurrency } from '@/lib/formatCurrency';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

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
  const { containerRef } = useAccessibleModal({ isOpen, onClose });

  if (!isOpen || !selectedOffers || selectedOffers.length === 0) return null;

  const minPrice = Math.min(...selectedOffers.map((o) => o.price));
  const minDuration = Math.min(...selectedOffers.map((o) => o.duration_minutes));
  const parseBaggageKg = (str?: string | null) => {
    if (!str) return 0;
    const match = str.match(/(\d+)\s*kg/i);
    return match ? parseInt(match[1], 10) : 0;
  };
  const maxBaggage = Math.max(...selectedOffers.map((o) => parseBaggageKg(o.baggage)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="flight-comparison-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 ${className}`}
      data-testid="flight-comparison-modal"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col focus:outline-none"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="space-y-0.5">
            <h2 id="flight-comparison-title" className="text-base sm:text-lg font-bold font-serif-editorial text-slate-900 flex items-center gap-2">
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

            {/* Row 1: Outbound */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Outbound
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`out-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-xs text-slate-800"
              >
                <div className="font-bold text-slate-900">
                  {offer.outbound?.origin || offer.origin} → {offer.outbound?.destination || offer.destination}
                </div>
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                  {offer.outbound?.departure_time || offer.departure_time} → {offer.outbound?.arrival_time || offer.arrival_time}
                </div>
              </div>
            ))}

            {/* Row 2: Return */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Return
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`ret-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-xs text-slate-800"
              >
                {offer.inbound ? (
                  <>
                    <div className="font-bold text-slate-900">
                      {offer.inbound.origin} → {offer.inbound.destination}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                      {offer.inbound.departure_time} → {offer.inbound.arrival_time}
                    </div>
                  </>
                ) : (
                  <span className="text-slate-400 italic">One-way</span>
                )}
              </div>
            ))}

            {/* Row 3: Total fare */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Total fare
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`price-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100"
              >
                <div className="text-base font-bold text-slate-900 font-serif-editorial">
                  {formatCurrency(offer.price, offer.currency)}
                </div>
                {selectedOffers.length > 1 && offer.price === minPrice && (
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                    Lowest fare
                  </span>
                )}
                {offer.passengers > 1 && offer.per_passenger_price && (
                  <div className="text-[10px] text-slate-500">
                    {formatCurrency(offer.per_passenger_price, offer.currency)} / pax
                  </div>
                )}
              </div>
            ))}

            {/* Row 4: Total duration */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Total duration
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`dur-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-800"
              >
                <div>{formatFlightDuration(offer.duration_minutes)}</div>
                {selectedOffers.length > 1 && offer.duration_minutes === minDuration && (
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
                    Shortest journey
                  </span>
                )}
              </div>
            ))}

            {/* Row 5: Stops */}
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

            {/* Row 6: Baggage */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Baggage
            </div>
            {selectedOffers.map((offer) => {
              const weight = parseBaggageKg(offer.baggage);
              const isMoreBaggage = maxBaggage > 0 && weight === maxBaggage && selectedOffers.some((o) => parseBaggageKg(o.baggage) < maxBaggage);
              return (
                <div
                  key={`bag-${offer.offer_id}`}
                  className="pt-2 border-t border-slate-100 text-xs text-slate-700"
                >
                  <div>{offer.baggage || <span className="text-slate-400 italic">Not provided</span>}</div>
                  {isMoreBaggage && (
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
                      More baggage
                    </span>
                  )}
                </div>
              );
            })}

            {/* Row 7: Cancellation */}
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

            {/* Row 8: Catalog provenance */}
            <div className="sticky left-0 bg-white z-20 font-semibold text-xs text-slate-500 pt-2 border-t border-slate-100">
              Catalog provenance
            </div>
            {selectedOffers.map((offer) => (
              <div
                key={`prov-${offer.offer_id}`}
                className="pt-2 border-t border-slate-100 text-[11px] text-slate-600"
              >
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                  {offer.provenance || 'CURATED'} · {offer.availability_state || 'ESTIMATED'}
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
