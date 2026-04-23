'use client';

import { useMemo } from 'react';
import {
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
  subDays,
} from 'date-fns';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';

type ClientBar = { name: string; value: number; volume?: number };

function countUniqueClientsInRange(remisiones: any[], from: Date, to: Date) {
  const s = startOfDay(from);
  const e = endOfDay(to);
  const set = new Set<string>();
  for (const r of remisiones) {
    const d = new Date(r.fecha);
    if (Number.isNaN(d.getTime()) || d < s || d > e) continue;
    const id = r.order?.client_id;
    if (id != null && id !== '') set.add(String(id));
  }
  return set.size;
}

interface VentasClientsCardProps {
  clientAmountData: ClientBar[];
  currentRemisiones: any[];
  historicalRemisiones: any[];
  startDate?: Date;
  endDate?: Date;
}

export function VentasClientsCard({
  clientAmountData,
  currentRemisiones,
  historicalRemisiones,
  startDate,
  endDate,
}: VentasClientsCardProps) {
  const currentActive = useMemo(() => {
    const set = new Set<string>();
    for (const r of currentRemisiones) {
      const id = r.order?.client_id;
      if (id != null && id !== '') set.add(String(id));
    }
    return set.size;
  }, [currentRemisiones]);

  const { prevActive, delta } = useMemo(() => {
    if (!startDate || !endDate || !historicalRemisiones?.length) {
      return { prevActive: null as number | null, delta: null as number | null };
    }
    const len = differenceInCalendarDays(endDate, startDate) + 1;
    const prevEnd = endOfDay(subDays(startOfDay(startDate), 1));
    const prevStart = startOfDay(subDays(prevEnd, len - 1));
    const prev = countUniqueClientsInRange(historicalRemisiones, prevStart, prevEnd);
    return { prevActive: prev, delta: currentActive - prev };
  }, [startDate, endDate, historicalRemisiones, currentActive]);

  const bars = useMemo(() => {
    const sorted = [...clientAmountData].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const otherAmt = rest.reduce((s, r) => s + r.value, 0);
    if (rest.length) top.push({ name: 'Otros', value: otherAmt });
    const max = Math.max(...top.map((r) => r.value), 1e-9);
    return top.map((r) => ({ ...r, pct: (r.value / max) * 100 }));
  }, [clientAmountData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-thick rounded-3xl border border-label-tertiary/10 p-6"
    >
      <h2 className="text-title-3 font-semibold text-label-primary">Clientes</h2>
      <p className="text-caption text-label-tertiary">Concentración por monto y actividad en el período</p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <p className="text-callout font-medium text-label-secondary">Top clientes (monto)</p>
          <div className="mt-3 space-y-3">
            {bars.map((r) => (
              <div key={r.name}>
                <div className="flex justify-between gap-2 text-callout">
                  <span className="truncate text-label-primary">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-label-secondary">{formatCurrency(r.value)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-label-tertiary/10">
                  <div className="h-full rounded-full bg-systemBlue" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
            {bars.length === 0 && (
              <p className="text-callout text-label-tertiary">Sin clientes en la vista.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-systemGreen/20 bg-gradient-to-br from-systemGreen/10 to-systemGreen/5 p-6">
          <p className="text-callout font-medium text-label-secondary">Clientes activos (período)</p>
          <p className="mt-2 text-title-1 font-bold tabular-nums text-label-primary">{currentActive}</p>
          {delta != null && prevActive != null && (
            <p className="mt-2 text-callout text-label-secondary">
              vs. ventana anterior:{' '}
              <span className={delta >= 0 ? 'text-systemGreen' : 'text-systemOrange'}>
                {delta >= 0 ? '+' : ''}
                {delta}
              </span>{' '}
              <span className="text-caption text-label-tertiary">(antes {prevActive})</span>
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
