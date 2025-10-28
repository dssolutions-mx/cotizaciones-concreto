'use client';

import React, { useMemo, useState } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRange } from 'react-day-picker';
import { DateRangePickerWithPresets } from '@/components/ui/date-range-picker-with-presets';
import { useFinancialAnalysis } from '@/hooks/useFinancialAnalysis';
import { FinancialAnalysisTable } from '@/components/finanzas/FinancialAnalysisTable';

export default function ProduccionAnalisisPage() {
  const [range, setRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const { from, to } = range;
  const { data, isLoading, error, refetch } = useFinancialAnalysis(from, to);

  const subtitle = useMemo(() => {
    if (!from || !to) return '';
    return `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;
  }, [from, to]);

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Análisis Financiero de Producción</CardTitle>
              <div className="text-sm text-muted-foreground">{subtitle}</div>
            </div>
            <div className="w-[320px]">
              <DateRangePickerWithPresets value={range} onChange={setRange} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-red-600 text-sm">{String((error as any)?.message || error)}</div>
          ) : isLoading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : (
            <FinancialAnalysisTable data={data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}


