/**
 * DashTiny Unified API Layer
 * Single source of truth for all API requests to DashTiny FastAPI backend.
 * Rule: Never silently swallow errors into fake success data.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number = 500, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export function getAuthHeaders(): HeadersInit {
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (netErr: any) {
    throw new ApiError(
      'Unable to connect to DashTiny services. Please check if backend is running.',
      0,
      netErr?.message
    );
  }

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      // Body not JSON
    }
    throw new ApiError(errorDetail || `Request failed with status ${res.status}`, res.status, errorDetail);
  }

  // Handle empty bodies (204 No Content)
  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

// ==============================================================================
// Schemas
// ==============================================================================

export interface GoogleLoginPayload {
  google_id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface PlannerRequest {
  destination: string;
  origin?: string;
  start_date?: string;
  end_date?: string;
  days_count?: number;
  duration?: number;
  travellers?: number;
  companions?: number;
  budget: number;
  currency?: string;
  persona?: string;
  vibe?: string;
  interests?: string[];
  raw_prompt?: string;
  prompt?: string;
}

export type GenerateItineraryPayload = PlannerRequest;

export interface BookingPayload {
  category: 'flight' | 'hotel' | 'train' | 'bus' | 'cab';
  provider: string;
  title: string;
  amount: number;
  currency?: string;
  trip_id?: string;
  details?: any;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    account_type: string;
    is_verified: boolean;
    trust_score: string;
    coins: number;
  };
}

// ==============================================================================
// Unified API Client
// ==============================================================================

export const apiService = {
  // Auth API
  async registerWithEmail(payload: { email: string; password: string; full_name: string; account_type?: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async loginWithEmail(payload: { email: string; password: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async loginWithGoogle(payload: GoogleLoginPayload): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async loginWithDemo(payload?: { role?: string; name?: string; email?: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/demo', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  async getCurrentUser() {
    return request<any>('/auth/me');
  },

  // Phone OTP Flow (Explicit Dev Passkey)
  async requestOTP(phone: string): Promise<{ success: boolean; message: string; isDev: boolean }> {
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    if (!isDemoMode) {
      throw new ApiError('Phone sign-in is disabled. Please use Google or Email sign-in.', 403);
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      throw new ApiError('Please enter a valid 10-digit phone number', 400);
    }
    return {
      success: true,
      message: 'Development mode: Phone sign-in uses a demo passkey: 123456',
      isDev: true,
    };
  },

  async verifyOTP(phone: string, code: string): Promise<AuthResponse> {
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    if (!isDemoMode) {
      throw new ApiError('Phone sign-in is disabled in production.', 403);
    }
    if (code.trim() !== '123456') {
      throw new ApiError('Invalid verification code. Enter demo passkey: 123456', 401);
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    const email = `traveler.${cleanPhone}@dashtiny.ai`;
    const password = `pass_${cleanPhone.slice(-4)}_dev`;

    try {
      return await apiService.registerWithEmail({
        email,
        password,
        full_name: `Explorer (${cleanPhone.slice(-4)})`,
        account_type: 'personal_traveler',
      });
    } catch {
      // If already registered, sign in
      return await apiService.loginWithEmail({ email, password });
    }
  },

  // Explore API
  async getSanctuaries(vibe: string = 'all') {
    return request<any[]>(`/explore/sanctuaries?vibe=${encodeURIComponent(vibe)}`);
  },

  async getDriveEscapes(originCity?: string) {
    const url = originCity && originCity !== 'Weekend'
      ? `/explore/drives?origin_city=${encodeURIComponent(originCity)}`
      : '/explore/drives';
    return request<any[]>(url);
  },

  // Planner API (DAIna AI Getaway Architect)
  async generateItinerary(payload: GenerateItineraryPayload) {
    const canonicalPayload = {
      destination: payload.destination,
      origin: payload.origin,
      start_date: payload.start_date,
      end_date: payload.end_date,
      days_count: payload.days_count || payload.duration || 4,
      travellers: payload.travellers || payload.companions || 2,
      budget: payload.budget,
      currency: payload.currency || 'INR',
      persona: payload.persona || 'solo',
      vibe: payload.vibe,
      interests: payload.interests,
      raw_prompt: payload.raw_prompt || payload.prompt,
      prompt: payload.prompt || payload.raw_prompt,
    };
    return request<any>('/planner/generate', {
      method: 'POST',
      body: JSON.stringify(canonicalPayload),
    });
  },

  // Trips API
  async getMyTrips() {
    return request<any[]>('/trips/my-trips');
  },

  async getTripDetails(tripId: string) {
    return request<any>(`/trips/${tripId}`);
  },

  async removeTripActivity(tripId: string, activityId: string) {
    return request<any>(`/trips/${tripId}/activities/${activityId}`, {
      method: 'DELETE',
    });
  },

  async addTripActivity(tripId: string, activity: any) {
    return request<any>(`/trips/${tripId}/activities`, {
      method: 'POST',
      body: JSON.stringify(activity),
    });
  },

  // Bookings API
  async searchFlights(
    paramsOrOrigin: string | {
      origin?: string;
      destination?: string;
      departureDate?: string;
      returnDate?: string;
      passengers?: number;
      cabinClass?: string;
      tripType?: string;
    } = 'BLR',
    destinationFallback: string = 'GOI'
  ) {
    let params: Record<string, string> = {};
    if (typeof paramsOrOrigin === 'string') {
      params = {
        origin: paramsOrOrigin,
        destination: destinationFallback,
      };
    } else {
      params = {
        origin: paramsOrOrigin.origin || 'BLR',
        destination: paramsOrOrigin.destination || 'GOI',
        departure_date: paramsOrOrigin.departureDate || '',
        return_date: paramsOrOrigin.returnDate || '',
        passengers: String(paramsOrOrigin.passengers || 1),
        cabin_class: paramsOrOrigin.cabinClass || 'economy',
        trip_type: paramsOrOrigin.tripType || 'roundtrip',
      };
    }
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => Boolean(v))
    ).toString();
    return request<any[]>(`/bookings/search/flights?${query}`);
  },

  async searchHotels(
    paramsOrDest: string | {
      destination?: string;
      guests?: number;
      checkIn?: string;
      checkOut?: string;
      roomType?: string;
    } = 'Goa',
    guestsFallback: number = 2
  ) {
    let params: Record<string, string> = {};
    if (typeof paramsOrDest === 'string') {
      params = {
        destination: paramsOrDest,
        guests: String(guestsFallback),
      };
    } else {
      params = {
        destination: paramsOrDest.destination || 'Goa',
        guests: String(paramsOrDest.guests || 2),
        check_in: paramsOrDest.checkIn || '',
        check_out: paramsOrDest.checkOut || '',
        room_type: paramsOrDest.roomType || '',
      };
    }
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => Boolean(v))
    ).toString();
    return request<any[]>(`/bookings/search/hotels?${query}`);
  },

  async createBooking(payload: BookingPayload) {
    return request<any>('/bookings/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async saveBookingReference(payload: BookingPayload) {
    return this.createBooking(payload);
  },

  async getMyBookings() {
    return request<any[]>('/bookings/my-bookings');
  },

  // Community Feed API
  async getCommunityFeed() {
    return request<any[]>('/community/feed');
  },

  async createCommunityPost(post: { getaway_title: string; location: string; content: string; image_url: string; companions_needed?: number }) {
    return request<any>('/community/posts', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  },

  async likeCommunityPost(postId: string) {
    return request<any>(`/community/posts/${postId}/like`, {
      method: 'POST',
    });
  },

  // Squad Co-Exploration API
  async getSquadSummary(squadId: string) {
    return request<any>(`/squads/${squadId}/summary`);
  },

  async addSquadExpense(squadId: string, expense: { description: string; amount: number; category: string }) {
    return request<any>(`/squads/${squadId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  },

  // Rewards Vault API
  async getRewardVault() {
    return request<any>('/rewards/vault');
  },

  async redeemRewardVoucher(voucherId: string) {
    return request<any>('/rewards/redeem', {
      method: 'POST',
      body: JSON.stringify({ voucher_id: voucherId }),
    });
  },

  // DAIna AI Chat Butler API
  async sendChatMessage(message: string, context?: any) {
    return request<any>('/chat/query', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  },

  // Conversational Action & Diff API (POST /ai/query)
  async executeAIAction(tripId: string, instruction: string) {
    return request<any>('/ai/query', {
      method: 'POST',
      body: JSON.stringify({ trip_id: tripId, instruction }),
    });
  },
};

// Aliases for explicit imports
export const requestOTP = apiService.requestOTP;
export const verifyOTP = apiService.verifyOTP;
