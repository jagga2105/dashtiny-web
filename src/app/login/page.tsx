'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, Mail, Lock, ArrowRight, CheckCircle2, User, Phone, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, registerWithEmail, loginWithGoogle, loginWithDemo } = useAuthStore();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'phone'>('signin');
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (authMode === 'signup') {
        if (!fullName.trim()) {
          setErrorMsg('Please enter your full name');
          setLoading(false);
          return;
        }
        await registerWithEmail(email, password, fullName, 'personal_traveler');
        router.push('/dashboard');
      } else {
        await loginWithEmail(email, password);
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await loginWithDemo({
        role: 'personal_traveler',
        name: 'Alex Explorer',
        email: 'alex@dashtiny.travel',
      });
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden">
      {/* Background Ambient Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="p-6 max-w-7xl w-full mx-auto flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-10 w-auto flex items-center justify-center">
            <Image src="/assets/logo_big.png" alt="DashTiny Logo" width={160} height={40} className="h-9 w-auto object-contain" priority />
          </div>
        </Link>

        <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" /> Powered by DAIna
        </span>
      </header>

      {/* Main Form Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10">
        {/* Left Editorial Value Proposition */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-semibold tracking-wide">
            <span>INTELLIGENT TRAVEL PLATFORM</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-serif-editorial font-bold text-slate-900 tracking-tight">
              Welcome to <span className="text-orange-600">DashTiny</span>
            </h1>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto lg:mx-0 font-normal">
              Plan better trips with DAIna. Discover destinations, compare travel providers, and build your personalized itinerary in one place.
            </p>
          </div>

          {/* Clean Value Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0 pt-2">
            {[
              'Conversational AI Planner',
              'Flight & Stay Price Comparison',
              'Persistent Trip Workspace',
              'Real Travel Memory & Pacing',
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 font-semibold shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Auth Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <Card className="p-6 sm:p-8 space-y-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
            {/* Header */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-serif-editorial font-bold text-slate-900">
                {authMode === 'signin' ? 'Sign in to your account' : 'Create your account'}
              </h2>
              <p className="text-xs text-slate-500">
                {authMode === 'signin' ? 'Continue planning your getaways' : 'Start your next adventure in minutes'}
              </p>
            </div>

            {/* Google OAuth Quick Sign In */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await loginWithGoogle();
                  router.push('/dashboard');
                }}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm py-2.5 px-4 rounded-xl border border-slate-300 shadow-2xs transition-all cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[11px] font-medium text-slate-400">or with email</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                {successMsg}
              </div>
            )}

            {/* Email Auth Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              {authMode === 'signup' && (
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="Alex Traveler"
                  icon={<User className="w-4 h-4 text-orange-500" />}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              )}
              <Input
                label="Email Address"
                type="email"
                placeholder="alex@example.com"
                icon={<Mail className="w-4 h-4 text-orange-500" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                icon={<Lock className="w-4 h-4 text-orange-500" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button type="submit" isLoading={loading} variant="primary" className="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs py-2.5 cursor-pointer shadow-sm" size="lg">
                <span>{authMode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>

            {/* Switch Sign In / Sign Up */}
            <div className="text-center pt-2 text-xs text-slate-500 font-medium">
              {authMode === 'signin' ? (
                <p>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setErrorMsg('');
                    }}
                    className="text-orange-600 hover:text-orange-700 font-semibold cursor-pointer underline"
                  >
                    Create account
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setErrorMsg('');
                    }}
                    className="text-orange-600 hover:text-orange-700 font-semibold cursor-pointer underline"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>

            {/* Quick Demo Explorer */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs text-slate-700 border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium cursor-pointer"
                onClick={handleQuickDemoLogin}
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-500 mr-1.5" />
                Quick Demo Login →
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
