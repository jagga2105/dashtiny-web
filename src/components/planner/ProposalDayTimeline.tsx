'use client';

import React from 'react';
import { Sun, Coffee, Sunset, Moon, MapPin, Compass } from 'lucide-react';
import { StructuredDay, StructuredActivity } from './ItineraryProposalReview';
import { ProposalActivityCard } from './ProposalActivityCard';

interface ProposalDayTimelineProps {
  day: StructuredDay;
  currency?: string;
}

export const ProposalDayTimeline: React.FC<ProposalDayTimelineProps> = ({
  day,
  currency = 'INR',
}) => {
  const dayNum = day.day_number || day.day || 1;

  // Activities cleanly partitioned by period_of_day
  const morningActs = day.activities?.filter((a) => {
    if (a.period_of_day) return a.period_of_day === 'morning';
    return a.time?.toLowerCase().includes('am');
  }) || [];

  const afternoonActs = day.activities?.filter((a) => {
    if (a.period_of_day) return a.period_of_day === 'afternoon';
    const isPM = a.time?.toLowerCase().includes('pm');
    const hour = parseInt(a.time || '0', 10);
    return isPM && (hour === 12 || (hour >= 1 && hour < 6));
  }) || [];

  const eveningActs = day.activities?.filter((a) => {
    if (a.period_of_day) return a.period_of_day === 'evening';
    const isPM = a.time?.toLowerCase().includes('pm');
    const hour = parseInt(a.time || '0', 10);
    return isPM && hour >= 6 && hour < 12;
  }) || [];

  // Fallback: if not categorized by period, display in chronological order
  const hasPeriods = morningActs.length > 0 || afternoonActs.length > 0 || eveningActs.length > 0;

  // Count meals & activities
  const mealCount = day.activities?.filter(
    (a) => a.place_type === 'R' || a.title?.toLowerCase().includes('lunch') || a.title?.toLowerCase().includes('dinner')
  ).length || 0;
  const activityCount = (day.activities?.length || 0) - mealCount;

  // Day summary metrics
  const clusterName = day.cluster_name || day.location || 'Local Exploration';
  const movementKm = day.daily_distance_km ? `${day.daily_distance_km} km total local movement` : 'Geographically compact';
  const dayCost = day.daily_estimated_cost
    ? currency === 'INR'
      ? `₹${day.daily_estimated_cost.toLocaleString('en-IN')}`
      : `${currency} ${day.daily_estimated_cost.toLocaleString()}`
    : 'Cost estimated';

  return (
    <div className="space-y-6" data-testid={`proposal-day-timeline-${dayNum}`}>
      {/* Concise Day Summary Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold text-xs flex items-center justify-center">
              {dayNum}
            </span>
            <h3 className="text-base sm:text-lg font-serif-editorial font-bold text-stone-900">
              {day.title || `Day ${dayNum}`}
            </h3>
          </div>
          {day.weather_summary && (
            <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
              {day.weather_summary}
            </span>
          )}
        </div>

        <div className="text-xs font-semibold text-stone-600 flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
          <span className="text-orange-950 font-bold">{clusterName}</span>
          <span>·</span>
          <span>{movementKm}</span>
          <span>·</span>
          <span>{activityCount > 0 ? `${activityCount} activities` : ''}</span>
          {mealCount > 0 && (
            <>
              <span>·</span>
              <span>{mealCount} {mealCount === 1 ? 'meal' : 'meals'}</span>
            </>
          )}
          <span>·</span>
          <span className="text-stone-900">{dayCost} estimated</span>
        </div>
      </div>

      {/* Periods / Activities Timeline */}
      <div className="space-y-5">
        {hasPeriods ? (
          <>
            {morningActs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  <span>Morning</span>
                </div>
                <div className="space-y-3">
                  {morningActs.map((act) => (
                    <ProposalActivityCard key={act.id} activity={act} currency={currency} />
                  ))}
                </div>
              </div>
            )}

            {afternoonActs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-900">
                  <Coffee className="w-3.5 h-3.5 text-orange-600" />
                  <span>Afternoon</span>
                </div>
                <div className="space-y-3">
                  {afternoonActs.map((act) => (
                    <ProposalActivityCard key={act.id} activity={act} currency={currency} />
                  ))}
                </div>
              </div>
            )}

            {eveningActs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-900">
                  <Sunset className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Evening</span>
                </div>
                <div className="space-y-3">
                  {eveningActs.map((act) => (
                    <ProposalActivityCard key={act.id} activity={act} currency={currency} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {day.activities?.map((act) => (
              <ProposalActivityCard key={act.id} activity={act} currency={currency} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
