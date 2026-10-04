'use client';

import React from 'react';
import {
  MapPin,
  Calendar,
  Users,
  Wallet,
  Compass,
  Sliders,
  Check,
  Coffee,
  Bed,
  Utensils,
  Clock,
} from 'lucide-react';
import { AirportAutocomplete } from '@/components/location/AirportAutocomplete';
import { AirportLocation } from '@/services/api';

export const INTEREST_OPTIONS = [
  { id: 'food', label: 'Culinary & Food' },
  { id: 'beaches', label: 'Beaches & Coast' },
  { id: 'culture', label: 'Heritage & Culture' },
  { id: 'nature', label: 'Nature & Trails' },
  { id: 'photography', label: 'Photography' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'wellness', label: 'Wellness & Spa' },
];

export const PACE_OPTIONS = [
  {
    id: 'relaxed' as const,
    label: 'Relaxed',
    desc: '2–4 stops/day, leisurely mornings, slow afternoons & rest buffers',
  },
  {
    id: 'balanced' as const,
    label: 'Balanced',
    desc: '3–5 stops/day, core highlights & reasonable walking',
  },
  {
    id: 'packed' as const,
    label: 'Packed',
    desc: '4–7 stops/day, maximum coverage, high-density exploration',
  },
];

interface PlannerPreferencesProps {
  destination: string;
  onChangeDestination: (val: string) => void;
  origin: string;
  onChangeOrigin: (val: string) => void;
  originAirport: AirportLocation | null;
  onSelectOriginAirport: (airport: AirportLocation | null) => void;
  startDate?: string;
  onChangeStartDate?: (val: string) => void;
  endDate?: string;
  onChangeEndDate?: (val: string) => void;
  daysCount: number;
  onChangeDaysCount: (val: number) => void;
  travelers: number;
  onChangeTravelers: (val: number) => void;
  budget: number;
  onChangeBudget: (val: number) => void;
  currency: string;
  onChangeCurrency: (val: string) => void;
  pace: 'relaxed' | 'balanced' | 'fast' | 'packed';
  onChangePace: (val: 'relaxed' | 'balanced' | 'fast' | 'packed') => void;
  interests: string[];
  onToggleInterest: (id: string) => void;
  dailySchedule: 'early_riser' | 'balanced' | 'night_owl';
  onChangeDailySchedule: (val: 'early_riser' | 'balanced' | 'night_owl') => void;
  accommodation: 'budget' | 'comfort' | 'boutique' | 'luxury';
  onChangeAccommodation: (val: 'budget' | 'comfort' | 'boutique' | 'luxury') => void;
  foodPreferences: string[];
  onToggleFoodPref: (id: string) => void;
}

export const PlannerPreferences: React.FC<PlannerPreferencesProps> = ({
  destination,
  onChangeDestination,
  origin,
  onChangeOrigin,
  originAirport,
  onSelectOriginAirport,
  startDate,
  onChangeStartDate,
  endDate,
  onChangeEndDate,
  daysCount,
  onChangeDaysCount,
  travelers,
  onChangeTravelers,
  budget,
  onChangeBudget,
  currency,
  onChangeCurrency,
  pace,
  onChangePace,
  interests,
  onToggleInterest,
  dailySchedule,
  onChangeDailySchedule,
  accommodation,
  onChangeAccommodation,
  foodPreferences,
  onToggleFoodPref,
}) => {
  return (
    <div className="space-y-6 pt-2" data-testid="planner-preferences">
      {/* 1. Destination & Origin Corridor */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-orange-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Destination & Corridor
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Destination *</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => onChangeDestination(e.target.value)}
              placeholder="e.g. Goa, Kyoto, Manali, Jaipur, Tokyo"
              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-stone-200 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Departure Origin (Optional)</label>
            <AirportAutocomplete
              label=""
              placeholder="e.g. Delhi (DEL), Mumbai (BOM)"
              value={originAirport}
              onSelect={(airport) => {
                onSelectOriginAirport(airport);
                onChangeOrigin(airport?.city || airport?.name || '');
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Duration & Travelers & Budget */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Duration, Travelers & Budget
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Trip Length (Days)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={daysCount}
                onChange={(e) => onChangeDaysCount(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
                className="w-full text-xs sm:text-sm p-3 rounded-xl border border-stone-200 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Travelers</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={travelers}
                onChange={(e) => onChangeTravelers(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full text-xs sm:text-sm p-3 rounded-xl border border-stone-200 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">Target Budget (₹)</label>
            <input
              type="number"
              step={1000}
              min={5000}
              value={budget}
              onChange={(e) => onChangeBudget(parseInt(e.target.value, 10) || 0)}
              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-stone-200 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* 3. Pace selection (Materially changes density & schedule) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-orange-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Travel Pace
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {PACE_OPTIONS.map((opt) => {
            const isSelected = pace === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangePace(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/20 shadow-2xs'
                    : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-orange-950' : 'text-slate-900'}`}>
                    {opt.label}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-orange-600" />}
                </div>
                <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Interests Matching */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-orange-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Interests & Highlights
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((opt) => {
            const isSelected = interests.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onToggleInterest(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Stay & Daily rhythm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Bed className="w-3.5 h-3.5 text-orange-600" />
            <span>Accommodation Preference</span>
          </label>
          <select
            value={accommodation}
            onChange={(e) => onChangeAccommodation(e.target.value as any)}
            className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="budget">Budget / Hostels</option>
            <option value="comfort">Comfort / 3-Star</option>
            <option value="boutique">Boutique & Heritage</option>
            <option value="luxury">Luxury / 5-Star</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <span>Daily Wake-Up Rhythm</span>
          </label>
          <select
            value={dailySchedule}
            onChange={(e) => onChangeDailySchedule(e.target.value as any)}
            className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="balanced">Balanced (09:00 AM start)</option>
            <option value="early_riser">Early Bird (07:30 AM start)</option>
            <option value="night_owl">Late Start / Night Owl (11:00 AM start)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
