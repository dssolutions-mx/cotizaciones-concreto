'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { QualityChartSection } from '@/components/quality/QualityChartSection';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { RecipeQualityRemisionData } from '@/types/recipeQuality';
import { DatoGraficoResistencia } from '@/types/quality';

interface RecipeMuestreosChartsProps {
  remisiones: RecipeQualityRemisionData[];
}

export default function RecipeMuestreosCharts({ remisiones }: RecipeMuestreosChartsProps) {
  // Debug: Log the data being received
  console.log('RecipeMuestreosCharts - remisiones:', remisiones);
  console.log('RecipeMuestreosCharts - remisiones count:', remisiones.length);
  
  // Flatten all muestreos from all remisiones (similar to client analysis)
  const allMuestreos = remisiones.flatMap(remision => 
    remision.muestreos.map(muestreo => ({
      ...muestreo,
      remisionNumber: remision.remisionNumber,
      fecha: remision.fecha,
      volume: remision.volume,
      recipeCode: remision.recipeCode,
      constructionSite: remision.constructionSite,
      rendimientoVolumetrico: remision.rendimientoVolumetrico || 0,
      totalMaterialQuantity: remision.totalMaterialQuantity || 0,
      costPerM3: remision.costPerM3 || 0
    }))
  );
  
  console.log('RecipeMuestreosCharts - allMuestreos count:', allMuestreos.length);

  // Process data for charts - Focus on temporal analysis
  const processChartData = () => {
    // Group remisiones by week for temporal analysis
    const weeklyData = remisiones.reduce((acc: any, remision) => {
      const fecha = new Date(remision.fecha);
      const weekStart = new Date(fecha);
      weekStart.setDate(fecha.getDate() - fecha.getDay() + 1); // Monday
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!acc[weekKey]) {
        acc[weekKey] = {
          week: weekKey,
          weekLabel: format(new Date(weekKey), 'dd/MM', { locale: es }),
          totalVolume: 0,
          totalCost: 0,
          rendimientos: [],
          compliances: [],
          resistencias: [],
          remisiones: 0
        };
      }
      
      acc[weekKey].totalVolume += remision.volume;
      acc[weekKey].totalCost += (remision.costPerM3 || 0) * remision.volume;
      acc[weekKey].remisiones += 1;
      
      if (remision.rendimientoVolumetrico && remision.rendimientoVolumetrico > 0) {
        acc[weekKey].rendimientos.push(remision.rendimientoVolumetrico);
      }
      
      if (remision.avgResistencia && remision.avgResistencia > 0) {
        acc[weekKey].resistencias.push(remision.avgResistencia);
      }
      
      // Calculate compliance for this remision
      const validEnsayos = remision.muestreos.flatMap(m => 
        m.muestras.flatMap(s => 
          s.ensayos.filter(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo && e.resistenciaCalculada > 0)
        )
      );
      
      if (validEnsayos.length > 0) {
        const compliance = validEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / validEnsayos.length;
        acc[weekKey].compliances.push(compliance);
      }
      
      return acc;
    }, {});

    // Calculate averages for each week
    const weeklyStats = Object.values(weeklyData).map((week: any) => ({
      week: week.week,
      weekLabel: week.weekLabel,
      totalVolume: week.totalVolume,
      avgCostPerM3: week.totalVolume > 0 ? week.totalCost / week.totalVolume : 0,
      avgRendimiento: week.rendimientos.length > 0 
        ? week.rendimientos.reduce((sum: number, r: number) => sum + r, 0) / week.rendimientos.length 
        : 0,
      avgCompliance: week.compliances.length > 0 
        ? week.compliances.reduce((sum: number, c: number) => sum + c, 0) / week.compliances.length 
        : 0,
      avgResistencia: week.resistencias.length > 0 
        ? week.resistencias.reduce((sum: number, r: number) => sum + r, 0) / week.resistencias.length 
        : 0,
      remisiones: week.remisiones
    })).sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());

    return {
      weekly: weeklyStats,
      rendimientoData: weeklyStats.map(week => ({
        week: week.weekLabel,
        rendimiento: week.avgRendimiento,
        volume: week.totalVolume,
        compliance: week.avgCompliance,
        resistencia: week.avgResistencia
      }))
    };
  };

  const chartData = processChartData();
  
  // Map to QualityChartSection data format
  const datosGrafico: DatoGraficoResistencia[] = allMuestreos.flatMap((muestreo: any) =>
    (muestreo.muestras || []).flatMap((muestra: any) =>
      (muestra.ensayos || [])
        .filter((ensayo: any) => ensayo.isEdadGarantia && !ensayo.isEnsayoFueraTiempo && (ensayo.resistenciaCalculada || 0) > 0 && (ensayo.porcentajeCumplimiento || 0) > 0)
        .map((ensayo: any) => {
          const specs = muestreo.concrete_specs || {};
          const edad = typeof specs.valor_edad === 'number' && specs.valor_edad > 0
            ? specs.valor_edad
            : 28;
          const clasificacion = (specs.clasificacion as 'FC' | 'MR') || 'FC';
          return {
            x: new Date(muestreo.fechaMuestreo || muestreo.fecha_muestreo || muestreo.fecha || Date.now()).getTime(),
            y: ensayo.porcentajeCumplimiento || 0,
            clasificacion,
            edad,
            fecha_ensayo: ensayo.fechaEnsayo || ensayo.fecha_ensayo,
            resistencia_calculada: ensayo.resistenciaCalculada || ensayo.resistencia_calculada,
            muestra: { muestreo, muestra, ensayo }
          } as DatoGraficoResistencia;
        })
    )
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-800">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('Costo') ? formatCurrency(entry.value) : formatNumber(entry.value, 1)}{entry.unit || ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (allMuestreos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Muestreos por Receta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No hay datos de muestreos para mostrar gráficos.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rendimiento Volumétrico Temporal */}
      <Card>
        <CardHeader>
          <CardTitle>Evolución del Rendimiento Volumétrico</CardTitle>
          <CardDescription>
            Rendimiento volumétrico promedio por semana • {chartData.weekly.length} semana{chartData.weekly.length > 1 ? 's' : ''} con datos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData.weekly} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                yAxisId="rendimiento"
                orientation="left"
                domain={[0, 'dataMax + 10']}
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 11 }}
                label={{ value: 'Rendimiento (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                tickFormatter={(value) => `${value}m³`}
                tick={{ fontSize: 11 }}
                label={{ value: 'Volumen (m³)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
                formatter={(value, name) => {
                  if (name === 'Volumen') return [`${value} m³`, 'Volumen Producido'];
                  if (name === 'Rendimiento') return [`${value}%`, 'Rendimiento Volumétrico'];
                  if (name === 'Cumplimiento') return [`${value}%`, 'Cumplimiento'];
                  return [formatNumber(value as number, 1), name];
                }}
                labelFormatter={(label) => `Semana: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              />

              {/* Volume bars (background) */}
              <Bar
                yAxisId="volume"
                dataKey="totalVolume"
                fill="rgba(156, 163, 175, 0.3)"
                name="Volumen"
                radius={[2, 2, 2, 2]}
              />

              {/* Rendimiento volumétrico line */}
              <Line
                yAxisId="rendimiento"
                type="monotone"
                dataKey="avgRendimiento"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "white" }}
                activeDot={{ r: 7, fill: "#3b82f6" }}
                name="Rendimiento"
              />

              {/* Reference line at 100% */}
              <Line
                yAxisId="rendimiento"
                type="monotone"
                dataKey={() => 100}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Objetivo 100%"
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="font-medium text-blue-900">Rendimiento Promedio</div>
              <div className="text-base font-bold text-blue-700">
                {chartData.weekly.length > 0 
                  ? formatNumber(chartData.weekly.reduce((s, w) => s + w.avgRendimiento, 0) / chartData.weekly.length, 1) + '%'
                  : '0%'
                }
              </div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="font-medium text-gray-900">Volumen Total</div>
              <div className="text-base font-bold text-gray-700">
                {formatNumber(chartData.weekly.reduce((s, w) => s + w.totalVolume, 0), 1)} m³
              </div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="font-medium text-green-900">Semanas</div>
              <div className="text-base font-bold text-green-700">
                {chartData.weekly.length}
              </div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded">
              <div className="font-medium text-purple-900">Remisiones</div>
              <div className="text-base font-bold text-purple-700">
                {chartData.weekly.reduce((s, w) => s + w.remisiones, 0)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resistance vs Compliance Scatter Plot - Same as Client Analysis */}
      <QualityChartSection 
        datosGrafico={datosGrafico} 
        loading={false} 
        soloEdadGarantia={true} 
        constructionSites={[...new Set(remisiones.map(r => r.constructionSite).filter(Boolean))]} 
      />
    </div>
  );
}