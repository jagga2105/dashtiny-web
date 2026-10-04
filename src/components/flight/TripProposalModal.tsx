'use client';

import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/formatCurrency';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

interface TripProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProposal: {
    id: string;
    parent_version: number;
    changes?: {
      flight_offer?: {
        offer_id: string;
        airline: string;
        flight_number: string;
        price: number;
        currency: string;
        origin: string;
        destination: string;
        departure_time: string;
        provenance?: string;
        availability_state?: string;
      };
    };
  } | null;
  onAccept: () => void;
  isSubmitting: boolean;
}

export function TripProposalModal({
  isOpen,
  onClose,
  activeProposal,
  onAccept,
  isSubmitting,
}: TripProposalModalProps) {
  const { containerRef } = useAccessibleModal({ isOpen, onClose });

  if (!isOpen || !activeProposal) return null;

  const offer = activeProposal.changes?.flight_offer;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      data-testid="flight-proposal-modal"
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-proposal-title"
        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 focus:outline-none"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div
            id="trip-proposal-title"
            className="flex items-center gap-2 text-slate-900 font-serif-editorial font-bold text-lg"
          >
            <Sparkles className="w-5 h-5 text-orange-500" />
            <span>Trip Proposal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Parent v{activeProposal.parent_version}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close trip proposal dialog"
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          This change will attach the selected transport option to your Trip. No provider booking will occur.
        </p>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex justify-between font-semibold text-slate-800">
            <span>
              {offer?.airline} ({offer?.flight_number})
            </span>
            <span className="font-mono text-orange-600 font-bold">
              {formatCurrency(offer?.price ?? 0, offer?.currency ?? 'INR')}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 text-[11px]">
            <span>
              Route: {offer?.origin} → {offer?.destination}
            </span>
            <span>Dep: {offer?.departure_time}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Provenance:{' '}
              <strong className="text-slate-700">{offer?.provenance || 'CURATED'}</strong>
            </span>
            <span>
              Availability:{' '}
              <strong className="text-slate-700">
                {offer?.availability_state || 'ESTIMATED'}
              </strong>
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-[11px] space-y-1">
          <p className="font-semibold">Selecting a flight does not book it.</p>
          <p className="text-amber-800 leading-relaxed">
            It adds the flight to your Trip after you approve the Trip change. No booking has been made by DashTiny. To complete ticketing and secure seats, proceed to the provider.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs cursor-pointer"
          >
            Discard
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onAccept}
            isLoading={isSubmitting}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer shadow-sm"
            data-testid="accept-proposal-btn"
          >
            Accept Proposal & Update Trip →
          </Button>
        </div>
      </div>
    </div>
  );
}
