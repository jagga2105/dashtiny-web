'use client';

import React from 'react';
import { Sparkles, Sliders, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface IntentSummaryProps {
  destination: string;
  origin?: string;
  daysCount: number;
  travelers: number;
  budget: number;
  currency?: string;
  pace: string;
  interests: string[];
  onToggleCustomize?: () => void;
  isCustomizing?: boolean;
}

export const IntentSummary: React.FC<IntentSummaryProps> = ({
  destination,
  origin,
  daysCount,
  travelers,
  budget,
  currency = 'INR',
  pace,
  interests,
  onToggleCustomize,
  isCustomizing = false,
}) => {
  if (!destination) return null;

  const formattedBudget = currency === 'INR'
    ? `₹${budget.toLocaleString('en-IN')}`
    : `${currency} ${budget.toLocaleString()}`;

  const routeText = origin ? `${origin} → ${destination}` : destination;
  const capitalizedPace = pace.charAt(0).toUpperCase() + pace.slice(1);
  const formattedInterests = interests.length > 0
    ? interests.map((i) => i.charAt(0).toUpperCase() + i.slice(1)).join(' + ')
    : 'Highlights';

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-orange-50/70 via-amber-50/40 to-white border border-orange-200/90 shadow-2xs space-y-4 animate-in fade-in"
      data-testid="understood-intent-card"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-800">
              I understood:
            </h4>
            <p className="text-xs font-semibold text-stone-700">
              {destination} · {daysCount} days · {travelers} travelers · {formattedBudget} target
            </p>
          </div>
        </div>

        {onToggleCustomize && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleCustomize}
            className="text-xs font-semibold border-orange-200 bg-white hover:bg-orange-50 text-orange-900 cursor-pointer shrink-0"
          >
            <Sliders className="w-3.5 h-3.5 mr-1 text-orange-600" />
            <span>{isCustomizing ? 'Hide details' : 'Edit preferences'}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-2.5 rounded-xl bg-white/80 border border-orange-100 space-y-0.5">
          <span className="text-[10px] uppercase font-semibold text-stone-600 block">Route & Duration</span>
          <span className="font-bold text-stone-900">{routeText} · {daysCount} days</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/80 border border-orange-100 space-y-0.5">
          <span className="text-[10px] uppercase font-semibold text-stone-600 block">Party & Target Budget</span>
          <span className="font-bold text-stone-900">{travelers} {travelers === 1 ? 'traveler' : 'travelers'} · {formattedBudget}</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/80 border border-orange-100 space-y-0.5">
          <span className="text-[10px] uppercase font-semibold text-stone-600 block">Pace & Interests</span>
          <span className="font-bold text-stone-900">{capitalizedPace} · {formattedInterests}</span>
        </div>
      </div>
    </div>
  );
};
