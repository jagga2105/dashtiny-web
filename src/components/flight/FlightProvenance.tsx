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
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs ${className}`}
      data-testid="flight-provenance-banner"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-semibold text-[11px] tracking-wide uppercase">
          <Sparkles className="w-3 h-3 text-amber-600" />
          Curated Catalog
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/80 text-amber-800 font-medium text-[11px] border border-amber-200/60">
          <Clock className="w-3 h-3 text-amber-600" />
          Estimated availability
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-amber-800/90 text-[11px]">
        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>
          These are curated catalog examples, not live airline inventory.
        </span>
      </div>
    </div>
  );
}
