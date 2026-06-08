'use client';

import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MATERIAL_COST_CUTOVER, PRICE_ALERT_PCT } from '@/lib/materialCostTrend';

export default function MaterialCostMethodologyPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-100/80 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-stone-800">
          <Info className="h-4 w-4 text-sky-600 shrink-0" />
          Cómo se calculan estos precios
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-stone-500 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 text-sm text-stone-600 space-y-3 border-t border-stone-200/80">
          <p>
            Este módulo muestra el <strong className="font-medium text-stone-800">precio unitario de compra</strong>{' '}
            (MXN/kg), no el costo total de producción ni el consumo en remisiones.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <span className="font-medium text-stone-800">Antes de {MATERIAL_COST_CUTOVER.slice(0, 7)}:</span>{' '}
              precio de lista mensual en <code className="text-xs bg-white px-1 rounded">material_prices</code>.
            </li>
            <li>
              <span className="font-medium text-stone-800">Desde {MATERIAL_COST_CUTOVER}:</span>{' '}
              promedio ponderado de{' '}
              <code className="text-xs bg-white px-1 rounded">landed_unit_price</code> en recepciones con{' '}
              <code className="text-xs bg-white px-1 rounded">pricing_status = reviewed</code>.
            </li>
            <li>
              <span className="font-medium text-stone-800">KPI principal (mes):</span> Σ (kg × landed) ÷ Σ kg por
              mes calendario — suaviza recepciones puntuales dentro del mismo mes.
            </li>
            <li>
              Vista semanal/diaria en detalle: misma fórmula por bucket; puede verse más volátil que el KPI mensual.
            </li>
            <li>
              Alertas cuando la variación vs el período anterior es ≥{PRICE_ALERT_PCT}%.
            </li>
          </ul>
          <p className="text-xs text-stone-500">
            Los reportes de finanzas (producción, FIFO) usan otra metodología (consumo × lista o capas FIFO). No
            deben compararse directamente con esta vista.
          </p>
        </div>
      )}
    </div>
  );
}
