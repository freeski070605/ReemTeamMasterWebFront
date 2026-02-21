import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ className, label, error, ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/60">
          {label}
        </label>
      )}
      <input
        className={cn(
          'flex h-11 w-full rounded-xl border border-white/14 bg-black/35 px-3 py-2 text-sm text-white placeholder:text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500/70 focus:ring-red-400',
          className
        )}
        {...props}
      />
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
};
