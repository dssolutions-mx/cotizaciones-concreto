'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '@/lib/utils';
import { usePlantContext } from '@/contexts/PlantContext';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { HistoricalCharts } from '@/components/finanzas/HistoricalCharts';
import dynamic from 'next/dynamic';
import { useWeeklyProjection } from '@/hooks/useWeeklyProjection';
import { useProgressiveHistoricalAggregates } from '@/hooks/useProgressiveHistoricalAggregates';
const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function HistoricalDataPage() {
  const { currentPlant } = usePlantContext();
  const [includeVAT, setIncludeVAT] = useState<boolean>(false);
  // Build weeklyInputs from the same progressive weekly data used by HistoricalCharts when granularity='week'.
  const { monthlyData: weeklyAgg, loading: weeklyAggLoading } = useProgressiveHistoricalAggregates(
    currentPlant?.id || null,
    7,
    { granularity: 'week' }
  );
  const weeklyInputs = (weeklyAgg || []).filter(w => w.hasData).map(w => ({
    weekStart: w.periodStart,
    label: w.monthName,
    volume: (w.concreteVolume || 0) + (w.pumpVolume || 0),
    activeClients: (w as any).activeClients || 0
  }));
  // Note: We'll feed the projection hook with weeklyInputs if present; otherwise it falls back to querying.
  const { data: projectionData, actual, projected, dailyProjected, loading: projLoading } = useWeeklyProjection({
    plantId: currentPlant?.id || null,
    weeksBack: 26,
    weeksForward: 8,
    weeklyInputs
  });

  // Helper functions for the SalesCharts component
  const formatNumberWithUnits = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  const formatCurrencyHelper = (value: number) => {
    return formatCurrency(value);
  };

  return (
    <div className="container mx-auto p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Datos Históricos de Ventas</h1>
            <p className="text-gray-600 mt-2">
              Análisis completo de tendencias históricas de ventas y volúmenes
            </p>
          </div>
          <div className="flex items-center space-x-6">
            {/* Plant Context Display */}
            <div className="flex flex-col items-end">
              <Label className="mb-1 text-sm font-medium">Planta</Label>
              <PlantContextDisplay showLabel={false} />
              {currentPlant && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {currentPlant.name}
                </div>
              )}
            </div>
            
            {/* VAT Toggle */}
            <div className="flex flex-col items-end">
              <Label className="mb-1 text-sm font-medium">Incluir IVA</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="vat-toggle"
                  checked={includeVAT}
                  onCheckedChange={setIncludeVAT}
                />
                <Label htmlFor="vat-toggle" className="text-sm">
                  {includeVAT ? 'Sí' : 'No'}
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Planta Seleccionada</p>
                  <p className="text-lg font-semibold text-blue-800">
                    {currentPlant?.name || 'Todas las Plantas'}
                  </p>
                </div>
                <div className="text-blue-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Estado de IVA</p>
                  <p className="text-lg font-semibold text-green-800">
                    {includeVAT ? 'Con IVA' : 'Sin IVA'}
                  </p>
                </div>
                <div className="text-green-500">
                  {includeVAT ? (
                    <Badge variant="default" className="bg-green-600 text-white">
                      IVA ACTIVO
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-green-600 text-green-600">
                      SIN IVA
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700">Tipo de Análisis</p>
                  <p className="text-lg font-semibold text-purple-800">
                    Histórico Completo
                  </p>
                </div>
                <div className="text-purple-500">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10.414 13H12a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Information Panel */}
        <Card className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-amber-800 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Información del Análisis Histórico
            </CardTitle>
            <CardDescription>Incluye clientes activos por período y proyección semanal basada en estacionalidad y tendencia</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-amber-700">
              <div>
                <p className="font-medium mb-2">📊 Datos Incluidos:</p>
                <ul className="space-y-1 ml-4">
                  <li>• Ventas históricas completas</li>
                  <li>• Volúmenes de concreto y bombeo (vacío excluido)</li>
                  <li>• Clientes activos por período</li>
                  <li>• Proyección semanal de volúmenes</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">🔍 Características:</p>
                <ul className="space-y-1 ml-4">
                  <li>• Independiente de filtros de fecha</li>
                  <li>• Filtrado por planta según contexto</li>
                  <li>• Cálculos con y sin IVA</li>
                  <li>• Exportación de gráficos</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical Charts Section */}
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Gráficos de Tendencias Históricas
          </h2>
          <p className="text-gray-600">
            Visualización completa de datos históricos de ventas y volúmenes
          </p>
        </div>

        {/* HistoricalCharts Component */}
        <HistoricalCharts
          includeVAT={includeVAT}
          formatNumberWithUnits={formatNumberWithUnits}
          formatCurrency={formatCurrencyHelper}
        />

        {/* Projection Section */}
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow bg-gradient-to-br from-white to-gray-50/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800">Proyección Semanal de Volúmenes</CardTitle>
            <CardDescription className="text-gray-600">Modelo híbrido: estacionalidad (semana del año) + tendencia EMA + factor de clientes</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-xs text-gray-500 mb-2">
              {projLoading ? 'Calculando proyección…' : `Semanas analizadas: ${actual.length} • Semanas proyectadas: ${projected.length}`}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded border bg-white">
                <div className="text-gray-500">Volumen medio histórico semanal</div>
                <div className="text-lg font-semibold text-gray-800">
                  {actual.length > 0 ? (actual.reduce((s, p) => s + p.actualVolume, 0) / actual.length).toFixed(1) : '0.0'} m³
                </div>
              </div>
              <div className="p-3 rounded border bg-white">
                <div className="text-gray-500">Clientes activos promedio</div>
                <div className="text-lg font-semibold text-gray-800">
                  {actual.length > 0 ? (actual.reduce((s, p) => s + p.activeClients, 0) / actual.length).toFixed(0) : '0'}
                </div>
              </div>
              <div className="p-3 rounded border bg-white">
                <div className="text-gray-500">Próxima semana (proyección)</div>
                <div className="text-lg font-semibold text-gray-800">
                  {projected.length > 0 ? projected[0].projectedVolume.toFixed(1) : '0.0'} m³
                </div>
              </div>
            </div>
            {/* Inline area/line chart */}
            {typeof window !== 'undefined' && projectionData.length > 0 && (
              <div className="mt-6">
                <ApexChart
                  type="line"
                  height={320}
                  options={{
                    chart: { background: 'transparent', toolbar: { show: false } },
                    stroke: { curve: 'smooth', width: [2, 2] },
                    xaxis: { categories: projectionData.map(d => d.label) },
                    yaxis: [
                      {
                        labels: { formatter: (v: number) => `${v.toFixed(0)} m³` },
                        title: { text: 'Volumen (m³)' }
                      }
                    ],
                    colors: ['#2563EB', '#059669'],
                    legend: { position: 'top', horizontalAlign: 'left' },
                    tooltip: {
                      y: { formatter: (val: number, opts: any) => `${val.toFixed(1)} m³` }
                    }
                  }}
                  series={[
                    { name: 'Volumen Semanal', data: projectionData.slice(0, actual.length).map((_, i) => actual[i]?.actualVolume ?? 0) },
                    { name: 'Proyección', data: projectionData.map((_, i) => {
                        // Show backtest for history and projection for future
                        if (i < actual.length) {
                          // Approximate backtest using same horizon; for clarity, reuse actual for now if fewer points
                          return 0; // optional: wire seriesProjected from hook for true backtest display
                        }
                        return projected[i - actual.length]?.projectedVolume ?? 0;
                      })
                    }
                  ]}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer Information */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="text-center text-sm text-gray-500">
          <p>
            📈 Los datos históricos se actualizan automáticamente y muestran todas las transacciones disponibles
          </p>
          <p className="mt-1">
            💡 Use los controles de la gráfica para explorar diferentes períodos y exportar datos
          </p>
        </div>
      </div>
    </div>
  );
}
