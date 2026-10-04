'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  Search,
  Calendar,
  Users,
  AlertCircle,
  ChevronDown,
  Check,
  Plane,
} from 'lucide-react';
import { AirportAutocomplete } from '@/components/location/AirportAutocomplete';
import { FlightSearchParams } from '@/types/flight';
import { addDaysToDate } from '@/lib/formatDate';

interface FlightSearchFormProps {
  initialOrigin?: string;
  initialDestination?: string;
  initialDepartureDate?: string;
  initialReturnDate?: string;
  initialPassengers?: number;
  initialCabinClass?: string;
  initialTripType?: 'roundtrip' | 'oneway';
  isLoading?: boolean;
  onSearch: (params: FlightSearchParams) => void;
  onParamsChange?: (params: FlightSearchParams) => void;
  className?: string;
}

const CABIN_OPTIONS = [
  { id: 'economy', label: 'Economy' },
  { id: 'premium_economy', label: 'Premium Economy' },
  { id: 'business', label: 'Business' },
  { id: 'first', label: 'First Class' },
];

export function FlightSearchForm({
  initialOrigin = '',
  initialDestination = '',
  initialDepartureDate = '',
  initialReturnDate = '',
  initialPassengers = 1,
  initialCabinClass = 'economy',
  initialTripType = 'roundtrip',
  isLoading = false,
  onSearch,
  onParamsChange,
  className = '',
}: FlightSearchFormProps) {
  const [tripType, setTripType] = useState<'roundtrip' | 'oneway'>(initialTripType);
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [originAirport, setOriginAirport] = useState<any | null>(null);
  const [destinationAirport, setDestinationAirport] = useState<any | null>(null);
  const [departureDate, setDepartureDate] = useState(initialDepartureDate);
  const [returnDate, setReturnDate] = useState(initialReturnDate);
  const [passengers, setPassengers] = useState(initialPassengers);
  const [cabinClass, setCabinClass] = useState(initialCabinClass);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Progressive disclosure popover for Travelers & Cabin Class
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsPopoverRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Sync external props changes
  useEffect(() => {
    if (initialOrigin !== undefined) setOrigin(initialOrigin);
  }, [initialOrigin]);

  useEffect(() => {
    if (initialDestination !== undefined) setDestination(initialDestination);
  }, [initialDestination]);

  useEffect(() => {
    if (initialDepartureDate !== undefined) setDepartureDate(initialDepartureDate);
  }, [initialDepartureDate]);

  useEffect(() => {
    if (initialReturnDate !== undefined) setReturnDate(initialReturnDate);
  }, [initialReturnDate]);

  useEffect(() => {
    if (initialPassengers !== undefined) setPassengers(initialPassengers);
  }, [initialPassengers]);

  useEffect(() => {
    if (initialCabinClass !== undefined) setCabinClass(initialCabinClass);
  }, [initialCabinClass]);

  useEffect(() => {
    if (initialTripType !== undefined) setTripType(initialTripType);
  }, [initialTripType]);

  // Click outside to dismiss options popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (optionsPopoverRef.current && !optionsPopoverRef.current.contains(event.target as Node)) {
        setIsOptionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notify parent of active param edits (for stale tracking)
  useEffect(() => {
    if (onParamsChange) {
      onParamsChange({
        origin,
        destination,
        departureDate,
        returnDate: tripType === 'roundtrip' ? returnDate : undefined,
        passengers,
        cabinClass,
        tripType,
      });
    }
  }, [origin, destination, departureDate, returnDate, passengers, cabinClass, tripType, onParamsChange]);

  const handleSwap = () => {
    const tempOrig = origin;
    const tempDest = destination;
    const tempOrigAir = originAirport;
    const tempDestAir = destinationAirport;
    setOrigin(tempDest);
    setDestination(tempOrig);
    setOriginAirport(tempDestAir);
    setDestinationAirport(tempOrigAir);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanOrigin = (origin || '').trim().toUpperCase();
    const cleanDest = (destination || '').trim().toUpperCase();

    if (!cleanOrigin) {
      setValidationError('Select an airport from the airport directory.');
      return;
    }

    if (!cleanDest) {
      setValidationError('Select an airport from the airport directory.');
      return;
    }

    if (cleanOrigin === cleanDest) {
      setValidationError('Origin and destination airports cannot be the same. Please choose different airports.');
      return;
    }

    if (!departureDate) {
      setValidationError('Please specify a departure date.');
      return;
    }

    if (departureDate < todayStr) {
      setValidationError('Departure date cannot be in the past.');
      return;
    }

    if (tripType === 'roundtrip') {
      if (!returnDate) {
        setValidationError('Return date is required for round-trip flights.');
        return;
      }
      if (returnDate <= departureDate) {
        setValidationError('Return date must be strictly after the departure date.');
        return;
      }
    }

    if (passengers < 1 || passengers > 9) {
      setValidationError('Number of passengers must be between 1 and 9.');
      return;
    }

    onSearch({
      origin: cleanOrigin,
      destination: cleanDest,
      departureDate,
      returnDate: tripType === 'roundtrip' ? returnDate : undefined,
      passengers,
      cabinClass,
      tripType,
    });
  };

  const selectedCabinLabel = CABIN_OPTIONS.find((c) => c.id === cabinClass)?.label || 'Economy';

  return (
    <form
      onSubmit={handleSubmit}
      className={`p-6 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-6 ${className}`}
      data-testid="flight-search-form"
    >
      {/* Top Bar: Secondary Controls with Progressive Disclosure */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
        {/* Trip Type Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-stone-100/90 rounded-xl">
          <button
            type="button"
            onClick={() => setTripType('roundtrip')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tripType === 'roundtrip'
                ? 'bg-white text-stone-900 shadow-2xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            data-testid="trip-type-roundtrip"
          >
            Round trip
          </button>
          <button
            type="button"
            onClick={() => {
              setTripType('oneway');
              setReturnDate('');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tripType === 'oneway'
                ? 'bg-white text-stone-900 shadow-2xs font-bold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            data-testid="trip-type-oneway"
          >
            One way
          </button>
        </div>

        {/* Travelers & Cabin Class Progressive Disclosure Popover */}
        <div className="relative" ref={optionsPopoverRef}>
          <button
            type="button"
            onClick={() => setIsOptionsOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-stone-100/80 text-xs font-medium text-stone-800 transition-colors cursor-pointer"
            aria-expanded={isOptionsOpen}
            aria-haspopup="dialog"
            data-testid="travelers-cabin-trigger"
          >
            <Users className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span>
              {passengers} {passengers === 1 ? 'traveler' : 'travelers'} · {selectedCabinLabel}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isOptionsOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Accessible hidden select for screen readers and test query compatibility */}
          <select
            value={cabinClass}
            onChange={(e) => setCabinClass(e.target.value)}
            className="sr-only"
            aria-label="Cabin class"
            tabIndex={-1}
          >
            {CABIN_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Popover Card */}
          {isOptionsOpen && (
            <div
              role="dialog"
              aria-label="Travelers and cabin class options"
              className="absolute right-0 z-30 top-full mt-2 w-72 bg-white rounded-2xl p-4 shadow-xl border border-stone-200 text-xs space-y-4 animate-in fade-in duration-150"
            >
              {/* Passengers Stepper */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800">Travelers</span>
                  <span className="text-[11px] text-stone-400">Ages 12+</span>
                </div>
                <div className="flex items-center justify-between border border-stone-200 rounded-xl p-1 bg-stone-50">
                  <button
                    type="button"
                    onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                    disabled={passengers <= 1}
                    className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-white cursor-pointer"
                    aria-label="Decrease travelers"
                  >
                    −
                  </button>
                  <span className="font-bold text-sm text-stone-900 font-mono">
                    {passengers}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPassengers((p) => Math.min(9, p + 1))}
                    disabled={passengers >= 9}
                    className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-white cursor-pointer"
                    aria-label="Increase travelers"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Cabin Class Selection */}
              <div className="space-y-1.5 pt-2 border-t border-stone-100">
                <span className="font-semibold text-stone-800 block mb-1">Cabin Class</span>
                <div className="space-y-1">
                  {CABIN_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCabinClass(c.id);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-colors cursor-pointer ${
                        cabinClass === c.id
                          ? 'bg-orange-50 text-orange-900 border border-orange-200/80 font-semibold'
                          : 'text-stone-700 hover:bg-stone-50 border border-transparent'
                      }`}
                    >
                      <span>{c.label}</span>
                      {cabinClass === c.id && <Check className="w-3.5 h-3.5 text-orange-600" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsOptionsOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Middle Row: Route Hero with Airport Autocomplete */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-center">
        {/* Origin Airport */}
        <div>
          <AirportAutocomplete
            id="flight-origin-input"
            label="From"
            placeholder="Search departure city or airport (e.g. DEL, Delhi)"
            value={origin}
            onSelect={(airport) => {
              if (airport) {
                setOrigin(airport.iata_code);
                setOriginAirport(airport);
              } else {
                setOrigin('');
                setOriginAirport(null);
              }
            }}
          />
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-1 lg:my-0 lg:pt-5">
          <button
            type="button"
            onClick={handleSwap}
            aria-label="Swap origin and destination"
            className="p-3 rounded-full border border-stone-200 bg-white hover:bg-orange-50 hover:border-orange-200 text-stone-600 hover:text-orange-600 transition-all duration-200 hover:rotate-180 motion-reduce:transition-none motion-reduce:hover:rotate-0 cursor-pointer shadow-2xs"
            title="Swap departure and arrival airports"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Airport */}
        <div>
          <AirportAutocomplete
            id="flight-destination-input"
            label="To"
            placeholder="Search arrival city or airport (e.g. BOM, Goa, BLR)"
            value={destination}
            onSelect={(airport) => {
              if (airport) {
                setDestination(airport.iata_code);
                setDestinationAirport(airport);
              } else {
                setDestination('');
                setDestinationAirport(null);
              }
            }}
          />
        </div>
      </div>

      {/* Bottom Row: Dates & Prominent CTA Hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end pt-1">
        {/* Departure Date */}
        <div>
          <label htmlFor="flight-departure-date" className="block text-xs font-semibold text-stone-700 mb-1.5">
            Departure date
          </label>
          <div className="relative">
            <input
              id="flight-departure-date"
              data-testid="flight-departure-date-input"
              type="date"
              min={todayStr}
              value={departureDate}
              onChange={(e) => {
                setDepartureDate(e.target.value);
                if (tripType === 'roundtrip' && returnDate && returnDate <= e.target.value) {
                  setReturnDate(addDaysToDate(e.target.value, 1));
                }
              }}
              className="w-full text-xs font-semibold bg-stone-50/70 border border-stone-200 rounded-xl px-3.5 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              required
            />
          </div>
        </div>

        {/* Return Date */}
        <div>
          <label htmlFor="flight-return-date" className="block text-xs font-semibold text-stone-700 mb-1.5">
            Return date {tripType === 'oneway' && <span className="text-stone-400 font-normal">(One way)</span>}
          </label>
          <div className="relative">
            <input
              id="flight-return-date"
              data-testid="flight-return-date-input"
              type="date"
              min={departureDate || todayStr}
              disabled={tripType === 'oneway'}
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className={`w-full text-xs font-semibold rounded-xl px-3.5 py-3 border transition-colors ${
                tripType === 'oneway'
                  ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                  : 'bg-stone-50/70 text-stone-900 border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer'
              }`}
              required={tripType === 'roundtrip'}
            />
          </div>
        </div>

        {/* Primary CTA Button */}
        <div className="sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs tracking-wide shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer min-h-[44px]"
            data-testid="search-flights-submit"
          >
            <Search className="w-4 h-4" />
            <span>{isLoading ? 'Searching…' : 'Search flights'}</span>
          </button>
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div
          role="alert"
          data-testid="flight-search-validation-error"
          className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-in fade-in duration-150"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </form>
  );
}
