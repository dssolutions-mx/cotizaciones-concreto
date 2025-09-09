import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Activity } from 'lucide-react';
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((item) => (
          <Card key={item} className="bg-white/60 backdrop-blur border border-slate-200/60 shadow-sm">
            <CardHeader className="pb-2">
              <div className="h-4 w-[120px] bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-10 w-[80px] bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-[180px] bg-gray-200 rounded animate-pulse" />
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* KPI: Muestras en cumplimiento */}
      <Card className="border-l-4 border-l-green-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Muestras en Cumplimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                {metrics.muestrasEnCumplimiento}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                de {metrics.numeroMuestras} muestras mostradas
              </div>
            </div>
            <div className="bg-green-100 p-2 rounded-md">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Resistencia Promedio */}
      <Card className="border-l-4 border-l-blue-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Resistencia Promedio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                {typeof metrics.resistenciaPromedio === 'number' ? metrics.resistenciaPromedio.toFixed(2) : '0.00'}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                kg/cm²
              </div>
            </div>
            <div className="bg-blue-100 p-2 rounded-md">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: % Resistencia Garantía */}
      <Card className="border-l-4 border-l-amber-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm md:text-base font-semibold text-slate-700">% Resistencia a Garantía</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                {typeof metrics.porcentajeResistenciaGarantia === 'number' ? metrics.porcentajeResistenciaGarantia.toFixed(2) : '0.00'}%
              </div>
              <div className="text-sm text-slate-500 mt-1">
                promedio de cumplimiento
              </div>
            </div>
            <div className="bg-amber-100 p-2 rounded-md">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Coeficiente de Variación */}
      <Card className="border-l-4 border-l-purple-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Coeficiente de Variación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                {typeof metrics.coeficienteVariacion === 'number' ? metrics.coeficienteVariacion.toFixed(2) : '0.00'}%
              </div>
              <div className="text-sm text-slate-500 mt-1">
                uniformidad del concreto
              </div>
            </div>
            <div className="bg-purple-100 p-2 rounded-md">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Eficiencia */}
      <Card className="border-l-4 border-l-teal-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Eficiencia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                {typeof eficiencia === 'number' ? eficiencia.toFixed(3) : '0.000'}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                kg/cm² por kg de cemento
              </div>
            </div>
            <div className="bg-teal-100 p-2 rounded-md">
              <Activity className="h-5 w-5 text-teal-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Rendimiento Volumétrico */}
      <Card className="border-l-4 border-l-cyan-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Rendimiento Volumétrico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                {typeof rendimientoVolumetrico === 'number' ? rendimientoVolumetrico.toFixed(2) : '0.00'}%
              </div>
              <div className="text-sm text-slate-500 mt-1">
                volumen real vs registrado
              </div>
            </div>
            <div className="bg-cyan-100 p-2 rounded-md">
              <TrendingUp className="h-5 w-5 text-cyan-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Desviación Estándar (visible solo con un FC seleccionado) */}
      {showStdDev && (
        <Card className="border-l-4 border-l-rose-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Desviación Estándar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  {typeof metrics.desviacionEstandar === 'number' ? metrics.desviacionEstandar.toFixed(2) : '0.00'}
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  variabilidad de resistencia
                </div>
              </div>
              <div className="bg-rose-100 p-2 rounded-md">
                <BarChart3 className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
