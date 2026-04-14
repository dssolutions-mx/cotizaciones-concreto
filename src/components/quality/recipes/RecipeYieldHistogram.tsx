'use client';

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecipeQualityRemisionData } from '@/hooks/useProgressiveRecipeQuality';

const BINS: { label: string; match: (v: number) => boolean }[] = [
  { label: '<95%', match: (v) => v < 95 },
  { label: '95–99%', match: (v) => v >= 95 && v < 99 },
  { label: '99–102%', match: (v) => v >= 99 && v < 102 },
  { label: '102–105%', match: (v) => v >= 102 && v < 105 },
  { label: '≥105%', match: (v) => v >= 105 },
];

export function RecipeYieldHistogram({ remisiones }: { remisiones: RecipeQualityRemisionData[] }) {
  const data = useMemo(() => {
    const vals = remisiones
      .map((r) => r.rendimientoVolumetrico)
      .filter((v): v is number => typeof v === 'number' && v > 0 && v <= 130);
    const counts = BINS.map((b) => ({
      rango: b.label,
      remisiones: vals.filter(b.match).length,
    }));
    return counts;
  }, [remisiones]);

  const total = data.reduce((s, d) => s + d.remisiones, 0);

  if (total === 0) {
    return (
      <Card className="border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Distribución de rendimiento volumétrico</CardTitle>
          <CardDescription>Sin remisiones con rendimiento calculado en el período.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Distribución de rendimiento volumétrico</CardTitle>
        <CardDescription>
          Histograma por remision ({total} con rendimiento &gt; 0). Util para ver sesgo de sobre o sub-produccion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Remisiones', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="remisiones" name="Remisiones" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
