import { create } from 'zustand';
import { apiService } from '@/services/api';

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  coins: number;
  avatar_url?: string;
  account_type?: string;
  is_verified?: boolean;
  trust_score?: string;
  vibe_tags?: string[];
  provider?: 'google' | 'email' | 'phone';
  is_demo?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalReason: string;
  pendingAuthAction: (() => void) | null;
  
  initializeAuth: () => Promise<void>;
  login: (user: User, token: string) => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, fullName: string, accountType?: string) => Promise<void>;
  loginWithGoogle: (googleProfile?: Partial<User>) => Promise<void>;
  logout: () => void;
  updateCoins: (amount: number) => void;
  openAuthModal: (reason?: string, onAuthSuccess?: () => void) => void;
  closeAuthModal: () => void;
}

function getStoredSession(): { user: User | null; token: string | null } {
  if (typeof window === 'undefined') return { user: null, token: null };
  try {
    const token = localStorage.getItem('dashtiny_token');
    const userStr = localStorage.getItem('dashtiny_user');
    if (token && userStr) {
      return { token, user: JSON.parse(userStr) };
    }
  } catch (e) {
    // Ignore parse errors
  }
  return { user: null, token: null };
}

const initialSession = getStoredSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialSession.user,
  token: initialSession.token,
  isAuthenticated: !!initialSession.token,
  isAuthModalOpen: false,
  authModalReason: 'Sign in to access bespoke getaway planning features',
  pendingAuthAction: null,

  initializeAuth: async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('dashtiny_token');
    if (!token) return;

    try {
      const realUser = await apiService.getCurrentUser();
      const updatedUser: User = {
        id: realUser.id,
        full_name: realUser.full_name,
        email: realUser.email,
        coins: realUser.coins,
        avatar_url: realUser.avatar_url,
        account_type: realUser.account_type,
        is_verified: realUser.is_verified,
        trust_score: realUser.trust_score,
      };
      localStorage.setItem('dashtiny_user', JSON.stringify(updatedUser));
      set({ user: updatedUser, token, isAuthenticated: true });
    } catch (err) {
      console.warn('Session expired, clearing storage');
      localStorage.removeItem('dashtiny_token');
      localStorage.removeItem('dashtiny_user');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  login: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashtiny_token', token);
      localStorage.setItem('dashtiny_user', JSON.stringify(user));
    }
    const pendingAction = get().pendingAuthAction;
    set({ user, token, isAuthenticated: true, isAuthModalOpen: false, pendingAuthAction: null });
    if (pendingAction) {
      pendingAction();
    }
  },

  loginWithEmail: async (email, password) => {
    const res = await apiService.loginWithEmail({ email, password });
    get().login(res.user, res.access_token);
  },

  registerWithEmail: async (email, password, fullName, accountType = 'personal_traveler') => {
    const res = await apiService.registerWithEmail({
      email,
      password,
      full_name: fullName,
      account_type: accountType,
    });
    get().login(res.user, res.access_token);
  },

  loginWithGoogle: async (googleProfile) => {
    const isExplicitDemo = !googleProfile?.email;
    const googleId = `google_demo_${Date.now()}`;
    const email = googleProfile?.email || 'demo.traveler@dashtiny.ai';
    const fullName = googleProfile?.full_name || 'Demo Explorer [Sandbox]';
    const avatarUrl = googleProfile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

    const apiRes = await apiService.loginWithGoogle({
      google_id: googleId,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
    });

    const userWithFlag: User = {
      ...apiRes.user,
      is_demo: isExplicitDemo,
      provider: 'google',
    };

    get().login(userWithFlag, apiRes.access_token);
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dashtiny_token');
      localStorage.removeItem('dashtiny_user');
    }
    set({ user: null, token: null, isAuthenticated: false, isAuthModalOpen: false, pendingAuthAction: null });
  },

  updateCoins: (delta: number) =>
    set((state) => ({
      user: state.user
        ? { ...state.user, coins: Math.max(0, state.user.coins + delta) }
        : null,
    })),

  openAuthModal: (reason, onAuthSuccess) => {
    set({
      isAuthModalOpen: true,
      authModalReason: reason || 'Sign in with Google to create and save your getaway itinerary',
      pendingAuthAction: onAuthSuccess || null,
    });
  },

  closeAuthModal: () => {
    set({ isAuthModalOpen: false, pendingAuthAction: null });
  },
}));
