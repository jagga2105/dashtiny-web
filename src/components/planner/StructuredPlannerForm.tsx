'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Wallet,
  Compass,
  ArrowRight,
  Sliders,
  Check,
  Coffee,
  Bed,
  Car,
  Utensils,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Clock,
  Navigation,
  Train,
  Plane,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AirportAutocomplete } from '@/components/location/AirportAutocomplete';
import { AirportLocation } from '@/services/api';

export interface StopoverValue {
  location: string;
  nights?: number;
  sequence: number;
}

export interface StructuredPlannerFormValues {
  destination: string;
  origin: string;
  originAirport?: AirportLocation | null;
  startDate?: string;
  endDate?: string;
  daysCount: number;
  travelers: number;
  budget: number;
  currency: string;
  pace: 'relaxed' | 'balanced' | 'fast' | 'packed';
  tripType: 'leisure' | 'adventure' | 'romantic' | 'business' | 'backpacking' | 'luxury' | 'family';
  travelMode: 'flight' | 'train' | 'bus' | 'car' | 'mixed';
  dailySchedule: 'early_riser' | 'balanced' | 'night_owl';
  itineraryStyle: 'daily' | 'detailed';
  stopovers: StopoverValue[];
  interests: string[];
  wakeUpPreference?: 'early_bird' | 'balanced' | 'late_morning';
  accommodationPreference: 'budget' | 'comfort' | 'boutique' | 'luxury';
  transportPreference: 'walking' | 'cab' | 'public_transit' | 'mix';
  foodPreferences: string[];
  rawPrompt?: string;
}

interface StructuredPlannerFormProps {
  initialValues?: Partial<StructuredPlannerFormValues>;
  onSubmitProposal: (values: StructuredPlannerFormValues) => void;
  isGenerating: boolean;
  generationStepText?: string;
}

const POPULAR_PROMPTS = [
  '7 day relaxed Goa trip from Delhi for 60k with partner, food and sunset photography, include South Goa 2 nights',
  '5 day Jaipur and Udaipur heritage escape for couple under 45k, palaces and local bazaars',
  '3 day Manali alpine mountain getaway from Delhi, early morning trails, cafes and quiet scenery',
  '10 day cultural tour of Kerala with backwaters and tea estates under 80k for family',
];

const INTEREST_OPTIONS = [
  { id: 'food', label: 'Culinary & Food' },
  { id: 'beaches', label: 'Beaches & Coast' },
  { id: 'culture', label: 'Heritage & Culture' },
  { id: 'nature', label: 'Nature & Trails' },
  { id: 'photography', label: 'Photography' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'wellness', label: 'Wellness & Spa' },
];

