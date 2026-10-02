import React from 'react';
import { ShieldCheck, Sparkles, User, Info, Compass, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProvenanceTier =
  | 'VERIFIED'
  | 'CURATED'
  | 'AI_RECOMMENDED'
  | 'ESTIMATED'
  | 'USER_PROVIDED'
  | 'DEMO';

interface TrustBadgeProps {
  tier: ProvenanceTier;
  label?: string;
  source?: string;
  className?: string;
}

export function TrustBadge({ tier, label, source, className }: TrustBadgeProps) {
  switch (tier) {
    case 'VERIFIED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200/80 shadow-2xs',
            className
          )}
          title={source ? `Verified via ${source}` : 'Data obtained from official provider or authoritative source'}
        >
          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>{label || 'Verified'}</span>
          {source && <span className="text-emerald-700 font-normal">· {source}</span>}
        </span>
      );

    case 'CURATED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 text-[10px] font-semibold border border-slate-200 shadow-2xs',
            className
          )}
          title="DashTiny-selected editorial travel recommendations"
        >
          <Compass className="w-3 h-3 text-slate-500 shrink-0" />
          <span>{label || 'Curated'}</span>
        </span>
      );

    case 'AI_RECOMMENDED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 text-[10px] font-semibold border border-orange-200/80 shadow-2xs',
            className
          )}
          title="Personalized recommendation synthesized by DAIna AI based on your preferences"
        >
          <Sparkles className="w-3 h-3 text-orange-600 shrink-0" />
          <span>{label || 'AI Recommended'}</span>
        </span>
      );

    case 'ESTIMATED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 text-[10px] font-semibold border border-sky-200/80 shadow-2xs',
            className
          )}
          title="Calculated projection by DashTiny planning models"
        >
          <Calculator className="w-3 h-3 text-sky-600 shrink-0" />
          <span>{label || 'Estimated'}</span>
        </span>
      );

    case 'USER_PROVIDED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-[10px] font-semibold border border-indigo-200/80 shadow-2xs',
            className
          )}
          title="Contributed by an authentic community explorer"
        >
          <User className="w-3 h-3 text-indigo-600 shrink-0" />
          <span>{label || 'Community Shared'}</span>
        </span>
      );

    case 'DEMO':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-200/80 shadow-2xs',
            className
          )}
          title="Preview sandbox data"
        >
          <Info className="w-3 h-3 text-amber-600 shrink-0" />
          <span>{label || 'Preview Sandbox'}</span>
        </span>
      );
  }
}
