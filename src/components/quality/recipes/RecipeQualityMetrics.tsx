'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  FlaskConical
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface RecipeQualitySummary {
  recipeInfo: {
    recipe_code: string;
    strength_fc: number;
    age_days: number;
  };
  totals: {
    volume: number;
    remisiones: number;
    remisionesMuestreadas: number;
    muestreos: number;
    ensayos: number;
    ensayosEdadGarantia: number;
    porcentajeCoberturaMuestreo: number;
    porcentajeCoberturaCalidad: number;
  };
  averages: {
    complianceRate: number;
    resistencia: number;
    masaUnitaria: number;
    rendimientoVolumetrico: number;
    costPerM3: number;
    cementSharePct: number;
  };
  performance: {
    qualityTrend: string;
    onTimeTestingRate: number;
  };
  statistics?: {
    mean: number;
    stdDev: number;
    cv: number;
    qualityLevel: string;
    groupStats: Array<{
      strength: string;
      age: string;
      count: number;
      mean: number;
      std: number;
      cv: number;
      compliance: number;
    }>;
    groupsInTargetWeighted: number;
  };
  alerts: Array<{
    type: 'error' | 'warning' | 'info';
    metric: string;
    message: string;
  }>;
}

interface RecipeQualityMetricsProps {
  summary: RecipeQualitySummary;
  loading?: boolean;
}

export function RecipeQualityMetrics({ summary, loading }: RecipeQualityMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceBadgeVariant = (rate: number) => {
    if (rate >= 95) return 'default';
    if (rate >= 85) return 'secondary';
    return 'destructive';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Recipe Info Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              {summary.recipeInfo.recipe_code}
            </div>
            <Badge variant="outline">
              f'c {summary.recipeInfo.strength_fc} MPa @ {summary.recipeInfo.age_days}d
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Resistencia Objetivo:</span> {summary.recipeInfo.strength_fc} MPa
            </div>
            <div>
              <span className="font-medium">Edad de Garantía:</span> {summary.recipeInfo.age_days} días
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Tendencia:</span>
              {getTrendIcon(summary.performance.qualityTrend)}
              <span className="capitalize">{summary.performance.qualityTrend}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Volume Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Volumen Total</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatNumber(summary.totals.volume)} m³
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {summary.totals.remisiones} remisiones totales
            </div>
            <div className="mt-1 text-xs text-blue-600">
              {summary.totals.remisionesMuestreadas} muestreadas ({formatNumber(summary.totals.porcentajeCoberturaMuestreo)}%)
            </div>
          </CardContent>
        </Card>

        {/* Compliance Rate Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cumplimiento</p>
                <p className={`text-2xl font-bold ${getComplianceColor(summary.averages.complianceRate)}`}>
                  {formatNumber(summary.averages.complianceRate)}%
                </p>
              </div>
              <Target className="h-8 w-8 text-gray-600" />
            </div>
            <div className="mt-2">
              <Badge variant={getComplianceBadgeVariant(summary.averages.complianceRate)}>
                {summary.averages.complianceRate >= 95 ? 'Excelente' :
                 summary.averages.complianceRate >= 85 ? 'Aceptable' : 'Requiere Atención'}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Basado en {summary.totals.ensayosEdadGarantia} ensayos válidos
            </div>
          </CardContent>
        </Card>

        {/* Average Resistance Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resistencia Promedio</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(summary.averages.resistencia)} kg/cm²
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {summary.totals.ensayosEdadGarantia} ensayos de edad garantía
            </div>
            <div className="mt-1 text-xs text-green-600">
              Eficiencia: {formatNumber((summary.averages.resistencia / summary.recipeInfo.strength_fc) * 100)}%
            </div>
          </CardContent>
        </Card>

        {/* Cost per m³ Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Costo Promedio</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(summary.averages.costPerM3)}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Por metro cúbico
            </div>
            <div className="mt-1 text-xs text-purple-600">
              Cemento: {formatNumber(summary.averages.cementSharePct)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Sampling Metrics */}
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {summary.totals.muestreos}
              </div>
              <div className="text-sm text-gray-500">Muestreos Realizados</div>
            </div>
          </CardContent>
        </Card>

        {/* Average Unit Mass */}
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(summary.averages.masaUnitaria)} kg/m³
              </div>
              <div className="text-sm text-gray-500">Masa Unitaria Promedio</div>
            </div>
          </CardContent>
        </Card>

        {/* Volumetric Yield */}
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(summary.averages.rendimientoVolumetrico, 1)}%
              </div>
              <div className="text-sm text-gray-500">Rendimiento Volumétrico</div>
            </div>
          </CardContent>
        </Card>

        {/* On-Time Testing */}
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(summary.performance.onTimeTestingRate)}%
              </div>
              <div className="text-sm text-gray-500">Ensayos a Tiempo</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistical Analysis Row */}
      {summary.statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Coefficient of Variation */}
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {formatNumber(summary.statistics.cv, 1)}%
                </div>
                <div className="text-sm text-gray-500">Coeficiente de Variación</div>
                <div className="text-xs text-gray-400 mt-1">
                  {summary.statistics.cv <= 8 ? 'Excelente' : 
                   summary.statistics.cv <= 10 ? 'Muy Bueno' : 
                   summary.statistics.cv <= 12 ? 'Bueno' : 'Mejorable'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Standard Deviation */}
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {formatNumber(summary.statistics.stdDev, 1)} kg/cm²
                </div>
                <div className="text-sm text-gray-500">Desviación Estándar</div>
                <div className="text-xs text-gray-400 mt-1">
                  σ = {formatNumber(summary.statistics.stdDev, 1)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mean Resistance */}
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-600">
                  {formatNumber(summary.statistics.mean, 1)} kg/cm²
                </div>
                <div className="text-sm text-gray-500">Resistencia Promedio</div>
                <div className="text-xs text-gray-400 mt-1">
                  Media estadística
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quality Level */}
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <Badge 
                  variant={
                    summary.statistics.qualityLevel === 'Excelente' ? 'default' :
                    summary.statistics.qualityLevel === 'Muy Bueno' ? 'default' :
                    summary.statistics.qualityLevel === 'Aceptable' ? 'secondary' : 'destructive'
                  }
                  className="text-sm px-3 py-1"
                >
                  {summary.statistics.qualityLevel}
                </Badge>
                <div className="text-sm text-gray-500 mt-2">Nivel de Calidad</div>
                <div className="text-xs text-gray-400 mt-1">
                  {summary.statistics.groupsInTargetWeighted.toFixed(1)}% grupos en objetivo
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts Section */}
      {summary.alerts.length > 0 && (
        <div className="space-y-2">
          {summary.alerts.map((alert, index) => (
            <Alert key={index} variant={alert.type === 'error' ? 'destructive' : 'default'}>
              {alert.type === 'error' && <XCircle className="h-4 w-4" />}
              {alert.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
              {alert.type === 'info' && <Info className="h-4 w-4" />}
              <AlertDescription>
                <strong>{alert.metric}:</strong> {alert.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
