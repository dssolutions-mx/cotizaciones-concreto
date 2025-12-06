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
          <Card key={item} className="glass-thick rounded-xl border border-slate-200">
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
      {/* KPI: Muestreos en cumplimiento */}
      <Card className="glass-thick rounded-xl border border-slate-200 bg-gradient-to-br from-systemGreen/20 to-systemGreen/5 hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-title-3 font-semibold text-slate-700">
              Muestreos en Cumplimiento
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-systemGreen" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-title-1 font-bold text-slate-900 mb-1">
            {metrics.muestrasEnCumplimiento}
          </div>
          <div className="text-footnote text-slate-500">
            de {metrics.numeroMuestras} muestreos
          </div>
        </CardContent>
      </Card>

      {/* KPI: Resistencia Promedio */}
      <Card className="glass-thick rounded-xl border border-slate-200 bg-gradient-to-br from-systemBlue/20 to-systemBlue/5 hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-title-3 font-semibold text-slate-700">
              Resistencia Promedio
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-systemBlue" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-title-1 font-bold text-slate-900 mb-1">
            {typeof metrics.resistenciaPromedio === 'number' ? metrics.resistenciaPromedio.toFixed(2) : '0.00'}
          </div>
          <div className="text-footnote text-slate-500">
            kg/cm²
          </div>
        </CardContent>
      </Card>

      {/* KPI: % Resistencia Garantía */}
      <Card className="glass-thick rounded-xl border border-slate-200 bg-gradient-to-br from-systemOrange/20 to-systemOrange/5 hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-title-3 font-semibold text-slate-700">
              % Resistencia a Garantía
            </CardTitle>
            <Target className="h-5 w-5 text-systemOrange" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-title-1 font-bold text-slate-900 mb-1">
            {typeof metrics.porcentajeResistenciaGarantia === 'number' ? metrics.porcentajeResistenciaGarantia.toFixed(2) : '0.00'}%
          </div>
          <div className="text-footnote text-slate-500">
            promedio de cumplimiento
          </div>
        </CardContent>
      </Card>

      {/* KPI: Coeficiente de Variación */}
      <Card className="glass-thick rounded-xl border border-slate-200 bg-gradient-to-br from-purple-500/20 to-purple-500/5 hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-title-3 font-semibold text-slate-700">
              Coeficiente de Variación
            </CardTitle>
            <Activity className="h-5 w-5 text-purple-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-title-1 font-bold text-slate-900 mb-1">
            {typeof metrics.coeficienteVariacion === 'number' ? metrics.coeficienteVariacion.toFixed(2) : '0.00'}%
          </div>
          <div className="text-footnote text-slate-500">
            uniformidad del concreto
          </div>
        </CardContent>
      </Card>

      {/* KPI: Eficiencia */}
      <Card className="glass-thick rounded-xl border border-slate-200 bg-gradient-to-br from-teal-500/20 to-teal-500/5 hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-title-3 font-semibold text-slate-700">
              Eficiencia
            </CardTitle>
            <Gauge className="h-5 w-5 text-teal-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-title-1 font-bold text-slate-900 mb-1">
            {typeof eficiencia === 'number' ? eficiencia.toFixed(3) : '0.000'}
          </div>
          <div className="text-footnote text-slate-500">
            kg/cm² por kg de cemento
          </div>
        </CardContent>
      </Card>

      {/* KPI: Rendimiento Volumétrico */}
      <Card className="glass-thick rounded-xl border border-slate-200 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 hover:shadow-lg transition-all">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-title-3 font-semibold text-slate-700">
              Rendimiento Volumétrico
            </CardTitle>
            <Droplets className="h-5 w-5 text-cyan-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-title-1 font-bold text-slate-900 mb-1">
            {typeof rendimientoVolumetrico === 'number' ? rendimientoVolumetrico.toFixed(2) : '0.00'}%
          </div>
          <div className="text-footnote text-slate-500">
            volumen real vs registrado
          </div>
        </CardContent>
      </Card>

      {/* KPI: Desviación Estándar (visible solo con un FC seleccionado) */}
      {showStdDev && (
        <Card className="glass-thick rounded-xl border border-slate-200 bg-gradient-to-br from-systemRed/20 to-systemRed/5 hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-title-3 font-semibold text-slate-700">
                Desviación Estándar
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-systemRed" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-title-1 font-bold text-slate-900 mb-1">
              {typeof metrics.desviacionEstandar === 'number' ? metrics.desviacionEstandar.toFixed(2) : '0.00'}
            </div>
            <div className="text-footnote text-slate-500">
              variabilidad de resistencia
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
