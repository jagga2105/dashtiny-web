'use client';

import React, { useState } from 'react';
import { Wallet, AlertTriangle, ChevronDown, ChevronUp, DollarSign, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BudgetBreakdown } from './ItineraryProposalReview';

interface ProposalBudgetProps {
  budgetBreakdown: BudgetBreakdown;
  targetBudget: number;
  estimatedBudget: number;
  currency?: string;
  onAction?: (actionPrompt: string) => void;
}

export const ProposalBudget: React.FC<ProposalBudgetProps> = ({
  budgetBreakdown,
  targetBudget,
  estimatedBudget,
  currency = 'INR',
  onAction,
}) => {
  const [showDetails, setShowDetails] = useState<boolean>(true);

  const diff = estimatedBudget - targetBudget;
  const isOver = budgetBreakdown?.is_over_budget || diff > 0;
  const overageAmount = budgetBreakdown?.overage_amount || (diff > 0 ? diff : 0);

  const formatAmount = (amt?: number) => {
    const val = amt || 0;
    return currency === 'INR' ? `₹${val.toLocaleString('en-IN')}` : `${currency} ${val.toLocaleString()}`;
  };

  const categories = [
    { key: 'stay', label: 'Accommodations', amount: budgetBreakdown?.accommodation || 0 },
    { key: 'food', label: 'Dining & Food', amount: budgetBreakdown?.food || 0 },
    { key: 'activities', label: 'Activities & Entry', amount: budgetBreakdown?.activities || 0 },
    { key: 'transit', label: 'Local Transit', amount: budgetBreakdown?.local_transport || 0 },
    { key: 'intercity', label: 'Intercity Travel', amount: budgetBreakdown?.intercity_transport || 0 },
    { key: 'buffer', label: 'Buffer & Misc', amount: budgetBreakdown?.miscellaneous || 0 },
  ];

  return (
    <div className="space-y-3" data-testid="proposal-budget">
      {/* Target vs Estimated Comparison Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900">Estimated Trip Budget</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                  ESTIMATED
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Ground costs calculated from destination benchmarks and dining/stay preferences
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-3 text-right">
            <div>
              <span className="text-[10px] uppercase font-semibold text-stone-600 block">Estimated Total</span>
              <span className="text-lg sm:text-xl font-bold font-serif-editorial text-stone-900">
                {formatAmount(estimatedBudget)}
              </span>
            </div>
            <div className="border-l border-stone-200 pl-3">
              <span className="text-[10px] uppercase font-semibold text-stone-600 block">Target Budget</span>
              <span className="text-sm sm:text-base font-semibold text-stone-600">
                {formatAmount(targetBudget)}
              </span>
            </div>
          </div>
        </div>

        {/* Difference calculation & Over-budget Advisory */}
        {isOver && overageAmount > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-950 text-xs space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  Budget Advisory: Itinerary is {formatAmount(overageAmount)} over your target
                </span>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  You&apos;re about {formatAmount(overageAmount)} above target. Choose a refinement action to adjust spend:
                </p>
              </div>
            </div>

            {onAction && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAction('Make this itinerary ₹' + overageAmount.toLocaleString() + ' cheaper')}
                  className="text-xs font-semibold bg-white border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  <DollarSign className="w-3 h-3 mr-1 text-amber-600" />
                  <span>Reduce Cost Proposal</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAction('Keep highlights but reduce accommodation tier')}
                  className="text-xs font-medium bg-white border-amber-200 text-stone-700 hover:bg-amber-50 cursor-pointer"
                >
                  Change stay
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAction('Keep highlights and optimize free sights')}
                  className="text-xs font-medium bg-white border-amber-200 text-stone-700 hover:bg-amber-50 cursor-pointer"
                >
                  Keep highlights
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAction('Reduce number of ticketed activities')}
                  className="text-xs font-medium bg-white border-amber-200 text-stone-700 hover:bg-amber-50 cursor-pointer"
                >
                  Reduce activities
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Compact Categories Grid */}
        <div className="pt-2 border-t border-stone-100">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
              Category Breakdown
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>{showDetails ? 'Hide details' : 'Show details'}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showDetails && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 text-xs">
              {categories.map((cat) => (
                <div key={cat.key} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-0.5">
                  <span className="text-[10px] font-semibold text-stone-500 block truncate">
                    {cat.label}
                  </span>
                  <span className="font-bold text-stone-900 block">
                    {formatAmount(cat.amount)}
                  </span>
                  <span className="text-[9px] font-semibold uppercase text-stone-600">
                    ESTIMATED
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
