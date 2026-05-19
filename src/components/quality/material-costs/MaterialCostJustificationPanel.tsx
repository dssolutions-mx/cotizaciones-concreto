'use client';

import { Calculator, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PriceJustification } from '@/lib/materialCostTrend';
import { formatPriceMxnKg } from '@/lib/materialCostTrend';

type Props = {
  justification: PriceJustification | null;
  lastPrice: number | null;
};

export default function MaterialCostJustificationPanel({
  justification,
  lastPrice,
}: Props) {
  if (!justification) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-500 text-center">
        Sin datos suficientes para justificar el precio en el período seleccionado.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/40 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-sky-100 flex items-start gap-2">
        <Calculator className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Justificación del último precio</h2>
          <p className="text-xs text-stone-600 mt-0.5">{justification.headline}</p>
        </div>
        {lastPrice != null && (
          <p className="ml-auto text-lg font-bold tabular-nums text-stone-900 shrink-0">
            {formatPriceMxnKg(lastPrice)}
          </p>
        )}
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs font-mono text-stone-700 bg-white/80 rounded-md px-2.5 py-1.5 border border-sky-100">
          {justification.formula}
        </p>
        <ul className="text-sm text-stone-600 space-y-1 list-disc pl-4">
          {justification.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {justification.caution && (
          <p
            className={cn(
              'flex items-start gap-1.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2'
            )}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {justification.caution}
          </p>
        )}
      </div>
    </div>
  );
}
