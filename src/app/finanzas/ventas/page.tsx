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
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

// Import modular components
import { SalesFilters } from '@/components/finanzas/SalesFilters';
import { SalesStatisticsCards } from '@/components/finanzas/SalesStatisticsCards';
import { SalesDataTable } from '@/components/finanzas/SalesDataTable';
import { SalesCharts } from '@/components/finanzas/SalesCharts';
import { SalesVATIndicators, SalesInfoGuide } from '@/components/finanzas/SalesVATIndicators';

// Import utilities
import { exportSalesToExcel } from '@/utils/salesExport';
import { SalesDataProcessor, SummaryMetrics, ConcreteByRecipe, findProductPrice } from '@/utils/salesDataProcessor';

// Import chart configurations
import {
  getCashInvoiceChartOptions,
  getProductCodeChartOptions,
  getClientChartOptions,
  getSalesTrendChartOptions,
  getActiveClientsChartOptions,
  getOutstandingAmountsChartOptions
} from '@/configs/chartConfigs';

// Import hooks
import { useSalesData, useHistoricalSalesData } from '@/hooks/useSalesData';

// Import quality service
import { useProgressiveGuaranteeAge } from '@/hooks/useProgressiveGuaranteeAge';

// Dynamically import ApexCharts with SSR disabled
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Filter cache key
const FILTER_CACHE_KEY = 'ventas_dashboard_filters';

// Helper to load cached filters with migration support
const loadCachedFilters = () => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(FILTER_CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    
    // Migrate old tipoFilter from string to array
    if (parsed && typeof parsed.tipoFilter === 'string') {
      if (parsed.tipoFilter === 'all' || !parsed.tipoFilter) {
        parsed.tipoFilter = [];
      } else {
        parsed.tipoFilter = [parsed.tipoFilter];
      }
    }
    
    // Ensure tipoFilter is always an array
    if (parsed && !Array.isArray(parsed.tipoFilter)) {
      parsed.tipoFilter = [];
    }
    
    // Ensure codigoProductoFilter is always an array
    if (parsed && !Array.isArray(parsed.codigoProductoFilter)) {
      parsed.codigoProductoFilter = [];
    }
    
    return parsed;
  } catch (e) {
    console.error('Failed to load cached filters:', e);
    return null;
  }
};

// Helper to save filters to cache
const saveCachedFilters = (filters: any) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FILTER_CACHE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error('Failed to save filters:', e);
  }
};

