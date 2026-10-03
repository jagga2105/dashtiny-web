'use client';

import React from 'react';
import { Ticket, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface TripBookingsProps {
  tripId?: string;
  bookings: any[];
  onAddBooking: () => void;
}

export const TripBookings: React.FC<TripBookingsProps> = ({
  tripId,
  bookings,
  onAddBooking,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-serif-editorial font-bold text-slate-900">Tickets & Accommodations</h3>
          <p className="text-xs text-slate-500">Reservations attached to this Trip Workspace</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onAddBooking}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
        >
          + Add Flight or Stay
        </Button>
      </div>

      {bookings.length === 0 ? (
        <Card className="p-8 text-center space-y-3 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <Ticket className="w-10 h-10 text-orange-400 mx-auto" />
          <h4 className="text-base font-semibold text-slate-800">No Reservations Linked Yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Search and compare flights or hotels to attach your confirmed reservation reference to this trip.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={onAddBooking}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs mt-2"
          >
            Compare Flights & Stays
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookings.map((b: any) => {
            const isSavedRef =
              b.status === 'saved_reference' ||
              b.provenance === 'SAVED_REFERENCE' ||
              b.verification === 'UNVERIFIED';

            return (
              <Card key={b.id || b.pnr_ref} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                      isSavedRef
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {isSavedRef ? (
                      <>
                        <Ticket className="w-3 h-3 text-slate-500" />
                        Saved Reference · Unverified
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        {b.status || 'CONFIRMED'}
                      </>
                    )}
                  </span>
                  <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                    Ref: {b.pnr_ref}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900">{b.title}</h4>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <span>Provider: {b.provider}</span>
                  <span className="font-semibold text-orange-600">
                    ₹{b.amount?.toLocaleString('en-IN')}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
