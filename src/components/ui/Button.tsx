import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99]';

  const variants = {
    primary:
      'bg-orange-600 hover:bg-orange-700 text-white shadow-2xs border border-orange-700/20',
    gradient:
      'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-sm shadow-orange-500/20 border border-orange-400/30',
    secondary: 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-2xs',
    accent: 'bg-sky-600 hover:bg-sky-700 text-white shadow-2xs border border-sky-700/20',
    outline:
      'bg-white border border-slate-200 text-slate-800 hover:text-slate-950 hover:bg-slate-50 shadow-2xs',
    ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-2 space-x-1.5 min-h-[32px]',
    md: 'text-sm px-5 py-2.5 space-x-2 min-h-[40px]',
    lg: 'text-base px-7 py-3.5 space-x-2.5 min-h-[48px]',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
      )}
      {children}
    </button>
  );
}
