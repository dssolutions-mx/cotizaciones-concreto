'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { endOfMonth, isValid, parseISO, startOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { usePlantContext } from '@/contexts/PlantContext';
import { plantAwareDataService } from '@/lib/services/PlantAwareDataService';
import {
  normalizeBaseAccessiblePlantIds,
  resolveEffectiveSalesPlantIds,
} from '@/lib/finanzas/resolveSalesPlantScope';
import {
  loadVentasDashboardFilters,
  saveVentasDashboardFilters,
  SHOW_VENTAS_DEBUG_TOOL,
} from '@/lib/finanzas/ventas/ventasDashboardCache';
import { buildSparklineRevenueByPlantLastNMonths } from '@/lib/finanzas/ventas/buildVentasMonthlyTrendFromRemisiones';
import { EMPTY_VENTAS_SUMMARY_METRICS } from '@/lib/finanzas/ventas/ventasEmptySummary';
import { VAT_RATE } from '@/lib/sales-utils';
import { SalesDataProcessor } from '@/utils/salesDataProcessor';
import { exportSalesToExcel } from '@/utils/salesExport';
import { useSalesData } from '@/hooks/useSalesData';
import { useSalesAgentData } from '@/hooks/useSalesAgentData';
import { useProgressiveGuaranteeAge } from '@/hooks/useProgressiveGuaranteeAge';
import { useVentasRemisionPipeline } from '@/hooks/useVentasRemisionPipeline';
import { useVentasSummaryMetrics } from '@/hooks/useVentasSummaryMetrics';
import { useVentasChartAggregates, type VentasProductGroupMode } from '@/hooks/useVentasChartAggregates';
import { useVentasPerPlantRows } from '@/hooks/useVentasPerPlantRows';
import { useVentasPricingDebug } from '@/hooks/useVentasPricingDebug';
import { useVentasHistoricalSnapshot } from '@/hooks/useVentasHistoricalSnapshot';

import { SalesVATIndicators } from '@/components/finanzas/SalesVATIndicators';
import { VentasScopeAlert } from '@/components/finanzas/ventas/VentasScopeAlert';
import { VentasDebugToolbar } from '@/components/finanzas/ventas/VentasDebugToolbar';
import { VentasStreamingBar } from '@/components/finanzas/ventas/VentasStreamingBar';
import { VentasStickyHeader } from '@/components/finanzas/ventas/VentasStickyHeader';
import { VentasFilterBar } from '@/components/finanzas/ventas/VentasFilterBar';
import { VentasHeroKpis } from '@/components/finanzas/ventas/VentasHeroKpis';
import { VentasInsightsRow } from '@/components/finanzas/ventas/VentasInsightsRow';
import { VentasProductBreakdown } from '@/components/finanzas/ventas/VentasProductBreakdown';
import { VentasTrendsCard, type VentasTrendsTab } from '@/components/finanzas/ventas/VentasTrendsCard';
import { VentasPerPlantTable } from '@/components/finanzas/ventas/VentasPerPlantTable';
import { VentasClientsCard } from '@/components/finanzas/ventas/VentasClientsCard';
import { VentasAgentsCard, type VentasAgentRow } from '@/components/finanzas/ventas/VentasAgentsCard';
import { VentasRemisionesSection } from '@/components/finanzas/ventas/VentasRemisionesSection';
import { VentasDebugPricingCard } from '@/components/finanzas/ventas/VentasDebugPricingCard';

function readCachedStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value as string[];
  return undefined;
}

function readCachedIsoDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const d = parseISO(value);
  return isValid(d) ? d : undefined;
}

function readTrendsTab(raw: unknown): VentasTrendsTab {
  if (raw === 'volume' || raw === 'revenue' || raw === 'clients') return raw;
  return 'volume';
}

function readProductGroupMode(raw: unknown): VentasProductGroupMode {
  if (raw === 'recipe_code' || raw === 'master') return raw;
  return 'master';
}

