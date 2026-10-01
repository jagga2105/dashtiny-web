import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'glow';
  interactive?: boolean;
}

export function Card({
  children,
  className,
  variant = 'glass',
  interactive = false,
  ...props
}: CardProps) {
  const baseStyles = 'rounded-3xl p-5 md:p-6 transition-all duration-300 relative';
  
  const variants = {
    default: 'bg-white border border-slate-200/90 text-slate-900 shadow-sm',
    glass: 'bg-white/90 backdrop-blur-xl border border-slate-200/80 text-slate-900 shadow-sm',
    glow: 'bg-gradient-to-br from-white via-orange-50/30 to-sky-50/30 border border-orange-200/80 text-slate-900 shadow-md',
  };

  const interactiveStyles = interactive
    ? 'hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-300 cursor-pointer active:scale-[0.99]'
    : '';

  return (
    <div
      className={cn(baseStyles, variants[variant], interactiveStyles, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 pb-4 border-b border-slate-100', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-bold tracking-tight text-slate-900', className)} {...props}>
      {children}
    </h3>
  );
}
