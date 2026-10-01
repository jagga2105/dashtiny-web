'use client';

import { useState } from 'react';
import { DollarSign, Plane, Building2, Utensils, Activity, Car, ChevronDown, ChevronUp } from 'lucide-react';

interface Category {
  label: string;
  icon: React.ReactNode;
  spent: number;
  pct: number;
  color: string;
  bgColor: string;
}

interface BudgetManagerWidgetProps {
  totalBudget?: number;
  totalSpent?: number;
}

export function BudgetManagerWidget({
  totalBudget = 45000,
  totalSpent = 23400,
}: BudgetManagerWidgetProps) {
  const [expanded, setExpanded] = useState(true);
  const remaining = totalBudget - totalSpent;
  const spentPct = Math.round((totalSpent / totalBudget) * 100);
  const isOverBudget = remaining < 0;

  const categories: Category[] = [
    { label: 'Flights',   icon: <Plane className="w-3.5 h-3.5" />,     spent: 8500,  pct: 36, color: 'text-blue-300',    bgColor: 'bg-blue-400' },
    { label: 'Hotels',    icon: <Building2 className="w-3.5 h-3.5" />,  spent: 7200,  pct: 31, color: 'text-amber-300',   bgColor: 'bg-amber-400' },
    { label: 'Food',      icon: <Utensils className="w-3.5 h-3.5" />,   spent: 3800,  pct: 16, color: 'text-emerald-300', bgColor: 'bg-emerald-400' },
    { label: 'Activities',icon: <Activity className="w-3.5 h-3.5" />,   spent: 2400,  pct: 10, color: 'text-purple-300',  bgColor: 'bg-purple-400' },
    { label: 'Transport', icon: <Car className="w-3.5 h-3.5" />,        spent: 1500,  pct: 7,  color: 'text-rose-300',    bgColor: 'bg-rose-400' },
  ];

  return (
    <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-left">
            <div className="text-xs font-extrabold text-slate-900">AI Budget Manager</div>
            <div className="text-[10px] text-slate-500 font-medium">Live getaway spend tracker</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-sm font-extrabold ${isOverBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
              ₹{remaining.toLocaleString('en-IN')} left
            </div>
            <div className="text-[10px] text-slate-500 font-bold">{spentPct}% used</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
          {/* Summary row */}
          <div className="pt-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Budget</div>
              <div className="text-lg font-extrabold text-slate-900">₹{totalBudget.toLocaleString('en-IN')}</div>
            </div>
            <div className={`p-3 rounded-2xl border text-center ${isOverBudget ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Remaining</div>
              <div className={`text-lg font-extrabold ${isOverBudget ? 'text-rose-700' : 'text-emerald-700'}`}>
                ₹{Math.abs(remaining).toLocaleString('en-IN')}
                {isOverBudget && <span className="text-[10px] block text-rose-600 font-extrabold">Over budget!</span>}
              </div>
            </div>
          </div>

          {/* Overall bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
              <span>₹{totalSpent.toLocaleString('en-IN')} spent</span>
              <span>{spentPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isOverBudget ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-500 to-amber-500'}`}
                style={{ width: `${Math.min(spentPct, 100)}%` }}
              />
            </div>
          </div>

          {/* Category breakdown */}
          <div className="space-y-2.5">
            {categories.map((cat) => (
              <div key={cat.label} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 flex-shrink-0`}>
                  {cat.icon}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-800 font-bold">{cat.label}</span>
                    <span className="font-extrabold text-slate-900">₹{cat.spent.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cat.bgColor}`}
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 w-7 text-right font-bold">{cat.pct}%</span>
              </div>
            ))}
          </div>

          {/* AI insight */}
          <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-[11px] text-orange-900 font-medium leading-relaxed">
            💡 <strong>DAIna tip:</strong> You&apos;re spending 36% on flights. Shifting to a Wednesday departure could save ₹1,200 more.
          </div>
        </div>
      )}
    </div>
  );
}
