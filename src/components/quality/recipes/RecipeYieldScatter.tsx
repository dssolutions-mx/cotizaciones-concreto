'use client';

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecipeQualityRemisionData } from '@/hooks/useProgressiveRecipeQuality';

export function RecipeYieldScatter({
  remisiones,
  targetStrength,
}: {
  remisiones: RecipeQualityRemisionData[];
  targetStrength: number;
}) {
  const points = useMemo(() => {
    const out: { x: number; y: number; remision: string }[] = [];
    remisiones.forEach((r) => {
      const y = r.rendimientoVolumetrico;
      const x = r.avgResistencia;
      if (y != null && y > 0 && x != null && x > 0) {
        out.push({ x, y, remision: r.remisionNumber });
      }
    });
    return out;
  }, [remisiones]);

  if (points.length === 0) {
    return (
      <Card className="border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Rendimiento vs resistencia</CardTitle>
          <CardDescription>Por remisión</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-stone-500">
          No hay puntos con rendimiento y resistencia promedio disponibles.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Rendimiento vs resistencia</CardTitle>
        <CardDescription>
          Cada punto es una remisión. Referencia vertical: fc objetivo {targetStrength} kg/cm².
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              type="number"
              dataKey="x"
              name="Resistencia"
              unit=" kg/cm²"
              tick={{ fontSize: 11 }}
              stroke="#78716c"
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Rendimiento"
              unit="%"
              tick={{ fontSize: 11 }}
              stroke="#78716c"
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { x: number; y: number; remision: string };
                return (
                  <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-sm">
                    <div className="font-medium text-stone-900">Rem. {p.remision}</div>
                    <div className="text-stone-600">Resistencia: {p.x.toFixed(1)} kg/cm²</div>
                    <div className="text-stone-600">Rendimiento: {p.y.toFixed(1)}%</div>
                  </div>
                );
              }}
            />
            {targetStrength > 0 && (
              <ReferenceLine
                x={targetStrength}
                stroke="#b45309"
                strokeDasharray="4 4"
                label={{ value: 'fc', position: 'top', fill: '#b45309', fontSize: 11 }}
              />
            )}
            <ReferenceLine y={100} stroke="#a8a29e" strokeDasharray="3 3" />
            <Scatter name="Remisiones" data={points} fill="#0369a1" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
