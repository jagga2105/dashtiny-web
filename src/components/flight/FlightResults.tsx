'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plane,
  AlertCircle,
  Filter,
  RefreshCw,
  Scale,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  FlightOffer,
  FlightSearchResponse,
  FlightFilterState,
  FlightSortOption,
  TimeSlotId,
} from '@/types/flight';
import { FlightFilters } from './FlightFilters';
import { FlightSort } from './FlightSort';
import { FlightOfferCard } from './FlightOfferCard';
import { FlightComparison } from './FlightComparison';
import { FlightProvenance } from './FlightProvenance';

interface FlightResultsProps {
  searchResponse: FlightSearchResponse | null;
  isLoading: boolean;
  error?: string | null;
  isStale?: boolean;
  onRefreshSearch?: () => void;
  selectedOfferId?: string | null;
  onSelectOffer: (offer: FlightOffer) => void;
  className?: string;
}

const DEFAULT_FILTERS: FlightFilterState = {
  stops: [],
  airlines: [],
  maxPrice: 100000,
  departureSlots: [],
  arrivalSlots: [],
};

function getTimeSlot(timeStr: string): TimeSlotId {
  // timeStr is format "HH:MM"
  const hour = parseInt(timeStr.split(':')[0], 10) || 0;
  if (hour < 6) return 'early_morning';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

export function FlightResults({
  searchResponse,
  isLoading,
  error,
  isStale = false,
  onRefreshSearch,
  selectedOfferId,
  onSelectOffer,
  className = '',
}: FlightResultsProps) {
  const [filters, setFilters] = useState<FlightFilterState>(DEFAULT_FILTERS);
  const [currentSort, setCurrentSort] = useState<FlightSortOption>('balanced');
  const [comparedOffers, setComparedOffers] = useState<FlightOffer[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Calculate price boundaries from raw offers
  const rawOffers = searchResponse?.offers || [];

  const { minCatalogPrice, maxCatalogPrice, availableAirlines } = useMemo(() => {
    if (rawOffers.length === 0) {
      return { minCatalogPrice: 0, maxCatalogPrice: 50000, availableAirlines: [] };
    }
    let min = Infinity;
    let max = -Infinity;
    const airlineMap = new Map<string, number>();

    rawOffers.forEach((o) => {
      if (o.price < min) min = o.price;
      if (o.price > max) max = o.price;
      airlineMap.set(o.airline, (airlineMap.get(o.airline) || 0) + 1);
    });

    const airlines = Array.from(airlineMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    return {
      minCatalogPrice: min === Infinity ? 0 : min,
      maxCatalogPrice: max === -Infinity ? 50000 : max,
      availableAirlines: airlines,
    };
  }, [rawOffers]);

  // Adjust maxPrice filter if catalog max changes
  useEffect(() => {
    if (maxCatalogPrice > 0 && (filters.maxPrice === 100000 || filters.maxPrice < minCatalogPrice)) {
      setFilters((prev) => ({ ...prev, maxPrice: maxCatalogPrice }));
    }
  }, [maxCatalogPrice, minCatalogPrice]);

  // Filter raw offers client-side
  const filteredOffers = useMemo(() => {
    return rawOffers.filter((offer) => {
      // Stops filter
      if (filters.stops.length > 0) {
        const matchesStop = filters.stops.some((s) => {
          if (s >= 2) return offer.stops >= 2;
          return offer.stops === s;
        });
        if (!matchesStop) return false;
      }

      // Airline filter
      if (filters.airlines.length > 0) {
        if (!filters.airlines.includes(offer.airline)) return false;
      }

      // Max price filter
      if (filters.maxPrice > 0 && offer.price > filters.maxPrice) {
        return false;
      }

      // Departure slot filter
      if (filters.departureSlots.length > 0) {
        const slot = getTimeSlot(offer.departure_time);
        if (!filters.departureSlots.includes(slot)) return false;
      }

      // Arrival slot filter
      if (filters.arrivalSlots.length > 0) {
        const slot = getTimeSlot(offer.arrival_time);
        if (!filters.arrivalSlots.includes(slot)) return false;
      }

      return true;
    });
  }, [rawOffers, filters]);

  // Determine badges (cheapest, fastest, balanced) from current filtered set
  const { cheapestOfferId, fastestOfferId, balancedOfferId } = useMemo(() => {
    if (filteredOffers.length === 0) {
      return { cheapestOfferId: null, fastestOfferId: null, balancedOfferId: null };
    }

    let minPrice = Infinity;
    let minPriceId: string | null = null;
    let minDur = Infinity;
    let minDurId: string | null = null;

    filteredOffers.forEach((o) => {
      if (o.price < minPrice) {
        minPrice = o.price;
        minPriceId = o.offer_id;
      }
      if (o.duration_minutes < minDur) {
        minDur = o.duration_minutes;
        minDurId = o.offer_id;
      }
    });

    // Balanced option heuristic: direct flight under 3h with lowest price, or overall fastest under median price
    const directOffers = filteredOffers.filter((o) => o.stops === 0);
    const candidateList = directOffers.length > 0 ? directOffers : filteredOffers;
    let balancedId = candidateList[0]?.offer_id || null;

    return {
      cheapestOfferId: minPriceId,
      fastestOfferId: minDurId,
      balancedOfferId: balancedId,
    };
  }, [filteredOffers]);

  // Sort filtered offers
  const sortedOffers = useMemo(() => {
    const list = [...filteredOffers];

    switch (currentSort) {
      case 'cheapest':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'fastest':
        list.sort((a, b) => a.duration_minutes - b.duration_minutes);
        break;
      case 'earliest':
        list.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
        break;
      case 'latest':
        list.sort((a, b) => b.departure_time.localeCompare(a.departure_time));
        break;
      case 'balanced':
      default:
        // Balanced sort: balanced offer first, then by non-stop then price
        list.sort((a, b) => {
          if (a.offer_id === balancedOfferId) return -1;
          if (b.offer_id === balancedOfferId) return 1;
          if (a.stops !== b.stops) return a.stops - b.stops;
          return a.price - b.price;
        });
        break;
    }

    return list;
  }, [filteredOffers, currentSort, balancedOfferId]);

  // Toggle comparison handler
  const handleToggleCompare = (offer: FlightOffer) => {
    const exists = comparedOffers.some((o) => o.offer_id === offer.offer_id);
    if (exists) {
      setComparedOffers((prev) => prev.filter((o) => o.offer_id !== offer.offer_id));
    } else {
      if (comparedOffers.length < 3) {
        setComparedOffers((prev) => [...prev, offer]);
      }
    }
  };

  const handleRemoveCompare = (offerId: string) => {
    setComparedOffers((prev) => prev.filter((o) => o.offer_id !== offerId));
  };

  const handleResetFilters = () => {
    setFilters({
      stops: [],
      airlines: [],
      maxPrice: maxCatalogPrice,
      departureSlots: [],
      arrivalSlots: [],
    });
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center space-y-4" data-testid="flight-search-loading">
        <div className="w-12 h-12 rounded-full border-3 border-orange-500/20 border-t-orange-600 animate-spin mx-auto" />
        <p className="text-base font-medium text-slate-800">
          Searching contemporary airline corridors...
        </p>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Querying normalized provider catalog across IndiGo, Air India, Akasa Air, and regional carriers.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3"
        data-testid="flight-search-error"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <h3 className="font-bold text-base">Search Request Notice</h3>
        </div>
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!searchResponse) {
    return (
      <div className="py-16 text-center space-y-3 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
        <Plane className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="font-serif-editorial text-lg font-bold text-slate-700">
          Ready to Search Flights
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Select origin and destination airports above using our verified airport resolver to view contemporary airline schedules and fares.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="flight-results-container">
      {/* Stale Search Notice Banner */}
      {isStale && (
        <div
          className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-2xs animate-in fade-in"
          data-testid="stale-search-banner"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-bold">Search parameters updated</p>
              <p className="text-xs text-amber-700">
                You changed your trip parameters above. Re-run search to see current available fares for the new selection.
              </p>
            </div>
          </div>
          {onRefreshSearch && (
            <button
              type="button"
              onClick={onRefreshSearch}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-2xs shrink-0"
              data-testid="refresh-search-btn"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Update Results</span>
            </button>
          )}
        </div>
      )}

      {/* Provenance and Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
        <FlightProvenance
          provenance={searchResponse.provenance}
          availabilityState={searchResponse.availability_state}
          retrievedAt={searchResponse.retrieved_at}
        />
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{filteredOffers.length}</span> of{' '}
          <span className="font-bold text-slate-800">{rawOffers.length}</span> offers
        </div>
      </div>

      {/* Search Layout Grid: Left Sidebar (Filters), Right Content (Sort + Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden col-span-1 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs"
          >
            <Filter className="w-4 h-4 text-orange-500" />
            <span>{showMobileFilters ? 'Hide Filters' : 'Filter Results'}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">
              {filteredOffers.length}
            </span>
          </button>
        </div>

        {/* Filters Sidebar */}
        <div
          className={`lg:col-span-1 ${
            showMobileFilters ? 'block' : 'hidden lg:block'
          } sticky top-24`}
        >
          <FlightFilters
            filters={filters}
            onChange={setFilters}
            availableAirlines={availableAirlines}
            minPrice={minCatalogPrice}
            maxPrice={maxCatalogPrice}
            totalCount={rawOffers.length}
            filteredCount={filteredOffers.length}
            onReset={handleResetFilters}
          />
        </div>

        {/* Results List Column */}
        <div className="col-span-1 lg:col-span-3 space-y-4">
          {/* Sorting Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FlightSort currentSort={currentSort} onSortChange={setCurrentSort} />

            {comparedOffers.length > 0 && (
              <button
                type="button"
                onClick={() => setIsComparisonOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                data-testid="open-comparison-btn"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare Selected ({comparedOffers.length}/3)</span>
              </button>
            )}
          </div>

          {/* Cards List or Empty Filter State */}
          {sortedOffers.length === 0 ? (
            <div
              className="py-12 px-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3"
              data-testid="no-matching-flights"
            >
              <Plane className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">No Flights Match Your Filters</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try widening your price range, clearing departure time slots, or enabling additional stops to see more options.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3.5" data-testid="flight-offer-list">
              {sortedOffers.map((offer) => {
                const isCompared = comparedOffers.some((o) => o.offer_id === offer.offer_id);
                const canCompare = isCompared || comparedOffers.length < 3;
                const isSelected = selectedOfferId === offer.offer_id;

                return (
                  <FlightOfferCard
                    key={offer.offer_id}
                    offer={offer}
                    isCompared={isCompared}
                    canCompare={canCompare}
                    onToggleCompare={handleToggleCompare}
                    onSelectOffer={onSelectOffer}
                    isSelected={isSelected}
                    isBalanced={offer.offer_id === balancedOfferId}
                    isCheapest={offer.offer_id === cheapestOfferId}
                    isFastest={offer.offer_id === fastestOfferId}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Comparison Tray (Desktop/Mobile) */}
      {comparedOffers.length > 0 && !isComparisonOpen && (
        <aside
          aria-label="Flight comparison tray"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 p-3 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 animate-in slide-in-from-bottom-4 duration-200"
          data-testid="floating-comparison-tray"
        >
          <div className="flex items-center gap-2 pl-2">
            <Scale className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-semibold">
              {comparedOffers.length} flight{comparedOffers.length > 1 ? 's' : ''} in comparison
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsComparisonOpen(true)}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
            >
              Compare Now
            </button>
            <button
              type="button"
              onClick={() => setComparedOffers([])}
              className="px-2 py-1.5 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Clear
            </button>
          </div>
        </aside>
      )}

      {/* Comparison Modal */}
      <FlightComparison
        selectedOffers={comparedOffers}
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        onRemoveOffer={handleRemoveCompare}
        onSelectOffer={(offer) => {
          setIsComparisonOpen(false);
          onSelectOffer(offer);
        }}
      />
    </div>
  );
}
