'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  UserRound,
  Users,
  UtensilsCrossed,
  Footprints,
  Accessibility,
  Heart,
  Car,
  PersonStanding,
  Lock,
  BarChart3,
  Sparkles,
  PartyPopper,
  Salad,
  TreePine,
  HandHeart,
  BrainCircuit,
  ShieldAlert,
} from 'lucide-react';

export interface ArchitectAnswers {
  travelers?: string;
  food?: string;
  walking?: string;
  budget?: string;
  accessibility?: string;
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
    subtitle: "DAIna tailors the pace and lodging to your party size",
    options: [
      { value: 'solo', label: 'Solo traveler', icon: <UserRound className="w-4 h-4" /> },
      { value: 'couple', label: 'Couple / Duo', icon: <Heart className="w-4 h-4" /> },
      { value: 'family', label: 'Family with kids', icon: <Users className="w-4 h-4" /> },
      { value: 'friends', label: 'Squad / Friends', icon: <PartyPopper className="w-4 h-4" /> },
    ],
  },
  {
    id: 'budget',
    icon: <BarChart3 className="w-5 h-5" />,
    question: "What's your budget flexibility?",
    subtitle: "Helps DAIna recommend the right stay class and dining tier",
    options: [
      { value: 'strict', label: 'Strict ceiling — no overages', icon: <Lock className="w-4 h-4" /> },
      { value: 'some_flex', label: 'Moderate flexibility (±15%)', icon: <BarChart3 className="w-4 h-4" /> },
      { value: 'splurge', label: 'Worth splurging for iconic experiences', icon: <Sparkles className="w-4 h-4" /> },
    ],
  },
  {
    id: 'walking',
    icon: <Footprints className="w-5 h-5" />,
    question: "What's your preferred daily pace?",
    subtitle: "Balances transit duration and walking distances between stops",
    options: [
      { value: 'low', label: 'Relaxed — scenic cabs & minimal walking', icon: <Car className="w-4 h-4" /> },
      { value: 'medium', label: 'Balanced — some walking (2–4 km/day)', icon: <PersonStanding className="w-4 h-4" /> },
      { value: 'high', label: 'Active explorer — love walking & trails (5+ km)', icon: <Footprints className="w-4 h-4" /> },
    ],
  },
  {
    id: 'food',
    icon: <UtensilsCrossed className="w-5 h-5" />,
    question: "Any dietary preferences?",
    subtitle: "Curated restaurant and cafe stops match your diet",
    options: [
      { value: 'any', label: 'Eat anything / Local specials', icon: <UtensilsCrossed className="w-4 h-4" /> },
      { value: 'veg', label: 'Vegetarian only', icon: <Salad className="w-4 h-4" /> },
      { value: 'vegan', label: 'Plant-based / Vegan', icon: <TreePine className="w-4 h-4" /> },
      { value: 'halal', label: 'Halal verified', icon: <HandHeart className="w-4 h-4" /> },
    ],
  },
  {
    id: 'accessibility',
    icon: <Accessibility className="w-5 h-5" />,
    question: "Any accessibility requirements?",
    subtitle: "Venues and sanctuary steps will be pre-checked",
    options: [
      { value: 'none', label: 'No special accessibility needs', icon: <Check className="w-4 h-4" /> },
      { value: 'wheelchair', label: 'Step-free / Wheelchair accessible ♿', icon: <Accessibility className="w-4 h-4" /> },
      { value: 'low_stairs', label: 'Avoid steep climbs & excessive stairs', icon: <ShieldAlert className="w-4 h-4" /> },
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

  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Focus trapping & Escape key support for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const previousFocusedElement = document.activeElement as HTMLElement | null;

    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusTimer = setTimeout(() => {
      const focusable = modalContainerRef.current?.querySelectorAll<HTMLElement>(focusableSelectors);
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = modalContainerRef.current?.querySelectorAll<HTMLElement>(focusableSelectors);
        if (!focusable || focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusedElement?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
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
    }, 200);
  };

  // Honest neutral skip: does NOT inject option 0
  const handleNeutralSkip = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(answers as ArchitectAnswers);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="architect-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
    >
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div
        ref={modalContainerRef}
        className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95"
      >
        {/* Progress bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-slate-100">
          <div
            className="h-full bg-orange-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <h2 id="architect-modal-title" className="text-sm font-serif-editorial font-bold text-slate-900 leading-tight">
                Make your trip feel like yours
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                What&apos;s most important to you? <span className="text-slate-400 font-normal">· {step + 1} of {STEPS.length}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close refinement dialog"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Question */}
        <div className="px-6 py-5 space-y-1">
          <div className="flex items-center gap-2 text-orange-600">
            {currentStep.icon}
            <h3 className="text-base font-serif-editorial font-bold text-slate-900 leading-tight">
              {currentStep.question}
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium pl-7">{currentStep.subtitle}</p>
        </div>

        {/* Options */}
        <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {currentStep.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                selected === opt.value
                  ? 'bg-orange-50/80 border-orange-500 text-orange-950 shadow-2xs'
                  : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-orange-300 hover:bg-orange-50/30'
              }`}
            >
              <span className={`shrink-0 ${selected === opt.value ? 'text-orange-600' : 'text-slate-400'}`}>
                {opt.icon}
              </span>
              <span className={`text-xs font-semibold leading-tight flex-1 ${selected === opt.value ? 'text-orange-950' : 'text-slate-800'}`}>
                {opt.label}
              </span>
              {selected === opt.value && (
                <Check className="w-4 h-4 text-orange-600 ml-auto shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => step > 0 && setStep(step - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 disabled:opacity-30 transition-colors cursor-pointer font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex gap-1.5 items-center">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'bg-orange-600 w-5' : i < step ? 'bg-orange-300 w-2' : 'bg-slate-200 w-2'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNeutralSkip}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-orange-600 transition-colors cursor-pointer font-semibold"
          >
            Skip
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
