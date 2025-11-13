'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  BarChart, Bar, ScatterChart, Scatter, Cell, ComposedChart, Area
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { RecipeQualityRemisionData } from '@/hooks/useProgressiveRecipeQuality';

interface RecipeQualityChartsProps {
  remisiones: RecipeQualityRemisionData[];
  targetStrength: number;
  targetAge: number;
}

export function RecipeQualityCharts({ remisiones, targetStrength, targetAge }: RecipeQualityChartsProps) {
  // Process data for resistance trend chart
  const resistanceTrendData = useMemo(() => {
    return remisiones
      .filter(r => r.avgResistencia && r.avgResistencia > 0)
      .map(r => ({
        fecha: format(new Date(r.fecha), 'dd/MMM', { locale: es }),
        resistencia: r.avgResistencia || 0,
        objetivo: targetStrength,
        cumplimiento: ((r.avgResistencia || 0) / targetStrength) * 100,
        remision: r.remisionNumber
      }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [remisiones, targetStrength]);

  // Calculate control chart limits (3-sigma)
  const controlLimits = useMemo(() => {
    const resistances = resistanceTrendData.map(d => d.resistencia);
    if (resistances.length === 0) return { mean: 0, ucl: 0, lcl: 0, usl: 0, lsl: 0 };

    const mean = resistances.reduce((sum, r) => sum + r, 0) / resistances.length;
    const variance = resistances.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / resistances.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      ucl: mean + (3 * stdDev), // Upper Control Limit
      lcl: Math.max(0, mean - (3 * stdDev)), // Lower Control Limit
      usl: targetStrength * 1.2, // Upper Spec Limit
      lsl: targetStrength * 0.85  // Lower Spec Limit
    };
  }, [resistanceTrendData, targetStrength]);

  // Process compliance distribution
  const complianceDistribution = useMemo(() => {
    const ranges = [
      { range: '< 85%', min: 0, max: 85, count: 0, color: '#ef4444' },
      { range: '85-90%', min: 85, max: 90, count: 0, color: '#f59e0b' },
      { range: '90-95%', min: 90, max: 95, count: 0, color: '#eab308' },
      { range: '95-100%', min: 95, max: 100, count: 0, color: '#3b82f6' },
      { range: '100-105%', min: 100, max: 105, count: 0, color: '#22c55e' },
      { range: '> 105%', min: 105, max: 999, count: 0, color: '#10b981' }
    ];

    remisiones.forEach(r => {
      r.muestreos.forEach(m => {
        m.muestras.forEach(mu => {
          mu.ensayos
            .filter(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo)
            .forEach(e => {
              const comp = e.porcentajeCumplimiento || 0;
              const range = ranges.find(r => comp >= r.min && comp < r.max);
              if (range) range.count++;
            });
        });
      });
    });

    return ranges.filter(r => r.count > 0);
  }, [remisiones]);

  // Process resistance vs compliance scatter
  const scatterData = useMemo(() => {
    const data: Array<{
      resistencia: number;
      cumplimiento: number;
      remision: string;
      fecha: string;
      edad: string;
      fuera_tiempo: boolean;
    }> = [];

    remisiones.forEach(r => {
      r.muestreos.forEach(m => {
        m.muestras.forEach(mu => {
          mu.ensayos
            .filter(e => e.isEdadGarantia && e.resistenciaCalculada > 0)
            .forEach(e => {
              data.push({
                resistencia: e.resistenciaCalculada,
                cumplimiento: e.porcentajeCumplimiento,
                remision: r.remisionNumber,
                fecha: format(new Date(r.fecha), 'dd/MM/yyyy'),
                edad: `${targetAge}d`,
                fuera_tiempo: e.isEnsayoFueraTiempo
              });
            });
        });
      });
    });

    return data;
  }, [remisiones, targetAge]);

  // Process volumetric yield trend
  const yieldTrendData = useMemo(() => {
    return remisiones
      .filter(r => r.rendimientoVolumetrico && r.rendimientoVolumetrico > 0 && r.rendimientoVolumetrico <= 110)
      .map(r => ({
        fecha: format(new Date(r.fecha), 'dd/MMM', { locale: es }),
        rendimiento: r.rendimientoVolumetrico || 0,
        objetivo: 100,
        volumen: r.volume
      }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [remisiones]);

  return (
    <div className="space-y-6">
      {/* Control Chart - Resistance Evolution */}
      <Card>
        <CardHeader>
          <CardTitle>Gráfico de Control - Evolución de Resistencia</CardTitle>
          <CardDescription>
            Análisis de proceso estadístico con límites 3-sigma (UCL/LCL) y límites de especificación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={resistanceTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                label={{ value: 'Resistencia (kg/cm²)', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: any, name: string) => {
                  if (name === 'resistencia') return [value.toFixed(1) + ' kg/cm²', 'Resistencia'];
                  if (name === 'cumplimiento') return [value.toFixed(1) + '%', 'Cumplimiento'];
                  return [value, name];
                }}
              />
              <Legend />

              {/* Spec Limits */}
              <ReferenceLine y={controlLimits.usl} stroke="#dc2626" strokeDasharray="5 5" label="LSE" />
              <ReferenceLine y={controlLimits.lsl} stroke="#dc2626" strokeDasharray="5 5" label="LIE" />

              {/* Control Limits */}
              <ReferenceLine y={controlLimits.ucl} stroke="#f59e0b" strokeDasharray="3 3" label="LCS" />
              <ReferenceLine y={controlLimits.lcl} stroke="#f59e0b" strokeDasharray="3 3" label="LCI" />

              {/* Mean Line */}
              <ReferenceLine y={controlLimits.mean} stroke="#3b82f6" strokeWidth={2} label="Media" />

              {/* Target */}
              <ReferenceLine y={targetStrength} stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" label="Objetivo" />

              {/* Area between control limits */}
              <Area
                type="monotone"
                dataKey={() => controlLimits.ucl}
                fill="#22c55e"
                fillOpacity={0.1}
                stroke="none"
              />

              {/* Actual resistance line */}
              <Line
                type="monotone"
                dataKey="resistencia"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 5, fill: '#3b82f6' }}
                activeDot={{ r: 7 }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-500"></div>
              <span>Objetivo (f'c {targetStrength})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500"></div>
              <span>Media ({controlLimits.mean.toFixed(1)})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-amber-500 border-dashed"></div>
              <span>Límites Control (±3σ)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-red-500 border-dashed"></div>
              <span>Límites Especificación</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Distribution Histogram */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Cumplimiento</CardTitle>
          <CardDescription>
            Histograma de ensayos por rango de cumplimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={complianceDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis label={{ value: 'Cantidad de Ensayos', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: any) => [value, 'Ensayos']}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {complianceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Resistance vs Compliance Scatter */}
      <Card>
        <CardHeader>
          <CardTitle>Resistencia vs Cumplimiento</CardTitle>
          <CardDescription>
            Análisis de correlación entre resistencia medida y porcentaje de cumplimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="resistencia"
                name="Resistencia"
                unit=" kg/cm²"
                label={{ value: 'Resistencia (kg/cm²)', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                dataKey="cumplimiento"
                name="Cumplimiento"
                unit="%"
                label={{ value: 'Cumplimiento (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: any, name: string, props: any) => {
                  if (name === 'Resistencia') return [value.toFixed(1) + ' kg/cm²', name];
                  if (name === 'Cumplimiento') return [value.toFixed(1) + '%', name];
                  return [value, name];
                }}
                labelFormatter={(_, payload) => {
                  if (payload && payload.length > 0) {
                    const data = payload[0].payload;
                    return `Remisión: ${data.remision} | ${data.fecha}`;
                  }
                  return '';
                }}
              />
              <ReferenceLine x={targetStrength} stroke="#22c55e" strokeDasharray="5 5" label="f'c" />
              <ReferenceLine y={100} stroke="#3b82f6" strokeDasharray="5 5" label="100%" />
              <Scatter
                name="Ensayos"
                data={scatterData.filter(d => !d.fuera_tiempo)}
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Scatter
                name="Fuera de Tiempo"
                data={scatterData.filter(d => d.fuera_tiempo)}
                fill="#ef4444"
                fillOpacity={0.6}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Volumetric Yield Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Rendimiento Volumétrico</CardTitle>
          <CardDescription>
            Evolución del rendimiento volumétrico en el tiempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={yieldTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                yAxisId="left"
                label={{ value: 'Rendimiento (%)', angle: -90, position: 'insideLeft' }}
                domain={[95, 105]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Volumen (m³)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: any, name: string) => {
                  if (name === 'rendimiento') return [value.toFixed(1) + '%', 'Rendimiento'];
                  if (name === 'volumen') return [value.toFixed(2) + ' m³', 'Volumen'];
                  return [value, name];
                }}
              />
              <Legend />
              <ReferenceLine yAxisId="left" y={100} stroke="#22c55e" strokeDasharray="5 5" label="Objetivo 100%" />
              <ReferenceLine yAxisId="left" y={98} stroke="#f59e0b" strokeDasharray="3 3" label="Mínimo 98%" />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="rendimiento"
                fill="#3b82f6"
                fillOpacity={0.3}
                stroke="none"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="rendimiento"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4 }}
                name="rendimiento"
              />
              <Bar
                yAxisId="right"
                dataKey="volumen"
                fill="#94a3b8"
                opacity={0.3}
                radius={[4, 4, 0, 0]}
                name="volumen"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