export default function VentasDashboard() {
  const { availablePlants, businessUnits, userAccess, isGlobalAdmin } = usePlantContext();

  const cachedFilters = useMemo(() => loadVentasDashboardFilters(), []);

  const [baseAccessiblePlantIds, setBaseAccessiblePlantIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await plantAwareDataService.getAccessiblePlantIds({
        userAccess,
        isGlobalAdmin,
        currentPlantId: null,
      });
      const pickerIds = availablePlants.map((p) => p.id);
      const base = normalizeBaseAccessiblePlantIds(raw, pickerIds);
      if (!cancelled) setBaseAccessiblePlantIds(base);
    })();
    return () => {
      cancelled = true;
    };
  }, [userAccess, isGlobalAdmin, availablePlants]);

  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>(() => {
    const ids = readCachedStringArray(cachedFilters?.selectedPlantIds);
    if (ids?.length) return ids;
    const legacy = cachedFilters?.selectedPlantId as string | undefined;
    return legacy ? [legacy] : [];
  });

  const selectedPlant =
    selectedPlantIds.length === 1 ? availablePlants.find((p) => p.id === selectedPlantIds[0]) : null;

  const effectivePlantIds = useMemo(
    () => resolveEffectiveSalesPlantIds(selectedPlantIds, baseAccessiblePlantIds),
    [selectedPlantIds, baseAccessiblePlantIds]
  );

  const scopePlantSummary = useMemo(() => {
    if (effectivePlantIds.length === 0) return 'Sin plantas en alcance';
    const names = effectivePlantIds.map(
      (id) => availablePlants.find((p) => p.id === id)?.name || id
    );
    const preview = names.slice(0, 4).join(', ');
    const extra = names.length > 4 ? ` +${names.length - 4}` : '';
    const prefix =
      selectedPlantIds.length === 0
        ? 'Todas las plantas en su alcance'
        : `${effectivePlantIds.length} planta(s) seleccionada(s)`;
    return `${prefix}: ${preview}${extra}`;
  }, [effectivePlantIds, availablePlants, selectedPlantIds]);

  const scopeChipLabel =
    effectivePlantIds.length === 0
      ? 'Sin alcance'
      : selectedPlantIds.length === 0
        ? `Todas (${effectivePlantIds.length})`
        : `${effectivePlantIds.length} planta(s)`;

  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    return readCachedIsoDate(cachedFilters?.startDateIso) ?? startOfMonth(new Date());
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    return readCachedIsoDate(cachedFilters?.endDateIso) ?? endOfMonth(new Date());
  });
  const [searchTerm, setSearchTerm] = useState('');

  const [clientFilter, setClientFilter] = useState<string[]>(() => {
    const cf = cachedFilters?.clientFilter;
    if (Array.isArray(cf)) return cf as string[];
    if (typeof cf === 'string' && cf && cf !== 'all') return [cf];
    return [];
  });

  const [resistanceFilter, setResistanceFilter] = useState<string>(
    (cachedFilters?.resistanceFilter as string) || 'all'
  );
  const [efectivoFiscalFilter, setEfectivoFiscalFilter] = useState<string>(
    (cachedFilters?.efectivoFiscalFilter as string) || 'all'
  );
  const [tipoFilter, setTipoFilter] = useState<string[]>(
    readCachedStringArray(cachedFilters?.tipoFilter) ?? []
  );
  const [codigoProductoFilter, setCodigoProductoFilter] = useState<string[]>(
    readCachedStringArray(cachedFilters?.codigoProductoFilter) ?? []
  );
  const [includeVAT, setIncludeVAT] = useState<boolean>(Boolean(cachedFilters?.includeVAT));

  const [trendsTab, setTrendsTab] = useState<VentasTrendsTab>(() =>
    readTrendsTab(cachedFilters?.ventasTrendsTab)
  );

  const [productGroupMode, setProductGroupMode] = useState<VentasProductGroupMode>(() =>
    readProductGroupMode(cachedFilters?.ventasProductGroupMode)
  );

  useEffect(() => {
    saveVentasDashboardFilters({
      selectedPlantIds,
      clientFilter,
      resistanceFilter,
      efectivoFiscalFilter,
      tipoFilter,
      codigoProductoFilter,
      includeVAT,
      startDateIso: startDate?.toISOString(),
      endDateIso: endDate?.toISOString(),
      ventasTrendsTab: trendsTab,
      ventasProductGroupMode: productGroupMode,
    });
  }, [
    selectedPlantIds,
    clientFilter,
    resistanceFilter,
    efectivoFiscalFilter,
    tipoFilter,
    codigoProductoFilter,
    includeVAT,
    startDate,
    endDate,
    trendsTab,
    productGroupMode,
  ]);

  const {
    salesData,
    remisionesData,
    clients,
    resistances,
    tipos,
    productCodes,
    loading,
    error,
    orderItems,
    pricingMap,
    streaming,
    progress,
  } = useSalesData({
    startDate,
    endDate,
    plantIdsForQuery: effectivePlantIds,
  });

  const {
    data: salesAgentData,
    loading: salesAgentLoading,
  } = useSalesAgentData({
    startDate,
    endDate,
    plantIds: effectivePlantIds,
  });

  const {
    monthlyActiveClients,
    remisionTrendPoints,
    historicalRemisiones,
    historicalData: historicalOrdersSnapshot,
    histPricingMap,
    loading: historicalSnapshotLoading,
    error: historicalSnapshotError,
  } = useVentasHistoricalSnapshot(effectivePlantIds, includeVAT, startDate, endDate);

  const {
    filteredRemisiones,
    filteredRemisionesWithVacioDeOlla,
    remisionesMissingOrderCount,
    filteredWeightedGuaranteeAge,
    reassignmentByRemision,
  } = useVentasRemisionPipeline({
    remisionesData,
    salesData,
    clientFilter,
    searchTerm,
    resistanceFilter,
    efectivoFiscalFilter,
    tipoFilter,
    codigoProductoFilter,
  });

  const { summaryMetrics } = useVentasSummaryMetrics(
    filteredRemisionesWithVacioDeOlla,
    salesData,
    clientFilter,
    orderItems,
    pricingMap
  );

  const {
    productCodeAmountData,
    productCodeVolumeData,
    clientAmountData,
  } = useVentasChartAggregates(
    filteredRemisionesWithVacioDeOlla,
    salesData,
    includeVAT,
    orderItems,
    pricingMap,
    productGroupMode
  );

  const { perPlantRows, exportPlantsTable } = useVentasPerPlantRows(
    filteredRemisionesWithVacioDeOlla,
    availablePlants,
    salesData,
    clientFilter,
    orderItems,
    pricingMap
  );

  const {
    showDebugTool,
    setShowDebugTool,
    debugData,
    debugLoading,
    runDebugComparison,
  } = useVentasPricingDebug();

  const currentSummaryMetrics = summaryMetrics ?? EMPTY_VENTAS_SUMMARY_METRICS;

  const dateRangeText = useMemo(
    () => SalesDataProcessor.getDateRangeText(startDate, endDate),
    [startDate, endDate]
  );

  const orderCount = useMemo(() => {
    const ids = new Set<string>();
    filteredRemisionesWithVacioDeOlla.forEach((r: any) => {
      if (r.order_id) ids.add(String(r.order_id));
    });
    return ids.size;
  }, [filteredRemisionesWithVacioDeOlla]);

  const sparklineRevenueByPlantId = useMemo(() => {
    const pids = perPlantRows.map((r) => r.plantId);
    if (!pids.length) return {};
    return buildSparklineRevenueByPlantLastNMonths(
      historicalRemisiones,
      historicalOrdersSnapshot,
      histPricingMap,
      pids,
      includeVAT,
      6
    );
  }, [
    historicalRemisiones,
    historicalOrdersSnapshot,
    histPricingMap,
    perPlantRows,
    includeVAT,
  ]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) setStartDate(range.from);
    if (range?.to) setEndDate(range.to);
  };

  const streamingPercent = useMemo(() => {
    if (!progress || !progress.total || progress.total === 0) return 0;
    const pct = Math.round((progress.processed / progress.total) * 100);
    return isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  }, [progress]);

  const { streaming: gaStreaming, progress: gaProgress } = useProgressiveGuaranteeAge(
    startDate,
    endDate,
    effectivePlantIds.length > 0 ? effectivePlantIds : null,
    { newestFirst: true }
  );

  const gaPercent = useMemo(() => {
    if (!gaProgress || !gaProgress.total || gaProgress.total === 0) return 0;
    const pct = Math.round((gaProgress.processed / gaProgress.total) * 100);
    return isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  }, [gaProgress]);

  const exportToExcel = useCallback(() => {
    const result = exportSalesToExcel(
      filteredRemisionesWithVacioDeOlla,
      salesData,
      currentSummaryMetrics,
      includeVAT,
      VAT_RATE,
      startDate,
      endDate
    );

    if (!result.success) {
      console.error('Export failed:', result.error);
    }
  }, [
    filteredRemisionesWithVacioDeOlla,
    salesData,
    currentSummaryMetrics,
    includeVAT,
    startDate,
    endDate,
  ]);

  const handleExportPlantsTable = useCallback(() => {
    exportPlantsTable(startDate, endDate, includeVAT);
  }, [exportPlantsTable, startDate, endDate, includeVAT]);

  const handleRunDebugComparison = useCallback(() => {
    void runDebugComparison({
      startDate,
      endDate,
      effectivePlantIds,
      filteredRemisionesWithVacioDeOlla,
      orderItems,
      pricingMap,
    });
  }, [
    runDebugComparison,
    startDate,
    endDate,
    effectivePlantIds,
    filteredRemisionesWithVacioDeOlla,
    orderItems,
    pricingMap,
  ]);

  const handleClientFilterChange = (values: string[]) => {
    setClientFilter(values);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary">
        <div className="container mx-auto max-w-7xl px-6 py-12">
          <div className="space-y-8">
            <div className="glass-thick h-12 animate-pulse rounded-3xl" />
            <div className="glass-thick h-40 animate-pulse rounded-3xl" />
            <div className="glass-thick h-96 animate-pulse rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-primary">
        <div className="container mx-auto max-w-7xl px-6 py-12">
          <div className="glass-thick rounded-3xl border border-systemRed/20 bg-gradient-to-br from-systemRed/10 to-systemRed/5 p-8">
            <h2 className="text-title-2 mb-4 font-bold text-systemRed">Error al cargar los datos</h2>
            <p className="text-body text-label-secondary">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <VentasDebugToolbar
          showDebugTool={showDebugTool}
          setShowDebugTool={setShowDebugTool}
          debugLoading={debugLoading}
          onRunComparison={handleRunDebugComparison}
        />

        <VentasScopeAlert
          scopePlantSummary={scopePlantSummary}
          dateRangeText={dateRangeText}
          streaming={streaming}
          streamingPercent={streamingPercent}
          remisionesMissingOrderCount={remisionesMissingOrderCount}
        />

        <div className="space-y-6">
          <VentasStickyHeader
            dateRangeText={dateRangeText}
            scopeChipLabel={scopeChipLabel}
            scopeSummary={scopePlantSummary}
            includeVAT={includeVAT}
            onIncludeVATChange={setIncludeVAT}
            rowCount={filteredRemisionesWithVacioDeOlla.length}
            onExportExcel={exportToExcel}
          />

          <VentasFilterBar
            currentPlant={selectedPlant}
            availablePlants={availablePlants}
            businessUnits={businessUnits}
            selectedPlantIds={selectedPlantIds}
            onPlantsChange={setSelectedPlantIds}
            onPlantChange={(id) => setSelectedPlantIds(id ? [id] : [])}
            startDate={startDate}
            endDate={endDate}
            clientFilter={clientFilter}
            searchTerm={searchTerm}
            clients={clients}
            onDateRangeChange={handleDateRangeChange}
            onClientFilterChange={handleClientFilterChange}
            onSearchChange={handleSearchChange}
            resistanceFilter={resistanceFilter}
            efectivoFiscalFilter={efectivoFiscalFilter}
            tipoFilter={tipoFilter}
            codigoProductoFilter={codigoProductoFilter}
            resistances={resistances}
            tipos={tipos}
            productCodes={productCodes}
            onResistanceFilterChange={setResistanceFilter}
            onEfectivoFiscalFilterChange={setEfectivoFiscalFilter}
            onTipoFilterChange={setTipoFilter}
            onCodigoProductoFilterChange={setCodigoProductoFilter}
            includeVAT={includeVAT}
            onIncludeVATChange={setIncludeVAT}
          />

          <div className="glass-thick rounded-3xl border border-label-tertiary/10 p-4">
            <SalesVATIndicators
              includeVAT={includeVAT}
              currentPlant={selectedPlant}
              clientFilter={clientFilter}
              clients={clients}
              filteredRemisionesWithVacioDeOlla={filteredRemisionesWithVacioDeOlla}
              summaryMetrics={currentSummaryMetrics}
            />
          </div>

          <VentasStreamingBar streaming={streaming} streamingPercent={streamingPercent} />

          <VentasHeroKpis
            currentSummaryMetrics={currentSummaryMetrics}
            includeVAT={includeVAT}
            filteredWeightedGuaranteeAge={filteredWeightedGuaranteeAge}
            gaStreaming={gaStreaming}
            gaPercent={gaPercent}
          />

          <VentasInsightsRow
            summaryMetrics={currentSummaryMetrics}
            includeVAT={includeVAT}
            remisionTrendPoints={remisionTrendPoints}
            orderCount={orderCount}
          />

          <VentasProductBreakdown
            productCodeAmountData={productCodeAmountData}
            productCodeVolumeData={productCodeVolumeData}
            includeVAT={includeVAT}
            productGroupMode={productGroupMode}
            onProductGroupModeChange={setProductGroupMode}
          />

          <VentasTrendsCard
            remisionTrendPoints={remisionTrendPoints}
            trendsLoading={historicalSnapshotLoading}
            trendsError={historicalSnapshotError}
            includeVAT={includeVAT}
            trendsReportRangeText={dateRangeText || undefined}
            activeClientsSeries={monthlyActiveClients}
            activeClientsLoading={historicalSnapshotLoading}
            activeClientsError={historicalSnapshotError}
            trendsTab={trendsTab}
            onTrendsTabChange={setTrendsTab}
          />

          <VentasPerPlantTable
            perPlantRows={perPlantRows}
            availablePlants={availablePlants}
            businessUnits={businessUnits}
            effectivePlantIds={effectivePlantIds}
            sparklineRevenueByPlantId={sparklineRevenueByPlantId}
            includeVAT={includeVAT}
            onExportPlantsTable={handleExportPlantsTable}
          />

          <VentasClientsCard
            clientAmountData={clientAmountData}
            currentRemisiones={filteredRemisionesWithVacioDeOlla}
            historicalRemisiones={historicalRemisiones}
            startDate={startDate}
            endDate={endDate}
          />

          <VentasAgentsCard
            data={salesAgentData as VentasAgentRow[]}
            loading={salesAgentLoading}
          />

          <VentasRemisionesSection
            rowCount={filteredRemisionesWithVacioDeOlla.length}
            loading={false}
            filteredRemisionesWithVacioDeOlla={filteredRemisionesWithVacioDeOlla}
            filteredRemisiones={filteredRemisiones}
            salesData={salesData}
            summaryMetrics={currentSummaryMetrics}
            includeVAT={includeVAT}
            onExportToExcel={exportToExcel}
            pricingMap={pricingMap}
            reassignmentByRemision={reassignmentByRemision}
          />
        </div>

        {SHOW_VENTAS_DEBUG_TOOL && showDebugTool && (
          <VentasDebugPricingCard debugLoading={debugLoading} debugData={debugData} />
        )}
      </div>
    </div>
  );
}
