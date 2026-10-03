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
  className = '',
}: FlightOfferCardProps) {
  // Enforce single primary winner label hierarchy:
  // Balanced option > Lowest fare > Fastest
  const primaryBadge = isBalanced ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold tracking-wide uppercase">
      <Sparkles className="w-3 h-3 text-orange-600" />
      Balanced option
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
        isSelected
          ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-md'
          : 'border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-sm'
      } ${className}`}
      data-testid={`flight-card-${offer.offer_id}`}
    >
      {/* Badges Header with single winner label hierarchy */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {primaryBadge}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
            <CheckCircle2 className="w-3 h-3 text-slate-500" />
            Curated catalog
          </span>
        </div>

        {/* Compare Checkbox / Toggle Button */}
        {onToggleCompare && (
          <button
            type="button"
            onClick={() => onToggleCompare(offer)}
            disabled={!isCompared && !canCompare}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isCompared
                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                : 'bg-slate-100/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 border border-slate-200/60 disabled:opacity-40'
            }`}
            data-testid={`compare-checkbox-${offer.offer_id}`}
            aria-pressed={isCompared}
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

          {/* Time & Stops Line */}
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

          {/* Perks & Inclusions */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-600">
            {offer.baggage ? (
              <span className="inline-flex items-center gap-1">
                <Luggage className="w-3.5 h-3.5 text-slate-400" />
                {offer.baggage}
              </span>
            ) : null}
            {offer.cancellation ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                {offer.cancellation}
              </span>
            ) : null}
          </div>

          {/* Factual Why This Fits Explanation */}
          {factualReason && (
            <p className="text-[11px] text-orange-950/80 bg-orange-50/70 border border-orange-100/90 rounded-lg px-2.5 py-1.5 italic">
              💡 {factualReason}
            </p>
          )}
        </div>

        {/* Right: Pricing & CTAs */}
        <div className="flex flex-col md:items-end justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 space-y-3">
          <div className="md:text-right">
            <span className="text-[11px] text-slate-500 font-medium">Total fare:</span>
            <div className="text-xl sm:text-2xl font-bold font-serif-editorial text-slate-900">
              ₹{offer.price.toLocaleString('en-IN')}
            </div>
            {offer.passengers > 1 && offer.per_passenger_price && (
              <p className="text-[11px] text-slate-500">
                ₹{offer.per_passenger_price.toLocaleString('en-IN')} / person
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
            {/* Primary Action: Select Flight to Trip Proposal */}
            <button
              type="button"
              onClick={() => onSelectOffer(offer)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs transition-all shadow-2xs hover:shadow cursor-pointer"
              data-testid={`select-flight-${offer.offer_id}`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select Flight</span>
            </button>

            {/* Transparent External Link: Continue to Provider */}
            {offer.deep_link ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
