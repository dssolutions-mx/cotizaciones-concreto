/**
 * LoadingState Component
 *
 * Displays a loading skeleton or spinner.
 * Follows Apple HIG principles for clear feedback during async operations.
 */

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  /**
   * Optional loading message
   */
  message?: string;

  /**
   * Variant of loading state
   * - spinner: Centered spinner with message
   * - skeleton: Skeleton placeholder (for lists/grids)
   */
  variant?: 'spinner' | 'skeleton';

  /**
   * Number of skeleton rows to show
   */
  rows?: number;
}

export function LoadingState({
  message = 'Loading...',
  variant = 'spinner',
  rows = 3,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className="space-y-4 py-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Loader2 className="h-8 w-8 text-gray-400 animate-spin mb-3" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
