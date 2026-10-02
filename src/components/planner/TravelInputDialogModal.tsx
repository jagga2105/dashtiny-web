'use client';

import { useState } from 'react';
import {
  Sparkles,
  MapPin,
  Calendar,
  Compass,
  DollarSign,
  Users,
  Hotel,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface TravelInputResult {
  destination: string;
  dates: string;
  purpose: string;
  departure: string;
  transportationMode: string;
  budget: string;
  groupSize: string;
  accommodation: string;
  specialRequirements: string;
}

interface TravelInputDialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (result: TravelInputResult) => void;
  initialDestination?: string;
  initialOrigin?: string;
}

export function TravelInputDialogModal({
  isOpen,
  onClose,
  onSubmit,
  initialDestination = '',
  initialOrigin = '',
}: TravelInputDialogModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TravelInputResult>({
    destination: initialDestination,
    dates: '',
    purpose: 'Leisure & Exploration',
    departure: initialOrigin,
    transportationMode: 'Flight',
    budget: '',
    groupSize: '2 Travelers',
    accommodation: 'Boutique Hotel or Resort',
    specialRequirements: '',
  });

  if (!isOpen) return null;

  // Streamlined 6-step refinement controls per UX specifications
  const totalSteps = 6;

  const updateField = (field: keyof TravelInputResult, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onSubmit({
        ...formData,
        destination: formData.destination.trim() || 'Your Destination',
        dates: formData.dates.trim() || 'Flexible dates',
        budget: formData.budget.trim() || '₹30,000',
      });
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-lg bg-white border border-slate-200 shadow-2xl p-6 sm:p-7 space-y-6 relative max-h-[90vh] overflow-y-auto rounded-3xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
              <Sparkles className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-serif-editorial font-bold text-slate-900">
                Refine Trip Details with DAIna
              </h3>
              <p className="text-xs text-slate-500">
                Step {currentStep} of {totalSteps}: Tailor your itinerary parameters
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-600 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step Contents */}
        <div className="space-y-4 py-1">
          {/* STEP 1: Destination & Departure */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-600" /> Destination
                </label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => updateField('destination', e.target.value)}
                  placeholder="Where are you going? (e.g. Kyoto, Manali, Goa...)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-500" /> Leaving From (Optional)
                </label>
                <input
                  type="text"
                  value={formData.departure}
                  onChange={(e) => updateField('departure', e.target.value)}
                  placeholder="Where are you leaving from? (e.g. Bengaluru, Delhi...)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white font-medium"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Travel Dates & Duration */}
          {currentStep === 2 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-600" /> Travel Dates or Duration
              </label>
              <input
                type="text"
                value={formData.dates}
                onChange={(e) => updateField('dates', e.target.value)}
                placeholder="Choose your dates (e.g. 5 days in November, Nov 12 - Nov 17...)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white font-medium"
              />
              <p className="text-[11px] text-slate-500">
                You can specify specific calendar dates or general durations like &ldquo;4-day weekend trip&rdquo;.
              </p>
            </div>
          )}

          {/* STEP 3: Travelers & Group Size */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-orange-600" /> Travelers & Group Size
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Solo Traveler',
                  'Couple (2)',
                  'Small Squad (3-4)',
                  'Family with Kids',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateField('groupSize', preset)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                      formData.groupSize === preset
                        ? 'border-orange-500 bg-orange-50 text-orange-900'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={formData.groupSize}
                onChange={(e) => updateField('groupSize', e.target.value)}
                placeholder="Or specify custom group (e.g. 5 adults, 2 kids)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white font-medium"
              />
            </div>
          )}

          {/* STEP 4: Target Budget */}
          {currentStep === 4 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-orange-600" /> Total Budget Target
              </label>
              <input
                type="text"
                value={formData.budget}
                onChange={(e) => updateField('budget', e.target.value)}
                placeholder="Set a budget (e.g. ₹35,000 or ₹1.2L total)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white font-medium"
              />
              <p className="text-[11px] text-slate-500">
                DAIna will balance lodging, transit, activities, and dining to fit within this ceiling.
              </p>
            </div>
          )}

          {/* STEP 5: Travel Style & Accommodation */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-orange-600" /> Travel Style & Pacing
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => updateField('purpose', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                >
                  <option value="Leisure & Exploration">Leisure & Relaxed Exploration</option>
                  <option value="Romantic & Scenic Stays">Romantic & Scenic Stays</option>
                  <option value="Alpine Trekking & Adventure">Alpine Trekking & Adventure</option>
                  <option value="Cultural Heritage & Museums">Cultural Heritage & Historical Sights</option>
                  <option value="Food, Cafes & Nightlife">Food, Cafes & Nightlife</option>
                  <option value="Workcation & High-Speed WiFi">Workcation & High-Speed WiFi</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Hotel className="w-3.5 h-3.5 text-orange-600" /> Accommodation Preference
                </label>
                <select
                  value={formData.accommodation}
                  onChange={(e) => updateField('accommodation', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                >
                  <option value="Boutique Hotel or Resort">Boutique Hotel or Resort</option>
                  <option value="4-Star / 5-Star Luxury">4-Star / 5-Star Luxury</option>
                  <option value="Private Villa or Homestay">Private Villa or Homestay</option>
                  <option value="Cozy Hostel / Budget Stay">Cozy Hostel / Budget Stay</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 6: Special Requirements & Accessibility */}
          {currentStep === 6 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-orange-600" /> Special Requirements & Accessibility
              </label>
              <textarea
                rows={3}
                value={formData.specialRequirements}
                onChange={(e) => updateField('specialRequirements', e.target.value)}
                placeholder="e.g. Vegetarian food only, step-free access ♿, avoid long walks, pet-friendly stay..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white font-medium resize-none"
              />
              <p className="text-[11px] text-slate-500">
                Optional: DAIna flags matching verified amenities and dietary tags in your plan.
              </p>
            </div>
          )}
        </div>

        {/* Modal Controls */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="rounded-xl text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Back</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleNext}
            className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold"
          >
            {currentStep === totalSteps ? (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Apply & Plan
              </span>
            ) : (
              <span className="flex items-center gap-1">
                Next <ArrowRight className="w-3.5 h-3.5" />
              </span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
