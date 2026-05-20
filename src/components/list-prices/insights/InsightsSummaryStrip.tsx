'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { MarketFit, PerformanceRow } from '../shared';

interface Props {
  rows: PerformanceRow[];
  refreshedAt: string | null;
}

export function InsightsSummaryStrip({ rows, refreshedAt }: Props) {
  const counts: Record<MarketFit, number> = {
    NO_DATA: 0,
    UNDERSET: 0,
    FIT: 0,
    OVERSET: 0,
  };

  let totalVolume = 0;
  rows.forEach((r) => {
    const fit = (r.market_fit ?? 'NO_DATA') as MarketFit;
    if (counts[fit] !== undefined) counts[fit] += 1;
    totalVolume += Number(r.total_volume_m3 ?? 0);
  });

  const refreshedLabel = refreshedAt
    ? new Date(refreshedAt).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  const cards = [
    { label: 'Subestimado', value: counts.UNDERSET, valueClass: 'text-amber-700' },
    { label: 'Competitivo', value: counts.FIT, valueClass: 'text-green-700' },
    { label: 'Sobrevaluado', value: counts.OVERSET, valueClass: 'text-blue-700' },
    { label: 'Sin datos', value: counts.NO_DATA, valueClass: 'text-slate-600' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="border-slate-200/80 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{c.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${c.valueClass}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-slate-200/80 shadow-sm col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Volumen analizado</p>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {totalVolume.toLocaleString('es-MX', { maximumFractionDigits: 1 })} m³
            </p>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-slate-500">
        Datos al {refreshedLabel}. Cotizaciones <strong>APPROVED</strong> con{' '}
        <code className="text-[11px] bg-slate-100 px-1 rounded">pricing_path = LIST_PRICE</code>.
      </p>
    </div>
  );
}
