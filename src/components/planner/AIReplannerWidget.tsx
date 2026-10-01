'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, X, Clock, Plane } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Disruption {
  type: 'flight_delay' | 'hotel_cancelled' | 'weather';
  title: string;
  detail: string;
  impact: string;
  emoji: string;
}

interface AIReplannerWidgetProps {
  disruption?: Disruption;
}

const DEFAULT_DISRUPTION: Disruption = {
  type: 'flight_delay',
  title: 'Flight IndiGo 6E-534 delayed',
  detail: 'BLR → GOI delayed by 3 hours. New departure: 4:30 PM (was 1:30 PM)',
  impact: 'Day 1 check-in and beach activity affected',
  emoji: '✈️',
};

export function AIReplannerWidget({ disruption = DEFAULT_DISRUPTION }: AIReplannerWidgetProps) {
  const [dismissed, setDismissed] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const [replanned, setReplanned] = useState(false);
  const [thinkingStep, setThinkingStep] = useState('');

  if (dismissed) return null;

  const handleReplan = async () => {
    setReplanning(true);

    const steps = [
      'Analyzing disruption impact…',
      'Rescheduling Day 1 activities…',
      'Finding alternative hotel check-in…',
      'Adjusting restaurant reservations…',
      'Rebuilding optimized timeline…',
    ];

    for (const s of steps) {
      setThinkingStep(s);
      await new Promise(r => setTimeout(r, 700));
    }

    setReplanning(false);
    setReplanned(true);
    setThinkingStep('');
  };

  if (replanned) {
    return (
      <div className="rounded-2xl bg-emerald-500/8 border border-emerald-400/25 p-4 flex items-center gap-3 animate-slide-up">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-bold text-emerald-300">Trip replanned successfully</div>
          <p className="text-xs text-gray-400 font-light">DAIna rebuilt your Day 1 timeline. Check-in moved to 6:00 PM. Beach sunset activity added instead.</p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-rose-50/80 border border-rose-200 p-4 space-y-3 shadow-2xs animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center flex-shrink-0 text-lg">
            {disruption.emoji}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-rose-800">Getaway Alert</span>
            </div>
            <h4 className="text-sm font-extrabold text-slate-900">{disruption.title}</h4>
            <p className="text-xs text-slate-600 font-medium">{disruption.detail}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-3 h-3 text-orange-600" />
              <span className="text-[11px] text-orange-800 font-bold">{disruption.impact}</span>
            </div>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-slate-900 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {replanning && thinkingStep && (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex gap-1">
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-orange-500 inline-block animate-bounce" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-orange-500 inline-block animate-bounce delay-100" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-orange-500 inline-block animate-bounce delay-200" />
          </div>
          <span className="text-xs text-orange-700 font-extrabold">{thinkingStep}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleReplan}
          disabled={replanning}
          className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-white ${replanning ? 'animate-spin' : ''}`} />
          {replanning ? 'AI Replanning…' : 'Replan with AI → ~10 sec'}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
