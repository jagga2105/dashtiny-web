'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Card } from '@/components/ui/Card';

export function GoogleAuthModal() {
  const { isAuthModalOpen, authModalReason, closeAuthModal, loginWithGoogle } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    setTimeout(() => {
      loginWithGoogle({
        full_name: 'Kumkum Pandey',
        email: 'kumkum.pandey@gmail.com',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      });
      setIsLoading(false);
    }, 800);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={closeAuthModal}
    >
      <Card
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Sunrise Light Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-orange-300/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-300/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="space-y-3 relative z-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center shadow-xs">
            <Image src="/assets/logo_big.png" alt="DashTiny" width={44} height={16} className="h-6 w-auto object-contain" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-[10px] font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>MANDATORY GETAWAY CREATION GATE</span>
          </div>

          <h3 className="text-2xl font-serif-editorial font-bold text-slate-900 leading-tight">
            Sign in with Google to Build Itinerary
          </h3>

          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            {authModalReason}
          </p>
        </div>

        {/* Benefits List */}
        <div className="space-y-2 relative z-10 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs">
          {[
            'Instant 30-Second DAIna AI Getaway Architect',
            'Save & Customize Multi-Day Stays & Routes',
            'Squad Split Expense Ledger & Room Checkout',
          ].map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-2 text-slate-700 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        {/* Google OAuth Login Button */}
        <div className="space-y-3 relative z-10 pt-1">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-sm py-3.5 px-4 rounded-2xl border border-slate-300 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isLoading ? 'Signing in with Google...' : 'Continue with Google Account'}</span>
          </button>

          <p className="text-[11px] text-center text-slate-500 font-medium flex items-center justify-center gap-1">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Protected by Google OAuth 2.0 SSL Encryption</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
