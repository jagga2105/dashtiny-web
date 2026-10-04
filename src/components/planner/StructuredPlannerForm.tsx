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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AirportAutocomplete } from '@/components/location/AirportAutocomplete';
import { AirportLocation } from '@/services/api';

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
  pace: 'relaxed' | 'balanced' | 'packed';
  interests: string[];
  wakeUpPreference: 'early_bird' | 'balanced' | 'late_morning';
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
  '5 day Goa trip from Delhi for two people under 50k, relaxed, beaches and good food',
  '7 day Kyoto cultural passage for couple under 1.5 lakh, temples, matcha and gardens',
  '3 day Manali alpine mountain getaway from Delhi, pine trails, cafes and quiet scenery',
  '4 day Jaipur royal heritage escape under 35k with palaces, street food and artisan souks',
];

const INTEREST_OPTIONS = [
  { id: 'beaches', label: 'Beaches & Coast' },
  { id: 'food', label: 'Culinary & Dining' },
  { id: 'culture', label: 'Heritage & History' },
  { id: 'nature', label: 'Nature & Mountains' },
  { id: 'nightlife', label: 'Nightlife & Lounges' },
  { id: 'wellness', label: 'Wellness & Yoga' },
  { id: 'adventure', label: 'Trekking & Outdoor' },
  { id: 'photography', label: 'Photography & Sunset' },
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
  const [daysCount, setDaysCount] = useState(initialValues?.daysCount || 4);
  const [travelers, setTravelers] = useState(initialValues?.travelers || 2);
  const [budget, setBudget] = useState(initialValues?.budget || 50000);
  const [pace, setPace] = useState<'relaxed' | 'balanced' | 'packed'>(initialValues?.pace || 'balanced');
  const [interests, setInterests] = useState<string[]>(initialValues?.interests || ['food', 'culture']);
  const [wakeUp, setWakeUp] = useState<'early_bird' | 'balanced' | 'late_morning'>(initialValues?.wakeUpPreference || 'balanced');
  const [accommodation, setAccommodation] = useState<'budget' | 'comfort' | 'boutique' | 'luxury'>(initialValues?.accommodationPreference || 'comfort');
  const [foodPref, setFoodPref] = useState<string[]>(initialValues?.foodPreferences || ['any']);

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
    for (const d of ['Goa', 'Kyoto', 'Manali', 'Jaipur', 'Kashmir', 'Kerala', 'Paris', 'Tokyo', 'Delhi', 'Mumbai']) {
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

    // Travelers
    let detectedTravelers = 2;
    if (lower.includes('two people') || lower.includes('couple') || lower.includes('for 2')) {
      detectedTravelers = 2;
      setTravelers(2);
    } else if (lower.includes('solo') || lower.includes('alone')) {
      detectedTravelers = 1;
      setTravelers(1);
    } else if (lower.includes('family') || lower.includes('four people') || lower.includes('for 4')) {
      detectedTravelers = 4;
      setTravelers(4);
    }

    // Budget
    let detectedBudget = 50000;
    const kMatch = lower.match(/(\d+)\s*k\b/);
    const lakhMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l\b)/);
    if (kMatch) {
      detectedBudget = parseInt(kMatch[1], 10) * 1000;
      setBudget(detectedBudget);
    } else if (lakhMatch) {
      detectedBudget = parseFloat(lakhMatch[1]) * 100000;
      setBudget(detectedBudget);
    }

    // Pace
    let detectedPace = 'balanced';
    if (lower.includes('relaxed') || lower.includes('slow') || lower.includes('chill')) {
      detectedPace = 'relaxed';
      setPace('relaxed');
    } else if (lower.includes('packed') || lower.includes('maximum')) {
      detectedPace = 'packed';
      setPace('packed');
    }

    // Interests
    const newInts: string[] = [];
    if (lower.includes('beach')) newInts.push('beaches');
    if (lower.includes('food') || lower.includes('dining')) newInts.push('food');
    if (lower.includes('culture') || lower.includes('temple') || lower.includes('heritage')) newInts.push('culture');
    if (lower.includes('mountain') || lower.includes('pine') || lower.includes('trek')) newInts.push('nature');
    if (lower.includes('nightlife') || lower.includes('party')) newInts.push('nightlife');
    if (lower.includes('photo') || lower.includes('sunset')) newInts.push('photography');
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
      daysCount,
      travelers,
      budget,
      currency: 'INR',
      pace,
      interests,
      wakeUpPreference: wakeUp,
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
            placeholder="e.g. 5 day Goa trip from Delhi for two people under 50k, relaxed, beaches and good food..."
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
              <span>{showAdvanced ? 'Hide preferences' : 'Edit preferences'}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Structured Progressive Preferences Form */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Destination & Route Section */}
        <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-stone-900">Destination &amp; Corridor</h3>
            </div>
            <span className="text-[11px] text-stone-400 font-medium">Where to &amp; where from</span>
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
                placeholder="Search departure city (e.g. Delhi, Mumbai)"
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
                {[25000, 50000, 75000, 120000].map((b) => (
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

        {/* Travel Pace & Interests Section */}
        <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-stone-900">Pace &amp; Activities</h3>
            </div>
            <span className="text-[11px] text-stone-400 font-medium">Density &amp; interests</span>
          </div>

          {/* Travel Pace Cards */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-700 block">Travel Pace</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'relaxed',
                  title: 'Relaxed',
                  desc: '2–4 stops/day · Late mornings & leisurely pool/beach pauses',
                },
                {
                  id: 'balanced',
                  title: 'Balanced',
                  desc: '3–5 stops/day · Harmonic mix of highlights & free evenings',
                },
                {
                  id: 'packed',
                  title: 'Packed',
                  desc: '5–6 stops/day · High density exploration for active travelers',
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPace(p.id as any)}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                    pace === p.id
                      ? 'bg-orange-50/60 border-orange-300 text-stone-900 shadow-2xs'
                      : 'bg-stone-50/50 border-stone-200 text-stone-600 hover:bg-stone-100/60'
                  }`}
                  data-testid={`pace-option-${p.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-stone-900">{p.title}</span>
                    {pace === p.id && <Check className="w-3.5 h-3.5 text-orange-600 stroke-[3]" />}
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">{p.desc}</p>
                </button>
              ))}
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

          {/* Advanced Preferences Toggle (Wakeup, Hotel Tier, Dietary) */}
          {showAdvanced && (
            <div className="pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-stone-600 block flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-orange-600" />
                  <span>Wake-up Rhythm</span>
                </label>
                <select
                  value={wakeUp}
                  onChange={(e) => setWakeUp(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none focus:border-orange-500"
                >
                  <option value="late_morning">Late morning (10:00 AM)</option>
                  <option value="balanced">Balanced (09:00 AM)</option>
                  <option value="early_bird">Early bird (08:00 AM)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-stone-600 block flex items-center gap-1.5">
                  <Bed className="w-3.5 h-3.5 text-orange-600" />
                  <span>Accommodation Standard</span>
                </label>
                <select
                  value={accommodation}
                  onChange={(e) => setAccommodation(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none focus:border-orange-500"
                >
                  <option value="comfort">Comfort (3–4 Star)</option>
                  <option value="boutique">Boutique &amp; Heritage</option>
                  <option value="luxury">Luxury &amp; 5-Star</option>
                  <option value="budget">Budget Friendly</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-stone-600 block flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-orange-600" />
                  <span>Dietary Preference</span>
                </label>
                <select
                  value={foodPref[0] || 'any'}
                  onChange={(e) => setFoodPref([e.target.value])}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none focus:border-orange-500"
                >
                  <option value="any">Any / Local specialties</option>
                  <option value="vegetarian">Pure Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="seafood">Seafood lover</option>
                  <option value="halal">Halal</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Submit CTA */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-stone-500 font-medium">
            Generating creates a non-mutating <strong className="text-stone-700">Trip Proposal</strong> for your review.
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
                <span>{generationStepText || 'Architecting itinerary...'}</span>
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
