'use client';

import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecipeQualityRemisionData } from '@/hooks/useProgressiveRecipeQuality';

export function RecipeCostTrendChart({ remisiones }: { remisiones: RecipeQualityRemisionData[] }) {
  const points = useMemo(() => {
    return [...remisiones]
      .filter((r) => r.costPerM3 != null && r.costPerM3 > 0)
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .map((r) => {
        let label: string;
        try {
          label = format(parseISO(r.fecha.slice(0, 10)), 'dd/MM');
        } catch {
          label = r.fecha;
        }
        return {
          label,
          fecha: r.fecha,
          costo: Number(r.costPerM3),
          remision: r.remisionNumber,
        };
      });
  }, [remisiones]);

  if (points.length === 0) {
    return (
      <Card className="border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Evolución de costo / m³</CardTitle>
          <CardDescription>Serie por remisión</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-stone-500">No hay costos registrados en el período.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Evolución de costo / m³</CardTitle>
        <CardDescription>Costo estimado por m³ en cada remisión (orden cronológico)</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#78716c" interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} stroke="#78716c" tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'Costo / m³']}
              labelFormatter={(_, p) => {
                const row = p?.[0]?.payload;
                return row ? `Rem. ${row.remision} · ${row.fecha}` : '';
              }}
              contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4' }}
            />
            <Line type="monotone" dataKey="costo" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
