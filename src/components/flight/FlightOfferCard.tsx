'use client';

import React from 'react';
import {
  Plane,
  Luggage,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Check,
  Clock,
  Plus,
  Info,
} from 'lucide-react';
import { FlightOffer } from '@/types/flight';
import { formatFlightDuration } from '@/lib/flight/ranking';
import { formatCurrency } from '@/lib/formatCurrency';

interface FlightOfferCardProps {
  offer: FlightOffer;
  isCompared?: boolean;
  canCompare?: boolean;
  onToggleCompare?: (offer: FlightOffer) => void;
  onSelectOffer: (offer: FlightOffer) => void;
  isSelected?: boolean;
  isBalanced?: boolean;
  isCheapest?: boolean;
  isFastest?: boolean;
  whyThisFits?: string | null;
  isStale?: boolean;
  className?: string;
}

export function FlightOfferCard({
  offer,
  isCompared = false,
  canCompare = true,
  onToggleCompare,
  onSelectOffer,
  isSelected = false,
  isBalanced = false,
  isCheapest = false,
  isFastest = false,
  whyThisFits,
  isStale = false,
  className = '',
}: FlightOfferCardProps) {
  // Decision winner badge hierarchy (single winner label)
  const primaryBadge = isBalanced ? (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold tracking-wide uppercase"
      title="DashTiny balances fare, travel duration and stops. It is a deterministic comparison heuristic, not an objective best-flight claim."
    >
      <Sparkles className="w-3 h-3 text-orange-600" />
      DashTiny balanced option
    </span>
  ) : isCheapest ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-800 border border-stone-200 text-[10px] font-bold tracking-wide uppercase">
      Lowest fare
    </span>
  ) : isFastest ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-800 border border-stone-200 text-[10px] font-bold tracking-wide uppercase">
      Fastest
    </span>
  ) : null;

  const factualReason = whyThisFits || offer.why_recommended;

  // Extract initials for airline mark
  const airlineInitials = offer.airline
    ? offer.airline
        .split(' ')
        .map((w) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'FL';

  return (
    <div
      className={`p-5 sm:p-6 rounded-3xl bg-white border transition-all duration-200 relative ${
        isStale
          ? 'border-stone-200/70 bg-stone-50/50 opacity-75'
          : isSelected
          ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-md'
          : 'border-stone-200/90 shadow-2xs hover:border-stone-300 hover:shadow-sm'
      } ${className}`}
      data-testid={`flight-card-${offer.offer_id}`}
    >
      {/* Card Header: Airline, Flight Number, Badges, Compare Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3 mb-4">
        {/* Left: Airline mark + Details */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-xs text-stone-700 tracking-wider shrink-0"
            aria-hidden="true"
          >
            {airlineInitials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-stone-900">{offer.airline}</span>
              <span className="text-xs text-stone-400 font-medium">· {offer.flight_number}</span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium capitalize">
              {offer.cabin_class ? offer.cabin_class.replace('_', ' ') : 'Economy'} ·{' '}
              {offer.trip_type === 'roundtrip' ? 'Round trip' : 'One way'}
            </p>
          </div>
        </div>

        {/* Right: Winner Badge & Compare Toggle */}
        <div className="flex items-center gap-2">
          {primaryBadge}

          {onToggleCompare && (
            <button
              type="button"
              onClick={() => onToggleCompare(offer)}
              disabled={isStale || (!isCompared && !canCompare)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isStale
                  ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-50'
                  : isCompared
                  ? 'bg-orange-100 text-orange-900 border border-orange-300 shadow-2xs'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200/80 disabled:opacity-40'
              }`}
              data-testid={`compare-checkbox-${offer.offer_id}`}
              aria-pressed={isCompared}
              aria-disabled={isStale}
              title={isStale ? 'Search parameters changed. Update results to compare.' : undefined}
            >
              {isCompared ? <Check className="w-3 h-3 text-orange-600" /> : <Plus className="w-3 h-3" />}
              <span className="text-[11px]">{isCompared ? 'Compared' : 'Compare'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Flight Timeline + Right Price & CTAs */}
      <div className="flex flex-col md:flex-row items-stretch gap-6 pt-1">
        {/* Left: Visual Timeline */}
        <div className="flex-1 min-w-0 space-y-3.5">
          {offer.trip_type === 'roundtrip' && offer.inbound ? (
            /* Round-trip explicit legs */
            <div className="space-y-3">
              {/* Outbound Leg */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block">
                    Outbound
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">
                    {offer.outbound?.departure_time || offer.departure_time} → {offer.outbound?.arrival_time || offer.arrival_time}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-[80px]">
                    <div className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tracking-tight">
                      {offer.outbound?.departure_time || offer.departure_time}
                    </div>
                    <div className="text-xs font-semibold text-stone-800">
                      {offer.outbound?.origin || offer.origin}
                      <span className="font-normal text-stone-500 ml-1">
                        ({offer.origin_airport?.city || offer.origin})
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center px-2 max-w-[160px]">
                    <span className="text-[11px] font-semibold text-stone-500">
                      {formatFlightDuration(offer.outbound?.duration_minutes || offer.duration_minutes)}
                    </span>
                    <div className="w-full flex items-center gap-1.5 my-1">
                      <div className="h-px flex-1 bg-stone-300" />
                      <Plane className="w-3.5 h-3.5 text-stone-400 shrink-0 transform rotate-90" />
                      <div className="h-px flex-1 bg-stone-300" />
                    </div>
                    <span className="text-[10px] font-medium text-stone-600">
                      {offer.stops === 0 ? 'Direct' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  <div className="min-w-[80px] text-right">
                    <div className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tracking-tight">
                      {offer.outbound?.arrival_time || offer.arrival_time}
                    </div>
                    <div className="text-xs font-semibold text-stone-800">
                      {offer.outbound?.destination || offer.destination}
                      <span className="font-normal text-stone-500 ml-1">
                        ({offer.destination_airport?.city || offer.destination})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Return Leg */}
              <div className="space-y-1 pt-3 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                    Return
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">
                    {offer.inbound.departure_time} → {offer.inbound.arrival_time}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-[80px]">
                    <div className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tracking-tight">
                      {offer.inbound.departure_time}
                    </div>
                    <div className="text-xs font-semibold text-stone-800">
                      {offer.inbound.origin}
                      <span className="font-normal text-stone-500 ml-1">
                        ({offer.destination_airport?.city || offer.inbound.origin})
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center px-2 max-w-[160px]">
                    <span className="text-[11px] font-semibold text-stone-500">
                      {formatFlightDuration(offer.inbound.duration_minutes || offer.duration_minutes)}
                    </span>
                    <div className="w-full flex items-center gap-1.5 my-1">
                      <div className="h-px flex-1 bg-stone-300" />
                      <Plane className="w-3.5 h-3.5 text-stone-400 shrink-0 transform -rotate-90" />
                      <div className="h-px flex-1 bg-stone-300" />
                    </div>
                    <span className="text-[10px] font-medium text-stone-600">
                      {offer.inbound.stops === 0 ? 'Direct' : `${offer.inbound.stops} stop`}
                    </span>
                  </div>

                  <div className="min-w-[80px] text-right">
                    <div className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tracking-tight">
                      {offer.inbound.arrival_time}
                    </div>
                    <div className="text-xs font-semibold text-stone-800">
                      {offer.inbound.destination}
                      <span className="font-normal text-stone-500 ml-1">
                        ({offer.origin_airport?.city || offer.inbound.destination})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* One-way single timeline */
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="min-w-[80px]">
                <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono tracking-tight">
                  {offer.departure_time}
                </div>
                <div className="text-xs font-semibold text-stone-800 mt-0.5">
                  {offer.origin}
                  <span className="font-normal text-stone-500 ml-1">
                    ({offer.origin_airport?.city || offer.origin})
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 truncate max-w-[140px]">
                  {offer.origin_airport?.name}
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center px-4 max-w-[180px]">
                <span className="text-xs font-semibold text-stone-600 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-400" />
                  {formatFlightDuration(offer.duration_minutes)}
                </span>
                <div className="w-full flex items-center gap-1.5 my-1.5">
                  <div className="h-px flex-1 bg-stone-300" />
                  <Plane className="w-3.5 h-3.5 text-stone-400 shrink-0 transform rotate-90" />
                  <div className="h-px flex-1 bg-stone-300" />
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    offer.stops === 0 ? 'text-stone-800' : 'text-amber-800'
                  }`}
                >
                  {offer.stops === 0 ? 'Direct' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`}
                </span>
              </div>

              <div className="min-w-[80px] text-right">
                <div className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono tracking-tight">
                  {offer.arrival_time}
                </div>
                <div className="text-xs font-semibold text-stone-800 mt-0.5">
                  {offer.destination}
                  <span className="font-normal text-stone-500 ml-1">
                    ({offer.destination_airport?.city || offer.destination})
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 truncate max-w-[140px] ml-auto">
                  {offer.destination_airport?.name}
                </div>
              </div>
            </div>
          )}

          {/* Perks & Provenance info line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 border-t border-stone-100 text-xs text-stone-600">
            <span
              className="inline-flex items-center gap-1"
              title={offer.baggage ? 'Baggage allowance' : 'Baggage information not provided'}
            >
              <Luggage className="w-3.5 h-3.5 text-stone-400" />
              <span>{offer.baggage || 'Baggage: Not provided'}</span>
            </span>

            <span className="text-stone-300">·</span>

            <span
              className="inline-flex items-center gap-1"
              title={offer.cancellation ? 'Cancellation policy' : 'Cancellation policy not provided'}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
              <span>{offer.cancellation || 'Cancellation: Not provided'}</span>
            </span>

            <span className="text-stone-300">·</span>

            <span className="inline-flex items-center gap-1 text-stone-500" title="This option comes from DashTiny's curated travel catalog. Fare and availability are estimated.">
              <Clock className="w-3 h-3 text-stone-400" />
              <span>Curated catalog · Estimated</span>
            </span>
          </div>

          {/* Factual Recommendation Explanation */}
          {factualReason && (
            <div className="text-xs font-medium text-stone-700 flex items-start gap-1.5 pt-0.5">
              <span className="text-orange-600 font-bold">Why notable:</span>
              <span>{factualReason.replace(/^💡\s*/, '')}</span>
            </div>
          )}
        </div>

        {/* Right: Price & Primary Action */}
        <div className="w-full md:w-52 shrink-0 flex flex-col justify-between items-start md:items-end border-t md:border-t-0 md:border-l border-stone-100 pt-4 md:pt-0 md:pl-6 space-y-3.5">
          <div className="md:text-right space-y-0.5 w-full">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Total fare</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-mono tracking-tight">
              {formatCurrency(offer.price, offer.currency)}
            </div>
            {offer.passengers > 1 && offer.per_passenger_price && (
              <p className="text-[11px] text-stone-500 font-medium">
                {formatCurrency(offer.per_passenger_price, offer.currency)} per traveler
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 w-full">
            {/* Primary Action: Select Flight */}
            <button
              type="button"
              onClick={() => onSelectOffer(offer)}
              disabled={isStale}
              className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-2xs ${
                isStale
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed opacity-60'
                  : 'bg-orange-600 hover:bg-orange-700 text-white hover:shadow-sm cursor-pointer'
              }`}
              data-testid={`select-flight-${offer.offer_id}`}
              aria-disabled={isStale}
              title={isStale ? 'Search parameters changed. Update results before selecting.' : undefined}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select flight</span>
            </button>

            {/* Provider External Link */}
            {offer.deep_link ? (
              isStale ? (
                <span
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-400 text-xs font-semibold cursor-not-allowed opacity-50 select-none text-center"
                  data-testid={`deep-link-${offer.offer_id}-disabled`}
                  aria-disabled="true"
                >
                  <span>Continue to provider</span>
                  <ExternalLink className="w-3 h-3 text-stone-300" />
                </span>
              ) : (
                <a
                  href={offer.deep_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer text-center"
                  data-testid={`deep-link-${offer.offer_id}`}
                >
                  <span>Continue to provider</span>
                  <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
