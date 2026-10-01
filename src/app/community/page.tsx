'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, MessageSquare, Coins, MapPin, PlusCircle, Users, UserCheck, Sparkles, Award, ShieldCheck, GitFork, Filter } from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

interface CommunityPostItem {
  id: string;
  author_name: string;
  author_avatar: string;
  trust_score: string;
  getaway_title: string;
  location: string;
  image_url: string;
  content: string;
  likes_count: number;
  companions_needed: number;
}

export default function CommunityPage() {
  const router = useRouter();
  const { updateCoins } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'stories' | 'companions'>('stories');
  const [selectedVibeFilter, setSelectedVibeFilter] = useState<string>('All Vibes');
  const [dynamicPosts, setDynamicPosts] = useState<CommunityPostItem[]>([]);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New post form state
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80');
  const [newCompanions, setNewCompanions] = useState(2);

  const loadFeed = async () => {
    const feed = await apiService.getCommunityFeed();
    if (feed && feed.length > 0) {
      setDynamicPosts(feed);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const [likes, setLikes] = useState<{ [key: string]: number }>({
    post_1: 42,
    post_2: 128,
  });
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [connectedUsers, setConnectedUsers] = useState<{ [key: string]: boolean }>({});
  const [forkedPosts, setForkedPosts] = useState<{ [key: string]: boolean }>({});

  const vibeCategories = ['All Vibes', 'Beach Chiller', 'Roadtripper', 'Tech Nomad', 'Culture Seeker'];

  const handleLike = async (postId: string) => {
    if (!likedPosts[postId]) {
      setLikedPosts((prev) => ({ ...prev, [postId]: true }));
      setLikes((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
      updateCoins(5);
      await apiService.likeCommunityPost(postId);
    }
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocation.trim() || !newContent.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await apiService.createCommunityPost({
        getaway_title: newTitle,
        location: newLocation,
        content: newContent,
        image_url: newImage,
        companions_needed: newCompanions,
      });

      if (res && res.status === 'published') {
        updateCoins(20);
        setIsPublishModalOpen(false);
        setNewTitle('');
        setNewLocation('');
        setNewContent('');
        await loadFeed();
      }
    } catch (err) {
      console.error('Failed to publish post:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnect = (compId: string) => {
    setConnectedUsers({ ...connectedUsers, [compId]: true });
    updateCoins(10);
  };

  const handleForkItinerary = (postId: string) => {
    setForkedPosts({ ...forkedPosts, [postId]: true });
    updateCoins(50);
    setTimeout(() => {
      router.push('/planner');
    }, 800);
  };

  const defaultMockPosts = [
    {
      id: 'post_1',
      author: 'Rohan Sharma',
      avatar: 'R',
      vibeTag: 'Roadtripper',
      isVerified: true,
      trustScore: '98% Verified Explorer',
      location: 'Nandi Hills Sunrise, Bengaluru',
      time: '2 hours ago',
      content: 'Early 5 AM drive to Nandi Hills! The fog and cloud bed view from the cliff top is unreal. Generated the full itinerary via Dashtiny AI.',
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=700&auto=format&fit=crop&q=80',
      earnedCoins: 20,
    },
    {
      id: 'post_2',
      author: 'Ananya Verma',
      avatar: 'A',
      vibeTag: 'Tech Nomad',
      isVerified: true,
      trustScore: '96% Verified Explorer',
      location: 'Indiranagar Craft Brewery Crawl',
      time: '5 hours ago',
      content: 'Checked out Toit and Arbor Brewing Company in Indiranagar. Super cool vibe and amazing artisanal brews. Highly recommend adding this to your itinerary!',
      image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=700&auto=format&fit=crop&q=80',
      earnedCoins: 15,
    },
  ];

  const companions = [
    {
      id: 'comp_1',
      name: 'Vikram Sethi',
      vibeTag: 'Roadtripper',
      isVerified: true,
      trustScore: '96% Verified Explorer',
      interests: ['Hiking', 'Photography', 'Backpacking'],
      destination: 'Uttarakhand / Rishikesh',
      dates: 'Aug 18 - Aug 22',
      matchScore: '96% AI Match',
      isOnline: true,
    },
    {
      id: 'comp_2',
      name: 'Priya Nair',
      vibeTag: 'Culture Seeker',
      isVerified: true,
      trustScore: '94% Verified Explorer',
      interests: ['Foodie', 'Cafe Hopping', 'Culture'],
      destination: 'Bengaluru / Gokarna',
      dates: 'Aug 25 - Aug 28',
      matchScore: '92% AI Match',
      isOnline: true,
    },
    {
      id: 'comp_3',
      name: 'Kabir Mehta',
      vibeTag: 'Tech Nomad',
      isVerified: true,
      trustScore: '98% Verified Explorer',
      interests: ['Co-Working', 'Surfing', 'Nightlife'],
      destination: 'North Goa / Anjuna',
      dates: 'Sep 01 - Sep 05',
      matchScore: '98% AI Match',
      isOnline: true,
    },
  ];

  const postsToUse = dynamicPosts.length > 0
    ? dynamicPosts.map((p) => ({
        id: p.id,
        author: p.author_name,
        avatar: p.author_name.charAt(0),
        vibeTag: 'Getaway Explorer',
        isVerified: true,
        trustScore: p.trust_score,
        location: p.location,
        time: 'Just now',
        content: p.content,
        image: p.image_url,
        earnedCoins: p.likes_count || 50,
        squadCompanionsNeeded: p.companions_needed,
      }))
    : defaultMockPosts;

  const filteredPosts = selectedVibeFilter === 'All Vibes'
    ? postsToUse
    : postsToUse.filter((p) => p.vibeTag === selectedVibeFilter);

  const filteredCompanions = companions.filter(
    (c) => selectedVibeFilter === 'All Vibes' || c.vibeTag === selectedVibeFilter
  );

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#F8FAFC] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-extrabold tracking-wider uppercase">
              <Award className="w-3.5 h-3.5 text-orange-600" />
              <span>DASHTINY EXPLORER COMMUNITY</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif-editorial font-bold text-slate-900 tracking-tight">
              Getaway Moments & Squad Match
            </h1>
            <p className="text-xs text-slate-600 font-medium">Share secret getaway spots & pair with verified solo explorers</p>
          </div>

          <Button
            onClick={() => setIsPublishModalOpen(true)}
            variant="primary"
            size="md"
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shrink-0 shadow-md cursor-pointer hover:scale-105 transition-transform"
          >
            <PlusCircle className="w-4 h-4 mr-1 text-white" />
            <span>Publish Moment (+20 Coins)</span>
          </Button>
        </div>

        {/* Vibe Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-orange-500" /> Vibe:
          </span>
          {vibeCategories.map((vibe) => (
            <button
              key={vibe}
              onClick={() => setSelectedVibeFilter(vibe)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold shrink-0 transition-all ${
                selectedVibeFilter === vibe
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/90'
              }`}
            >
              {vibe}
            </button>
          ))}
        </div>

        {/* Community Navigation Switcher Tabs */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm max-w-md">
          <button
            onClick={() => setActiveTab('stories')}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all ${
              activeTab === 'stories'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Getaway Moments
          </button>
          <button
            onClick={() => setActiveTab('companions')}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'companions'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Solo Squad Match</span>
          </button>
        </div>

        {/* Creator Incentives Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-sky-500/10 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-xs text-slate-800 font-bold">
              <strong className="text-orange-700">Creator Rewards:</strong> Earn +50 Gold Coins every time an explorer uses your trip template!
            </p>
          </div>
          <span className="text-[10px] font-extrabold text-orange-700 uppercase tracking-widest bg-white px-2.5 py-1 rounded-full border border-orange-200 shrink-0">
            Explorer Level 3
          </span>
        </div>

        {/* Stories Tab */}
        {activeTab === 'stories' && (
          <div className="space-y-6">
            {filteredPosts.map((post) => (
              <Card key={post.id} className="editorial-card p-6 space-y-4 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:border-orange-300 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 p-0.5 shadow-md">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-extrabold text-orange-600 text-xs">
                        {post.avatar}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                        {post.author}
                        {post.isVerified && (
                          <span title={post.trustScore}>
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-orange-600 flex items-center gap-1 font-bold">
                        <MapPin className="w-3 h-3 text-orange-500" />
                        {post.location} • <span className="text-slate-400">{post.vibeTag}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{post.time}</span>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed font-medium">{post.content}</p>

                <div className="relative h-72 rounded-2xl overflow-hidden border border-slate-200">
                  <Image src={post.image} alt={post.location} fill className="object-cover" />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all ${
                        likedPosts[post.id]
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${likedPosts[post.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{likes[post.id]} Likes</span>
                    </button>

                    <button
                      onClick={() => handleForkItinerary(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-1.5 rounded-xl transition-all ${
                        forkedPosts[post.id]
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                      }`}
                    >
                      <GitFork className="w-3.5 h-3.5 text-orange-600" />
                      <span>{forkedPosts[post.id] ? 'Loaded to Planner (+50 Gold)!' : 'Use This Trip →'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <span>8 Comments</span>
                    </span>
                    <span className="flex items-center gap-1 text-orange-600 font-extrabold">
                      <Coins className="w-3.5 h-3.5 text-orange-500" />
                      <span>+{post.earnedCoins} Coins</span>
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Find Companion Tab */}
        {activeTab === 'companions' && (
          <div className="space-y-6">
            <Card className="p-6 bg-gradient-to-r from-orange-50 via-white to-sky-50 border border-orange-200/90 space-y-2 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <span className="font-extrabold text-slate-900 text-base">DAIna AI Squad Matcher</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Algorithms match verified solo explorers heading to the same getaway destination during matching dates.
              </p>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filteredCompanions.map((comp) => (
                <Card key={comp.id} className="editorial-card p-6 flex flex-col justify-between space-y-4 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:border-orange-300 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                        {comp.name}
                        {comp.isVerified && (
                          <span title={comp.trustScore}>
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          </span>
                        )}
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200">
                        {comp.matchScore}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-orange-500" />
                      Heading to {comp.destination} ({comp.dates})
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200 font-extrabold">
                        ★ {comp.vibeTag}
                      </span>
                      {comp.interests.map((int, i) => (
                        <span key={i} className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200 font-medium">
                          ✓ {int}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <Button
                      variant={connectedUsers[comp.id] ? 'accent' : 'primary'}
                      size="sm"
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-sm"
                      onClick={() => handleConnect(comp.id)}
                    >
                      {connectedUsers[comp.id] ? (
                        <span className="flex items-center justify-center gap-1">
                          <UserCheck className="w-4 h-4 text-white" /> Connected to Squad!
                        </span>
                      ) : (
                        'Connect & Plan Together (+10 Coins)'
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Publish Moment Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-editorial font-bold text-slate-900 text-lg">Share Getaway Story</h3>
                  <p className="text-[11px] text-slate-500">Earn +20 Gold Coins directly into your Rewards Vault</p>
                </div>
              </div>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1.5">
                <label>Story Title / Experience</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunset Kayaking & Cliffside Cafe in Palolem"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label>Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. South Goa, India"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label>Companions Needed</label>
                  <select
                    value={newCompanions}
                    onChange={(e) => setNewCompanions(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                  >
                    <option value={0}>Solo (Just sharing)</option>
                    <option value={1}>1 Solo Explorer</option>
                    <option value={2}>2 Companions</option>
                    <option value={4}>Squad (4+ Explorers)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label>Cover Photo URL</label>
                <input
                  type="url"
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label>Insider Tips & Story</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Share details on crowd timings, secret trails, best food, and costs..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-900 text-xs"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 py-2.5 text-xs font-bold"
                  onClick={() => setIsPublishModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-md"
                >
                  {isSubmitting ? 'Publishing to DB...' : 'Publish Moment (+20 Gold)'}
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

