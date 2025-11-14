'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  DollarSign,
  Zap,
  BarChart3,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { RecipeQualitySummary } from '@/hooks/useProgressiveRecipeQuality';

interface RecipeAdvancedMetricsProps {
  summary: RecipeQualitySummary;
  loading?: boolean;
}

export function RecipeAdvancedMetrics({ summary, loading }: RecipeAdvancedMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
          <Card key={item} className="bg-white/60 backdrop-blur">
            <CardHeader className="pb-2">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Calculate CV quality classification
  const getCVClassification = (cv: number) => {
    if (cv <= 8) return { label: 'Excelente', color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-700' };
    if (cv <= 12) return { label: 'Muy Buena', color: 'blue', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
    if (cv <= 15) return { label: 'Buena', color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' };
    return { label: 'Requiere Atención', color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-700' };
  };

  // Calculate efficiency classification
  const getEfficiencyLevel = (efficiency: number, recipeFc: number) => {
    const expectedEfficiency = recipeFc >= 25 ? 0.12 : 0.10;
    if (efficiency >= expectedEfficiency * 1.1) return { label: 'Excelente', color: 'green' };
    if (efficiency >= expectedEfficiency * 0.9) return { label: 'Buena', color: 'blue' };
    return { label: 'Mejorable', color: 'yellow' };
  };

  // Calculate yield classification
  const getYieldClassification = (yield_pct: number) => {
    if (yield_pct >= 100) return { label: 'Excelente', color: 'green', icon: CheckCircle2 };
    if (yield_pct >= 98) return { label: 'Buena', color: 'blue', icon: CheckCircle2 };
    if (yield_pct >= 95) return { label: 'Aceptable', color: 'yellow', icon: AlertCircle };
    return { label: 'Requiere Atención', color: 'red', icon: AlertCircle };
  };

  const cvClass = summary.statistics ? getCVClassification(summary.statistics.cv) : null;
  const yieldClass = getYieldClassification(summary.averages.rendimientoVolumetrico);

  // Calculate efficiency rating
  const avgEfficiency = summary.averages.resistencia / (summary.averages.resistencia / summary.recipeInfo.strength_fc);

  return (
    <div className="space-y-6">
      {/* Primary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compliance Rate */}
        <Card className="border-l-4 border-l-green-500 bg-white/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Tasa de Cumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight text-gray-900">
                  {formatNumber(summary.averages.complianceRate, 1)}%
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {summary.totals.ensayosEdadGarantia} ensayos válidos
                </div>
              </div>
              <div className={`p-2 rounded-md ${
                summary.averages.complianceRate >= 100 ? 'bg-green-100' :
                summary.averages.complianceRate >= 95 ? 'bg-blue-100' : 'bg-yellow-100'
              }`}>
                <TrendingUp className={`h-5 w-5 ${
                  summary.averages.complianceRate >= 100 ? 'text-green-600' :
                  summary.averages.complianceRate >= 95 ? 'text-blue-600' : 'text-yellow-600'
                }`} />
              </div>
            </div>
            {summary.averages.complianceRate < 95 && (
              <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Por debajo del objetivo (95%)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average Resistance */}
        <Card className="border-l-4 border-l-blue-500 bg-white/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Resistencia Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight text-gray-900">
                  {formatNumber(summary.averages.resistencia, 0)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  kg/cm² (objetivo f'c: {summary.recipeInfo.strength_fc})
                </div>
              </div>
              <div className="bg-blue-100 p-2 rounded-md">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xs text-gray-600">
                Eficiencia: {formatNumber((summary.averages.resistencia / summary.recipeInfo.strength_fc) * 100, 1)}%
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coefficient of Variation */}
        {summary.statistics && (
          <Card className={`border-l-4 border-l-${cvClass!.color}-500 bg-white/80 shadow-sm`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Coeficiente de Variación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold tracking-tight text-gray-900">
                    {formatNumber(summary.statistics.cv, 1)}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    uniformidad del concreto
                  </div>
                </div>
                <div className={`p-2 rounded-md ${cvClass!.bgColor}`}>
                  <Activity className={`h-5 w-5 ${cvClass!.textColor}`} />
                </div>
              </div>
              <div className="mt-2">
                <Badge variant={cvClass!.color === 'green' || cvClass!.color === 'blue' ? 'default' : 'destructive'} className="text-xs">
                  {cvClass!.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Volumetric Yield */}
        <Card className={`border-l-4 border-l-${yieldClass.color}-500 bg-white/80 shadow-sm`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Rendimiento Volumétrico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight text-gray-900">
                  {formatNumber(summary.averages.rendimientoVolumetrico, 1)}%
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  eficiencia de producción
                </div>
              </div>
              <div className={`p-2 rounded-md bg-${yieldClass.color}-100`}>
                <yieldClass.icon className={`h-5 w-5 text-${yieldClass.color}-600`} />
              </div>
            </div>
            <div className="mt-2">
              <Badge variant={yieldClass.color === 'green' || yieldClass.color === 'blue' ? 'default' : 'secondary'} className="text-xs">
                {yieldClass.label}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cost per m³ */}
        <Card className="bg-white/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Costo Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.averages.costPerM3)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              por metro cúbico
            </div>
            <div className="mt-2 text-xs text-purple-600">
              Cemento: {formatNumber(summary.averages.cementSharePct, 1)}% del costo
            </div>
          </CardContent>
        </Card>

        {/* Standard Deviation */}
        {summary.statistics && (
          <Card className="bg-white/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Desviación Estándar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(summary.statistics.stdDev, 1)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                kg/cm² variación
              </div>
              <div className="mt-2 text-xs text-gray-600">
                σ = {formatNumber(summary.statistics.stdDev, 2)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unit Mass */}
        <Card className="bg-white/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Masa Unitaria Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(summary.averages.masaUnitaria, 0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              kg/m³
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {summary.totals.muestreos} muestreos
            </div>
          </CardContent>
        </Card>

        {/* On-Time Testing */}
        <Card className="bg-white/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Ensayos a Tiempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(summary.performance.onTimeTestingRate, 0)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              oportunidad de ensayos
            </div>
            {summary.performance.onTimeTestingRate < 90 && (
              <div className="mt-2 text-xs text-yellow-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Mejorar puntualidad
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coverage Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {formatNumber(summary.totals.volume, 0)}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                m³ Total
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.totals.remisiones} remisiones
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {formatNumber(summary.totals.porcentajeCoberturaMuestreo, 0)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Cobertura Muestreo
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.totals.remisionesMuestreadas} de {summary.totals.remisiones}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {formatNumber(summary.totals.porcentajeCoberturaCalidad, 0)}%
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Cobertura Calidad
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ensayos completos
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">
                {summary.totals.muestreos}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Muestreos Totales
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.totals.ensayos} ensayos
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistical Quality Groups */}
      {summary.statistics && summary.statistics.groupStats && summary.statistics.groupStats.length > 0 && (
        <Card className="bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">
              Análisis por Grupo de Edad de Garantía
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Resistencia</th>
                    <th className="py-2 pr-4">Edad</th>
                    <th className="py-2 pr-4">Muestreos</th>
                    <th className="py-2 pr-4">Media</th>
                    <th className="py-2 pr-4">Desv. Est.</th>
                    <th className="py-2 pr-4">CV</th>
                    <th className="py-2 pr-4">Cumplimiento</th>
                    <th className="py-2 pr-4">Calidad</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.statistics.groupStats.map((group, idx) => {
                    const cvClass = getCVClassification(group.cv);
                    return (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium">{group.strength}</td>
                        <td className="py-2 pr-4">{group.age}</td>
                        <td className="py-2 pr-4">{group.count}</td>
                        <td className="py-2 pr-4">{formatNumber(group.mean, 1)} kg/cm²</td>
                        <td className="py-2 pr-4">{formatNumber(group.std, 1)}</td>
                        <td className="py-2 pr-4">
                          <span className={`font-semibold ${cvClass.textColor}`}>
                            {formatNumber(group.cv, 1)}%
                          </span>
                        </td>
                        <td className="py-2 pr-4">{formatNumber(group.compliance, 1)}%</td>
                        <td className="py-2 pr-4">
                          <Badge variant={cvClass.color === 'green' || cvClass.color === 'blue' ? 'default' : 'secondary'} className="text-xs">
                            {cvClass.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <strong>{formatNumber(summary.statistics.groupsInTargetWeighted, 1)}%</strong> de los grupos cumplen con el objetivo de CV ≤ 10%
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
