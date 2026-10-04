'use client';

import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface PlannerGenerateActionProps {
  onClick: () => void;
  isGenerating: boolean;
  generationStepText?: string;
  destination?: string;
  disabled?: boolean;
}

export const PlannerGenerateAction: React.FC<PlannerGenerateActionProps> = ({
  onClick,
  isGenerating,
  generationStepText,
  destination,
  disabled = false,
}) => {
  return (
    <div className="space-y-3 pt-3" data-testid="planner-generate-action">
      <Button
        type="button"
        onClick={onClick}
        disabled={isGenerating || disabled}
        className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm sm:text-base py-4 rounded-2xl shadow-lg shadow-orange-950/20 cursor-pointer flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
        data-testid="create-itinerary-proposal-btn"
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />
            <span>{generationStepText || 'Synthesizing Itinerary Proposal...'}</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
            <span>Create Itinerary Proposal</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-stone-500 text-[11px] font-medium text-center">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Non-mutating proposal · Review, refine, and approve before trip creation</span>
      </div>
    </div>
  );
};
