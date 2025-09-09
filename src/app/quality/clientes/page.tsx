'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { Loader2, TrendingUp, BarChart3, Target, Users } from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Custom Components
import { ClientQualityMetrics } from '@/components/quality/clientes/ClientQualityMetrics';
import { ClientQualityCharts } from '@/components/quality/clientes/ClientQualityCharts';
import { ClientQualityTable } from '@/components/quality/clientes/ClientQualityTable';
import ClientMuestreosTable from '@/components/quality/clientes/ClientMuestreosTable';
import ClientMuestreosCharts from '@/components/quality/clientes/ClientMuestreosCharts';
import ClientQualityAnalysis from '@/components/quality/clientes/ClientQualityAnalysis';
import { ClientSelector } from '@/components/quality/clientes/ClientSelector';

// Services and Types
import { ClientQualityService } from '@/services/clientQualityService';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';

// Auth
import { useAuthBridge } from '@/adapters/auth-context-bridge';

export default function ClientQualityAnalysisPage() {
  const { profile } = useAuthBridge();

  // State for data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 12), // Extended to 12 months to include 2025 data
    to: addMonths(new Date(), 6) // Extended to future to include 2025 data
  });
  const [qualityData, setQualityData] = useState<ClientQualityData | null>(null);
  const [summary, setSummary] = useState<ClientQualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load client quality data
  const loadClientQualityData = useCallback(async () => {
    if (!selectedClientId || !dateRange?.from || !dateRange?.to) {
      setQualityData(null);
      setSummary(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      console.log(`[ClientQualityPage] Loading data for client ${selectedClientId} from ${fromDate} to ${toDate}`);
      const result = await ClientQualityService.getClientQualityData(
        selectedClientId,
        fromDate,
        toDate
      );

      console.log(`[ClientQualityPage] Data loaded. Success: ${result.success}, Remisiones: ${result.data?.remisiones?.length || 0}`);
      setQualityData(result.data);
      setSummary(result.summary);
    } catch (err) {
      console.error('Error loading client quality data:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos de calidad del cliente');
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, dateRange]);

  // Load data when client or date range changes
  useEffect(() => {
    if (selectedClientId) {
      loadClientQualityData();
    }
  }, [loadClientQualityData, selectedClientId]);

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

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">
          Análisis de Calidad por Cliente
        </h1>
        <p className="text-gray-500 mb-4">
          Métricas completas de rendimiento y calidad del concreto entregado a cada cliente
        </p>

        {/* Filters Section */}
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          {/* Client Selector */}
          <div className="flex-1">
            <ClientSelector
              selectedClientId={selectedClientId}
              onClientSelect={handleClientSelect}
            />
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Período de Análisis:
            </span>
            <DatePickerWithRange
              value={dateRange}
              onChange={handleDateRangeChange}
            />
          </div>
        </div>
      </div>

      {/* Error Handling */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-lg">Cargando datos de calidad del cliente...</span>
          </div>
        </div>
      )}

      {/* No Client Selected */}
      {!selectedClientId && !loading && (
        <Card className="mb-6">
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
              El cliente seleccionado no tiene datos de calidad en el período seleccionado ({format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}).
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
        <Card className="mb-6">
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
    </div>
  );
}
