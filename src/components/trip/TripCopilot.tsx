'use client';

import React from 'react';
import {
  Sparkles,
  TrendingDown,
  Zap,
  Utensils,
  Sun,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TripProposalCard, CopilotProposal, AIDiffChange } from './TripProposalCard';

interface TripCopilotProps {
  copilotInput: string;
  setCopilotInput: (val: string) => void;
  isExecutingCopilot: boolean;
  copilotError: string | null;
  setCopilotError: (err: string | null) => void;
  pendingProposal: CopilotProposal | null;
  lastDiffResult: { summary: string; changes: AIDiffChange[]; canUndo?: boolean; previousTrip?: any } | null;
  onExecuteAction: (customInstruction?: string) => void;
  onApplyProposal: () => void;
  onRejectProposal: () => void;
  onUndoDiff: () => void;
  onDismissDiff: () => void;
}

export const TripCopilot: React.FC<TripCopilotProps> = ({
  copilotInput,
  setCopilotInput,
  isExecutingCopilot,
  copilotError,
  setCopilotError,
  pendingProposal,
  lastDiffResult,
  onExecuteAction,
  onApplyProposal,
  onRejectProposal,
  onUndoDiff,
  onDismissDiff,
}) => {
  return (
    <Card className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <Sparkles className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h3 className="font-serif-editorial font-bold text-slate-900 text-sm">
              ✨ What would you like to change?
            </h3>
            <p className="text-xs text-slate-500">
              Tell DAIna how to adjust your trip. DAIna will update your trip and show you what changed.
            </p>
          </div>
        </div>

        {/* Quick suggestion chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { label: 'Make tomorrow cheaper', icon: TrendingDown },
            { label: 'Avoid long walks', icon: Zap },
            { label: 'Add one local food experience', icon: Utensils },
            { label: 'Move beach visit to sunset', icon: Sun },
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isExecutingCopilot}
              onClick={() => onExecuteAction(chip.label)}
              className="px-3 py-1.5 rounded-full bg-slate-50 hover:bg-orange-50 text-slate-700 hover:text-orange-800 border border-slate-200 text-xs font-medium shrink-0 transition-all cursor-pointer disabled:opacity-50"
            >
              ✦ {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="e.g. Add an authentic lunch spot within 10 min walk of our afternoon stop..."
          value={copilotInput}
          onChange={(e) => setCopilotInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onExecuteAction()}
          disabled={isExecutingCopilot}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
        />
        <Button
          onClick={() => onExecuteAction()}
          disabled={isExecutingCopilot || !copilotInput.trim()}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs px-5 py-2.5 shadow-sm cursor-pointer"
        >
          {isExecutingCopilot ? (
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-spin" /> Working out the best option…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> Adjust Trip
            </span>
          )}
        </Button>
      </div>
      {isExecutingCopilot && (
        <p className="text-[11px] text-orange-700 font-medium animate-pulse">Checking your budget and route…</p>
      )}

      {/* Copilot Error Message */}
      {copilotError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between">
          <span>{copilotError}</span>
          <button onClick={() => setCopilotError(null)} className="text-amber-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* DAIna Proposed Changes Review Banner (User Decides before applying) */}
      {pendingProposal && (
        <TripProposalCard
          proposal={pendingProposal}
          onAccept={onApplyProposal}
          onReject={onRejectProposal}
        />
      )}

      {/* Real-time Diff Review Banner (Once applied, with Undo) */}
      {lastDiffResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {lastDiffResult.summary}
            </span>
            <div className="flex items-center gap-2">
              {lastDiffResult.canUndo && (
                <button
                  onClick={onUndoDiff}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded cursor-pointer underline"
                >
                  Undo changes
                </button>
              )}
              <button
                onClick={onDismissDiff}
                className="text-xs text-emerald-700 hover:text-emerald-950 cursor-pointer"
                aria-label="Dismiss banner"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {lastDiffResult.changes.map((ch, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-semibold text-slate-800 shadow-2xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <strong>{ch.action.toUpperCase()}:</strong> {ch.item || ch.details}
                {ch.from && ch.to && <span className="text-slate-500 font-mono">({ch.from} → {ch.to})</span>}
                {ch.saving_amount && <span className="text-emerald-700 font-bold">(Saved ₹{ch.saving_amount})</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
