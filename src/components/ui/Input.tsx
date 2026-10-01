import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && <div className="absolute left-3.5 text-gray-400">{icon}</div>}
          <input
            type={type}
            ref={ref}
            className={cn(
              'w-full glass-input rounded-xl px-4 py-2.5 text-sm transition-all placeholder:text-gray-500',
              icon ? 'pl-10' : '',
              error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : '',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-rose-400 mt-1 font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
