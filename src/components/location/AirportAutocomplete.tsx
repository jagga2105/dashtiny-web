'use client';

import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { Plane, Search, X, Loader2, MapPin, AlertCircle, Check } from 'lucide-react';
import { apiService, AirportLocation } from '@/services/api';

export interface AirportAutocompleteProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value?: AirportLocation | string | null;
  onSelect: (airport: AirportLocation | null) => void;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  helperText?: string;
}

export function AirportAutocomplete({
  id: explicitId,
  label,
  placeholder = 'Search by city, airport name, or IATA code (e.g. DEL, Delhi)…',
  value,
  onSelect,
  disabled = false,
  required = false,
  autoFocus = false,
  className = '',
  helperText,
}: AirportAutocompleteProps) {
  const generatedId = useId();
  const inputId = explicitId || `airport-autocomplete-${generatedId}`;
  const listboxId = `${inputId}-listbox`;

  const [inputValue, setInputValue] = useState('');
  const [selectedAirport, setSelectedAirport] = useState<AirportLocation | null>(null);
  const [results, setResults] = useState<AirportLocation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync external value
  useEffect(() => {
    if (value === null || value === '') {
      setSelectedAirport(null);
      setInputValue('');
      return;
    }

    if (!value) return;

    if (typeof value === 'object') {
      setSelectedAirport(value);
      setInputValue(`${value.city} (${value.iata_code})`);
    } else if (typeof value === 'string' && value.trim()) {
      const code = value.trim().toUpperCase();
      // If code is 3 letters, fetch its details if needed
      if (code.length === 3) {
        apiService
          .getAirport(code)
          .then((airport) => {
            if (airport) {
              setSelectedAirport(airport);
              setInputValue(`${airport.city} (${airport.iata_code})`);
            } else {
              setInputValue(code);
            }
          })
          .catch(() => {
            setInputValue(code);
          });
      } else {
        setInputValue(value);
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const performSearch = useCallback((query: string) => {
    if (!query || query.trim().length === 0) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    apiService
      .searchLocations(query.trim(), 12)
      .then((data) => {
        setResults(data || []);
        setIsLoading(false);
        setActiveIndex(data && data.length > 0 ? 0 : -1);
      })
      .catch((err) => {
        console.error('Failed to search airport locations:', err);
        setError('Unable to load airports. Please check your connection.');
        setResults([]);
        setIsLoading(false);
      });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setSelectedAirport(null);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val);
    }, 250);
  };

  const handleSelectAirport = (airport: AirportLocation) => {
    setSelectedAirport(airport);
    setInputValue(`${airport.city} (${airport.iata_code})`);
    setIsOpen(false);
    setActiveIndex(-1);
    setResults([]);
    onSelect(airport);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSelectedAirport(null);
    setInputValue('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setError(null);
    onSelect(null);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        if (results.length === 0 && inputValue.trim()) {
          performSearch(inputValue);
        }
      } else if (results.length > 0) {
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (results.length > 0) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        handleSelectAirport(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Tab') {
      if (isOpen && activeIndex >= 0 && activeIndex < results.length) {
        handleSelectAirport(results[activeIndex]);
      }
      setIsOpen(false);
    }
  };

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    if (!inputValue.trim() && results.length === 0) {
      // Load popular hubs
      performSearch('');
    } else if (inputValue.trim() && results.length === 0) {
      performSearch(inputValue);
    }
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center justify-between">
          <span>{label}</span>
          {selectedAirport && (
            <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
              {selectedAirport.iata_code}
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" data-testid="airport-loading-spinner" />
          ) : (
            <Plane className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`w-full pl-10 pr-9 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-medium transition-all outline-none ${
            isOpen
              ? 'border-orange-500 ring-2 ring-orange-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 focus:border-orange-500'
          } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-slate-900 placeholder:text-slate-400'}`}
        />

        {inputValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear airport input"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {helperText && !error && (
        <span className="text-[11px] text-slate-500">{helperText}</span>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1.5 max-h-72 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
        >
          {isLoading && results.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2" data-testid="airport-loading-state">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              <span>Searching verified airports…</span>
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-xs text-rose-600 flex items-center justify-center gap-2" data-testid="airport-error-state">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && results.length === 0 && inputValue.trim().length > 0 && (
            <div className="p-4 text-center text-xs text-slate-500 space-y-1" data-testid="airport-empty-state">
              <p className="font-semibold text-slate-700">No matching airports found</p>
              <p className="text-[11px] text-slate-400">
                Try searching by city name (e.g. &quot;Delhi&quot;, &quot;Bengaluru&quot;), airport name, or IATA code (&quot;DEL&quot;, &quot;BLR&quot;).
              </p>
            </div>
          )}

          {results.length > 0 &&
            results.map((airport, index) => {
              const isSelected = selectedAirport?.id === airport.id;
              const isActive = activeIndex === index;

              return (
                <div
                  key={airport.id}
                  id={`${inputId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectAirport(airport)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`p-3 text-left cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                    isActive ? 'bg-orange-50/70 text-slate-900' : 'hover:bg-slate-50 text-slate-800'
                  } ${isSelected ? 'border-l-4 border-l-orange-500 bg-orange-50/40' : ''}`}
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    {/* Information Hierarchy: City */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {airport.city}
                      </span>
                      {airport.state_region && (
                        <span className="text-[11px] text-slate-500 font-normal">
                          · {airport.state_region}
                        </span>
                      )}
                    </div>

                    {/* Airport Name */}
                    <p className="text-xs font-medium text-slate-600 truncate">
                      {airport.name}
                    </p>

                    {/* Metadata Row: DEL · New Delhi · India */}
                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-500">
                      <span className="font-mono font-bold text-orange-600 bg-orange-100/70 px-1.5 py-0.2 rounded text-[10px]">
                        {airport.iata_code}
                      </span>
                      <span>·</span>
                      <span className="truncate">{airport.city}</span>
                      <span>·</span>
                      <span className="truncate">{airport.country}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-1">
                    {isSelected && (
                      <Check className="w-4 h-4 text-orange-600 stroke-[3]" />
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
