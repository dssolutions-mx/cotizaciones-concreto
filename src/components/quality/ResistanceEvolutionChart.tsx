'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
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
        <div className="bg-white border-2 border-slate-300 rounded-xl p-4 shadow-xl">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 mb-3">
            <p className="font-bold text-lg text-slate-800 text-center">{`Día ${label} desde muestreo`}</p>
            <p className="text-sm text-slate-600 text-center">
              {new Date(data.fecha).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-xs text-blue-600 font-medium">Resistencia</p>
              <p className="text-lg font-bold text-blue-800">{data.resistencia.toFixed(1)} kg/cm²</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xs text-green-600 font-medium">Cumplimiento</p>
              <p className="text-lg font-bold text-green-800">{data.cumplimiento}%</p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-2 text-center">
              <p className="text-xs text-purple-600 font-medium">Muestras</p>
              <p className="text-lg font-bold text-purple-800">{data.muestras}</p>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-2 text-center">
              <p className="text-xs text-orange-600 font-medium">Rango</p>
              <p className="text-sm font-bold text-orange-800">
                {data.resistencia_min.toFixed(1)} - {data.resistencia_max.toFixed(1)}
              </p>
            </div>
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
          Seguimiento de resistencia a través del tiempo (desde muestreo)
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
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="colorResistencia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.15}/>
                </linearGradient>
                <linearGradient id="colorRange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.15}/>
                </linearGradient>
                <linearGradient id="colorBackground" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F8FAFC" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#F8FAFC" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              
              {/* Background area for better visibility */}
              <Area
                type="monotone"
                dataKey="resistencia_max"
                stackId="background"
                stroke="none"
                fill="url(#colorBackground)"
                fillOpacity={0.1}
              />
              
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeWidth={0.5} />
              
              <XAxis 
                dataKey="edad" 
                stroke="#475569"
                fontSize={13}
                fontWeight={500}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1', strokeWidth: 1 }}
                tick={{ fill: '#475569', fontSize: 12 }}
                label={{ 
                  value: 'Días desde Muestreo', 
                  position: 'insideBottom', 
                  offset: -10, 
                  style: { textAnchor: 'middle', fill: '#475569', fontSize: 13, fontWeight: 600 } 
                }}
              />
              
              <YAxis 
                stroke="#475569"
                fontSize={13}
                fontWeight={500}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1', strokeWidth: 1 }}
                tick={{ fill: '#475569', fontSize: 12 }}
                label={{ 
                  value: 'Resistencia (kg/cm²)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { textAnchor: 'middle', fill: '#475569', fontSize: 13, fontWeight: 600 } 
                }}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              {/* Target resistance reference line */}
              <ReferenceLine 
                y={targetResistance} 
                stroke="#DC2626" 
                strokeDasharray="6 4"
                strokeWidth={3}
                label={{
                  value: `Objetivo: ${targetResistance} kg/cm²`,
                  position: 'top',
                  fill: '#DC2626',
                  fontSize: 13,
                  fontWeight: 600
                }}
              />
              
              {/* Resistance range area with better visibility */}
              <Area
                type="monotone"
                dataKey="resistencia_max"
                stackId="1"
                stroke="none"
                fill="url(#colorRange)"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="resistencia_min"
                stackId="1"
                stroke="none"
                fill="url(#colorRange)"
                fillOpacity={0.4}
              />
              
              {/* Main resistance line with enhanced styling */}
              <Line
                type="monotone"
                dataKey="resistencia"
                stroke="#2563EB"
                strokeWidth={4}
                dot={{ 
                  fill: '#2563EB', 
                  stroke: '#FFFFFF', 
                  strokeWidth: 3, 
                  r: 6,
                  filter: 'drop-shadow(0 2px 4px rgba(37, 99, 235, 0.3))'
                }}
                activeDot={{ 
                  r: 8, 
                  stroke: '#2563EB', 
                  strokeWidth: 3,
                  fill: '#FFFFFF',
                  filter: 'drop-shadow(0 4px 8px rgba(37, 99, 235, 0.4))'
                }}
              />
              
              {/* Min/Max lines with enhanced visibility */}
              <Line
                type="monotone"
                dataKey="resistencia_max"
                stroke="#059669"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={{ 
                  fill: '#059669', 
                  stroke: '#FFFFFF', 
                  strokeWidth: 2, 
                  r: 4,
                  filter: 'drop-shadow(0 2px 4px rgba(5, 150, 105, 0.3))'
                }}
              />
              <Line
                type="monotone"
                dataKey="resistencia_min"
                stroke="#059669"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={{ 
                  fill: '#059669', 
                  stroke: '#FFFFFF', 
                  strokeWidth: 2, 
                  r: 4,
                  filter: 'drop-shadow(0 2px 4px rgba(5, 150, 105, 0.3))'
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend */}
        <div className="bg-slate-50 rounded-xl p-4 mt-6 border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700 mb-3 text-center">Leyenda del Gráfico</h4>
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-sm"></div>
              <span className="text-slate-700 font-medium">Resistencia Promedio</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-600 border-2 border-white shadow-sm"></div>
              <span className="text-slate-700 font-medium">Rango Min-Max</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow-sm"></div>
              <span className="text-slate-700 font-medium">Resistencia Objetivo</span>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Información del Gráfico</span>
          </div>
          <p className="text-xs text-blue-700">
            El eje X muestra los días transcurridos desde la fecha de muestreo. 
            No se agrupa por edad de garantía, sino por tiempo real de evolución.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
