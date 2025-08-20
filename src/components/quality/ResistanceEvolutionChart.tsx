'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { TrendingUp, Target, Activity, Calendar, BarChart3 } from 'lucide-react';
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
}

export default function ResistanceEvolutionChart({ data, className = '' }: ResistanceEvolutionChartProps) {
  // Transform data for the chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    return data.resistanceEvolution.map(evolution => {
      const cumplimiento = data.recipe.strength_fc > 0 ? 
        (evolution.resistencia_promedio / data.recipe.strength_fc) * 100 : 0;
      
      return {
        edad: evolution.edad_dias,
        resistencia: evolution.resistencia_promedio,
        resistencia_min: evolution.resistencia_min,
        resistencia_max: evolution.resistencia_max,
        muestras: evolution.numero_muestras,
        fecha: evolution.fecha_ensayo,
        cumplimiento: Math.round(cumplimiento)
      };
    });
  }, [data]);

  // Calculate target resistance line
  const targetResistance = data.recipe.strength_fc;
  
  // Calculate average resistance across all ages
  const averageResistance = chartData.length > 0 ? 
    chartData.reduce((sum, point) => sum + point.resistencia, 0) / chartData.length : 0;

  // Custom tooltip content
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      return (
        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-slate-800">{`Edad: ${label} días`}</p>
          <div className="space-y-1 mt-2">
            <p className="text-sm text-slate-600">
              <span className="font-medium">Resistencia:</span> {data.resistencia.toFixed(1)} kg/cm²
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-medium">Cumplimiento:</span> {data.cumplimiento}%
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-medium">Muestras:</span> {data.muestras}
            </p>
            <p className="text-sm text-slate-600">
              <span className="font-medium">Rango:</span> {data.resistencia_min.toFixed(1)} - {data.resistencia_max.toFixed(1)} kg/cm²
            </p>
          </div>
        </div>
      );
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
            Evolución de Resistencia
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
          Seguimiento de resistencia por edad de curado
        </p>
      </CardHeader>
      
      <CardContent>
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-2xl font-bold text-blue-600">
              {targetResistance}
            </p>
            <p className="text-xs text-blue-700 font-medium">Resistencia Objetivo (kg/cm²)</p>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
            <p className="text-2xl font-bold text-green-600">
              {averageResistance.toFixed(1)}
            </p>
            <p className="text-xs text-green-700 font-medium">Promedio General (kg/cm²)</p>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-2xl font-bold text-purple-600">
              {chartData.length}
            </p>
            <p className="text-xs text-purple-700 font-medium">Edades Evaluadas</p>
          </div>
          
          <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
            <p className="text-2xl font-bold text-orange-600">
              {chartData.reduce((sum, point) => sum + point.muestras, 0)}
            </p>
            <p className="text-xs text-orange-700 font-medium">Total Muestras</p>
          </div>
        </div>

        {/* Main Chart */}
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="colorResistencia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorRange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              
              <XAxis 
                dataKey="edad" 
                stroke="#64748B"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Edad (días)', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#64748B' } }}
              />
              
              <YAxis 
                stroke="#64748B"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Resistencia (kg/cm²)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748B' } }}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              {/* Target resistance reference line */}
              <ReferenceLine 
                y={targetResistance} 
                stroke="#EF4444" 
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: `Objetivo: ${targetResistance} kg/cm²`,
                  position: 'top',
                  fill: '#EF4444',
                  fontSize: 12
                }}
              />
              
              {/* Resistance range area */}
              <Area
                type="monotone"
                dataKey="resistencia_max"
                stackId="1"
                stroke="none"
                fill="url(#colorRange)"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="resistencia_min"
                stackId="1"
                stroke="none"
                fill="url(#colorRange)"
                fillOpacity={0.3}
              />
              
              {/* Main resistance line */}
              <Line
                type="monotone"
                dataKey="resistencia"
                stroke="#3B82F6"
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
              />
              
              {/* Min/Max lines */}
              <Line
                type="monotone"
                dataKey="resistencia_max"
                stroke="#10B981"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={{ fill: '#10B981', r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="resistencia_min"
                stroke="#10B981"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={{ fill: '#10B981', r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-slate-700">Resistencia Promedio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-700">Rango Min-Max</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-slate-700">Resistencia Objetivo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
