'use client';

import React, { useState } from 'react';
import { Sparkles, MessageSquare, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ProposalRevisionInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (instruction: string, targetDay?: number) => void;
  isEditing: boolean;
  daysCount?: number;
  selectedDayNumber?: number;
}

export const SUGGESTED_EDITS = [
  'Make Day 2 more relaxed',
  'Add more local food',
  'Reduce walking',
  'Add nightlife',
  'Make this cheaper',
  'Remove touristy places',
];

export const ProposalRevisionInput: React.FC<ProposalRevisionInputProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isEditing,
  daysCount = 5,
  selectedDayNumber,
}) => {
  const [instruction, setInstruction] = useState('');
  const [targetDay, setTargetDay] = useState<number | undefined>(selectedDayNumber);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim()) return;
    onSubmit(instruction.trim(), targetDay);
    setInstruction('');
  };

  const handleQuickChip = (text: string) => {
    // If the text refers to a day, let targetDay match if parsed
    const dayMatch = text.match(/Day\s*(\d+)/i);
    const day = dayMatch ? parseInt(dayMatch[1], 10) : targetDay;
    onSubmit(text, day);
  };

  return (
    <div
      className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-orange-50/80 via-white to-amber-50/30 border border-orange-200/90 shadow-sm space-y-4 animate-in fade-in"
      data-testid="proposal-revision-input"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-bold text-stone-900">
            Refine Itinerary with DAIna
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
          aria-label="Close revision input"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-stone-600 leading-relaxed">
        Describe changes you&apos;d like. DAIna will generate a new proposal diff for your review without mutating your active state directly.
      </p>

      {/* Suggested Quick Edit Chips */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 block">
          Suggested Edits:
        </span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_EDITS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isEditing}
              onClick={() => handleQuickChip(chip)}
              className="text-xs text-stone-700 hover:text-orange-900 bg-white hover:bg-orange-50 px-3 py-1.5 rounded-xl border border-stone-200 hover:border-orange-200 font-medium transition-all cursor-pointer shadow-2xs"
            >
              + {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Conversational Prompt */}
      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={isEditing}
            placeholder="e.g. Move sunset to beach shack on Day 1, add authentic dinner"
            className="flex-1 text-xs sm:text-sm p-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />

          <select
            value={targetDay ?? ''}
            onChange={(e) => setTargetDay(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="text-xs p-3 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium focus:outline-none sm:w-36"
          >
            <option value="">Whole Trip</option>
            {Array.from({ length: daysCount }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                Day {i + 1} Only
              </option>
            ))}
          </select>

          <Button
            type="submit"
            disabled={isEditing || !instruction.trim()}
            className="bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs px-5 py-3 rounded-xl cursor-pointer shrink-0"
          >
            {isEditing ? 'Refining...' : 'Propose Revision'}
          </Button>
        </div>
      </form>
    </div>
  );
};
