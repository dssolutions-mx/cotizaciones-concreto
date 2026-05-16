'use client';

import Link from 'next/link';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import type { CostSource } from '@/lib/materialCostTrend';
import { formatPriceMxnKg } from '@/lib/materialCostTrend';

const CAT_ACCENT: Record<string, { border: string; badge: string; label: string }> = {
  cemento: {
    border: 'border-l-slate-400',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    label: 'Cemento',
  },
  aditivo: {
    border: 'border-l-violet-400',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    label: 'Aditivo',
  },
  arena: {
    border: 'border-l-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Arena',
  },
  grava: {
    border: 'border-l-stone-400',
    badge: 'bg-stone-100 text-stone-600 border-stone-300',
    label: 'Grava',
  },
  agregado: {
    border: 'border-l-stone-300',
    badge: 'bg-stone-50 text-stone-500 border-stone-200',
    label: 'Agregado',
  },
  agua: {
    border: 'border-l-sky-300',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    label: 'Agua',
  },
};

function getCatTokens(effectiveCategory: string) {
  return CAT_ACCENT[effectiveCategory] ?? CAT_ACCENT.agregado;
}

export type MaterialCostTrendCardProps = {
  materialId: string;
  materialName: string;
  effectiveCategory: string;
  subcategory?: string | null;
  supplier?: string | null;
  plantName?: string | null;
  sparkline: Array<{ date: string; value: number }>;
  lastPrice: number | null;
  pctChange: number | null;
  lastSource: CostSource | null;
  hasAlert?: boolean;
  plantId: string;
};

export default function MaterialCostTrendCard({
  materialId,
  materialName,
  effectiveCategory,
  subcategory,
  supplier,
  plantName,
  sparkline,
  lastPrice,
  pctChange,
  lastSource,
  hasAlert,
  plantId,
}: MaterialCostTrendCardProps) {
  const tokens = getCatTokens(effectiveCategory);
  const detailHref = `/quality/materiales-costo/${materialId}?plant_id=${encodeURIComponent(plantId)}`;

  const TrendIcon =
    pctChange == null || pctChange === 0
      ? Minus
      : pctChange > 0
        ? TrendingUp
        : TrendingDown;
  const trendColor =
    pctChange == null
      ? 'text-stone-400'
      : pctChange > 0
        ? 'text-red-600'
        : 'text-emerald-600';

  return (
    <div
      className={cn(
        'rounded-xl bg-white border border-stone-200 border-l-4 overflow-hidden',
        'flex flex-col shadow-sm hover:shadow-md transition-all duration-200',
        tokens.border,
        hasAlert && 'border-red-200 border-l-red-400'
      )}
    >
      <div className="px-4 pt-3 pb-2.5 border-b border-stone-100">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-stone-900 truncate leading-tight">
                {materialName}
              </span>
              {hasAlert && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Δ%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant="outline" className={cn('text-[10px] py-0 h-4 font-medium', tokens.badge)}>
                {tokens.label}
              </Badge>
              {subcategory?.trim() && (
                <span className="text-[10px] text-stone-400 truncate">{subcategory}</span>
              )}
              {supplier && (
                <span className="text-[10px] text-stone-400">· {supplier}</span>
              )}
              {plantName && (
                <span className="text-[10px] text-stone-400">· {plantName}</span>
              )}
            </div>
          </div>
          <Link
            href={detailHref}
            className="shrink-0 flex items-center gap-0.5 text-[11px] text-sky-600 hover:text-sky-700 font-medium whitespace-nowrap"
          >
            Detalle <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="px-4 py-3 flex items-end justify-between gap-3 min-h-[88px]">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">
            Último precio
          </p>
          <p className="text-lg font-bold text-stone-900 tabular-nums">
            {formatPriceMxnKg(lastPrice)}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {lastSource && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] py-0 h-4',
                  lastSource === 'list'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-sky-50 text-sky-800 border-sky-200'
                )}
              >
                {lastSource === 'list' ? 'Lista' : 'Recepción'}
              </Badge>
            )}
            {pctChange != null && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                  trendColor
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {pctChange > 0 ? '+' : ''}
                {pctChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {sparkline.length > 1 ? (
          <div className="w-[120px] h-14 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <YAxis hide domain={['auto', 'auto']} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0ea5e9"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[10px] text-stone-400 max-w-[100px] text-right">
            Sin historial suficiente
          </p>
        )}
      </div>
    </div>
  );
}
