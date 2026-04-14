'use client';

import React, { useState, useMemo } from 'react';
import { subMonths } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { AlertTriangle, AlertCircle, ChevronDown } from 'lucide-react';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { DatoGraficoResistencia } from '@/types/quality';

import { useQualityDashboard } from '@/hooks/useQualityDashboard';
import { useQualityFilters } from '@/hooks/useQualityFilters';
import { useAdvancedMetrics } from '@/hooks/useAdvancedMetrics';

import { QualityDashboardFilters } from '@/components/quality/QualityDashboardFilters';
import { QualityChartSection } from '@/components/quality/QualityChartSection';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import { QualityReportShell, QualityKPIStrip, type QualityKPIItem } from '@/components/quality/reporting';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { useAuthBridge } from '@/adapters/auth-context-bridge';

export type QualityDashboardMode = 'standalone' | 'embedded';

const DASHBOARD_ROLES = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER'] as const;

export function canViewQualityDashboardUi(role: string | undefined): boolean {
  return !!role && DASHBOARD_ROLES.includes(role as (typeof DASHBOARD_ROLES)[number]);
}

/** Roles that see KPI/chart dashboard (QUALITY_TEAM is redirected on standalone route). */
export function canUseAnalyticsDashboard(role: string | undefined): boolean {
  return role === 'EXECUTIVE' || role === 'PLANT_MANAGER';
}

interface QualityDashboardContentProps {
  mode?: QualityDashboardMode;
}

