'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Sparkles,
  ShieldCheck,
  Luggage,
  Heart,
  ThumbsDown,
  Clock,
  Compass,
  Utensils,
  Bed,
  Car,
  Users,
  Save,
  Check,
  Plus,
  X,
  AlertCircle,
  MapPin,
  Coins,
  ArrowRight
} from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { apiService, TravelerProfile, UpdateProfilePayload } from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';

// Preset options for quick chip selection
const PRESET_LIKES = [
  'Sunset Overlooks',
  'Coastal Walks',
  'Fresh Seafood',
  'Specialty Coffee',
  'Hidden Waterfalls',
  'Ancient Ruins',
  'Art Galleries',
  'Live Acoustic Music',
  'Scuba Diving',
  'Street Food Night Markets',
  'Boutique Craft Shops',
  'Panoramic Mountain Viewpoints'
];

const PRESET_DISLIKES = [
  'Crowded Temples & Pilgrimages',
  'Noisy Nightclubs',
  'Early 6 AM Wakeups',
  'Commercial Shopping Malls',
  'Overpriced Tourist Traps',
  'Long Highway Bus Rides',
  'Buffet Dining',
  'Extreme Heat Activities',
  'Strenuous Uphill Treks'
];

const TRAVEL_STYLES = [
  { id: 'solo', label: 'Solo Explorer', desc: 'Independent discovery, flexible schedule, meetups' },
  { id: 'couple', label: 'Romantic & Couple', desc: 'Intimate stays, sunset dining, scenic walks' },
  { id: 'family', label: 'Family Friendly', desc: 'Comfortable transit, spacious stays, kid-safe stops' },
  { id: 'squad', label: 'Squad & Friends', desc: 'Group villas, shared bills, shared adventures' },
  { id: 'nomad', label: 'Digital Nomad', desc: 'Reliable WiFi, work cafes, balanced pacing' },
  { id: 'adventure', label: 'Adventure Seeker', desc: 'Hiking, water sports, rugged scenic exploration' },
  { id: 'luxury', label: 'Luxury & Wellness', desc: '5-star resorts, private cab transfers, curated dining' },
  { id: 'backpacker', label: 'Backpacker', desc: 'Hostels, local transport, budget optimization' }
];

const PACES = [
  {
    id: 'relaxed',
    label: 'Relaxed & Unhurried',
    time: '10:00 AM start',
    stops: '2-3 stops/day',
    desc: 'Plenty of breathing room, leisurely 90m meals, twilight downtime.'
  },
  {
    id: 'balanced',
    label: 'Balanced Harmony',
    time: '09:00 AM start',
    stops: '3-4 stops/day',
    desc: 'Ideal mix of iconic sightseeing, curated food, and relaxed afternoons.'
  },
  {
    id: 'packed',
    label: 'Packed & Fast-Paced',
    time: '08:00 AM start',
    stops: '5-6 stops/day',
    desc: 'High-density exploration, sunrise starts, seeing as much as possible.'
  }
];

const ACCOMMODATIONS = [
  { id: 'boutique', label: 'Boutique Hotel / Heritage Stay' },
  { id: 'luxury', label: 'Luxury Resort & Spa' },
  { id: 'comfort', label: 'Comfort 3-4★ Hotel' },
  { id: 'villa', label: 'Private Villa / Homestay' },
  { id: 'hostel', label: 'Social Hostel' },
  { id: 'budget', label: 'Clean Budget Stay' }
];

const TRANSPORTS = [
  { id: 'mix', label: 'Optimal Mix (Walk + Cab)' },
  { id: 'scooter', label: 'Scooter / Bike Rental' },
  { id: 'rental_car', label: 'Self-Drive Car' },
  { id: 'cab', label: 'Private Cab & Taxis' },
  { id: 'public_transit', label: 'Public Transit (Metro / Rail)' },
  { id: 'walking', label: 'Walk Everywhere' }
];

