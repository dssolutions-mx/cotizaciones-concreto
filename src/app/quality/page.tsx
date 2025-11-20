'use client';

import React, { useState, useMemo } from 'react';
import { subMonths } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { Loader2, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import type { DatoGraficoResistencia } from '@/types/quality';

// Custom hooks
import { useQualityDashboard } from '@/hooks/useQualityDashboard';
import { useQualityFilters } from '@/hooks/useQualityFilters';
import { useAdvancedMetrics } from '@/hooks/useAdvancedMetrics';

// Components
import { QualityDashboardFilters } from '@/components/quality/QualityDashboardFilters';
import { QualityMetricsCards } from '@/components/quality/QualityMetricsCards';
import { QualityChartSection } from '@/components/quality/QualityChartSection';
// Removed separate advanced metrics components; integrated into KPI cards

// Auth
import { useAuthBridge } from '@/adapters/auth-context-bridge';

export default function QualityDashboardPage() {
  const { profile } = useAuthBridge();
  
  // Block QUALITY_TEAM from accessing quality dashboard, redirect to muestreos
  if (profile?.role === 'QUALITY_TEAM') {
    if (typeof window !== 'undefined') {
      window.location.href = '/quality/muestreos';
      return null;
    }
  }

  // Main state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 2),
    to: new Date()
  });

  // Additional state for filters
  const [soloEdadGarantia, setSoloEdadGarantia] = useState<boolean>(true);
  const [incluirEnsayosFueraTiempo, setIncluirEnsayosFueraTiempo] = useState<boolean>(false);

  // Use filter hook first
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
    resetAllFilters
  } = useQualityFilters(dateRange);

  // Use custom hooks for data management

  const {
    metricas,
    datosGrafico,
    loading,
    error,
    loadDashboardData,
    handleCheckDatabaseContent,
    retryLoadData
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
    incluirEnsayosFueraTiempo
  });

  // Use advanced metrics hook
  const { advancedMetrics, calculating } = useAdvancedMetrics(datosGrafico);

  // State to store unfiltered chart data (without age filter) for building available ages
  const [unfilteredChartData, setUnfilteredChartData] = useState<DatoGraficoResistencia[]>([]);

  // Fetch unfiltered chart data (without age filter) to build available ages
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

        console.log('🔍 Fetching unfiltered chart data for available ages:', {
          fromDate,
          toDate,
          selectedClient,
          selectedConstructionSite,
          selectedRecipe,
          selectedPlant,
          selectedClasificacion,
          selectedSpecimenType,
          selectedFcValue,
          soloEdadGarantia,
          incluirEnsayosFueraTiempo
        });

        // Fetch chart data with all filters EXCEPT age filter
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
          undefined, // No age filter - this is the key difference
          soloEdadGarantia,
          incluirEnsayosFueraTiempo
        );

        if (!isCancelled) {
          console.log('✅ Received unfiltered chart data for ages:', {
            dataLength: unfilteredData.length,
            ages: unfilteredData.map(d => `${d.edadOriginal}_${d.unidadEdad}`).filter((v, i, a) => a.indexOf(v) === i)
          });
          setUnfilteredChartData(unfilteredData);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error fetching unfiltered chart data for ages:', error);
          setUnfilteredChartData([]);
        }
      }
    };

    fetchUnfilteredData();

    return () => {
      isCancelled = true;
    };
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedFcValue, soloEdadGarantia, incluirEnsayosFueraTiempo]);

  // Build availableAges from unfiltered chart data (without age filter) to show all available ages
  const availableAgesFromChart = useMemo(() => {
    // Always prefer unfiltered chart data (without age filter) to show all available ages
    // Only fallback to datosGrafico if unfiltered data is not yet loaded
    const dataToUse = unfilteredChartData.length > 0 ? unfilteredChartData : (datosGrafico.length > 0 && selectedAge === 'all' ? datosGrafico : []);
    
    if (!dataToUse || dataToUse.length === 0) {
      // Only use filter-based ages as fallback if we're still loading or have no data
      if (loading && unfilteredChartData.length === 0) {
        return availableAges; // Still loading, use filter-based ages temporarily
      }
      // If we have datosGrafico but it's empty and we're not loading, return empty array
      if (!loading && unfilteredChartData.length === 0 && datosGrafico.length === 0) {
        return [];
      }
      return availableAges; // Fallback to filter-based ages
    }

    // Build ages from chart data using edadOriginal and unidadEdad
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
            sortKey = 28; // Default fallback
          }

          ageMap.set(key, {
            originalValue: point.edadOriginal,
            unit: point.unidadEdad,
            sortKey
          });
        }
      }
    });

    const chartAges = Array.from(ageMap.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(age => {
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
          label
        };
      });

    console.log('🔍 Built available ages from chart data:', {
      source: unfilteredChartData.length > 0 ? 'unfiltered' : 'filtered',
      dataPoints: dataToUse.length,
      ages: chartAges.map(a => a.label),
      selectedAge
    });

    // Return chart-based ages if available, otherwise fallback to filter-based
    return chartAges.length > 0 ? chartAges : availableAges;
  }, [unfilteredChartData, datosGrafico, availableAges, loading, selectedAge]);

  // Handle date range changes
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder al módulo de control de calidad.
          </p>
          
          <div className="bg-white p-4 rounded-lg border border-yellow-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
            <p className="text-gray-600">
              Este módulo está restringido a usuarios con roles específicos como Equipo de Calidad,
              Gerentes de Planta y Ejecutivos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="mb-6">
            <h1 className="text-title-1 font-bold text-slate-900 mb-2">
              Control de Calidad
            </h1>
            <p className="text-body text-slate-600">
              Métricas y análisis de resistencia de concreto
            </p>
          </div>

          {/* Date Range Picker */}
          <div className="glass-thick rounded-xl p-4 border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Período de Muestreo</span>
                <DatePickerWithRange
                  value={dateRange}
                  onChange={handleDateRangeChange}
                />
              </div>

              {/* Check DB Data Button - Hidden in production */}
              {process.env.NODE_ENV === 'development' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCheckDatabaseContent}
                >
                  Check DB Data
                </Button>
              )}
            </div>
          </div>
        </div>

      {/* Filters Section */}
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

        {/* Error Handling */}
        {error ? (
          <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error al cargar datos</AlertTitle>
            <AlertDescription className="mt-2">{error}</AlertDescription>
            <Button
              className="mt-4"
              variant="secondary"
              size="sm"
              onClick={retryLoadData}
            >
              Reintentar
            </Button>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* Metrics Cards (integrated advanced metrics) */}
            <QualityMetricsCards
              metrics={metricas}
              loading={loading}
              eficienciaOverride={advancedMetrics.eficiencia}
              rendimientoVolumetricoOverride={advancedMetrics.rendimientoVolumetrico}
              showStdDev={selectedFcValue !== 'all'}
            />

            {/* Chart Section */}
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

// Componente fallback para iconos que pueden no estar disponibles
function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
} 
