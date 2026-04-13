'use client';

import { cn } from '@/lib/utils';

type Props = {
  values: number[];
  className?: string;
};

/** Compact SVG sparkline for price trend (last N months). */
export function MaterialPriceSparkline({ values, className }: Props) {
  if (values.length < 2) {
    return <span className={cn('text-[10px] text-muted-foreground', className)}>—</span>;
  }
  const w = 72;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={w}
      height={h}
      className={cn('text-emerald-600/90 shrink-0', className)}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" points={points} />
    </svg>
  );
}
