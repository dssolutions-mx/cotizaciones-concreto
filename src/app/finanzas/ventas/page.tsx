'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { startOfMonth, endOfMonth, format, isValid, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { formatCurrency } from '@/lib/utils';
import {
  formatNumberWithUnits,
  getLast6Months,
  VAT_RATE
} from '@/lib/sales-utils';
import dynamic from 'next/dynamic';
import { DateRange } from "react-day-picker";
import { ApexOptions } from 'apexcharts';
import { Download, Info } from "lucide-react";
import { usePlantContext } from '@/contexts/PlantContext';

// Import modular components
import { SalesFilters } from '@/components/finanzas/SalesFilters';
import { SalesStatisticsCards } from '@/components/finanzas/SalesStatisticsCards';
import { SalesDataTable } from '@/components/finanzas/SalesDataTable';
import { SalesCharts } from '@/components/finanzas/SalesCharts';
import { SalesVATIndicators, SalesInfoGuide } from '@/components/finanzas/SalesVATIndicators';

// Import utilities
import { exportSalesToExcel } from '@/utils/salesExport';
import { SalesDataProcessor, SummaryMetrics, ConcreteByRecipe } from '@/utils/salesDataProcessor';

// Import chart configurations
import {
  getCashInvoiceChartOptions,
  getProductCodeChartOptions,
  getClientChartOptions,
  getSalesTrendChartOptions,
  getActiveClientsChartOptions,
  getPaymentPerformanceChartOptions,
  getOutstandingAmountsChartOptions
} from '@/configs/chartConfigs';

// Import hooks
import { useSalesData, useHistoricalSalesData } from '@/hooks/useSalesData';

// Import quality service
import { ClientQualityService } from '@/services/clientQualityService';

