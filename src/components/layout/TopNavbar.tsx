'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Sparkles,
  Luggage,
  Users,
  Coins,
  User,
  Settings,
  Bell,
  Sliders,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export function TopNavbar() {
  const pathname = usePathname();
  const { user, logout, initializeAuth } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userName = user?.full_name || 'Explorer';

  useEffect(() => {
    setMounted(true);
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Primary navigation: 4 essential destinations centered around the travel journey
  const navLinks = [
    { href: '/dashboard', label: 'Explore', icon: Compass },
    { href: '/planner', label: 'Plan', icon: Sparkles },
    { href: '/trips', label: 'Trips', icon: Luggage },
    { href: '/community', label: 'Community', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-header transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand — Clean logo with subtle attribution */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 py-1" aria-label="DashTiny Home">
          <Image
            src="/assets/logo_big.png"
            alt="DashTiny Logo"
            width={130}
            height={34}
            priority
            className="h-8 sm:h-8.5 w-auto object-contain"
          />
          <span className="hidden sm:inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-full">
            Powered by DAIna
          </span>
        </Link>

        {/* Desktop Primary Nav — Calm, cohesive, 4 destinations */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 backdrop-blur-md p-1 rounded-xl border border-slate-200/80">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-white text-orange-600 shadow-xs border border-slate-200/60 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-600' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side — Contextual user profile */}
        <div className="flex items-center gap-3 min-w-[70px] justify-end">
          {!mounted ? (
            <div className="w-18 h-8 rounded-xl bg-slate-100/60 animate-pulse" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 p-1.5 pr-2.5 rounded-full shadow-2xs transition-colors cursor-pointer"
                aria-label="Open profile menu"
                aria-expanded={showUserMenu}
              >
                <div className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold text-xs flex items-center justify-center">
                  {userName[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-800 hidden lg:inline">{userName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 text-xs">
                  {/* User info */}
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="font-bold text-slate-900">{userName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  </div>

                  {/* Your Account */}
                  <div className="py-1">
                    <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Your Account
                    </div>
                    <Link
                      href="/rewards"
                      onClick={() => setShowUserMenu(false)}
                      className="px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between font-medium"
                    >
                      <div className="flex items-center gap-2.5">
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                        <span>Travel Credits</span>
                      </div>
                      {user.coins != null ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                          {user.coins} pts
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">0 pts</span>
                      )}
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 my-1" />

                  {/* Trips & Planning */}
                  <div className="py-1">
                    <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Trips
                    </div>
                    <Link
                      href="/trips"
                      onClick={() => setShowUserMenu(false)}
                      className="px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium"
                    >
                      <Luggage className="w-3.5 h-3.5 text-slate-400" />
                      <span>My Trips Workspace</span>
                    </Link>
                    <Link
                      href="/planner"
                      onClick={() => setShowUserMenu(false)}
                      className="px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                      <span>Plan a new trip</span>
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 my-1" />

                  {/* Sign Out */}
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer transition-colors"
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

