'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Sparkles,
  Compass,
  MapPin,
  Bot,
  Star,
  Flame,
  Sun,
  Mountain,
  Utensils,
  Users,
  Heart,
  BookOpen,
  X,
  Check,
  ArrowRight,
  Waves,
  Leaf,
  BookMarked,
  Luggage,
  ExternalLink,
  Zap,
  Globe,
  Wallet,
  Building2,
  Plane,
  Ticket,
} from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { PriceForecastBanner } from '@/components/ui/PriceForecastBanner';
import { AIMemoryChips } from '@/components/ui/AIMemoryChips';
import { InteractiveTravelMap } from '@/components/ui/InteractiveTravelMap';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

interface DestinationItem {
  id: string;
  title: string;
  location: string;
  vibe: string;
  duration: string;
  price: string;
  rating: string;
  reviews: string;
  image: string;
  tag: string;
  highlights: string[];
  insiderTips?: string[];
}

interface DriveItem {
  id: string;
  name: string;
  dist_time: string;
  stay_suggestion: string;
  vibe_tag: string;
  image: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  const [promptText, setPromptText] = useState('');
  const [activeVibe, setActiveVibe] = useState('all');
  const [dynamicSanctuaries, setDynamicSanctuaries] = useState<DestinationItem[]>([]);
  const [dynamicDrives, setDynamicDrives] = useState<DriveItem[]>([]);
  const [savedFavorites, setSavedFavorites] = useState<{ [key: string]: boolean }>({});
  const [selectedGuide, setSelectedGuide] = useState<DestinationItem | null>(null);
  const [compassFocused, setCompassFocused] = useState(false);
  const [favoriteToast, setFavoriteToast] = useState<string | null>(null);
  const [realActiveTrip, setRealActiveTrip] = useState<any | null>(null);

  useEffect(() => {
    async function loadBackendData() {
      try {
        const [sancData, drvData, tripsData] = await Promise.all([
          apiService.getSanctuaries(activeVibe),
          apiService.getDriveEscapes('Bengaluru'),
          apiService.getMyTrips(),
        ]);

        if (sancData && sancData.length > 0) {
          setDynamicSanctuaries(sancData);
        }
        if (drvData && drvData.length > 0) {
          setDynamicDrives(drvData);
        }
        if (tripsData && tripsData.length > 0) {
          setRealActiveTrip(tripsData[0]);
        } else {
          setRealActiveTrip(null);
        }
      } catch (err) {
        console.error('Failed to load dashboard data from backend:', err);
      }
    }
    loadBackendData();
  }, [activeVibe]);

