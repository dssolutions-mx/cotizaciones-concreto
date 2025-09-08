'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { formatNumber } from '@/lib/utils';
import { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Target, Activity } from 'lucide-react';

interface ClientQualityAnalysisProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
}

export default function ClientQualityAnalysis({ data, summary }: ClientQualityAnalysisProps) {
  // Calculate analysis metrics focused on client-facing value (variation, compliance, yield)
  const calculateAdvancedMetrics = () => {
    const allEnsayos = data.remisiones.flatMap(remision => 
      remision.muestreos.flatMap(muestreo => 
        muestreo.muestras.flatMap(muestra => 
          muestra.ensayos.filter(ensayo => 
            ensayo.isEdadGarantia && 
            !ensayo.isEnsayoFueraTiempo && 
            ensayo.resistenciaCalculada > 0
          )
        )
      )
    );

    if (allEnsayos.length === 0) {
      return {
        cv: 0,
        qualityLevel: 'Sin datos',
        recommendations: [],
        resistencias: [] as number[],
        mean: 0,
        stdDev: 0
      };
    }

    const resistencias = allEnsayos.map(e => e.resistenciaCalculada);
    // Statistical calculations
    const mean = resistencias.reduce((sum, val) => sum + val, 0) / resistencias.length;
    const variance = resistencias.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / resistencias.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100; // Coefficient of Variation

    const cumplimiento = summary.averages.complianceRate || 0;
    const rendimiento = summary.averages.rendimientoVolumetrico || 0;

    // Quality level (client-centric): compliance, low variation, yield near 100%
    let qualityLevel = 'Aceptable';
    if (cumplimiento >= 97 && cv <= 8 && rendimiento >= 98) qualityLevel = 'Excelente';
    else if (cumplimiento >= 95 && cv <= 10 && rendimiento >= 98) qualityLevel = 'Muy Bueno';
    else if (cumplimiento >= 92 && cv <= 12 && rendimiento >= 97.5) qualityLevel = 'Aceptable';
    else qualityLevel = 'Mejorable';

    // Recommendations aligned to business goals
    const recommendations: string[] = [];
    if (cv > 10) recommendations.push('Variación algo alta: reforzar control en mezclado y dosificación');
    if (cumplimiento < 95) recommendations.push('Cumplimiento puede mejorar: revisar diseño/curado de especímenes');
    if (rendimiento < 98) recommendations.push('Rendimiento bajo 98%: verificar calibración y pérdidas en planta/obra');

    return {
      cv,
      qualityLevel,
      recommendations,
      resistencias,
      mean,
      stdDev
    };
  };

  // Normal CDF approximation
  const normalCDF = (x: number) => {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
  };

  const erf = (x: number) => {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  };

  const metrics = calculateAdvancedMetrics();

  // Control chart data
  const controlChartData = data.remisiones.map((remision, index) => {
    const validEnsayos = remision.muestreos.flatMap(muestreo => 
      muestreo.muestras.flatMap(muestra => 
        muestra.ensayos.filter(ensayo => 
          ensayo.isEdadGarantia && 
          !ensayo.isEnsayoFueraTiempo && 
          ensayo.resistenciaCalculada > 0
        )
      )
    );

    const avgResistencia = validEnsayos.length > 0 
      ? validEnsayos.reduce((sum, e) => sum + e.resistenciaCalculada, 0) / validEnsayos.length
      : 0;

    const avgCompliance = validEnsayos.length > 0 
      ? validEnsayos.reduce((sum, e) => sum + e.porcentajeCumplimiento, 0) / validEnsayos.length
      : 0;

    return {
      remision: remision.remisionNumber,
      fecha: remision.fecha,
      resistencia: avgResistencia,
      compliance: avgCompliance,
      ensayos: validEnsayos.length,
      ucl: metrics.mean + (3 * metrics.stdDev), // Upper control limit
      lcl: metrics.mean - (3 * metrics.stdDev), // Lower control limit
      center: metrics.mean
    };
  }).filter(item => item.ensayos > 0);

  // Per-order sampling frequency (m3 per ensayada remision)
  // For each order: frequency = sum(volume of all remisiones in order) / (# remisiones ensayadas en el pedido)
  type OrderAgg = { totalVolume: number; sampledRemisiones: number };
  const orderAggregates = data.remisiones.reduce((acc: Record<string, OrderAgg>, remision) => {
    const orderId = remision.orderId || 'unknown';
    if (!acc[orderId]) {
      acc[orderId] = { totalVolume: 0, sampledRemisiones: 0 };
    }
    acc[orderId].totalVolume += remision.volume || 0;
    const hasValidEnsayo = remision.muestreos.some(m =>
      m.muestras.some(x =>
        x.ensayos.some(e => e.isEdadGarantia && !e.isEnsayoFueraTiempo && (e.resistenciaCalculada || 0) > 0)
      )
    );
    if (hasValidEnsayo) acc[orderId].sampledRemisiones += 1;
    return acc;
  }, {});

  const orderAggValues = Object.values(orderAggregates);
  const orderFrequencies = orderAggValues
    .filter(o => o.sampledRemisiones > 0)
    .map(o => o.totalVolume / o.sampledRemisiones);

  const averageSamplingFrequency = orderFrequencies.length > 0
    ? orderFrequencies.reduce((s, v) => s + v, 0) / orderFrequencies.length
    : 0;

  const ordersMeetingTargetPct = orderFrequencies.length > 0
    ? (orderFrequencies.filter(v => v <= 100).length / orderFrequencies.length) * 100
    : 0;

  const totalOrders = Object.keys(orderAggregates).length;
  const ordersWithEnsayo = orderAggValues.filter(o => o.sampledRemisiones > 0).length;
  const ordersSampledPct = totalOrders > 0 ? (ordersWithEnsayo / totalOrders) * 100 : 0;

  // Compliance of frequency vs. target (100 m³): >100 worse, <100 better
  const samplingCompliancePct = averageSamplingFrequency > 0
    ? (averageSamplingFrequency / 100) * 100 // 136 m³ -> 136%
    : 0;

  // Radar chart data for quality dimensions - more relevant metrics
  const radarData = [
    {
      dimension: 'Cumplimiento',
      value: summary.averages.complianceRate,
      fullMark: 100
    },
    {
      dimension: 'Consistencia',
      value: Math.max(0, 100 - metrics.cv),
      fullMark: 100
    },
    {
      dimension: 'Freq. Promedio',
      value: Math.min(100, (averageSamplingFrequency / 100) * 100),
      fullMark: 100
    },
    {
      dimension: 'Rend. Volumétrico',
      value: Math.min(100, summary.averages.rendimientoVolumetrico || 0),
      fullMark: 100
    },
    {
      dimension: 'Rendimiento',
      value: Math.min(100, summary.averages.rendimientoVolumetrico || 0),
      fullMark: 100
    }
  ];

  const getQualityBadgeVariant = (level: string) => {
    if (level.includes('Excelente')) return 'default';
    if (level.includes('Muy Bueno')) return 'default';
    if (level.includes('Aceptable')) return 'secondary';
    if (level.includes('Marginal')) return 'destructive';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      {/* Quality Level Assessment - Main KPI */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="h-6 w-6 text-blue-600" />
            Evaluación General de Calidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Badge variant={getQualityBadgeVariant(metrics.qualityLevel)} className="text-lg px-4 py-2">
                {metrics.qualityLevel}
              </Badge>
              <p className="text-sm text-gray-600 mt-2">
                Basado en análisis estadístico de {metrics.resistencias.length} ensayos válidos
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-800">
                {formatNumber(metrics.mean, 1)} kg/cm²
              </div>
              <div className="text-sm text-gray-500">Resistencia Promedio</div>
              <div className="text-xs text-gray-400">σ = {formatNumber(metrics.stdDev, 1)} kg/cm² • CV = {formatNumber(metrics.cv, 1)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Quality Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatNumber(metrics.cv, 1)}%
              </div>
              <div className="text-sm text-gray-500">Coeficiente de Variación</div>
              <div className="text-xs text-gray-400 mt-1">
                {metrics.cv < 5 ? 'Excelente' : metrics.cv < 10 ? 'Bueno' : 'Alto'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatNumber(averageSamplingFrequency, 1)} m³
              </div>
              <div className="text-sm text-gray-500">Frecuencia Promedio por Pedido</div>
              <div className="text-xs text-gray-400 mt-1">{orderFrequencies.length} pedidos muestreados</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatNumber(samplingCompliancePct, 1)}%
              </div>
              <div className="text-sm text-gray-500">Cumplimiento Frecuencia (vs 100 m³)</div>
              <div className="text-xs text-gray-400 mt-1">
                {formatNumber(averageSamplingFrequency, 1)} m³ por ensayo
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatNumber(ordersMeetingTargetPct, 1)}%
              </div>
              <div className="text-sm text-gray-500">Pedidos ≤ 100 m³ por Ensayo</div>
              <div className="text-xs text-gray-400 mt-1">
                Meta ≤ 100 m³ por ensayo
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Control Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Gráfico de Control - Resistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={controlChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="remision" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm text-blue-600">
                          Resistencia: {formatNumber(payload[0].value, 1)} kg/cm²
                        </p>
                        <p className="text-sm text-green-600">
                          Cumplimiento: {formatNumber(payload[1].value, 1)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Line 
                  type="monotone" 
                  dataKey="resistencia" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Resistencia (kg/cm²)"
                />
                <Line 
                  type="monotone" 
                  dataKey="center" 
                  stroke="#ff7300" 
                  strokeDasharray="5 5"
                  name="Línea Central"
                />
                <Line 
                  type="monotone" 
                  dataKey="ucl" 
                  stroke="#ff0000" 
                  strokeDasharray="3 3"
                  name="LCS"
                />
                <Line 
                  type="monotone" 
                  dataKey="lcl" 
                  stroke="#ff0000" 
                  strokeDasharray="3 3"
                  name="LCI"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quality Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Perfil de Calidad Multidimensional</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar 
                  name="Calidad" 
                  dataKey="value" 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {metrics.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Recomendaciones de Mejora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {metrics.recommendations.map((recommendation, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{recommendation}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistical Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Estadístico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-800">Media</div>
              <div className="text-lg font-bold text-blue-600">{formatNumber(metrics.mean, 1)} kg/cm²</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-800">Desv. Estándar</div>
              <div className="text-lg font-bold text-green-600">{formatNumber(metrics.stdDev, 1)} kg/cm²</div>
            </div>
            {/* Deprecated cards removed to avoid confusing/negative messaging */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}