import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'indigo' | 'cyan' | 'gold' | 'emerald' | 'rose' | 'slate';
}

export function Badge({ className, variant = 'indigo', children, ...props }: BadgeProps) {
  const variants = {
    indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    gold: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-sm',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
