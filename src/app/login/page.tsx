'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, Mail, Lock, Phone, ArrowRight, ShieldCheck, CheckCircle2, UserCheck, Award, User } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/useAuthStore';
import { requestOTP, verifyOTP } from '@/services/api';

type AccountType = 'personal_traveler' | 'corporate_manager' | 'travel_agent' | 'enterprise_admin';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithEmail, registerWithEmail, loginWithGoogle, loginWithDemo } = useAuthStore();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [accountType, setAccountType] = useState<AccountType>('personal_traveler');

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

  const accountTypesList: { id: AccountType; title: string; desc: string }[] = [
    { id: 'personal_traveler', title: 'Personal Traveler', desc: 'Plan trips, book hotels & earn Gold Coins' },
    { id: 'corporate_manager', title: 'Corporate Travel Mgr', desc: 'Manage team bookings & expense receipts' },
    { id: 'travel_agent', title: 'Travel Concierge', desc: 'Curate itineraries & client travel packages' },
    { id: 'enterprise_admin', title: 'Enterprise Admin', desc: 'Company travel policy & Gold Coin rewards' },
  ];

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
        await registerWithEmail(email, password, fullName, accountType);
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

  const handleQuickDemoLogin = async (accType: AccountType) => {
    setLoading(true);
    setErrorMsg('');
    try {
      await loginWithDemo({
        role: accType,
        name: `${accType.replace('_', ' ').toUpperCase()} Explorer`,
        email: `${accType}@dashtiny.travel`,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      setErrorMsg('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await requestOTP(phone);
    setSuccessMsg(res.message);
    setOtpSent(true);
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await verifyOTP(phone, otpCode);
      login(data.user, data.access_token);
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid OTP code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden">
      {/* Background Sunrise Radial Ambient Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="p-6 max-w-7xl w-full mx-auto flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-10 w-auto flex items-center justify-center">
            <Image src="/assets/logo_big.png" alt="Dashtiny Logo" width={160} height={40} className="h-9 w-auto object-contain" priority />
          </div>
        </Link>

        <span className="text-xs text-slate-500 font-extrabold flex items-center gap-1.5 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" /> PostgreSQL Auth Live
        </span>
      </header>

      {/* Main Form Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10">
        {/* Left Editorial Value Proposition */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-extrabold tracking-wider uppercase">
            <Award className="w-3.5 h-3.5 text-orange-600" />
            <span>INTELLIGENT GETAWAYS PLATFORM</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-serif-editorial font-extrabold text-slate-900 tracking-tight">
              DashTiny <span className="text-sunrise-gradient">AI Travel Butler</span>
            </h1>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto lg:mx-0 font-medium">
              The Intelligent Getaways Platform. Discover sanctuaries, architect bespoke escapes, compare providers, and manage your entire getaway in one place.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0 pt-2">
            {[
              'DAIna AI Getaway Concierge Service',
              'Multi-Modal Flight & Stay Aggregation',
              'Price Forecast Advisory Alerts',
              'Gold Coin Rewards Vault',
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-800 font-bold shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Auth Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <Card className="p-6 sm:p-8 space-y-5 rounded-3xl bg-white border border-slate-200/90 shadow-xl">
            {/* Sign In vs Sign Up Tab Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all ${
                  authMode === 'signin'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all ${
                  authMode === 'signup'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Account Type Grid (Only during Sign Up) */}
            {authMode === 'signup' && (
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-orange-500" /> Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {accountTypesList.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setAccountType(acc.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        accountType === acc.id
                          ? 'bg-orange-50 border-orange-300 text-orange-800 font-extrabold shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <p className="text-xs font-extrabold">{acc.title}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">{acc.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Google OAuth Quick Sign In */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await loginWithGoogle();
                  router.push('/dashboard');
                }}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-sm py-3 px-4 rounded-2xl border border-slate-300 shadow-xs hover:shadow-md transition-all"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">or with email</span>
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
                placeholder="alex@dashtiny.ai"
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
              <Button type="submit" isLoading={loading} variant="primary" className="w-full mt-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-md shadow-orange-500/20" size="lg">
                <span>{authMode === 'signup' ? 'Create Account & Get 300 Pts' : 'Sign In & Enter Dashboard'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>

            {/* Quick Demo Explorer */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-[11px] text-slate-500 text-center font-semibold">Instant Quick Demo Login:</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs text-orange-700 border-orange-200 bg-orange-50/50 hover:bg-orange-100/50 font-bold"
                onClick={() => handleQuickDemoLogin(accountType)}
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-500 mr-1" />
                Launch Demo Explorer →
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
