'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface ChecklistItem {
  id: string;
  task: string;
  done: boolean;
  category: string;
}

interface TripChecklistProps {
  checklist: ChecklistItem[];
  toggleChecklist: (id: string) => void;
}

export const TripChecklist: React.FC<TripChecklistProps> = ({
  checklist,
  toggleChecklist,
}) => {
  return (
    <Card className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h4 className="text-xs font-bold font-serif-editorial text-slate-900">Pre-Trip Checklist</h4>
        <span className="text-[11px] text-orange-600 font-semibold">
          {checklist.filter((c) => c.done).length}/{checklist.length} Done
        </span>
      </div>
      <div className="space-y-1.5">
        {checklist.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggleChecklist(item.id)}
            className={`w-full text-left p-2.5 rounded-xl border flex items-start gap-2.5 transition-all cursor-pointer ${
              item.done
                ? 'bg-emerald-50/40 border-emerald-200 text-slate-400 line-through'
                : 'bg-slate-50 border-slate-200 text-slate-800 font-medium hover:bg-slate-100'
            }`}
          >
            <CheckCircle2
              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${item.done ? 'text-emerald-600' : 'text-slate-300'}`}
            />
            <span className="text-[11px]">{item.task}</span>
          </button>
        ))}
      </div>
    </Card>
  );
};
