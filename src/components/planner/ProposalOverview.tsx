'use client';

import React from 'react';
import { Sparkles, MapPin, Calendar, Users, Compass, CheckCircle2 } from 'lucide-react';
import { UnifiedProposalData } from './ItineraryProposalReview';

interface ProposalOverviewProps {
  proposal: UnifiedProposalData;
}

export const ProposalOverview: React.FC<ProposalOverviewProps> = ({ proposal }) => {
  const capitalizedPace = proposal.pace
    ? proposal.pace.charAt(0).toUpperCase() + proposal.pace.slice(1)
    : 'Balanced';

  // Deterministic "Why this plan fits you" reasons
  const whyReasons = proposal.planning_notes && proposal.planning_notes.length > 0
    ? proposal.planning_notes.slice(0, 4)
    : [
        'Keeps each day geographically compact with minimal transit backtrack',
        `Tailored to your ${proposal.pace} pace with dedicated exploration buffers`,
        proposal.interests && proposal.interests.length > 0
          ? `Prioritizes your interests in ${proposal.interests.join(' & ')}`
          : 'Highlights signature cultural landmarks and verified experiences',
        `Keeps estimated budget within realistic target guardrails`,
      ];

  // Key Highlights reflecting trip character
  const keyHighlights: string[] = [
    `${proposal.destination} Coastal & Heritage Discovery`,
    `Local Culinary & Traditional Flavors`,
    `Signature Sightseeing & Sunset Viewpoints`,
  ];

  return (
    <div className="space-y-4" data-testid="proposal-overview">
      {/* Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/80">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>TRIP PROPOSAL READY FOR REVIEW</span>
        </div>
        <span className="text-[11px] text-stone-600 font-medium">
          Deterministic Plan · Version v0 (Uncommitted)
        </span>
      </div>

      {/* Main Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-stone-900 tracking-tight">
          {proposal.title || `Your ${proposal.destination} getaway`}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-stone-600 font-medium">
          <span>{proposal.destination}</span>
          <span>·</span>
          <span>{proposal.days_count} days</span>
          <span>·</span>
          <span>{proposal.travelers} {proposal.travelers === 1 ? 'traveler' : 'travelers'}</span>
          <span>·</span>
          <span className="text-orange-700 font-semibold">{capitalizedPace}</span>
          {proposal.origin && (
            <>
              <span>·</span>
              <span className="text-stone-500">From {proposal.origin}</span>
            </>
          )}
        </div>
      </div>

      {/* "Why this plan fits you" — Differentiating value proposition */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-orange-50/80 via-amber-50/40 to-white border border-orange-200 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-orange-950 font-sans">
            Why this plan fits you
          </h2>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
          {whyReasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 mt-1.5" />
              <span className="leading-snug">{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Key Highlights */}
      {keyHighlights.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 block">
            Key Highlights:
          </span>
          <div className="flex flex-wrap gap-2 text-xs">
            {keyHighlights.map((hl, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-xl bg-white border border-stone-200 text-stone-800 font-medium shadow-2xs"
              >
                • {hl}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
