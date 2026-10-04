'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  MapPin,
  Utensils,
  Car,
  CloudRain,
  DollarSign,
  Coffee,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

export interface TripSuggestion {
  id: string;
  category: 'nearby' | 'stay' | 'food' | 'transport' | 'activities' | 'weather' | 'budget';
  title: string;
  description: string;
  rationale: string;
  badgeText: string;
  instruction: string;
  targetDay?: number;
  impact: string;
}

interface TripSuggestionPanelProps {
  currentTrip: any;
  selectedDayIdx: number | 'all';
  onApplySuggestion: (instruction: string, targetDay?: number) => void;
  isExecuting?: boolean;
}

const CATEGORY_TABS: Array<{ id: 'all' | TripSuggestion['category']; label: string; icon: any }> = [
  { id: 'all', label: 'All Intel', icon: Sparkles },
  { id: 'transport', label: 'Transport', icon: Car },
  { id: 'food', label: 'Food & Dining', icon: Utensils },
  { id: 'weather', label: 'Weather', icon: CloudRain },
  { id: 'budget', label: 'Budget', icon: DollarSign },
  { id: 'nearby', label: 'Nearby', icon: Compass },
  { id: 'activities', label: 'Activities', icon: MapPin },
];

export const TripSuggestionPanel: React.FC<TripSuggestionPanelProps> = ({
  currentTrip,
  selectedDayIdx,
  onApplySuggestion,
  isExecuting = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | TripSuggestion['category']>('all');

  const activeDayNum = selectedDayIdx === 'all' ? 1 : selectedDayIdx;
  const activeDayObj = currentTrip.days?.find((d: any) => d.dayNumber === activeDayNum) || currentTrip.days?.[0];

  // Derive intelligent suggestions based on active day and trip attributes
  const suggestions: TripSuggestion[] = useMemo(() => {
    if (!currentTrip) return [];

    const acts = activeDayObj?.activities || [];
    const cluster = activeDayObj?.clusterName || activeDayObj?.cluster_name || currentTrip.destination || 'Local Area';
    const dayTheme = activeDayObj?.dayTheme || activeDayObj?.title || `Day ${activeDayNum}`;
    const totalTransit = acts.reduce((sum: number, a: any) => sum + (a.transitTimeMinutes || a.transit_time_minutes || 15), 0);

    const list: TripSuggestion[] = [];

    // 1. Transport & Route optimization suggestion
    if (totalTransit > 30 || acts.length >= 3) {
      list.push({
        id: `sug_transit_d${activeDayNum}`,
        category: 'transport',
        title: `Reduce Transit in ${cluster}`,
        description: `You're spending ~${totalTransit} mins in transit on Day ${activeDayNum}. Cluster activities to easy walking distance.`,
        rationale: 'Clustering reduces transit fatigue and prevents crossing districts in heavy traffic.',
        badgeText: 'Route Sanity',
        instruction: `Reduce driving and cluster Day ${activeDayNum} activities closer to walking distance`,
        targetDay: activeDayNum,
        impact: 'Saves ~30 min transit',
      });
    }

    // 2. Weather Advisory suggestion
    list.push({
      id: `sug_weather_d${activeDayNum}`,
      category: 'weather',
      title: 'Afternoon Heat & Weather Buffer',
      description: 'Potential peak heat/rain advisory during midday. Shift outdoor walks to sunset and add an indoor retreat.',
      rationale: 'Verified local forecast recommends shaded or coastal ventilation between 13:00 and 15:30.',
      badgeText: 'Advisory Forecast',
      instruction: `Move Day ${activeDayNum} outdoor stops to sunset and add a relaxed indoor cafe break`,
      targetDay: activeDayNum,
      impact: 'Avoids midday heat',
    });

    // 3. Food & Culinary enrichment
    list.push({
      id: `sug_food_d${activeDayNum}`,
      category: 'food',
      title: `Artisan Regional Dining in ${cluster}`,
      description: `Add an authentic local dining stop featuring seasonal specialties within 10m of ${acts[0]?.title || 'your stay'}.`,
      rationale: 'Curated culinary partners with proven authenticity and verified dining hygiene.',
      badgeText: 'Curated Dining',
      instruction: `Add more food and authentic regional tasting in ${cluster} on Day ${activeDayNum}`,
      targetDay: activeDayNum,
      impact: '+1 Culinary Memory',
    });

    // 4. Budget Optimization suggestion
    const budget = currentTrip.totalBudget || currentTrip.total_budget || 0;
    if (budget > 0) {
      list.push({
        id: `sug_budget_d${activeDayNum}`,
        category: 'budget',
        title: 'Budget Allocation Guardrail',
        description: `Swap premium admission stops with scenic public viewpoints to preserve ₹1,800 contingency buffer.`,
        rationale: 'Maintains healthy emergency buffers for spontaneous meals and local cabs.',
        badgeText: 'Budget Guardrail',
        instruction: `Make Day ${activeDayNum} cheaper by swapping high-fee activities with scenic promenades`,
        targetDay: activeDayNum,
        impact: 'Saves ~₹1,800 buffer',
      });
    }

    // 5. Pacing suggestion
    if (acts.length >= 4) {
      list.push({
        id: `sug_pace_d${activeDayNum}`,
        category: 'activities',
        title: `Pacing Adjustment: Day ${activeDayNum}`,
        description: `Day ${activeDayNum} has ${acts.length} stops. Convert afternoon into open leisure time for relaxed exploration.`,
        rationale: 'Relaxed pacing improves emotional satisfaction and avoids travel burnout.',
        badgeText: 'Adaptive Pacing',
        instruction: `Make Day ${activeDayNum} more relaxed with free exploration time`,
        targetDay: activeDayNum,
        impact: 'Unhurried Pacing',
      });
    } else {
      list.push({
        id: `sug_sunset_d${activeDayNum}`,
        category: 'nearby',
        title: `Golden Hour Vista in ${cluster}`,
        description: 'Add a prime sunset vantage point to capture panoramic twilight views before dinner.',
        rationale: 'Top-rated photography location within minimal transit of your evening schedule.',
        badgeText: 'Scenic Vista',
        instruction: `Add a scenic golden hour sunset viewpoint to Day ${activeDayNum}`,
        targetDay: activeDayNum,
        impact: 'Twilight Experience',
      });
    }

    return list;
  }, [currentTrip, activeDayNum, activeDayObj]);

  const filtered = selectedCategory === 'all'
    ? suggestions
    : suggestions.filter((s) => s.category === selectedCategory);

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 font-serif-editorial">
              Contextual Trip Intelligence
            </h4>
            <p className="text-[11px] text-slate-500">
              Proposals tailored to Day {activeDayNum} ({activeDayObj?.clusterName || activeDayObj?.cluster_name || currentTrip.destination || 'Selected Day'})
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200/60 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Non-mutating Diff
        </span>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Suggestion Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {filtered.map((sug) => (
          <div
            key={sug.id}
            className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 hover:border-orange-300 hover:bg-orange-50/20 transition-all space-y-2.5 flex flex-col justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-orange-700 bg-orange-100/70 px-2 py-0.5 rounded-md">
                  {sug.badgeText}
                </span>
                <span className="text-[10px] font-mono font-medium text-slate-500">
                  {sug.impact}
                </span>
              </div>
              <h5 className="text-xs font-bold text-slate-900">{sug.title}</h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">{sug.description}</p>
            </div>

            <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 italic truncate max-w-[160px]">
                {sug.rationale}
              </span>
              <button
                onClick={() => onApplySuggestion(sug.instruction, sug.targetDay)}
                disabled={isExecuting}
                className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                <span>Review Proposal</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
