'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecipeQualityRemisionData } from '@/hooks/useProgressiveRecipeQuality';

const COLORS = ['#57534e', '#78716c', '#a8a29e', '#0d9488', '#0369a1', '#7c3aed', '#b45309'];

export function RecipeMaterialConsumptionChart({ remisiones }: { remisiones: RecipeQualityRemisionData[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { totalKg: number; totalVol: number }>();
    remisiones.forEach((r) => {
      const vol = r.volume;
      if (!vol || vol <= 0) return;
      r.materiales?.forEach((m) => {
        const label = m.materials?.material_name || 'Material';
        const prev = map.get(label) || { totalKg: 0, totalVol: 0 };
        prev.totalKg += Number(m.cantidad_real) || 0;
        prev.totalVol += vol;
        map.set(label, prev);
      });
    });

    return Array.from(map.entries())
      .map(([name, v]) => ({
        name: name.length > 28 ? `${name.slice(0, 26)}…` : name,
        kgPorM3: v.totalVol > 0 ? v.totalKg / v.totalVol : 0,
        fullName: name,
      }))
      .filter((x) => x.kgPorM3 > 0)
      .sort((a, b) => b.kgPorM3 - a.kgPorM3)
      .slice(0, 14);
  }, [remisiones]);

  if (rows.length === 0) {
    return (
      <Card className="border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Consumo de materiales</CardTitle>
          <CardDescription>Promedio ponderado por volumen (kg/m³)</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-stone-500">No hay datos de materiales en el período.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Consumo de materiales</CardTitle>
        <CardDescription>
          kg/m³ promedio (ponderado por volumen de remisión); útil para comparar cemento y agregados entre entregas.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="#78716c" />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="#78716c" />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)} kg/m³`, 'Consumo']}
              labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullName as string) || ''}
              contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4' }}
            />
            <Bar dataKey="kgPorM3" radius={[0, 4, 4, 0]} name="kg/m³">
              {rows.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