export function QualityDashboardContent({ mode = 'standalone' }: QualityDashboardContentProps) {
  const { profile } = useAuthBridge();
  const embedded = mode === 'embedded';

  if (profile?.role === 'QUALITY_TEAM' && !embedded) {
    if (typeof window !== 'undefined') {
      window.location.href = '/quality/operaciones';
    }
    return null;
  }

  if (embedded && profile?.role === 'QUALITY_TEAM') {
    return (
      <p className="text-sm text-stone-600 py-4">
        El panel de métricas no está disponible para tu rol. Usa Muestreos y Ensayos desde Operaciones.
      </p>
    );
  }

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 2),
    to: new Date(),
  });

  const [soloEdadGarantia, setSoloEdadGarantia] = useState<boolean>(true);
  const [incluirEnsayosFueraTiempo, setIncluirEnsayosFueraTiempo] = useState<boolean>(false);

  const {
    clients,
    constructionSites,
    recipes,
    plants,
    availableAges,
    fcValues,
    specimenTypes,
    selectedClient,
    selectedConstructionSite,
    selectedRecipe,
    selectedPlant,
    selectedClasificacion,
    selectedSpecimenType,
    selectedFcValue,
    selectedAge,
    openClient,
    openSite,
    openRecipe,
    openPlant,
    openFcValue,
    openAge,
    setSelectedClient,
    setSelectedConstructionSite,
    setSelectedRecipe,
    setSelectedPlant,
    setSelectedClasificacion,
    setSelectedSpecimenType,
    setSelectedFcValue,
    setSelectedAge,
    setOpenClient,
    setOpenSite,
    setOpenRecipe,
    setOpenPlant,
    setOpenFcValue,
    setOpenAge,
    getFilteredConstructionSites,
    resetAllFilters,
  } = useQualityFilters(dateRange);

  const {
    metricas,
    datosGrafico,
    loading,
    error,
    handleCheckDatabaseContent,
    retryLoadData,
  } = useQualityDashboard({
    dateRange,
    selectedClient,
    selectedConstructionSite,
    selectedRecipe,
    selectedPlant,
    selectedClasificacion,
    selectedSpecimenType,
    selectedFcValue,
    selectedAge,
    soloEdadGarantia,
    incluirEnsayosFueraTiempo,
  });

  const { advancedMetrics } = useAdvancedMetrics(datosGrafico);

  const [unfilteredChartData, setUnfilteredChartData] = useState<DatoGraficoResistencia[]>([]);

  React.useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) {
      setUnfilteredChartData([]);
      return;
    }

    let isCancelled = false;

    const fetchUnfilteredData = async () => {
      try {
        const { format } = await import('date-fns');
        const { fetchDatosGraficoResistencia } = await import('@/services/qualityChartService');

        const fromDate = format(dateRange.from!, 'yyyy-MM-dd');
        const toDate = format(dateRange.to!, 'yyyy-MM-dd');

        const unfilteredData = await fetchDatosGraficoResistencia(
          fromDate,
          toDate,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe,
          selectedPlant === 'all' ? undefined : selectedPlant,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion,
          selectedSpecimenType === 'all' ? undefined : selectedSpecimenType,
          selectedFcValue === 'all' ? undefined : selectedFcValue,
          undefined,
          soloEdadGarantia,
          incluirEnsayosFueraTiempo
        );

        if (!isCancelled) {
          setUnfilteredChartData(unfilteredData);
        }
      } catch (e) {
        if (!isCancelled) {
          console.error('Error fetching unfiltered chart data for ages:', e);
          setUnfilteredChartData([]);
        }
      }
    };

    fetchUnfilteredData();

    return () => {
      isCancelled = true;
    };
  }, [
    dateRange,
    selectedClient,
    selectedConstructionSite,
    selectedRecipe,
    selectedPlant,
    selectedClasificacion,
    selectedSpecimenType,
    selectedFcValue,
    soloEdadGarantia,
    incluirEnsayosFueraTiempo,
  ]);

  const availableAgesFromChart = useMemo(() => {
    const dataToUse =
      unfilteredChartData.length > 0
        ? unfilteredChartData
        : datosGrafico.length > 0 && selectedAge === 'all'
          ? datosGrafico
          : [];

    if (!dataToUse || dataToUse.length === 0) {
      if (loading && unfilteredChartData.length === 0) {
        return availableAges;
      }
      if (!loading && unfilteredChartData.length === 0 && datosGrafico.length === 0) {
        return [];
      }
      return availableAges;
    }

    const ageMap = new Map<string, { originalValue: number; unit: string; sortKey: number }>();

    dataToUse.forEach((point: DatoGraficoResistencia) => {
      if (point.edadOriginal !== undefined && point.unidadEdad) {
        const key = `${point.edadOriginal}_${point.unidadEdad}`;

        if (!ageMap.has(key)) {
          let sortKey: number;
          if (point.unidadEdad === 'HORA' || point.unidadEdad === 'H') {
            sortKey = point.edadOriginal / 24;
          } else if (point.unidadEdad === 'DÍA' || point.unidadEdad === 'D') {
            sortKey = point.edadOriginal;
          } else {
            sortKey = 28;
          }

          ageMap.set(key, {
            originalValue: point.edadOriginal,
            unit: point.unidadEdad,
            sortKey,
          });
        }
      }
    });

    const chartAges = Array.from(ageMap.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((age) => {
        const { originalValue, unit } = age;
        let label: string;

        if (unit === 'HORA' || unit === 'H') {
          label = originalValue === 1 ? '1 hora' : `${originalValue} horas`;
        } else if (unit === 'DÍA' || unit === 'D') {
          label = originalValue === 1 ? '1 día' : `${originalValue} días`;
        } else {
          label = `${originalValue} ${unit}`;
        }

        return {
          value: `${originalValue}_${unit}`,
          label,
        };
      });

    return chartAges.length > 0 ? chartAges : availableAges;
  }, [unfilteredChartData, datosGrafico, availableAges, loading, selectedAge]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  const hasAccess = profile && canViewQualityDashboardUi(profile.role);

  const eficiencia =
    typeof advancedMetrics.eficiencia === 'number' && !isNaN(advancedMetrics.eficiencia)
      ? advancedMetrics.eficiencia
      : metricas.eficiencia;
  const rendimientoVolumetrico =
    typeof advancedMetrics.rendimientoVolumetrico === 'number' && !isNaN(advancedMetrics.rendimientoVolumetrico)
      ? advancedMetrics.rendimientoVolumetrico
      : metricas.rendimientoVolumetrico;

  const kpiItems: QualityKPIItem[] = useMemo(() => {
    if (loading) return [];
    return [
      {
        id: 'cumplimiento',
        label: 'Cumplimiento prom.',
        value: `${(metricas.porcentajeResistenciaGarantia ?? 0).toFixed(2)}%`,
        sublabel: 'vs. resistencia garantía',
      },
      {
        id: 'resistencia',
        label: 'Resistencia prom.',
        value: `${(metricas.resistenciaPromedio ?? 0).toFixed(2)}`,
        sublabel: 'kg/cm²',
      },
      {
        id: 'especificacion',
        label: 'En especificación',
        value:
          metricas.numeroMuestras > 0
            ? `${metricas.muestrasEnCumplimiento} / ${metricas.numeroMuestras}`
            : '—',
        sublabel: 'muestreos ≥100%',
      },
      {
        id: 'cv',
        label: 'Coef. variación',
        value: `${(metricas.coeficienteVariacion ?? 0).toFixed(2)}%`,
        hint: 'Uniformidad del concreto en el período filtrado.',
      },
      {
        id: 'total',
        label: 'Muestreos',
        value: String(metricas.numeroMuestras ?? 0),
        sublabel: 'con ensayo',
      },
    ];
  }, [loading, metricas]);

  const dateActions = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-medium text-stone-600 whitespace-nowrap">Período</span>
      <DatePickerWithRange value={dateRange} onChange={handleDateRangeChange} />
      {process.env.NODE_ENV === 'development' && (
        <Button variant="secondary" size="sm" onClick={handleCheckDatabaseContent}>
          Check DB Data
        </Button>
      )}
    </div>
  );

  if (!hasAccess) {
    return (
      <div className={embedded ? 'py-4' : 'container mx-auto py-16 px-4'}>
        <div
          className={
            embedded
              ? 'rounded-lg border border-amber-200 bg-amber-50 p-4'
              : 'max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8'
          }
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0" />
            <h2 className="text-lg font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          <p className="text-sm text-yellow-800">No tienes permiso para acceder al panel de control de calidad.</p>
        </div>
      </div>
    );
  }

  const filtersBlock = (
    <QualityDashboardFilters
      clients={clients}
      constructionSites={constructionSites}
      recipes={recipes}
      plants={plants}
      availableAges={availableAgesFromChart}
      fcValues={fcValues}
      specimenTypes={specimenTypes}
      selectedClient={selectedClient}
      selectedConstructionSite={selectedConstructionSite}
      selectedRecipe={selectedRecipe}
      selectedPlant={selectedPlant}
      selectedClasificacion={selectedClasificacion}
      selectedSpecimenType={selectedSpecimenType}
      selectedFcValue={selectedFcValue}
      selectedAge={selectedAge}
      soloEdadGarantia={soloEdadGarantia}
      incluirEnsayosFueraTiempo={incluirEnsayosFueraTiempo}
      openClient={openClient}
      openSite={openSite}
      openRecipe={openRecipe}
      openPlant={openPlant}
      openFcValue={openFcValue}
      openAge={openAge}
      setSelectedClient={setSelectedClient}
      setSelectedConstructionSite={setSelectedConstructionSite}
      setSelectedRecipe={setSelectedRecipe}
      setSelectedPlant={setSelectedPlant}
      setSelectedClasificacion={setSelectedClasificacion}
      setSelectedSpecimenType={setSelectedSpecimenType}
      setSelectedFcValue={setSelectedFcValue}
      setSelectedAge={setSelectedAge}
      setSoloEdadGarantia={setSoloEdadGarantia}
      setIncluirEnsayosFueraTiempo={setIncluirEnsayosFueraTiempo}
      setOpenClient={setOpenClient}
      setOpenSite={setOpenSite}
      setOpenRecipe={setOpenRecipe}
      setOpenPlant={setOpenPlant}
      setOpenFcValue={setOpenFcValue}
      setOpenAge={setOpenAge}
      getFilteredConstructionSites={getFilteredConstructionSites}
      resetAllFilters={resetAllFilters}
    />
  );

  const mainBody = (
    <>
      {filtersBlock}
      {error ? (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar datos</AlertTitle>
          <AlertDescription className="mt-2">{error}</AlertDescription>
          <Button className="mt-4" variant="secondary" size="sm" onClick={retryLoadData}>
            Reintentar
          </Button>
        </Alert>
      ) : (
        <div className="space-y-6">
          <QualityKPIStrip items={kpiItems} loading={loading} />

          <Collapsible className="rounded-lg border border-stone-200 bg-white shadow-sm">
            <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-stone-800 hover:bg-stone-50">
              Más métricas operativas
              <ChevronDown className="h-4 w-4 shrink-0 text-stone-500 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-stone-100 px-4 py-3">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div>
                  <dt className="text-stone-500">Eficiencia</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {eficiencia != null && !isNaN(eficiencia) ? eficiencia.toFixed(3) : '—'}
                  </dd>
                  <dd className="text-xs text-stone-500">kg/cm² por kg cemento (derivado del gráfico si aplica)</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Rendimiento volumétrico</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {rendimientoVolumetrico != null && !isNaN(rendimientoVolumetrico)
                      ? `${rendimientoVolumetrico.toFixed(2)}%`
                      : '—'}
                  </dd>
                  <dd className="text-xs text-stone-500">Volumen real vs registrado</dd>
                </div>
                {selectedFcValue !== 'all' && (
                  <div>
                    <dt className="text-stone-500">Desviación estándar</dt>
                    <dd className="font-semibold tabular-nums text-stone-900">
                      {(metricas.desviacionEstandar ?? 0).toFixed(2)}
                    </dd>
                    <dd className="text-xs text-stone-500">Variabilidad con FC filtrado</dd>
                  </div>
                )}
              </dl>
            </CollapsibleContent>
          </Collapsible>

          <QualityChartSection
            datosGrafico={datosGrafico}
            loading={loading}
            soloEdadGarantia={soloEdadGarantia}
            constructionSites={constructionSites}
          />
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-4 py-1">{mainBody}</div>;
  }

  return (
    <QualityReportShell
      warmCanvas
      headerTop={
        <QualityBreadcrumb hubName="Controles" hubHref="/quality/controles" items={[{ label: 'Dashboard' }]} />
      }
      title="Control de calidad"
      subtitle="Métricas y análisis de resistencia de concreto"
      actions={dateActions}
    >
      {mainBody}
    </QualityReportShell>
  );
}
