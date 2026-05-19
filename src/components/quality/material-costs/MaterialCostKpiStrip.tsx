'use client';

import { Package, Truck, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { qualityHubSummaryStatusMap } from '@/components/quality/qualityHubUi';

export type MaterialCostSummaryRow = {
  id: string;
  material_name?: string;
  receiptCountInPeriod: number;
  missingLandedInPeriod: number;
  pendingReviewInPeriod?: number;
  hasAlert: boolean;
  pctChange: number | null;
  lastPrice: number | null;
};

type Props = {
  materials: MaterialCostSummaryRow[];
  periodLabel?: string;
};

export default function MaterialCostKpiStrip({ materials, periodLabel }: Props) {
  const total = materials.length;
  const withReceipts = materials.filter((m) => m.receiptCountInPeriod > 0).length;
  const missingLanded = materials.reduce((s, m) => s + m.missingLandedInPeriod, 0);
  const pendingReview = materials.reduce(
    (s, m) => s + (m.pendingReviewInPeriod ?? 0),
    0
  );
  const alertCount = materials.filter((m) => m.hasAlert).length;

  let maxPctMat: { name: string; pct: number } | null = null;
  for (const m of materials) {
    if (m.pctChange == null) continue;
    if (!maxPctMat || Math.abs(m.pctChange) > Math.abs(maxPctMat.pct)) {
      maxPctMat = {
        name: m.material_name ?? m.id,
        pct: m.pctChange,
      };
    }
  }

  const cards = [
    {
      label: 'Materiales activos',
      value: total,
      status: 'neutral' as const,
      icon: <Package className="h-3.5 w-3.5" />,
      hint: undefined as string | undefined,
    },
    {
      label: 'Con recepciones',
      value: withReceipts,
      status: (withReceipts > 0 ? 'ok' : 'neutral') as const,
      icon: <Truck className="h-3.5 w-3.5" />,
      hint: undefined,
    },
    {
      label: 'Pend. revisión precio',
      value: pendingReview,
      status: (pendingReview > 0 ? 'warning' : 'ok') as const,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      hint: missingLanded > 0 ? `${missingLanded} revisadas sin landed` : undefined,
    },
    {
      label: 'Alertas variación',
      value: alertCount,
      status: (alertCount > 0 ? 'critical' : 'ok') as const,
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      hint:
        maxPctMat != null
          ? `Máx ${maxPctMat.pct > 0 ? '+' : ''}${maxPctMat.pct.toFixed(1)}%`
          : undefined,
    },
  ];

  return (
    <div className="space-y-2">
      {periodLabel && (
        <p className="text-xs text-stone-500">Resumen del período {periodLabel}</p>
      )}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => {
        const s = qualityHubSummaryStatusMap[card.status];
        return (
          <div key={card.label} className={cn('rounded-xl border px-4 py-3', s.card)}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={s.label}>{card.icon}</span>
              <p className={cn('text-xs font-medium', s.label)}>{card.label}</p>
            </div>
            <p className={cn('text-2xl font-bold tracking-tight tabular-nums', s.value)}>
              {card.value}
            </p>
            {card.hint && (
              <p className="text-[10px] text-stone-500 mt-0.5">{card.hint}</p>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}
