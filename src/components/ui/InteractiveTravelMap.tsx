'use client';

import { useState } from 'react';
import { MapPin, Navigation, Sparkles, Star, ArrowRight, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MapPoint {
  id: string;
  name: string;
  category: string;
  lat: string;
  price: string;
  rating: string;
  top: string;
  left: string;
  vibe: string;
}

export function InteractiveTravelMap() {
  const router = useRouter();
  const [activePoint, setActivePoint] = useState<string>('gokarna');

  const points: MapPoint[] = [
    { id: 'manali', name: 'Manali Snow Pass', category: 'Alpine Retreat', lat: '32.24° N', price: '₹14,500', rating: '4.95', top: '22%', left: '28%', vibe: 'Mountains' },
    { id: 'gokarna', name: 'Gokarna Cliffside', category: 'Turquoise Bay', lat: '14.54° N', price: '₹8,900', rating: '4.88', top: '58%', left: '34%', vibe: 'Beach' },
    { id: 'havelock', name: 'Havelock Island', category: 'Coral Riviera', lat: '12.00° N', price: '₹28,900', rating: '4.98', top: '70%', left: '78%', vibe: 'Islands' },
    { id: 'jaipur', name: 'Jaipur Palace Estate', category: 'Heritage Fort', lat: '26.91° N', price: '₹11,200', rating: '4.92', top: '38%', left: '32%', vibe: 'Culture' },
    { id: 'kyoto', name: 'Kyoto Bamboo Shrine', category: 'Imperial Temple', lat: '35.01° N', price: '₹72,000', rating: '4.99', top: '35%', left: '88%', vibe: 'International' },
  ];

  const selected = points.find((p) => p.id === activePoint) || points[1];

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-slate-900 text-white border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
      {/* Background Stylized Vector Map Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-300 text-xs font-extrabold uppercase tracking-wider">
            <Navigation className="w-3.5 h-3.5 text-orange-400" />
            <span>Interactive Getaway Radar</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-white mt-1">
            Live Sanctuary Coordinates
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Explore curated getaway hubs across India & Asia mapped live by DAIna AI</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>5 Active Coordinates</span>
          </span>
        </div>
      </div>

      {/* Interactive Map Canvas Area */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        {/* Map Display Box */}
        <div className="lg:col-span-2 relative h-80 sm:h-96 rounded-2xl bg-slate-950/80 border border-slate-800/90 overflow-hidden shadow-inner flex items-center justify-center">
          {/* Subtle World Map Silhouette SVG Overlay */}
          <div className="absolute inset-0 bg-cover bg-center opacity-20 filter contrast-125" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&auto=format&fit=crop&q=80')` }} />

          {/* Glowing Grid lines */}
          <div className="absolute inset-0 border border-slate-800/40 divide-y divide-slate-800/30 grid grid-rows-6 pointer-events-none">
            <div /><div /><div /><div /><div /><div />
          </div>

          {/* Interactive Map Pins */}
          {points.map((pt) => {
            const isSelected = pt.id === activePoint;
            return (
              <button
                key={pt.id}
                onClick={() => setActivePoint(pt.id)}
                style={{ top: pt.top, left: pt.left }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 focus:outline-none z-20`}
              >
                <div className={`relative flex items-center justify-center p-2 rounded-full border transition-all ${
                  isSelected
                    ? 'bg-orange-500 border-white text-white scale-125 shadow-lg shadow-orange-500/50'
                    : 'bg-slate-900/90 border-orange-400/60 text-orange-300 hover:scale-110 hover:border-white'
                }`}>
                  <MapPin className="w-4 h-4" />
                  {isSelected && (
                    <span className="absolute -inset-1 rounded-full border border-orange-400 animate-ping opacity-75" />
                  )}
                </div>
                <span className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap backdrop-blur-md transition-all ${
                  isSelected
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-slate-900/90 text-slate-300 border border-slate-700 group-hover:bg-slate-800'
                }`}>
                  {pt.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Point Detail Card */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-6 space-y-5 flex flex-col justify-between h-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs font-extrabold uppercase border border-orange-400/30">
                {selected.vibe}
              </span>
              <span className="text-xs text-slate-400 font-mono">{selected.lat}</span>
            </div>

            <div>
              <h4 className="text-xl font-serif-editorial font-bold text-white">{selected.name}</h4>
              <p className="text-xs text-slate-400 font-medium">{selected.category}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Est. Budget</span>
                <p className="text-lg font-extrabold text-orange-400 font-serif-editorial">{selected.price}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Rating</span>
                <p className="text-sm font-extrabold text-amber-300 flex items-center gap-1 justify-end">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {selected.rating}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push(`/planner?query=${encodeURIComponent(`Plan trip to ${selected.name}`)}`)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Generate Itinerary for {selected.name}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
