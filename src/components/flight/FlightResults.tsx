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
  Clock,
  RotateCcw,
  X,
  ArrowUpDown,
} from 'lucide-react';
import {
  FlightOffer,
  FlightSearchResponse,
  FlightFilterState,
  FlightSortOption,
  FlightSearchParams,
} from '@/types/flight';
import { FlightFilters } from './FlightFilters';
import { FlightSort } from './FlightSort';
import { FlightOfferCard } from './FlightOfferCard';
import { FlightComparison } from './FlightComparison';
import { FlightProvenance } from './FlightProvenance';
import { formatCurrency } from '@/lib/formatCurrency';
import { formatFriendlyDateRange } from '@/lib/formatDate';
import {
  DEFAULT_FLIGHT_FILTERS,
  filterFlightOffers,
  getAvailableAirlines,
  getPriceBounds,
} from '@/lib/flight/filtering';
import {
  computeFlightDecisionMetrics,
  sortFlightOffers,
  formatFlightDuration,
  computeFactualWhyThisFits,
} from '@/lib/flight/ranking';

interface FlightResultsProps {
  searchResponse: FlightSearchResponse | null;
  isLoading: boolean;
  error?: string | null;
  isStale?: boolean;
  previousSearchParams?: FlightSearchParams | null;
  currentSearchParams?: FlightSearchParams | null;
  onRefreshSearch?: () => void;
  selectedOfferId?: string | null;
  onSelectOffer: (offer: FlightOffer) => void;
  onRetrySearch?: () => void;
  className?: string;
}

