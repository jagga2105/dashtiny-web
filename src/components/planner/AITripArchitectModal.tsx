'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  UserRound,
  Users,
  Baby,
  UtensilsCrossed,
  Footprints,
  Sun,
  Camera,
  Accessibility,
  Heart,
  CloudRain,
  Car,
  Bike,
  PersonStanding,
  Moon,
  Sunrise,
  Lock,
  BarChart3,
  Sparkles,
  Smile,
  Laptop,
  PartyPopper,
  Umbrella,
  ShieldOff,
  Salad,
  Wheat,
  HandHeart,
  TreePine,
  Landmark,
  Plane,
  BrainCircuit,
} from 'lucide-react';

interface ArchitectAnswers {
  travelers: string;
  hasKids: string;
  food: string;
  walking: string;
  wakeup: string;
  budget: string;
  photography: string;
  accessibility: string;
  occasion: string;
  rain: string;
}

interface Option {
  value: string;
  label: string;
  icon: React.ReactNode;
}

interface Step {
  id: keyof ArchitectAnswers;
  icon: React.ReactNode;
  question: string;
  subtitle: string;
  options: Option[];
}

const STEPS: Step[] = [
  {
    id: 'travelers',
    icon: <UserRound className="w-5 h-5" />,
    question: "Who's going on this trip?",
    subtitle: "DAIna tailors the plan based on your group",
    options: [
      { value: 'solo',    label: 'Just me',      icon: <UserRound className="w-4 h-4" /> },
      { value: 'couple',  label: 'Couple',        icon: <Heart className="w-4 h-4" /> },
      { value: 'family',  label: 'Family',        icon: <Users className="w-4 h-4" /> },
      { value: 'friends', label: 'Friend group',  icon: <PartyPopper className="w-4 h-4" /> },
    ],
  },
  {
    id: 'hasKids',
    icon: <Baby className="w-5 h-5" />,
    question: "Any kids or elderly travelers?",
    subtitle: "Avoids strenuous activities and picks accessible venues",
    options: [
      { value: 'no',         label: 'No',              icon: <Check className="w-4 h-4" /> },
      { value: 'young_kids', label: 'Young kids (0–10)', icon: <Baby className="w-4 h-4" /> },
      { value: 'teens',      label: 'Teens',            icon: <PersonStanding className="w-4 h-4" /> },
      { value: 'elderly',    label: 'Elderly (60+)',     icon: <Accessibility className="w-4 h-4" /> },
    ],
  },
  {
    id: 'food',
    icon: <UtensilsCrossed className="w-5 h-5" />,
    question: "Any food preferences?",
    subtitle: "Restaurants and street food will match your diet",
    options: [
      { value: 'any',   label: 'Eat anything',  icon: <UtensilsCrossed className="w-4 h-4" /> },
      { value: 'veg',   label: 'Vegetarian',    icon: <Salad className="w-4 h-4" /> },
      { value: 'vegan', label: 'Vegan',         icon: <TreePine className="w-4 h-4" /> },
      { value: 'halal', label: 'Halal',         icon: <HandHeart className="w-4 h-4" /> },
      { value: 'jain',  label: 'Jain',          icon: <Wheat className="w-4 h-4" /> },
    ],
  },
  {
    id: 'walking',
    icon: <Footprints className="w-5 h-5" />,
    question: "How much walking is comfortable?",
    subtitle: "Sets activity types and transport between spots",
    options: [
      { value: 'low',    label: 'Minimal — cabs mostly',  icon: <Car className="w-4 h-4" /> },
      { value: 'medium', label: 'Some walking (2–4 km)',  icon: <PersonStanding className="w-4 h-4" /> },
      { value: 'high',   label: 'Love to walk (5+ km)',  icon: <Footprints className="w-4 h-4" /> },
    ],
  },
  {
    id: 'wakeup',
    icon: <Sun className="w-5 h-5" />,
    question: "What's your wake-up style?",
    subtitle: "Sunrise activities or late starts — both are valid",
    options: [
      { value: 'early',    label: 'Early bird (6–7 AM)',  icon: <Sunrise className="w-4 h-4" /> },
      { value: 'standard', label: 'Standard (8–9 AM)',    icon: <Sun className="w-4 h-4" /> },
      { value: 'late',     label: 'Night owl (10 AM+)',   icon: <Moon className="w-4 h-4" /> },
    ],
  },
  {
    id: 'budget',
    icon: <BarChart3 className="w-5 h-5" />,
    question: "Budget flexibility?",
    subtitle: "Helps DAIna recommend the right price tier",
    options: [
      { value: 'strict',    label: 'Fixed — no overages',            icon: <Lock className="w-4 h-4" /> },
      { value: 'some_flex', label: 'Some flexibility (+20%)',         icon: <BarChart3 className="w-4 h-4" /> },
      { value: 'splurge',   label: "Worth splurging for magic moments", icon: <Sparkles className="w-4 h-4" /> },
    ],
  },
  {
    id: 'photography',
    icon: <Camera className="w-5 h-5" />,
    question: "Are you into photography?",
    subtitle: "Golden hour spots and viewpoints get prioritized",
    options: [
      { value: 'yes',    label: 'Yes — I live for the shot',  icon: <Camera className="w-4 h-4" /> },
      { value: 'casual', label: 'Casual snapper',             icon: <Smile className="w-4 h-4" /> },
      { value: 'no',     label: 'No — just experiencing',     icon: <Heart className="w-4 h-4" /> },
    ],
  },
  {
    id: 'accessibility',
    icon: <Accessibility className="w-5 h-5" />,
    question: "Any accessibility needs?",
    subtitle: "All venues and transport will be checked",
    options: [
      { value: 'none',       label: 'No special needs',         icon: <Check className="w-4 h-4" /> },
      { value: 'wheelchair', label: 'Wheelchair accessible',    icon: <Accessibility className="w-4 h-4" /> },
      { value: 'low_stairs', label: 'Avoid steep stairs',       icon: <ShieldOff className="w-4 h-4" /> },
    ],
  },
  {
    id: 'occasion',
    icon: <Heart className="w-5 h-5" />,
    question: "What's the occasion?",
    subtitle: "Special touches added for milestone trips",
    options: [
      { value: 'leisure',    label: 'Just for fun',        icon: <Smile className="w-4 h-4" /> },
      { value: 'honeymoon',  label: 'Honeymoon',           icon: <Heart className="w-4 h-4" /> },
      { value: 'anniversary',label: 'Anniversary',         icon: <Sparkles className="w-4 h-4" /> },
      { value: 'workation',  label: 'Workation',           icon: <Laptop className="w-4 h-4" /> },
      { value: 'festival',   label: 'Festival or event',   icon: <PartyPopper className="w-4 h-4" /> },
    ],
  },
  {
    id: 'rain',
    icon: <CloudRain className="w-5 h-5" />,
    question: "Rain tolerance?",
    subtitle: "Affects destination shortlisting and backup plans",
    options: [
      { value: 'dry',   label: 'Prefer dry weather only',  icon: <Sun className="w-4 h-4" /> },
      { value: 'light', label: 'Light rain is fine',       icon: <CloudRain className="w-4 h-4" /> },
      { value: 'any',   label: "Any weather — I adapt",    icon: <Umbrella className="w-4 h-4" /> },
    ],
  },
];

