'use client';

import { useState } from 'react';
import { Sparkles, MapPin, Calendar, Compass, Car, DollarSign, Users, Hotel, ShieldAlert, ArrowRight, ArrowLeft, Check } from 'lucide-react';
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
}

export function TravelInputDialogModal({ isOpen, onClose, onSubmit }: TravelInputDialogModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TravelInputResult>({
    destination: 'Goa, India',
    dates: '2026-08-10 to 2026-08-14',
    purpose: 'Leisure & Beach Getaway',
    departure: 'Bengaluru',
    transportationMode: 'Flight',
    budget: '₹25,000',
    groupSize: '2 Travelers',
    accommodation: '4-Star Beach Resort',
    specialRequirements: 'Step-free pool access & vegetarian food options',
  });

  if (!isOpen) return null;

  const totalSteps = 9;

  const updateField = (field: keyof TravelInputResult, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onSubmit(formData);
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <Card className="w-full max-w-xl bg-slate-950 border-orange-500/40 shadow-2xl p-6 space-y-6 relative max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Sparkles className="w-5 h-5 animate-pulse text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">DAIna 9-Step Guided Travel Prompt</h3>
              <p className="text-xs text-gray-400">Step {currentStep} of {totalSteps}: Fine-tune your AI itinerary parameters</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg font-bold">
            ✕
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-cyan-400 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step Contents */}
        <div className="space-y-4 py-2">
          {/* STEP 1: Destination */}
          {currentStep === 1 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> 1. Where do you want to travel?
              </label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => updateField('destination', e.target.value)}
                placeholder="e.g. Goa, Manali, Jaipur, Kyoto..."
                className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white"
              />
            </div>
          )}

          {/* STEP 2: Dates */}
          {currentStep === 2 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> 2. Travel Dates & Duration
              </label>
              <input
                type="text"
                value={formData.dates}
                onChange={(e) => updateField('dates', e.target.value)}
                placeholder="e.g. 5 days in August 2026..."
                className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white"
              />
            </div>
          )}

          {/* STEP 3: Purpose */}
          {currentStep === 3 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4" /> 3. Trip Purpose & Style
              </label>
              <select
                value={formData.purpose}
                onChange={(e) => updateField('purpose', e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
              >
                <option value="Leisure & Beach Getaway">Leisure & Beach Getaway</option>
                <option value="Alpine Trekking & Adventure">Alpine Trekking & Adventure</option>
                <option value="Cultural Heritage & Museums">Cultural Heritage & Museums</option>
                <option value="Workcation & Remote Study">Workcation & Remote Study</option>
              </select>
            </div>
          )}

          {/* STEP 4: Departure */}
          {currentStep === 4 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> 4. Departure City
              </label>
              <input
                type="text"
                value={formData.departure}
                onChange={(e) => updateField('departure', e.target.value)}
                placeholder="e.g. Bengaluru, Delhi, Mumbai..."
                className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white"
              />
            </div>
          )}

          {/* STEP 5: Transportation */}
          {currentStep === 5 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Car className="w-4 h-4" /> 5. Preferred Transportation Mode
              </label>
              <select
                value={formData.transportationMode}
                onChange={(e) => updateField('transportationMode', e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
              >
                <option value="Flight">Flight (Fastest)</option>
                <option value="Train">Express Train (Scenic)</option>
                <option value="Cab Rental">Private Cab / Car Drive</option>
                <option value="Bus">Volvo Sleeper Bus</option>
              </select>
            </div>
          )}

          {/* STEP 6: Budget */}
          {currentStep === 6 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> 6. Total Budget (in INR)
              </label>
              <input
                type="text"
                value={formData.budget}
                onChange={(e) => updateField('budget', e.target.value)}
                placeholder="e.g. ₹25,000"
                className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white"
              />
            </div>
          )}

          {/* STEP 7: Group Size */}
          {currentStep === 7 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4" /> 7. Group Size & Travelers
              </label>
              <input
                type="text"
                value={formData.groupSize}
                onChange={(e) => updateField('groupSize', e.target.value)}
                placeholder="e.g. Solo, Couple (2), Family of 4..."
                className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white"
              />
            </div>
          )}

          {/* STEP 8: Accommodation */}
          {currentStep === 8 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Hotel className="w-4 h-4" /> 8. Accommodation Type
              </label>
              <input
                type="text"
                value={formData.accommodation}
                onChange={(e) => updateField('accommodation', e.target.value)}
                placeholder="e.g. 4-Star Beach Resort, Hostel, Villa..."
                className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white"
              />
            </div>
          )}

          {/* STEP 9: Special Requirements */}
          {currentStep === 9 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> 9. Special Requirements & Accessibility
              </label>
              <textarea
                rows={3}
                value={formData.specialRequirements}
                onChange={(e) => updateField('specialRequirements', e.target.value)}
                placeholder="e.g. Step-free access ♿, vegetarian food, pet friendly..."
                className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white resize-none"
              />
            </div>
          )}
        </div>

        {/* Modal Controls */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Back</span>
          </Button>

          <Button variant="primary" size="sm" onClick={handleNext}>
            {currentStep === totalSteps ? (
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Submit to DAIna AI
              </span>
            ) : (
              <span className="flex items-center gap-1">
                Next Step <ArrowRight className="w-3.5 h-3.5" />
              </span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
