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
};

export default function MaterialCostChart({
  series,
  height = 220,
  showCutover = true,
  compact = false,
}: Props) {
  const data = series.map((p) => ({
    ...p,
    label: formatBucketLabel(p.periodStart, p.granularity),
    price: p.avgPricePerKg,
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
            tick={{ fontSize: compact ? 9 : 11 }}
            interval={compact ? 'preserveStartEnd' : 0}
            angle={compact ? -35 : 0}
            textAnchor={compact ? 'end' : 'middle'}
            height={compact ? 48 : 28}
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
            formatter={(value: number) => [formatPriceMxnKg(value), 'Precio']}
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
                    ? 'Último precio (sin recepción)'
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
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1, stroke: '#fff' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
