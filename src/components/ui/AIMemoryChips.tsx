'use client';

import { useState, useEffect } from 'react';
import {
  Brain,
  X,
  ArmchairIcon,
  TreePine,
  Wallet,
  Sun,
  Salad,
  ChevronRight,
  Check,
} from 'lucide-react';
import Link from 'next/link';

interface Memory {
  id: string;
  label: string;
  source: string;
  icon: React.ReactNode;
}

const defaultMemories: Memory[] = [
  { id: 'm1', icon: <Salad className="w-3.5 h-3.5 text-emerald-600" />, label: 'Vegetarian cuisine', source: 'Based on 2 previous trips' },
  { id: 'm2', icon: <TreePine className="w-3.5 h-3.5 text-emerald-600" />, label: 'Prefers alpine retreats', source: 'From saved destinations' },
  { id: 'm3', icon: <ArmchairIcon className="w-3.5 h-3.5 text-sky-600" />, label: 'Window seats', source: 'From flight preferences' },
  { id: 'm4', icon: <Wallet className="w-3.5 h-3.5 text-orange-500" />, label: 'Budget ₹15k–30k', source: 'From recent getaway queries' },
  { id: 'm5', icon: <Sun className="w-3.5 h-3.5 text-amber-500" />, label: 'Early morning pacing', source: 'From active trip schedule' },
];

const STORAGE_KEY = 'dashtiny_forgotten_memories';

export function AIMemoryChips() {
  const [forgotten, setForgotten] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setForgotten(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore localStorage failure
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const handleForget = (id: string) => {
    setForgotten((prev) => {
      const updated = new Set([...prev, id]);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(updated)));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const visible = defaultMemories.filter((m) => !forgotten.has(m.id));

  if (!isLoaded || visible.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-orange-600" />
          <span className="text-xs font-semibold text-slate-700">
            DAIna remembers
          </span>
        </div>
        <Link
          href="/planner"
          className="text-[11px] text-orange-600 hover:text-orange-700 font-semibold inline-flex items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
        >
          Review preferences
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {visible.map((mem) => (
          <div
            key={mem.id}
            className="flex items-center justify-between gap-2.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-medium shadow-2xs group hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              {mem.icon}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 leading-tight">
                <span className="font-semibold text-slate-900">{mem.label}</span>
                <span className="text-[10px] text-slate-400 font-normal">({mem.source})</span>
              </div>
            </div>

            {/* Accessible WCAG 2.2 Compliant Touch Target (min 28x28px) */}
            <button
              type="button"
              onClick={() => handleForget(mem.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              aria-label={`Forget preference: ${mem.label}`}
              title={`Forget ${mem.label}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
