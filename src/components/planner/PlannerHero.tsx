'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

interface PlannerHeroProps {
  isAdapting?: boolean;
  destination?: string;
}

export const PlannerHero: React.FC<PlannerHeroProps> = ({ isAdapting }) => {
  return (
    <div className="space-y-2 text-center sm:text-left" data-testid="planner-hero">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-200/80 shadow-2xs">
        <Sparkles className="w-3.5 h-3.5 text-orange-600" />
        <span>
          {isAdapting ? 'Adapt Community Getaway' : 'Intelligent Itinerary Architect'}
        </span>
      </div>
      <h1 className="text-3xl sm:text-4xl font-serif-editorial font-bold text-slate-900 tracking-tight">
        {isAdapting ? 'Customize & Adapt Getaway' : 'Plan your getaway'}
      </h1>
      <p className="text-slate-600 text-xs sm:text-sm max-w-2xl leading-relaxed">
        Describe your trip naturally or refine your exact dates, budget, and travel pace.
        DAIna will assemble a structured day-by-day plan with neighborhood clustering, travel buffers, and budget guardrails.
      </p>
    </div>
  );
};
