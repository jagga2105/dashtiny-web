'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, MessageSquare, MapPin, PlusCircle, Users, CheckCircle2, ShieldCheck, GitFork, Filter, CalendarDays, Sparkles } from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

interface CommunityTripPost {
  id: string;
  author_name: string;
  author_avatar: string;
  destination: string;
  duration: string;
  budget_est: string;
  trip_style: string[];
  is_identity_verified: boolean;
  is_trip_completed: boolean;
  location: string;
  image_url: string;
  content: string;
  likes_count: number;
  comments_count: number;
}

export default function CommunityPage() {
  const router = useRouter();
  const { updateCoins } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'trips' | 'companions'>('trips');
  const [selectedVibeFilter, setSelectedVibeFilter] = useState<string>('All');
  const [dynamicPosts, setDynamicPosts] = useState<any[]>([]);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // New post form state
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80');

  const loadFeed = async () => {
    try {
      const feed = await apiService.getCommunityFeed();
      if (feed && feed.length > 0) {
        setDynamicPosts(feed);
      }
    } catch (err) {
      console.error('Failed to load community feed:', err);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPublishModalOpen) {
        setIsPublishModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPublishModalOpen]);

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
      // Only mutate state and award coins on verified server confirmation
      setLikedPosts((prev) => ({ ...prev, [postId]: true }));
      setLikes((prev) => {
        const current = prev[postId] !== undefined ? prev[postId] : initialLikes;
        return { ...prev, [postId]: current + 1 };
      });
      updateCoins(5);
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const handleUsePlan = (trip: any) => {
    const params = new URLSearchParams();
    params.set('destination', trip.destination);
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
    }
    params.set('query', `Plan a trip to ${trip.destination} inspired by ${trip.author_name}'s itinerary: ${trip.content.slice(0, 100)}`);
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
      });

      if (res && res.status === 'published') {
        updateCoins(20);
        setIsPublishModalOpen(false);
        setNewTitle('');
        setNewLocation('');
        setNewContent('');
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
    setConnectedUsers({ ...connectedUsers, [compId]: true });
    updateCoins(10);
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
      is_identity_verified: true,
      is_trip_completed: true,
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
      is_identity_verified: true,
      is_trip_completed: true,
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
      is_identity_verified: true,
      is_trip_completed: true,
      style: 'Mountain Treks',
    },
    {
      id: 'comp_2',
      name: 'Priya Nair',
      destination: 'Gokarna & Coastal Karnataka',
      dates: 'Oct 25 – 28',
      interests: ['Culture', 'Cafe Hopping', 'Coast'],
      is_identity_verified: true,
      is_trip_completed: true,
      style: 'Slow Travel',
    },
  ];

  const tripsToUse = dynamicPosts.length > 0
    ? dynamicPosts.map((p) => ({
        id: p.id,
        author_name: p.author_name,
        author_avatar: p.author_name ? p.author_name.charAt(0) : 'E',
        destination: p.getaway_title || p.location,
        duration: p.duration || 'Flexible',
        budget_est: p.budget_est || 'Shared budget',
        trip_style: Array.isArray(p.trip_style) ? p.trip_style : ['Travel Story'],
        is_identity_verified: Boolean(p.is_identity_verified),
        is_trip_completed: Boolean(p.is_trip_completed),
        location: p.location,
        content: p.content,
        image_url: p.image_url,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
      }))
    : defaultTrips;

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
            Trips Taken
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
                        {trip.is_identity_verified && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Identity verified
                          </span>
                        )}
                        <span>•</span>
                        {trip.is_trip_completed && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Trip completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trip Style Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {trip.trip_style.map((st: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-medium">
                        {st}
                      </span>
                    ))}
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
                      <span>Use as starting point →</span>
                    </Button>
                  </div>

                  <span className="text-xs text-slate-400">
                    {trip.comments_count} comments
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

      <DAInaChatWidget />
      <BottomNav />
    </div>
  );
}
