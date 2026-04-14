'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { format, subMonths } from 'date-fns';
import { DateRange } from "react-day-picker";
import { Loader2, BarChart3, Target, Users } from 'lucide-react';

// UI Components
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Custom Components
import { ClientQualityMetrics } from '@/components/quality/clientes/ClientQualityMetrics';
import { ClientQualityTable } from '@/components/quality/clientes/ClientQualityTable';
import ClientMuestreosTable from '@/components/quality/clientes/ClientMuestreosTable';
const ClientMuestreosCharts = dynamic(() => import('@/components/quality/clientes/ClientMuestreosCharts'), { ssr: false });
import ClientQualityAnalysis from '@/components/quality/clientes/ClientQualityAnalysis';
import { ClientSelector } from '@/components/quality/clientes/ClientSelector';
import { ClientRecipePerformanceTable } from '@/components/quality/clientes/ClientRecipePerformanceTable';
import { ClientCvByRecipeTable } from '@/components/quality/clientes/ClientCvByRecipeTable';
import { ClientComparisonScorecard } from '@/components/quality/clientes/ClientComparisonScorecard';
import { ClientSpcChart } from '@/components/quality/clientes/ClientSpcChart';
import { QualityReportShell } from '@/components/quality/reporting';

// Services and Types
import { useProgressiveClientQuality } from '@/hooks/useProgressiveClientQuality';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';

// Auth
import { useAuthBridge } from '@/adapters/auth-context-bridge';

