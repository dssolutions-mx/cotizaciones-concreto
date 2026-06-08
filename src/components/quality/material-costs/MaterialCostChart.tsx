'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from 'recharts';
import type { CostTrendPoint } from '@/lib/materialCostTrend';
import {
  MATERIAL_COST_CUTOVER,
  formatBucketLabel,
  formatPriceMxnKg,
} from '@/lib/materialCostTrend';

type Props = {
  series: CostTrendPoint[];
  height?: number;
  showCutover?: boolean;
  compact?: boolean;
  /** Emphasize monthly KPI (fewer ticks, thicker line for receipt months). */
  kpiMode?: boolean;
};

export default function MaterialCostChart({
  series,
  height = 220,
  showCutover = true,
  compact = false,
  kpiMode = false,
}: Props) {
  const data = series.map((p) => ({
    ...p,
    label: formatBucketLabel(p.periodStart, p.granularity),
    price: p.avgPricePerKg,
    isList: p.source === 'list',
    isCarried: p.carriedForward === true,
  }));

  if (data.length === 0) {
    return (
      <p className="text-sm text-stone-400 text-center py-8 border border-dashed border-stone-200 rounded-xl">
        Sin datos de precio en el rango seleccionado
      </p>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: compact ? 9 : kpiMode ? 10 : 11 }}
            interval={kpiMode ? 0 : compact ? 'preserveStartEnd' : 0}
            angle={compact || kpiMode ? -30 : 0}
            textAnchor={compact || kpiMode ? 'end' : 'middle'}
            height={compact || kpiMode ? 44 : 28}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={56}
            tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e7e5e4',
              fontSize: 12,
            }}
            formatter={(value: number, _name, item) => {
              const row = item?.payload as { receiptCount?: number; totalQtyKg?: number };
              const extra =
                row?.receiptCount && row.receiptCount > 0
                  ? ` · ${row.receiptCount} recep., ${(row.totalQtyKg ?? 0).toFixed(0)} kg`
                  : '';
              return [formatPriceMxnKg(value) + extra, 'Precio'];
            }}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as CostTrendPoint & {
                label: string;
                carriedForward?: boolean;
              };
              if (!row) return '';
              const src =
                row.source === 'list'
                  ? 'Lista mensual'
                  : row.carriedForward
                    ? 'Último mes (sin recepción nueva)'
                    : row.granularity === 'month'
                      ? 'Promedio mensual landed (Σ kg×precio ÷ Σ kg)'
                      : 'Promedio recepciones (landed)';
              return `${row.label} · ${src}`;
            }}
          />
          {showCutover && (
            <ReferenceLine
              x={
                data.find((d) => d.periodStart >= MATERIAL_COST_CUTOVER)?.label ??
                undefined
              }
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={
                compact
                  ? undefined
                  : {
                      value: 'Abr 2026',
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: '#64748b',
                    }
              }
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#0ea5e9"
            strokeWidth={kpiMode ? 2.5 : 2}
            strokeDasharray={kpiMode ? undefined : undefined}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const p = payload as { isList?: boolean; isCarried?: boolean };
              const fill = p.isList ? '#059669' : p.isCarried ? '#94a3b8' : '#0ea5e9';
              const r = kpiMode && !p.isCarried ? 4 : 3;
              return (
                <Dot
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  stroke="#fff"
                  strokeWidth={1}
                />
              );
            }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