interface AITripArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination?: string;
  onComplete: (answers: ArchitectAnswers) => void;
}

export function AITripArchitectModal({ isOpen, onClose, destination, onComplete }: AITripArchitectModalProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<ArchitectAnswers>>({});

  if (!isOpen) return null;

  const currentStep = STEPS[step];
  const progress = (step / STEPS.length) * 100;
  const selected = answers[currentStep.id];

  const handleSelect = (value: string) => {
    const newAnswers = { ...answers, [currentStep.id]: value };
    setAnswers(newAnswers);

    setTimeout(() => {
      if (step < STEPS.length - 1) {
        setStep(step + 1);
      } else {
        onComplete(newAnswers as ArchitectAnswers);
        onClose();
      }
    }, 280);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#08090E]/90 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#0E1017] rounded-2xl border border-amber-500/20 shadow-2xl shadow-black/80 overflow-hidden animate-slide-up">
        {/* Progress bar */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-[#0F1118]">
          <div
            className="h-full bg-amber-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/12 border border-amber-400/20 flex items-center justify-center text-amber-300">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-amber-300">
                DAIna Getaway Architect · {step + 1}/{STEPS.length}
              </div>
              {destination && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Planning: <span className="text-amber-300 font-semibold">{destination}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#08090E] border border-white/8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Question */}
        <div className="px-6 py-5 space-y-1">
          <div className="flex items-center gap-2 text-amber-300">
            {currentStep.icon}
            <h2 className="text-lg font-bold text-white leading-tight">{currentStep.question}</h2>
          </div>
          <p className="text-xs text-gray-500 font-light pl-7">{currentStep.subtitle}</p>
        </div>

        {/* Options */}
        <div className="px-6 pb-5 grid grid-cols-2 gap-2">
          {currentStep.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`p-3 rounded-xl border text-left transition-all duration-200 flex items-center gap-2.5 ${
                selected === opt.value
                  ? 'bg-amber-500/12 border-amber-400/40'
                  : 'bg-[#08090E] border-white/8 hover:border-amber-400/25 hover:bg-amber-500/5'
              }`}
            >
              <span className={`flex-shrink-0 ${selected === opt.value ? 'text-amber-300' : 'text-gray-500'}`}>
                {opt.icon}
              </span>
              <span className={`text-xs font-semibold leading-tight flex-1 ${selected === opt.value ? 'text-amber-200' : 'text-gray-300'}`}>
                {opt.label}
              </span>
              {selected === opt.value && (
                <Check className="w-3.5 h-3.5 text-amber-400 ml-auto flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Nav */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <button
            onClick={() => step > 0 && setStep(step - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === step ? 'bg-amber-400 w-4' : i < step ? 'bg-amber-600/60 w-1.5' : 'bg-white/12 w-1.5'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => handleSelect(STEPS[step].options[0].value)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-300 transition-colors"
          >
            Skip
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
