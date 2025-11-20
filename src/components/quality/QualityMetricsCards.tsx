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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((item) => (
          <Card key={item} className="glass-thick rounded-2xl border border-white/20 shadow-lg overflow-hidden">
            <CardHeader className="pb-3">
              <div className="h-5 w-[140px] bg-slate-200/50 rounded-lg animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-12 w-[100px] bg-slate-200/50 rounded-xl animate-pulse mb-3" />
              <div className="h-4 w-[160px] bg-slate-200/50 rounded-lg animate-pulse" />
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {/* KPI: Muestras en cumplimiento */}
      <Card className="glass-thick rounded-2xl border-l-4 border-l-emerald-500 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            Muestras en Cumplimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
              {metrics.muestrasEnCumplimiento}
            </div>
            <div className="text-sm text-slate-600 font-medium">
              de {metrics.numeroMuestras} muestras
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Resistencia Promedio */}
      <Card className="glass-thick rounded-2xl border-l-4 border-l-blue-500 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-xl group-hover:scale-110 transition-transform">
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </div>
            Resistencia Promedio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-blue-600 to-blue-700 bg-clip-text text-transparent">
              {typeof metrics.resistenciaPromedio === 'number' ? metrics.resistenciaPromedio.toFixed(2) : '0.00'}
            </div>
            <div className="text-sm text-slate-600 font-medium">
              kg/cm²
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: % Resistencia Garantía */}
      <Card className="glass-thick rounded-2xl border-l-4 border-l-amber-500 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="p-2 bg-amber-100 rounded-xl group-hover:scale-110 transition-transform">
              <Activity className="h-4 w-4 text-amber-600" />
            </div>
            % Resistencia a Garantía
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-amber-600 to-amber-700 bg-clip-text text-transparent">
              {typeof metrics.porcentajeResistenciaGarantia === 'number' ? metrics.porcentajeResistenciaGarantia.toFixed(2) : '0.00'}%
            </div>
            <div className="text-sm text-slate-600 font-medium">
              promedio de cumplimiento
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Coeficiente de Variación */}
      <Card className="glass-thick rounded-2xl border-l-4 border-l-purple-500 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-xl group-hover:scale-110 transition-transform">
              <Activity className="h-4 w-4 text-purple-600" />
            </div>
            Coeficiente de Variación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-purple-600 to-purple-700 bg-clip-text text-transparent">
              {typeof metrics.coeficienteVariacion === 'number' ? metrics.coeficienteVariacion.toFixed(2) : '0.00'}%
            </div>
            <div className="text-sm text-slate-600 font-medium">
              uniformidad del concreto
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Eficiencia */}
      <Card className="glass-thick rounded-2xl border-l-4 border-l-teal-500 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="p-2 bg-teal-100 rounded-xl group-hover:scale-110 transition-transform">
              <Activity className="h-4 w-4 text-teal-600" />
            </div>
            Eficiencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-teal-600 to-teal-700 bg-clip-text text-transparent">
              {typeof eficiencia === 'number' ? eficiencia.toFixed(3) : '0.000'}
            </div>
            <div className="text-sm text-slate-600 font-medium">
              kg/cm² por kg de cemento
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Rendimiento Volumétrico */}
      <Card className="glass-thick rounded-2xl border-l-4 border-l-cyan-500 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <div className="p-2 bg-cyan-100 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingUp className="h-4 w-4 text-cyan-600" />
            </div>
            Rendimiento Volumétrico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-cyan-600 to-cyan-700 bg-clip-text text-transparent">
              {typeof rendimientoVolumetrico === 'number' ? rendimientoVolumetrico.toFixed(2) : '0.00'}%
            </div>
            <div className="text-sm text-slate-600 font-medium">
              volumen real vs registrado
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI: Desviación Estándar (visible solo con un FC seleccionado) */}
      {showStdDev && (
        <Card className="glass-thick rounded-2xl border-l-4 border-l-rose-500 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="p-2 bg-rose-100 rounded-xl group-hover:scale-110 transition-transform">
                <BarChart3 className="h-4 w-4 text-rose-600" />
              </div>
              Desviación Estándar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-rose-600 to-rose-700 bg-clip-text text-transparent">
                {typeof metrics.desviacionEstandar === 'number' ? metrics.desviacionEstandar.toFixed(2) : '0.00'}
              </div>
              <div className="text-sm text-slate-600 font-medium">
                variabilidad de resistencia
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
