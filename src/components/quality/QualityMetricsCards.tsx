import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Activity, CheckCircle2, Gauge, Target, Droplets, TrendingDown } from 'lucide-react';
import type { QualityMetrics } from '@/hooks/useQualityDashboard';

interface QualityMetricsCardsProps {
  metrics: QualityMetrics;
  loading: boolean;
  eficienciaOverride?: number;
  rendimientoVolumetricoOverride?: number;
  showStdDev?: boolean;
}

export function QualityMetricsCards({ metrics, loading, eficienciaOverride, rendimientoVolumetricoOverride, showStdDev = false }: QualityMetricsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <Card key={item} className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <div className="h-4 w-[120px] bg-slate-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-10 w-[80px] bg-slate-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-[140px] bg-slate-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const eficiencia = typeof eficienciaOverride === 'number' && !isNaN(eficienciaOverride)
    ? eficienciaOverride
    : metrics.eficiencia;
  const rendimientoVolumetrico = typeof rendimientoVolumetricoOverride === 'number' && !isNaN(rendimientoVolumetricoOverride)
    ? rendimientoVolumetricoOverride
    : metrics.rendimientoVolumetrico;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI: Muestras en cumplimiento */}
      <Card className="bg-white border-l-4 border-l-emerald-600 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Muestras en Cumplimiento
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-slate-900 mb-1">
            {metrics.muestrasEnCumplimiento}
          </div>
          <div className="text-sm text-slate-500">
            de {metrics.numeroMuestras} muestras
          </div>
        </CardContent>
      </Card>

      {/* KPI: Resistencia Promedio */}
      <Card className="bg-white border-l-4 border-l-blue-600 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Resistencia Promedio
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-slate-900 mb-1">
            {typeof metrics.resistenciaPromedio === 'number' ? metrics.resistenciaPromedio.toFixed(2) : '0.00'}
          </div>
          <div className="text-sm text-slate-500">
            kg/cm²
          </div>
        </CardContent>
      </Card>

      {/* KPI: % Resistencia Garantía */}
      <Card className="bg-white border-l-4 border-l-amber-600 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              % Resistencia a Garantía
            </CardTitle>
            <Target className="h-5 w-5 text-amber-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-slate-900 mb-1">
            {typeof metrics.porcentajeResistenciaGarantia === 'number' ? metrics.porcentajeResistenciaGarantia.toFixed(2) : '0.00'}%
          </div>
          <div className="text-sm text-slate-500">
            promedio de cumplimiento
          </div>
        </CardContent>
      </Card>

      {/* KPI: Coeficiente de Variación */}
      <Card className="bg-white border-l-4 border-l-purple-600 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Coeficiente de Variación
            </CardTitle>
            <Activity className="h-5 w-5 text-purple-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-slate-900 mb-1">
            {typeof metrics.coeficienteVariacion === 'number' ? metrics.coeficienteVariacion.toFixed(2) : '0.00'}%
          </div>
          <div className="text-sm text-slate-500">
            uniformidad del concreto
          </div>
        </CardContent>
      </Card>

      {/* KPI: Eficiencia */}
      <Card className="bg-white border-l-4 border-l-teal-600 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Eficiencia
            </CardTitle>
            <Gauge className="h-5 w-5 text-teal-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-slate-900 mb-1">
            {typeof eficiencia === 'number' ? eficiencia.toFixed(3) : '0.000'}
          </div>
          <div className="text-sm text-slate-500">
            kg/cm² por kg de cemento
          </div>
        </CardContent>
      </Card>

      {/* KPI: Rendimiento Volumétrico */}
      <Card className="bg-white border-l-4 border-l-cyan-600 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Rendimiento Volumétrico
            </CardTitle>
            <Droplets className="h-5 w-5 text-cyan-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-slate-900 mb-1">
            {typeof rendimientoVolumetrico === 'number' ? rendimientoVolumetrico.toFixed(2) : '0.00'}%
          </div>
          <div className="text-sm text-slate-500">
            volumen real vs registrado
          </div>
        </CardContent>
      </Card>

      {/* KPI: Desviación Estándar (visible solo con un FC seleccionado) */}
      {showStdDev && (
        <Card className="bg-white border-l-4 border-l-rose-600 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">
                Desviación Estándar
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900 mb-1">
              {typeof metrics.desviacionEstandar === 'number' ? metrics.desviacionEstandar.toFixed(2) : '0.00'}
            </div>
            <div className="text-sm text-slate-500">
              variabilidad de resistencia
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
