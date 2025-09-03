'use client';

import React, { useState } from 'react';
import { subMonths } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { Loader2, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

// Custom hooks
import { useQualityDashboard } from '@/hooks/useQualityDashboard';
import { useQualityFilters } from '@/hooks/useQualityFilters';
import { useAdvancedMetrics } from '@/hooks/useAdvancedMetrics';

// Components
import { QualityDashboardFilters } from '@/components/quality/QualityDashboardFilters';
import { QualityMetricsCards } from '@/components/quality/QualityMetricsCards';
import { QualityChartSection } from '@/components/quality/QualityChartSection';
import { QualityAdvancedMetrics, QualityAdvancedMetricsCards } from '@/components/quality/QualityAdvancedMetrics';

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
    plantNameToIdMap,
    availableAges,
    selectedClient,
    selectedConstructionSite,
    selectedRecipe,
    selectedPlant,
    selectedClasificacion,
    selectedSpecimenType,
    selectedStrengthRange,
    selectedAge,
    openClient,
    openSite,
    openRecipe,
    openPlant,
    openStrengthRange,
    openAge,
    setSelectedClient,
    setSelectedConstructionSite,
    setSelectedRecipe,
    setSelectedPlant,
    setSelectedClasificacion,
    setSelectedSpecimenType,
    setSelectedStrengthRange,
    setSelectedAge,
    setOpenClient,
    setOpenSite,
    setOpenRecipe,
    setOpenPlant,
    setOpenStrengthRange,
    setOpenAge,
    getFilteredConstructionSites,
    resetAllFilters
  } = useQualityFilters(dateRange);

  // Use custom hooks for data management
  console.log('🌱 Plant selection debug:', {
    selectedPlant,
    availablePlants: plants
  });

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
    soloEdadGarantia,
    incluirEnsayosFueraTiempo
  });

  // Use advanced metrics hook
  const { advancedMetrics, calculating } = useAdvancedMetrics(datosGrafico);

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
    <div className="container mx-auto p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Dashboard de Control de Calidad</h1>
        <p className="text-gray-500 mb-4">
          Métricas y análisis de resistencia de concreto
        </p>
        
        {/* Date Range Picker */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-gray-700">Período (Fecha de Muestreo):</span>
          <DatePickerWithRange
            value={dateRange}
            onChange={handleDateRangeChange}
          />
          
          {/* Check DB Data Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleCheckDatabaseContent}
            className="ml-2"
          >
            Check DB Data
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <QualityDashboardFilters
        clients={clients}
        constructionSites={constructionSites}
        recipes={recipes}
        plants={plants}
        availableAges={availableAges}
        selectedClient={selectedClient}
        selectedConstructionSite={selectedConstructionSite}
        selectedRecipe={selectedRecipe}
        selectedPlant={selectedPlant}
        selectedClasificacion={selectedClasificacion}
        selectedSpecimenType={selectedSpecimenType}
        selectedStrengthRange={selectedStrengthRange}
        selectedAge={selectedAge}
        soloEdadGarantia={soloEdadGarantia}
        incluirEnsayosFueraTiempo={incluirEnsayosFueraTiempo}
        openClient={openClient}
        openSite={openSite}
        openRecipe={openRecipe}
        openPlant={openPlant}
        openStrengthRange={openStrengthRange}
        openAge={openAge}
        setSelectedClient={setSelectedClient}
        setSelectedConstructionSite={setSelectedConstructionSite}
        setSelectedRecipe={setSelectedRecipe}
        setSelectedPlant={setSelectedPlant}
        setSelectedClasificacion={setSelectedClasificacion}
        setSelectedSpecimenType={setSelectedSpecimenType}
        setSelectedStrengthRange={setSelectedStrengthRange}
        setSelectedAge={setSelectedAge}
        setSoloEdadGarantia={setSoloEdadGarantia}
        setIncluirEnsayosFueraTiempo={setIncluirEnsayosFueraTiempo}
        setOpenClient={setOpenClient}
        setOpenSite={setOpenSite}
        setOpenRecipe={setOpenRecipe}
        setOpenPlant={setOpenPlant}
        setOpenStrengthRange={setOpenStrengthRange}
        setOpenAge={setOpenAge}
        getFilteredConstructionSites={getFilteredConstructionSites}
        resetAllFilters={resetAllFilters}
      />

      {/* Error Handling */}
      {error ? (
        <Alert variant="destructive" className="mb-8 bg-white/70 backdrop-blur border border-red-200/60">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button 
            className="mt-2" 
            variant="outline" 
            onClick={retryLoadData}
          >
            Reintentar
          </Button>
        </Alert>
      ) : (
        <>
          {/* Metrics Cards */}
          <QualityMetricsCards metrics={metricas} loading={loading} />
          
          <Tabs defaultValue="grafico" className="mb-6">
            <TabsList className="mb-4 bg-white/60 backdrop-blur border border-slate-200/60 rounded-md">
              <TabsTrigger value="grafico">Gráfico de Resistencia</TabsTrigger>
              <TabsTrigger value="metricas">Métricas Avanzadas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="grafico">
              <QualityChartSection
                datosGrafico={datosGrafico}
                loading={loading}
                soloEdadGarantia={soloEdadGarantia}
                constructionSites={constructionSites}
              />
            </TabsContent>

            <TabsContent value="metricas">
              <QualityAdvancedMetrics
                advancedMetrics={{
                  ...advancedMetrics,
                  desviacionEstandar: metricas.desviacionEstandar
                }}
                calculating={calculating}
              />
              <QualityAdvancedMetricsCards
                advancedMetrics={{
                  ...advancedMetrics,
                  desviacionEstandar: metricas.desviacionEstandar
                }}
                calculating={calculating}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
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
