'use client';

import { useMemo, useState } from 'react';
import { subMonths, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { defaultReceiptRange } from '@/lib/materialCostTrend';

export function useMaterialCostDateRange(initialMonths = 6) {
  const defaults = useMemo(() => defaultReceiptRange(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subMonths(new Date(), initialMonths),
    to: new Date(),
  }));

  const from =
    dateRange?.from != null
      ? format(dateRange.from, 'yyyy-MM-dd')
      : defaults.from;
  const to =
    dateRange?.to != null ? format(dateRange.to, 'yyyy-MM-dd') : defaults.to;

  return { dateRange, setDateRange, from, to };
}