export default function ClientQualityAnalysisPage() {
  const { profile } = useAuthBridge();

  // State for data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [compareClientId, setCompareClientId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2025, 1, 1),
    to: new Date()
  });
  const [qualityData, setQualityData] = useState<ClientQualityData | null>(null);
  const [summary, setSummary] = useState<ClientQualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progressive quality data
  const { data: progData, summary: progSummary, loading: progLoading, streaming, progress, error: progError } = useProgressiveClientQuality({
    clientId: selectedClientId || undefined,
    fromDate: dateRange && dateRange.from ? dateRange.from : undefined,
    toDate: dateRange && dateRange.to ? dateRange.to : undefined,
    options: { newestFirst: true }
  });

  const {
    data: compareProgData,
    summary: compareProgSummary,
    loading: compareProgLoading,
    error: compareProgError,
  } = useProgressiveClientQuality({
    clientId: compareClientId || undefined,
    fromDate: dateRange && dateRange.from ? dateRange.from : undefined,
    toDate: dateRange && dateRange.to ? dateRange.to : undefined,
    options: { newestFirst: true }
  });

  // Bind progressive results to local state for rendering
  useEffect(() => {
    if (progError) setError(progError);
    else setError(null);
    if (progData) setQualityData(progData);
    if (progSummary) setSummary(progSummary);
    setLoading(progLoading);
  }, [progData, progSummary, progLoading, progError]);

  // Clear page-level state when switching client or date range to avoid stale UI
  useEffect(() => {
    setError(null);
    setQualityData(null);
    setSummary(null);
  }, [selectedClientId, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    setCompareClientId('');
  }, [selectedClientId]);

  useEffect(() => {
    if (compareClientId && selectedClientId && compareClientId === selectedClientId) {
      setCompareClientId('');
    }
  }, [compareClientId, selectedClientId]);

  // Handle date range changes
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
  };

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-red-50 border border-red-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <Target className="h-8 w-8 text-red-600" />
            <h2 className="text-2xl font-semibold text-red-800">Acceso Restringido</h2>
          </div>

          <p className="text-lg mb-4 text-red-700">
            No tienes permiso para acceder al análisis de calidad de clientes.
          </p>

          <div className="bg-white p-4 rounded-lg border border-red-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
            <p className="text-gray-600">
              Este módulo está restringido a usuarios con roles específicos como Equipo de Calidad,
              Gerentes de Planta, Ejecutivos y Administradores.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const filtersBlock = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <ClientSelector selectedClientId={selectedClientId} onClientSelect={handleClientSelect} />
      </div>
      <div className="min-w-0 flex-1">
        <ClientSelector
          label="Comparar con (opcional)"
          selectedClientId={compareClientId}
          onClientSelect={setCompareClientId}
          excludeClientIds={selectedClientId ? [selectedClientId] : []}
          compact
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-stone-700">Período</span>
        <DatePickerWithRange value={dateRange} onChange={handleDateRangeChange} />
      </div>
    </div>
  );

  return (
    <QualityReportShell
      warmCanvas
      title="Análisis de Calidad por Cliente"
      subtitle="Métricas de rendimiento y variabilidad del concreto entregado por cliente"
      filters={filtersBlock}
      contentClassName="pb-10"
    >

      {/* Error Handling */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {(loading || streaming) && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-lg">Cargando datos de calidad del cliente...</span>
          </div>
          {streaming && (
            <div className="w-full mt-4">
              <div className="w-full bg-gray-100 border rounded h-2 overflow-hidden">
                <div className="bg-blue-500 h-2" style={{ width: `${Math.round((progress.processed / Math.max(1, progress.total)) * 100)}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-center">
                Progresando… {Math.round((progress.processed / Math.max(1, progress.total)) * 100)}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Client Selected */}
      {!selectedClientId && !loading && (
        <Card className="mb-6 border-stone-200 bg-white">
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Selecciona un Cliente
            </h3>
            <p className="text-gray-500">
              Elige un cliente para ver su análisis de calidad y rendimiento del concreto
            </p>
          </CardContent>
        </Card>
      )}

      {/* No Data Found */}
      {selectedClientId && !loading && qualityData && qualityData.remisiones.length === 0 && (
        <Card className="mb-6">
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron datos de calidad
            </h3>
            <p className="text-gray-500 mb-4">
              El cliente seleccionado no tiene datos de calidad en el período seleccionado ({dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : 'N/A'} - {dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : 'N/A'}).
            </p>
            <p className="text-sm text-gray-600 mb-4">
              💡 Si el cliente tiene datos en fechas futuras o pasadas, ajusta el rango de fechas para incluirlos.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 mb-2">
                <strong>💡 Sugerencia:</strong> Selecciona un cliente que tenga actividad reciente en concreto.
              </p>
              <p className="text-xs text-blue-600">
                Los clientes con datos de calidad aparecen en la lista con información de órdenes y remisiones.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  // Reset to last 3 months
                  setDateRange({
                    from: subMonths(new Date(), 3),
                    to: new Date()
                  });
                }}
              >
                Últimos 3 meses
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Reset to last 12 months
                  setDateRange({
                    from: subMonths(new Date(), 12),
                    to: new Date()
                  });
                }}
              >
                Últimos 12 meses
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Analysis Content */}
      {selectedClientId && qualityData && summary && !loading && (
        <div className="space-y-6">
          <ClientComparisonScorecard
            primaryLabel={qualityData.clientInfo?.business_name || summary.clientInfo?.business_name || 'Cliente principal'}
            primarySummary={summary}
            compareLabel={compareProgData?.clientInfo?.business_name || compareProgSummary?.clientInfo?.business_name || 'Cliente de comparación'}
            compareSummary={compareClientId ? compareProgSummary : null}
            compareLoading={!!compareClientId && compareProgLoading}
            onClearCompare={compareClientId ? () => setCompareClientId('') : undefined}
          />

          {compareProgError && compareClientId && (
            <Alert variant="destructive">
              <AlertDescription>Error al cargar cliente de comparación: {compareProgError}</AlertDescription>
            </Alert>
          )}

          {/* Detailed Analysis Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Resumen
              </TabsTrigger>
              <TabsTrigger value="muestreos" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Muestreos
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Análisis
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Detalles
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* KPIs */}
              <ClientQualityMetrics summary={summary} />

              <ClientSpcChart data={qualityData} />

              <ClientRecipePerformanceTable data={qualityData} summary={summary} />

              <ClientCvByRecipeTable rows={summary.averages.cvByRecipe || []} />

              {/* Main Charts removed: deprecated summary cards */}
            </TabsContent>

            <TabsContent value="muestreos" className="space-y-6">
              <ClientMuestreosCharts
                remisiones={qualityData.remisiones}
              />
              <ClientMuestreosTable
                remisiones={qualityData.remisiones}
              />
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <ClientQualityAnalysis
                data={qualityData}
                summary={summary}
              />
            </TabsContent>

            <TabsContent value="details" className="space-y-6">
              <ClientQualityTable
                data={qualityData}
                summary={summary}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* No Data State */}
      {selectedClientId && !qualityData && !loading && !error && (
        <Card className="mb-6 border-stone-200 bg-white">
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay datos disponibles
            </h3>
            <p className="text-gray-500">
              No se encontraron datos de calidad para el cliente seleccionado en el período especificado
            </p>
          </CardContent>
        </Card>
      )}
    </QualityReportShell>
  );
}
