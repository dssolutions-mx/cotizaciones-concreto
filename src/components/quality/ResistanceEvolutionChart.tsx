'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Scatter, ScatterChart, ComposedChart } from 'recharts';
import { TrendingUp, Target, Activity, Calendar, BarChart3, Info, Beaker } from 'lucide-react';
import { PointAnalysisData } from '@/services/qualityPointAnalysisService';

interface ResistanceEvolutionChartProps {
  data: PointAnalysisData;
  className?: string;
}

interface ChartDataPoint {
  edad: number;
  resistencia: number;
  resistencia_min: number;
  resistencia_max: number;
  muestras: number;
  fecha: string;
  cumplimiento: number;
  individualPoints?: Array<{
    resistencia: number;
    edad: number;
    fecha: string;
    muestra_id: string;
  }>;
}

export default function ResistanceEvolutionChart({ data, className = '' }: ResistanceEvolutionChartProps) {
  // Transform data using precomputed evolution with timestamps and fractional ages
  const chartData: ChartDataPoint[] = useMemo(() => {
    const points: ChartDataPoint[] = (data.resistanceEvolution || []).map(ev => ({
      edad: ev.edad_dias,
      resistencia: ev.resistencia_promedio,
      resistencia_min: ev.resistencia_min,
      resistencia_max: ev.resistencia_max,
      muestras: ev.numero_muestras,
      fecha: ev.fecha_ensayo_ts || ev.fecha_ensayo,
      cumplimiento: data.recipe.strength_fc > 0 ? Math.round((ev.resistencia_promedio / data.recipe.strength_fc) * 100) : 0,
      individualPoints: []
    })).sort((a, b) => a.edad - b.edad);

    // Add day 0 with resistance 0 at the beginning
    const dayZeroPoint: ChartDataPoint = {
      edad: 0,
      resistencia: 0,
      resistencia_min: 0,
      resistencia_max: 0,
      muestras: 0,
      fecha: data.muestreo.fecha_muestreo_ts || data.muestreo.fecha_muestreo,
      cumplimiento: 0,
      individualPoints: []
    };

    return [dayZeroPoint, ...points];
  }, [data]);

  // Calculate target resistance line
  const targetResistance = data.recipe.strength_fc;
  
  // Calculate average resistance across all ages
  const averageResistance = chartData.length > 0 ? 
    chartData.reduce((sum, point) => sum + point.resistencia, 0) / chartData.length : 0;

  // Flatten all individual points for scatter plot using precise timestamps
  const allIndividualPoints = useMemo(() => {
    const muestreoDateStr = data.muestreo.fecha_muestreo_ts || data.muestreo.fecha_muestreo;
    const muestreoDate = new Date(muestreoDateStr);
    const list: Array<{ resistencia: number; edad: number; fecha: string; muestra_id: string; isIndividual: boolean }>
      = [];
    data.muestras.forEach(m => {
      m.ensayos.forEach(e => {
        const testStr = e.fecha_ensayo_ts || e.fecha_ensayo;
        const testDate = new Date(testStr);
        const ageDays = (testDate.getTime() - muestreoDate.getTime()) / (1000 * 60 * 60 * 24);
        list.push({
          resistencia: e.resistencia_calculada,
          edad: Number(ageDays.toFixed(3)),
          fecha: testStr,
          muestra_id: m.id,
          isIndividual: true
        });
      });
    });
    return list;
  }, [data]);

  // Unique ages for clean numeric X-axis ticks
  const uniqueAges = useMemo(() => {
    // Round to two decimals to avoid too-dense ticks for fractional values
    const rounded = chartData.map(p => Number(p.edad.toFixed(2)));
    return Array.from(new Set(rounded)).sort((a, b) => a - b);
  }, [chartData]);

  // Calculate trend line data for better visualization
  const trendLineData = useMemo(() => {
    if (chartData.length < 2) return [];
    
    // Simple linear regression for trend line
    const n = chartData.length;
    const sumX = chartData.reduce((sum, point) => sum + point.edad, 0);
    const sumY = chartData.reduce((sum, point) => sum + point.resistencia, 0);
    const sumXY = chartData.reduce((sum, point) => sum + point.edad * point.resistencia, 0);
    const sumXX = chartData.reduce((sum, point) => sum + point.edad * point.edad, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Generate trend line points
    const minAge = Math.min(...chartData.map(p => p.edad));
    const maxAge = Math.max(...chartData.map(p => p.edad));
    
    return [
      { edad: minAge, resistencia: slope * minAge + intercept, isTrend: true },
      { edad: maxAge, resistencia: slope * maxAge + intercept, isTrend: true }
    ];
  }, [chartData]);

  // Custom tooltip content
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Check if this is an individual point or a chart data point
      const isIndividualPoint = data.isIndividual;
      
      if (isIndividualPoint) {
        // Handle individual scatter points
        return (
          <div className="bg-white border-2 border-slate-300 rounded-xl p-4 shadow-xl">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 mb-3">
              <p className="font-bold text-lg text-slate-800 text-center">
                {label < 1 ? `${(label * 24).toFixed(1)} horas desde muestreo` : `Día ${Number(label).toFixed(2)} desde muestreo`}
              </p>
              <p className="text-sm text-slate-600 text-center">
                {data.fecha ? new Date(data.fecha).toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'N/A'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-xs text-blue-600 font-medium">Resistencia Individual</p>
                <p className="text-lg font-bold text-blue-800">
                  {data.resistencia ? data.resistencia.toFixed(1) : 'N/A'} kg/cm²
                </p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <p className="text-xs text-purple-600 font-medium">Muestra ID</p>
                <p className="text-sm font-bold text-purple-800">{data.muestra_id || 'N/A'}</p>
              </div>
            </div>
          </div>
        );
      } else {
        // Handle main chart data points
        const isDayZero = data.edad === 0;
        return (
          <div className="bg-white border-2 border-slate-300 rounded-xl p-4 shadow-xl">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 mb-3">
              <p className="font-bold text-lg text-slate-800 text-center">
                {isDayZero
                  ? 'Día 0 (Muestreo)'
                  : label < 1
                    ? `${(label * 24).toFixed(1)} horas desde muestreo`
                    : `Día ${Number(label).toFixed(2)} desde muestreo`}
              </p>
              <p className="text-sm text-slate-600 text-center">
                {data.fecha ? new Date(data.fecha).toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'N/A'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-xs text-blue-600 font-medium">Resistencia Promedio</p>
                <p className="text-lg font-bold text-blue-800">
                  {data.resistencia ? data.resistencia.toFixed(1) : 'N/A'} kg/cm²
                </p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <p className="text-xs text-green-600 font-medium">Cumplimiento</p>
                <p className="text-lg font-bold text-green-800">
                  {data.cumplimiento ? `${data.cumplimiento}%` : 'N/A'}
                </p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <p className="text-xs text-purple-600 font-medium">Muestras</p>
                <p className="text-lg font-bold text-purple-800">
                  {data.muestras ? data.muestras : 'N/A'}
                </p>
              </div>
              
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <p className="text-xs text-orange-600 font-medium">Rango</p>
                <p className="text-sm font-bold text-orange-800">
                  {data.resistencia_min && data.resistencia_max && !isDayZero ? 
                    `${data.resistencia_min.toFixed(1)} - ${data.resistencia_max.toFixed(1)}` : 
                    isDayZero ? 'N/A' : 'N/A'
                  }
                </p>
              </div>
            </div>
          </div>
        );
      }
    }
    return null;
  };

  // Check if we have valid data for the chart
  const hasValidData = chartData.length > 0 && chartData.some(point => 
    point.resistencia > 0 && point.muestras > 0
  );

  if (!hasValidData) {
    return (
      <Card className={`bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-600" />
            Evolución de Resistencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-500 py-8">
            <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>
              {chartData.length === 0 
                ? 'No hay datos de evolución disponibles'
                : 'Los datos disponibles no contienen valores de resistencia válidos'
              }
            </p>
            {chartData.length > 0 && (
              <div className="mt-4 text-sm text-slate-400">
                <p>Datos encontrados: {chartData.length} edades</p>
                <p>Muestras totales: {chartData.reduce((sum, point) => sum + point.muestras, 0)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-slate-600" />
            Evolución de Resistencia del Concreto
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {data.recipe.recipe_code}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {data.muestreo.planta}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Seguimiento de resistencia a través del tiempo
        </p>
      </CardHeader>
      
      <CardContent>
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center mb-2">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-700 mb-1">
              {targetResistance}
            </p>
            <p className="text-sm text-blue-800 font-semibold">Resistencia Objetivo</p>
            <p className="text-xs text-blue-600">kg/cm²</p>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700 mb-1">
              {averageResistance.toFixed(1)}
            </p>
            <p className="text-sm text-green-800 font-semibold">Promedio General</p>
            <p className="text-xs text-green-600">kg/cm²</p>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-700 mb-1">
              {chartData.length}
            </p>
            <p className="text-sm text-purple-800 font-semibold">Fechas de Ensayo</p>
            <p className="text-xs text-purple-600">puntos de datos</p>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center mb-2">
              <Beaker className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-700 mb-1">
              {chartData.reduce((sum, point) => sum + point.muestras, 0)}
            </p>
            <p className="text-sm text-orange-800 font-semibold">Total Muestras</p>
            <p className="text-xs text-orange-600">analizadas</p>
          </div>
        </div>

        {/* Main Chart */}
        <div className="h-96 w-full bg-white rounded-lg border border-gray-200 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
              <CartesianGrid strokeDasharray="1 1" stroke="#F1F5F9" strokeWidth={0.5} />
              
              <XAxis 
                type="number"
                dataKey="edad" 
                stroke="#64748B"
                fontSize={12}
                fontWeight={400}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                tick={{ fill: '#64748B', fontSize: 11 }}
                domain={[0, 'dataMax']}
                allowDuplicatedCategory={false}
                ticks={uniqueAges}
                label={{ 
                  value: 'Edad (días, horas si < 1 día)', 
                  position: 'insideBottom', 
                  offset: -15, 
                  style: { textAnchor: 'middle', fill: '#475569', fontSize: 12, fontWeight: 500 } 
                }}
              />
              
              <YAxis 
                stroke="#64748B"
                fontSize={12}
                fontWeight={400}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                tick={{ fill: '#64748B', fontSize: 11 }}
                label={{ 
                  value: 'Resistencia (kg/cm²)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { textAnchor: 'middle', fill: '#475569', fontSize: 12, fontWeight: 500 } 
                }}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              {/* Target resistance reference line */}
              <ReferenceLine 
                y={targetResistance} 
                stroke="#EF4444" 
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Objetivo: ${targetResistance} kg/cm²`,
                  position: 'top',
                  fill: '#EF4444',
                  fontSize: 11,
                  fontWeight: 500
                }}
              />
              
              {/* Individual data points - rendered as a dot-only line using precise ages */}
              <Line
                type="linear"
                dataKey="resistencia"
                data={allIndividualPoints as any}
                stroke="transparent"
                dot={{ r: 3, fill: '#60A5FA', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#60A5FA', stroke: '#1D4ED8' }}
                isAnimationActive={false}
                connectNulls
              />
              
              {/* Main resistance line (average) */}
              <Line
                type="monotone"
                dataKey="resistencia"
                stroke="#B45309"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ 
                  r: 5, 
                  stroke: '#B45309', 
                  strokeWidth: 2,
                  fill: '#FFFFFF',
                }}
              />
              
              {/* Average points on the line */}
              <Line
                type="linear"
                dataKey="resistencia"
                data={chartData as any}
                stroke="transparent"
                dot={{ r: 4, fill: '#B45309', stroke: '#FFFFFF', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <span className="text-gray-700 font-medium">Puntos Individuales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-amber-700"></div>
              <div className="w-3 h-3 rounded-full bg-amber-700"></div>
              <span className="text-gray-700 font-medium">Promedio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-500 border-dashed border-t border-red-500"></div>
              <span className="text-gray-700 font-medium">Objetivo</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
