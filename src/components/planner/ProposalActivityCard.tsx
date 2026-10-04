'use client';

import React from 'react';
import {
  Clock,
  MapPin,
  Utensils,
  Camera,
  Compass,
  Footprints,
  Car,
  Building,
  ShieldCheck,
  Tag,
  DollarSign,
} from 'lucide-react';
import { StructuredActivity } from './ItineraryProposalReview';

interface ProposalActivityCardProps {
  activity: StructuredActivity;
  currency?: string;
}

export const ProposalActivityCard: React.FC<ProposalActivityCardProps> = ({
  activity,
  currency = 'INR',
}) => {
  const isRestaurant =
    activity.place_type === 'R' ||
    activity.placeType === 'R' ||
    activity.title?.toLowerCase().includes('lunch') ||
    activity.title?.toLowerCase().includes('dinner') ||
    activity.title?.toLowerCase().includes('breakfast');

  const cost = activity.cost ?? activity.estimated_cost ?? activity.cost_estimate ?? 0;
  const duration = activity.duration_minutes || 60;
  const transitTime = activity.transit_time_minutes || 0;
  const transitMode = activity.transit_mode || 'transit';
  const whyRecommended = activity.why_recommended || activity.whyRecommended;
  const provenance = activity.provenance || 'CURATED';

  const formatCost = (val: number) => {
    if (val === 0) return 'Free';
    return currency === 'INR' ? `₹${val.toLocaleString('en-IN')}` : `${currency} ${val.toLocaleString()}`;
  };

  return (
    <div
      className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:border-stone-300 transition-all space-y-3"
      data-testid={`activity-card-${activity.id || activity.title}`}
    >
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200/80">
            {activity.time || 'Flexible'}
          </span>
          <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-stone-400" />
            <span>{duration} min</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
            {isRestaurant ? 'Dining' : 'Attraction'}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            {provenance}
          </span>
        </div>
      </div>

      {/* Title & Location */}
      <div className="space-y-1">
        <h4 className="text-sm sm:text-base font-bold text-stone-900 leading-snug">
          {activity.title}
        </h4>
        {activity.description && (
          <p className="text-xs text-stone-600 leading-relaxed">
            {activity.description}
          </p>
        )}
        <div className="flex items-center gap-1 text-xs text-stone-500 pt-0.5">
          <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="truncate">{activity.location}</span>
        </div>
      </div>

      {/* Transit info if transit is required */}
      {transitTime > 0 && (
        <div className="text-[11px] font-medium text-stone-500 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-100 flex items-center gap-2">
          {transitMode === 'walk' ? (
            <Footprints className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          ) : (
            <Car className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          )}
          <span>Estimated transit: {transitTime} min via {transitMode}</span>
        </div>
      )}

      {/* Why Recommended: Deterministic explanation */}
      {whyRecommended && (
        <div className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-100 text-xs text-stone-700 leading-relaxed">
          <span className="font-semibold text-orange-900">Why recommended: </span>
          <span>{whyRecommended}</span>
        </div>
      )}

      {/* Bottom Cost Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-xs text-stone-600">
        <span>Estimated Cost</span>
        <span className="font-bold text-stone-900">{formatCost(cost)}</span>
      </div>
    </div>
  );
};
