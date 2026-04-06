'use client';

import React, { useState, useMemo } from 'react';
import { subMonths } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { DatoGraficoResistencia } from '@/types/quality';

import { useQualityDashboard } from '@/hooks/useQualityDashboard';
import { useQualityFilters } from '@/hooks/useQualityFilters';
import { useAdvancedMetrics } from '@/hooks/useAdvancedMetrics';

import { QualityDashboardFilters } from '@/components/quality/QualityDashboardFilters';
import { QualityMetricsCards } from '@/components/quality/QualityMetricsCards';
import { QualityChartSection } from '@/components/quality/QualityChartSection';
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';

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
    loadDashboardData,
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

  const { advancedMetrics, calculating } = useAdvancedMetrics(datosGrafico);

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
          <p className="text-sm text-yellow-800">
            No tienes permiso para acceder al panel de control de calidad.
          </p>
        </div>
      </div>
    );
  }

  const outerClass = embedded ? '' : 'min-h-screen';
  const innerClass = embedded ? 'px-0 py-1' : 'container mx-auto px-4 md:px-6 py-6 md:py-8';

  return (
    <div className={outerClass}>
      <div className={innerClass}>
        {!embedded && (
          <div className="mb-4">
            <QualityBreadcrumb
              hubName="Controles"
              hubHref="/quality/controles"
              items={[{ label: 'Dashboard' }]}
            />
          </div>
        )}
        <div className={embedded ? 'mb-4' : 'mb-8'}>
          {!embedded && (
            <div className="mb-6">
              <h1 className="text-title-1 font-bold text-slate-900 mb-2">Control de Calidad</h1>
              <p className="text-body text-slate-600">Métricas y análisis de resistencia de concreto</p>
            </div>
          )}

          <div className="glass-thick rounded-xl p-4 border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                  Período de Muestreo
                </span>
                <DatePickerWithRange value={dateRange} onChange={handleDateRangeChange} />
              </div>

              {process.env.NODE_ENV === 'development' && (
                <Button variant="secondary" size="sm" onClick={handleCheckDatabaseContent}>
                  Check DB Data
                </Button>
              )}
            </div>
          </div>
        </div>

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
            <QualityMetricsCards
              metrics={metricas}
              loading={loading}
              eficienciaOverride={advancedMetrics.eficiencia}
              rendimientoVolumetricoOverride={advancedMetrics.rendimientoVolumetrico}
              showStdDev={selectedFcValue !== 'all'}
            />

            <QualityChartSection
              datosGrafico={datosGrafico}
              loading={loading}
              soloEdadGarantia={soloEdadGarantia}
              constructionSites={constructionSites}
            />
          </div>
        )}
      </div>
    </div>
  );
}
