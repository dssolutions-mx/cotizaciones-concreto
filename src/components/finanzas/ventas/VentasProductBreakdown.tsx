'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import type { VentasProductGroupMode } from '@/hooks/useVentasChartAggregates';

type Row = { name: string; volume: number; amount: number };

interface VentasProductBreakdownProps {
  productCodeAmountData: Row[];
  productCodeVolumeData: { name: string; volume: number }[];
  includeVAT: boolean;
  productGroupMode: VentasProductGroupMode;
  onProductGroupModeChange: (mode: VentasProductGroupMode) => void;
}

export function VentasProductBreakdown({
  productCodeAmountData,
  productCodeVolumeData,
  includeVAT,
  productGroupMode,
  onProductGroupModeChange,
}: VentasProductBreakdownProps) {
  const [metricMode, setMetricMode] = useState<'volume' | 'amount'>('volume');

  const rows = useMemo(() => {
    const byName = new Map<string, { volume: number; amount: number }>();
    productCodeAmountData.forEach((r) => {
      byName.set(r.name, { volume: r.volume, amount: r.amount });
    });
    productCodeVolumeData.forEach((r) => {
      const cur = byName.get(r.name) || { volume: 0, amount: 0 };
      cur.volume = r.volume;
      byName.set(r.name, cur);
    });
    const list = Array.from(byName.entries()).map(([name, v]) => ({ name, ...v }));
    const sorted =
      metricMode === 'volume'
        ? list.sort((a, b) => b.volume - a.volume)
        : list.sort((a, b) => b.amount - a.amount);
    const top = sorted.slice(0, 10);
    const rest = sorted.slice(10);
    const otherVol = rest.reduce((s, r) => s + r.volume, 0);
    const otherAmt = rest.reduce((s, r) => s + r.amount, 0);
    if (rest.length) {
      top.push({ name: 'Otros', volume: otherVol, amount: otherAmt });
    }
    const max =
      metricMode === 'volume'
        ? Math.max(...top.map((r) => r.volume), 1e-9)
        : Math.max(...top.map((r) => r.amount), 1e-9);
    return top.map((r) => ({
      ...r,
      pct: metricMode === 'volume' ? (r.volume / max) * 100 : (r.amount / max) * 100,
      label: metricMode === 'volume' ? `${r.volume.toFixed(1)} m³` : formatCurrency(r.amount),
    }));
  }, [productCodeAmountData, productCodeVolumeData, metricMode]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-thick rounded-3xl border border-label-tertiary/10 p-6"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title-3 font-semibold text-label-primary">Desglose por producto</h2>
          <p className="text-caption text-label-tertiary">
            Top 10 + otros · precios alineados al reporte (remisiones con precio)
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="glass-thin inline-flex rounded-2xl border border-label-tertiary/10 p-1">
            <button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-caption font-medium transition-colors ${
                productGroupMode === 'master'
                  ? 'bg-systemBlue text-white'
                  : 'text-label-secondary'
              }`}
              onClick={() => onProductGroupModeChange('master')}
            >
              Vista comercial
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-caption font-medium transition-colors ${
                productGroupMode === 'recipe_code'
                  ? 'bg-systemPurple text-white'
                  : 'text-label-secondary'
              }`}
              onClick={() => onProductGroupModeChange('recipe_code')}
            >
              Vista técnica
            </button>
          </div>
          <div className="glass-thin inline-flex rounded-2xl border border-label-tertiary/10 p-1">
            <button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-caption font-medium transition-colors ${
                metricMode === 'volume' ? 'bg-systemBlue text-white' : 'text-label-secondary'
              }`}
              onClick={() => setMetricMode('volume')}
            >
              Volumen
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-caption font-medium transition-colors ${
                metricMode === 'amount' ? 'bg-systemGreen text-white' : 'text-label-secondary'
              }`}
              onClick={() => setMetricMode('amount')}
            >
              Monto{includeVAT ? ' (IVA fiscal)' : ''}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r, idx) => (
          <div key={`${r.name}-${idx}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="flex justify-between gap-2 text-callout">
                <span className="truncate font-medium text-label-primary">{r.name}</span>
                <span className="shrink-0 tabular-nums text-label-secondary">{r.label}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-label-tertiary/10">
                <div
                  className={`h-full rounded-full ${metricMode === 'volume' ? 'bg-systemBlue' : 'bg-systemGreen'}`}
                  style={{ width: `${Math.min(100, r.pct)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-callout text-label-tertiary">Sin datos de producto en el período.</p>
        )}
      </div>
    </motion.div>
  );
}
