'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Award, DollarSign, Droplet, User } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export interface VentasAgentRow {
  agentId: string;
  agentName: string;
  totalVolume: number;
  totalRevenue: number;
  averagePrice: number;
  orderCount: number;
  month: string;
}

interface VentasAgentsCardProps {
  data: VentasAgentRow[];
  loading?: boolean;
  selectedMonth?: string;
}

export function VentasAgentsCard({ data, loading = false, selectedMonth }: VentasAgentsCardProps) {
  const [sortBy, setSortBy] = useState<'volume' | 'revenue' | 'avgPrice'>('revenue');

  const ranked = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      if (sortBy === 'volume') return b.totalVolume - a.totalVolume;
      if (sortBy === 'revenue') return b.totalRevenue - a.totalRevenue;
      return b.averagePrice - a.averagePrice;
    });
    return sorted.map((a, i) => ({ ...a, rank: i + 1 }));
  }, [data, sortBy]);

  if (loading) {
    return (
      <div className="glass-thick rounded-3xl border border-label-tertiary/10 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-1/3 rounded bg-label-tertiary/10" />
          <div className="h-24 rounded-2xl bg-label-tertiary/10" />
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="glass-thick rounded-3xl border border-label-tertiary/10 p-8 text-center">
        <User className="mx-auto mb-3 h-10 w-10 text-label-tertiary" />
        <p className="text-title-3 font-semibold text-label-primary">Sin datos de agentes</p>
        <p className="mt-1 text-callout text-label-secondary">Pruebe otro rango o alcance de plantas.</p>
      </div>
    );
  }

  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-thick rounded-3xl border border-label-tertiary/10 p-6"
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-title-3 font-semibold text-label-primary">Ranking de agentes</h2>
          <p className="text-caption text-label-tertiary">
            Compacto{selectedMonth ? ` · ${selectedMonth}` : ''}
          </p>
        </div>
        <div className="glass-thin inline-flex rounded-2xl border border-label-tertiary/10 p-1">
          {(
            [
              ['revenue', 'Ingresos'],
              ['volume', 'Volumen'],
              ['avgPrice', 'Precio prom.'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-caption font-medium transition-colors',
                sortBy === key ? 'bg-systemGreen text-white' : 'text-label-secondary hover:text-label-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {podium.map((a) => (
          <div
            key={a.agentId}
            className={cn(
              'rounded-2xl border p-4',
              a.rank === 1 && 'border-systemGreen/30 bg-gradient-to-br from-systemGreen/15 to-transparent',
              a.rank === 2 && 'border-systemBlue/30 bg-gradient-to-br from-systemBlue/15 to-transparent',
              a.rank === 3 && 'border-systemOrange/30 bg-gradient-to-br from-systemOrange/15 to-transparent'
            )}
          >
            <div className="flex items-center gap-2">
              {a.rank === 1 ? (
                <Award className="h-5 w-5 text-systemGreen" />
              ) : (
                <span className="text-caption font-bold text-label-tertiary">#{a.rank}</span>
              )}
              <p className="truncate text-callout font-semibold text-label-primary">{a.agentName}</p>
            </div>
            <p className="mt-2 text-title-2 font-bold tabular-nums text-label-primary">
              {sortBy === 'volume' && `${a.totalVolume.toFixed(1)} m³`}
              {sortBy === 'revenue' && formatCurrency(a.totalRevenue)}
              {sortBy === 'avgPrice' && formatCurrency(a.averagePrice)}
            </p>
            <p className="mt-1 text-caption text-label-tertiary">{a.orderCount} pedidos</p>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-label-tertiary/10">
          <table className="w-full text-left text-caption">
            <thead className="bg-label-tertiary/5 text-label-tertiary">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Agente</th>
                <th className="px-3 py-2 text-right font-medium">m³</th>
                <th className="px-3 py-2 text-right font-medium">$</th>
                <th className="px-3 py-2 text-right font-medium">$/m³</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((a) => (
                <tr key={a.agentId} className="border-t border-label-tertiary/10 hover:bg-systemBlue/5">
                  <td className="px-3 py-2 text-label-tertiary">{a.rank}</td>
                  <td className="max-w-[160px] truncate px-3 py-2 font-medium text-label-primary">
                    {a.agentName}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-label-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Droplet className="h-3 w-3 text-systemBlue" />
                      {a.totalVolume.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-label-secondary">
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-systemGreen" />
                      {formatCurrency(a.totalRevenue)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-label-secondary">
                    {formatCurrency(a.averagePrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
