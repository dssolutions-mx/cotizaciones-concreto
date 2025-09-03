import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';

interface AdvancedMetrics {
  eficiencia: number;
  rendimientoVolumetrico: number;
  desviacionEstandar: number;
}

interface QualityAdvancedMetricsProps {
  advancedMetrics: AdvancedMetrics;
  calculating: boolean;
}

export function QualityAdvancedMetrics({ advancedMetrics, calculating }: QualityAdvancedMetricsProps) {
  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-sm text-blue-700">
        <strong>Nota:</strong> Las métricas avanzadas ahora se calculan correctamente basándose en los datos filtrados,
        reflejando solo la información que coincide con los filtros aplicados (planta, clasificación, tipo de probeta, rango de resistencia, etc.).
      </p>
    </div>
  );
}

export function QualityAdvancedMetricsCards({ advancedMetrics, calculating }: QualityAdvancedMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
        </CardHeader>
        <CardContent>
          {calculating ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-gray-500">Calculando...</span>
            </div>
          ) : (
            <>
              <div className="text-xl font-bold">{typeof advancedMetrics.eficiencia === 'number' ? advancedMetrics.eficiencia.toFixed(2) : '0.00'}</div>
              <div className="text-xs text-gray-500">kg/cm² por kg de cemento</div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Rendimiento Volumétrico</CardTitle>
        </CardHeader>
        <CardContent>
          {calculating ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-gray-500">Calculando...</span>
            </div>
          ) : (
            <>
              <div className="text-xl font-bold">{typeof advancedMetrics.rendimientoVolumetrico === 'number' ? advancedMetrics.rendimientoVolumetrico.toFixed(2) : '0.00'}%</div>
              <div className="text-xs text-gray-500">volumen real vs. registrado</div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Desviación Estándar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{typeof advancedMetrics.desviacionEstandar === 'number' ? advancedMetrics.desviacionEstandar.toFixed(2) : '0.00'}</div>
          <div className="text-xs text-gray-500">variabilidad de resistencia</div>
        </CardContent>
      </Card>
    </div>
  );
}
