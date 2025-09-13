'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle } from 'lucide-react';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props {
  categories: string[];
  data: number[];
  loading: boolean;
}

export function CementTrend({ categories, data, loading }: Props) {
  return (
    <div>
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
                colors: ['#FF6B35'],
                stroke: { width: 3, curve: 'smooth' },
                markers: { size: 4, colors: ['#FF6B35'] },
                xaxis: { categories },
                yaxis: { 
                  min: Math.max(0, Math.min(...data) - 20),
                  max: Math.max(...data) + 20,
                  tickAmount: 6,
                  labels: { formatter: (v: number) => v.toFixed(0) }
                },
                dataLabels: {
                  enabled: true,
                  formatter: (v: number) => `${v.toFixed(1)}`,
                  offsetY: -10,
                  style: { colors: ['#FF6B35'], fontSize: '12px', fontWeight: 600 }
                },
                tooltip: { y: { formatter: (v: number) => `${v.toFixed(1)} kg/m³` } },
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
    </div>
  );
}


