'use client';

import React, { useState } from 'react';
import { ArrowLeftRight, Calendar, Users, Briefcase, Search, AlertCircle } from 'lucide-react';
import { AirportAutocomplete } from '@/components/location/AirportAutocomplete';
import { AirportLocation } from '@/services/api';
import { FlightSearchParams } from '@/types/flight';
import { getLocalTodayDate, addDaysToDate } from '@/lib/formatDate';

interface FlightSearchFormProps {
  initialOrigin?: string;
  initialDestination?: string;
  initialDepartureDate?: string;
  initialReturnDate?: string;
  initialPassengers?: number;
  initialCabinClass?: string;
  initialTripType?: 'oneway' | 'roundtrip';
  isLoading?: boolean;
  onSearch: (params: FlightSearchParams) => void;
  onParamsChange?: (params: FlightSearchParams) => void;
  className?: string;
}

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
  const todayStr = getLocalTodayDate();

  const [tripType, setTripType] = useState<'oneway' | 'roundtrip'>(initialTripType);
  const [origin, setOrigin] = useState(initialOrigin);
  const [originAirport, setOriginAirport] = useState<AirportLocation | null>(null);
  const [destination, setDestination] = useState(initialDestination);
  const [destinationAirport, setDestinationAirport] = useState<AirportLocation | null>(null);
  const [departureDate, setDepartureDate] = useState(initialDepartureDate || todayStr);
  const [returnDate, setReturnDate] = useState(initialReturnDate || '');
  const [passengers, setPassengers] = useState(initialPassengers || 1);
  const [cabinClass, setCabinClass] = useState(initialCabinClass || 'economy');
  const [validationError, setValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialOrigin) setOrigin(initialOrigin);
  }, [initialOrigin]);

  React.useEffect(() => {
    if (initialDestination) setDestination(initialDestination);
  }, [initialDestination]);

  React.useEffect(() => {
    if (initialDepartureDate) setDepartureDate(initialDepartureDate);
  }, [initialDepartureDate]);

  React.useEffect(() => {
    if (initialReturnDate) setReturnDate(initialReturnDate);
  }, [initialReturnDate]);

  React.useEffect(() => {
    if (initialPassengers) setPassengers(initialPassengers);
  }, [initialPassengers]);

  React.useEffect(() => {
    if (initialTripType) setTripType(initialTripType);
  }, [initialTripType]);

  React.useEffect(() => {
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

  // Swap Origin and Destination
  const handleSwap = () => {
    const tempCode = origin;
    const tempAirport = originAirport;
    setOrigin(destination);
    setOriginAirport(destinationAirport);
    setDestination(tempCode);
    setDestinationAirport(tempAirport);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanOrigin = (origin || '').trim().toUpperCase();
    const cleanDest = (destination || '').trim().toUpperCase();

    if (!cleanOrigin) {
      setValidationError('Please select a verified origin airport from the typeahead dropdown.');
      return;
    }

    if (!cleanDest) {
      setValidationError('Please select a verified destination airport from the typeahead dropdown.');
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

  return (
    <form
      onSubmit={handleSubmit}
      className={`p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-5 ${className}`}
      data-testid="flight-search-form"
    >
      {/* Trip Type Toggle Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setTripType('roundtrip');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tripType === 'roundtrip'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="trip-type-roundtrip"
          >
            Round-trip
          </button>
          <button
            type="button"
            onClick={() => {
              setTripType('oneway');
              setReturnDate('');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tripType === 'oneway'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="trip-type-oneway"
          >
            One-way
          </button>
        </div>

        {/* Cabin Selector & Travellers Summary */}
        <div className="flex items-center gap-2">
          <select
            value={cabinClass}
            onChange={(e) => setCabinClass(e.target.value)}
            className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            aria-label="Cabin class"
          >
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium Economy</option>
            <option value="business">Business</option>
            <option value="first">First Class</option>
          </select>
        </div>
      </div>

      {/* Origin, Swap, Destination Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-3 items-center">
        {/* Origin Airport */}
        <div>
          <AirportAutocomplete
            id="flight-origin-input"
            label="From (Origin)"
            placeholder="Search city or airport (e.g. DEL, Delhi, Mumbai)"
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
            className="p-2.5 rounded-full border border-slate-200 hover:bg-orange-50 hover:border-orange-200 text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
            title="Swap departure and arrival airports"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Airport */}
        <div>
          <AirportAutocomplete
            id="flight-destination-input"
            label="To (Destination)"
            placeholder="Search city or airport (e.g. BOM, Goa, Bengaluru)"
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

      {/* Dates & Passengers Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {/* Departure Date */}
        <div>
          <label htmlFor="flight-departure-date" className="block text-xs font-semibold text-slate-700 mb-1">
            Departure Date
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
                  // Push return date to day after departure without timezone drift
                  setReturnDate(addDaysToDate(e.target.value, 1));
                }
              }}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              required
            />
          </div>
        </div>

        {/* Return Date (Disabled if one-way) */}
        <div>
          <label htmlFor="flight-return-date" className="block text-xs font-semibold text-slate-700 mb-1">
            Return Date {tripType === 'oneway' && <span className="text-slate-400 font-normal">(One-way)</span>}
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
              className={`w-full text-xs font-semibold rounded-xl px-3 py-2.5 border transition-colors ${
                tripType === 'oneway'
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-slate-50 text-slate-900 border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer'
              }`}
              required={tripType === 'roundtrip'}
            />
          </div>
        </div>

        {/* Passengers Counter */}
        <div>
          <label htmlFor="flight-passengers-input" className="block text-xs font-semibold text-slate-700 mb-1">
            Passengers (1-9)
          </label>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-slate-200 bg-slate-50 rounded-xl overflow-hidden w-full">
              <button
                type="button"
                onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                disabled={passengers <= 1}
                className="px-3 py-2 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent font-bold cursor-pointer"
                aria-label="Decrease passengers"
              >
                −
              </button>
              <input
                id="flight-passengers-input"
                type="number"
                min={1}
                max={9}
                value={passengers}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setPassengers(Math.max(1, Math.min(9, val)));
                }}
                className="w-full text-center text-xs font-semibold bg-transparent focus:outline-none text-slate-900"
                aria-label="Number of passengers"
              />
              <button
                type="button"
                onClick={() => setPassengers((p) => Math.min(9, p + 1))}
                disabled={passengers >= 9}
                className="px-3 py-2 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent font-bold cursor-pointer"
                aria-label="Increase passengers"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Error Message */}
      {validationError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs tracking-wide shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
          data-testid="search-flights-submit"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Searching Curated Catalog...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>Search Flights</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
