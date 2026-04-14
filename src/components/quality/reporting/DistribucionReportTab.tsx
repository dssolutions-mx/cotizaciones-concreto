'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Loader2, PieChart as PieChartIcon } from 'lucide-react';

export type DistribucionRow = { rango: string; cantidad: number; color: string };

export function DistribucionReportTab({
  distribucionData,
  loading,
}: {
  distribucionData: DistribucionRow[];
  loading: boolean;
}) {
  const chartData = useMemo(
    () =>
      distribucionData
        .filter((d) => d.cantidad > 0)
        .map((d) => ({
          name: d.rango,
          value: d.cantidad,
          color: d.color,
        })),
    [distribucionData]
  );

  const hasData = distribucionData.some((d) => d.cantidad > 0);

  return (
    <Card className="border-stone-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Distribución de resistencias</CardTitle>
        <Button variant="outline" size="sm" disabled={loading || !hasData}>
          <PieChartIcon className="h-4 w-4 mr-2" />
          Exportar (próximamente)
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[400px] items-center justify-center rounded-md border border-stone-100 bg-stone-50/50">
            <div className="flex flex-col items-center gap-2 text-stone-500">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Cargando datos de distribución...</p>
            </div>
          </div>
        ) : hasData ? (
          <div className="h-[400px] w-full border border-stone-100 rounded-md p-2">
            {typeof window !== 'undefined' && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} muestras`, 'Cantidad']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <div className="flex h-[400px] flex-col items-center justify-center rounded-md border border-stone-100 bg-stone-50/50">
            <PieChartIcon className="h-12 w-12 text-stone-300 mb-2" />
            <p className="text-stone-600 text-sm">No hay datos suficientes para el gráfico</p>
            <p className="text-xs text-stone-400 mt-1">Ajusta filtros o el período</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
