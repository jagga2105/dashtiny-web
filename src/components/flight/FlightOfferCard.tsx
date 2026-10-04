'use client';

import React from 'react';
import {
  Plane,
  Luggage,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Check,
  CheckCircle2,
  Clock,
  Scale,
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
  // Enforce single primary winner label hierarchy:
  // Balanced option > Lowest fare > Fastest
  const primaryBadge = isBalanced ? (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold tracking-wide uppercase"
      title="DashTiny balances fare, travel duration and stops. It is a deterministic comparison heuristic, not an objective best-flight claim."
    >
      <Sparkles className="w-3 h-3 text-orange-600" />
      DashTiny balanced option
    </span>
  ) : isCheapest ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wide uppercase">
      Lowest fare
    </span>
  ) : isFastest ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold tracking-wide uppercase">
      Fastest
    </span>
  ) : null;

  const factualReason = whyThisFits || offer.why_recommended;

  return (
    <div
      className={`p-5 rounded-2xl bg-white border transition-all duration-200 relative ${
        isStale
          ? 'border-slate-200/70 bg-slate-50/40 opacity-80'
          : isSelected
          ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-md'
          : 'border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-sm'
      } ${className}`}
      data-testid={`flight-card-${offer.offer_id}`}
    >
      {/* Badges Header with single winner label hierarchy */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {primaryBadge}
        </div>

        {/* Compare Checkbox / Toggle Button */}
        {onToggleCompare && (
          <button
            type="button"
            onClick={() => onToggleCompare(offer)}
            disabled={isStale || (!isCompared && !canCompare)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              isStale
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                : isCompared
                ? 'bg-orange-100 text-orange-800 border border-orange-300 cursor-pointer'
                : 'bg-slate-100/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 border border-slate-200/60 disabled:opacity-40 cursor-pointer'
            }`}
            data-testid={`compare-checkbox-${offer.offer_id}`}
            aria-pressed={isCompared}
            aria-disabled={isStale}
            title={isStale ? 'Search parameters changed. Update results to compare.' : undefined}
          >
            <Scale className="w-3 h-3" />
            <span className="text-[11px]">{isCompared ? 'Comparing' : 'Compare'}</span>
          </button>
        )}
      </div>

      {/* Main Flight Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-5 items-center">
        {/* Left: Schedule & Route */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200/60 flex items-center justify-center font-bold text-xs text-orange-700">
              {offer.airline ? offer.airline.substring(0, 2).toUpperCase() : 'FL'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{offer.airline}</span>
                <span className="text-xs text-slate-500 font-medium">({offer.flight_number})</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium capitalize">
                {offer.cabin_class ? offer.cabin_class.replace('_', ' ') : 'Economy'} ·{' '}
                {offer.trip_type === 'roundtrip' ? 'Round-trip' : 'One-way'}
              </p>
            </div>
          </div>

          {/* Time & Stops Line: Single-segment or Round-trip legs */}
          {offer.trip_type === 'roundtrip' && offer.inbound ? (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              {/* Outbound leg */}
              <div className="flex items-center justify-between text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block">Outbound</span>
                  <span className="font-bold text-slate-900">{offer.outbound?.origin || offer.origin} → {offer.outbound?.destination || offer.destination}</span>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="font-mono font-semibold text-slate-800">{offer.outbound?.departure_time || offer.departure_time} → {offer.outbound?.arrival_time || offer.arrival_time}</span>
                  <span className="text-[10px] text-slate-500 block">{formatFlightDuration(offer.outbound?.duration_minutes || offer.duration_minutes)}</span>
                </div>
              </div>

              {/* Return leg */}
              <div className="flex items-center justify-between text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Return</span>
                  <span className="font-bold text-slate-900">{offer.inbound.origin} → {offer.inbound.destination}</span>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="font-mono font-semibold text-slate-800">{offer.inbound.departure_time} → {offer.inbound.arrival_time}</span>
                  <span className="text-[10px] text-slate-500 block">{formatFlightDuration(offer.inbound.duration_minutes)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center pt-1">
              {/* Departure */}
              <div>
                <div className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  {offer.departure_time}
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  {offer.origin}
                </div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px]" title={offer.origin_airport?.name}>
                  {offer.origin_airport?.city || offer.origin}
                </div>
              </div>

              {/* Flight Path Graphic */}
              <div className="flex flex-col items-center px-2 min-w-[110px]">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {formatFlightDuration(offer.duration_minutes)}
                </span>
                <div className="w-full flex items-center gap-1 my-1">
                  <div className="h-0.5 flex-1 bg-slate-300" />
                  <Plane className="w-3.5 h-3.5 text-slate-400 shrink-0 transform rotate-90" />
                  <div className="h-0.5 flex-1 bg-slate-300" />
                </div>
                <span className={`text-[11px] font-medium ${offer.stops === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {offer.stops === 0 ? 'Non-stop' : `${offer.stops} stop${offer.stops > 1 ? 's' : ''}`}
                </span>
              </div>

              {/* Arrival */}
              <div className="text-right">
                <div className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  {offer.arrival_time}
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  {offer.destination}
                </div>
                <div className="text-[11px] text-slate-500 truncate max-w-[140px] ml-auto" title={offer.destination_airport?.name}>
                  {offer.destination_airport?.city || offer.destination}
                </div>
              </div>
            </div>
          )}

          {/* Perks & Inclusions */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-600">
            <span
              className="inline-flex items-center gap-1"
              title={offer.baggage ? 'Baggage allowance' : 'Baggage information not provided'}
            >
              <Luggage className="w-3.5 h-3.5 text-slate-400" />
              <span>{offer.baggage || 'Baggage: Not provided'}</span>
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={offer.cancellation ? 'Cancellation policy' : 'Cancellation policy not provided'}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>{offer.cancellation || 'Cancellation: Not provided'}</span>
            </span>
          </div>

          {/* Factual Why This Fits Explanation */}
          {factualReason && (
            <div className="pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Why this is notable
              </span>
              <p className="text-xs font-medium text-slate-700">
                {factualReason.replace(/^💡\s*/, '')}
              </p>
            </div>
          )}
        </div>

        {/* Right: Pricing & CTAs */}
        <div className="flex flex-col md:items-end justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 space-y-3">
          <div className="md:text-right space-y-0.5">
            <span className="text-[11px] text-slate-500 font-medium">Total fare:</span>
            <div className="text-xl sm:text-2xl font-bold font-serif-editorial text-slate-900">
              {formatCurrency(offer.price, offer.currency)}
            </div>
            {offer.passengers > 1 && offer.per_passenger_price && (
              <p className="text-[11px] text-slate-500">
                {formatCurrency(offer.per_passenger_price, offer.currency)} / person
              </p>
            )}
            <div className="flex items-center md:justify-end gap-1 text-[10px] text-slate-500 pt-0.5">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Curated catalog · Estimated fare/schedule</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
            {/* Primary Action: Select Flight to Trip Proposal */}
            <button
              type="button"
              onClick={() => onSelectOffer(offer)}
              disabled={isStale}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-2xs ${
                isStale
                  ? 'bg-slate-200 text-slate-400 border border-slate-300/60 cursor-not-allowed opacity-60'
                  : 'bg-orange-600 hover:bg-orange-700 text-white hover:shadow cursor-pointer'
              }`}
              data-testid={`select-flight-${offer.offer_id}`}
              aria-disabled={isStale}
              title={isStale ? 'Search parameters changed. Update results before selecting.' : undefined}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select Flight</span>
            </button>

            {/* Transparent External Link: Continue to Provider */}
            {offer.deep_link ? (
              isStale ? (
                <span
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-xs font-semibold cursor-not-allowed opacity-50 select-none"
                  title="Search parameters changed. Update results to continue to provider."
                  data-testid={`deep-link-${offer.offer_id}-disabled`}
                  aria-disabled="true"
                >
                  <span>Continue to provider</span>
                  <ExternalLink className="w-3 h-3 text-slate-300" />
                </span>
              ) : (
                <a
                  href={offer.deep_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  title={`Visit official ${offer.airline} portal`}
                  data-testid={`deep-link-${offer.offer_id}`}
                >
                  <span>Continue to provider</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
