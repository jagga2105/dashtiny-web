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

  const isCurated = provenance?.toUpperCase() === 'CURATED';
  const isEstimated = availabilityState?.toUpperCase() === 'ESTIMATED';

  // Badge text
  const sourceLabel = isCurated ? 'Curated catalog' : provenance;
  const availabilityLabel = isEstimated ? 'Estimated availability' : availabilityState;

  return (
    <div
      className={`relative inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 text-xs ${className}`}
      data-testid="flight-provenance-banner"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>
          {sourceLabel} · {availabilityLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setShowExplanation((prev) => !prev)}
        onMouseEnter={() => setShowExplanation(true)}
        onMouseLeave={() => setShowExplanation(false)}
        aria-expanded={showExplanation}
        className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2 cursor-pointer ml-1 inline-flex items-center gap-0.5"
        data-testid="provenance-why-trigger"
      >
        <span>Why?</span>
        <span aria-hidden="true" className="text-xs font-normal">ⓘ</span>
      </button>

      {showExplanation && (
        <div
          role="tooltip"
          className="absolute z-30 top-full left-0 mt-1.5 p-3.5 w-80 bg-white rounded-xl shadow-xl border border-slate-200 text-xs text-slate-600 space-y-2 animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-1.5 font-bold text-slate-900 border-b border-slate-100 pb-1.5">
            <Info className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>Inventory Provenance</span>
          </div>
          <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
            This option comes from DashTiny&apos;s curated travel catalog. Fare and availability are estimated and should be verified with the provider.
          </p>
          <div className="space-y-1 text-[11px] leading-relaxed pt-1 border-t border-slate-100">
            <p>
              <span className="text-slate-500">Current offer source:</span>{' '}
              <strong className="text-slate-800">
                {isCurated ? 'Curated DashTiny catalog' : provenance}
              </strong>
            </p>
            <p>
              <span className="text-slate-500">Availability:</span>{' '}
              <strong className="text-slate-800">
                {isEstimated ? 'Estimated' : availabilityState}
              </strong>
            </p>
          </div>
          {isCurated && (
            <p className="text-[11px] text-amber-800 bg-amber-50/80 rounded-lg p-2 border border-amber-200/70 leading-relaxed font-medium">
              This is not live airline inventory.
            </p>
          )}
          {retrievedAt && (
            <p className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-100">
              Retrieved: {new Date(retrievedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
