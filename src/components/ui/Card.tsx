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
  variant = 'default',
  interactive = false,
  ...props
}: CardProps) {
  const baseStyles = 'rounded-2xl p-5 md:p-6 transition-all duration-150 relative';

  const variants = {
    default: 'bg-white border border-slate-200 text-slate-900 shadow-2xs',
    glass: 'bg-white/80 backdrop-blur-md border border-slate-200/80 text-slate-900 shadow-sm',
    glow: 'bg-gradient-to-br from-white via-orange-50/20 to-sky-50/20 border border-orange-200/80 text-slate-900 shadow-sm',
  };

  const interactiveStyles = interactive
    ? 'hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 cursor-pointer active:scale-[0.99]'
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
