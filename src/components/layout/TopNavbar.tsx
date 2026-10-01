'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Sparkles,
  Coins,
  CalendarDays,
  Luggage,
  Users,
  Zap,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export function TopNavbar() {
  const pathname = usePathname();
  const { user, logout, initializeAuth } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const coins = user?.coins ?? 250;
  const userName = user?.full_name || 'Explorer';

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const navLinks = [
    { href: '/dashboard', label: 'Explore', icon: Compass },
    { href: '/planner', label: 'AI Planner', icon: Sparkles },
    { href: '/bookings', label: 'Bookings', icon: CalendarDays },
    { href: '/trips', label: 'My Trips', icon: Luggage },
    { href: '/community', label: 'Community', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-header transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand — LOGO WITH AI BADGE */}
        <Link href="/dashboard" className="flex items-center gap-2 group shrink-0 py-1">
          <Image
            src="/assets/logo_big.png"
            alt="DashTiny Logo"
            width={140}
            height={36}
            priority
            className="h-8 sm:h-9 w-auto object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-xs"
          />
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-orange-600 bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded-full tracking-wider uppercase shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            DAIna AI
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/70 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/70 shadow-inner">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 font-extrabold scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/90'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-orange-500'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Coin balance */}
          <Link
            href="/rewards"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-900 text-xs font-extrabold hover:bg-amber-100/80 transition-all shadow-2xs"
          >
            <Coins className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{coins}</span>
            <span className="text-amber-700 font-medium hidden sm:inline">pts</span>
          </Link>

          {/* User */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 p-1 pr-3 rounded-full shadow-2xs transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                  {userName[0]}
                </div>
                <span className="text-xs font-bold text-slate-800 hidden lg:inline">{userName}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{userName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold transition-all shadow-md shadow-orange-500/20 hover:scale-105"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