  const handleQuickPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('Sign in with Google to build, customize, and save your getaway itinerary with DAIna AI', () => {
        router.push(promptText.trim() ? `/planner?query=${encodeURIComponent(promptText)}` : '/planner');
      });
      return;
    }
    if (promptText.trim()) {
      router.push(`/planner?query=${encodeURIComponent(promptText)}`);
    } else {
      router.push('/planner');
    }
  };

  const toggleFavorite = (id: string, title: string) => {
    setSavedFavorites((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (next[id]) {
        setFavoriteToast(title);
        setTimeout(() => setFavoriteToast(null), 2500);
      }
      return next;
    });
  };

  const travelVibes = [
    { id: 'all',       label: 'All Getaways', icon: Flame },
    { id: 'beach',     label: 'Beach Riviera', icon: Waves },
    { id: 'mountains', label: 'Alpine Retreats', icon: Mountain },
    { id: 'culture',   label: 'Heritage & Culture', icon: BookMarked },
    { id: 'foodie',    label: 'Culinary Escapes', icon: Utensils },
    { id: 'wellness',  label: 'Wellness Sanctuaries', icon: Leaf },
  ];

  const trendingDestinations: DestinationItem[] = [
    {
      id: 'dest_1',
      title: 'Manali Alpine Sanctuary & Snow Retreat',
      location: 'Himachal Pradesh, India',
      vibe: 'mountains',
      duration: '4 Days / 3 Nights',
      price: '₹14,500',
      rating: '4.95',
      reviews: '2,480',
      image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop&q=80',
      tag: 'MANALI · HIMACHAL PRADESH',
      highlights: ['Tandem Paragliding over Valley', 'Private ATV Snow Trek', 'Artisanal Hot Cider Tasting'],
      insiderTips: [
        'Private sunrise paragliding sessions available at 6:30 AM before tourists arrive.',
        'Savor authentic Himalayan trout & spiced hot cider at Old Manali vintage cafes.',
        'VIP Rohtang Pass permit pre-booked directly via DAIna AI Butler.',
      ],
    },
    {
      id: 'dest_2',
      title: 'Havelock & Radhanagar Turquoise Bay',
      location: 'Andaman Islands',
      vibe: 'beach',
      duration: '5 Days / 4 Nights',
      price: '₹28,900',
      rating: '4.98',
      reviews: '1,890',
      image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80',
      tag: 'HAVELOCK · ANDAMAN ISLANDS',
      highlights: ['PADI Private Reef Scuba', 'Radhanagar Sunset Lounge', 'Bioluminescent Kayaking'],
      insiderTips: [
        'Radhanagar Beach sunset viewed from reserved private cabanas at tree line.',
        'Luxury catamaran sea passages pre-scheduled via Makruzz Executive Deck.',
        'Night kayaking at Kalapathar Beach during moonless nights to see glowing plankton.',
      ],
    },
    {
      id: 'dest_3',
      title: 'Jaipur Palace & Amer Heritage Estate',
      location: 'Rajasthan, India',
      vibe: 'culture',
      duration: '3 Days / 2 Nights',
      price: '₹11,200',
      rating: '4.92',
      reviews: '3,120',
      image: 'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?w=800&auto=format&fit=crop&q=80',
      tag: 'JAIPUR · RAJASTHAN',
      highlights: ['Private Royal City Palace Access', 'Amer Fort Champagne Sunset', 'Vintage Car City Tour'],
      insiderTips: [
        'Exclusive photography entry at Hawa Mahal private rooftop suite.',
        'Private dinner experience inside Suvarna Mahal with royal harp performance.',
      ],
    },
    {
      id: 'dest_4',
      title: 'Munnar Tea Estate & Backwater Villa',
      location: 'Kerala, India',
      vibe: 'wellness',
      duration: '4 Days / 3 Nights',
      price: '₹16,800',
      rating: '4.96',
      reviews: '1,540',
      image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&auto=format&fit=crop&q=80',
      tag: 'MUNNAR · KERALA',
      highlights: ['Private Solar Houseboat Cruise', 'Organic Spice Estate Walk', 'Ayurvedic Wellness Spa'],
      insiderTips: [
        'Overnight cruise through Vembanad Lake on a private glass-roof luxury houseboat.',
        'Artisanal tea tasting session guided by master tea blenders at Lockhart Estate.',
      ],
    },
    {
      id: 'dest_5',
      title: 'Gokarna Sanctuary & Cliffside Villa',
      location: 'Karnataka, India',
      vibe: 'beach',
      duration: '3 Days / 2 Nights',
      price: '₹8,900',
      rating: '4.88',
      reviews: '980',
      image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80',
      tag: 'GOKARNA · KARNATAKA',
      highlights: ['Private Cliff Beach Hike', 'Organic Seafood Tasting', 'Bioluminescence Trek'],
      insiderTips: [
        'Early morning 5-beach cliff trek starting at Kudle Beach before sunrise.',
        'Secluded dining at Om Beach cliff tables with panoramic sunset views.',
      ],
    },
    {
      id: 'dest_6',
      title: 'Kyoto Imperial Shrines & Bamboo Sanctuary',
      location: 'Japan',
      vibe: 'culture',
      duration: '6 Days / 5 Nights',
      price: '₹72,000',
      rating: '4.99',
      reviews: '4,250',
      image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80',
      tag: 'KYOTO · JAPAN',
      highlights: ['Private Tea Ceremony in Gion', 'Arashiyama Sunrise Access', 'Michelin Kaiseki Dinner'],
      insiderTips: [
        'Private access to Fushimi Inari shrines before public opening hours.',
        'Traditional multi-course Kaiseki dinner at 3-Star Michelin Ryokan.',
      ],
    },
  ];

  const listToUse = dynamicSanctuaries.length > 0 ? dynamicSanctuaries : trendingDestinations;
  const filteredDestinations = activeVibe === 'all'
    ? listToUse
    : listToUse.filter((d) => d.vibe === activeVibe);

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      {/* === Hero Section — Calm, focused, one primary question === */}
      <section className="relative w-full overflow-hidden border-b border-slate-200/80 py-12 sm:py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 space-y-6 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-serif-editorial font-bold text-slate-900 tracking-tight">
              Where do you want to go?
            </h1>
            <p className="text-slate-600 text-sm sm:text-base font-normal max-w-xl mx-auto">
              Tell DAIna about your trip. We'll help you figure out the rest.
            </p>
          </div>

          {/* Conversational Prompt Box */}
          <form onSubmit={handleQuickPlan} className="p-2 sm:p-2.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto focus-within:border-orange-500 focus-within:bg-white transition-all">
            <div className="relative flex-1 flex items-center">
              <Sparkles className="absolute left-3.5 w-4 h-4 text-orange-500" />
              <input
                type="text"
                placeholder="5 days in Japan under ₹1.5L, with great food and photography..."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="w-full bg-transparent border-0 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Plan my trip
            </Button>
          </form>

          {/* Popular destination quick prompts */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 pt-1">
            <span className="font-medium text-slate-400">Popular:</span>
            {[
              { label: 'Goa', query: '4 days in Goa under ₹25k, beaches and seafood' },
              { label: 'Manali', query: '5 days Manali mountain retreat with scenic trails' },
              { label: 'Kyoto', query: '6 days in Kyoto, culture, food and photography' },
              { label: 'Kerala', query: '4 days in Kerala, tea plantations and houseboats' },
            ].map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPromptText(item.query)}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 transition-colors font-medium cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Transparent Memory Chips */}
          <div className="max-w-2xl mx-auto text-left pt-2">
            <AIMemoryChips />
          </div>
        </div>
      </section>

      {/* === Main Body Content === */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-12">

        {/* YOUR NEXT TRIP — Central Cockpit Card */}
        {realActiveTrip ? (
          <section className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                    Your Active Trip
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500">
                    {realActiveTrip.startDate ? `Starts ${realActiveTrip.startDate}` : 'Upcoming'}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-serif-editorial font-bold text-slate-900">
                  {realActiveTrip.title}
                </h3>
                <p className="text-xs text-slate-600">
                  {realActiveTrip.destination} · {realActiveTrip.daysCount || realActiveTrip.days?.length || 3} days · ₹{realActiveTrip.budget?.toLocaleString('en-IN')} estimated
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold shrink-0 px-5 py-2.5 rounded-xl transition-colors text-xs"
                onClick={() => router.push('/trips')}
              >
                <Luggage className="w-4 h-4 mr-1.5" />
                Continue planning in Trip Workspace →
              </Button>
            </div>
          </section>
        ) : (
          <section className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Trip Workspace</span>
              <h3 className="text-lg font-semibold text-slate-900">No active trip right now</h3>
              <p className="text-xs text-slate-500">Every plan, booking, and daily schedule lives inside your Trip Workspace.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white border-slate-200 text-slate-800 font-semibold hover:bg-slate-50 text-xs px-4"
              onClick={() => router.push('/planner')}
            >
              Plan your first trip →
            </Button>
          </section>
        )}

        {/* EXPLORE FOR YOU — Curated Destinations */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs uppercase font-bold text-orange-600 tracking-wider">
                Explore For You
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900 mt-0.5">
                Destinations you'll love
              </h2>
            </div>

            {/* Travel Vibes filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {travelVibes.map((vibe) => {
                const isActive = activeVibe === vibe.id;
                return (
                  <button
                    key={vibe.id}
                    onClick={() => setActiveVibe(vibe.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                      isActive
                        ? 'bg-orange-500 text-white font-semibold'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {vibe.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simplified, Scannable Destination Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDestinations.map((dest) => (
              <div
                key={dest.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src={dest.image}
                      alt={dest.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/95 text-slate-800 text-[10px] font-semibold border border-slate-200 shadow-2xs">
                        Curated guide
                      </span>
                      <button
                        onClick={() => toggleFavorite(dest.id, dest.title)}
                        className="p-1.5 rounded-full bg-white/90 text-slate-700 hover:text-rose-500 transition-colors shadow-2xs"
                        aria-label="Save destination"
                      >
                        <Heart className={`w-3.5 h-3.5 ${savedFavorites[dest.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="space-y-0.5">
                      <h3 className="text-lg font-semibold text-slate-900">{dest.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {dest.location}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600">
                      {dest.duration} · <span className="font-semibold text-slate-900">{dest.price} est.</span>
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {dest.highlights.slice(0, 2).map((h, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/80">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedGuide(dest)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    View tips
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg"
                    onClick={() => router.push(`/planner?query=${encodeURIComponent(`Plan getaway to ${dest.title}`)}`)}
                  >
                    Plan this →
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Provider Aggregation Hub */}
        <section className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs uppercase font-extrabold text-sky-600 tracking-widest flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-sky-500" /> Booking Aggregation Hub
              </span>
              <h2 className="text-3xl font-serif-editorial font-bold text-slate-900 mt-1">
                Compare Fares Across 12+ Providers
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                No need to switch tabs — DashTiny scans Booking.com, Airbnb, Agoda, Skyscanner & Taj directly.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-sky-200 text-sky-700 hover:bg-sky-50 text-xs font-bold shrink-0 hover:scale-105 transition-all"
              onClick={() => router.push('/bookings')}
            >
              Compare Live Rates →
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { type: 'Luxury Stays', provider: 'Booking.com & Taj', discount: 'Save 18%', icon: Building2, count: '450+ Hotels' },
              { type: 'Bespoke Villas', provider: 'Airbnb & Agoda', discount: 'Lowest Price', icon: Building2, count: '280+ Villas' },
              { type: 'Flight Passages', provider: 'Skyscanner & IndiGo', discount: 'Lock Rate', icon: Plane, count: 'Direct Routes' },
              { type: 'Curated Experiences', provider: 'GetYourGuide & Viator', discount: 'Exclusive Access', icon: Ticket, count: '1,200+ Tours' },
            ].map((agg, idx) => {
              const Icon = agg.icon;
              return (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2 hover:border-orange-300 hover:bg-orange-50/20 hover:scale-[1.02] transition-all cursor-pointer" onClick={() => router.push('/bookings')}>
                  <div className="flex items-center justify-between">
                    <Icon className="w-6 h-6 text-sky-600" />
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                      {agg.discount}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{agg.type}</h4>
                  <p className="text-xs text-slate-500 font-medium">{agg.provider}</p>
                  <span className="text-[10px] text-sky-600 font-extrabold block pt-1">{agg.count}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quick Weekend Escapes */}
        <section className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-orange-50/60 via-white to-sky-50/60 border border-orange-200/80 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-orange-100 pb-4">
            <div>
              <span className="text-xs uppercase font-extrabold text-orange-600 tracking-widest flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-orange-500" /> Weekend Escape Finder
              </span>
              <h2 className="text-3xl font-serif-editorial font-bold text-slate-900 mt-1">
                Quick 2 & 3-Day Drive Escapes
              </h2>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Short weekend getaways curated by drive distance & scenic roadtrip routes.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-white text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs">
              📍 From Your City
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {(dynamicDrives.length > 0 ? dynamicDrives : [
              {
                id: 'drv_01',
                name: 'Nandi Hills Sunrise & Cloud Deck',
                dist_time: '1 hr 15 min drive (62 km)',
                stay_suggestion: 'KSTDC Hill Resort & Cafe',
                vibe_tag: '🌄 Early Bird Escapes',
                image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop&q=80'
              },
              {
                id: 'drv_02',
                name: 'Chikmagalur Coffee Ridge Trail',
                dist_time: '4 hr 15 min drive (240 km)',
                stay_suggestion: 'Serai Luxury Estate Villa',
                vibe_tag: '☕ Coffee & Mist',
                image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'
              },
              {
                id: 'drv_03',
                name: 'Wayanad Rainforest & Stream Sanctuary',
                dist_time: '5 hr 30 min drive (275 km)',
                stay_suggestion: 'Vythiri Treehouse Resort',
                vibe_tag: '🌳 Deep Jungle',
                image: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&auto=format&fit=crop&q=80'
              }
            ]).map((esc) => (
              <div key={esc.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3 hover:border-orange-300 hover:scale-[1.02] transition-all cursor-pointer" onClick={() => router.push(`/planner?query=${encodeURIComponent(esc.name)}`)}>
                <div className="relative h-32 rounded-xl overflow-hidden">
                  <Image src={esc.image} alt={esc.name} fill className="object-cover" />
                  <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-extrabold">
                    {esc.vibe_tag}
                  </span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">{esc.name}</h4>
                  <p className="text-xs text-sky-600 font-semibold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {esc.dist_time}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">Stay: {esc.stay_suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Group Getaway Studio Banner */}
        <section className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-300 text-xs font-extrabold uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-orange-400" />
                <span>Collaborative Getaway Studio</span>
              </div>
              <h2 className="text-3xl font-serif-editorial font-bold text-white">
                Plan Getaways Together With Friends & Family
              </h2>
              <p className="text-slate-300 text-sm font-light leading-relaxed">
                Invite companions with one link. Vote on villas, split costs dynamically, and build a shared itinerary live in real-time.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Button
                variant="primary"
                size="md"
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold px-6 hover:scale-105 transition-all"
                onClick={() => router.push('/planner')}
              >
                Create Group Getaway →
              </Button>
            </div>
          </div>
        </section>

        {/* Favorite Toast */}
        {favoriteToast && (
          <div className="fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#0E1017] border border-rose-500/30 shadow-2xl text-xs font-semibold text-rose-300 animate-in fade-in slide-in-from-bottom-4">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>Saved to favourites — <strong className="text-white">{favoriteToast}</strong></span>
          </div>
        )}

        {/* Editorial Guide Modal Drawer */}
        {selectedGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedGuide(null)}
          >
            <Card className="w-full max-w-xl bg-white border border-slate-200 p-8 space-y-6 relative rounded-3xl shadow-2xl text-slate-900" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif-editorial font-bold text-slate-900">{selectedGuide.title}</h3>
                    <p className="text-xs text-orange-600 uppercase tracking-widest font-extrabold">Insider Tips & Local Secrets</p>
                  </div>
                </div>
                <button onClick={() => setSelectedGuide(null)} className="text-slate-400 hover:text-slate-800 text-lg font-bold">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <p className="font-extrabold text-orange-600 uppercase tracking-widest">Insider Tips & Local Secrets:</p>
                <div className="space-y-2.5">
                  {selectedGuide.insiderTips?.map((tip, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-slate-700 leading-relaxed font-medium">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-md shadow-orange-500/20"
                onClick={() => {
                  const targetTitle = selectedGuide.title;
                  setSelectedGuide(null);
                  router.push(`/planner?query=${encodeURIComponent(`Plan getaway to ${targetTitle}`)}`);
                }}
              >
                <span>Plan This Getaway with DAIna →</span>
              </Button>
            </Card>
          </div>
        )}
      </main>

      <DAInaChatWidget />
      <BottomNav />
    </div>
  );
}
