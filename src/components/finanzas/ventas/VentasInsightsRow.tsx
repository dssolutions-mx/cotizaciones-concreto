'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import type { SummaryMetrics } from '@/utils/salesDataProcessor';
import type { VentasRemisionTrendMonth } from '@/lib/finanzas/ventas/buildVentasMonthlyTrendFromRemisiones';

function MicroSparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const w = 88;
  const h = 32;
  if (!values.length) {
    return <div className="text-caption text-label-tertiary">Sin serie</div>;
  }
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - 4) + 2;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="mt-2" aria-hidden>
      <polyline fill="none" points={pts} stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MiniDonut({ pctCash }: { pctCash: number }) {
  return (
    <div
      className="relative h-14 w-14 shrink-0 rounded-full border border-label-tertiary/10"
      style={{
        background: `conic-gradient(from -90deg, #34C759 0 ${pctCash}%, #007AFF ${pctCash}% 100%)`,
      }}
      aria-hidden
    >
      <div className="absolute inset-2 rounded-full bg-background-primary" />
    </div>
  );
}

interface VentasInsightsRowProps {
  summaryMetrics: SummaryMetrics;
  includeVAT: boolean;
  remisionTrendPoints: VentasRemisionTrendMonth[];
  orderCount: number;
}

export function VentasInsightsRow({
  summaryMetrics,
  includeVAT,
  remisionTrendPoints,
  orderCount,
}: VentasInsightsRowProps) {
  const cash = includeVAT ? summaryMetrics.cashAmountWithVAT : summaryMetrics.cashAmount;
  const inv = includeVAT ? summaryMetrics.invoiceAmountWithVAT : summaryMetrics.invoiceAmount;
  const payTotal = cash + inv || 1;
  const pctCash = (cash / payTotal) * 100;
  const pctInvoice = (inv / payTotal) * 100;

  const total =
    includeVAT ? summaryMetrics.totalAmountWithVAT : summaryMetrics.totalAmount;
  const ticket = orderCount > 0 ? total / orderCount : 0;

  const { ratioSeries, latestRatio } = useMemo(() => {
    const series = remisionTrendPoints.map((p) => {
      const denom = p.concreteVolume + p.pumpVolume;
      return denom > 0 ? (p.pumpVolume / denom) * 100 : 0;
    });
    const last = series.length ? series[series.length - 1] : 0;
    return { ratioSeries: series.slice(-12), latestRatio: last };
  }, [remisionTrendPoints]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-thick rounded-3xl border border-label-tertiary/10 p-5"
      >
        <p className="text-title-3 font-semibold text-label-primary">Mix de pago</p>
        <p className="text-caption text-label-tertiary">Distribución en el período</p>
        <div className="mt-3 flex items-center gap-4">
          <MiniDonut pctCash={pctCash} />
          <div className="min-w-0 space-y-1 text-callout">
            <p className="text-label-secondary">
              <span className="inline-block h-2 w-2 rounded-full bg-systemGreen align-middle" />{' '}
              Efectivo {pctCash.toFixed(1)}%
            </p>
            <p className="text-label-secondary">
              <span className="inline-block h-2 w-2 rounded-full bg-systemBlue align-middle" />{' '}
              Fiscal {pctInvoice.toFixed(1)}%
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-thick rounded-3xl border border-label-tertiary/10 p-5"
      >
        <p className="text-title-3 font-semibold text-label-primary">Bombeo / concreto</p>
        <p className="text-caption text-label-tertiary">% volumen bombeo (histórico 24m, misma fuente que tendencias)</p>
        <p className="mt-2 text-title-1 font-bold tabular-nums text-systemPurple">
          {latestRatio.toFixed(1)}%
        </p>
        <MicroSparkline values={ratioSeries} stroke="#AF52DE" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-thick rounded-3xl border border-label-tertiary/10 p-5"
      >
        <p className="text-title-3 font-semibold text-label-primary">Ticket por orden</p>
        <p className="text-caption text-label-tertiary">Promedio simple (# órdenes únicas)</p>
        <p className="mt-2 text-title-1 font-bold tabular-nums text-systemBlue">{formatCurrency(ticket)}</p>
        <p className="mt-2 text-callout text-label-secondary">{orderCount} órdenes</p>
      </motion.div>
    </div>
  );
}
