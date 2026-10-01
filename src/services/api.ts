const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('dashtiny_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export interface GoogleLoginPayload {
  google_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface GenerateItineraryPayload {
  destination: string;
  budget: number;
  days_count?: number;
  duration?: number;
  persona?: string;
  vibe?: string;
  companions?: number;
  prompt?: string;
}

export interface BookingPayload {
  category: 'flight' | 'hotel' | 'train' | 'bus' | 'cab';
  provider: string;
  title: string;
  amount: number;
  currency?: string;
  trip_id?: string;
  details?: any;
}

export const apiService = {
  // Auth API
  async registerWithEmail(payload: { email: string; password: string; full_name: string; account_type?: string }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Registration failed');
    }
    return await res.json();
  },

  async loginWithEmail(payload: { email: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    return await res.json();
  },

  async loginWithGoogle(payload: GoogleLoginPayload) {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Google Auth Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Auth Offline, fallback to client session:', err);
      return {
        access_token: `demo_token_${Date.now()}`,
        user: {
          id: `usr_${payload.google_id.slice(0, 8)}`,
          email: payload.email,
          full_name: payload.full_name,
          avatar_url: payload.avatar_url,
          is_verified: true,
          trust_score: '99% Verified Explorer',
          coins: 300,
        },
      };
    }
  },

  async getCurrentUser() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Session expired or invalid');
    return await res.json();
  },

  // Explore & Sanctuaries API
  async getSanctuaries(vibe: string = 'all') {
    try {
      const res = await fetch(`${API_BASE}/explore/sanctuaries?vibe=${encodeURIComponent(vibe)}`);
      if (!res.ok) throw new Error('Sanctuaries API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Sanctuaries API Offline:', err);
      return null;
    }
  },

  async getDriveEscapes(city: string = 'Bengaluru') {
    try {
      const res = await fetch(`${API_BASE}/explore/drives?city=${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error('Drives API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Drives API Offline:', err);
      return null;
    }
  },

  // Planner API (DAIna AI Getaway Architect)
  async generateItinerary(payload: GenerateItineraryPayload) {
    try {
      const normalizedPayload = {
        destination: payload.destination,
        budget: payload.budget,
        days_count: payload.days_count || payload.duration || 4,
        persona: payload.persona || payload.vibe || 'solo',
        prompt: payload.prompt,
      };
      const res = await fetch(`${API_BASE}/planner/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(normalizedPayload),
      });
      if (!res.ok) throw new Error('Planner API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Planner API Offline:', err);
      return null;
    }
  },

  // Trips API
  async getMyTrips() {
    try {
      const res = await fetch(`${API_BASE}/trips/my-trips`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Trips API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Trips API Offline:', err);
      return null;
    }
  },

  // Bookings & Inventory Aggregation API
  async searchFlights(origin: string = 'BLR', destination: string = 'GOI') {
    try {
      const res = await fetch(`${API_BASE}/bookings/search/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Flight search failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Flight Search Offline:', err);
      return null;
    }
  },

  async searchHotels(destination: string = 'Goa', guests: number = 2) {
    try {
      const res = await fetch(`${API_BASE}/bookings/search/hotels?destination=${encodeURIComponent(destination)}&guests=${guests}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Hotel search failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Hotel Search Offline:', err);
      return null;
    }
  },

  async createBooking(payload: BookingPayload) {
    try {
      const res = await fetch(`${API_BASE}/bookings/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Booking API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Booking API Offline:', err);
      return null;
    }
  },

  async getMyBookings() {
    try {
      const res = await fetch(`${API_BASE}/bookings/my-bookings`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Bookings API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Bookings API Offline:', err);
      return null;
    }
  },

  // Community Feed API
  async getCommunityFeed() {
    try {
      const res = await fetch(`${API_BASE}/community/feed`);
      if (!res.ok) throw new Error('Community Feed API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Community API Offline:', err);
      return null;
    }
  },

  async createCommunityPost(post: { getaway_title: string; location: string; content: string; image_url: string; companions_needed?: number }) {
    try {
      const res = await fetch(`${API_BASE}/community/posts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(post),
      });
      if (!res.ok) throw new Error('Create Post Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Create Post Offline:', err);
      return null;
    }
  },

  async likeCommunityPost(postId: string) {
    try {
      const res = await fetch(`${API_BASE}/community/posts/${postId}/like`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Like Post Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Like Post Offline:', err);
      return null;
    }
  },

  // Squad Co-Exploration API
  async getSquadSummary(squadId: string) {
    try {
      const res = await fetch(`${API_BASE}/squads/${squadId}/summary`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Squad API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Squad API Offline:', err);
      return null;
    }
  },

  async addSquadExpense(squadId: string, expense: { description: string; amount: number; category: string }) {
    try {
      const res = await fetch(`${API_BASE}/squads/${squadId}/expenses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(expense),
      });
      if (!res.ok) throw new Error('Add Expense Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Add Expense Offline:', err);
      return null;
    }
  },

  // Rewards Vault API
  async getRewardVault() {
    try {
      const res = await fetch(`${API_BASE}/rewards/vault`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Rewards Vault API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Rewards API Offline:', err);
      return null;
    }
  },

  async redeemRewardVoucher(voucherId: string) {
    try {
      const res = await fetch(`${API_BASE}/rewards/redeem`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ voucher_id: voucherId }),
      });
      if (!res.ok) throw new Error('Redeem Voucher Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Redeem Voucher Offline:', err);
      return null;
    }
  },

  // DAIna AI Chat Butler API
  async sendChatMessage(message: string, context?: any) {
    try {
      const res = await fetch(`${API_BASE}/chat/query`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message, context }),
      });
      if (!res.ok) throw new Error('Chat API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend Chat API Offline:', err);
      return null;
    }
  },

  // Conversational Action & Diff API (POST /ai/query)
  async executeAIAction(tripId: string, instruction: string) {
    try {
      const res = await fetch(`${API_BASE}/ai/query`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ trip_id: tripId, instruction }),
      });
      if (!res.ok) throw new Error('AI Action API Failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend AI Action Offline:', err);
      return null;
    }
  },
};
