'use client';

import React from 'react';
import { Info, Sparkles, Clock } from 'lucide-react';

interface FlightProvenanceProps {
  provenance?: string;
  availabilityState?: string;
  retrievedAt?: string;
  className?: string;
}

export function FlightProvenance({
  provenance = 'CURATED',
  availabilityState = 'ESTIMATED',
  retrievedAt,
  className = '',
}: FlightProvenanceProps) {
  const [showExplanation, setShowExplanation] = React.useState(false);

  return (
    <div
      className={`relative inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 text-xs ${className}`}
      data-testid="flight-provenance-banner"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Curated catalog · estimated availability</span>
      </div>

      <button
        type="button"
        onClick={() => setShowExplanation((prev) => !prev)}
        onMouseEnter={() => setShowExplanation(true)}
        onMouseLeave={() => setShowExplanation(false)}
        aria-expanded={showExplanation}
        className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2 cursor-pointer ml-1"
        data-testid="provenance-why-trigger"
      >
        Why?
      </button>

      {showExplanation && (
        <div
          role="tooltip"
          className="absolute z-30 top-full left-0 mt-1.5 p-3 w-72 bg-white rounded-xl shadow-lg border border-slate-200 text-xs text-slate-600 space-y-1 animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <Info className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>Curated Inventory</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            These are curated travel catalog examples. They are not live airline inventory.
          </p>
        </div>
      )}
    </div>
  );
}
