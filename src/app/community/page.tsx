'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, MessageSquare, MapPin, PlusCircle, Users, CheckCircle2, ShieldCheck, ShieldAlert, GitFork, Filter, CalendarDays, Sparkles } from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

interface CommunityTripPost {
  id: string;
  author_id?: string;
  author_name: string;
  author_avatar: string;
  trust_score?: string;
  author_trust_score?: number;
  destination: string;
  duration: string;
  budget_est: string;
  trip_style: string[];
  is_identity_verified: boolean;
  is_trip_completed: boolean;
  is_demo?: boolean;
  location: string;
  image_url: string;
  content: string;
  likes_count: number;
  comments_count: number;
  compatibility_score?: number | null;
  compatibility_level?: string | null;
  has_dealbreaker?: boolean;
  compatibility_explanation?: string | null;
  shared_interests?: string[];
}

export default function CommunityPage() {
  const router = useRouter();
  const { setCoins } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'trips' | 'companions'>('trips');
  const [selectedVibeFilter, setSelectedVibeFilter] = useState<string>('All');
  const [dynamicPosts, setDynamicPosts] = useState<any[]>([]);
  const [userTrips, setUserTrips] = useState<any[]>([]);
  const [selectedSourceTripId, setSelectedSourceTripId] = useState<string>('');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // New post form state
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80');

  // Request to Join / Companion Interest State
  const [interestTrip, setInterestTrip] = useState<any | null>(null);
  const [interestMessage, setInterestMessage] = useState('');
  const [isInterestSubmitting, setIsInterestSubmitting] = useState(false);
  const [interestSuccess, setInterestSuccess] = useState<string | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);

  const loadFeed = async () => {
    try {
      const feed = await apiService.getCommunityFeed();
      if (feed && feed.length > 0) {
        setDynamicPosts(feed);
      }
    } catch (err) {
      console.error('Failed to load community feed:', err);
    }
    try {
      const tripsData = await apiService.getMyTrips();
      if (tripsData && tripsData.length > 0) {
        setUserTrips(tripsData);
      }
    } catch {
      // not logged in or offline
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPublishModalOpen) setIsPublishModalOpen(false);
        if (interestTrip) setInterestTrip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPublishModalOpen, interestTrip]);

  const handleOpenInterestModal = (trip: any) => {
    setInterestTrip(trip);
    setInterestMessage('');
    setInterestSuccess(null);
    setInterestError(null);
  };

  const handleInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interestTrip) return;
    const targetTripId = interestTrip.source_trip_id || interestTrip.id;
    if (!targetTripId) {
      setInterestError('Invalid trip reference.');
      return;
    }

    setIsInterestSubmitting(true);
    setInterestError(null);
    setInterestSuccess(null);

    try {
      await apiService.expressTripInterest(targetTripId, interestMessage);
      setInterestSuccess(
        `Your application has been submitted to ${interestTrip.author_name || 'the trip host'}! They will review your compatibility profile and notify you once approved into the Squad.`
      );
    } catch (err: any) {
      console.error('Failed to express interest:', err);
      setInterestError(
        err?.detail || err?.message || 'Could not submit interest application. Please ensure you are logged in.'
      );
    } finally {
      setIsInterestSubmitting(false);
    }
  };

  const [likes, setLikes] = useState<{ [key: string]: number }>({
    trip_1: 42,
    trip_2: 128,
  });
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [connectedUsers, setConnectedUsers] = useState<{ [key: string]: boolean }>({});
  const [forkedPosts, setForkedPosts] = useState<{ [key: string]: boolean }>({});

  const filterCategories = ['All', 'Culture & Heritage', 'Food & Dining', 'Coastal Escapes', 'Nature & Mountains'];

  const handleLike = async (postId: string, initialLikes: number = 0) => {
    if (likedPosts[postId]) return;
    try {
      await apiService.likeCommunityPost(postId);
      // Update state without unbacked local coin inflation
      setLikedPosts((prev) => ({ ...prev, [postId]: true }));
      setLikes((prev) => {
        const current = prev[postId] !== undefined ? prev[postId] : initialLikes;
        return { ...prev, [postId]: current + 1 };
      });
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const handleUsePlan = (trip: any) => {
    const params = new URLSearchParams();
    const targetSourceId = trip.source_trip_id || trip.id;
    if (targetSourceId) params.set('source_trip_id', String(targetSourceId));
    if (targetSourceId === 'trip_1' || targetSourceId === 'trip_2') {
      params.set('demo', 'true');
    }
    if (trip.destination) params.set('destination', trip.destination);
    if (trip.duration) {
      const days = trip.duration.replace(/\D/g, '');
      if (days) params.set('duration', days);
    }
    if (trip.budget_est) {
      const rawBudget = trip.budget_est.replace(/[^0-9]/g, '');
      if (rawBudget) params.set('budget', rawBudget.length <= 3 ? `${rawBudget}000` : rawBudget);
    }
    if (trip.trip_style && trip.trip_style.length > 0) {
      params.set('vibe', trip.trip_style[0].toLowerCase());
      params.set('interests', trip.trip_style.join(','));
    }
    if (trip.author_name) {
      params.set('author', trip.author_name);
    }
    params.set('adapt', 'true');
    params.set('query', `Adapt ${trip.author_name}'s itinerary for ${trip.destination} with optimal pacing and activities`);
    router.push(`/planner?${params.toString()}`);
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocation.trim() || !newContent.trim()) return;

    setIsSubmitting(true);
    setPublishError(null);
    try {
      const res = await apiService.createCommunityPost({
        getaway_title: newTitle,
        location: newLocation,
        content: newContent,
        image_url: newImage,
        companions_needed: 0,
        source_trip_id: selectedSourceTripId || undefined,
      });

      if (res && res.status === 'published') {
        if (typeof res.total_coins === 'number') {
          setCoins(res.total_coins);
        }
        setIsPublishModalOpen(false);
        setNewTitle('');
        setNewLocation('');
        setNewContent('');
        setSelectedSourceTripId('');
        await loadFeed();
      } else {
        setPublishError('Could not publish your trip. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to publish post:', err);
      setPublishError(err?.detail || err?.message || 'Unable to connect to community services. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnect = (compId: string) => {
    setConnectedUsers((prev) => ({ ...prev, [compId]: !prev[compId] }));
    // No unearned coin reward until actual server-side squad invitation is confirmed
  };

  const defaultTrips: CommunityTripPost[] = [
    {
      id: 'trip_1',
      author_name: 'Rohan Sharma',
      author_avatar: 'R',
      destination: 'Kyoto & Uji',
      duration: '6 days',
      budget_est: '₹72k est.',
      trip_style: ['Culture', 'Food', 'Photography'],
      is_identity_verified: false,
      is_trip_completed: true,
      is_demo: true,
      location: 'Kyoto, Japan',
      content: 'Best 6-day food and photography itinerary I’ve ever done. Early morning Fushimi Inari with zero crowds, followed by Nishiki Market matcha crawls and sunset walks in Gion.',
      image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80',
      likes_count: 42,
      comments_count: 8,
    },
    {
      id: 'trip_2',
      author_name: 'Ananya Verma',
      author_avatar: 'A',
      destination: 'South Goa Sanctuaries',
      duration: '4 days',
      budget_est: '₹28k est.',
      trip_style: ['Coastal', 'Seafood', 'Relaxed'],
      is_identity_verified: false,
      is_trip_completed: true,
      is_demo: true,
      location: 'Palolem & Agonda, Goa',
      content: 'Skipped the crowded northern beaches for quiet cliffside cafes and sunset kayaking. Perfect slow-paced escape with authentic Goan thali spots.',
      image_url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80',
      likes_count: 128,
      comments_count: 14,
    },
  ];

  const companions = [
    {
      id: 'comp_1',
      name: 'Vikram Sethi',
      destination: 'Rishikesh & Garhwal',
      dates: 'Oct 18 – 22',
      interests: ['Hiking', 'Photography', 'Backpacking'],
      is_identity_verified: false,
      is_trip_completed: true,
      is_demo: true,
      style: 'Mountain Treks',
    },
    {
      id: 'comp_2',
      name: 'Priya Nair',
      destination: 'Gokarna & Coastal Karnataka',
      dates: 'Oct 25 – 28',
      interests: ['Culture', 'Cafe Hopping', 'Coast'],
      is_identity_verified: false,
      is_trip_completed: true,
      is_demo: true,
      style: 'Slow Travel',
    },
  ];

  const allTrips = dynamicPosts.length > 0
    ? dynamicPosts.map((p) => ({
        id: p.id,
        source_trip_id: p.source_trip_id || p.id,
        author_name: p.author_name,
        author_avatar: p.author_name ? p.author_name.charAt(0) : 'E',
        destination: p.getaway_title || p.location,
        duration: p.duration || 'Flexible',
        budget_est: p.budget_est || 'Shared budget',
        trip_style: Array.isArray(p.trip_style) && p.trip_style.length > 0 ? p.trip_style : ['Travel Story'],
        is_identity_verified: Boolean(p.is_identity_verified),
        is_trip_completed: Boolean(p.is_trip_completed),
        is_demo: false,
        location: p.location,
        content: p.content,
        image_url: p.image_url,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        compatibility_score: p.compatibility_score,
        compatibility_level: p.compatibility_level,
        has_dealbreaker: Boolean(p.has_dealbreaker),
        compatibility_explanation: p.compatibility_explanation,
        shared_interests: p.shared_interests || [],
      }))
    : defaultTrips;

  const tripsToUse = useMemo(() => {
    if (!selectedVibeFilter || selectedVibeFilter === 'All') return allTrips;

    return allTrips.filter((t) => {
      const combined = [
        ...(Array.isArray(t.trip_style) ? t.trip_style : []),
        t.destination,
        t.location,
        t.content,
      ].join(' ').toLowerCase();

      if (selectedVibeFilter === 'Culture & Heritage') {
        return combined.includes('culture') || combined.includes('heritage') || combined.includes('historic') || combined.includes('temple');
      }
      if (selectedVibeFilter === 'Food & Dining') {
        return combined.includes('food') || combined.includes('dining') || combined.includes('market') || combined.includes('cafe') || combined.includes('seafood') || combined.includes('matcha');
      }
      if (selectedVibeFilter === 'Coastal Escapes') {
        return combined.includes('coastal') || combined.includes('beach') || combined.includes('sea') || combined.includes('cliff') || combined.includes('ocean');
      }
      if (selectedVibeFilter === 'Nature & Mountains') {
        return combined.includes('nature') || combined.includes('mountain') || combined.includes('pine') || combined.includes('chalet') || combined.includes('lake') || combined.includes('trek');
      }
      return true;
    });
  }, [allTrips, selectedVibeFilter]);

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900 tracking-tight">
              Community Itineraries
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Trips and travel stories shared by the community. Use them directly or adapt them to your schedule.
            </p>
          </div>

          <Button
            onClick={() => setIsPublishModalOpen(true)}
            variant="primary"
            size="sm"
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shrink-0 cursor-pointer shadow-2xs"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            <span>Share Your Trip</span>
          </Button>
        </div>

        {/* Tab Switcher: Shared Trips vs Squad Companions */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 max-w-xs">
          <button
            onClick={() => setActiveTab('trips')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'trips'
                ? 'bg-white text-orange-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Shared Trips
          </button>
          <button
            onClick={() => setActiveTab('companions')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'companions'
                ? 'bg-white text-orange-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Travel Companions</span>
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {filterCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedVibeFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
                selectedVibeFilter === cat
                  ? 'bg-orange-600 text-white shadow-2xs font-semibold'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* TRIPS TAKEN FEED */}
        {activeTab === 'trips' && (
          <div className="space-y-6">
            {tripsToUse.map((trip) => (
              <Card key={trip.id} className="p-5 sm:p-6 space-y-4 rounded-3xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
                {/* Author & Transparent Trust Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 text-xs">
                      {trip.author_avatar}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{trip.author_name}</h3>
                      {/* Honest Trust Badges */}
                      <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-500">
                        {trip.is_demo && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px] font-bold border border-slate-200 uppercase">
                            DEMO
                          </span>
                        )}
                        {trip.is_identity_verified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Identity verified
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">
                            Community Explorer
                          </span>
                        )}
                        <span>•</span>
                        {trip.is_trip_completed ? (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Trip completed
                          </span>
                        ) : (
                          <span className="text-slate-400">Travel Story</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trip Style Tags & AI Compatibility Badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {trip.trip_style.map((st: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-medium">
                          {st}
                        </span>
                      ))}
                    </div>

                    {/* Deterministic Compatibility Badge */}
                    {trip.compatibility_score !== undefined && trip.compatibility_score !== null && (
                      <div className="shrink-0">
                        {trip.has_dealbreaker ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                            <ShieldAlert className="w-3 h-3 text-rose-500" />
                            <span>{trip.compatibility_score}% Dealbreaker Conflict</span>
                          </span>
                        ) : trip.compatibility_score >= 80 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold shadow-2xs">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>{trip.compatibility_score}% Match • High Resonance</span>
                          </span>
                        ) : trip.compatibility_score >= 60 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold">
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            <span>{trip.compatibility_score}% Match</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
                            <span>{trip.compatibility_score}% Match</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Destination & Budget Bar */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    <span className="font-serif-editorial font-bold text-slate-900 text-base">
                      {trip.destination}
                    </span>
                    <span className="text-xs text-slate-500">• {trip.duration}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-800">
                    {trip.budget_est}
                  </span>
                </div>

                {/* Explainable Compatibility Reason */}
                {trip.compatibility_explanation && (
                  <div
                    className={`p-2.5 rounded-2xl border text-xs flex items-start gap-2 ${
                      trip.has_dealbreaker
                        ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                        : trip.compatibility_score && trip.compatibility_score >= 80
                        ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
                        : 'bg-slate-50 border-slate-200/80 text-slate-800'
                    }`}
                  >
                    <Sparkles
                      className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                        trip.has_dealbreaker
                          ? 'text-rose-500'
                          : trip.compatibility_score && trip.compatibility_score >= 80
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                      }`}
                    />
                    <div className="space-y-1">
                      <p className="text-[11px] leading-relaxed font-medium">
                        {trip.compatibility_explanation}
                      </p>
                      {trip.shared_interests && trip.shared_interests.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] text-slate-500 font-medium">Shared Passions:</span>
                          {trip.shared_interests.map((interest: string, i: number) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 rounded bg-white/80 border border-slate-200/60 text-[10px] text-slate-700 font-medium"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                  {trip.content}
                </p>

                {/* Image */}
                <div className="relative h-64 rounded-2xl overflow-hidden border border-slate-200">
                  <Image src={trip.image_url} alt={trip.destination} fill className="object-cover" />
                </div>

                {/* Action Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleLike(trip.id, trip.likes_count)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        likedPosts[trip.id]
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${likedPosts[trip.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{likes[trip.id] !== undefined ? likes[trip.id] : trip.likes_count}</span>
                    </button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUsePlan(trip)}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      <span>Adapt this itinerary →</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenInterestModal(trip)}
                      className="bg-white hover:bg-orange-50 border-orange-200 text-orange-700 hover:text-orange-900 font-semibold text-xs shadow-2xs cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 mr-1 text-orange-600" />
                      <span>Request to Join</span>
                    </Button>
                  </div>

                  <span className="text-[11px] text-slate-400 font-medium select-none">
                    {trip.comments_count ? `${trip.comments_count} notes & tips` : 'Traveler notes'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* TRAVEL COMPANIONS TAB */}
        {activeTab === 'companions' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {companions.map((comp) => (
                <Card key={comp.id} className="p-5 flex flex-col justify-between space-y-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 text-sm">{comp.name}</h3>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Identity verified
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-orange-500" />
                      <span>Heading to {comp.destination} ({comp.dates})</span>
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {comp.interests.map((int, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200">
                          {int}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <Button
                      variant={connectedUsers[comp.id] ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full text-xs font-semibold cursor-pointer"
                      onClick={() => handleConnect(comp.id)}
                    >
                      {connectedUsers[comp.id] ? '✓ Invitation Sent' : 'Invite to a trip'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Share Trip Modal */}
      {isPublishModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="share-modal-title" className="font-serif-editorial font-bold text-slate-900 text-lg">
                  Share Your Trip Itinerary
                </h3>
                <p className="text-xs text-slate-500">Help other travelers discover secret spots and authentic paces.</p>
              </div>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                aria-label="Close share dialog"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {publishError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between">
                <span>⚠️ {publishError}</span>
                <button
                  type="button"
                  onClick={() => setPublishError(null)}
                  className="text-amber-700 font-bold hover:text-amber-950 px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handlePublishSubmit} className="space-y-3.5 text-xs font-semibold text-slate-700">
              {userTrips.length > 0 && (
                <div className="space-y-1">
                  <label className="text-slate-900 font-bold flex items-center justify-between">
                    <span>Link to your DashTiny trip</span>
                    <span className="text-[10px] text-orange-600 font-normal">Enables community adaptation</span>
                  </label>
                  <select
                    value={selectedSourceTripId}
                    onChange={(e) => {
                      const tripId = e.target.value;
                      setSelectedSourceTripId(tripId);
                      const matched = userTrips.find((t) => t.id === tripId);
                      if (matched) {
                        setNewTitle(matched.title || `Trip to ${matched.destination}`);
                        setNewLocation(matched.destination || '');
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                  >
                    <option value="">-- Choose one of your trips (Optional) --</option>
                    {userTrips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.destination}) · {t.startDate}
                      </option>
                    ))}
                  </select>

                  {selectedSourceTripId && (
                    <div className="p-3 rounded-xl bg-orange-50/80 border border-orange-200 text-[11px] text-slate-700 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-orange-950">
                        <ShieldCheck className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span>This will publish your itinerary publicly to the community</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-900 block">Publicly Visible:</span>
                          <p className="text-emerald-700 font-medium">✓ Destination &amp; dates</p>
                          <p className="text-emerald-700 font-medium">✓ Daily itinerary stops &amp; pacing</p>
                          <p className="text-emerald-700 font-medium">✓ Estimated total budget</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-900 block">Strictly Private:</span>
                          <p className="text-slate-600">🔒 Confirmed booking references</p>
                          <p className="text-slate-600">🔒 Tickets &amp; personal documents</p>
                          <p className="text-slate-600">🔒 Squad expenses &amp; split ledgers</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label>Trip Title / Destination</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5 Days in Kyoto & Uji for Food and Photography"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label>Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kyoto, Japan"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label>Cover Photo URL</label>
                <input
                  type="url"
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label>Trip Story & Recommendations</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your daily flow, highlights, best meals, and tips for fellow travelers..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 py-2 text-xs font-semibold cursor-pointer"
                  onClick={() => setIsPublishModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Trip'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Show Interest / Request to Join Squad Modal */}
      {interestTrip && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="interest-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="interest-modal-title" className="font-serif-editorial font-bold text-slate-900 text-lg">
                  Request to Join Squad
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Heading to {interestTrip.destination} • Hosted by {interestTrip.author_name}
                </p>
              </div>
              <button
                onClick={() => setInterestTrip(null)}
                aria-label="Close dialog"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* AI Compatibility Preview Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">AI Compatibility Radar</span>
                {interestTrip.has_dealbreaker ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                    <ShieldAlert className="w-3 h-3 text-rose-500" />
                    Dealbreaker Conflict
                  </span>
                ) : interestTrip.compatibility_score !== undefined && interestTrip.compatibility_score !== null ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    {interestTrip.compatibility_score}% Match
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">Curated Match</span>
                )}
              </div>

              {interestTrip.compatibility_explanation && (
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {interestTrip.compatibility_explanation}
                </p>
              )}

              {interestTrip.shared_interests && interestTrip.shared_interests.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-500 font-medium">Shared Passions:</span>
                  {interestTrip.shared_interests.map((st: string, idx: number) => (
                    <span key={idx} className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[10px] text-slate-700 font-medium">
                      {st}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {interestSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-medium">{interestSuccess}</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setInterestTrip(null)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer"
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleInterestSubmit} className="space-y-3.5 text-xs font-semibold text-slate-700">
                {interestError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between">
                    <span>⚠️ {interestError}</span>
                    <button
                      type="button"
                      onClick={() => setInterestError(null)}
                      className="text-amber-700 font-bold hover:text-amber-950 px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-slate-900 font-bold block">
                    Message to {interestTrip.author_name}
                  </label>
                  <p className="text-[11px] text-slate-500 font-normal">
                    Mention your travel style, what you are excited to do in {interestTrip.destination}, and why you want to explore together.
                  </p>
                  <textarea
                    rows={4}
                    required
                    placeholder="Hi! I saw your itinerary for Kyoto. I love photography and matcha cafes too, and I prefer a relaxed, steady pace. Would love to join the squad!"
                    value={interestMessage}
                    onChange={(e) => setInterestMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 py-2 text-xs font-semibold cursor-pointer"
                    onClick={() => setInterestTrip(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isInterestSubmitting}
                    className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
                  >
                    {isInterestSubmitting ? 'Sending Request...' : 'Send Request to Join'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <DAInaChatWidget />
      <BottomNav />
    </div>
  );
}
