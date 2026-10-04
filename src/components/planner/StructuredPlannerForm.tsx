'use client';

import React, { useState, useEffect } from 'react';
import { AirportLocation } from '@/services/api';
import { NaturalLanguagePlanner } from './NaturalLanguagePlanner';
import { IntentSummary } from './IntentSummary';
import { PlannerPreferences } from './PlannerPreferences';
import { PlannerGenerateAction } from './PlannerGenerateAction';

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

export function StructuredPlannerForm({
  initialValues,
  onSubmitProposal,
  isGenerating,
  generationStepText,
}: StructuredPlannerFormProps) {
  // Natural language prompt state
  const [promptText, setPromptText] = useState(initialValues?.rawPrompt || '');
  const [showPreferences, setShowPreferences] = useState(true);

  // Form states
  const [destination, setDestination] = useState(initialValues?.destination || '');
  const [origin, setOrigin] = useState(initialValues?.origin || '');
  const [originAirport, setOriginAirport] = useState<AirportLocation | null>(initialValues?.originAirport || null);
  const [startDate, setStartDate] = useState(initialValues?.startDate || '');
  const [endDate, setEndDate] = useState(initialValues?.endDate || '');
  const [daysCount, setDaysCount] = useState(initialValues?.daysCount || 4);
  const [travelers, setTravelers] = useState(initialValues?.travelers || 2);
  const [budget, setBudget] = useState(initialValues?.budget || 50000);
  const [pace, setPace] = useState<'relaxed' | 'balanced' | 'fast' | 'packed'>(initialValues?.pace || 'balanced');
  const [tripType, setTripType] = useState<StructuredPlannerFormValues['tripType']>(initialValues?.tripType || 'leisure');
  const [travelMode, setTravelMode] = useState<StructuredPlannerFormValues['travelMode']>(initialValues?.travelMode || 'flight');
  const [dailySchedule, setDailySchedule] = useState<'early_riser' | 'balanced' | 'night_owl'>(initialValues?.dailySchedule || 'balanced');
  const [itineraryStyle, setItineraryStyle] = useState<'daily' | 'detailed'>(initialValues?.itineraryStyle || 'daily');
  const [stopovers, setStopovers] = useState<StopoverValue[]>(initialValues?.stopovers || []);
  const [interests, setInterests] = useState<string[]>(initialValues?.interests || ['food', 'beaches']);
  const [accommodation, setAccommodation] = useState<'budget' | 'comfort' | 'boutique' | 'luxury'>(initialValues?.accommodationPreference || 'comfort');
  const [foodPref, setFoodPref] = useState<string[]>(initialValues?.foodPreferences || ['any']);

  // Extract intent from natural language input
  useEffect(() => {
    if (!promptText.trim()) return;
    const lower = promptText.toLowerCase();

    // Destination extraction
    for (const d of ['Goa', 'Kyoto', 'Manali', 'Jaipur', 'Udaipur', 'Kashmir', 'Kerala', 'Paris', 'Tokyo', 'Delhi', 'Mumbai', 'Rome', 'Bali', 'Singapore', 'Dubai']) {
      if (lower.includes(d.toLowerCase())) {
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
    const dMatch = lower.match(/(\d+)\s*(?:day|days|-day)/);
    if (dMatch) {
      setDaysCount(parseInt(dMatch[1], 10));
    }

    // Travelers & Persona
    if (lower.includes('two people') || lower.includes('couple') || lower.includes('partner') || lower.includes('for 2') || lower.includes('2 people')) {
      setTravelers(2);
      setTripType('romantic');
    } else if (lower.includes('solo') || lower.includes('alone') || lower.includes('myself') || lower.includes('for 1')) {
      setTravelers(1);
    } else if (lower.includes('family') || lower.includes('kids') || lower.includes('four people') || lower.includes('for 4')) {
      setTravelers(4);
      setTripType('family');
    }

    // Budget
    const kMatch = lower.match(/(\d+)\s*k\b/);
    const lakhMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l\b)/);
    const numMatch = lower.match(/(?:₹|rs\.?|inr|budget\s*of|under)\s*([0-9]{4,7})/);
    if (kMatch) {
      setBudget(parseInt(kMatch[1], 10) * 1000);
    } else if (lakhMatch) {
      setBudget(parseFloat(lakhMatch[1]) * 100000);
    } else if (numMatch) {
      setBudget(parseInt(numMatch[1], 10));
    }

    // Pace
    if (lower.includes('relaxed') || lower.includes('slow') || lower.includes('chill') || lower.includes('easy')) {
      setPace('relaxed');
    } else if (lower.includes('packed') || lower.includes('fast') || lower.includes('active')) {
      setPace('packed');
    }

    // Interests
    const newInts: string[] = [];
    if (lower.includes('beach') || lower.includes('coast')) newInts.push('beaches');
    if (lower.includes('food') || lower.includes('seafood') || lower.includes('culinary')) newInts.push('food');
    if (lower.includes('culture') || lower.includes('temple') || lower.includes('heritage') || lower.includes('palace')) newInts.push('culture');
    if (lower.includes('nature') || lower.includes('trail') || lower.includes('mountain')) newInts.push('nature');
    if (lower.includes('photo') || lower.includes('sunset')) newInts.push('photography');
    if (lower.includes('nightlife') || lower.includes('party')) newInts.push('nightlife');
    if (newInts.length > 0) {
      setInterests(newInts);
    }
  }, [promptText]);

  const toggleInterest = (id: string) => {
    if (interests.includes(id)) {
      setInterests(interests.filter((i) => i !== id));
    } else {
      setInterests([...interests, id]);
    }
  };

  const toggleFoodPref = (id: string) => {
    if (foodPref.includes(id)) {
      setFoodPref(foodPref.filter((f) => f !== id));
    } else {
      setFoodPref([...foodPref, id]);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      transportPreference: 'walking',
      foodPreferences: foodPref,
      rawPrompt: promptText.trim() || `Plan ${daysCount} days in ${destination}`,
    });
  };

  return (
    <div className="space-y-6" data-testid="structured-planner-form">
      {/* 1. Natural Language Input */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-4">
        <NaturalLanguagePlanner
          promptText={promptText}
          onChangePrompt={setPromptText}
          onSelectExample={(ex) => setPromptText(ex)}
          isGenerating={isGenerating}
        />

        {/* 2. Structured Intent Understanding Card */}
        {destination && (
          <IntentSummary
            destination={destination}
            origin={origin}
            daysCount={daysCount}
            travelers={travelers}
            budget={budget}
            currency="INR"
            pace={pace}
            interests={interests}
            onToggleCustomize={() => setShowPreferences(!showPreferences)}
            isCustomizing={showPreferences}
          />
        )}
      </div>

      {/* 3. Progressive Preferences & Action */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {showPreferences && (
          <div className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-2xs">
            <PlannerPreferences
              destination={destination}
              onChangeDestination={setDestination}
              origin={origin}
              onChangeOrigin={setOrigin}
              originAirport={originAirport}
              onSelectOriginAirport={setOriginAirport}
              startDate={startDate}
              onChangeStartDate={setStartDate}
              endDate={endDate}
              onChangeEndDate={setEndDate}
              daysCount={daysCount}
              onChangeDaysCount={setDaysCount}
              travelers={travelers}
              onChangeTravelers={setTravelers}
              budget={budget}
              onChangeBudget={setBudget}
              currency="INR"
              onChangeCurrency={() => {}}
              pace={pace}
              onChangePace={setPace}
              interests={interests}
              onToggleInterest={toggleInterest}
              dailySchedule={dailySchedule}
              onChangeDailySchedule={setDailySchedule}
              accommodation={accommodation}
              onChangeAccommodation={setAccommodation}
              foodPreferences={foodPref}
              onToggleFoodPref={toggleFoodPref}
            />
          </div>
        )}

        {/* 4. Primary Generate Action */}
        <PlannerGenerateAction
          onClick={handleSubmit}
          isGenerating={isGenerating}
          generationStepText={generationStepText}
          destination={destination}
        />
      </form>
    </div>
  );
}
