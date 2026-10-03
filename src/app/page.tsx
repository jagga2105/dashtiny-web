'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Compass, 
  MapPin, 
  Calendar, 
  ArrowRight, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  Ticket, 
  Plane, 
  Hotel, 
  Star,
  Layers,
  Clock,
  ExternalLink
} from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { Button } from '@/components/ui/Button';

export default function Home() {
  const router = useRouter();
  const [heroPrompt, setHeroPrompt] = useState('');

  const handleStartPlanning = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroPrompt.trim()) {
      router.push(`/planner?query=${encodeURIComponent(heroPrompt.trim())}`);
    } else {
      router.push('/planner');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-200">
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100/80 border border-orange-200 text-orange-900 text-xs font-semibold tracking-wide uppercase shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Intelligent Travel Platform • Single Cockpit</span>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-serif-editorial font-bold text-slate-950 tracking-tight leading-[1.08]">
              Plan your entire trip in <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">one intelligent place.</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Eliminate dozens of open tabs. Discover destinations, build deterministic itineraries, 
              compare travel catalogs, split squad expenses, and navigate every stop without switching platforms.
            </p>

            {/* Quick Interactive Prompt Bar */}
            <form 
              onSubmit={handleStartPlanning}
              className="max-w-2xl mx-auto p-2 bg-white rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center gap-2"
            >
              <div className="flex-1 flex items-center gap-2.5 px-3 w-full">
                <Compass className="w-5 h-5 text-orange-500 shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. Plan 7 days in Japan for ₹1.5L from Delhi..."
                  value={heroPrompt}
                  onChange={(e) => setHeroPrompt(e.target.value)}
                  className="w-full py-2.5 text-sm bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400 font-medium"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Generate Plan</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            {/* Prompt Inspiration Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-400">Popular:</span>
              {[
                { label: 'Kyoto 6-day heritage', query: 'Plan 6 days in Kyoto with temples, tea ceremonies, and local dining' },
                { label: 'Goa 4-day slow coastal', query: 'Plan 4 relaxing days in South Goa under ₹25k with beach cafes' },
                { label: 'Manali 5-day mountain escape', query: 'Plan 5 days in Manali for couple with scenic hikes and cafe visits' },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => router.push(`/planner?query=${encodeURIComponent(p.query)}`)}
                  className="px-3 py-1 rounded-full bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-700 hover:text-orange-700 transition-colors shadow-2xs cursor-pointer font-medium"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* CORE PILLARS: WHAT CAN DASHTINY DO? */}
        <section className="py-16 sm:py-24 max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-950">
              Built on Honest Engineering &amp; Trust
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every card carries genuine provenance. No hallucinated flights, no fake inventory numbers, and no hidden booking surprises.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Pillar 1: AI Planner */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-orange-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-serif-editorial font-bold text-slate-900">
                Deterministic AI Itineraries
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                DAIna structures every morning, afternoon, and evening with time slots, transit warnings, and crowd advisories. Easily adjust pacing and traveler count inline.
              </p>
              <div className="pt-2">
                <Link 
                  href="/planner" 
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 group"
                >
                  <span>Open AI Planner</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Pillar 2: Trip Workspace */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-orange-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-serif-editorial font-bold text-slate-900">
                Persistent Trip Workspace
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Your trip is the central source of truth. Manage day schedules, approximate route maps, expense split ledgers, and partner reference PNRs in one persistent cockpit.
              </p>
              <div className="pt-2">
                <Link 
                  href="/trips" 
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group"
                >
                  <span>View Trip Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Pillar 3: Catalog & Community */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-orange-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-serif-editorial font-bold text-slate-900">
                Verified Community &amp; Catalog
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Explore authentic traveler itineraries with verified snapshots. Pick and choose exactly the stops you want to keep, and adapt the rest around your style.
              </p>
              <div className="pt-2">
                <Link 
                  href="/community" 
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 group"
                >
                  <span>Explore Community Feed</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* EXAMPLE ITINERARY PREVIEW */}
        <section className="py-16 bg-slate-900 text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-orange-400 font-semibold">
                  Canonical Schema In Action
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif-editorial font-bold">
                  What a DashTiny Itinerary looks like
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/planner?destination=Kyoto&duration=6&budget=125000')}
                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold cursor-pointer w-fit"
              >
                Adapt this Kyoto Plan →
              </Button>
            </div>

            {/* Interactive Timeline Mockup */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  day: 'Day 1',
                  title: 'Arrival & Gion Lantern Stroll',
                  time: '10:00 AM – 8:30 PM',
                  stops: ['Check-in at Machiya Townhouse', 'Nishiki Market Culinary Discovery', 'Evening Gion Lantern Walk'],
                  vibe: 'Culture & Arrival',
                },
                {
                  day: 'Day 2',
                  title: 'Zen Sanctuaries & Bamboo Paths',
                  time: '08:30 AM – 6:00 PM',
                  stops: ['Early Fushimi Inari Dawn Ascent', 'Tofuku-ji Hojo Zen Rock Garden', 'Kiyomizu-dera Sunset Terrace'],
                  vibe: 'Iconic & Sacred',
                },
                {
                  day: 'Day 3',
                  title: 'Arashiyama River & Forest',
                  time: '09:00 AM – 7:00 PM',
                  stops: ['Tenryu-ji Temple Morning Meditation', 'Sagano Bamboo Forest Stroll', 'Riverside Kaiseki Dinner'],
                  vibe: 'Nature & Gastronomy',
                },
              ].map((card, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-orange-400 font-bold">{card.day}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {card.time}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">{card.title}</h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {card.stops.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                        <span className="truncate">{s}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t border-slate-700 text-[10px] text-slate-400 font-medium">
                    Pacing: {card.vibe}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-serif-editorial font-bold text-slate-900">
              Ready to experience modern travel planning?
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">
              Skip the fragmented bookmarks and spreadsheets. Build your next getaway with genuine travel intelligence.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/planner')}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-sm cursor-pointer"
            >
              Start Free Planning →
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/explore')}
              className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50 font-semibold text-sm px-6 py-3 rounded-xl cursor-pointer"
            >
              Explore Destinations
            </Button>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif-editorial font-bold text-slate-900 text-sm">DashTiny</span>
            <span>—</span>
            <span>Intelligent Travel Platform</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600">
            <Link href="/explore" className="hover:text-orange-600">Explore</Link>
            <Link href="/planner" className="hover:text-orange-600">Planner</Link>
            <Link href="/trips" className="hover:text-orange-600">Trips</Link>
            <Link href="/bookings" className="hover:text-orange-600">Bookings</Link>
            <Link href="/community" className="hover:text-orange-600">Community</Link>
            <Link href="/rewards" className="hover:text-orange-600">Rewards</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
