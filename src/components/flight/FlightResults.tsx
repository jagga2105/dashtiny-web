'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Filter,
  Sparkles,
  ArrowUpDown,
  RefreshCw,
  Scale,
  X,
  AlertCircle,
  Plane,
  Clock,
  ChevronRight,
  Compass,
} from 'lucide-react';
import {
  FlightOffer,
  FlightSearchParams,
  FlightSearchResponse,
  FlightSortOption,
  FlightFilterState,
} from '@/types/flight';
import {
  filterFlightOffers,
  getPriceBounds,
  getAvailableAirlines,
  DEFAULT_FLIGHT_FILTERS,
} from '@/lib/flight/filtering';
import {
  computeFlightDecisionMetrics,
  sortFlightOffers,
  computeFactualWhyThisFits,
  formatFlightDuration,
} from '@/lib/flight/ranking';
import { formatCurrency } from '@/lib/formatCurrency';
import { formatFriendlyDateRange } from '@/lib/formatDate';
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
  previousSearchParams?: FlightSearchParams | null;
  currentSearchParams?: FlightSearchParams | null;
  onRefreshSearch?: () => void;
  selectedOfferId?: string | null;
  onSelectOffer: (offer: FlightOffer) => void;
  onRetrySearch?: () => void;
  onSearchWithParams?: (params: FlightSearchParams) => void;
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
  onSearchWithParams,
  className = '',
}: FlightResultsProps) {
  const [filters, setFilters] = useState<FlightFilterState>(DEFAULT_FLIGHT_FILTERS);
  const [currentSort, setCurrentSort] = useState<FlightSortOption>('balanced');
  const [comparedOffers, setComparedOffers] = useState<FlightOffer[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [comparisonLimitWarning, setComparisonLimitWarning] = useState(false);

  // Raw offers
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

  // Active filter count for mobile badge
  const activeFilterCount = useMemo(() => {
    if (rawOffers.length === 0) return 0;
    let count = 0;
    if (filters.stops.length > 0) count += filters.stops.length;
    if (filters.airlines.length > 0) count += filters.airlines.length;
    if (filters.departureSlots.length > 0) count += filters.departureSlots.length;
    if (filters.arrivalSlots && filters.arrivalSlots.length > 0) count += filters.arrivalSlots.length;
    if (maxPrice > minPrice && filters.maxPrice < maxPrice) count += 1;
    return count;
  }, [filters, rawOffers.length, minPrice, maxPrice]);

  // Lock body scroll for mobile filter drawer
  useEffect(() => {
    if (!showMobileFilters) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMobileFilters(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [showMobileFilters]);

  // Sync max price filter when catalog changes
  useEffect(() => {
    if (maxPrice > 0 && (filters.maxPrice === 100000 || filters.maxPrice < minPrice)) {
      setFilters((prev) => ({ ...prev, maxPrice }));
    }
  }, [maxPrice, minPrice, filters.maxPrice]);

  // Filtered offers
  const filteredOffers = useMemo(() => {
    return filterFlightOffers(rawOffers, filters);
  }, [rawOffers, filters]);

  // Decision metrics
  const decisionMetrics = useMemo(() => {
    return computeFlightDecisionMetrics(filteredOffers);
  }, [filteredOffers]);

  // Sorted offers
  const sortedOffers = useMemo(() => {
    return sortFlightOffers(
      filteredOffers,
      currentSort,
      decisionMetrics.balancedOffer?.offer_id
    );
  }, [filteredOffers, currentSort, decisionMetrics.balancedOffer?.offer_id]);

  // Handle comparison selection (max 3)
  const handleToggleCompare = (offer: FlightOffer) => {
    setComparedOffers((prev) => {
      const exists = prev.some((o) => o.offer_id === offer.offer_id);
      if (exists) {
        return prev.filter((o) => o.offer_id !== offer.offer_id);
      }
      if (prev.length >= 3) {
        setComparisonLimitWarning(true);
        setTimeout(() => setComparisonLimitWarning(false), 3000);
        return prev;
      }
      return [...prev, offer];
    });
  };

  const handleRemoveComparedOffer = (offerId: string) => {
    setComparedOffers((prev) => prev.filter((o) => o.offer_id !== offerId));
  };

  const handleResetFilters = () => {
    setFilters({
      ...DEFAULT_FLIGHT_FILTERS,
      maxPrice: maxPrice || 100000,
    });
  };

  // Scroll to targeted offer
  const handleScrollToOffer = (offerId?: string) => {
    if (!offerId) return;
    const element = document.querySelector(`[data-testid="flight-card-${offerId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-orange-500');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-orange-500');
      }, 1500);
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`} data-testid="flight-search-loading">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50/70 border border-orange-200/70 text-xs text-orange-950">
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">Comparing current catalog options…</span>
        </div>

        {/* 3 Skeleton Cards */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-3xl bg-white border border-stone-200/80 shadow-2xs space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-stone-200" />
                  <div className="space-y-1">
                    <div className="w-24 h-4 bg-stone-200 rounded" />
                    <div className="w-16 h-3 bg-stone-100 rounded" />
                  </div>
                </div>
                <div className="w-20 h-5 bg-stone-100 rounded-full" />
              </div>
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center justify-between gap-4 flex-1 w-full">
                  <div className="space-y-1">
                    <div className="w-16 h-6 bg-stone-200 rounded" />
                    <div className="w-20 h-3 bg-stone-100 rounded" />
                  </div>
                  <div className="w-32 h-1 bg-stone-200 rounded" />
                  <div className="space-y-1 text-right">
                    <div className="w-16 h-6 bg-stone-200 rounded" />
                    <div className="w-20 h-3 bg-stone-100 rounded" />
                  </div>
                </div>
                <div className="w-28 h-10 bg-stone-200 rounded-xl shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error Recovery State
  if (error) {
    return (
      <div
        className={`p-8 rounded-3xl bg-white border border-stone-200 text-center space-y-4 shadow-sm ${className}`}
        data-testid="flight-search-error"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="font-bold text-stone-900 text-base">We couldn't load flight options</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            {error || 'Please try the search again.'}
          </p>
        </div>
        {onRetrySearch && (
          <button
            type="button"
            onClick={onRetrySearch}
            className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
            data-testid="retry-flight-search-btn"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  // Initial Empty State (No search performed yet)
  if (!searchResponse) {
    return (
      <div
        className={`p-10 rounded-3xl bg-white border border-stone-200/80 text-center space-y-3 shadow-2xs ${className}`}
        data-testid="flight-search-empty"
      >
        <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
          <Plane className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-sm mx-auto">
          <h3 className="font-bold text-stone-800 text-sm">Ready to search flights</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Select origin, destination, and dates above to compare current DashTiny options.
          </p>
        </div>
      </div>
    );
  }

  const searchSummary = searchResponse.search_params || searchResponse.search;
  const travelersCount = searchSummary?.passengers || 1;
  const travelersLabel = `${travelersCount} ${travelersCount === 1 ? 'traveler' : 'travelers'}`;
  const cabinLabel = searchSummary?.cabin_class?.replace('_', ' ') || 'Economy';

  return (
    <div className={`space-y-6 ${className}`} data-testid="flight-results-container">
      {/* Stale Search Notice Banner */}
      {isStale && (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 shadow-2xs animate-in fade-in"
          data-testid="stale-search-banner"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Search changed.</strong> Search parameters updated — these results are for{' '}
              <strong>
                {previousSearchParams?.origin || searchSummary?.origin} →{' '}
                {previousSearchParams?.destination || searchSummary?.destination}
              </strong>{' '}
              · {previousSearchParams?.departureDate || searchSummary?.departure_date}
            </span>
          </div>
          {onRefreshSearch && (
            <button
              type="button"
              onClick={onRefreshSearch}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs cursor-pointer"
              data-testid="refresh-search-btn"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Update results</span>
            </button>
          )}
        </div>
      )}

      {/* Compact Results Header: 24 options · DEL → GOI · 20 Oct · 2 travelers · Economy */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600 border-b border-stone-200 pb-3 transition-opacity ${
          isStale ? 'opacity-70' : 'opacity-100'
        }`}
        data-testid="search-summary-header"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-stone-900 text-sm">
            {rawOffers.length} {rawOffers.length === 1 ? 'option' : 'options'}
          </span>
          <span className="text-stone-300">·</span>
          <span className="font-bold text-orange-600 uppercase">
            {searchSummary?.origin} → {searchSummary?.destination}
          </span>
          <span className="text-stone-300">·</span>
          <span>
            {formatFriendlyDateRange(searchSummary?.departure_date, searchSummary?.return_date)}
          </span>
          <span className="text-stone-300">·</span>
          <span>{travelersLabel}</span>
          <span className="text-stone-300">·</span>
          <span className="capitalize">{cabinLabel}</span>
        </div>

        <FlightProvenance
          provenance={searchResponse.provenance}
          availabilityState={searchResponse.availability_state}
          retrievedAt={searchResponse.retrieved_at}
        />
      </div>

      {/* Decision Support: Compact Decision Chips (No giant colored boxes) */}
      {filteredOffers.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-2.5 transition-opacity ${
            isStale ? 'opacity-70' : 'opacity-100'
          }`}
          data-testid="decision-summary-bar"
        >
          {/* Balanced Option Chip */}
          {decisionMetrics.balancedFare !== null && decisionMetrics.balancedDuration !== null && (
            <button
              type="button"
              onClick={() => handleScrollToOffer(decisionMetrics.balancedOffer?.offer_id)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200/90 text-orange-950 text-xs transition-all cursor-pointer shadow-2xs"
              title="DashTiny balances fare, travel duration and stops. It is a deterministic comparison heuristic, not an objective best-flight claim."
              aria-label="View DashTiny balanced option in current results"
            >
              <div className="flex items-center gap-1 font-bold tracking-wider uppercase text-[10px] text-orange-800">
                <Sparkles className="w-3 h-3 text-orange-600" />
                <span>BALANCED IN CURRENT RESULTS</span>
              </div>
              <span className="font-bold font-mono text-orange-950">
                {formatCurrency(decisionMetrics.balancedFare, rawOffers[0]?.currency)}
              </span>
              <span className="text-[11px] text-orange-700">
                · {formatFlightDuration(decisionMetrics.balancedDuration)} · DashTiny balanced option · Balanced fare, duration & stops
              </span>
            </button>
          )}

          {/* Cheapest Metric Chip */}
          {decisionMetrics.lowestFare !== null && (
            <button
              type="button"
              onClick={() => handleScrollToOffer(decisionMetrics.cheapestOffer?.offer_id)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-stone-900 text-xs transition-all cursor-pointer shadow-2xs"
              aria-label="View cheapest flight option in current results"
            >
              <span className="font-bold tracking-wider uppercase text-[10px] text-stone-600">
                CHEAPEST IN CURRENT RESULTS
              </span>
              <span className="font-bold font-mono text-stone-950">
                {formatCurrency(decisionMetrics.lowestFare, rawOffers[0]?.currency)}
              </span>
              <span className="text-[11px] text-stone-500">
                · {formatFlightDuration(decisionMetrics.cheapestOffer?.duration_minutes)}
              </span>
            </button>
          )}

          {/* Fastest Metric Chip */}
          {decisionMetrics.fastestDuration !== null && (
            <button
              type="button"
              onClick={() => handleScrollToOffer(decisionMetrics.fastestOffer?.offer_id)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-stone-900 text-xs transition-all cursor-pointer shadow-2xs"
              aria-label="View fastest flight option in current results"
            >
              <span className="font-bold tracking-wider uppercase text-[10px] text-stone-600">
                FASTEST IN CURRENT RESULTS
              </span>
              <span className="font-bold font-mono text-stone-950">
                {formatFlightDuration(decisionMetrics.fastestDuration)}
              </span>
              <span className="text-[11px] text-stone-500">
                · {formatCurrency(decisionMetrics.fastestOffer?.price, rawOffers[0]?.currency)}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Mobile Filters & Sort Bar (Mobile only) */}
      <div className="lg:hidden flex items-center justify-between gap-3 w-full">
        <button
          type="button"
          onClick={() => setShowMobileFilters(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-50 transition-colors cursor-pointer"
          data-testid="mobile-filter-trigger"
        >
          <Filter className="w-4 h-4 text-orange-600" />
          <span>{activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}</span>
        </button>

        <div className="relative">
          <select
            value={currentSort}
            onChange={(e) => setCurrentSort(e.target.value as FlightSortOption)}
            className="appearance-none flex items-center gap-1.5 px-3.5 py-2 pr-8 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
            data-testid="mobile-sort-select"
            aria-label="Sort flight options"
          >
            <option value="balanced">Sort: DashTiny balanced option</option>
            <option value="cheapest">Sort: Cheapest</option>
            <option value="fastest">Sort: Fastest</option>
            <option value="earliest">Sort: Earliest</option>
            <option value="latest">Sort: Latest</option>
          </select>
          <ArrowUpDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Main Layout: 260px Sidebar Filters + Right Results Column */}
      <div
        className={`flex flex-col lg:flex-row items-start gap-6 transition-opacity ${
          isStale ? 'opacity-70' : 'opacity-100'
        }`}
      >
        {/* Desktop Filters Sidebar (260px) */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-24 z-10 self-start">
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

        {/* Mobile Filter Drawer */}
        {showMobileFilters && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filters-heading"
            className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200 lg:hidden"
            data-testid="mobile-filters-sheet"
          >
            <div
              className="absolute inset-0"
              onClick={() => setShowMobileFilters(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-orange-600" />
                  <h3 id="mobile-filters-heading" className="text-sm font-bold text-stone-900">
                    Filters
                  </h3>
                  {activeFilterCount > 0 && (
                    <span className="text-[11px] font-semibold text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
                  aria-label="Close filters"
                  data-testid="close-mobile-filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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

              <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
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

        {/* Right Column: Sort Controls + Flight Cards */}
        <div className="space-y-4">
          {/* Live announcement for assistive tech */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {filteredOffers.length} flights available for current search and filters.
          </div>

          {/* Desktop Sort Bar */}
          <div className="hidden lg:flex items-center justify-between gap-3">
            <FlightSort currentSort={currentSort} onSortChange={setCurrentSort} />
          </div>

          {/* Cards List or Tailored Empty State */}
          {rawOffers.length === 0 ? (
            /* Case 1: Search returned 0 flights for this route */
            <div
              className="py-12 px-6 sm:px-10 rounded-3xl bg-white border border-stone-200/90 text-center space-y-6 shadow-2xs"
              data-testid="no-matching-flights"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
                <Compass className="w-7 h-7" />
              </div>

              <div className="space-y-2.5 max-w-lg mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-[11px] font-semibold">
                  <span>Curated Travel Catalog</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-serif-editorial text-stone-900 tracking-tight">
                  No scheduled flights found for this route
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  {currentSearchParams?.origin || previousSearchParams?.origin ? (
                    <>
                      We couldn't find scheduled flights between{' '}
                      <strong className="text-stone-900 font-bold">
                        {currentSearchParams?.origin || previousSearchParams?.origin}
                      </strong>{' '}
                      and{' '}
                      <strong className="text-stone-900 font-bold">
                        {currentSearchParams?.destination || previousSearchParams?.destination}
                      </strong>{' '}
                      on the selected dates in DashTiny's current catalog.
                    </>
                  ) : (
                    "We couldn't find scheduled flight options for your search parameters."
                  )}
                </p>
              </div>

              {/* Intelligent Gateway Alternatives */}
              <div className="pt-5 border-t border-stone-100 max-w-xl mx-auto space-y-3">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Intelligent Gateway Suggestions
                </span>
                <p className="text-xs text-stone-500 leading-normal">
                  Most travelers flying to regional or international destinations connect through major hubs:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {onSearchWithParams && (currentSearchParams || previousSearchParams) && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const base = currentSearchParams || previousSearchParams!;
                          onSearchWithParams({ ...base, origin: 'DEL' });
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100/80 border border-orange-200 text-orange-900 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Plane className="w-3.5 h-3.5 text-orange-600" />
                        <span>Search from Delhi (DEL → {currentSearchParams?.destination || previousSearchParams?.destination || 'Destination'})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = currentSearchParams || previousSearchParams!;
                          onSearchWithParams({ ...base, origin: 'BOM' });
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Plane className="w-3.5 h-3.5 text-stone-500" />
                        <span>Search from Mumbai (BOM → {currentSearchParams?.destination || previousSearchParams?.destination || 'Destination'})</span>
                      </button>
                    </>
                  )}
                  {onRefreshSearch && (
                    <button
                      type="button"
                      onClick={onRefreshSearch}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Try flexible dates</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : filteredOffers.length === 0 ? (
            /* Case 2: Filters removed all raw results */
            <div
              className="py-12 px-6 rounded-3xl bg-white border border-stone-200 text-center space-y-5 shadow-2xs"
              data-testid="no-matching-flights"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center mx-auto">
                <Filter className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="font-bold text-stone-900 text-base">No flights match these filters</h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Your active filters excluded all <strong className="text-stone-900 font-semibold">{rawOffers.length}</strong> available flights for this route.
                </p>
              </div>

              {/* Dynamic Recovery Actions matching active filters */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
                <span className="text-[11px] font-semibold text-stone-400 w-full block uppercase tracking-wider mb-1">
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
                {maxPrice > minPrice && filters.maxPrice < maxPrice && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, maxPrice }))}
                    className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Clear price filter
                  </button>
                )}
                {filters.airlines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, airlines: [] }))}
                    className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors cursor-pointer"
                  >
                    All airlines
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  Reset all filters
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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

      {/* Sticky Bottom Comparison Tray (When 1-3 flights selected) */}
      {comparedOffers.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-xl bg-stone-900 text-white rounded-3xl p-4 sm:px-6 shadow-2xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-6 duration-200"
          data-testid="floating-comparison-tray"
        >
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="font-bold text-xs sm:text-sm">
                {comparedOffers.length} {comparedOffers.length === 1 ? 'flight' : 'flights'} in comparison
              </span>
            </div>
            <div className="text-[11px] text-stone-300 truncate">
              {comparedOffers.map((o) => `${o.airline} (${formatCurrency(o.price, o.currency)})`).join(' vs ')}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsComparisonOpen(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
              data-testid="open-comparison-btn"
            >
              Compare flights
            </button>
            <button
              type="button"
              onClick={() => setComparedOffers([])}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Clear comparison selection"
              aria-label="Clear comparison"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      <FlightComparison
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        selectedOffers={comparedOffers}
        onRemoveOffer={handleRemoveComparedOffer}
        onSelectOffer={(offer) => {
          setIsComparisonOpen(false);
          onSelectOffer(offer);
        }}
      />
    </div>
  );
}
