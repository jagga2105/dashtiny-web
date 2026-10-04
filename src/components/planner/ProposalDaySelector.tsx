'use client';

import React from 'react';
import { Calendar, Sun, CloudRain } from 'lucide-react';
import { StructuredDay } from './ItineraryProposalReview';

interface ProposalDaySelectorProps {
  days: StructuredDay[];
  selectedDayNumber: number;
  onSelectDay: (dayNum: number) => void;
}

export const ProposalDaySelector: React.FC<ProposalDaySelectorProps> = ({
  days,
  selectedDayNumber,
  onSelectDay,
}) => {
  return (
    <div className="space-y-2" data-testid="proposal-day-selector">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Daily Schedule ({days.length} Days)
        </span>
        <span className="text-[11px] text-stone-600 sm:hidden">
          Scroll horizontally →
        </span>
      </div>

      {/* Horizontally scrollable day tabs without page overflow */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1">
        {days.map((d) => {
          const dayNum = d.day_number || d.day || 1;
          const isSelected = dayNum === selectedDayNumber;

          return (
            <button
              key={dayNum}
              type="button"
              onClick={() => onSelectDay(dayNum)}
              className={`flex flex-col items-start px-4 py-2.5 rounded-2xl border text-left shrink-0 transition-all cursor-pointer min-w-[120px] ${
                isSelected
                  ? 'bg-orange-600 text-white border-orange-600 shadow-sm ring-2 ring-orange-600/20'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
              data-testid={`day-selector-tab-${dayNum}`}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                  Day {dayNum}
                </span>
                {d.weather_summary && (
                  <span className={`text-[10px] ${isSelected ? 'text-orange-200' : 'text-stone-600'}`}>
                    {d.weather_summary.includes('°C') ? d.weather_summary.split('·')[0].trim() : ''}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-medium truncate max-w-[140px] mt-0.5 ${
                  isSelected ? 'text-orange-100' : 'text-stone-500'
                }`}
              >
                {d.title || `Day ${dayNum}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
