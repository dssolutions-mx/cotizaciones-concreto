'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
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

    // Group consistency by concrete strength/age (from muestreos.concrete_specs)
    // Helper to normalize age to a readable label (e.g., 28d, 24h)
    const getAgeLabel = (specs: any): string => {
      if (!specs) return 'NA';

      // Normalize when concrete_specs arrives as a JSON string or shorthand (e.g., "24h", "28d")
      const parsedSpecs = (() => {
        if (typeof specs === 'string') {
          const trimmed = specs.trim();
          try {
            const obj = JSON.parse(trimmed);
            if (obj && typeof obj === 'object') return obj;
          } catch (_e) {
            const lower = trimmed.toLowerCase();
            if (/^\d+\s*h$/.test(lower)) {
              const hours = parseInt(lower);
              return { valor_edad: hours, unidad_edad: 'HORA' };
            }
            if (/^\d+\s*d$/.test(lower)) {
              const days = parseInt(lower);
              return { valor_edad: days, unidad_edad: 'DÍA' };
            }
            if (/^\d+$/.test(lower)) {
              const days = parseInt(lower);
              return { valor_edad: days, unidad_edad: 'DÍA' };
            }
          }
        }
        return specs;
      })();

      // 0) Direct Spanish fields found in DB: valor_edad + unidad_edad ('DÍA'|'DÍAS'|'HORA'|'HORAS')
      const valorEdad = parsedSpecs?.valor_edad ?? parsedSpecs?.valorEdad;
      const unidadEdadRaw = parsedSpecs?.unidad_edad ?? parsedSpecs?.unidadEdad;
      if (typeof valorEdad === 'number' && valorEdad > 0 && unidadEdadRaw) {
        const unidad = unidadEdadRaw.toString().toLowerCase();
        const unidadNorm = unidad
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, ''); // remove accents
        if (unidadNorm.includes('hora')) return `${valorEdad}h`;
        if (unidadNorm.includes('dia')) return `${valorEdad}d`;
      }

      // 1) Explicit numeric fields
      const ageHours = parsedSpecs?.age_hours ?? parsedSpecs?.hours ?? parsedSpecs?.guarantee_age_hours ?? undefined;
      const ageDays = parsedSpecs?.age_days ?? parsedSpecs?.days ?? parsedSpecs?.guarantee_age_days ?? undefined;
      if (typeof ageHours === 'number' && ageHours > 0) return `${ageHours}h`;
      if (typeof ageDays === 'number' && ageDays > 0) return `${ageDays}d`;

      // 2) Dashboard-like JSON: guarantee_age or age as object { value, unit } or { days|hours }
      const ageObj = parsedSpecs?.guarantee_age ?? parsedSpecs?.age ?? parsedSpecs?.edad_garantia ?? undefined;
      if (ageObj && typeof ageObj === 'object') {
        // shape { value: 28, unit: 'DAYS'|'HOURS' } or { days|hours }
        const v = ageObj.value ?? ageObj.valor ?? ageObj.amount ?? undefined;
        const unitRaw = (ageObj.unit ?? ageObj.unidad ?? '').toString();
        const unitLc = unitRaw.toLowerCase();
        const unitNorm = unitLc
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const days = ageObj.days ?? ageObj.dias ?? undefined;
        const hours = ageObj.hours ?? ageObj.horas ?? undefined;
        if (typeof hours === 'number' && hours > 0) return `${hours}h`;
        if (typeof days === 'number' && days > 0) return `${days}d`;
        if (typeof v === 'number' && v > 0) {
          if (unitNorm.includes('hour') || unitNorm.includes('hora')) return `${v}h`;
          if (unitNorm.includes('day') || unitNorm.includes('dia')) return `${v}d`;
        }
      }

      // 3) Fallback string/number (could be '28d' or '24h')
      const genericAge = parsedSpecs?.age ?? parsedSpecs?.edad ?? undefined;
      if (typeof genericAge === 'string') {
        const trimmed = genericAge.trim().toLowerCase();
        if (/^\d+\s*h$/.test(trimmed)) return trimmed.replace(/\s+/g, '');
        if (/^\d+\s*d$/.test(trimmed)) return trimmed.replace(/\s+/g, '');
        // If just a number, assume days
        if (/^\d+$/.test(trimmed)) return `${trimmed}d`;
      }
      if (typeof genericAge === 'number' && genericAge > 0) return `${genericAge}d`;
      return 'NA';
    };

    type GroupAgg = { values: number[]; compliances: number[] };
    const groups: Record<string, GroupAgg> = {};
    data.remisiones.forEach((rem) => {
      rem.muestreos.forEach((m: any) => {
        const specs = m.concrete_specs || {};
        const strength = specs.strength_fc ?? rem.recipeFc ?? 'NA';
        const ageLabel = getAgeLabel(specs);
        const key = `${strength}-${ageLabel}`;
        // Aggregate per muestreo: average valid ensayos within this muestreo
        const validEnsayosDelMuestreo: Array<{ resistencia: number; cumplimiento: number }> = [];
        m.muestras.forEach((mx: any) => {
          const ensayos = (mx.ensayos || []).filter((e: any) => 
            e.isEdadGarantia && 
            !e.isEnsayoFueraTiempo && 
            (e.resistenciaCalculada || 0) > 0
          );
          ensayos.forEach((e: any) => {
            validEnsayosDelMuestreo.push({
              resistencia: e.resistenciaCalculada,
              cumplimiento: e.porcentajeCumplimiento || 0
            });
          });
        });

        if (validEnsayosDelMuestreo.length > 0) {
          const nE = validEnsayosDelMuestreo.length;
          const avgResMuestreo = validEnsayosDelMuestreo.reduce((s, x) => s + x.resistencia, 0) / nE;
          const avgCumplMuestreo = validEnsayosDelMuestreo.reduce((s, x) => s + x.cumplimiento, 0) / nE;
          if (!groups[key]) groups[key] = { values: [], compliances: [] };
          groups[key].values.push(avgResMuestreo);
          groups[key].compliances.push(avgCumplMuestreo);
        }
      });
    });

    // Compute per-group stats and weighted CV
    const groupStatsRaw = Object.entries(groups).map(([key, g]) => {
      const n = g.values.length || 1;
      const meanG = g.values.reduce((s, v) => s + v, 0) / n;
      const varG = g.values.reduce((s, v) => s + Math.pow(v - meanG, 2), 0) / n;
      const stdG = Math.sqrt(varG);
      const cvG = meanG > 0 ? (stdG / meanG) * 100 : 0;
      const avgCompliance = g.compliances.length > 0
        ? g.compliances.reduce((s, v) => s + v, 0) / g.compliances.length
        : 0;
      const [strengthStr, ageStr] = key.split('-');
      return { key, strength: strengthStr, age: ageStr, count: n, mean: meanG, std: stdG, cv: cvG, compliance: avgCompliance };
    });
    // Exclude groups with insufficient muestreos (<3)
    const groupStats = groupStatsRaw.filter(g => g.count >= 3);
    const totalCount = groupStats.reduce((s, g) => s + g.count, 0) || 1;
    const cvWeighted = groupStats.reduce((s, g) => s + g.cv * (g.count / totalCount), 0);

    // % groups in target (CV <= 10%) weighted by sample count
    const groupsInTargetWeighted = groupStats.reduce((s, g) => s + (g.cv <= 10 ? g.count : 0), 0) / totalCount * 100;

    // Global statistics (all ensayos) for media/σ display
    const resistencias = allEnsayos.map(e => e.resistenciaCalculada);
    const mean = resistencias.reduce((sum, val) => sum + val, 0) / resistencias.length;
    const variance = resistencias.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / resistencias.length;
    const stdDev = Math.sqrt(variance);
    const cv = cvWeighted; // use grouped, weighted CV as consistency metric

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
      stdDev,
      groupStats,
      groupsInTargetWeighted
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

  // Precompute guarantee-age ensayos once to keep charts consistent
  const guaranteeAgeEnsayos = React.useMemo(() => {
    return data.remisiones.flatMap(remision =>
      remision.muestreos.flatMap(muestreo =>
        muestreo.muestras.flatMap(muestra =>
          (muestra.ensayos || []).filter(ensayo =>
            ensayo.isEdadGarantia &&
            !ensayo.isEnsayoFueraTiempo &&
            (ensayo.resistenciaCalculada || 0) > 0 &&
            (ensayo.porcentajeCumplimiento || 0) >= 0
          )
        )
      )
    );
  }, [data]);

  // Compliance histogram data
  const complianceHistogram = (() => {
    const allEnsayos = guaranteeAgeEnsayos;
    const ranges = [
      { key: '0-80', from: 0, to: 80 },
      { key: '80-85', from: 80, to: 85 },
      { key: '85-90', from: 85, to: 90 },
      { key: '90-95', from: 90, to: 95 },
      { key: '95-100', from: 95, to: 100 },
      { key: '100-110', from: 100, to: 110 }
    ];
    const counts = Object.fromEntries(ranges.map(r => [r.key, 0]));
    allEnsayos.forEach(e => {
      const c = e.porcentajeCumplimiento || 0;
      const r = ranges.find(rr => c >= rr.from && c < rr.to) || ranges[ranges.length - 1];
      counts[r.key] += 1;
    });
    return ranges.map(r => ({ range: r.key, count: counts[r.key] }));
  })();

  // Map CV to guidance per provided ranges
  const getCvGuidance = (cv: number) => {
    if (cv < 5) return 'Excelente';
    if (cv >= 5 && cv < 7) return 'Muy Bueno';
    if (cv >= 7 && cv < 10) return 'Bueno';
    if (cv >= 10 && cv <= 12) return 'Aceptable';
    return 'Pobre';
  };


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
  // Frequency compliance (lower is better): 100 / freq * 100
  const samplingCompliancePct = averageSamplingFrequency > 0
    ? (100 / averageSamplingFrequency) * 100 // 65 m³ -> 153.8%
    : 0;

  // Clamp helper to keep values within 0-100
  const clampPercent = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

  // Radar chart data for quality dimensions - three metrics: Rendimiento Volumétrico, Cumplimiento, Consistencia
  const radarData = [
    {
      dimension: 'Rendimiento Volumétrico',
      value: clampPercent(summary.averages.rendimientoVolumetrico || 0),
      fullMark: 100
    },
    {
      dimension: 'Cumplimiento',
      value: clampPercent(summary.averages.complianceRate || 0),
      fullMark: 100
    },
    {
      dimension: 'Consistencia',
      value: clampPercent(100 - (metrics.cv || 0)),
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
                {getCvGuidance(metrics.cv)}
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
                {formatNumber(metrics.groupsInTargetWeighted || 0, 1)}%
              </div>
              <div className="text-sm text-gray-500">Grupos en Objetivo (CV ≤ 10%)</div>
              <div className="text-xs text-gray-400 mt-1">Ponderado por ensayos</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row: Radar + Compliance distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Perfil de Calidad Multidimensional</CardTitle>
          </CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={420}>
               <RadarChart 
                 data={radarData} 
                 cx="50%" 
                 cy="52%" 
                 outerRadius="85%"
                 margin={{ top: 30, right: 80, bottom: 50, left: 80 }}
               >
                 <defs>
                   <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                     <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.08} />
                   </linearGradient>
                 </defs>
                 <PolarGrid 
                   stroke="#d1d5db" 
                   strokeWidth={1}
                   gridType="polygon" 
                   radialLines={false}
                 />
                 <PolarAngleAxis 
                   dataKey="dimension" 
                   tick={{ 
                     fill: '#1f2937', 
                     fontSize: 15, 
                     fontWeight: 600,
                     dy: -10                     
                   }} 
                   className="select-none"
                   tickFormatter={(value) => value}
                   
                   tickLine={false}
                 />
                 <PolarRadiusAxis 
                   angle={90} 
                   domain={[0, 100]} 
                   tick={{ 
                     fill: '#9ca3af', 
                     fontSize: 10,
                     fontWeight: 500
                   }}
                   tickCount={3}
                   axisLine={false}
                   tickFormatter={(value) => value}
                 />
                 <Tooltip 
                   formatter={(value: any) => [`${formatNumber(Number(value), 1)}%`, 'Puntuación']} 
                   labelFormatter={(label: any) => label}
                   contentStyle={{
                     backgroundColor: '#ffffff',
                     border: '1px solid #e5e7eb',
                     borderRadius: '8px',
                     boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                   }}
                 />
                 <Radar 
                   name="Calidad"
                   dataKey="value"
                   stroke="#3b82f6"
                   strokeWidth={2.5}
                   fill="url(#radarGradient)"
                   dot={{ 
                     r: 4, 
                     stroke: '#3b82f6', 
                     strokeWidth: 2, 
                     fill: '#ffffff',
                     style: { filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }
                   }}
                   isAnimationActive
                   animationDuration={1000}
                 />
               </RadarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de Cumplimiento (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={complianceHistogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => [v, 'Ensayos']} />
                <Bar dataKey="count" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Grouped Consistency Table */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis por Resistencia y Edad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Resistencia (Fc)</th>
                  <th className="py-2 pr-4">Edad (días)</th>
                  <th className="py-2 pr-4 text-right">Muestreos</th>
                  <th className="py-2 pr-4 text-right">Media (kg/cm²)</th>
                  <th className="py-2 pr-4 text-right">σ (kg/cm²)</th>
                  <th className="py-2 pr-4 text-right">CV (%)</th>
                  <th className="py-2 pr-4 text-right">Cumplimiento (%)</th>
                </tr>
              </thead>
              <tbody>
                {(metrics.groupStats || []).map((g: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    <td className="py-2 pr-4">{g.strength}</td>
                    <td className="py-2 pr-4">{g.age}</td>
                    <td className="py-2 pr-4 text-right">{g.count}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(g.mean, 1)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(g.std, 1)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(g.cv, 1)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(g.compliance, 1)}</td>
                  </tr>)
                )}
                {(!metrics.groupStats || metrics.groupStats.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-gray-500">Sin datos suficientes para agrupar (mínimo 3 ensayos por grupo)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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