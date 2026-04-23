'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from '@/lib/utils';
import { VAT_RATE } from '@/lib/sales-utils';
import { DateRange } from "react-day-picker";
import { usePlantContext } from '@/contexts/PlantContext';

import { SalesFilters } from '@/components/finanzas/SalesFilters';
import { SalesStatisticsCards } from '@/components/finanzas/SalesStatisticsCards';
import { SalesDataTable } from '@/components/finanzas/SalesDataTable';
import { SalesVATIndicators } from '@/components/finanzas/SalesVATIndicators';

import { exportSalesToExcel } from '@/utils/salesExport';
import { SalesDataProcessor, SummaryMetrics, ConcreteByRecipe } from '@/utils/salesDataProcessor';

import { useSalesData } from '@/hooks/useSalesData';

export default function VentasDashboardSimple() {
  const { currentPlant, availablePlants, businessUnits } = usePlantContext();
  const plantIdsForQuery = useMemo(
    () => (currentPlant?.id ? [currentPlant.id] : []),
    [currentPlant?.id]
  );
  const selectedPlantIds = useMemo(
    () => (currentPlant?.id ? [currentPlant.id] : []),
    [currentPlant?.id]
  );

  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [resistanceFilter, setResistanceFilter] = useState<string>('all');
  const [efectivoFiscalFilter, setEfectivoFiscalFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [codigoProductoFilter, setCodigoProductoFilter] = useState<string[]>([]);
  const [includeVAT, setIncludeVAT] = useState<boolean>(false);

  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics | null>(null);
  const [concreteByRecipe, setConcreteByRecipe] = useState<ConcreteByRecipe>({});

  const {
    salesData,
    remisionesData,
    orderItems,
    pricingMap,
    clients,
    resistances,
    tipos,
    productCodes,
    loading,
    error
  } = useSalesData({
    startDate,
    endDate,
    plantIdsForQuery,
  });

  const filteredRemisiones = useMemo(() => {
    let filtered = [...remisionesData];

    if (clientFilter.length > 0) {
      filtered = filtered.filter(r => r.order?.client_id && clientFilter.includes(r.order.client_id));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.remision_number?.toLowerCase().includes(term) ||
        r.order?.order_number?.toLowerCase().includes(term) ||
        r.order?.clients?.business_name?.toLowerCase().includes(term) ||
        r.recipe?.recipe_code?.toLowerCase().includes(term)
      );
    }

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
    if (tipoFilter.length > 0) {
      filtered = filtered.filter(r =>
        r.tipo_remision && tipoFilter.includes(r.tipo_remision)
      );
    }
    if (codigoProductoFilter.length > 0) {
      filtered = filtered.filter(r =>
        r.recipe?.recipe_code && codigoProductoFilter.includes(r.recipe.recipe_code)
      );
    }

    return filtered;
  }, [remisionesData, clientFilter, searchTerm, resistanceFilter, efectivoFiscalFilter, tipoFilter, codigoProductoFilter, salesData]);

  const virtualVacioDeOllaRemisiones = useMemo(() => {
    const shouldIncludeVacioDeOlla =
      tipoFilter.length === 0 ||
      tipoFilter.includes('VACÍO DE OLLA');

    if (!shouldIncludeVacioDeOlla) return [];

    if (codigoProductoFilter.length > 0 && !codigoProductoFilter.includes('SER001')) {
      return [];
    }

    return SalesDataProcessor.createVirtualVacioDeOllaRemisiones(
      salesData,
      remisionesData,
      clientFilter,
      searchTerm,
      tipoFilter,
      efectivoFiscalFilter
    );
  }, [salesData, remisionesData, clientFilter, searchTerm, tipoFilter, efectivoFiscalFilter, codigoProductoFilter]);

  const filteredRemisionesWithVacioDeOlla = useMemo(() =>
    [...filteredRemisiones, ...virtualVacioDeOllaRemisiones],
    [filteredRemisiones, virtualVacioDeOllaRemisiones]
  );

  useEffect(() => {
    if (filteredRemisionesWithVacioDeOlla.length > 0 && (!orderItems || orderItems.length === 0)) {
      return;
    }

    const metrics = SalesDataProcessor.calculateSummaryMetrics(
      filteredRemisionesWithVacioDeOlla,
      salesData,
      clientFilter,
      orderItems || [],
      pricingMap
    );

    if (filteredRemisionesWithVacioDeOlla.length > 0 || metrics.totalAmount > 0 || metrics.totalVolume > 0) {
      setSummaryMetrics(metrics);
    }
  }, [filteredRemisionesWithVacioDeOlla, salesData, clientFilter, orderItems, pricingMap]);

  useEffect(() => {
    const concreteRemisiones = filteredRemisionesWithVacioDeOlla.filter(r =>
      r.tipo_remision === 'CONCRETO' ||
      (r.isVirtualVacioDeOlla && r.tipo_remision === 'VACÍO DE OLLA')
    );
    setConcreteByRecipe(SalesDataProcessor.calculateConcreteByRecipe(concreteRemisiones));
  }, [filteredRemisionesWithVacioDeOlla]);

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
    weightedEmptyTruckPriceWithVAT: 0,
    additionalAmount: 0,
  };

  const dateRangeText = useMemo(() => SalesDataProcessor.getDateRangeText(startDate, endDate), [startDate, endDate]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) setStartDate(range.from);
    if (range?.to) setEndDate(range.to);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reporte de Ventas Mensual</CardTitle>
          <p className="text-sm text-muted-foreground">{dateRangeText}</p>
        </CardHeader>
        <CardContent>
          <SalesFilters
            currentPlant={currentPlant}
            availablePlants={availablePlants}
            businessUnits={businessUnits}
            selectedPlantIds={selectedPlantIds}
            onPlantsChange={() => { /* Alcance fijado por planta actual del contexto */ }}
            startDate={startDate}
            endDate={endDate}
            clientFilter={clientFilter}
            searchTerm={searchTerm}
            clients={clients}
            onDateRangeChange={handleDateRangeChange}
            onClientFilterChange={setClientFilter}
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

          <SalesVATIndicators
            includeVAT={includeVAT}
            currentPlant={currentPlant}
            clientFilter={clientFilter}
            clients={clients}
            filteredRemisionesWithVacioDeOlla={filteredRemisionesWithVacioDeOlla}
            summaryMetrics={currentSummaryMetrics}
          />

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
