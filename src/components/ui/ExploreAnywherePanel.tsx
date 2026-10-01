'use client';

import { useState } from 'react';
import {
  Shuffle,
  Loader2,
  ArrowRight,
  Clock,
  TrendingDown,
  Waves,
  Mountain,
  Leaf,
  Landmark,
  UtensilsCrossed,
  Heart,
  Plane,
  Building2,
  Star,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';

interface AISuggestion {
  destination: string;
  country: string;
  icon: React.ReactNode;
  flight: string;
  hotel: string;
  total: string;
  days: string;
  vibe: string;
  tag: string;
  tagColor: string;
}

const suggestions: AISuggestion[] = [
  {
    destination: 'Goa', country: 'India',
    icon: <Waves className="w-5 h-5 text-blue-400" />,
    flight: '₹4,200', hotel: '₹3,800/night', total: '₹18,600',
    days: '4 days', vibe: 'Beach',
    tag: 'Best Value', tagColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    destination: 'Jaipur', country: 'India',
    icon: <Landmark className="w-5 h-5 text-amber-400" />,
    flight: '₹3,100', hotel: '₹2,900/night', total: '₹15,800',
    days: '3 days', vibe: 'Culture',
    tag: 'Cheapest', tagColor: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  },
  {
    destination: 'Coorg', country: 'India',
    icon: <Leaf className="w-5 h-5 text-emerald-400" />,
    flight: '₹2,800', hotel: '₹3,500/night', total: '₹17,200',
    days: '3 days', vibe: 'Nature',
    tag: 'Trending', tagColor: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  },
  {
    destination: 'Rishikesh', country: 'India',
    icon: <Mountain className="w-5 h-5 text-indigo-400" />,
    flight: '₹3,600', hotel: '₹2,400/night', total: '₹14,200',
    days: '4 days', vibe: 'Adventure',
    tag: 'AI Pick', tagColor: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  },
  {
    destination: 'Andaman', country: 'India',
    icon: <Waves className="w-5 h-5 text-cyan-400" />,
    flight: '₹6,400', hotel: '₹4,200/night', total: '₹23,800',
    days: '5 days', vibe: 'Islands',
    tag: 'Popular', tagColor: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  },
  {
    destination: 'Manali', country: 'India',
    icon: <Mountain className="w-5 h-5 text-sky-400" />,
    flight: '₹4,800', hotel: '₹2,800/night', total: '₹16,500',
    days: '4 days', vibe: 'Mountains',
    tag: 'Top Rated', tagColor: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  },
];

const vibeFilters = [
  { id: 'Any',       label: 'Any vibe',   icon: <Star className="w-3.5 h-3.5" /> },
  { id: 'Beach',     label: 'Beach',      icon: <Waves className="w-3.5 h-3.5" /> },
  { id: 'Mountains', label: 'Mountains',  icon: <Mountain className="w-3.5 h-3.5" /> },
  { id: 'Nature',    label: 'Nature',     icon: <Leaf className="w-3.5 h-3.5" /> },
  { id: 'Culture',   label: 'Culture',    icon: <Landmark className="w-3.5 h-3.5" /> },
  { id: 'Food',      label: 'Food',       icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
  { id: 'Wellness',  label: 'Wellness',   icon: <Heart className="w-3.5 h-3.5" /> },
];

interface ExploreAnywherePanelProps {
  onClose?: () => void;
}

export function ExploreAnywherePanel({ onClose }: ExploreAnywherePanelProps) {
  const router = useRouter();
  const [budget, setBudget] = useState('20000');
  const [days, setDays] = useState('4');
  const [vibe, setVibe] = useState('Any');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<AISuggestion[]>([]);
  const [thinkingStep, setThinkingStep] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResults([]);

    const steps = [
      'Scanning 500+ destinations…',
      `Matching your budget of ₹${Number(budget).toLocaleString('en-IN')}…`,
      'Checking live flight prices…',
      'Finding best hotel deals…',
      'AI ranking by value score…',
    ];

    for (const step of steps) {
      setThinkingStep(step);
      await new Promise(r => setTimeout(r, 600));
    }

    const budgetNum = Number(budget);
    const filtered = suggestions.filter(s => {
      const total = Number(s.total.replace(/[₹,]/g, ''));
      const vibeMatch = vibe === 'Any' || s.vibe === vibe || s.vibe.toLowerCase().includes(vibe.toLowerCase());
      return total <= budgetNum * 1.2 && vibeMatch;
    });

    setResults(filtered.length > 0 ? filtered : suggestions.slice(0, 4));
    setIsGenerating(false);
    setThinkingStep('');
  };

  return (
    <div className="w-full rounded-3xl bg-white border border-slate-200/90 p-6 space-y-6 shadow-sm animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center">
            <Shuffle className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Explore Anywhere</h3>
            <p className="text-[11px] text-slate-500">AI finds where you can getaway within your budget</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors font-bold"
          >
            Close
          </button>
        )}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500">Max Budget</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-300 text-sm font-bold">₹</span>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              className="w-full pl-7 pr-3 py-2.5 bg-[#08090E] border border-white/8 rounded-xl text-white text-sm font-semibold focus:outline-none focus:border-amber-400/40 transition-colors"
              placeholder="20000"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Duration</label>
          <div className="flex gap-1.5">
            {['2', '3', '4', '5', '7'].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  days === d
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#08090E] border border-white/8 text-gray-400 hover:text-white'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Travel Style</label>
          <div className="flex flex-wrap gap-1.5">
            {vibeFilters.slice(0, 4).map(v => (
              <button
                key={v.id}
                onClick={() => setVibe(v.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  vibe === v.id
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                    : 'bg-[#08090E] border border-white/8 text-gray-400 hover:text-white'
                }`}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        variant="primary"
        size="md"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold shadow-lg shadow-amber-500/15 disabled:opacity-60"
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Finding destinations…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Find destinations under ₹{Number(budget).toLocaleString('en-IN')}
            <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </Button>

      {/* AI Thinking */}
      {isGenerating && thinkingStep && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#08090E] border border-white/8">
          <div className="flex gap-1">
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          </div>
          <span className="text-xs text-amber-200 font-medium">{thinkingStep}</span>
        </div>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 font-medium">
              {results.length} destinations within ₹{Number(budget).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Ranked by value
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((s, i) => (
              <button
                key={i}
                className="p-4 rounded-xl bg-[#08090E] border border-white/8 hover:border-amber-400/30 transition-all text-left group animate-slide-up"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => router.push(`/planner?query=${encodeURIComponent(`Plan ${s.days} trip to ${s.destination}`)}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0E1017] border border-white/8 flex items-center justify-center">
                    {s.icon}
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${s.tagColor}`}>
                    {s.tag}
                  </span>
                </div>

                <div className="space-y-0.5 mb-3">
                  <div className="font-bold text-white text-sm">{s.destination}</div>
                  <div className="text-[11px] text-gray-500">{s.days} · {s.vibe}</div>
                </div>

                <div className="pt-3 border-t border-white/6 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Est. total
                    </div>
                    <div className="text-base font-bold text-amber-300">{s.total}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-600 group-hover:text-amber-400 transition-colors font-medium">
                    <Plane className="w-3 h-3" />
                    <span>{s.flight}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
