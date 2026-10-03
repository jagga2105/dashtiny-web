'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { SquadRoomHub } from '@/components/squad/SquadRoomHub';

interface TripBudgetProps {
  currentTrip: any;
  currentTripBookings: any[];
  onOpenInviteModal: () => void;
}

export const TripBudget: React.FC<TripBudgetProps> = ({
  currentTrip,
  currentTripBookings,
  onOpenInviteModal,
}) => {
  const totalBudget = Number(currentTrip.budget || 0);
  const hasBudget = totalBudget > 0;
  const staysEst = hasBudget ? Math.round(totalBudget * 0.45) : 0;
  const diningEst = hasBudget ? Math.round(totalBudget * 0.25) : 0;
  const actsEst = hasBudget ? Math.round(totalBudget * 0.18) : 0;
  const transitEst = hasBudget ? Math.round(totalBudget * 0.12) : 0;

  const allBookings = currentTripBookings;
  const staysBooked = allBookings
    .filter((b: any) => b.category === 'hotel')
    .reduce((acc: number, b: any) => acc + (b.amount || 0), 0);
  const flightsBooked = allBookings
    .filter((b: any) => b.category === 'flight')
    .reduce((acc: number, b: any) => acc + (b.amount || 0), 0);
  const otherBooked = allBookings
    .filter((b: any) => !['hotel', 'flight'].includes(b.category))
    .reduce((acc: number, b: any) => acc + (b.amount || 0), 0);
  const totalBooked = staysBooked + flightsBooked + otherBooked;
  const remainingBudget = hasBudget ? Math.max(0, totalBudget - totalBooked) : 0;

  const budgetCategories = [
    {
      category: 'Stays & Lodging',
      estimated: staysEst,
      pct: hasBudget ? '45%' : '—',
      booked: staysBooked,
      note: staysBooked > 0 ? `₹${staysBooked.toLocaleString('en-IN')} booked` : (hasBudget ? 'Estimated allocation' : 'Pending booking')
    },
    {
      category: 'Dining & Cafes',
      estimated: diningEst,
      pct: hasBudget ? '25%' : '—',
      booked: 0,
      note: 'Daily meals & cafes'
    },
    {
      category: 'Activities & Tours',
      estimated: actsEst,
      pct: hasBudget ? '18%' : '—',
      booked: otherBooked,
      note: otherBooked > 0 ? `₹${otherBooked.toLocaleString('en-IN')} booked` : (hasBudget ? 'Attractions & passes' : 'Pending booking')
    },
    {
      category: 'Transit & Flights',
      estimated: transitEst,
      pct: hasBudget ? '12%' : '—',
      booked: flightsBooked,
      note: flightsBooked > 0 ? `₹${flightsBooked.toLocaleString('en-IN')} booked` : (hasBudget ? 'Corridor transport' : 'Pending booking')
    },
  ];

  return (
    <div className="space-y-6">
      {/* Budget Overview Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif-editorial font-bold text-lg text-slate-900">
              {hasBudget
                ? 'Starting estimate: Category allocation breakdown based on total trip budget'
                : 'Track bookings & expenses for your trip'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {hasBudget
                ? `Proportional heuristic distribution based on your ₹${totalBudget.toLocaleString('en-IN')} trip budget. Actual spend updates as you save bookings.`
                : 'No target budget specified. Actual spend updates below as you save confirmed bookings.'}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Total Trip Budget</span>
            <p className="text-xl font-serif-editorial font-bold text-slate-900">
              {hasBudget ? `₹${totalBudget.toLocaleString('en-IN')}` : 'Not specified'}
            </p>
          </div>
        </div>

        {/* Progress Bar of Committed vs Remaining */}
        <div className="space-y-1.5 pt-2">
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
            <div
              style={{
                width: `${
                  hasBudget
                    ? Math.min(100, Math.round((totalBooked / totalBudget) * 100))
                    : totalBooked > 0
                    ? 100
                    : 0
                }%`,
              }}
              className="h-full bg-emerald-500 transition-all duration-500"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              ₹{totalBooked.toLocaleString('en-IN')} confirmed bookings
            </span>
            <span className="text-slate-500">
              {hasBudget ? `₹${remainingBudget.toLocaleString('en-IN')} remaining` : 'No budget ceiling set'}
            </span>
          </div>
        </div>
      </div>

      {/* Category Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {budgetCategories.map((b, i) => (
          <Card key={i} className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
            <span className="text-[10px] font-semibold uppercase text-slate-400">{b.category}</span>
            <p className="text-xl font-serif-editorial font-bold text-slate-900">
              ₹{b.estimated.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-medium text-slate-600 truncate pr-1">{b.note}</span>
              <span className="font-semibold text-orange-600 shrink-0">{b.pct}</span>
            </div>
          </Card>
        ))}
      </div>

      <SquadRoomHub
        squadId={currentTrip.squad_room_code || currentTrip.id || 'SQUAD-HUB'}
        onOpenInviteModal={onOpenInviteModal}
      />
    </div>
  );
};
