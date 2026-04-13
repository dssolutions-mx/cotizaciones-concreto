'use client';

import { cn } from '@/lib/utils';

export type PriceChangeIndicatorProps = {
  previous: number | null | undefined;
  current: number | null | undefined;
  className?: string;
};

export function PriceChangeIndicator({ previous, current, className }: PriceChangeIndicatorProps) {
  if (current == null || previous == null || previous === 0) {
    return <span className={cn('text-xs text-muted-foreground tabular-nums', className)}>—</span>;
  }
  const delta = current - previous;
  const pct = (delta / previous) * 100;
  const up = delta > 0;
  const flat = delta === 0;
  return (
    <span
      className={cn(
        'text-xs font-medium tabular-nums',
        flat && 'text-gray-500',
        !flat && up && 'text-red-600',
        !flat && !up && 'text-emerald-600',
        className
      )}
    >
      {flat ? '0%' : `${up ? '+' : ''}${pct.toFixed(1)}%`}
    </span>
  );
}
