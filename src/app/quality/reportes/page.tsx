'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format, subMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import PlantRestrictedAccess from '@/components/quality/PlantRestrictedAccess';
import { isQualityTeamInRestrictedPlant } from '@/app/layout';
import {
  fetchResistenciaReporteDataFixed,
  fetchEficienciaReporteDataFixed,
  fetchDistribucionResistenciaData,
} from '@/services/qualityReportService';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { calcularMediaSinCeros } from '@/lib/qualityMetricsUtils';
import { getResistenciaForDisplay } from '@/lib/qualityReportHelpers';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import { QualityDashboardContent, canUseAnalyticsDashboard } from '@/components/quality/QualityDashboardContent';
import {
  QualityReportShell,
  ReportesFiltersSection,
  ResistenciaReportTab,
  EficienciaReportTab,
  DistribucionReportTab,
  ProduccionReportTab,
  type GroupedResistenciaData,
} from '@/components/quality/reporting';
import { useClientsWithQualityData } from '@/hooks/useClientsWithQualityData';
import { useConstructionSitesWithQualityData } from '@/hooks/useConstructionSitesWithQualityData';
import { useRecipesWithQualityData } from '@/hooks/useRecipesWithQualityData';

export default function ReportesPage() {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();

  if (isQualityTeamInRestrictedPlant(profile?.role, currentPlant?.code)) {
    return <PlantRestrictedAccess plantCode={currentPlant?.code || ''} sectionName="los reportes de calidad" />;
  }

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  });
  const [selectedPlanta, setSelectedPlanta] = useState<string>('all');
  const [selectedClasificacion, setSelectedClasificacion] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('tabla');
  const defaultTabApplied = useRef(false);

  useEffect(() => {
    if (!profile?.role || defaultTabApplied.current) return;
    if (canUseAnalyticsDashboard(profile.role)) {
      setActiveTab('panel');
      defaultTabApplied.current = true;
    }
  }, [profile?.role]);

  const showAnalyticsPanel = canUseAnalyticsDashboard(profile?.role);

  useEffect(() => {
    if (!showAnalyticsPanel && activeTab === 'panel') {
      setActiveTab('tabla');
    }
  }, [showAnalyticsPanel, activeTab]);

  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('all');

  const { clients, loading: clientsLoading } = useClientsWithQualityData(dateRange);
  const { constructionSites, loading: sitesLoading } = useConstructionSitesWithQualityData(selectedClient, dateRange);
  const { recipes, loading: recipesLoading } = useRecipesWithQualityData(dateRange, selectedClient, selectedConstructionSite);

  const [tablaData, setTablaData] = useState<any[]>([]);
  const [eficienciaData, setEficienciaData] = useState<any[]>([]);
  const [distribucionData, setDistribucionData] = useState<any[]>([]);

  const [aggregateMetrics, setAggregateMetrics] = useState({
    rendimientoPromedio: 0,
    eficienciaPromedio: 0,
    resistenciaPromedio: 0,
    consumoPromedio: 0,
    totalMuestreos: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  useEffect(() => {
    setSelectedConstructionSite('all');
    setSelectedRecipe('all');
  }, [selectedClient]);

  useEffect(() => {
    setSelectedRecipe('all');
  }, [selectedConstructionSite]);

  const loadReportData = async () => {
    if (activeTab === 'panel' || activeTab === 'produccion') {
      setLoading(false);
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      setError('Por favor selecciona un rango de fechas válido.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setTablaData([]);
      setEficienciaData([]);
      setDistribucionData([]);
      setAggregateMetrics({
        rendimientoPromedio: 0,
        eficienciaPromedio: 0,
        resistenciaPromedio: 0,
        consumoPromedio: 0,
        totalMuestreos: 0,
      });

      if (activeTab === 'tabla') {
        const data = await fetchResistenciaReporteDataFixed(
          dateRange.from,
          dateRange.to,
          selectedPlanta === 'all' ? undefined : selectedPlanta,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe
        );
        setTablaData(data);
      } else if (activeTab === 'eficiencia') {
        const data = await fetchEficienciaReporteDataFixed(
          dateRange.from,
          dateRange.to,
          selectedPlanta === 'all' ? undefined : selectedPlanta,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe
        );
        setEficienciaData(data);

        if (data && data.length > 0) {
          const rendimientos = data
            .filter((m) => m !== null)
            .map((m) => m.rendimiento_volumetrico)
            .filter((r) => r !== null && r !== 0);
          const eficiencias = data
            .filter((m) => m !== null)
            .map((m) => m.eficiencia)
            .filter((e) => e !== null && e !== 0);
          const resistencias = data
            .filter((m): m is NonNullable<typeof m> => m !== null && !!m.muestras && Array.isArray(m.muestras))
            .map((m) => getResistenciaForDisplay(m.muestras, m.resistencia_promedio));
          const consumos = data
            .filter((m) => m !== null)
            .map((m) => m.consumo_cemento)
            .filter((c) => c !== null && c !== 0);

          setAggregateMetrics({
            rendimientoPromedio: rendimientos.length > 0 ? calcularMediaSinCeros(rendimientos) : 0,
            eficienciaPromedio: eficiencias.length > 0 ? calcularMediaSinCeros(eficiencias) : 0,
            resistenciaPromedio: resistencias.length > 0 ? calcularMediaSinCeros(resistencias) : 0,
            consumoPromedio: consumos.length > 0 ? calcularMediaSinCeros(consumos) : 0,
            totalMuestreos: data.length,
          });
        }
      } else if (activeTab === 'distribucion') {
        const data = await fetchDistribucionResistenciaData(
          dateRange.from,
          dateRange.to,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe
        );
        setDistribucionData(data);
      }
    } catch (err) {
      console.error('Error cargando datos de reportes:', err);
      setError('Error al cargar los datos del reporte: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dateRange, selectedPlanta, selectedClasificacion, selectedClient, selectedConstructionSite, selectedRecipe]);

  const groupedTablaData = useMemo((): GroupedResistenciaData => {
    if (!tablaData || tablaData.length === 0) return {};
    return tablaData.reduce((acc: GroupedResistenciaData, ensayo: any) => {
      const key = ensayo.muestreoId;
      if (!acc[key]) {
        acc[key] = {
          muestreoFecha: ensayo.muestreoFecha ?? 'N/A',
          ensayos: [],
        };
      }
      acc[key].ensayos.push(ensayo);
      return acc;
    }, {});
  }, [tablaData]);

  const exportToExcel = useCallback(
    async (tab: 'tabla' | 'eficiencia') => {
      if (tab === 'tabla' && activeTab !== 'tabla') {
        setError('Abre la pestaña «Datos por muestreo» para exportar ese reporte.');
        return;
      }
      if (tab === 'eficiencia' && activeTab !== 'eficiencia') {
        setError('Abre la pestaña «Análisis de eficiencia» para exportar ese reporte.');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        let dataToExport: Record<string, unknown>[] = [];
        let sheetName = 'Reporte';

        if (tab === 'tabla') {
          dataToExport = Object.entries(groupedTablaData).flatMap(([muestreoId, group]) =>
            group.ensayos.map((ensayo: any) => ({
              'Fecha Muestreo': group.muestreoFecha,
              'Muestreo ID': muestreoId.startsWith('nomuestreoid') ? '-' : muestreoId,
              'Ensayo ID': ensayo.id,
              'Fecha Ensayo': ensayo.fechaEnsayo,
              'Código Muestra': ensayo.muestraCodigo,
              Clasificación: ensayo.clasificacion,
              'Edad (días)': ensayo.edadDias,
              'Carga (kg)': ensayo.cargaKg,
              'Resistencia (kg/cm²)': ensayo.resistencia,
              'Cumplimiento (%)': ensayo.cumplimiento,
            }))
          );
          sheetName = 'Resistencia_Detalle';
        } else {
          dataToExport = eficienciaData.map((dato) => ({
            Fecha: dato.fecha,
            Planta: dato.planta,
            Receta: dato.receta,
            Clasificación: dato.clasificacion,
            'Masa Unitaria (kg/m³)': dato.masa_unitaria,
            'Suma Materiales (kg)': dato.suma_materiales,
            'Vol. Real (m³)': dato.volumen_real,
            'Vol. Registrado (m³)': dato.volumen_registrado,
            'Rendimiento (%)': dato.rendimiento_volumetrico,
            'kg Cemento': dato.kg_cemento,
            'Consumo Cemento (kg/m³)': dato.consumo_cemento,
            'Resistencia Promedio (kg/cm²)': dato.resistencia_promedio,
            Eficiencia: dato.eficiencia,
          }));
          sheetName = 'Eficiencia_Detalle';
        }

        if (!dataToExport || dataToExport.length === 0) {
          setError('No hay datos para exportar');
          return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        const fileName = `reporte_calidad_${tab}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
        await saveAs(blob, fileName);
      } catch (err) {
        console.error('Error exportando a Excel:', err);
        setError('Error al exportar: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    },
    [activeTab, groupedTablaData, eficienciaData]
  );

  const toggleRowExpansion = useCallback((rowId: string) => {
    setExpandedRows((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  }, []);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <h2 className="text-2xl font-semibold text-amber-900">Acceso restringido</h2>
          </div>
          <p className="text-amber-800">No tienes permiso para acceder a los reportes de calidad.</p>
        </div>
      </div>
    );
  }

  return (
    <QualityReportShell
      warmCanvas
      headerTop={
        <QualityBreadcrumb hubName="Operaciones" hubHref="/quality/operaciones" items={[{ label: 'Reportes' }]} />
      }
      title="Reportes de calidad"
      subtitle="Informes y análisis operativos del concreto"
    >
      {activeTab !== 'panel' && (
        <ReportesFiltersSection
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          selectedPlanta={selectedPlanta}
          onPlantaChange={setSelectedPlanta}
          selectedClasificacion={selectedClasificacion}
          onClasificacionChange={setSelectedClasificacion}
          selectedClient={selectedClient}
          onClientChange={setSelectedClient}
          selectedConstructionSite={selectedConstructionSite}
          onConstructionSiteChange={setSelectedConstructionSite}
          selectedRecipe={selectedRecipe}
          onRecipeChange={setSelectedRecipe}
          clients={clients}
          clientsLoading={clientsLoading}
          constructionSites={constructionSites}
          sitesLoading={sitesLoading}
          recipes={recipes}
          recipesLoading={recipesLoading}
          loading={loading}
          onApply={loadReportData}
        />
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} className="mb-6" onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex flex-wrap gap-1 h-auto min-h-10 bg-stone-100/80">
          {showAnalyticsPanel && <TabsTrigger value="panel">Panel de calidad</TabsTrigger>}
          <TabsTrigger value="tabla">Datos por muestreo</TabsTrigger>
          <TabsTrigger value="eficiencia">Análisis de eficiencia</TabsTrigger>
          <TabsTrigger value="distribucion">Distribución resistencias</TabsTrigger>
          <TabsTrigger value="produccion">Producción</TabsTrigger>
        </TabsList>

        {showAnalyticsPanel && (
          <TabsContent value="panel" className="mt-0">
            <QualityDashboardContent mode="embedded" />
          </TabsContent>
        )}

        <TabsContent value="tabla" className="mt-0">
          <ResistenciaReportTab
            groupedTablaData={groupedTablaData}
            loading={loading}
            onExportExcel={() => exportToExcel('tabla')}
          />
        </TabsContent>

        <TabsContent value="eficiencia" className="mt-0">
          <EficienciaReportTab
            eficienciaData={eficienciaData}
            loading={loading}
            aggregateMetrics={aggregateMetrics}
            expandedRows={expandedRows}
            toggleRowExpansion={toggleRowExpansion}
            onExportExcel={() => exportToExcel('eficiencia')}
          />
        </TabsContent>

        <TabsContent value="distribucion" className="mt-0">
          <DistribucionReportTab distribucionData={distribucionData} loading={loading} />
        </TabsContent>

        <TabsContent value="produccion" className="mt-0">
          <ProduccionReportTab />
        </TabsContent>
      </Tabs>
    </QualityReportShell>
  );
}
