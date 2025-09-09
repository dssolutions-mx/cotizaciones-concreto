'use client';

import React, { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, format, isValid, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '@/lib/utils';
import { VAT_RATE } from '@/lib/sales-utils';
import { DateRange } from "react-day-picker";
import { usePlantContext } from '@/contexts/PlantContext';

// Import modular components
import { SalesFilters } from '@/components/finanzas/SalesFilters';
import { SalesStatisticsCards } from '@/components/finanzas/SalesStatisticsCards';
import { SalesDataTable } from '@/components/finanzas/SalesDataTable';
import { SalesVATIndicators } from '@/components/finanzas/SalesVATIndicators';

// Import utilities
import { exportSalesToExcel } from '@/utils/salesExport';
import { SalesDataProcessor, SummaryMetrics, ConcreteByRecipe } from '@/utils/salesDataProcessor';

// Import hooks
import { useSalesData, useHistoricalSalesData } from '@/hooks/useSalesData';

export default function VentasDashboardSimple() {
  const { currentPlant } = usePlantContext();
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [layoutType, setLayoutType] = useState<'current' | 'powerbi'>('current');

  // PowerBI Filters
  const [resistanceFilter, setResistanceFilter] = useState<string>('all');
  const [efectivoFiscalFilter, setEfectivoFiscalFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [codigoProductoFilter, setCodigoProductoFilter] = useState<string>('all');
  const [includeVAT, setIncludeVAT] = useState<boolean>(false);

  // Processed data state
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics | null>(null);
  const [concreteByRecipe, setConcreteByRecipe] = useState<ConcreteByRecipe>({});

  // Use custom hook for data fetching
  const {
    salesData,
    remisionesData,
    clients,
    resistances,
    tipos,
    productCodes,
    loading,
    error
  } = useSalesData({
    startDate,
    endDate,
    currentPlant
  });

  // Filter remisiones by client and search term
  const filteredRemisiones = useMemo(() => {
    let filtered = [...remisionesData];

    // Apply client filter
    if (clientFilter && clientFilter !== 'all') {
      filtered = filtered.filter(r => r.order?.client_id === clientFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.remision_number?.toLowerCase().includes(term) ||
        r.order?.order_number?.toLowerCase().includes(term) ||
        r.order?.clients?.business_name?.toLowerCase().includes(term) ||
        r.recipe?.recipe_code?.toLowerCase().includes(term)
      );
    }

    // Apply PowerBI Filters
    if (layoutType === 'powerbi') {
      if (resistanceFilter && resistanceFilter !== 'all') {
        filtered = filtered.filter(r => r.recipe?.strength_fc?.toString() === resistanceFilter);
      }
      if (efectivoFiscalFilter && efectivoFiscalFilter !== 'all') {
        const requiresInvoice = efectivoFiscalFilter === 'fiscal';
        filtered = filtered.filter(r => {
          const order = salesData.find(o => o.id === r.order_id);
          return order?.requires_invoice === requiresInvoice;
        });
      }
      if (tipoFilter && tipoFilter !== 'all') {
        filtered = filtered.filter(r => r.tipo_remision === tipoFilter);
      }
      if (codigoProductoFilter && codigoProductoFilter !== 'all') {
        filtered = filtered.filter(r => r.recipe?.recipe_code === codigoProductoFilter);
      }
    }

    return filtered;
  }, [remisionesData, clientFilter, searchTerm, layoutType, resistanceFilter, efectivoFiscalFilter, tipoFilter, codigoProductoFilter, salesData]);

  // Calculate summary metrics using the utility
  useMemo(() => {
    const metrics = SalesDataProcessor.calculateSummaryMetrics(filteredRemisiones, salesData, clientFilter);
    setSummaryMetrics(metrics);
  }, [filteredRemisiones, salesData, clientFilter]);

  // Calculate concrete by recipe using the utility
  useMemo(() => {
    const concreteRemisiones = filteredRemisiones.filter(r =>
      r.tipo_remision === 'CONCRETO' ||
      (r.isVirtualVacioDeOlla && r.tipo_remision === 'VACÍO DE OLLA')
    );
    const result = SalesDataProcessor.calculateConcreteByRecipe(concreteRemisiones);
    setConcreteByRecipe(result);
  }, [filteredRemisiones]);

  // Create virtual vacío de olla remisiones
  const virtualVacioDeOllaRemisiones = useMemo(() =>
    SalesDataProcessor.createVirtualVacioDeOllaRemisiones(
      salesData,
      remisionesData,
      clientFilter,
      searchTerm,
      layoutType,
      tipoFilter,
      efectivoFiscalFilter
    ), [salesData, remisionesData, clientFilter, searchTerm, layoutType, tipoFilter, efectivoFiscalFilter]);

  // Combine regular and virtual remisiones
  const filteredRemisionesWithVacioDeOlla = useMemo(() =>
    [...filteredRemisiones, ...virtualVacioDeOllaRemisiones],
    [filteredRemisiones, virtualVacioDeOllaRemisiones]
  );

  // Use processed summary metrics from state
  const currentSummaryMetrics = summaryMetrics || {
    concreteVolume: 0,
    pumpVolume: 0,
    emptyTruckVolume: 0,
    totalVolume: 0,
    concreteAmount: 0,
    pumpAmount: 0,
    emptyTruckAmount: 0,
    totalAmount: 0,
    cashAmount: 0,
    invoiceAmount: 0,
    weightedConcretePrice: 0,
    weightedPumpPrice: 0,
    weightedEmptyTruckPrice: 0,
    weightedResistance: 0,
    resistanceTooltip: '',
    totalAmountWithVAT: 0,
    cashAmountWithVAT: 0,
    invoiceAmountWithVAT: 0,
    weightedConcretePriceWithVAT: 0,
    weightedPumpPriceWithVAT: 0,
    weightedEmptyTruckPriceWithVAT: 0
  };

  // Calculate date range for display
  const dateRangeText = useMemo(() => SalesDataProcessor.getDateRangeText(startDate, endDate), [startDate, endDate]);

  // Event handlers
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) setStartDate(range.from);
    if (range?.to) setEndDate(range.to);
  };

  const handleClientFilterChange = (value: string) => {
    setClientFilter(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleResistanceFilterChange = (value: string) => setResistanceFilter(value);
  const handleEfectivoFiscalFilterChange = (value: string) => setEfectivoFiscalFilter(value);
  const handleTipoFilterChange = (value: string) => setTipoFilter(value);
  const handleCodigoProductoFilterChange = (value: string) => setCodigoProductoFilter(value);
  const handleIncludeVATChange = (checked: boolean) => setIncludeVAT(checked);

  // Excel Export Function using utility
  const exportToExcel = () => {
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
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error al cargar los datos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Layout Toggle */}
      <div className="flex items-center justify-end space-x-2 mb-4">
        <label className="text-sm">Vista Actual</label>
        <button
          onClick={() => setLayoutType(layoutType === 'current' ? 'powerbi' : 'current')}
          className={`px-3 py-1 rounded text-sm ${layoutType === 'powerbi' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          {layoutType === 'powerbi' ? 'PowerBI' : 'Actual'}
        </button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reporte de Ventas Mensual</CardTitle>
          <p className="text-sm text-muted-foreground">{dateRangeText}</p>
        </CardHeader>
        <CardContent>
          {/* Sales Filters Component */}
          <SalesFilters
            currentPlant={currentPlant}
            startDate={startDate}
            endDate={endDate}
            clientFilter={clientFilter}
            searchTerm={searchTerm}
            clients={clients}
            onDateRangeChange={handleDateRangeChange}
            onClientFilterChange={handleClientFilterChange}
            onSearchChange={handleSearchChange}
            layoutType={layoutType}
            resistanceFilter={resistanceFilter}
            efectivoFiscalFilter={efectivoFiscalFilter}
            tipoFilter={tipoFilter}
            codigoProductoFilter={codigoProductoFilter}
            resistances={resistances}
            tipos={tipos}
            productCodes={productCodes}
            onResistanceFilterChange={handleResistanceFilterChange}
            onEfectivoFiscalFilterChange={handleEfectivoFiscalFilterChange}
            onTipoFilterChange={handleTipoFilterChange}
            onCodigoProductoFilterChange={handleCodigoProductoFilterChange}
            includeVAT={includeVAT}
            onIncludeVATChange={handleIncludeVATChange}
          />

          {/* VAT Indicators */}
          <SalesVATIndicators
            layoutType={layoutType}
            includeVAT={includeVAT}
            currentPlant={currentPlant}
            clientFilter={clientFilter}
            clients={clients}
            filteredRemisionesWithVacioDeOlla={filteredRemisionesWithVacioDeOlla}
            summaryMetrics={currentSummaryMetrics}
          />

          {/* Summary Cards */}
          {summaryMetrics && (
            <SalesStatisticsCards
              loading={false}
              summaryMetrics={summaryMetrics}
              concreteByRecipe={concreteByRecipe}
              includeVAT={includeVAT}
              VAT_RATE={VAT_RATE}
              formatNumberWithUnits={formatCurrency}
            />
          )}

          {/* Data Table */}
          <SalesDataTable
            loading={false}
            filteredRemisionesWithVacioDeOlla={filteredRemisionesWithVacioDeOlla}
            filteredRemisiones={filteredRemisiones}
            salesData={salesData}
            summaryMetrics={currentSummaryMetrics}
            includeVAT={includeVAT}
            onExportToExcel={exportToExcel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
