import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'glass-thin px-3 py-2 rounded-xl text-body text-gray-900',
        'border border-white/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
        'placeholder:text-gray-400',
        className
      )}
      {...props}
    />
  );
}); 