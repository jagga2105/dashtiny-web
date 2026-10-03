'use client';

import React from 'react';
import {
  MapPin,
  MoveHorizontal,
  RefreshCw,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  Utensils,
  Luggage,
  Plane,
  Compass,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface TripActivityCardProps {
  activity: any;
  dayNumber: number;
  dIdx: number;
  aIdx: number;
  isHovered: boolean;
  isWhyOpen: boolean;
  onToggleWhy: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMove: () => void;
  onReplace: () => void;
  onRemove: () => void;
  isExecutingCopilot: boolean;
}

// Helper: map activity place codes to human tags and icons
export const getPlaceCategory = (code?: string) => {
  const c = (code || '').toUpperCase();
  if (c === 'R' || c === 'DINING' || c === 'RESTAURANT') {
    return { label: 'Dining', icon: Utensils, color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  if (c === 'H' || c === 'HOTEL' || c === 'STAY') {
    return { label: 'Stay', icon: Luggage, color: 'text-sky-700 bg-sky-50 border-sky-200' };
  }
  if (c === 'T' || c === 'TRANSIT') {
    return { label: 'Transit', icon: Plane, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
  }
  return { label: 'Activity', icon: Compass, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
};

// Helper: provenance badge
export const getProvenanceBadge = (prov?: string) => {
  const p = (prov || 'CURATED').toUpperCase().replace(' ', '_');
  if (p === 'PROVIDER_VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
        <ShieldCheck className="w-3 h-3 text-emerald-600" />
        Verified
      </span>
    );
  }
  if (p === 'AI_GENERATED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-semibold">
        <Sparkles className="w-3 h-3 text-orange-500" />
        AI Pick
      </span>
    );
  }
  return (
    <span
      title="Curated by DashTiny's travel catalog"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-medium"
    >
      <CheckCircle2 className="w-3 h-3 text-slate-500" />
      Curated
    </span>
  );
};

export const TripActivityCard: React.FC<TripActivityCardProps> = ({
  activity: act,
  dayNumber,
  dIdx,
  aIdx,
  isHovered,
  isWhyOpen,
  onToggleWhy,
  onMouseEnter,
  onMouseLeave,
  onMove,
  onReplace,
  onRemove,
  isExecutingCopilot,
}) => {
  const cat = getPlaceCategory(act.placeType);
  const CatIcon = cat.icon;

  return (
    <Card
      key={act.id || aIdx}
      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isHovered
          ? 'border-orange-500 bg-orange-50/40 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="space-y-3">
        {/* Top Line: Time + Category + Provenance */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
              {act.time}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cat.color}`}>
              <CatIcon className="w-3 h-3" />
              {cat.label}
            </span>
          </div>
          <div>{getProvenanceBadge(act.provenance)}</div>
        </div>

        {/* Middle Content: Title, Location, Cost, Transit */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-900">
            {act.description}
          </h4>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>{act.location}</span>
            </span>
            {act.costEstimate > 0 && (
              <span>• Est: ₹{act.costEstimate}</span>
            )}
            {act.estimatedTransit && (
              <span className="font-mono text-[11px] text-slate-400">
                ({act.estimatedTransit})
              </span>
            )}
          </div>
        </div>

        {/* Subtle Why Section (Collapsible / Subtle Secondary) */}
        {act.whyRecommended && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onToggleWhy}
              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
            >
              <Sparkles className="w-3 h-3 text-orange-500" />
              <span>Why this is here</span>
              {isWhyOpen ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {isWhyOpen && (
              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mt-1.5 leading-relaxed">
                {act.whyRecommended}
              </p>
            )}
          </div>
        )}

        {/* Activity Direct Manipulation Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
          <button
            type="button"
            disabled={isExecutingCopilot}
            onClick={onMove}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer font-medium disabled:opacity-50"
            title="Reschedule this activity"
          >
            <MoveHorizontal className="w-3 h-3 text-slate-500" />
            <span>Move</span>
          </button>
          <button
            type="button"
            disabled={isExecutingCopilot}
            onClick={onReplace}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer font-medium disabled:opacity-50"
            title="Find an alternative activity"
          >
            <RefreshCw className="w-3 h-3 text-slate-500" />
            <span>Replace</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            title="Remove from itinerary (can undo)"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove</span>
          </button>
        </div>
      </div>
    </Card>
  );
};
