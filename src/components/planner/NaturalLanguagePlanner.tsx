'use client';

import React from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';

interface NaturalLanguagePlannerProps {
  promptText: string;
  onChangePrompt: (text: string) => void;
  onSelectExample: (example: string) => void;
  isGenerating?: boolean;
}

export const POPULAR_PROMPTS = [
  '5 days in Goa from Delhi, relaxed, beaches and seafood',
  'Weekend in Jaipur focused on culture and food',
  '10 days in Japan with temples, nature and photography',
  '7 day relaxed Goa trip from Delhi for two people under 50k, beaches and good food',
];

export const NaturalLanguagePlanner: React.FC<NaturalLanguagePlannerProps> = ({
  promptText,
  onChangePrompt,
  onSelectExample,
  isGenerating = false,
}) => {
  return (
    <div className="space-y-4" data-testid="natural-language-planner">
      <div className="space-y-1">
        <label
          htmlFor="natural-planner-prompt"
          className="text-sm font-serif-editorial font-bold text-slate-900 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-orange-600" />
          <span>Tell DAIna about your trip</span>
        </label>
        <p className="text-xs text-slate-500">
          State your destination, duration, companions, budget, and favorite vibes. DAIna extracts your structured intent instantly.
        </p>
      </div>

      <div className="relative">
        <textarea
          id="natural-planner-prompt"
          value={promptText}
          onChange={(e) => onChangePrompt(e.target.value)}
          disabled={isGenerating}
          rows={3}
          placeholder="e.g. 5 day Goa trip from Delhi for two people under 50k, relaxed, beaches and good food"
          className="w-full text-xs sm:text-sm p-4 rounded-2xl border border-stone-200 bg-white text-slate-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs transition-all resize-none font-medium leading-relaxed"
        />
        {promptText && (
          <button
            type="button"
            onClick={() => onChangePrompt('')}
            className="absolute top-3 right-3 text-stone-400 hover:text-stone-700 text-xs px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Click-to-try Prompt Examples */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
          Try an example:
        </span>
        <div className="flex flex-wrap gap-2">
          {POPULAR_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectExample(prompt)}
              className="text-left text-xs text-stone-700 hover:text-orange-700 bg-stone-100/80 hover:bg-orange-50 px-3 py-1.5 rounded-xl border border-stone-200/80 hover:border-orange-200 transition-all cursor-pointer font-medium"
            >
              &ldquo;{prompt}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
