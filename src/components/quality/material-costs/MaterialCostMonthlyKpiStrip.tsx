'use client';

import { cn } from '@/lib/utils';
import type { CostTrendPoint } from '@/lib/materialCostTrend';
import {
  MATERIAL_COST_CUTOVER,
  formatBucketLabel,
  formatPriceMxnKg,
  monthlyBucketPctChange,
} from '@/lib/materialCostTrend';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

type Props = {
  buckets: CostTrendPoint[];
  maxMonths?: number;
  className?: string;
};

export default function MaterialCostMonthlyKpiStrip({
  buckets,
  maxMonths = 6,
  className,
}: Props) {
  const months = buckets
    .filter(
      (b) =>
        b.source === 'receipt' &&
        b.periodStart >= MATERIAL_COST_CUTOVER &&
        (b.receiptCount ?? 0) > 0
    )
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .slice(-maxMonths);

  if (months.length === 0) {
    return (
      <p className="text-xs text-stone-400 text-center py-3">
        Sin recepciones revisadas con landed en meses recientes
      </p>
    );
  }

  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1 -mx-1 px-1', className)}>
      {months.map((m) => {
        const pct = monthlyBucketPctChange(buckets, m.periodStart);
        const TrendIcon =
          pct == null || pct === 0 ? Minus : pct > 0 ? TrendingUp : TrendingDown;
        const trendClass =
          pct == null || pct === 0
            ? 'text-stone-400'
            : pct > 0
              ? 'text-red-600'
              : 'text-emerald-600';

        return (
          <div
            key={m.periodStart}
            className="shrink-0 min-w-[108px] rounded-xl border border-sky-100 bg-sky-50/40 px-3 py-2.5"
          >
            <p className="text-[10px] font-medium text-sky-800/80 uppercase tracking-wide">
              {formatBucketLabel(m.periodStart, 'month')}
            </p>
            <p className="text-base font-bold text-stone-900 tabular-nums mt-0.5">
              {formatPriceMxnKg(m.avgPricePerKg)}
            </p>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-[10px] text-stone-500 tabular-nums">
                {m.receiptCount} recep. · {(m.totalQtyKg ?? 0).toFixed(0)} kg
              </span>
              {pct != null && (
                <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium', trendClass)}>
                  <TrendIcon className="h-2.5 w-2.5" />
                  {pct > 0 ? '+' : ''}
                  {pct}%
                </span>
              )}
            </div>
            {m.minPrice != null && m.maxPrice != null && m.minPrice !== m.maxPrice && (
              <p className="text-[9px] text-stone-400 mt-1 tabular-nums">
                {formatPriceMxnKg(m.minPrice)} – {formatPriceMxnKg(m.maxPrice)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
