'use client';

import { useState } from 'react';
import {
  Brain,
  X,
  ArmchairIcon,
  TreePine,
  UserRound,
  Wallet,
  CalendarDays,
  Sun,
  Salad,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

interface Memory {
  id: string;
  label: string;
  source: string;
  icon: React.ReactNode;
}

const defaultMemories: Memory[] = [
  { id: 'm1', icon: <Salad className="w-3.5 h-3.5 text-emerald-600" />, label: 'Vegetarian food', source: 'From previous trip' },
  { id: 'm2', icon: <TreePine className="w-3.5 h-3.5 text-emerald-600" />, label: 'Prefers mountains', source: 'Based on saved destinations' },
  { id: 'm3', icon: <ArmchairIcon className="w-3.5 h-3.5 text-sky-600" />, label: 'Window seats', source: 'From flight preferences' },
  { id: 'm4', icon: <Wallet className="w-3.5 h-3.5 text-orange-500" />, label: 'Budget ₹15k–30k', source: 'From recent searches' },
  { id: 'm5', icon: <Sun className="w-3.5 h-3.5 text-amber-500" />, label: 'Early mornings', source: 'From travel style' },
];

export function AIMemoryChips() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = defaultMemories.filter((m) => !dismissed.has(m.id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">
            DAIna remembers
          </span>
        </div>
        <Link
          href="/planner"
          className="text-[11px] text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-0.5"
        >
          Review preferences
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {visible.map((mem) => (
          <div
            key={mem.id}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-medium shadow-2xs group hover:border-slate-300 transition-colors"
          >
            {mem.icon}
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 leading-tight">
              <span>{mem.label}</span>
              <span className="text-[10px] text-slate-400 font-normal">· {mem.source}</span>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, mem.id]))}
              className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
              aria-label={`Forget ${mem.label}`}
              title="Forget preference"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

