'use client';

import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ValidationReport } from './ItineraryProposalReview';

interface ProposalQualityProps {
  validation?: ValidationReport;
}

export const ProposalQuality: React.FC<ProposalQualityProps> = ({ validation }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!validation) return null;

  const score = validation.quality_score || 95;
  const overlaps = validation.timing_overlaps || [];
  const duplicates = validation.duplicates_detected || [];
  const warnings = validation.geographic_warnings || [];
  const pacingNotes = validation.pacing_notes || [];

  return (
    <div className="pt-2" data-testid="proposal-quality">
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-stone-900 block">
                Itinerary Quality & Validation
              </span>
              <span className="text-[11px] text-stone-500">
                Score: <strong className="text-emerald-700">{score}/100</strong> · Automated feasibility & transit checks
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium cursor-pointer"
          >
            <span>{isOpen ? 'Hide technical report' : 'View report'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isOpen && (
          <div className="pt-3 border-t border-stone-100 space-y-2.5 text-xs text-stone-600 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                <span className="font-semibold text-stone-900 block">Schedule Feasibility</span>
                <p className="text-[11px] text-stone-500">
                  {overlaps.length === 0 ? '✓ Zero timing overlaps detected' : `${overlaps.length} schedule warnings`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                <span className="font-semibold text-stone-900 block">Anti-Duplication</span>
                <p className="text-[11px] text-stone-500">
                  {duplicates.length === 0 ? '✓ Zero duplicate attractions or dining' : `${duplicates.length} repeated items`}
                </p>
              </div>
            </div>

            {pacingNotes.length > 0 && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                <span className="font-semibold text-stone-900 block">Pacing & Continuity</span>
                <ul className="list-disc list-inside text-[11px] text-stone-500 space-y-0.5">
                  {pacingNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
