'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { ClientQualityData } from '@/types/clientQuality';

/** Monthly X-bar style chart: average resistance per month with overall mean and ±2σ from monthly averages. */
export function ClientSpcChart({ data }: { data: ClientQualityData }) {
  const chart = useMemo(() => {
    const months = data.monthlyStats || [];
    if (months.length === 0) return null;

    const resistencias = months.map((m) => m.avgResistencia).filter((v) => v > 0);
    const mean = resistencias.reduce((a, b) => a + b, 0) / Math.max(1, resistencias.length);
    let variance = 0;
    if (resistencias.length > 1) {
      variance =
        resistencias.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (resistencias.length - 1);
    }
    const sigma = Math.sqrt(variance);
    const ucl = mean + 2 * sigma;
    const lcl = Math.max(0, mean - 2 * sigma);

    const points = months.map((m) => ({
      month: m.month,
      avgResistencia: m.avgResistencia,
      complianceRate: m.complianceRate,
    }));

    return { points, mean, ucl, lcl };
  }, [data.monthlyStats]);

  if (!chart) return null;

  const { points, mean, ucl, lcl } = chart;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Control de proceso (resistencia mensual)</CardTitle>
        <CardDescription>
          Promedio de resistencia por mes con líneas de referencia: media global y banda aproximada ±2σ entre meses.
          No sustituye estudios de capacidad formales; sirve como señal temprana de deriva.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
              <YAxis
                yAxisId="r"
                tick={{ fontSize: 11 }}
                label={{ value: 'R (kg/cm²)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="c"
                orientation="right"
                tick={{ fontSize: 11 }}
                label={{ value: 'Cumpl. %', angle: 90, position: 'insideRight' }}
              />
              <Tooltip />
              <Legend />
              <ReferenceLine yAxisId="r" y={mean} stroke="#57534e" strokeDasharray="4 4" label={{ value: 'Media', fill: '#57534e', fontSize: 10 }} />
              <ReferenceLine yAxisId="r" y={ucl} stroke="#b91c1c" strokeDasharray="3 3" label={{ value: 'UCL', fill: '#b91c1c', fontSize: 10 }} />
              <ReferenceLine yAxisId="r" y={lcl} stroke="#b91c1c" strokeDasharray="3 3" label={{ value: 'LCL', fill: '#b91c1c', fontSize: 10 }} />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="avgResistencia"
                name="Resistencia media"
                stroke="#0f766e"
                strokeWidth={2}
                dot
              />
              <Line
                yAxisId="c"
                type="monotone"
                dataKey="complianceRate"
                name="Cumplimiento %"
                stroke="#7c3aed"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
