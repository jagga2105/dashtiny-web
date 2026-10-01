'use client';

import { TrendingDown, ShieldAlert, Award } from 'lucide-react';
import { Badge } from './Badge';

export function PriceForecastBanner() {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-50/80 via-white to-sky-50/80 border border-orange-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden group">
      {/* Background Subtle Shimmer Line */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

      <div className="flex items-center gap-3.5 z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
          <TrendingDown className="w-5 h-5 text-white stroke-[2.5]" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-orange-600 font-sans-editorial flex items-center gap-1">
              <Award className="w-3 h-3 text-orange-500" /> PRICE ALERT
            </span>
            <Badge variant="cyan" className="text-[9px] py-0 px-2 bg-emerald-100 text-emerald-800 border-emerald-300 font-mono font-bold">
              95% ACCURACY
            </Badge>
          </div>
          <h4 className="text-sm sm:text-base font-bold text-slate-900">
            Bengaluru flights are cheapest right now — Save up to ₹1,400.
          </h4>
          <p className="text-xs text-slate-500 font-medium">
            Prices are expected to rise 12% in 3 days. Lock your fare now.
          </p>
        </div>
      </div>

      <button className="shrink-0 px-4 py-2 rounded-xl bg-orange-100/80 hover:bg-orange-200/80 text-orange-800 border border-orange-300/80 text-xs font-bold tracking-wide transition-all z-10 flex items-center gap-1.5 shadow-xs">
        <ShieldAlert className="w-3.5 h-3.5 text-orange-600" />
        <span>Set Price Lock Alert</span>
      </button>
    </div>
  );
}