const FOOD_PREFERENCES = [
  'Local Coastal / Seafood',
  'Authentic Regional Specialties',
  'Vegetarian',
  'Vegan',
  'Street Food Tastings',
  'Farm-to-Table & Organic',
  'Fine Dining',
  'Cafe & Brunch Culture'
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, initializeAuth } = useAuthStore();
  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [bio, setBio] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [travelStyle, setTravelStyle] = useState('solo');
  const [pace, setPace] = useState('balanced');
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [accommodationPreference, setAccommodationPreference] = useState('comfort');
  const [transportPreference, setTransportPreference] = useState('mix');
  const [budgetTier, setBudgetTier] = useState('moderate');
  const [socialPreferences, setSocialPreferences] = useState({
    open_to_squad: true,
    meet_travelers: true,
    share_rides: false
  });

  // Custom chip inputs
  const [newLikeInput, setNewLikeInput] = useState('');
  const [newDislikeInput, setNewDislikeInput] = useState('');

  // Active section tab
  const [activeTab, setActiveTab] = useState<'rhythm' | 'preferences' | 'stays' | 'social'>('rhythm');

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiService.getProfile();
        setProfile(data);
        setBio(data.bio || '');
        setHomeCity(data.home_city || '');
        setTravelStyle(data.travel_style || 'solo');
        setPace(data.pace || 'balanced');
        setLikes(data.likes || []);
        setDislikes(data.dislikes || []);
        setFoodPreferences(data.food_preferences || []);
        setAccommodationPreference(data.accommodation_preference || 'comfort');
        setTransportPreference(data.transport_preference || 'mix');
        setBudgetTier(data.budget_tier || 'moderate');
        if (data.social_preferences) {
          setSocialPreferences({
            open_to_squad: data.social_preferences.open_to_squad !== false,
            meet_travelers: data.social_preferences.meet_travelers !== false,
            share_rides: !!data.social_preferences.share_rides
          });
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load traveler profile.');
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const payload: UpdateProfilePayload = {
        bio,
        home_city: homeCity,
        travel_style: travelStyle,
        pace,
        likes,
        dislikes,
        food_preferences: foodPreferences,
        accommodation_preference: accommodationPreference,
        transport_preference: transportPreference,
        budget_tier: budgetTier,
        social_preferences: socialPreferences
      };

      const updated = await apiService.updateProfile(payload);
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to save traveler profile.');
    } finally {
      setSaving(false);
    }
  };

  const addLike = (item: string) => {
    const clean = item.trim();
    if (clean && !likes.includes(clean)) {
      setLikes([...likes, clean]);
    }
    setNewLikeInput('');
  };

  const removeLike = (item: string) => {
    setLikes(likes.filter((l) => l !== item));
  };

  const addDislike = (item: string) => {
    const clean = item.trim();
    if (clean && !dislikes.includes(clean)) {
      setDislikes([...dislikes, clean]);
    }
    setNewDislikeInput('');
  };

  const removeDislike = (item: string) => {
    setDislikes(dislikes.filter((d) => d !== item));
  };

  const toggleFood = (item: string) => {
    if (foodPreferences.includes(item)) {
      setFoodPreferences(foodPreferences.filter((f) => f !== item));
    } else {
      setFoodPreferences([...foodPreferences, item]);
    }
  };

  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopNavbar />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sign in to customize your Travel DNA</h1>
          <p className="text-slate-600 text-sm mb-6 max-w-md mx-auto">
            Your Traveler Profile enables DAIna to understand your exact pacing, passions, and dealbreakers for truly personalized itineraries.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <span>Sign In to Continue</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      <TopNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header Hero Card */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-linear-to-bl from-orange-100/50 via-amber-50/30 to-transparent rounded-bl-full pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-linear-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-extrabold text-2xl sm:text-3xl shadow-md shrink-0">
                {(user?.full_name || 'E')[0].toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {profile?.full_name || user?.full_name || 'Fellow Traveler'}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Trust Score {profile?.trust_score || '95'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                    <Sparkles className="w-3 h-3" />
                    <span>DAIna AI DNA</span>
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                  <span>{user?.email}</span>
                  {homeCity && (
                    <span className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {homeCity}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-slate-600">
                    <Luggage className="w-3 h-3 text-slate-400" />
                    {profile?.trips_count || 0} Trips Completed
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs sm:text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving DNA...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Preferences Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Preferences</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {saveSuccess && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Your travel preferences have been synchronized with DAIna. Future itineraries will honor your exact pace, passions, and dealbreakers.</span>
            </div>
          )}
        </section>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-slate-200/80">
          <button
            onClick={() => setActiveTab('rhythm')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'rhythm'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pace & Rhythm</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'preferences'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-400" />
            <span>Passions & Dealbreakers</span>
          </button>

          <button
            onClick={() => setActiveTab('stays')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'stays'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Bed className="w-4 h-4 text-blue-400" />
            <span>Stays & Dining</span>
          </button>

          <button
            onClick={() => setActiveTab('social')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
              activeTab === 'social'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>Squad & Collaboration</span>
          </button>
        </div>

        {/* Tab 1: Pace & Rhythm */}
        {activeTab === 'rhythm' && (
          <div className="space-y-6">
            {/* Travel Style Grid */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Compass className="w-4 h-4 text-orange-500" />
                <span>Travel Identity & Style</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Helps DAIna calibrate recommendations to match your traveling persona.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {TRAVEL_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setTravelStyle(style.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      travelStyle === style.id
                        ? 'bg-orange-50/70 border-orange-500 ring-2 ring-orange-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900">{style.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{style.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Pace Selection */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span>Daily Pacing & Schedule Density</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Strictly alters morning start times and the density of activities scheduled each day.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PACES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPace(p.id)}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      pace === p.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${pace === p.id ? 'text-white' : 'text-slate-900'}`}>
                        {p.label}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          pace === p.id
                            ? 'bg-white/20 text-white'
                            : 'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}
                      >
                        {p.time}
                      </span>
                    </div>
                    <p className={`text-[11px] font-semibold mb-1 ${pace === p.id ? 'text-orange-300' : 'text-slate-600'}`}>
                      {p.stops}
                    </p>
                    <p className={`text-[11px] leading-relaxed ${pace === p.id ? 'text-slate-300' : 'text-slate-500'}`}>
                      {p.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bio & Home City */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-4">Traveler Bio & Origin Hub</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Home City / Hub</label>
                  <input
                    type="text"
                    value={homeCity}
                    onChange={(e) => setHomeCity(e.target.value)}
                    placeholder="e.g. Mumbai, Bengaluru, Delhi"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Used to compute transit routes & flight hubs.</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bio & Travel Philosophy</label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g. Love sunrise cliff walks, historic architecture, and local street cuisine."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Shown to potential squad mates during trip planning.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Passions & Dealbreakers */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            {/* Explicit Passions / Likes */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <span>Passions & What You Love (Likes)</span>
                </h2>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  +20.0 Candidate Bonus
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                DAIna heavily prioritizes candidate attractions and dining spots that match these explicit passions.
              </p>

              {/* Active Likes Chips */}
              <div className="flex flex-wrap gap-2 mb-4 min-h-[38px] p-2 rounded-2xl bg-slate-50 border border-slate-200/60">
                {likes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-1 px-2">No explicit passions added yet. Click suggestions below or type your own.</p>
                ) : (
                  likes.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => removeLike(item)}
                        className="hover:text-rose-900 cursor-pointer"
                        aria-label={`Remove ${item}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add custom like input */}
              <div className="flex gap-2 mb-4 max-w-md">
                <input
                  type="text"
                  value={newLikeInput}
                  onChange={(e) => setNewLikeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLike(newLikeInput);
                    }
                  }}
                  placeholder="Type a passion (e.g. coastal seafood, architecture) and press Enter"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => addLike(newLikeInput)}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Popular Travel Passions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_LIKES.filter((p) => !likes.includes(p)).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => addLike(preset)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-slate-400" />
                      <span>{preset}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Explicit Dealbreakers / Dislikes */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ThumbsDown className="w-4 h-4 text-amber-600" />
                  <span>Dealbreakers & What to Avoid (Dislikes)</span>
                </h2>
                <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  -60.0 Exclusion Penalty
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                DAIna actively penalizes and avoids scheduling activities, temples, clubs, or transit matching your dealbreakers.
              </p>

              {/* Active Dislikes Chips */}
              <div className="flex flex-wrap gap-2 mb-4 min-h-[38px] p-2 rounded-2xl bg-slate-50 border border-slate-200/60">
                {dislikes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-1 px-2">No dealbreakers specified yet. Click suggestions below or type your own.</p>
                ) : (
                  dislikes.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => removeDislike(item)}
                        className="hover:text-amber-950 cursor-pointer"
                        aria-label={`Remove ${item}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add custom dislike input */}
              <div className="flex gap-2 mb-4 max-w-md">
                <input
                  type="text"
                  value={newDislikeInput}
                  onChange={(e) => setNewDislikeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDislike(newDislikeInput);
                    }
                  }}
                  placeholder="Type a dealbreaker (e.g. nightclubs, temples) and press Enter"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => addDislike(newDislikeInput)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Avoid</span>
                </button>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Common Dealbreakers
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_DISLIKES.filter((p) => !dislikes.includes(p)).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => addDislike(preset)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-slate-400" />
                      <span>{preset}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Stays, Dining & Transit */}
        {activeTab === 'stays' && (
          <div className="space-y-6">
            {/* Accommodation Grid */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Bed className="w-4 h-4 text-blue-500" />
                <span>Accommodation Style</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Determines the stay category used for baseline night allocations and area cluster selection.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ACCOMMODATIONS.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccommodationPreference(acc.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      accommodationPreference === acc.id
                        ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs text-blue-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-800'
                    }`}
                  >
                    <p className="text-xs">{acc.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Food Preferences Chips */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-500" />
                <span>Culinary & Dining Preferences</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Select your food styles so lunch and dinner reservations match your taste.
              </p>

              <div className="flex flex-wrap gap-2">
                {FOOD_PREFERENCES.map((food) => {
                  const isSelected = foodPreferences.includes(food);
                  return (
                    <button
                      key={food}
                      type="button"
                      onClick={() => toggleFood(food)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{food}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transit Mode Grid */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Car className="w-4 h-4 text-purple-500" />
                <span>Local Transit Preference</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Determines how travel buffers and daily transit between clusters are calculated.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TRANSPORTS.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => setTransportPreference(tr.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      transportPreference === tr.id
                        ? 'bg-purple-50/70 border-purple-500 ring-2 ring-purple-500/20 shadow-xs text-purple-900 font-bold'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-800'
                    }`}
                  >
                    <p className="text-xs">{tr.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Squad & Collaboration */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span>Squad Discovery & Collaboration Boundaries</span>
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Control how you discover compatible travel partners and how your profile is presented to fellow travelers.
              </p>

              <div className="space-y-4 max-w-2xl">
                <label className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={socialPreferences.open_to_squad}
                    onChange={(e) =>
                      setSocialPreferences({ ...socialPreferences, open_to_squad: e.target.checked })
                    }
                    className="mt-1 w-4 h-4 text-orange-600 rounded-sm border-slate-300 focus:ring-orange-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Open to Squad Collaboration</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Allows friends and compatible travelers to invite you to Squad Rooms and vote on itineraries.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={socialPreferences.meet_travelers}
                    onChange={(e) =>
                      setSocialPreferences({ ...socialPreferences, meet_travelers: e.target.checked })
                    }
                    className="mt-1 w-4 h-4 text-orange-600 rounded-sm border-slate-300 focus:ring-orange-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Discover Compatible Travelers</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Show your profile in Community destination feeds matching your pace, interests, and style.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3.5 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={socialPreferences.share_rides}
                    onChange={(e) =>
                      setSocialPreferences({ ...socialPreferences, share_rides: e.target.checked })
                    }
                    className="mt-1 w-4 h-4 text-orange-600 rounded-sm border-slate-300 focus:ring-orange-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Share Rides & Group Transfers</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Signal interest in carpooling or splitting cab fares from arrival airports/hubs with fellow travelers.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Privacy Guarantee Note */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-amber-800 text-xs">
              <p className="font-semibold mb-1">🔒 DashTiny Privacy Guarantee</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Your private email, personal notes, and unaccepted proposals are never shared publicly. Only your travel style, pace, verified trust score, and published community moments are visible to potential squad companions.
              </p>
            </div>
          </div>
        )}

        {/* Sticky Save Bar on mobile / bottom */}
        <div className="fixed bottom-4 left-4 right-4 sm:hidden z-30">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-2xl bg-orange-500 text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Travel DNA'}
          </button>
        </div>
      </main>
    </div>
  );
}
