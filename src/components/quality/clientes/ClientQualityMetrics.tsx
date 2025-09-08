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
  Info
} from 'lucide-react';
import type { ClientQualitySummary } from '@/types/clientQuality';

interface ClientQualityMetricsProps {
  summary: ClientQualitySummary;
  loading?: boolean;
}

export function ClientQualityMetrics({ summary, loading }: ClientQualityMetricsProps) {
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

  const formatNumber = (num: number, decimals: number = 1) => {
    return num.toFixed(decimals);
  };

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
      {/* Client Info Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {summary.clientInfo.business_name}
            </div>
            <Badge variant="outline">
              {summary.clientInfo.client_code}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">RFC:</span> {summary.clientInfo.rfc || 'No disponible'}
            </div>
            <div>
              <span className="font-medium">Período:</span>{' '}
              {new Date(summary.period.from).toLocaleDateString('es-ES')} - {' '}
              {new Date(summary.period.to).toLocaleDateString('es-ES')}
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
              {summary.totals.remisiones} remisiones
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
          </CardContent>
        </Card>

        {/* On-Time Testing Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ensayos a Tiempo</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatNumber(summary.performance.onTimeTestingRate)}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {summary.totals.ensayos} ensayos totales
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Tests per Remision */}
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {summary.totals.remisiones > 0
                  ? formatNumber(summary.totals.ensayos / summary.totals.remisiones, 1)
                  : '0'
                }
              </div>
              <div className="text-sm text-gray-500">Ensayos por Remisión</div>
            </div>
          </CardContent>
        </Card>
      </div>

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
