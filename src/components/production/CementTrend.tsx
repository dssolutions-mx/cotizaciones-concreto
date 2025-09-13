'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props {
  categories: string[];
  data: number[];
  loading: boolean;
}

export function CementTrend({ categories, data, loading }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Tendencia de Consumo de Cemento por m³</CardTitle>
        <CardDescription>Evolución del consumo de cemento por metro cúbico en los últimos meses</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-80">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Cargando datos de tendencia...</span>
          </div>
        ) : categories.length > 0 ? (
          typeof window !== 'undefined' && (
            <Chart
              options={{
                chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
                stroke: { width: 3, curve: 'smooth' },
                markers: { size: 4 },
                xaxis: { categories },
                yaxis: { labels: { formatter: (v: number) => v.toFixed(2) } },
                tooltip: { y: { formatter: (v: number) => `${v.toFixed(3)} kg/m³` } },
              }}
              series={[{ name: 'Consumo Cemento (kg/m³)', data }]}
              type="line"
              height={320}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-80">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay datos suficientes para mostrar la tendencia.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