export function StructuredPlannerForm({
  initialValues,
  onSubmitProposal,
  isGenerating,
  generationStepText,
}: StructuredPlannerFormProps) {
  // Input mode: 'natural' vs 'structured'
  const [promptText, setPromptText] = useState(initialValues?.rawPrompt || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form states
  const [destination, setDestination] = useState(initialValues?.destination || '');
  const [origin, setOrigin] = useState(initialValues?.origin || '');
  const [originAirport, setOriginAirport] = useState<AirportLocation | null>(initialValues?.originAirport || null);
  const [startDate, setStartDate] = useState(initialValues?.startDate || '');
  const [endDate, setEndDate] = useState(initialValues?.endDate || '');
  const [daysCount, setDaysCount] = useState(initialValues?.daysCount || 4);
  const [travelers, setTravelers] = useState(initialValues?.travelers || 2);
  const [budget, setBudget] = useState(initialValues?.budget || 60000);
  const [pace, setPace] = useState<'relaxed' | 'balanced' | 'fast' | 'packed'>(initialValues?.pace || 'balanced');
  const [tripType, setTripType] = useState<StructuredPlannerFormValues['tripType']>(initialValues?.tripType || 'leisure');
  const [travelMode, setTravelMode] = useState<StructuredPlannerFormValues['travelMode']>(initialValues?.travelMode || 'flight');
  const [dailySchedule, setDailySchedule] = useState<'early_riser' | 'balanced' | 'night_owl'>(initialValues?.dailySchedule || 'balanced');
  const [itineraryStyle, setItineraryStyle] = useState<'daily' | 'detailed'>(initialValues?.itineraryStyle || 'daily');
  const [stopovers, setStopovers] = useState<StopoverValue[]>(initialValues?.stopovers || []);
  const [interests, setInterests] = useState<string[]>(initialValues?.interests || ['food', 'culture']);
  const [accommodation, setAccommodation] = useState<'budget' | 'comfort' | 'boutique' | 'luxury'>(initialValues?.accommodationPreference || 'comfort');
  const [foodPref, setFoodPref] = useState<string[]>(initialValues?.foodPreferences || ['any']);

  // Stopover input fields
  const [newStopLocation, setNewStopLocation] = useState('');
  const [newStopNights, setNewStopNights] = useState<number>(2);

  // Live parsed intent summary
  const [parsedSummary, setParsedSummary] = useState<string>('');

  useEffect(() => {
    if (!promptText.trim()) {
      setParsedSummary('');
      return;
    }
    const lower = promptText.toLowerCase();

    // Destination extraction
    let detectedDest = '';
    for (const d of ['Goa', 'Kyoto', 'Manali', 'Jaipur', 'Udaipur', 'Kashmir', 'Kerala', 'Paris', 'Tokyo', 'Delhi', 'Mumbai']) {
      if (lower.includes(d.toLowerCase())) {
        detectedDest = d;
        setDestination(d);
        break;
      }
    }

    // Origin
    if (lower.includes('from delhi')) {
      setOrigin('Delhi');
    } else if (lower.includes('from mumbai')) {
      setOrigin('Mumbai');
    } else if (lower.includes('from bangalore') || lower.includes('from bengaluru')) {
      setOrigin('Bengaluru');
    }

    // Days count
    let detectedDays = 4;
    const dMatch = lower.match(/(\d+)\s*(?:day|days|-day)/);
    if (dMatch) {
      detectedDays = parseInt(dMatch[1], 10);
      setDaysCount(detectedDays);
    }

    // Travelers & Persona
    let detectedTravelers = 2;
    if (lower.includes('two people') || lower.includes('couple') || lower.includes('partner') || lower.includes('for 2')) {
      detectedTravelers = 2;
      setTravelers(2);
      setTripType('romantic');
    } else if (lower.includes('solo') || lower.includes('alone') || lower.includes('myself')) {
      detectedTravelers = 1;
      setTravelers(1);
    } else if (lower.includes('family') || lower.includes('kids') || lower.includes('four people') || lower.includes('for 4')) {
      detectedTravelers = 4;
      setTravelers(4);
      setTripType('family');
    }

    // Budget
    let detectedBudget = 50000;
    const kMatch = lower.match(/(\d+)\s*k\b/);
    const lakhMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l\b)/);
    const numMatch = lower.match(/(?:₹|rs\.?|inr|budget\s*of)\s*([0-9]{4,7})/);
    if (kMatch) {
      detectedBudget = parseInt(kMatch[1], 10) * 1000;
      setBudget(detectedBudget);
    } else if (lakhMatch) {
      detectedBudget = parseFloat(lakhMatch[1]) * 100000;
      setBudget(detectedBudget);
    } else if (numMatch) {
      detectedBudget = parseInt(numMatch[1], 10);
      setBudget(detectedBudget);
    }

    // Pace
    let detectedPace = 'balanced';
    if (lower.includes('relaxed') || lower.includes('slow') || lower.includes('chill') || lower.includes('easy')) {
      detectedPace = 'relaxed';
      setPace('relaxed');
    } else if (lower.includes('fast') || lower.includes('packed') || lower.includes('quick')) {
      detectedPace = 'fast';
      setPace('fast');
    }

    // Daily Schedule
    if (lower.includes('early') || lower.includes('sunrise') || lower.includes('8 am') || lower.includes('8:30')) {
      setDailySchedule('early_riser');
    } else if (lower.includes('night owl') || lower.includes('start late') || lower.includes('10 am') || lower.includes('10:30')) {
      setDailySchedule('night_owl');
    } else {
      setDailySchedule('balanced');
    }

    // Stopovers extraction (e.g. "include South Goa for 2 nights")
    const stopoverMatch = lower.match(/include\s+([A-Za-z\s]+?)\s+for\s+(\d+)\s*(?:night|nights)/);
    if (stopoverMatch) {
      const stopLoc = stopoverMatch[1].trim();
      const stopNights = parseInt(stopoverMatch[2], 10);
      if (stopLoc) {
        setStopovers([{ location: stopLoc.charAt(0).toUpperCase() + stopLoc.slice(1), nights: stopNights, sequence: 1 }]);
      }
    }

    // Interests
    const newInts: string[] = [];
    if (lower.includes('beach')) newInts.push('beaches');
    if (lower.includes('food') || lower.includes('dining')) newInts.push('food');
    if (lower.includes('culture') || lower.includes('temple') || lower.includes('heritage')) newInts.push('culture');
    if (lower.includes('nature') || lower.includes('trail') || lower.includes('trek')) newInts.push('nature');
    if (lower.includes('photo') || lower.includes('sunset')) newInts.push('photography');
    if (lower.includes('adventure')) newInts.push('adventure');
    if (newInts.length > 0) {
      setInterests(newInts);
    }

    const summaryParts = [
      detectedDest || 'Selected destination',
      `${detectedDays} days`,
      `${detectedTravelers} traveler${detectedTravelers > 1 ? 's' : ''}`,
      detectedBudget > 0 ? `₹${detectedBudget.toLocaleString('en-IN')}` : 'Flexible budget',
      `${detectedPace.charAt(0).toUpperCase() + detectedPace.slice(1)} pace`,
    ];
    if (stopoverMatch) {
      summaryParts.push(`Stopover: ${stopoverMatch[1].trim()}`);
    }
    if (newInts.length > 0) {
      summaryParts.push(newInts.join(' + '));
    }
    setParsedSummary(summaryParts.join(' · '));
  }, [promptText]);

  const toggleInterest = (id: string) => {
    if (interests.includes(id)) {
      setInterests(interests.filter((i) => i !== id));
    } else {
      setInterests([...interests, id]);
    }
  };

  const handleApplyPresetPrompt = (prompt: string) => {
    setPromptText(prompt);
  };

  const handleAddStopover = () => {
    if (!newStopLocation.trim()) return;
    const newStop: StopoverValue = {
      location: newStopLocation.trim(),
      nights: newStopNights || 2,
      sequence: stopovers.length + 1,
    };
    setStopovers([...stopovers, newStop]);
    setNewStopLocation('');
    setNewStopNights(2);
  };

  const handleRemoveStopover = (idx: number) => {
    setStopovers(stopovers.filter((_, i) => i !== idx));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      alert('Please specify a destination to begin itinerary planning.');
      return;
    }

    onSubmitProposal({
      destination: destination.trim(),
      origin: originAirport?.city || origin.trim(),
      originAirport,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      daysCount,
      travelers,
      budget,
      currency: 'INR',
      pace,
      tripType,
      travelMode,
      dailySchedule,
      itineraryStyle,
      stopovers,
      interests,
      wakeUpPreference: dailySchedule === 'early_riser' ? 'early_bird' : dailySchedule === 'night_owl' ? 'late_morning' : 'balanced',
      accommodationPreference: accommodation,
      transportPreference: 'mix',
      foodPreferences: foodPref,
      rawPrompt: promptText.trim() || `Plan ${daysCount} days in ${destination}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Natural Language Prompt Card */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-orange-100 text-orange-600">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Natural Language Intent
            </span>
          </div>
          <span className="text-[11px] text-stone-400 font-medium">
            AI Proposes · Traveler Decides
          </span>
        </div>

        <div className="relative">
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="e.g. 5 day Goa trip from Delhi for two people under 50k, relaxed, beaches and good food (or plan me a relaxed 7-day trip)..."
            rows={3}
            className="w-full p-4 rounded-2xl bg-stone-50/70 border border-stone-200 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none transition-all leading-relaxed"
            disabled={isGenerating}
            data-testid="planner-natural-prompt-input"
          />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-stone-400 text-[11px] font-medium shrink-0">Try:</span>
          {POPULAR_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPresetPrompt(p)}
              className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-orange-50 hover:text-orange-700 text-stone-600 border border-stone-200/80 transition-colors shrink-0 text-[11px] cursor-pointer"
            >
              {p.split(',')[0]}
            </button>
          ))}
        </div>

        {/* Understood Intent Summary Card */}
        {parsedSummary && (
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in" data-testid="understood-intent-card">
            <div className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-orange-600 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block">
                  I understood:
                </span>
                <span className="text-stone-900 font-semibold">{parsedSummary}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-orange-600 hover:text-orange-700 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer shrink-0"
              data-testid="toggle-preferences-btn"
            >
              <span>{showAdvanced ? 'Hide advanced controls' : 'Show advanced controls'}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Structured Modern Progressive Form */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* WHERE & WHEN SECTION */}
        <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-stone-900">Destination &amp; Corridor</h3>
            </div>
            <span className="text-[11px] text-stone-400 font-medium">Corridor &amp; Schedule</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 block">
                Destination <span className="text-orange-600">*</span>
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Goa, Kyoto, Manali, Jaipur..."
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-medium"
                data-testid="planner-destination-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 block">
                Origin / Starting City (Optional)
              </label>
              <AirportAutocomplete
                value={originAirport || origin}
                onSelect={(airport) => {
                  setOriginAirport(airport);
                  if (airport) {
                    setOrigin(airport.city || airport.name);
                  } else {
                    setOrigin('');
                  }
                }}
                placeholder="Search departure hub (e.g. Delhi, Mumbai)"
              />
            </div>
          </div>

          {/* Duration, Travelers, Budget Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Days Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 block flex items-center justify-between">
                <span>Duration</span>
                <span className="text-orange-600 font-mono font-bold">{daysCount} Days</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[3, 4, 5, 7, 10, 14].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysCount(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      daysCount === d
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {/* Travelers */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 block flex items-center justify-between">
                <span>Travelers</span>
                <span className="text-orange-600 font-mono font-bold">{travelers} Guests</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 4, 6].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setTravelers(count)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      travelers === count
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {count === 1 ? 'Solo' : count === 2 ? 'Couple' : `${count}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 block flex items-center justify-between">
                <span>Target Budget</span>
                <span className="text-orange-600 font-mono font-bold">₹{budget.toLocaleString('en-IN')}</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[30000, 60000, 90000, 150000].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(b)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      budget === b
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {b >= 100000 ? `${b / 100000}L` : `${b / 1000}k`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* STYLE, PACE & DAILY RHYTHM SECTION */}
        <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-stone-900">Style, Pace &amp; Daily Rhythm</h3>
            </div>
            <span className="text-[11px] text-stone-400 font-medium">Density &amp; Timing</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Travel Pace */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 block">Travel Pace</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'relaxed', label: 'Relaxed', desc: '2–4 stops/day' },
                  { id: 'balanced', label: 'Balanced', desc: '3–5 stops/day' },
                  { id: 'fast', label: 'Fast', desc: '4–6 stops/day' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPace(p.id as any)}
                    className={`p-3 rounded-2xl border text-center cursor-pointer transition-all ${
                      pace === p.id
                        ? 'bg-orange-50 border-orange-300 text-stone-900 shadow-2xs'
                        : 'bg-stone-50/50 border-stone-200 text-stone-600 hover:bg-stone-100/60'
                    }`}
                    data-testid={`pace-option-${p.id}`}
                  >
                    <span className="font-bold text-xs block text-stone-900">{p.label}</span>
                    <span className="text-[10px] text-stone-500 block">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Schedule Rhythm */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 block flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-600" />
                <span>Daily Rhythm</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'early_riser', label: 'Early Riser', time: '08:30 start' },
                  { id: 'balanced', label: 'Balanced', time: '09:30 start' },
                  { id: 'night_owl', label: 'Night Owl', time: '10:30 start' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDailySchedule(s.id as any)}
                    className={`p-3 rounded-2xl border text-center cursor-pointer transition-all ${
                      dailySchedule === s.id
                        ? 'bg-orange-50 border-orange-300 text-stone-900 shadow-2xs'
                        : 'bg-stone-50/50 border-stone-200 text-stone-600 hover:bg-stone-100/60'
                    }`}
                    data-testid={`schedule-option-${s.id}`}
                  >
                    <span className="font-bold text-xs block text-stone-900">{s.label}</span>
                    <span className="text-[10px] text-stone-500 block">{s.time}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interests Pills */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-stone-700 block">Interests &amp; Focus</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => {
                const isSelected = interests.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleInterest(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-stone-900 text-white border-stone-900 shadow-2xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                    data-testid={`interest-chip-${opt.id}`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ADVANCED OPTIONS (Stopovers, Itinerary Style, Travel Mode) */}
        <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-stone-900">
                Advanced Controls &amp; Stopovers
              </h3>
              {stopovers.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-700 font-bold">
                  {stopovers.length} stopover{stopovers.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button type="button" className="text-stone-400 hover:text-stone-700 cursor-pointer">
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showAdvanced && (
            <div className="pt-3 border-t border-stone-100 space-y-5 animate-in fade-in">
              {/* Stopovers Sub-Section */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-stone-700 block">
                  Intermediate Stopovers / Multi-Destination Routing
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={newStopLocation}
                    onChange={(e) => setNewStopLocation(e.target.value)}
                    placeholder="Stopover place (e.g. South Goa, Jaipur, Udaipur)"
                    className="flex-1 w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-orange-500 font-medium"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={newStopNights}
                      onChange={(e) => setNewStopNights(parseInt(e.target.value, 10))}
                      className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none"
                    >
                      <option value={1}>1 Night</option>
                      <option value={2}>2 Nights</option>
                      <option value={3}>3 Nights</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddStopover}
                      className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Stopover</span>
                    </button>
                  </div>
                </div>

                {stopovers.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {stopovers.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs font-medium"
                      >
                        <Compass className="w-3.5 h-3.5 text-orange-600" />
                        <span>{s.location} ({s.nights || 1} nights)</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStopover(idx)}
                          className="text-orange-500 hover:text-orange-800 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Itinerary Style & Travel Mode Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-stone-600 block">Itinerary Detail Style</label>
                  <select
                    value={itineraryStyle}
                    onChange={(e) => setItineraryStyle(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none focus:border-orange-500"
                  >
                    <option value="daily">Daily Schedule (Primary Highlights)</option>
                    <option value="detailed">Detailed (Includes Explicit Transfers)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-stone-600 block">Travel Mode</label>
                  <select
                    value={travelMode}
                    onChange={(e) => setTravelMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none focus:border-orange-500"
                  >
                    <option value="flight">Flight (Air Corridor)</option>
                    <option value="train">Train / Rail</option>
                    <option value="car">Car / Road Trip</option>
                    <option value="bus">Bus</option>
                    <option value="mixed">Mixed Multimodal</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-stone-600 block">Trip Persona / Type</label>
                  <select
                    value={tripType}
                    onChange={(e) => setTripType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none focus:border-orange-500"
                  >
                    <option value="leisure">Leisure &amp; Scenic</option>
                    <option value="romantic">Romantic Couple</option>
                    <option value="adventure">Adventure &amp; Trekking</option>
                    <option value="luxury">Luxury &amp; Boutique</option>
                    <option value="family">Family Friendly</option>
                    <option value="backpacking">Backpacking &amp; Social</option>
                    <option value="business">Workation / Business</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit CTA */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-stone-500 font-medium">
            Generating creates a verified <strong className="text-stone-700">Trip Proposal</strong> without modifying your active trips.
          </p>

          <Button
            type="submit"
            disabled={isGenerating || !destination.trim()}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm px-8 py-3.5 rounded-2xl shadow-lg shadow-orange-950/20 cursor-pointer flex items-center justify-center gap-2"
            data-testid="create-itinerary-proposal-btn"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{generationStepText || 'Building your route...'}</span>
              </span>
            ) : (
              <>
                <span>Create Trip Proposal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
