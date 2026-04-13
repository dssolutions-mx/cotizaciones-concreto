'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addMonths, parseMonthStart, startOfMonthDate } from '@/lib/materialPricePeriod';

const MONTH_FMT = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' });

export type MonthNavigatorProps = {
  periodStart: string;
  onChange: (periodStart: string) => void;
  /** Month pills on each side of center (default 2 → five pills). */
  radius?: number;
  className?: string;
};

function labelForPeriod(periodStart: string) {
  const d = parseMonthStart(periodStart);
  return MONTH_FMT.format(d).replace(/\./g, '');
}

export function MonthNavigator({ periodStart, onChange, radius = 2, className }: MonthNavigatorProps) {
  const todayMonth = startOfMonthDate(new Date());
  const pills: string[] = [];
  for (let i = -radius; i <= radius; i++) {
    pills.push(addMonths(periodStart, i));
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange(addMonths(periodStart, -1))} aria-label="Mes anterior">
        «
      </Button>
      <div className="flex flex-wrap items-center gap-1.5">
        {pills.map((p) => {
          const isSelected = p === periodStart;
          const isTodayMonth = p === todayMonth;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors border',
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-white/70 text-gray-700 border-white/50 hover:bg-white hover:border-emerald-200',
                !isSelected && isTodayMonth && 'ring-1 ring-amber-300/80'
              )}
            >
              {labelForPeriod(p)}
            </button>
          );
        })}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange(addMonths(periodStart, 1))} aria-label="Mes siguiente">
        »
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange(todayMonth)}>
        Mes actual
      </Button>
    </div>
  );
}
