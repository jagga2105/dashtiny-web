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
} from 'lucide-react';

interface Memory {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const defaultMemories: Memory[] = [
  { id: 'm1', icon: <ArmchairIcon className="w-3.5 h-3.5 text-sky-600" />,     label: 'Prefers window seats' },
  { id: 'm2', icon: <TreePine className="w-3.5 h-3.5 text-emerald-600" />,      label: 'Loves mountains' },
  { id: 'm3', icon: <UserRound className="w-3.5 h-3.5 text-slate-500" />,        label: 'Usually travels solo' },
  { id: 'm4', icon: <Wallet className="w-3.5 h-3.5 text-orange-500" />,          label: 'Budget ₹15k–30k' },
  { id: 'm5', icon: <CalendarDays className="w-3.5 h-3.5 text-purple-600" />,   label: 'Prefers 4-day trips' },
  { id: 'm6', icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,            label: 'Early mornings' },
  { id: 'm7', icon: <Salad className="w-3.5 h-3.5 text-green-600" />,           label: 'Vegetarian food' },
];

export function AIMemoryChips() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const visible = defaultMemories.filter(m => !dismissed.has(m.id));
  const shown = showAll ? visible : visible.slice(0, 5);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-1.5">
        <Brain className="w-3.5 h-3.5 text-orange-500" />
        <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500">
          DAIna Preferences
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(mem => (
          <div
            key={mem.id}
            className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full bg-white border border-slate-200/90 text-xs text-slate-700 font-semibold shadow-2xs group hover:border-orange-300 hover:bg-orange-50/50 transition-all"
          >
            {mem.icon}
            <span>{mem.label}</span>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, mem.id]))}
              className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-all"
              aria-label={`Remove ${mem.label}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {!showAll && visible.length > 5 && (
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-all"
          >
            +{visible.length - 5} more
          </button>
        )}
      </div>
    </div>
  );
}
