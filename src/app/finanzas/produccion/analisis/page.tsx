'use client';

import React, { useMemo, useState } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRange } from 'react-day-picker';
import { DateRangePickerWithPresets } from '@/components/ui/date-range-picker-with-presets';
import { useFinancialAnalysis } from '@/hooks/useFinancialAnalysis';
import { FinancialAnalysisTable } from '@/components/finanzas/FinancialAnalysisTable';
import { finanzasHubCardClass } from '@/components/finanzas/finanzasHubUi';

export default function ProduccionAnalisisPage() {
  const [range, setRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { from, to } = range;
  const { data, isLoading, error } = useFinancialAnalysis(from, to);

  const subtitle = useMemo(() => {
    if (!from || !to) return '';
    return `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;
  }, [from, to]);

  return (
    <div className="min-w-0">
      <Card className={finanzasHubCardClass}>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-stone-900">
                Análisis financiero
              </CardTitle>
              <p className="text-sm text-stone-500 mt-1">{subtitle}</p>
            </div>
            <div className="w-full sm:w-[min(100%,20rem)] shrink-0">
              <DateRangePickerWithPresets value={range} onChange={setRange} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-red-700 text-sm" role="alert">
              {String((error as Error)?.message || error)}
            </div>
          ) : isLoading ? (
            <p className="text-sm text-stone-500">Cargando…</p>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <FinancialAnalysisTable data={data} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