// Dynamically import ApexCharts with SSR disabled
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function VentasDashboard() {
  const { currentPlant } = usePlantContext();
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [layoutType, setLayoutType] = useState<'current' | 'powerbi'>('powerbi');

  // PowerBI Filters
  const [resistanceFilter, setResistanceFilter] = useState<string>('all');
  const [efectivoFiscalFilter, setEfectivoFiscalFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [codigoProductoFilter, setCodigoProductoFilter] = useState<string>('all');
  const [includeVAT, setIncludeVAT] = useState<boolean>(false);

  // Processed data state
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics | null>(null);
  const [concreteByRecipe, setConcreteByRecipe] = useState<ConcreteByRecipe>({});

  // Quality data state for guarantee age
  const [guaranteeAgeData, setGuaranteeAgeData] = useState<{
    averageGuaranteeAge: number;
    totalRecipes: number;
    ageDistribution: { [key: string]: number };
  } | null>(null);

  // Use custom hook for data fetching
  const {
    salesData,
    remisionesData,
    clients,
    resistances,
    tipos,
    productCodes,
    loading,
    error,
    orderItems, // Add order items for sophisticated price matching
    streaming,
    progress
  } = useSalesData({
    startDate,
    endDate,
    currentPlant
  });

  // Use historical data hook for trend analysis (independent of date filters)
  const {
    historicalData,
    historicalRemisiones,
    loading: historicalLoading,
    error: historicalError
  } = useHistoricalSalesData(currentPlant);
  
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
  
  // Calculate summary metrics using the utility with sophisticated price matching
  useMemo(() => {
    const metrics = SalesDataProcessor.calculateSummaryMetrics(filteredRemisiones, salesData, clientFilter, orderItems);
    setSummaryMetrics(metrics);
  }, [filteredRemisiones, salesData, clientFilter, orderItems]);

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

  // --- Data for Power BI Charts ---
  const cashInvoiceData = useMemo(() => [
    { name: 'Efectivo', value: includeVAT ? currentSummaryMetrics.cashAmountWithVAT : currentSummaryMetrics.cashAmount },
    { name: 'Fiscal', value: includeVAT ? currentSummaryMetrics.invoiceAmountWithVAT : currentSummaryMetrics.invoiceAmount },
  ], [currentSummaryMetrics, includeVAT]);

  // Enhanced product code data with VAT support - shows amounts instead of just volume
  const productCodeAmountData = useMemo(() => {
    const grouped = filteredRemisiones.reduce((acc, r) => {
      const recipeCode = r.recipe?.recipe_code || 'N/A';
      if (r.tipo_remision !== 'BOMBEO' && recipeCode !== 'SER001') { // Only concrete
        const volume = r.volumen_fabricado || 0;
        const order = salesData.find(o => o.id === r.order_id);
        const orderItems = order?.items || [];
        
        // Find the order item for this remision
        const orderItem = orderItems.find((item: any) => 
          item.product_type === recipeCode || 
          (item.recipe_id && item.recipe_id.toString() === recipeCode)
        );
        
        const price = orderItem?.unit_price || 0;
        let amount = price * volume;
        
        // Apply VAT if enabled and order requires invoice
        if (includeVAT && order?.requires_invoice) {
          amount *= (1 + VAT_RATE);
        }
        
        if (!acc[recipeCode]) {
          acc[recipeCode] = { volume: 0, amount: 0 };
        }
        acc[recipeCode].volume += volume;
        acc[recipeCode].amount += amount;
      }
      return acc;
    }, {} as Record<string, { volume: number; amount: number }>);

    return Object.entries(grouped)
      .map(([name, data]) => ({ 
        name, 
        volume: (data as { volume: number; amount: number }).volume, 
        amount: (data as { volume: number; amount: number }).amount 
      }))
      .sort((a, b) => b.amount - a.amount); // Sort by amount instead of volume
  }, [filteredRemisiones, salesData, includeVAT]);

  const productCodeVolumeData = useMemo(() => {
    const grouped = filteredRemisiones.reduce((acc, r) => {
      const recipeCode = r.recipe?.recipe_code || 'N/A';
      if (r.tipo_remision !== 'BOMBEO' && recipeCode !== 'SER001') { // Only concrete
        acc[recipeCode] = (acc[recipeCode] || 0) + (r.volumen_fabricado || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    // Explicitly type the entries before mapping
    const entries: [string, number][] = Object.entries(grouped);

    return entries
      .map(([name, value]) => ({ name, volume: value }))
      .sort((a, b) => b.volume - a.volume); // Sort descending by volume
  }, [filteredRemisiones]);

  const clientVolumeData = useMemo(() => {
     const clientSummary = filteredRemisiones.reduce((acc: Record<string, { clientName: string; volume: number }>, remision) => {
        const clientId = remision.order?.client_id || 'unknown';
        const clientName = remision.order.clients ?
          (typeof remision.order.clients === 'object' ?
            (remision.order.clients as any).business_name || 'Desconocido' : 'Desconocido')
          : 'Desconocido';

        if (!acc[clientId]) {
          acc[clientId] = { clientName, volume: 0 };
        }

        const volume = remision.volumen_fabricado || 0;
        acc[clientId].volume += volume;
        return acc;
      }, {} as Record<string, { clientName: string; volume: number }>);

      // Explicitly type the array before sorting
      const clientValues: { clientName: string; volume: number }[] = Object.values(clientSummary);
      const mappedData: { name: string; value: number }[] = clientValues.map(summary => ({ name: summary.clientName, value: summary.volume }));

      return mappedData.sort((a, b) => b.value - a.value);
  }, [filteredRemisiones, salesData]);

  // Enhanced client data with VAT support - shows amounts instead of just volume
  const clientAmountData = useMemo(() => {
    const clientSummary = filteredRemisiones.reduce((acc: Record<string, { clientName: string; volume: number; amount: number }>, remision) => {
      const clientId = remision.order?.client_id || 'unknown';
      const clientName = remision.order.clients ?
        (typeof remision.order.clients === 'object' ?
          (remision.order.clients as any).business_name || 'Desconocido' : 'Desconocido')
        : 'Desconocido';

      if (!acc[clientId]) {
        acc[clientId] = { clientName, volume: 0, amount: 0 };
      }

      const volume = remision.volumen_fabricado || 0;
      const order = salesData.find(o => o.id === remision.order_id);
      const orderItems = order?.items || [];
      const recipeCode = remision.recipe?.recipe_code;
      
      // Find the right order item based on product type
      const orderItem = orderItems.find((item: any) => {
        if (remision.tipo_remision === 'BOMBEO' && item.has_pump_service) {
          return true;
        }
        return item.product_type === recipeCode || 
          (item.recipe_id && item.recipe_id.toString() === recipeCode);
      });
      
      let price = 0;
      if (orderItem) {
        if (remision.tipo_remision === 'BOMBEO') {
          price = orderItem.pump_price || 0;
        } else {
          price = orderItem.unit_price || 0;
        }
      }
      
      let amount = price * volume;
      
      // Apply VAT if enabled and order requires invoice
      if (includeVAT && order?.requires_invoice) {
        amount *= (1 + VAT_RATE);
      }
      
      acc[clientId].volume += volume;
      acc[clientId].amount += amount;
      return acc;
    }, {} as Record<string, { clientName: string; volume: number; amount: number }>);

    return Object.values(clientSummary)
      .map(summary => ({ 
        name: summary.clientName, 
        value: summary.amount, // Use amount instead of volume for better business insight
        volume: summary.volume 
      }))
      .sort((a, b) => b.value - a.value); // Sort by amount
  }, [filteredRemisiones, salesData, includeVAT]);

  // Chart Options
  const cashInvoiceChartOptions = useMemo(() => getCashInvoiceChartOptions(), []);
  const productCodeChartOptions = useMemo(() =>
    getProductCodeChartOptions(includeVAT, productCodeAmountData, productCodeVolumeData), [includeVAT, productCodeAmountData, productCodeVolumeData]);
  const clientChartOptions = useMemo(() =>
    getClientChartOptions(includeVAT, clientAmountData, clientVolumeData), [includeVAT, clientAmountData, clientVolumeData]);
  const salesTrendChartOptions = useMemo(() => getSalesTrendChartOptions(includeVAT), [includeVAT]);
  const activeClientsChartOptions = useMemo(() => getActiveClientsChartOptions(), []);
  const paymentPerformanceChartOptions = useMemo(() => getPaymentPerformanceChartOptions(), []);
  const outstandingAmountsChartOptions = useMemo(() => getOutstandingAmountsChartOptions(), []);

  // Chart Series Data
  const cashInvoiceChartSeries = useMemo(() =>
    [
      includeVAT ? currentSummaryMetrics.cashAmountWithVAT : currentSummaryMetrics.cashAmount,
      includeVAT ? currentSummaryMetrics.invoiceAmountWithVAT : currentSummaryMetrics.invoiceAmount
    ], [currentSummaryMetrics, includeVAT]);

  const productCodeChartSeries = useMemo(() => [{
    name: includeVAT ? 'Monto' : 'Volumen',
    data: includeVAT ?
      productCodeAmountData.slice(0, 8).map(item => item.amount) :
      productCodeVolumeData.slice(0, 8).map(item => item.volume)
  }], [productCodeAmountData, productCodeVolumeData, includeVAT]);

  const clientChartSeries = useMemo(() => {
    const dataToUse = includeVAT ? clientAmountData : clientVolumeData;
    return dataToUse.slice(0, 6).map(item => item.value).concat(
      dataToUse.length > 6 
        ? [dataToUse.slice(6).reduce((sum, item) => sum + item.value, 0)] 
        : []
    );
  }, [clientAmountData, clientVolumeData, includeVAT]);

  const clientVolumeSeries = useMemo(() => {
    // Limit to top 5 clients, and combine the rest as "Others"
    const chartData = includeVAT ? [...clientAmountData] : [...clientVolumeData];
    let series: number[] = [];
    
    if (chartData.length > 5) {
      const top5 = chartData.slice(0, 5);
      const others = chartData.slice(5).reduce((sum, item) => sum + item.value, 0);
      
      series = top5.map(item => item.value);
      
      if (others > 0) {
        series.push(others);
      }
    } else {
      series = chartData.map(item => item.value);
    }
    
    return series;
  }, [clientVolumeData, clientAmountData, includeVAT]);

  // Payment performance series for PowerBI charts
  const paymentPerformanceChartSeries = useMemo(() => [85], []); // Mock data - would need actual calculation
    
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

  // Streaming progress percentage for progressive loading
  const streamingPercent = useMemo(() => {
    if (!progress || !progress.total || progress.total === 0) return 0;
    const pct = Math.round((progress.processed / progress.total) * 100);
    return isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  }, [progress]);

  // Load guarantee age data
  useEffect(() => {
    const loadGuaranteeAgeData = async () => {
      if (startDate && endDate) {
        try {
          const fromDateStr = format(startDate, 'yyyy-MM-dd');
          const toDateStr = format(endDate, 'yyyy-MM-dd');

          const guaranteeAgeResult = await ClientQualityService.getAverageGuaranteeAge(
            fromDateStr,
            toDateStr,
            currentPlant?.id
          );

          setGuaranteeAgeData(guaranteeAgeResult);
        } catch (error) {
          console.error('Error loading guarantee age data:', error);
          setGuaranteeAgeData({
            averageGuaranteeAge: 0,
            totalRecipes: 0,
            ageDistribution: {}
          });
        }
      }
    };

    loadGuaranteeAgeData();
  }, [startDate, endDate, currentPlant?.id]);

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
        <Label htmlFor="layout-toggle">Vista Actual</Label>
        <Switch
          id="layout-toggle"
          checked={layoutType === 'powerbi'}
          onCheckedChange={(checked) => setLayoutType(checked ? 'powerbi' : 'current')}
        />
        <Label htmlFor="layout-toggle">Vista PowerBI</Label>
      </div>

      {layoutType === 'current' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Reporte de Ventas Mensual</CardTitle>
          <p className="text-sm text-muted-foreground">{dateRangeText}</p>
            </CardHeader>
            <CardContent>
          {/* Sales Filters Component - Only in current mode */}
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

          {/* Data Table - Only show in current layout */}
          {layoutType === 'current' && (
            <SalesDataTable
              loading={false}
              filteredRemisionesWithVacioDeOlla={filteredRemisionesWithVacioDeOlla}
              filteredRemisiones={filteredRemisiones}
              salesData={salesData}
              summaryMetrics={currentSummaryMetrics}
              includeVAT={includeVAT}
              onExportToExcel={exportToExcel}
            />
                        )}
                      </CardContent>
                    </Card>
      )}

      {layoutType === 'powerbi' && (
        <>
          <Card className="mb-6">
             <CardHeader className='pb-2'>
                <div className='flex justify-between items-center'>
                 <CardTitle className="text-xl font-semibold">REPORTE DE VENTAS MENSUAL</CardTitle>
                 <span className='text-sm text-muted-foreground'>
                    {format(new Date(), 'dd-MMM-yy hh:mm a', { locale: es })} {/* Adjust date format if needed */}
                 </span>
                </div>
             </CardHeader>
            <CardContent>
                {/* Sales Filters - Also visible in PowerBI view */}
                <div className="mb-4">
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
                </div>
                {streaming && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-100 border rounded h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-2"
                        style={{ width: `${streamingPercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 text-right">
                      Cargando datos… {streamingPercent}%
                    </div>
                  </div>
                )}
                 {/* Top Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Total de Ventas */}
                    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-center text-2xl font-bold text-slate-800">
                                      {includeVAT ? formatCurrency(currentSummaryMetrics.totalAmountWithVAT) : formatCurrency(currentSummaryMetrics.totalAmount)}
                         </CardTitle>
                        <CardDescription className='text-center text-xs font-medium text-slate-500'>
                            Total de ventas {includeVAT ? '(Con IVA)' : '(Subtotal)'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='p-2'></CardContent>
                    </Card>

                    {/* Volumen Total (Incluyendo todo) */}
                    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardHeader className="p-4 pb-2">
                         <CardTitle className="text-center text-2xl font-bold text-blue-800">
                                       {(currentSummaryMetrics.totalVolume + currentSummaryMetrics.emptyTruckVolume).toFixed(1)}
                         </CardTitle>
                        <CardDescription className='text-center text-xs font-medium text-blue-600 mb-2'>
                            VOLUMEN TOTAL (m³)
                        </CardDescription>
                        <div className="flex justify-center gap-2 text-xs">
                            <span className="text-blue-700">
                                🏗️ Concreto + Bombeo + Vacio de Olla
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className='p-2 pt-0'>
                        <div className="text-center text-xs text-blue-600">
                            Producción + Servicios ({currentSummaryMetrics.totalVolume.toFixed(1)}m³ + {currentSummaryMetrics.emptyTruckVolume} cargas)
                        </div>
                    </CardContent>
                    </Card>

                     {/* Edad Promedio de Garantía */}
                    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-purple-50 to-indigo-100">
                    <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-center text-2xl font-bold text-purple-800">
                                       {guaranteeAgeData?.averageGuaranteeAge.toFixed(1) || '0.0'}
                            </CardTitle>
                        <CardDescription className='text-center text-xs font-medium text-purple-600 mb-2'>
                            EDAD DE GARANTÍA
                            </CardDescription>
                        <div className="flex justify-center gap-2 text-xs">
                            <span className="text-purple-700">
                                📋 {guaranteeAgeData?.totalRecipes || 0} fórmulas
                            </span>
                        </div>
                        </CardHeader>
                    <CardContent className='p-2 pt-0'>
                            <div className="text-center text-xs text-purple-600">
                            Promedio de edad de garantía (días)
                            </div>
                        </CardContent>
                    </Card>
                </div>

                 {/* Product Breakdown Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Concrete */}
                    <Card className="overflow-hidden border-0 shadow-md">
                        <CardHeader className="p-3 pb-1 bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                            <CardTitle className="text-sm font-semibold text-blue-700">CONCRETO PREMEZCLADO</CardTitle>
                        </CardHeader>
                         <CardContent className='p-3'>
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <div className="text-2xl font-bold text-slate-800">
                                                   {currentSummaryMetrics.concreteVolume.toFixed(1)}
                                     </div>
                                    <p className="text-xs text-slate-500 font-medium">Volumen (m³)</p>
                                </div>
                                 <div>
                                     <div className="text-2xl font-bold text-slate-800">
                                                   ${includeVAT ? currentSummaryMetrics.weightedConcretePriceWithVAT.toFixed(2) : currentSummaryMetrics.weightedConcretePrice.toFixed(2)}
                                     </div>
                                    <p className="text-xs text-slate-500 font-medium text-right">
                                        PRECIO PONDERADO {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
                              {Object.entries(concreteByRecipe)
                                .sort(([, a], [, b]) => b.volume - a.volume)
                                .map(([recipe, data], index) => (
                                  <Badge key={`ventas-recipe-${index}-${recipe}`} variant="outline" className="bg-blue-50 text-xs">
                                    {recipe}: {data.volume.toFixed(1)} m³
                                  </Badge>
                                ))}
                            </div>
                        </CardContent>
                     </Card>
                     {/* Pumping */}
                    <Card className="overflow-hidden border-0 shadow-md">
                        <CardHeader className="p-3 pb-1 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b">
                            <CardTitle className="text-sm font-semibold text-emerald-700">SERVICIO DE BOMBEO</CardTitle>
                        </CardHeader>
                        <CardContent className='p-3 flex justify-between items-start'>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                              {currentSummaryMetrics.pumpVolume.toFixed(1)}
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Volumen (m³)</p>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                              ${includeVAT ? currentSummaryMetrics.weightedPumpPriceWithVAT.toFixed(2) : currentSummaryMetrics.weightedPumpPrice.toFixed(2)}
                                </div>
                                <p className="text-xs text-slate-500 font-medium text-right">
                                    PRECIO PONDERADO {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                </p>
                            </div>
                         </CardContent>
                    </Card>
                     {/* Empty Truck */}
                    <Card className="overflow-hidden border-0 shadow-md">
                        <CardHeader className="p-3 pb-1 bg-gradient-to-r from-amber-50 to-amber-100 border-b">
                            <CardTitle className="text-sm font-semibold text-amber-700">VACIO DE OLLA</CardTitle>
                        </CardHeader>
                        <CardContent className='p-3 flex justify-between items-start'>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                               {currentSummaryMetrics.emptyTruckVolume.toFixed(1)}
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Volumen (m³)</p>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                               ${includeVAT ? currentSummaryMetrics.weightedEmptyTruckPriceWithVAT.toFixed(2) : currentSummaryMetrics.weightedEmptyTruckPrice.toFixed(2)}
                                </div>
                                <p className="text-xs text-slate-500 font-medium text-right">
                                    PRECIO PONDERADO {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                </p>
                            </div>
                         </CardContent>
                     </Card>
                 </div>

                 {/* Export Button for PowerBI Layout */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <span>
                      {includeVAT ? 
                        '💡 Mostrando montos con IVA (16%) aplicado a órdenes fiscales' : 
                        '💡 Mostrando montos sin IVA (solo subtotales)'
                      }
                    </span>
                    {includeVAT && (
                      <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                        IVA ACTIVO
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                Efectivo: {formatCurrency(includeVAT ? currentSummaryMetrics.cashAmountWithVAT : currentSummaryMetrics.cashAmount)}
                    </span>
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                                Fiscal: {formatCurrency(includeVAT ? currentSummaryMetrics.invoiceAmountWithVAT : currentSummaryMetrics.invoiceAmount)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium">
                      📍 Planta: {currentPlant?.name || 'Todas'}
                    </span>
                    {clientFilter !== 'all' && (
                      <span className="text-xs">
                        👤 Cliente: {clients.find(c => c.id === clientFilter)?.name || 'N/A'}
                      </span>
                    )}
                    <span className="text-xs">
                      📊 {filteredRemisionesWithVacioDeOlla.length} elementos
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={exportToExcel} 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={filteredRemisionesWithVacioDeOlla.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </Button>
              </div>

                        {/* Enhanced Charts Section with Professional Layout */}
              {loading ? (
                <div className="space-y-12 mt-12">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {[...Array(2)].map((_, i) => (
                      <Card key={i} className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                        <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                          <div className="h-6 bg-gray-200 rounded animate-pulse" />
                        </CardHeader>
                        <CardContent className="p-6 h-96">
                          <div className="h-full bg-gray-100 rounded animate-pulse" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {[...Array(3)].map((_, i) => (
                      <Card key={i} className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                        <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                          <div className="h-6 bg-gray-200 rounded animate-pulse" />
                        </CardHeader>
                        <CardContent className="p-6 h-80">
                          <div className="h-full bg-gray-100 rounded animate-pulse" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
              <div className="space-y-12 mt-12">
                {/* Row 1: Key Performance Indicators - Full Width Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Payment Distribution - Professional Donut */}
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500" />
                    <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <CardTitle className="text-lg font-bold text-gray-800 flex items-center justify-between">
                        <span>EFECTIVO/FISCAL</span>
                        {includeVAT && (
                          <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-200">
                            Con IVA
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-96">
                      {typeof window !== 'undefined' && cashInvoiceChartSeries.length > 0 ? (
                        <div className="h-full">
                          <Chart
                            options={{
                              ...cashInvoiceChartOptions,
                              colors: ['#10B981', '#3B82F6'],
                              chart: {
                                ...cashInvoiceChartOptions.chart,
                                background: 'transparent',
                                animations: { enabled: true, speed: 800 }
                              }
                            }}
                            series={cashInvoiceChartSeries}
                            type="donut"
                            height="100%"
                          />
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <div className="text-lg font-semibold mb-2">No hay datos de facturación</div>
                            <div className="text-sm">Selecciona un período con datos de ventas</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Product Performance - Enhanced Bar Chart */}
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                    <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <CardTitle className="text-lg font-bold text-gray-800">RENDIMIENTO POR PRODUCTO</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-96">
                      {typeof window !== 'undefined' && productCodeChartSeries.length > 0 && productCodeChartSeries[0].data.length > 0 ? (
                        <div className="h-full">
                          <Chart 
                            options={productCodeChartOptions}
                            series={productCodeChartSeries}
                            type="bar"
                            height="100%"
                          />
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <div className="text-lg font-semibold mb-2">No hay datos de productos</div>
                            <div className="text-sm">Selecciona un período con datos de ventas</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Row 2: Client Distribution - Full Width */}
                <div className="grid grid-cols-1 gap-8">
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
                    <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <CardTitle className="text-lg font-bold text-gray-800">DISTRIBUCIÓN DE CLIENTES</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-96">
                      {typeof window !== 'undefined' && clientChartSeries.length > 0 ? (
                        <div className="h-full">
                          <Chart
                            options={{
                              ...clientChartOptions,
                              legend: {
                                ...clientChartOptions.legend,
                                position: 'bottom',
                                fontSize: '13px',
                                          formatter: (seriesName: string, opts: any) => {
                                  const value = opts.w.globals.series[opts.seriesIndex];
                                  const formattedValue = includeVAT ? 
                                    formatCurrency(value) : 
                                    `${formatNumberWithUnits(value)} m³`;
                                  return `${seriesName.length > 25 ? seriesName.substring(0, 25) + '...' : seriesName}: ${formattedValue}`;
                                }
                              }
                            }}
                            series={clientChartSeries}
                            type="pie"
                            height="100%"
                          />
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <div className="text-lg font-semibold mb-2">No hay datos de clientes</div>
                            <div className="text-sm">Selecciona un período con datos de ventas</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Row 3: Historical Trends - Full Width */}
                <div className="grid grid-cols-1 gap-8">
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500" />
                    <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <CardTitle className="text-lg font-bold text-gray-800">TENDENCIA DE VENTAS HISTÓRICA</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-96">
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                                    <div className="text-lg font-semibold mb-2">Datos históricos próximamente</div>
                                    <div className="text-sm">Funcionalidad en desarrollo</div>
                          </div>
                        </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Row 4: Commercial Performance KPIs */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Active Clients Monthly */}
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
                    <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <CardTitle className="text-lg font-bold text-gray-800">CLIENTES ACTIVOS MENSUALES</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-80">
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                                    <div className="text-lg font-semibold mb-2">Métricas comerciales</div>
                                    <div className="text-sm">Próximamente disponible</div>
                          </div>
                        </div>
                    </CardContent>
                  </Card>

                  {/* Payment Performance */}
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
                    <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <CardTitle className="text-lg font-bold text-gray-800">RENDIMIENTO DE COBRO</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-80">
                      {typeof window !== 'undefined' && paymentPerformanceChartSeries.length > 0 ? (
                        <div className="h-full">
                          <Chart
                            options={paymentPerformanceChartOptions}
                            series={paymentPerformanceChartSeries}
                            type="radialBar"
                            height="100%"
                          />
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <div className="text-lg font-semibold mb-2">No hay datos de cobro</div>
                            <div className="text-sm">Selecciona un período con datos de ventas</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Outstanding Amounts */}
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-pink-500" />
                    <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <CardTitle className="text-lg font-bold text-gray-800">MONTOS PENDIENTES</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-80">
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                                    <div className="text-lg font-semibold mb-2">Análisis pendiente</div>
                                    <div className="text-sm">Funcionalidad en desarrollo</div>
                          </div>
                        </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              )}

               {/* Información Contextual y Guía de Interpretación */}
               <Card className="mt-8 border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                 <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                   <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                     <Info className="h-5 w-5 text-blue-600" />
                     Guía de Interpretación del Dashboard
                   </CardTitle>
                   <CardDescription>
                     Información para entender las métricas, gráficos y análisis comercial
                   </CardDescription>
                 </CardHeader>
                 <CardContent className="p-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-4">
                       <div>
                         <h4 className="font-semibold text-gray-800 mb-2">📊 Métricas de Ventas</h4>
                         <ul className="text-sm text-gray-600 space-y-1">
                           <li><strong>Total de Ventas:</strong> Monto total facturado en el período seleccionado</li>
                           <li><strong>Volumen Total:</strong> Cantidad total de concreto vendido en m³</li>
                           <li><strong>Precio Ponderado:</strong> Promedio ponderado por volumen de cada producto</li>
                           <li><strong>Resistencia Ponderada:</strong> Promedio ponderado de resistencias por volumen</li>
                         </ul>
                       </div>
                       <div>
                         <h4 className="font-semibold text-gray-800 mb-2">💰 Análisis de Facturación</h4>
                         <ul className="text-sm text-gray-600 space-y-1">
                           <li><strong>Efectivo:</strong> Órdenes pagadas al contado (sin IVA)</li>
                           <li><strong>Fiscal:</strong> Órdenes con factura (incluyen 16% IVA)</li>
                           <li><strong>Toggle IVA:</strong> Cambia entre mostrar montos con o sin impuestos</li>
                         </ul>
                       </div>
                     </div>
                     <div className="space-y-4">
                       <div>
                         <h4 className="font-semibold text-gray-800 mb-2">📈 Análisis Histórico</h4>
                         <ul className="text-sm text-gray-600 space-y-1">
                           <li><strong>Tendencia de Ventas:</strong> Evolución mensual de ventas y volumen</li>
                           <li><strong>Clientes Activos:</strong> Número de clientes únicos por mes</li>
                           <li><strong>Rendimiento de Cobro:</strong> Porcentaje de facturación cobrada</li>
                           <li><strong>Montos Pendientes:</strong> Cantidades por cobrar por mes</li>
                         </ul>
                       </div>
                       <div>
                         <h4 className="font-semibold text-gray-800 mb-2">🎯 KPIs Comerciales</h4>
                         <ul className="text-sm text-gray-600 space-y-1">
                           <li><strong>Tasa de Cobro:</strong> Eficiencia en la recuperación de facturación</li>
                           <li><strong>Clientes Activos:</strong> Retención y crecimiento de cartera</li>
                           <li><strong>Distribución por Producto:</strong> Performance de diferentes tipos de concreto</li>
                           <li><strong>Análisis por Cliente:</strong> Concentración de ventas por cliente</li>
                         </ul>
                       </div>
                     </div>
                   </div>
                   
                   <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                     <h5 className="font-semibold text-blue-800 mb-2">💡 Insights para la Gestión</h5>
                     <div className="text-sm text-blue-700 space-y-1">
                       <p><strong>• Eficiencia Operativa:</strong> Monitoree la tendencia de ventas para identificar patrones estacionales</p>
                       <p><strong>• Gestión de Cartera:</strong> Analice la concentración de clientes para diversificar riesgos</p>
                       <p><strong>• Performance Comercial:</strong> Evalúe la tasa de cobro para optimizar políticas de crédito</p>
                       <p><strong>• Mix de Productos:</strong> Identifique los productos más rentables para enfocar esfuerzos</p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
              </CardContent>
            </Card>
        </>
      )}
    </div>
  );
}
