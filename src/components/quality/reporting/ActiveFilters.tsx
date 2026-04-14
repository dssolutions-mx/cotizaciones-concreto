'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type ActiveFilterChip = {
  id: string;
  label: string;
  onRemove?: () => void;
  tone?: 'default' | 'muted' | 'accent';
};

export function ActiveFilters({
  chips,
  className,
}: {
  chips: ActiveFilterChip[];
  className?: string;
}) {
  if (!chips.length) return null;

  const toneClass: Record<NonNullable<ActiveFilterChip['tone']>, string> = {
    default: 'border-stone-200 bg-white text-stone-800',
    muted: 'border-stone-200 bg-stone-50 text-stone-600',
    accent: 'border-stone-300 bg-stone-100 text-stone-900',
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {chips.map((chip) => (
        <div
          key={chip.id}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            toneClass[chip.tone ?? 'default']
          )}
        >
          <span className="max-w-[240px] truncate">{chip.label}</span>
          {chip.onRemove && (
            <button
              type="button"
              onClick={chip.onRemove}
              className="rounded-full p-0.5 text-stone-500 hover:bg-stone-200/80 hover:text-stone-900"
              aria-label={`Quitar filtro ${chip.label}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
