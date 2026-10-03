'use client';

import React from 'react';
import { ArrowUpDown, Zap, DollarSign, Clock, Compass } from 'lucide-react';
import { FlightSortOption } from '@/types/flight';

interface FlightSortProps {
  currentSort: FlightSortOption;
  onSortChange: (sort: FlightSortOption) => void;
  className?: string;
}

const SORT_OPTIONS: { id: FlightSortOption; label: string; tooltip: string; icon: any }[] = [
  { id: 'balanced', label: 'Balanced Option', tooltip: 'Direct flight under 3h with balanced price and timing', icon: Compass },
  { id: 'cheapest', label: 'Cheapest', tooltip: 'Lowest total fare', icon: DollarSign },
  { id: 'fastest', label: 'Fastest', tooltip: 'Shortest total flight duration', icon: Zap },
  { id: 'earliest', label: 'Earliest', tooltip: 'Earliest departure time', icon: Clock },
  { id: 'latest', label: 'Latest', tooltip: 'Latest departure time', icon: Clock },
];

export function FlightSort({ currentSort, onSortChange, className = '' }: FlightSortProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl ${className}`}
      data-testid="flight-sort-controls"
    >
      <div className="flex items-center gap-1 px-2.5 py-1 text-slate-500 text-xs font-semibold">
        <ArrowUpDown className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sort:</span>
      </div>

      {SORT_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = currentSort === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSortChange(opt.id)}
            title={opt.tooltip}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-orange-600 shadow-2xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
            data-testid={`sort-${opt.id}`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
