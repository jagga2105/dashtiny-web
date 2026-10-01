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

  async getCurrentUser() {
    return request<any>('/auth/me');
  },

  // Phone OTP Flow (Explicit Dev Passkey)
  async requestOTP(phone: string): Promise<{ success: boolean; message: string; isDev: boolean }> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      throw new ApiError('Please enter a valid 10-digit phone number', 400);
    }
    return {
      success: true,
      message: `OTP sent to ${phone}. [DEMO PASSKEY: 123456]`,
      isDev: true,
    };
  },

  async verifyOTP(phone: string, code: string): Promise<AuthResponse> {
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

  async getDriveEscapes(city: string = 'Bengaluru') {
    return request<any[]>(`/explore/drives?city=${encodeURIComponent(city)}`);
  },

  // Planner API (DAIna AI Getaway Architect)
  async generateItinerary(payload: GenerateItineraryPayload) {
    const normalizedPayload = {
      destination: payload.destination,
      budget: payload.budget,
      days_count: payload.days_count || payload.duration || 4,
      persona: payload.persona || payload.vibe || 'solo',
      prompt: payload.prompt,
    };
    return request<any>('/planner/generate', {
      method: 'POST',
      body: JSON.stringify(normalizedPayload),
    });
  },

  // Trips API
  async getMyTrips() {
    return request<any[]>('/trips/my-trips');
  },

  // Bookings API
  async searchFlights(origin: string = 'BLR', destination: string = 'GOI') {
    return request<any>(`/bookings/search/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
  },

  async searchHotels(destination: string = 'Goa', guests: number = 2) {
    return request<any>(`/bookings/search/hotels?destination=${encodeURIComponent(destination)}&guests=${guests}`);
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
