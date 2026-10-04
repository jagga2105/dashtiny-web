'use client';

import React from 'react';
import { Filter, RotateCcw, Clock, Plane, DollarSign } from 'lucide-react';
import { FlightFilterState, TimeSlotId } from '@/types/flight';
import { DEPARTURE_SLOTS, ARRIVAL_SLOTS } from '@/lib/flight/filtering';

interface AirlineCount {
  name: string;
  count: number;
}

interface FlightFiltersProps {
  filters: FlightFilterState;
  onChange: (filters: FlightFilterState) => void;
  availableAirlines: AirlineCount[];
  minPrice: number;
  maxPrice: number;
  totalCount: number;
  filteredCount: number;
  onReset: () => void;
  className?: string;
}

export function FlightFilters({
  filters,
  onChange,
  availableAirlines,
  minPrice,
  maxPrice,
  totalCount,
  filteredCount,
  onReset,
  className = '',
}: FlightFiltersProps) {
  const toggleStop = (stopVal: number) => {
    const current = new Set(filters.stops);
    if (current.has(stopVal)) {
      current.delete(stopVal);
    } else {
      current.add(stopVal);
    }
    onChange({ ...filters, stops: Array.from(current) });
  };

  const toggleAirline = (airlineName: string) => {
    const current = new Set(filters.airlines);
    if (current.has(airlineName)) {
      current.delete(airlineName);
    } else {
      current.add(airlineName);
    }
    onChange({ ...filters, airlines: Array.from(current) });
  };

  const toggleDepartureSlot = (slotId: TimeSlotId) => {
    const current = new Set(filters.departureSlots);
    if (current.has(slotId)) {
      current.delete(slotId);
    } else {
      current.add(slotId);
    }
    onChange({ ...filters, departureSlots: Array.from(current) });
  };

  const toggleArrivalSlot = (slotId: TimeSlotId) => {
    const current = new Set(filters.arrivalSlots || []);
    if (current.has(slotId)) {
      current.delete(slotId);
    } else {
      current.add(slotId);
    }
    onChange({ ...filters, arrivalSlots: Array.from(current) });
  };

  const activeCount =
    filters.stops.length +
    filters.airlines.length +
    filters.departureSlots.length +
    (filters.arrivalSlots && filters.arrivalSlots.length > 0 ? filters.arrivalSlots.length : 0) +
    (filters.maxPrice < maxPrice ? 1 : 0);

  const isFiltered = activeCount > 0;

  return (
    <aside
      className={`p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-5 text-xs text-slate-800 ${className}`}
      data-testid="flight-filters"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-1.5 font-bold text-slate-900">
          <Filter className="w-4 h-4 text-orange-500" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full">
              {activeCount} {activeCount === 1 ? 'filter' : 'filters'}
            </span>
          )}
          <span className="text-[11px] font-medium text-slate-500 ml-1">
            {totalCount !== filteredCount ? `${totalCount} → ${filteredCount} flights` : `${totalCount} flights`}
          </span>
        </div>
        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
            data-testid="reset-filters-btn"
          >
            <RotateCcw className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Stops Filter */}
      <div className="space-y-2">
        <div className="font-semibold text-slate-700 flex items-center justify-between">
          <span>Stops</span>
          {filters.stops.length > 0 && (
            <span className="text-[10px] text-orange-600 font-medium">Active</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { val: 0, label: 'Non-stop' },
            { val: 1, label: '1 Stop' },
            { val: 2, label: '2+ Stops' },
          ].map((item) => {
            const isSelected = filters.stops.includes(item.val);
            return (
              <button
                key={item.val}
                type="button"
                onClick={() => toggleStop(item.val)}
                className={`py-1.5 px-2 rounded-xl text-center text-xs font-semibold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-orange-500 text-white border-orange-500 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
                data-testid={`filter-stop-${item.val}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Airlines Filter */}
      {availableAirlines.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="font-semibold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Plane className="w-3.5 h-3.5 text-slate-400" />
              Airlines
            </span>
            {filters.airlines.length > 0 && (
              <span className="text-[10px] text-orange-600 font-medium">
                {filters.airlines.length} selected
              </span>
            )}
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {availableAirlines.map((airline) => {
              const isChecked = filters.airlines.includes(airline.name);
              return (
                <label
                  key={airline.name}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleAirline(airline.name)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                    />
                    <span className="font-medium text-slate-700 text-xs">{airline.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                    {airline.count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Max Price Slider (Explicitly labeled Max Price, not Price range) */}
      {maxPrice > minPrice && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between font-semibold text-slate-700">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              Max Price
            </span>
            <span className="text-orange-600 font-bold">
              ₹{filters.maxPrice.toLocaleString('en-IN')}
            </span>
          </div>
          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            step={250}
            value={filters.maxPrice}
            onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
            className="w-full accent-orange-500 cursor-pointer"
            data-testid="filter-max-price"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>₹{minPrice.toLocaleString('en-IN')}</span>
            <span>₹{maxPrice.toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Departure Time Slots */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <div className="font-semibold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Departure Time
          </span>
          {filters.departureSlots.length > 0 && (
            <span className="text-[10px] text-orange-600 font-medium">
              {filters.departureSlots.length} active
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {DEPARTURE_SLOTS.map((slot) => {
            const isChecked = filters.departureSlots.includes(slot.id);
            return (
              <label
                key={slot.id}
                className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleDepartureSlot(slot.id)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <span className="font-medium text-slate-700 text-xs">{slot.label}</span>
                </div>
                <span className="text-[10px] text-slate-400">{slot.desc}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Arrival Time Slots */}
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <div className="font-semibold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Arrival Time
          </span>
          {filters.arrivalSlots && filters.arrivalSlots.length > 0 && (
            <span className="text-[10px] text-orange-600 font-medium">
              {filters.arrivalSlots.length} active
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {ARRIVAL_SLOTS.map((slot) => {
            const isChecked = (filters.arrivalSlots || []).includes(slot.id);
            return (
              <label
                key={slot.id}
                className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleArrivalSlot(slot.id)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <span className="font-medium text-slate-700 text-xs">{slot.label}</span>
                </div>
                <span className="text-[10px] text-slate-400">{slot.desc}</span>
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
