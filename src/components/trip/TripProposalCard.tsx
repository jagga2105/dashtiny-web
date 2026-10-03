'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface AIDiffChange {
  action: string;
  item?: string;
  from?: string;
  to?: string;
  replacement?: string;
  saving_amount?: number;
  duration_minutes?: number;
  details?: string;
}

export interface CopilotProposal {
  proposalId?: string;
  summary: string;
  changes: AIDiffChange[];
  proposedTrip: any;
  previousTrip: any;
  parentVersion?: number;
  verification?: any;
  provenance?: any;
  budgetImpact?: number;
}

interface TripProposalCardProps {
  proposal: CopilotProposal;
  onAccept: () => void;
  onReject: () => void;
}

export const TripProposalCard: React.FC<TripProposalCardProps> = ({
  proposal,
  onAccept,
  onReject,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 space-y-3 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold flex items-center gap-1.5 text-amber-900">
            <Sparkles className="w-4 h-4 text-orange-600" />
            DAIna suggests: {proposal.summary}
          </span>
          {proposal.parentVersion !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
              Base: v{proposal.parentVersion}
            </span>
          )}
          {proposal.verification && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-300">
              ✓ {proposal.verification.status || 'Verified'}
            </span>
          )}
          {proposal.provenance && (
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-semibold border border-purple-300">
              {proposal.provenance.tier || 'AI_GENERATED'}
            </span>
          )}
          {proposal.budgetImpact !== undefined && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                proposal.budgetImpact < 0
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}
            >
              {proposal.budgetImpact < 0
                ? `Saves ₹${Math.abs(proposal.budgetImpact).toLocaleString('en-IN')}`
                : `+₹${proposal.budgetImpact.toLocaleString('en-IN')}`}
            </span>
          )}
        </div>
        <button
          onClick={onReject}
          className="text-xs text-amber-700 hover:text-amber-950 cursor-pointer"
          aria-label="Dismiss suggestion"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {proposal.changes.map((ch, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-[11px] font-semibold text-slate-800 shadow-2xs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <strong>{ch.action.toUpperCase()}:</strong> {ch.item || ch.details}
            {ch.from && ch.to && <span className="text-slate-500 font-mono">({ch.from} → {ch.to})</span>}
            {ch.saving_amount && <span className="text-emerald-700 font-bold">(Save ₹{ch.saving_amount})</span>}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-amber-200/60">
        <Button
          size="sm"
          onClick={onAccept}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-4 py-1.5 shadow-2xs cursor-pointer"
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs px-3 py-1.5 cursor-pointer"
        >
          Reject
        </Button>
      </div>
    </div>
  );
};
