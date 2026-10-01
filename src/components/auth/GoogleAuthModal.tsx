'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Card } from '@/components/ui/Card';

export function GoogleAuthModal() {
  const { isAuthModalOpen, authModalReason, closeAuthModal, loginWithDemo } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleDemoSignIn = async () => {
    setIsLoading(true);
    try {
      await loginWithDemo({
        name: 'Demo Explorer [Sandbox]',
        email: 'demo.explorer@dashtiny.travel',
        role: 'sandbox_explorer',
      });
    } finally {
      setIsLoading(false);
    }
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

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>AUTHENTICATION GATEWAY</span>
          </div>

          <h3 className="text-2xl font-serif-editorial font-bold text-slate-900 leading-tight">
            Sign In to Build & Save Getaway
          </h3>

          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            {authModalReason}
          </p>
        </div>

        {/* Benefits List */}
        <div className="space-y-2 relative z-10 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs">
          {[
            'Instant 30-Second DAIna AI Getaway Architect',
            'Save & Customize Multi-Day Stays & Routes in PostgreSQL',
            'Squad Split Expense Ledger & Room Checkout',
          ].map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-2 text-slate-700 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        {/* Demo Mode Notice */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium">
          <strong>Sandbox Notice:</strong> Real Google OAuth requires cloud client credentials. You can enter with a <strong>Demo Explorer Session</strong> or use <strong>Email & Password</strong>.
        </div>

        {/* Buttons */}
        <div className="space-y-3 relative z-10 pt-1">
          <button
            onClick={handleDemoSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm py-3 px-4 rounded-2xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isLoading ? 'Starting Demo Session...' : 'Continue as Demo Explorer [Sandbox]'}</span>
          </button>

          <a
            href="/login"
            onClick={closeAuthModal}
            className="block text-center text-xs text-slate-600 hover:text-orange-600 font-bold py-2 underline transition-colors"
          >
            Or Sign In / Register with Real Email & Password →
          </a>
        </div>
      </Card>
    </div>
  );
}
