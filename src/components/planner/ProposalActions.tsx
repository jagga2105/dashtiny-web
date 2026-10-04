'use client';

import React from 'react';
import { CheckCircle2, Sparkles, Sliders, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ProposalActionsProps {
  onAccept: () => void;
  onToggleRefine: () => void;
  onEditPreferences: () => void;
  onReject: () => void;
  isAccepting: boolean;
  isRefiningOpen?: boolean;
}

export const ProposalActions: React.FC<ProposalActionsProps> = ({
  onAccept,
  onToggleRefine,
  onEditPreferences,
  onReject,
  isAccepting,
  isRefiningOpen = false,
}) => {
  return (
    <div
      className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      data-testid="proposal-actions"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={onAccept}
          disabled={isAccepting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-sm cursor-pointer flex items-center gap-2"
        >
          {isAccepting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />
              <span>Creating Trip...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Accept Itinerary</span>
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onToggleRefine}
          className={`text-xs font-semibold px-4 py-3 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all ${
            isRefiningOpen
              ? 'bg-orange-50 text-orange-900 border-orange-300 ring-2 ring-orange-500/20'
              : 'text-stone-700 hover:bg-stone-50 border-stone-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          <span>Refine with DAIna</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onEditPreferences}
          className="text-stone-700 hover:bg-stone-50 border-stone-200 text-xs font-semibold px-4 py-3 rounded-xl cursor-pointer flex items-center gap-1.5"
        >
          <Sliders className="w-3.5 h-3.5 text-stone-500" />
          <span>Edit preferences</span>
        </Button>
      </div>

      <button
        type="button"
        onClick={onReject}
        disabled={isAccepting}
        className="text-stone-600 hover:text-rose-600 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1 self-start sm:self-auto"
      >
        <Trash2 className="w-3.5 h-3.5 text-stone-600" />
        <span>Discard</span>
      </button>
    </div>
  );
};
