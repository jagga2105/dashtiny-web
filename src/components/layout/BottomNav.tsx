'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Sparkles, Luggage, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Explore', href: '/dashboard', icon: Compass },
    { label: 'Plan', href: '/planner', icon: Sparkles },
    { label: 'Trips', href: '/trips', icon: Luggage },
    { label: 'Community', href: '/community', icon: Users },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-slate-200 px-3 py-2 shadow-lg pb-[calc(env(safe-area-inset-bottom,0px)+8px)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-colors relative min-w-[56px]',
                isActive
                  ? 'text-orange-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {/* Active top line */}
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-orange-500" />
              )}
              <Icon className={cn('w-5 h-5', isActive ? 'text-orange-600' : 'text-slate-400')} />
              <span className={cn('text-[11px] font-medium tracking-tight', isActive ? 'text-orange-600 font-semibold' : 'text-slate-500')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

