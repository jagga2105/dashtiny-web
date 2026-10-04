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
  UserPlus,
  CheckCheck,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, initializeAuth } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userName = user?.full_name || 'Explorer';

  // Notifications State
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await apiService.getNotifications();
      if (data?.notifications) {
        setNotifs(data.notifications);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // offline or unauthenticated
    }
  };

  useEffect(() => {
    setMounted(true);
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 20000); // ambient poll every 20s
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.is_read) {
      try {
        await apiService.markNotificationRead(n.id);
        setNotifs((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark notification read:', err);
      }
    }
    setShowNotifMenu(false);

    // Deep-link contextually
    if (n.payload?.trip_id) {
      router.push(`/trips?tripId=${n.payload.trip_id}`);
    } else if (n.type?.startsWith('FRIEND')) {
      router.push('/profile');
    }
  };

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
            <>
              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifMenu(!showNotifMenu)}
                  className="relative p-2.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Open notifications"
                  aria-expanded={showNotifMenu}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                    </span>
                  )}
                </button>

                {showNotifMenu && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl py-3 z-50 animate-in fade-in zoom-in-95 text-xs">
                    {/* Header */}
                    <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-extrabold border border-orange-200">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[11px] font-bold text-orange-600 hover:text-orange-800 cursor-pointer flex items-center gap-1"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    {/* List of notifications */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {loadingNotifs ? (
                        <div className="p-8 text-center text-slate-400 space-y-1">
                          <Clock className="w-4 h-4 mx-auto animate-spin text-orange-500" />
                          <p>Loading alerts...</p>
                        </div>
                      ) : notifs.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 space-y-1">
                          <Bell className="w-6 h-6 mx-auto text-slate-300" />
                          <p className="font-bold text-slate-700">All caught up!</p>
                          <p className="text-[11px] text-slate-400">No new squad invites or itinerary updates.</p>
                        </div>
                      ) : (
                        notifs.map((n) => {
                          const isRev = n.type === 'ITINERARY_REVISED' || n.type === 'SQUAD_SUGGESTION_CREATED';
                          const isFr = n.type === 'FRIEND_REQUEST' || n.type === 'FRIEND_ACCEPTED';
                          const isSq =
                            n.type === 'INTEREST_RECEIVED' ||
                            n.type === 'INTEREST_APPROVED' ||
                            n.type === 'INTEREST_REJECTED';

                          return (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${
                                !n.is_read ? 'bg-orange-50/40' : ''
                              }`}
                            >
                              <div className="shrink-0 mt-0.5">
                                {isRev ? (
                                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </div>
                                ) : isFr ? (
                                  <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
                                    <UserPlus className="w-3.5 h-3.5" />
                                  </div>
                                ) : isSq ? (
                                  <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center">
                                    <Users className="w-3.5 h-3.5" />
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                                    <Bell className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 space-y-0.5 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p
                                    className={`text-xs truncate ${
                                      !n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                                    }`}
                                  >
                                    {n.title}
                                  </p>
                                  {!n.is_read && (
                                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{n.body}</p>
                                <p className="text-[10px] text-slate-400 pt-0.5">
                                  {n.created_at
                                    ? new Date(n.created_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : 'recently'}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Menu */}
              <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 p-1.5 pr-2.5 rounded-full shadow-2xs transition-colors cursor-pointer min-h-[44px]"
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
                <div className="absolute right-0 mt-2 w-60 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 text-xs">
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
                      href="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between font-medium"
                    >
                      <div className="flex items-center gap-2.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Traveler Profile & Preferences</span>
                      </div>
                      <span className="text-[10px] text-orange-600 bg-orange-50 font-bold px-1.5 py-0.5 rounded-full border border-orange-200">
                        AI DNA
                      </span>
                    </Link>
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
          </>
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