export function FlightResults({
  searchResponse,
  isLoading,
  error,
  isStale = false,
  previousSearchParams,
  currentSearchParams,
  onRefreshSearch,
  selectedOfferId,
  onSelectOffer,
  onRetrySearch,
  className = '',
}: FlightResultsProps) {
  const [filters, setFilters] = useState<FlightFilterState>(DEFAULT_FLIGHT_FILTERS);
  const [currentSort, setCurrentSort] = useState<FlightSortOption>('balanced');
  const [comparedOffers, setComparedOffers] = useState<FlightOffer[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [comparisonLimitWarning, setComparisonLimitWarning] = useState(false);

  // Active filter count for mobile badge and drawer header
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.stops.length > 0) count += filters.stops.length;
    if (filters.airlines.length > 0) count += filters.airlines.length;
    if (filters.departureSlots.length > 0) count += filters.departureSlots.length;
    if (filters.arrivalSlots && filters.arrivalSlots.length > 0) count += filters.arrivalSlots.length;
    if (filters.maxPrice < 100000 && filters.maxPrice > 0) count += 1;
    return count;
  }, [filters]);

  // Lock body scroll and handle Escape key for mobile filter drawer
  useEffect(() => {
    if (!showMobileFilters) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMobileFilters(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [showMobileFilters]);

  // Raw offers from search response
  const rawOffers: FlightOffer[] = useMemo(() => {
    return searchResponse?.offers || [];
  }, [searchResponse?.offers]);

  // Price bounds and available airlines
  const { minPrice, maxPrice } = useMemo(() => {
    return getPriceBounds(rawOffers);
  }, [rawOffers]);

  const availableAirlines = useMemo(() => {
    return getAvailableAirlines(rawOffers);
  }, [rawOffers]);

  // Sync max price filter when catalog changes
  useEffect(() => {
    if (maxPrice > 0 && (filters.maxPrice === 100000 || filters.maxPrice < minPrice)) {
      setFilters((prev) => ({ ...prev, maxPrice }));
    }
  }, [maxPrice, minPrice, filters.maxPrice]);

  // Filtered offers derived state
  const filteredOffers = useMemo(() => {
    return filterFlightOffers(rawOffers, filters);
  }, [rawOffers, filters]);

  // Decision metrics and highlights
  const decisionMetrics = useMemo(() => {
    return computeFlightDecisionMetrics(filteredOffers);
  }, [filteredOffers]);

  // Sorted offers derived state
  const sortedOffers = useMemo(() => {
    return sortFlightOffers(
      filteredOffers,
      currentSort,
      decisionMetrics.balancedOffer?.offer_id
    );
  }, [filteredOffers, currentSort, decisionMetrics.balancedOffer?.offer_id]);

  // Toggle comparison handler with strict 3-offer limit and warning banner
  const handleToggleCompare = (offer: FlightOffer) => {
    const exists = comparedOffers.some((o) => o.offer_id === offer.offer_id);
    if (exists) {
      setComparedOffers((prev) => prev.filter((o) => o.offer_id !== offer.offer_id));
      setComparisonLimitWarning(false);
    } else {
      if (comparedOffers.length < 3) {
        setComparedOffers((prev) => [...prev, offer]);
        setComparisonLimitWarning(false);
      } else {
        setComparisonLimitWarning(true);
      }
    }
  };

  const handleRemoveCompare = (offerId: string) => {
    setComparedOffers((prev) => prev.filter((o) => o.offer_id !== offerId));
    setComparisonLimitWarning(false);
  };

  const handleResetFilters = () => {
    setFilters({
      stops: [],
      airlines: [],
      maxPrice,
      departureSlots: [],
      arrivalSlots: [],
    });
  };

  const handleScrollToOffer = (offerId?: string | null) => {
    if (!offerId) return;
    const el = document.querySelector(`[data-testid="flight-card-${offerId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-orange-500');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-orange-500');
      }, 1500);
    }
  };

  // 1. Loading Skeleton UX (3 to 5 skeleton cards)
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`} data-testid="flight-search-loading">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800">
                Comparing current catalog options…
              </p>
              <p className="text-[11px] text-slate-500">
                Fetching reference catalog schedules across IndiGo, Air India, Akasa Air, and SpiceJet
              </p>
            </div>
          </div>
          <div className="h-6 w-24 bg-slate-100 rounded-lg animate-pulse" />
        </div>

        {/* Skeleton Offer Cards preserving approximate card height */}
        <div className="space-y-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white border border-slate-200/70 shadow-2xs space-y-4 animate-pulse"
              style={{ minHeight: '190px' }}
            >
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <div className="h-5 w-24 bg-slate-200 rounded-full" />
                  <div className="h-5 w-24 bg-slate-100 rounded-full" />
                </div>
                <div className="h-6 w-16 bg-slate-100 rounded-lg" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 items-center">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-200" />
                    <div className="space-y-1">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                      <div className="h-3 w-20 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="space-y-1">
                      <div className="h-5 w-16 bg-slate-200 rounded" />
                      <div className="h-3 w-12 bg-slate-100 rounded" />
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full" />
                    <div className="space-y-1 text-right">
                      <div className="h-5 w-16 bg-slate-200 rounded ml-auto" />
                      <div className="h-3 w-12 bg-slate-100 rounded ml-auto" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 md:text-right">
                  <div className="h-6 w-24 bg-slate-200 rounded md:ml-auto" />
                  <div className="h-8 w-28 bg-orange-200 rounded-xl md:ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div
        className={`p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-900 space-y-4 ${className}`}
        data-testid="flight-search-error"
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <div>
            <h3 className="font-bold text-base text-rose-950">
              We couldn&apos;t load flight options.
            </h3>
            <p className="text-xs text-rose-800">
              {error?.includes('Traceback') || error?.includes('Internal Server') || error?.includes('OperationalError')
                ? 'Please check your airport selection and travel dates, then try again.'
                : error}
            </p>
          </div>
        </div>
        {onRetrySearch && (
          <button
            type="button"
            onClick={onRetrySearch}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  // 3. Initial Empty State (before search)
  if (!searchResponse) {
    return (
      <div
        className={`py-16 px-6 text-center space-y-3 bg-white rounded-3xl border border-dashed border-slate-200 shadow-2xs ${className}`}
        data-testid="ready-to-compare-flights"
      >
        <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 mx-auto">
          <Plane className="w-6 h-6" />
        </div>
        <h3 className="font-serif-editorial text-lg font-bold text-slate-800">
          Ready to compare flights
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Ready to search flights — specify your departure and arrival airports above to view curated flight options, estimated fares, and reference schedules.
        </p>
      </div>
    );
  }

  // Extract search summary metadata
  const searchSummary = searchResponse.search;
  const travelersLabel = searchSummary
    ? `${searchSummary.passengers} ${searchSummary.passengers === 1 ? 'traveler' : 'travelers'}`
    : '1 traveler';
  const cabinLabel = searchSummary?.cabin_class
    ? searchSummary.cabin_class.replace('_', ' ')
    : 'Economy';

  return (
    <div className={`space-y-6 ${className}`} data-testid="flight-results-container">
      {/* Comparison limit warning modal/banner */}
      {comparisonLimitWarning && (
        <div
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center justify-between gap-3 animate-in fade-in"
          data-testid="comparison-limit-banner"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Comparison limit reached.</strong> Remove one flight to compare another.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setComparisonLimitWarning(false)}
            className="text-amber-800 hover:text-amber-950 font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stale Search Notice Banner (Visually de-emphasized results) */}
      {isStale && (
        <div
          className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in"
          data-testid="stale-search-banner"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Search changed</span>
            </div>
            <p className="text-xs text-amber-800">
              Search parameters updated.
            </p>
            {previousSearchParams && (
              <p className="text-amber-800">
                These results are for:{' '}
                <strong>
                  {previousSearchParams.origin} → {previousSearchParams.destination} · {previousSearchParams.departureDate}
                </strong>
              </p>
            )}
            {currentSearchParams && (
              <p className="text-amber-900 font-medium">
                Current search:{' '}
                <strong>
                  {currentSearchParams.origin} → {currentSearchParams.destination} · {currentSearchParams.departureDate}
                </strong>
              </p>
            )}
          </div>
          {onRefreshSearch && (
            <button
              type="button"
              onClick={onRefreshSearch}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
              data-testid="refresh-search-btn"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Update results</span>
            </button>
          )}
        </div>
      )}

      {/* Search Summary Header */}
      <div
        className={`p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-opacity ${
          isStale ? 'opacity-70' : 'opacity-100'
        }`}
        data-testid="search-summary-header"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 font-serif-editorial">
              {rawOffers.length > 0 ? `${rawOffers.length} flight options` : 'No flight options found'}
            </h2>
            <span className="text-slate-300">·</span>
            <span className="text-xs font-bold text-orange-600 uppercase">
              {searchSummary?.origin} → {searchSummary?.destination}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {formatFriendlyDateRange(searchSummary?.departure_date, searchSummary?.return_date)} · {travelersLabel} ·{' '}
            <span className="capitalize">{cabinLabel}</span>
          </p>
        </div>

        <FlightProvenance
          provenance={searchResponse.provenance}
          availabilityState={searchResponse.availability_state}
          retrievedAt={searchResponse.retrieved_at}
        />
      </div>

      {/* Decision Summary Pill Bar (Cheapest, Fastest, Balanced) */}
      {filteredOffers.length > 0 && (
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-3 transition-opacity ${
            isStale ? 'opacity-70' : 'opacity-100'
          }`}
          data-testid="decision-summary-bar"
        >
          {/* Cheapest Metric */}
          {decisionMetrics.lowestFare !== null && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleScrollToOffer(decisionMetrics.cheapestOffer?.offer_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleScrollToOffer(decisionMetrics.cheapestOffer?.offer_id);
                }
              }}
              aria-label="View cheapest flight option in catalog"
              className="p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 space-y-1 cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800">
                  CHEAPEST
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {formatFlightDuration(decisionMetrics.cheapestOffer?.duration_minutes)} · {decisionMetrics.cheapestOffer?.stops === 0 ? 'Direct' : `${decisionMetrics.cheapestOffer?.stops} stop`}
                </span>
              </div>
              <div className="text-lg font-bold font-serif-editorial text-emerald-950">
                {formatCurrency(decisionMetrics.lowestFare, rawOffers[0]?.currency)}
              </div>
              <p className="text-[10px] text-emerald-700">Lowest fare · trade-off: longer transit or stop</p>
            </div>
          )}

          {/* Fastest Metric */}
          {decisionMetrics.fastestDuration !== null && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleScrollToOffer(decisionMetrics.fastestOffer?.offer_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleScrollToOffer(decisionMetrics.fastestOffer?.offer_id);
                }
              }}
              aria-label="View fastest flight option in catalog"
              className="p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 space-y-1 cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-blue-800">
                  FASTEST
                </span>
                <span className="text-[11px] font-semibold text-blue-700">
                  {formatFlightDuration(decisionMetrics.fastestDuration)} · {decisionMetrics.fastestOffer?.stops === 0 ? 'Direct' : `${decisionMetrics.fastestOffer?.stops} stop`}
                </span>
              </div>
              <div className="text-lg font-bold font-serif-editorial text-blue-950">
                {formatCurrency(decisionMetrics.fastestOffer?.price, rawOffers[0]?.currency)}
              </div>
              <p className="text-[10px] text-blue-700">Shortest travel time · trade-off: higher fare</p>
            </div>
          )}

          {/* Balanced Option Metric */}
          {decisionMetrics.balancedFare !== null && decisionMetrics.balancedDuration !== null && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleScrollToOffer(decisionMetrics.balancedOffer?.offer_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleScrollToOffer(decisionMetrics.balancedOffer?.offer_id);
                }
              }}
              aria-label="View balanced flight option in catalog"
              className="p-3.5 rounded-2xl bg-orange-50/70 hover:bg-orange-100/70 border border-orange-200/80 space-y-1 cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-orange-800">
                  <Sparkles className="w-3 h-3 text-orange-600" />
                  <span>BALANCED</span>
                </div>
                <span className="text-[11px] font-semibold text-orange-700">
                  {formatFlightDuration(decisionMetrics.balancedDuration)} · {decisionMetrics.balancedOffer?.stops === 0 ? 'Direct' : `${decisionMetrics.balancedOffer?.stops} stop`}
                </span>
              </div>
              <div className="text-lg font-bold font-serif-editorial text-orange-950">
                {formatCurrency(decisionMetrics.balancedFare, rawOffers[0]?.currency)}
              </div>
              <p className="text-[10px] text-orange-700">Optimal combination of fare, direct route & timing</p>
            </div>
          )}
        </div>
      )}

      {/* Main Results Layout: Sidebar Filters + Right Column (Sort + Cards) */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6 items-start transition-opacity ${
          isStale ? 'opacity-70' : 'opacity-100'
        }`}
      >
        {/* Mobile Filter & Sort Top Bar */}
        <div className="lg:hidden flex items-center justify-between gap-3 col-span-1">
          <button
            type="button"
            onClick={() => setShowMobileFilters(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            data-testid="mobile-filter-trigger"
          >
            <Filter className="w-4 h-4 text-orange-500" />
            <span>{activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}</span>
          </button>

          <div className="relative">
            <select
              value={currentSort}
              onChange={(e) => setCurrentSort(e.target.value as FlightSortOption)}
              className="appearance-none flex items-center gap-1.5 px-3.5 py-2 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-orange-500"
              data-testid="mobile-sort-select"
              aria-label="Sort flight options"
            >
              <option value="balanced">Sort: Balanced</option>
              <option value="cheapest">Sort: Cheapest</option>
              <option value="fastest">Sort: Fastest</option>
              <option value="earliest">Sort: Earliest</option>
              <option value="latest">Sort: Latest</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Desktop Filters Sidebar */}
        <aside className="hidden lg:block sticky top-24">
          <FlightFilters
            filters={filters}
            onChange={setFilters}
            availableAirlines={availableAirlines}
            minPrice={minPrice}
            maxPrice={maxPrice}
            totalCount={rawOffers.length}
            filteredCount={filteredOffers.length}
            onReset={handleResetFilters}
          />
        </aside>

        {/* Mobile Filter Drawer / Bottom Sheet */}
        {showMobileFilters && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filters-heading"
            className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 lg:hidden"
            data-testid="mobile-filters-sheet"
          >
            {/* Backdrop click to dismiss */}
            <div
              className="absolute inset-0"
              onClick={() => setShowMobileFilters(false)}
              aria-hidden="true"
            />

            {/* Bottom Sheet Modal Container */}
            <div className="relative z-10 w-full max-h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-orange-500" />
                  <h3 id="mobile-filters-heading" className="text-sm font-bold text-slate-900">
                    Filters
                  </h3>
                  {activeFilterCount > 0 && (
                    <span className="text-[11px] font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  aria-label="Close filters"
                  data-testid="close-mobile-filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Filters Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <FlightFilters
                  filters={filters}
                  onChange={setFilters}
                  availableAirlines={availableAirlines}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  totalCount={rawOffers.length}
                  filteredCount={filteredOffers.length}
                  onReset={handleResetFilters}
                />
              </div>

              {/* Bottom Actions Bar */}
              <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  data-testid="reset-mobile-filters-btn"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-2xs transition-colors cursor-pointer text-center"
                  data-testid="apply-mobile-filters-btn"
                >
                  Show {filteredOffers.length} {filteredOffers.length === 1 ? 'flight' : 'flights'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Sort bar + Cards List or Empty Filter Notice */}
        <div className="space-y-4">
          {/* Screen reader live announcements */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {filteredOffers.length} flights available for current search and filters.
          </div>

          {/* Sorting Bar + Compare Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FlightSort currentSort={currentSort} onSortChange={setCurrentSort} />

            {comparedOffers.length > 0 && (
              <button
                type="button"
                onClick={() => setIsComparisonOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0"
                data-testid="open-comparison-btn"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare Selected ({comparedOffers.length}/3)</span>
              </button>
            )}
          </div>

          {/* Cards List or Diagnostic Empty State after filtering */}
          {sortedOffers.length === 0 ? (
            <div
              className="py-12 px-6 rounded-2xl bg-white border border-slate-200 text-center space-y-4 shadow-2xs"
              data-testid="no-matching-flights"
            >
              <Plane className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">No matching flights</h4>
                <p className="text-xs text-slate-500">
                  Your filters removed all {rawOffers.length} options.
                </p>
              </div>

              {/* Diagnostic actions that actually update state */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
                <span className="text-[11px] font-semibold text-slate-400 w-full block uppercase tracking-wider mb-1">
                  Try adjusting:
                </span>
                {filters.stops.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, stops: [] }))}
                    className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Clear stops
                  </button>
                )}
                {filters.maxPrice < maxPrice && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, maxPrice }))}
                    className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Increase price
                  </button>
                )}
                {(filters.departureSlots.length > 0 || filters.arrivalSlots.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, departureSlots: [], arrivalSlots: [] }))}
                    className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Clear time slots
                  </button>
                )}
                {filters.airlines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, airlines: [] }))}
                    className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Clear airlines
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset all filters</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5" data-testid="flight-offer-list">
              {sortedOffers.map((offer) => {
                const isCompared = comparedOffers.some((o) => o.offer_id === offer.offer_id);
                const canCompare = isCompared || comparedOffers.length < 3;
                const isSelected = selectedOfferId === offer.offer_id;
                const isBalanced = offer.offer_id === decisionMetrics.balancedOffer?.offer_id;
                const isCheapest = offer.offer_id === decisionMetrics.cheapestOffer?.offer_id;
                const isFastest = offer.offer_id === decisionMetrics.fastestOffer?.offer_id;
                const factualReason = computeFactualWhyThisFits(offer, decisionMetrics);

                return (
                  <FlightOfferCard
                    key={offer.offer_id}
                    offer={offer}
                    isCompared={isCompared}
                    canCompare={canCompare}
                    onToggleCompare={handleToggleCompare}
                    onSelectOffer={onSelectOffer}
                    isSelected={isSelected}
                    isBalanced={isBalanced}
                    isCheapest={isCheapest}
                    isFastest={isFastest}
                    whyThisFits={factualReason}
                    isStale={isStale}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Comparison Tray (Desktop/Mobile) - lightweight temporary workspace */}
      {comparedOffers.length > 0 && !isComparisonOpen && (
        <aside
          aria-label="Flight comparison tray"
          className="fixed bottom-[76px] md:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-3 px-3.5 py-2.5 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 animate-in slide-in-from-bottom-4 duration-200"
          data-testid="floating-comparison-tray"
        >
          <div className="flex items-center gap-2 pl-1">
            <Scale className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-semibold">
              {comparedOffers.length} selected
            </span>
            <span className="sr-only">
              {comparedOffers.length} {comparedOffers.length === 1 ? 'flight' : 'flights'} in comparison
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="floating-compare-btn"
              onClick={() => setIsComparisonOpen(true)}
              className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
            >
              Compare
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

      {/* Comparison Modal with Responsive Mobile Scroll & Sticky Labels */}
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
