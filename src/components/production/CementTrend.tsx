'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle } from 'lucide-react';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface TrendSeries { name: string; data: number[] }

interface Props {
  categories: string[];
  series: TrendSeries[];
  loading: boolean;
}

export function CementTrend({ categories, series, loading }: Props) {
  const [viewMode, setViewMode] = useState<'series' | 'efficiency'>('series');
  const [enabled, setEnabled] = useState<{ cement: boolean; resistance: boolean; age: boolean }>({
    cement: true,
    resistance: false,
    age: false,
  });

  const named = useMemo(() => {
    const findByName = (n: string) => series.find(s => s.name === n);
    const cement = findByName('Consumo Cemento (kg/m³)');
    const resistance = findByName('Resistencia ponderada (fc)');
    const age = findByName('Edad garantía ponderada (días)');
    return { cement, resistance, age };
  }, [series]);

  const efficiencySeries = useMemo(() => {
    if (!named.cement || !named.resistance) return null;
    const a = named.resistance.data || [];
    const b = named.cement.data || [];
    const len = Math.min(a.length, b.length);
    const data: number[] = new Array(len).fill(0).map((_, i) => {
      const cementVal = Number(b[i]) || 0;
      const resVal = Number(a[i]) || 0;
      if (!cementVal) return 0;
      return resVal / cementVal; // fc per kg/m³
    });
    return { name: 'Índice de eficiencia (fc/kg·m³)', data } as TrendSeries;
  }, [named]);

  const display = useMemo(() => {
    if (viewMode === 'efficiency' && efficiencySeries) {
      return {
        series: [efficiencySeries],
        colors: ['#16A34A'],
        yaxis: [
          {
            seriesName: 'Índice de eficiencia (fc/kg·m³)',
            title: { text: 'Índice (fc/kg·m³)' },
            decimalsInFloat: 2,
            labels: { formatter: (v: number) => v.toFixed(2) },
          },
        ],
      };
    }

    const outSeries: TrendSeries[] = [];
    const colors: string[] = [];
    const yaxis: any[] = [];

    if (enabled.cement && named.cement) {
      outSeries.push(named.cement);
      colors.push('#FF6B35');
      yaxis.push({
        seriesName: 'Consumo Cemento (kg/m³)',
        title: { text: 'Cemento (kg/m³)' },
        decimalsInFloat: 1,
        labels: { formatter: (v: number) => v.toFixed(0) },
      });
    }
    if (enabled.resistance && named.resistance) {
      outSeries.push(named.resistance);
      colors.push('#2E86AB');
      yaxis.push({
        seriesName: 'Resistencia ponderada (fc)',
        opposite: true,
        title: { text: 'Resistencia (fc)' },
        decimalsInFloat: 0,
        labels: { formatter: (v: number) => v.toFixed(0) },
      });
    }
    if (enabled.age && named.age) {
      outSeries.push(named.age);
      colors.push('#6C5CE7');
      yaxis.push({
        seriesName: 'Edad garantía ponderada (días)',
        opposite: true,
        title: { text: 'Edad (días)' },
        decimalsInFloat: 1,
        labels: { formatter: (v: number) => v.toFixed(1) },
      });
    }

    // Fallback to at least cement if nothing enabled
    if (outSeries.length === 0 && named.cement) {
      outSeries.push(named.cement);
      colors.push('#FF6B35');
      yaxis.push({
        seriesName: 'Consumo Cemento (kg/m³)',
        title: { text: 'Cemento (kg/m³)' },
        decimalsInFloat: 1,
        labels: { formatter: (v: number) => v.toFixed(0) },
      });
    }

    return { series: outSeries, colors, yaxis };
  }, [viewMode, enabled, named, efficiencySeries]);

  return (
    <div>
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm border ${viewMode === 'series' ? 'bg-primary text-white border-primary' : 'bg-background text-foreground border-border'} rounded-l-md`}
              onClick={() => setViewMode('series')}
            >
              Series
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm border -ml-px ${viewMode === 'efficiency' ? 'bg-primary text-white border-primary' : 'bg-background text-foreground border-border'} rounded-r-md`}
              onClick={() => setViewMode('efficiency')}
            >
              Índice (fc/kg·m³)
            </button>
          </div>
          {viewMode === 'series' && (
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={enabled.cement} onChange={(e) => setEnabled(s => ({ ...s, cement: e.target.checked }))} />
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#FF6B35' }} />Cemento</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={enabled.resistance} onChange={(e) => setEnabled(s => ({ ...s, resistance: e.target.checked }))} />
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#2E86AB' }} />Resistencia</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={enabled.age} onChange={(e) => setEnabled(s => ({ ...s, age: e.target.checked }))} />
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#6C5CE7' }} />Edad garantía</span>
              </label>
            </div>
          )}
        </div>
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
                colors: display.colors,
                stroke: { width: 3, curve: 'smooth' },
                markers: { size: 3 },
                xaxis: { categories },
                yaxis: display.yaxis as any,
                dataLabels: { enabled: false },
                tooltip: {
                  shared: true,
                  y: {
                    formatter: (v: number, opts: any) => {
                      const sName = opts?.seriesIndex != null ? (display.series[opts.seriesIndex]?.name || '') : '';
                      if (sName.includes('Cemento')) return `${v.toFixed(1)} kg/m³`;
                      if (sName.includes('Resistencia')) return `${v.toFixed(0)} fc`;
                      if (sName.includes('Edad')) return `${v.toFixed(1)} días`;
                      if (sName.includes('Índice')) return `${v.toFixed(2)} fc/kg·m³`;
                      return `${v.toFixed(1)}`;
                    }
                  }
                },
              }}
              series={display.series as any}
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