export default function VentasDashboard() {
  const { currentPlant, availablePlants } = usePlantContext();
  
  // Load cached filters on mount
  const cachedFilters = loadCachedFilters();
  
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>(cachedFilters?.clientFilter || 'all');
  const [layoutType, setLayoutType] = useState<'current' | 'powerbi'>(cachedFilters?.layoutType || 'powerbi');

  // PowerBI Filters with caching
  const [resistanceFilter, setResistanceFilter] = useState<string>(cachedFilters?.resistanceFilter || 'all');
  const [efectivoFiscalFilter, setEfectivoFiscalFilter] = useState<string>(cachedFilters?.efectivoFiscalFilter || 'all');
  const [tipoFilter, setTipoFilter] = useState<string[]>(cachedFilters?.tipoFilter || []); // Multi-select: CONCRETO, BOMBEO, VACÍO DE OLLA
  const [codigoProductoFilter, setCodigoProductoFilter] = useState<string[]>(cachedFilters?.codigoProductoFilter || []);
  const [includeVAT, setIncludeVAT] = useState<boolean>(cachedFilters?.includeVAT || false);

  // Processed data state
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics | null>(null);
  const [concreteByRecipe, setConcreteByRecipe] = useState<ConcreteByRecipe>({});

  // Quality data state for guarantee age
  const [guaranteeAgeData, setGuaranteeAgeData] = useState<{
    averageGuaranteeAge: number;
    totalRecipes: number;
    ageDistribution: { [key: string]: number };
  } | null>(null);

  // Per-plant comparative data (for table) - independent progressive loading
  const [avgGuaranteeByPlant, setAvgGuaranteeByPlant] = useState<Record<string, number>>({});
  const [plantTableData, setPlantTableData] = useState<any[]>([]);
  const [plantTableLoading, setPlantTableLoading] = useState(false);
  const [plantTableProgress, setPlantTableProgress] = useState({ processed: 0, total: 0 });
  const [plantOrderData, setPlantOrderData] = useState<any[]>([]);

  // Cache filters whenever they change
  useEffect(() => {
    const filters = {
      clientFilter,
      layoutType,
      resistanceFilter,
      efectivoFiscalFilter,
      tipoFilter,
      codigoProductoFilter,
      includeVAT
    };
    saveCachedFilters(filters);
  }, [clientFilter, layoutType, resistanceFilter, efectivoFiscalFilter, tipoFilter, codigoProductoFilter, includeVAT]);

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
      // Multi-select tipo filter (CONCRETO, BOMBEO, VACÍO DE OLLA)
      if (tipoFilter && tipoFilter.length > 0) {
        filtered = filtered.filter(r => 
          r.tipo_remision && tipoFilter.includes(r.tipo_remision)
        );
      }
      // Multi-select product code filter
      if (codigoProductoFilter && codigoProductoFilter.length > 0) {
        filtered = filtered.filter(r => 
          r.recipe?.recipe_code && codigoProductoFilter.includes(r.recipe.recipe_code)
        );
      }
    }

    return filtered;
  }, [remisionesData, clientFilter, searchTerm, layoutType, resistanceFilter, efectivoFiscalFilter, tipoFilter, codigoProductoFilter, salesData]);
  
  // Create virtual vacío de olla remisiones (BEFORE calculating metrics)
  // Simple logic: if tipo filter doesn't include "VACÍO DE OLLA", don't create them at all
  const virtualVacioDeOllaRemisiones = useMemo(() => {
    // Only create virtual remisiones if:
    // 1. No tipo filter is set (showing all), OR  
    // 2. Tipo filter includes "VACÍO DE OLLA"
    const shouldIncludeVacioDeOlla = 
      tipoFilter.length === 0 || 
      tipoFilter.includes('VACÍO DE OLLA');
    
    console.log('🔍 Should include vacío de olla?', {
      shouldInclude: shouldIncludeVacioDeOlla,
      tipoFilter,
      tipoFilterLength: tipoFilter.length
    });
    
    // If filter excludes VACÍO DE OLLA, return empty array - simple!
    if (!shouldIncludeVacioDeOlla) {
      console.log('❌ Not creating virtual remisiones - filter excludes VACÍO DE OLLA');
      return [];
    }
    
    // If product code filter is set and doesn't include SER001, don't create them
    if (layoutType === 'powerbi' && codigoProductoFilter.length > 0) {
      if (!codigoProductoFilter.includes('SER001')) {
        console.log('❌ Not creating virtual remisiones - product filter excludes SER001');
        return [];
      }
    }
    
    // Create virtual remisiones with all filters applied
    console.log('✅ Creating virtual remisiones for vacío de olla');
    const virtuals = SalesDataProcessor.createVirtualVacioDeOllaRemisiones(
      salesData,
      remisionesData,
      clientFilter,
      searchTerm,
      layoutType,
      tipoFilter,
      efectivoFiscalFilter
    );
    
    console.log('📦 Created virtual remisiones:', virtuals.length);
    return virtuals;
  }, [salesData, remisionesData, clientFilter, searchTerm, layoutType, tipoFilter, efectivoFiscalFilter, codigoProductoFilter]);

  // Combine regular and virtual remisiones
  const filteredRemisionesWithVacioDeOlla = useMemo(() =>
    [...filteredRemisiones, ...virtualVacioDeOllaRemisiones],
    [filteredRemisiones, virtualVacioDeOllaRemisiones]
  );

  // Calculate summary metrics using the utility with sophisticated price matching
  // IMPORTANT: Calculate with combined remisiones (including vacío de olla)
  useMemo(() => {
    // Debug: Check what we're passing
    const virtualCount = filteredRemisionesWithVacioDeOlla.filter(r => r.isVirtualVacioDeOlla).length;
    const regularVacioCount = filteredRemisionesWithVacioDeOlla.filter(r => r.tipo_remision === 'VACÍO DE OLLA' && !r.isVirtualVacioDeOlla).length;
    const concreteCount = filteredRemisionesWithVacioDeOlla.filter(r => r.tipo_remision === 'CONCRETO' || (!r.tipo_remision && r.recipe?.recipe_code !== 'SER001' && r.recipe?.recipe_code !== 'SER002')).length;
    
    console.log('📊 MAIN KPI - Calculating metrics with:', {
      currentPlant: currentPlant?.code || 'ALL',
      total: filteredRemisionesWithVacioDeOlla.length,
      concreteRemisiones: concreteCount,
      virtualVacio: virtualCount,
      regularVacio: regularVacioCount,
      tipoFilter: tipoFilter,
      orderItemsCount: orderItems.length,
      salesDataCount: salesData.length,
      remisionesDataCount: remisionesData.length
    });
    
    const metrics = SalesDataProcessor.calculateSummaryMetrics(filteredRemisionesWithVacioDeOlla, salesData, clientFilter, orderItems);
    
    console.log('💰 MAIN KPI - Calculated metrics:', {
      concreteVolume: metrics.concreteVolume,
      emptyTruckVolume: metrics.emptyTruckVolume,
      emptyTruckAmount: metrics.emptyTruckAmount,
      concreteAmount: metrics.concreteAmount,
      pumpAmount: metrics.pumpAmount,
      totalAmount: metrics.totalAmount
    });
    
    setSummaryMetrics(metrics);
  }, [filteredRemisionesWithVacioDeOlla, salesData, clientFilter, orderItems, tipoFilter]);

  // Calculate concrete by recipe using the utility
  useMemo(() => {
    const concreteRemisiones = filteredRemisionesWithVacioDeOlla.filter(r =>
      r.tipo_remision === 'CONCRETO' ||
      (r.isVirtualVacioDeOlla && r.tipo_remision === 'VACÍO DE OLLA')
    );
    const result = SalesDataProcessor.calculateConcreteByRecipe(concreteRemisiones);
    setConcreteByRecipe(result);
  }, [filteredRemisionesWithVacioDeOlla]);

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
    const grouped = filteredRemisionesWithVacioDeOlla.reduce((acc, r) => {
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
  }, [filteredRemisionesWithVacioDeOlla, salesData, includeVAT]);

  const productCodeVolumeData = useMemo(() => {
    const grouped = filteredRemisionesWithVacioDeOlla.reduce((acc, r) => {
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
  }, [filteredRemisionesWithVacioDeOlla]);

  const clientVolumeData = useMemo(() => {
     const clientSummary = filteredRemisionesWithVacioDeOlla.reduce((acc: Record<string, { clientName: string; volume: number }>, remision) => {
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
  }, [filteredRemisionesWithVacioDeOlla, salesData]);

  // Enhanced client data with VAT support - shows amounts instead of just volume
  const clientAmountData = useMemo(() => {
    const clientSummary = filteredRemisionesWithVacioDeOlla.reduce((acc: Record<string, { clientName: string; volume: number; amount: number }>, remision) => {
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
      const recipeCode = remision.recipe?.recipe_code;

      // Resolve price with shared logic for BOMBEo to avoid using concrete unit prices
      let price = 0;
      if (remision.tipo_remision === 'BOMBEO') {
        price = findProductPrice('SER002', remision.order_id, (remision as any).recipe?.id, order?.items || []);
      } else {
        // Keep existing behavior for non-pump items
        const orderItem = (order?.items || []).find((item: any) =>
          item.product_type === recipeCode || (item.recipe_id && item.recipe_id.toString() === recipeCode)
        );
        price = orderItem?.unit_price || 0;
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
  }, [filteredRemisionesWithVacioDeOlla, salesData, includeVAT]);

  // Chart Options
  const cashInvoiceChartOptions = useMemo(() => getCashInvoiceChartOptions(), []);
  const productCodeChartOptions = useMemo(() =>
    getProductCodeChartOptions(includeVAT, productCodeAmountData, productCodeVolumeData), [includeVAT, productCodeAmountData, productCodeVolumeData]);
  const clientChartOptions = useMemo(() =>
    getClientChartOptions(includeVAT, clientAmountData, clientVolumeData), [includeVAT, clientAmountData, clientVolumeData]);
  const salesTrendChartOptions = useMemo(() => getSalesTrendChartOptions(includeVAT), [includeVAT]);
  const activeClientsChartOptions = useMemo(() => getActiveClientsChartOptions(), []);
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

    
  // Calculate date range for display
  const dateRangeText = useMemo(() => SalesDataProcessor.getDateRangeText(startDate, endDate), [startDate, endDate]);

  // Event handlers
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) setStartDate(range.from);
    if (range?.to) setEndDate(range.to);
  };

  // Filter-aware weighted guarantee age (exclude BOMBEo and Vacío de Olla)
  const filteredWeightedGuaranteeAge = useMemo(() => {
    const relevant = filteredRemisionesWithVacioDeOlla.filter(r => r.tipo_remision !== 'BOMBEO' && r.tipo_remision !== 'VACÍO DE OLLA');
    let sum = 0;
    let vol = 0;
    for (const r of relevant) {
      const volume = Number(r?.volumen_fabricado) || 0;
      if (volume <= 0) continue;
      const rawDays = (r as any)?.recipe?.age_days;
      const rawHours = (r as any)?.recipe?.age_hours;
      const daysNum = rawDays !== undefined && rawDays !== null ? Number(rawDays) : NaN;
      const hoursNum = rawHours !== undefined && rawHours !== null ? Number(rawHours) : NaN;
      // If days is provided and finite, prefer it; otherwise, use hours/24 if finite
      const days = Number.isFinite(daysNum) && daysNum > 0
        ? daysNum
        : (Number.isFinite(hoursNum) && hoursNum > 0 ? hoursNum / 24 : 0);
      if (days > 0) {
        sum += days * volume;
        vol += volume;
      }
    }
    return vol > 0 ? sum / vol : 0;
  }, [filteredRemisionesWithVacioDeOlla]);

  const handleClientFilterChange = (value: string) => {
    setClientFilter(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleResistanceFilterChange = (value: string) => setResistanceFilter(value);
  const handleEfectivoFiscalFilterChange = (value: string) => setEfectivoFiscalFilter(value);
  const handleTipoFilterChange = (values: string[]) => setTipoFilter(values);
  const handleCodigoProductoFilterChange = (values: string[]) => setCodigoProductoFilter(values);
  const handleIncludeVATChange = (checked: boolean) => setIncludeVAT(checked);

  // Streaming progress percentage for progressive loading
  const streamingPercent = useMemo(() => {
    if (!progress || !progress.total || progress.total === 0) return 0;
    const pct = Math.round((progress.processed / progress.total) * 100);
    return isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  }, [progress]);

  // Progressive guarantee age loading
  const { data: progressiveGuarantee, streaming: gaStreaming, progress: gaProgress } = useProgressiveGuaranteeAge(
    startDate,
    endDate,
    currentPlant?.id,
    { newestFirst: true }
  );

  useEffect(() => {
    if (progressiveGuarantee) {
      setGuaranteeAgeData(progressiveGuarantee);
    }
  }, [progressiveGuarantee]);

  const gaPercent = useMemo(() => {
    if (!gaProgress || !gaProgress.total || gaProgress.total === 0) return 0;
    const pct = Math.round((gaProgress.processed / gaProgress.total) * 100);
    return isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  }, [gaProgress]);

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

  // --- Per-plant comparative calculations ---
  // Get unique plant IDs from loaded table data (ALL plants, not filtered)
  const plantIdsInData = useMemo(() => {
    const ids = new Set<string>();
    plantTableData.forEach((r: any) => {
      if (r.plant_id) ids.add(String(r.plant_id));
    });
    return Array.from(ids);
  }, [plantTableData]);

  // Compute per-plant weighted guarantee age from ALL plant data (for comparative table)
  const avgGuaranteeByPlantComputed = useMemo(() => {
    const accum: Record<string, { sum: number; vol: number }> = {};
    // Use plantTableData which has data from ALL plants
    plantTableData.forEach((r: any) => {
      if (r.tipo_remision === 'BOMBEO' || r.tipo_remision === 'VACÍO DE OLLA') return;
      const pid = r?.plant_id != null ? String(r.plant_id) : undefined;
      if (!pid) return;
      const volume = Number(r?.volumen_fabricado) || 0;
      if (volume <= 0) return;
      const rawDays = r?.recipe?.age_days;
      const rawHours = r?.recipe?.age_hours;
      const daysNum = rawDays !== undefined && rawDays !== null ? Number(rawDays) : NaN;
      const hoursNum = rawHours !== undefined && rawHours !== null ? Number(rawHours) : NaN;
      const days = Number.isFinite(daysNum) && daysNum > 0 ? daysNum : (Number.isFinite(hoursNum) && hoursNum > 0 ? hoursNum / 24 : 0);
      if (days > 0) {
        const a = accum[pid] || { sum: 0, vol: 0 };
        a.sum += days * volume;
        a.vol += volume;
        accum[pid] = a;
      }
    });
    const map: Record<string, number> = {};
    Object.entries(accum).forEach(([pid, a]) => {
      map[pid] = a.vol > 0 ? a.sum / a.vol : 0;
    });
    return map;
  }, [plantTableData]);

  const perPlantRows = useMemo(() => {
    return plantIdsInData.map((plantId) => {
      const plantInfo = availablePlants.find(p => String(p.id) === String(plantId));
      
      // Get remisiones for this plant from the loaded table data (ALL plants data)
      let rems = plantTableData.filter((r: any) => String(r.plant_id) === String(plantId));

      // CRITICAL: Apply tipo filter to remisiones (same as main KPIs)
      if (layoutType === 'powerbi' && tipoFilter && tipoFilter.length > 0) {
        rems = rems.filter((r: any) => 
          r.tipo_remision && tipoFilter.includes(r.tipo_remision)
        );
      }

      // Get unique order IDs from this plant's FILTERED remisiones
      const orderIds = Array.from(new Set(rems.map((r: any) => r.order_id).filter(Boolean)));
      
      // Get orders for this plant
      const orders = plantOrderData.filter((o: any) => orderIds.includes(o.id));

      // Extract order items for THIS PLANT ONLY (critical for correct price matching)
      const plantOrderItems = orders.flatMap(order => 
        (order.items || []).map((item: any) => ({
          ...item,
          order_id: order.id
        }))
      );

      // Create virtual vacío de olla remisiones for this plant
      // Check if we should include based on the tipo filter
      const shouldIncludeVacioDeOlla = 
        tipoFilter.length === 0 || 
        tipoFilter.includes('VACÍO DE OLLA');
      
      const virtualVacioForPlant = shouldIncludeVacioDeOlla 
        ? SalesDataProcessor.createVirtualVacioDeOllaRemisiones(
            orders,  // Orders for this plant
            rems as any,  // Remisiones for this plant
            'all',  // No client filter
            '',  // No search filter
            layoutType,
            tipoFilter,
            'all'  // No efectivo/fiscal filter for comparative table
          )
        : [];

      // Combine real and virtual remisiones
      const combinedRems = [...rems, ...virtualVacioForPlant];

      console.log(`🏭 Plant ${plantInfo?.code}:`, {
        realRemisiones: rems.length,
        virtualVacio: virtualVacioForPlant.length,
        orders: orders.length,
        total: combinedRems.length,
        plantOrderItems: plantOrderItems.length
      });

      // Calculate metrics with order items
      // Prefer hook orderItems when this row matches the currently selected plant,
      // to ensure parity with main KPI calculations; otherwise use this plant's items
      const itemsForPricing = (currentPlant && plantInfo?.code === currentPlant.code)
        ? orderItems
        : plantOrderItems;

      const metrics = SalesDataProcessor.calculateSummaryMetrics(
        combinedRems as any, 
        orders as any,
        'all',
        itemsForPricing
      );

      console.log(`💰 TABLE Plant ${plantInfo?.code} Metrics:`, {
        concreteVolume: metrics.concreteVolume,
        concreteAmount: metrics.concreteAmount,
        pumpAmount: metrics.pumpAmount,
        emptyTruckAmount: metrics.emptyTruckAmount,
        totalAmount: metrics.totalAmount,
        remisionesUsed: combinedRems.length
      });

      // Use the proven metrics from SalesDataProcessor (EXACT same as main page)
      const concreteVolume = metrics.concreteVolume || 0;
      const pumpVolume = metrics.pumpVolume || 0;
      const emptyTruckVolume = metrics.emptyTruckVolume || 0;
      const weightedResistance = metrics.weightedResistance || 0;
      
      // Separate sales amounts for each product type (subtotal - no VAT for consistency)
      const concreteVentas = metrics.concreteAmount || 0;
      const pumpVentas = metrics.pumpAmount || 0;
      const emptyTruckVentas = metrics.emptyTruckAmount || 0;
      const totalVentas = concreteVentas + pumpVentas + emptyTruckVentas;
      
      const avgGuarantee = avgGuaranteeByPlantComputed[plantId] ?? 0;

      return {
        plantId,
        plantCode: plantInfo?.code || 'N/A',
        plantName: plantInfo?.name || 'Sin nombre',
        concreteVolume,
        pumpVolume,
        emptyTruckVolume,
        weightedResistance,
        weightedGuaranteeAge: avgGuarantee,
        concreteVentas,
        pumpVentas,
        emptyTruckVentas,
        totalVentas
      };
    }).sort((a, b) => b.totalVentas - a.totalVentas); // Sort by total ventas for better business insight
  }, [plantIdsInData, plantTableData, plantOrderData, availablePlants, avgGuaranteeByPlantComputed, tipoFilter, layoutType]);

  // Remove remote service usage: using computed values from plantTableData instead

  // Progressive loading for plant comparative table using the EXACT same logic as production page
  useEffect(() => {
    const loadPlantTableDataProgressively = async () => {
      try {
        if (!startDate || !endDate || availablePlants.length === 0) {
          setPlantTableData([]);
          setPlantOrderData([]);
          setPlantTableLoading(false);
          return;
        }

        setPlantTableLoading(true);
        setPlantTableProgress({ processed: 0, total: 0 });

        const from = format(startDate, 'yyyy-MM-dd');
        const to = format(endDate, 'yyyy-MM-dd');

        // Use the EXACT same progressive approach as production page:
        // Process each plant individually to avoid query limits
        let accumulatedRemisiones: any[] = [];
        let accumulatedOrders: any[] = [];
        let processedCount = 0;
        
        // Set total to number of plants * 2 (remisiones + orders per plant)
        setPlantTableProgress({ processed: 0, total: availablePlants.length * 2 });

        for (const plant of availablePlants) {
          // Fetch remisiones for this specific plant (EXACTLY like production page)
          const { data: plantRemisiones, error: remError } = await supabase
            .from('remisiones')
            .select(`
              id,
              fecha,
              plant_id,
              order_id,
              tipo_remision,
              volumen_fabricado,
              recipe:recipes(id, recipe_code, strength_fc, age_days, age_hours)
            `)
            .eq('plant_id', plant.id)  // Filter by specific plant (like production page)
            .gte('fecha', from)
            .lte('fecha', to)
            .order('fecha', { ascending: false });

          if (remError) throw remError;

          if (plantRemisiones && plantRemisiones.length > 0) {
            accumulatedRemisiones = [...accumulatedRemisiones, ...plantRemisiones];
            setPlantTableData([...accumulatedRemisiones]);

            // Get unique order IDs from this plant's remisiones
            const orderIds = Array.from(new Set(plantRemisiones.map(r => r.order_id).filter(Boolean)));
            
            if (orderIds.length > 0) {
              // Fetch orders for these remisiones
              // IMPORTANT: Include quote_details for sophisticated price matching
              const { data: plantOrders, error: orderError } = await supabase
                .from('orders')
                .select(`
                  id,
                  order_number,
                  requires_invoice,
                  client_id,
                  clients(business_name),
                  items:order_items(
                    *,
                    quote_details (
                      final_price,
                      recipe_id
                    )
                  )
                `)
                .in('id', orderIds)
                .not('order_status', 'eq', 'CANCELLED');

              if (orderError) throw orderError;

              if (plantOrders && plantOrders.length > 0) {
                accumulatedOrders = [...accumulatedOrders, ...plantOrders];
                setPlantOrderData([...accumulatedOrders]);
              }
            }
          }

          processedCount += 2; // remisiones + orders
          setPlantTableProgress({ processed: processedCount, total: availablePlants.length * 2 });
        }

      } catch (e) {
        console.error('Error fetching plant table data:', e);
        setPlantTableData([]);
        setPlantOrderData([]);
      } finally {
        setPlantTableLoading(false);
      }
    };

    loadPlantTableDataProgressively();
  }, [startDate, endDate, availablePlants]);

  // Export per-plant table to Excel
  const exportPlantsTable = () => {
    const data = perPlantRows.map(row => ({
      'Planta': `${row.plantCode} - ${row.plantName}`,
      'Vol. Concreto (m³)': Number(row.concreteVolume.toFixed(1)),
      'Vol. Bombeo (m³)': Number(row.pumpVolume.toFixed(1)),
      'Vol. Vacío de Olla (m³)': Number(row.emptyTruckVolume.toFixed(1)),
      'Resistencia Ponderada (kg/cm²)': Number(row.weightedResistance.toFixed(1)),
      'Edad Garantía (días)': Number(row.weightedGuaranteeAge.toFixed(1)),
      'Ventas Concreto': Number(row.concreteVentas.toFixed(2)),
      'Ventas Bombeo': Number(row.pumpVentas.toFixed(2)),
      'Ventas Vacío de Olla': Number(row.emptyTruckVentas.toFixed(2)),
      'Ventas Totales': Number(row.totalVentas.toFixed(2))
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 26 }, 
      { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Comparativo_Plantas');
    const sd = startDate ? format(startDate, 'dd-MM-yyyy') : 'fecha';
    const ed = endDate ? format(endDate, 'dd-MM-yyyy') : 'fecha';
    const filename = `Comparativo_Plantas_${sd}_${ed}${includeVAT ? '_IVA' : ''}.xlsx`;
    XLSX.writeFile(wb, filename);
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
                 {/* Top Summary Cards - Professional Design */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total de Ventas */}
                    <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-6 py-5">
                        <CardTitle className="text-center text-2xl font-semibold text-gray-900 tabular-nums">
                                      {includeVAT ? formatCurrency(currentSummaryMetrics.totalAmountWithVAT) : formatCurrency(currentSummaryMetrics.totalAmount)}
                         </CardTitle>
                        <CardDescription className='text-center text-sm font-medium text-gray-600'>
                            Total de ventas {includeVAT ? '(Con IVA)' : '(Subtotal)'}
                        </CardDescription>
                    </CardHeader>
                    </Card>

                    {/* Volumen Total */}
                    <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-6 py-5">
                         <CardTitle className="text-center text-2xl font-semibold text-gray-900 tabular-nums">
                                       {(currentSummaryMetrics.totalVolume + currentSummaryMetrics.emptyTruckVolume).toFixed(1)}
                         </CardTitle>
                        <CardDescription className='text-center text-sm font-medium text-gray-600'>
                            Volumen Total (m³)
                        </CardDescription>
                        <div className="text-center text-xs text-gray-500 mt-2">
                            Concreto + Bombeo + Vacío de Olla
                        </div>
                    </CardHeader>
                    </Card>

                     {/* Edad Promedio de Garantía */}
                    <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-6 py-5">
                            <CardTitle className="text-center text-2xl font-semibold text-gray-900 tabular-nums">
                                      {(filteredWeightedGuaranteeAge || 0).toFixed(1)}
                            </CardTitle>
                        <CardDescription className='text-center text-sm font-medium text-gray-600'>
                            Edad de Garantía (días)
                            </CardDescription>
                        <div className="text-center text-xs text-gray-500 mt-2">
                            {/* volume-weighted over remisiones filtradas */}
                            {gaStreaming && (
                              <span className="ml-2">
                                Cargando {gaPercent}%
                              </span>
                            )}
                        </div>
                        </CardHeader>
                    </Card>

                    {/* Resistencia Ponderada */}
                    <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-6 py-5">
                            <CardTitle className="text-center text-2xl font-semibold text-gray-900 tabular-nums relative">
                                       {currentSummaryMetrics.weightedResistance.toFixed(1)}
                                       {currentSummaryMetrics.resistanceTooltip && (
                                          <TooltipProvider>
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <Info className="h-4 w-4 text-gray-400 absolute top-0 right-0 cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                      <p className="text-xs max-w-xs">{currentSummaryMetrics.resistanceTooltip}</p>
                                                  </TooltipContent>
                                              </Tooltip>
                                          </TooltipProvider>
                                      )}
                            </CardTitle>
                        <CardDescription className='text-center text-sm font-medium text-gray-600'>
                            Resistencia Ponderada
                            </CardDescription>
                        <div className="text-center text-xs text-gray-500 mt-2">
                            kg/cm² promedio por volumen
                        </div>
                        </CardHeader>
                    </Card>
                </div>

                 {/* Product Breakdown Section - Professional Design */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Concrete */}
                    <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                        <CardHeader className="border-b border-gray-200/80 bg-gray-50/80 rounded-t-xl px-4 py-3">
                            <CardTitle className="text-sm font-semibold text-gray-800">Concreto Premezclado</CardTitle>
                        </CardHeader>
                         <CardContent className='p-4'>
                             <div className="flex justify-between items-start mb-3">
                                 <div>
                                     <div className="text-xl font-semibold text-gray-900 tabular-nums">
                                                   {currentSummaryMetrics.concreteVolume.toFixed(1)}
                                     </div>
                                    <p className="text-xs text-gray-500 font-medium">Volumen (m³)</p>
                                </div>
                                 <div>
                                     <div className="text-xl font-semibold text-gray-900 tabular-nums">
                                                   ${includeVAT ? currentSummaryMetrics.weightedConcretePriceWithVAT.toFixed(2) : currentSummaryMetrics.weightedConcretePrice.toFixed(2)}
                                     </div>
                                    <p className="text-xs text-gray-500 font-medium text-right">
                                        Precio Ponderado {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2 max-h-16 overflow-y-auto">
                              {Object.entries(concreteByRecipe)
                                .sort(([, a], [, b]) => b.volume - a.volume)
                                .slice(0, 3)
                                .map(([recipe, data], index) => (
                                  <Badge key={`ventas-recipe-${index}-${recipe}`} variant="outline" className="bg-white text-gray-600 border-gray-300 text-xs">
                                    {recipe}: {data.volume.toFixed(1)} m³
                                  </Badge>
                                ))}
                              {Object.entries(concreteByRecipe).length > 3 && (
                                <Badge variant="outline" className="bg-white text-gray-500 border-gray-300 text-xs">
                                  +{Object.entries(concreteByRecipe).length - 3} más
                                </Badge>
                              )}
                            </div>
                        </CardContent>
                     </Card>
                     {/* Pumping */}
                    <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                        <CardHeader className="border-b border-gray-200/80 bg-gray-50/80 rounded-t-xl px-4 py-3">
                            <CardTitle className="text-sm font-semibold text-gray-800">Servicio de Bombeo</CardTitle>
                        </CardHeader>
                        <CardContent className='p-4 flex justify-between items-start'>
                            <div>
                                <div className="text-xl font-semibold text-gray-900 tabular-nums">
                                              {currentSummaryMetrics.pumpVolume.toFixed(1)}
                                </div>
                                <p className="text-xs text-gray-500 font-medium">Volumen (m³)</p>
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-gray-900 tabular-nums">
                                              ${includeVAT ? currentSummaryMetrics.weightedPumpPriceWithVAT.toFixed(2) : currentSummaryMetrics.weightedPumpPrice.toFixed(2)}
                                </div>
                                <p className="text-xs text-gray-500 font-medium text-right">
                                    Precio Ponderado {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                </p>
                            </div>
                         </CardContent>
                    </Card>
                     {/* Empty Truck */}
                    <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                        <CardHeader className="border-b border-gray-200/80 bg-gray-50/80 rounded-t-xl px-4 py-3">
                            <CardTitle className="text-sm font-semibold text-gray-800">Vacío de Olla</CardTitle>
                        </CardHeader>
                        <CardContent className='p-4 flex justify-between items-start'>
                            <div>
                                <div className="text-xl font-semibold text-gray-900 tabular-nums">
                                               {currentSummaryMetrics.emptyTruckVolume.toFixed(1)}
                                </div>
                                <p className="text-xs text-gray-500 font-medium">Volumen (m³)</p>
                            </div>
                            <div>
                                <div className="text-xl font-semibold text-gray-900 tabular-nums">
                                               ${includeVAT ? currentSummaryMetrics.weightedEmptyTruckPriceWithVAT.toFixed(2) : currentSummaryMetrics.weightedEmptyTruckPrice.toFixed(2)}
                                </div>
                                <p className="text-xs text-gray-500 font-medium text-right">
                                    Precio Ponderado {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
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
                {/* Row 1: Key Performance Indicators - Apple-like Design */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Payment Distribution - Clean Design */}
                  <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-8 py-6">
                      <CardTitle className="text-xl font-medium text-gray-900 tracking-tight flex items-center justify-between">
                        <span>Efectivo/Fiscal</span>
                        {includeVAT && (
                          <Badge variant="outline" className="text-xs border-gray-200 text-gray-600 bg-gray-50/50">
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

                  {/* Product Performance - Clean Design */}
                  <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-8 py-6">
                      <CardTitle className="text-xl font-medium text-gray-900 tracking-tight">Rendimiento por Producto</CardTitle>
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

                {/* Row 2: Client Distribution - Clean Design */}
                <div className="grid grid-cols-1 gap-8">
                  <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-8 py-6">
                      <CardTitle className="text-xl font-medium text-gray-900 tracking-tight">Distribución de Clientes</CardTitle>
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

                {/* Row 3: Comparative Table by Plant - Apple-like Design */}
                <div className="grid grid-cols-1 gap-8">
                  <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-8 py-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl font-medium text-gray-900 tracking-tight">Comparativo por Planta</CardTitle>
                          <CardDescription className="text-sm text-gray-500 mt-2 font-normal">
                            Análisis detallado por planta: volúmenes de concreto, bombeo y vacío de olla, resistencia ponderada, edad de garantía y ventas por producto
                          </CardDescription>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={exportPlantsTable} 
                          disabled={perPlantRows.length === 0 || plantTableLoading} 
                          className="gap-2 border-gray-200 text-gray-600 hover:bg-gray-50/80 hover:border-gray-300 transition-all duration-200 rounded-lg px-4 py-2"
                        >
                          <Download className="h-4 w-4" />
                          Exportar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {plantTableLoading ? (
                        <div className="h-48 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-base font-medium mb-6 text-gray-700">Cargando datos comparativos...</div>
                            <div className="w-80 bg-gray-100 rounded-full h-1.5 mb-3">
                              <div 
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out" 
                                style={{ width: `${plantTableProgress.total > 0 ? (plantTableProgress.processed / plantTableProgress.total) * 100 : 0}%` }}
                              />
                            </div>
                            <div className="text-sm text-gray-500 font-medium">
                              {plantTableProgress.processed}/{plantTableProgress.total} operaciones completadas
                            </div>
                          </div>
                        </div>
                      ) : perPlantRows.length === 0 ? (
                        <div className="h-48 flex items-center justify-center">
                          <div className="text-center text-gray-400">
                            <div className="text-base font-medium mb-2">No hay datos disponibles</div>
                            <div className="text-sm">Ajusta los filtros o el rango de fechas</div>
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-b border-gray-100/80 bg-gray-50/40">
                                <TableHead className="font-medium text-gray-700 py-4 px-6 text-left sticky left-0 bg-gray-50/40 z-10">Planta</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right">Vol. Concreto (m³)</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right">Vol. Bombeo (m³)</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right">Vol. Vacío Olla (m³)</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right">Resist. Pond. (kg/cm²)</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right">Edad Gar. (días)</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right">Ventas Concreto</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right">Ventas Bombeo</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right">Ventas Vacío Olla</TableHead>
                                <TableHead className="font-medium text-gray-700 py-4 px-4 text-right bg-blue-50/50">Ventas Totales</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {perPlantRows.map((row, index) => (
                                <TableRow key={row.plantId} className={`border-b border-gray-50/80 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'} hover:bg-blue-50/30 transition-colors duration-200`}>
                                  <TableCell className="py-4 px-6 sticky left-0 bg-inherit z-10">
                                    <div>
                                      <div className="font-semibold text-gray-900 text-sm">{row.plantCode}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">{row.plantName}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 tabular-nums">
                                    {row.concreteVolume.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 tabular-nums">
                                    {row.pumpVolume.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 tabular-nums">
                                    {row.emptyTruckVolume.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 tabular-nums">
                                    {row.weightedResistance.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 tabular-nums">
                                    {row.weightedGuaranteeAge.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 tabular-nums">
                                    {formatCurrency(row.concreteVentas)}
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 tabular-nums">
                                    {formatCurrency(row.pumpVentas)}
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 tabular-nums">
                                    {formatCurrency(row.emptyTruckVentas)}
                                  </TableCell>
                                  <TableCell className="py-4 px-4 text-right text-sm text-gray-900 font-semibold tabular-nums bg-blue-50/50">
                                    {formatCurrency(row.totalVentas)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Row 4: Commercial Performance KPIs - Clean Design */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Active Clients Monthly */}
                  <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-6 py-4">
                      <CardTitle className="text-lg font-medium text-gray-900 tracking-tight">Clientes Activos Mensuales</CardTitle>
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

                  {/* Outstanding Amounts */}
                  <Card className="border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                    <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-6 py-4">
                      <CardTitle className="text-lg font-medium text-gray-900 tracking-tight">Montos Pendientes</CardTitle>
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
               <Card className="mt-8 border border-gray-200/60 bg-white/95 backdrop-blur-sm shadow-sm rounded-xl">
                 <CardHeader className="border-b border-gray-100/80 bg-white/50 rounded-t-xl px-8 py-6">
                   <CardTitle className="text-xl font-medium text-gray-900 tracking-tight flex items-center gap-2">
                     <Info className="h-5 w-5 text-gray-600" />
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
