'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, subDays, subMonths, isValid, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Download, TrendingUp, Package, DollarSign, BarChart3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets"
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import * as XLSX from 'xlsx';
import { usePlantContext } from '@/contexts/PlantContext';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';

// Dynamically import ApexCharts
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Types for production data
interface ProductionData {
  strength_fc: number;
  recipe_code: string;
  recipe_id: string;
  total_volume: number;
  remisiones_count: number;
  avg_cost_per_m3: number;
  total_material_cost: number;
  cement_cost: number;
  cement_consumption: number;
  materials_breakdown: MaterialBreakdown[];
  avg_selling_price?: number;
  margin_per_m3?: number;
}

interface MaterialBreakdown {
  material_type: string;
  material_name: string;
  total_consumption: number;
  unit: string;
  total_cost: number;
  cost_per_unit: number;
  cost_per_m3: number;
}

interface RemisionData {
  id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado: number;
  recipe: {
    id: string;
    recipe_code: string;
    strength_fc: number;
  };
  order: {
    client_id: string;
    clients: {
      business_name: string;
    };
  };
}

export default function ProduccionDashboard() {
  const { currentPlant } = usePlantContext();
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [remisionesData, setRemisionesData] = useState<RemisionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [strengthFilter, setStrengthFilter] = useState<string>('all');
  const [availableStrengths, setAvailableStrengths] = useState<number[]>([]);

  // Format the dates for display
  const dateRangeText = useMemo(() => {
    if (!startDate || !endDate) return 'Seleccione un rango de fechas';
    return `${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`;
  }, [startDate, endDate]);

  // Fetch production data
  useEffect(() => {
    async function fetchProductionData() {
      if (!startDate || !endDate) {
        setProductionData([]);
        setRemisionesData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Format dates for Supabase query
        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        // Fetch remisiones with recipe and order data
        let remisionesQuery = supabase
          .from('remisiones')
          .select(`
            id,
            remision_number,
            fecha,
            volumen_fabricado,
            recipe_id,
            order_id,
            recipes!inner(
              id,
              recipe_code,
              strength_fc
            ),
            orders!inner(
              client_id,
              clients!inner(
                business_name
              )
            )
          `)
          .eq('tipo_remision', 'CONCRETO')
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate);

        // Apply plant filter if a plant is selected
        if (currentPlant?.id) {
          remisionesQuery = remisionesQuery.eq('plant_id', currentPlant.id);
        }

        const { data: remisiones, error: remisionesError } = await remisionesQuery;

        if (remisionesError) throw remisionesError;

        // Process remisiones data
        const processedRemisiones: RemisionData[] = remisiones
          // filter out records without recipe/strength
          .filter((r: any) => r?.recipes?.strength_fc)
          .map((r: any) => ({
            id: r.id,
            remision_number: r.remision_number,
            fecha: r.fecha,
            volumen_fabricado: r.volumen_fabricado,
            recipe: {
              id: r.recipes.id,
              recipe_code: r.recipes.recipe_code,
              strength_fc: r.recipes.strength_fc
            },
            order: {
              client_id: r.orders?.client_id,
              clients: {
                business_name: r.orders?.clients?.business_name || 'Desconocido'
              }
            }
          }));

        setRemisionesData(processedRemisiones);

        // Extract unique strengths for filter
        const strengths = Array.from(new Set(processedRemisiones.map(r => r.recipe.strength_fc)))
          .filter(s => s != null)
          .sort((a, b) => a - b);
        setAvailableStrengths(strengths);

        // Group by recipe and calculate production metrics
        const productionSummary = await calculateProductionMetrics(processedRemisiones);
        setProductionData(productionSummary);

      } catch (error) {
        console.error('Error fetching production data:', error);
        setError('Error al cargar los datos de producción. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchProductionData();
  }, [startDate, endDate, currentPlant]);

  // Calculate production metrics with material costs
  const calculateProductionMetrics = async (remisiones: RemisionData[]): Promise<ProductionData[]> => {
    // Group by recipe
    const recipeGroups = remisiones.reduce((acc, remision) => {
      const key = `${remision.recipe.id}-${remision.recipe.strength_fc}`;
      if (!acc[key]) {
        acc[key] = {
          recipe_id: remision.recipe.id,
          recipe_code: remision.recipe.recipe_code,
          strength_fc: remision.recipe.strength_fc,
          remisiones: []
        };
      }
      acc[key].remisiones.push(remision);
      return acc;
    }, {} as Record<string, any>);

    const productionMetrics: ProductionData[] = [];

    // Preload average selling prices per recipe (active prices, filtered by plant when available)
    const uniqueRecipeIds = Array.from(new Set(Object.values(recipeGroups as any).map((g: any) => g.recipe_id)));
    let priceMap = new Map<string, number>();
    if (uniqueRecipeIds.length > 0) {
      let priceQuery = supabase
        .from('product_prices')
        .select('recipe_id, base_price')
        .eq('is_active', true)
        .in('recipe_id', uniqueRecipeIds);
      if (currentPlant?.id) {
        priceQuery = priceQuery.eq('plant_id', currentPlant.id);
      }
      const { data: priceRows, error: priceErr } = await priceQuery;
      if (!priceErr && priceRows) {
        const sumCount = new Map<string, { sum: number, count: number }>();
        priceRows.forEach((row: any) => {
          const key = row.recipe_id as string;
          const value = Number(row.base_price) || 0;
          const entry = sumCount.get(key) || { sum: 0, count: 0 };
          entry.sum += value;
          entry.count += 1;
          sumCount.set(key, entry);
        });
        sumCount.forEach((v, k) => {
          priceMap.set(k, v.count > 0 ? v.sum / v.count : 0);
        });
      }
    }

    for (const [key, group] of Object.entries(recipeGroups)) {
      const totalVolume = group.remisiones.reduce((sum: number, r: any) => sum + r.volumen_fabricado, 0);
      
      // Get material costs from actual remision_materiales rows for this recipe group
      const remisionIds = group.remisiones.map((r: any) => r.id);
      const materialCosts = await calculateMaterialCosts(remisionIds, totalVolume);

      const avgSellingPrice = Number(priceMap.get(group.recipe_id)) || 0;
      const marginPerM3 = avgSellingPrice - materialCosts.costPerM3;

      productionMetrics.push({
        strength_fc: group.strength_fc,
        recipe_code: group.recipe_code,
        recipe_id: group.recipe_id,
        total_volume: totalVolume,
        remisiones_count: group.remisiones.length,
        avg_cost_per_m3: materialCosts.costPerM3,
        total_material_cost: materialCosts.totalCost,
        cement_cost: materialCosts.cementCost,
        cement_consumption: materialCosts.cementConsumption,
        materials_breakdown: materialCosts.breakdown,
        avg_selling_price: avgSellingPrice,
        margin_per_m3: marginPerM3
      });
    }

    return productionMetrics.sort((a, b) => a.strength_fc - b.strength_fc);
  };

  // Calculate material costs from actual consumptions in remision_materiales
  const calculateMaterialCosts = async (remisionIds: string[], totalVolume: number) => {
    try {
      if (!remisionIds || remisionIds.length === 0 || totalVolume <= 0) {
        return {
          costPerM3: 0,
          totalCost: 0,
          cementCost: 0,
          cementConsumption: 0,
          breakdown: []
        };
      }

      // Fetch actual consumptions from remision_materiales with proper material relationships
      // Note: Large IN() lists can exceed URL limits; chunk requests to avoid 400 errors
      const selectColumns = `
        remision_id,
        material_id,
        material_type,
        cantidad_real,
        materials!inner(
          id,
          material_name,
          unit_of_measure,
          category,
          material_code
        )
      `;

      const chunkSize = 50;
      const materialesResults: any[] = [];
      for (let i = 0; i < remisionIds.length; i += chunkSize) {
        const chunk = remisionIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('remision_materiales')
          .select(selectColumns)
          .in('remision_id', chunk);
        if (error) {
          console.error('Error fetching remision_materiales chunk:', error);
          continue;
        }
        if (data) materialesResults.push(...data);
      }

      const materiales = materialesResults;

      if (!materiales || materiales.length === 0) {
        return {
          costPerM3: 0,
          totalCost: 0,
          cementCost: 0,
          cementConsumption: 0,
          breakdown: []
        };
      }

      // Aggregate by material_id (skip rows without a valid material_id or material relation)
      const aggregatedByMaterial = new Map<string, { qty: number, material: any, fallbackType?: string }>();
      materiales.forEach((m: any) => {
        if (!m.material_id || !m.materials) return; // ensure we only include mapped materials
        const materialId = String(m.material_id);
        const qty = Number(m.cantidad_real) || 0;

        if (aggregatedByMaterial.has(materialId)) {
          const existing = aggregatedByMaterial.get(materialId)!;
          existing.qty += qty;
        } else {
          aggregatedByMaterial.set(materialId, {
            qty: qty,
            material: m.materials,
            fallbackType: m.material_type || undefined
          });
        }
      });

      // Get current material prices using material_id
      const materialIds = Array.from(aggregatedByMaterial.keys());
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      
      let pricesQuery = supabase
        .from('material_prices')
        .select('material_id, price_per_unit, effective_date, end_date, plant_id')
        .in('material_id', materialIds)
        .lte('effective_date', currentDate)
        .or(`end_date.is.null,end_date.gte.${currentDate}`)
        .order('effective_date', { ascending: false });

      // Prefer plant-specific prices if plant is set
      if (currentPlant?.id) {
        pricesQuery = pricesQuery.eq('plant_id', currentPlant.id);
      }

      const { data: materialPrices, error: pricesError } = await pricesQuery;

      if (pricesError) {
        console.error('Error fetching material prices:', pricesError);
      }

      // Create price lookup by material_id (first row per material wins as we ordered by effective_date desc)
      const priceMap = new Map();
      materialPrices?.forEach((mp: any) => {
        if (!priceMap.has(mp.material_id)) {
          priceMap.set(mp.material_id, mp.price_per_unit);
        }
      });

      // Calculate costs
      let totalCostPerM3 = 0;
      let cementCostPerM3 = 0;
      let cementConsumptionTotal = 0;
      const breakdown: MaterialBreakdown[] = [];

      aggregatedByMaterial.forEach(({ qty, material, fallbackType }, materialId) => {
        const price = Number(priceMap.get(materialId)) || 0;
        const totalCost = qty * price;
        const costPerM3 = totalVolume > 0 ? totalCost / totalVolume : 0;

        totalCostPerM3 += costPerM3;

        // Check if this is cement based on known fields
        const typeOrName = String(
          material.category || material.material_name || fallbackType || ''
        ).toLowerCase();
        const isCement = typeOrName.includes('cement') || typeOrName.includes('cemento');
        
        if (isCement) {
          cementCostPerM3 += costPerM3;
          cementConsumptionTotal += qty;
        }

        breakdown.push({
          material_type: (material.category || fallbackType || 'Unknown') as string,
          material_name: (material.material_name || 'Material Desconocido') as string,
          total_consumption: qty,
          unit: (material.unit_of_measure || '') as string,
          total_cost: totalCost,
          cost_per_unit: price,
          cost_per_m3: costPerM3
        });
      });

      return {
        costPerM3: totalCostPerM3,
        totalCost: totalCostPerM3 * totalVolume,
        cementCost: cementCostPerM3 * totalVolume,
        cementConsumption: cementConsumptionTotal,
        breakdown: breakdown.sort((a, b) => b.cost_per_m3 - a.cost_per_m3)
      };
    } catch (error) {
      console.error('Error calculating material costs:', error);
      return {
        costPerM3: 0,
        totalCost: 0,
        cementCost: 0,
        cementConsumption: 0,
        breakdown: []
      };
    }
  };

  // Filter production data
  const filteredProductionData = useMemo(() => {
    let filtered = [...productionData];
    
    // Apply strength filter
    if (strengthFilter !== 'all') {
      filtered = filtered.filter(item => item.strength_fc.toString() === strengthFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.recipe_code.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [productionData, strengthFilter, searchTerm]);

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalVolume = filteredProductionData.reduce((sum, item) => sum + item.total_volume, 0);
    const totalMaterialCost = filteredProductionData.reduce((sum, item) => sum + item.total_material_cost, 0);
    const totalCementCost = filteredProductionData.reduce((sum, item) => sum + item.cement_cost, 0);
    const totalCementConsumption = filteredProductionData.reduce((sum, item) => sum + item.cement_consumption, 0);
    const weightedAvgCostPerM3 = totalVolume > 0 ? totalMaterialCost / totalVolume : 0;

    return {
      totalVolume,
      totalMaterialCost,
      totalCementCost,
      totalCementConsumption,
      weightedAvgCostPerM3,
      cementCostPercentage: totalMaterialCost > 0 ? (totalCementCost / totalMaterialCost) * 100 : 0
    };
  }, [filteredProductionData]);

  // Chart data for volume by strength
  const volumeByStrengthData = useMemo(() => {
    return {
      categories: filteredProductionData.map(item => `${item.strength_fc} kg/cm²`),
      series: [{
        name: 'Volumen (m³)',
        data: filteredProductionData.map(item => item.total_volume)
      }]
    };
  }, [filteredProductionData]);

  // Chart data for cost breakdown as percentage of total grouped by resistance
  const costBreakdownData = useMemo(() => {
    // group by strength
    const byStrength = new Map<number, { total: number; cement: number }>();
    filteredProductionData.forEach(item => {
      const entry = byStrength.get(item.strength_fc) || { total: 0, cement: 0 };
      entry.total += item.total_material_cost || 0;
      entry.cement += item.cement_cost || 0;
      byStrength.set(item.strength_fc, entry);
    });

    const strengths = Array.from(byStrength.keys()).sort((a, b) => a - b);
    const cementPct = strengths.map(s => {
      const e = byStrength.get(s)!;
      return e.total > 0 ? (e.cement / e.total) * 100 : 0;
    });
    const othersPct = cementPct.map(p => 100 - p);

    return {
      categories: strengths.map(s => `${s} kg/cm²`),
      series: [
        { name: 'Cemento', data: cementPct },
        { name: 'Otros', data: othersPct }
      ]
    };
  }, [filteredProductionData]);

  // Chart options for volume chart
  const volumeChartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    colors: ['#007AFF'],
    plotOptions: {
      bar: {
        borderRadius: 8,
        columnWidth: '65%',
        dataLabels: {
          position: 'top'
        }
      }
    },
    xaxis: {
      categories: volumeByStrengthData.categories,
      labels: {
        style: { 
          fontSize: '12px',
          fontWeight: 500,
          colors: '#6B7280'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      title: { 
        text: 'Volumen (m³)',
        style: {
          fontSize: '14px',
          fontWeight: 600,
          color: '#374151'
        }
      },
      labels: {
        formatter: (val) => val.toFixed(1),
        style: {
          fontSize: '12px',
          colors: '#6B7280'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val.toFixed(1)}`,
      style: {
        fontSize: '12px',
        fontWeight: 500,
        colors: ['#ffffff']
      },
      background: {
        enabled: true,
        foreColor: '#000000',
        borderRadius: 4,
        padding: 4
      }
    },
    grid: {
      borderColor: '#F3F4F6',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false
        }
      }
    },
    tooltip: {
      y: {
        formatter: (val: number) => `${val.toFixed(1)} m³`
      }
    }
  };

  // Chart options for cost breakdown chart
  const costChartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      stacked: true,
      stackType: '100%',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    colors: ['#FF9500', '#34C759'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '65%',
        borderRadius: 6
      }
    },
    xaxis: {
      categories: costBreakdownData.categories,
      labels: {
        style: {
          fontSize: '12px',
          fontWeight: 500,
          colors: '#6B7280'
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      title: {
        text: 'Porcentaje (%)',
        style: {
          fontSize: '14px',
          fontWeight: 600,
          color: '#374151'
        }
      },
      labels: {
        formatter: (val: number) => `${val.toFixed(0)}%`,
        style: {
          fontSize: '12px',
          colors: '#6B7280'
        }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '12px',
      fontWeight: 500,
      markers: { size: 12 },
      itemMargin: { horizontal: 16, vertical: 0 }
    },
    tooltip: {
      y: {
        formatter: (val: number) => `${val.toFixed(1)}%`
      },
      style: { fontSize: '12px' }
    },
    grid: {
      borderColor: '#F3F4F6',
      strokeDashArray: 2,
      xaxis: { lines: { show: false } }
    },
    dataLabels: { enabled: false }
  };

  // Export to Excel function
  const exportToExcel = () => {
    try {
      // Prepare data for export
      const excelData = filteredProductionData.map((item, index) => ({
        'Resistencia (kg/cm²)': item.strength_fc,
        'Código Receta': item.recipe_code,
        'Volumen Total (m³)': item.total_volume,
        'Número de Remisiones': item.remisiones_count,
        'Costo Promedio por m³': item.avg_cost_per_m3,
        'Costo Total Materiales': item.total_material_cost,
        'Costo Cemento': item.cement_cost,
        'Consumo Cemento (kg)': item.cement_consumption
      }));

      // Add summary row
      const summaryRow = {
        'Resistencia (kg/cm²)': 0,
        'Código Receta': '',
        'Volumen Total (m³)': summaryMetrics.totalVolume,
        'Número de Remisiones': filteredProductionData.reduce((sum, item) => sum + item.remisiones_count, 0),
        'Costo Promedio por m³': summaryMetrics.weightedAvgCostPerM3,
        'Costo Total Materiales': summaryMetrics.totalMaterialCost,
        'Costo Cemento': summaryMetrics.totalCementCost,
        'Consumo Cemento (kg)': summaryMetrics.totalCementConsumption
      };

      excelData.push(summaryRow);

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // Resistencia
        { wch: 15 }, // Código Receta
        { wch: 18 }, // Volumen Total
        { wch: 20 }, // Número de Remisiones
        { wch: 22 }, // Costo Promedio por m³
        { wch: 22 }, // Costo Total Materiales
        { wch: 18 }, // Costo Cemento
        { wch: 20 }  // Consumo Cemento
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte de Producción');

      // Generate filename with date range
      const startDateStr = startDate ? format(startDate, 'dd-MM-yyyy') : 'fecha';
      const endDateStr = endDate ? format(endDate, 'dd-MM-yyyy') : 'fecha';
      const filename = `Reporte_Produccion_${startDateStr}_${endDateStr}.xlsx`;

      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Reporte de Producción
          </CardTitle>
          <CardDescription>
            Análisis de costos de materiales y producción - {dateRangeText}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card className="mb-6 overflow-visible">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Personaliza tu análisis de producción</CardDescription>
        </CardHeader>
        <CardContent className="overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-visible">
            {/* Plant Context */}
            <div className="space-y-2 relative z-[9999]">
              <Label>Planta</Label>
              <PlantContextDisplay showLabel={false} />
            </div>

            {/* Date Range */}
            <div className="space-y-2 relative z-40">
              <Label>Rango de Fechas</Label>
              <DateRangePickerWithPresets
                dateRange={{
                  from: startDate || new Date(),
                  to: endDate || new Date()
                }}
                onDateRangeChange={(range: DateRange | undefined) => {
                  if (range?.from) setStartDate(range.from);
                  if (range?.to) setEndDate(range.to);
                }}
              />
            </div>

            {/* Strength Filter */}
            <div className="space-y-2 relative z-30">
              <Label>Resistencia</Label>
              <Select value={strengthFilter} onValueChange={setStrengthFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las resistencias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las resistencias</SelectItem>
                  {availableStrengths.map(strength => (
                    <SelectItem key={strength} value={strength.toString()}>
                      {strength} kg/cm²
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2 relative z-20">
              <Label>Buscar</Label>
              <Input
                placeholder="Código de receta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Volumen Total</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryMetrics.totalVolume.toFixed(1)} m³</div>
                <p className="text-xs text-muted-foreground">
                  Concreto producido en el período
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Costo Total de Materiales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summaryMetrics.totalMaterialCost)}</div>
                <p className="text-xs text-muted-foreground">
                  Inversión en materias primas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Costo Promedio</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summaryMetrics.weightedAvgCostPerM3)}</div>
                <p className="text-xs text-muted-foreground">
                  por m³ (costo ponderado)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Consumo Cemento</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(summaryMetrics.totalCementConsumption / 1000).toFixed(1)} t</div>
                <p className="text-xs text-muted-foreground">
                  Total de cemento utilizado
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Volumen por Resistencia</CardTitle>
                <CardDescription>Distribución de la producción por tipo de concreto</CardDescription>
              </CardHeader>
              <CardContent>
                {typeof window !== 'undefined' && (
                  <Chart
                    options={{
                      ...volumeChartOptions,
                      chart: {
                        ...volumeChartOptions.chart,
                        background: 'transparent'
                      }
                    }}
                    series={volumeByStrengthData.series}
                    type="bar"
                    height={320}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Desglose de Costos por Resistencia</CardTitle>
                <CardDescription>Costo de cemento vs. otros materiales agrupado por resistencia</CardDescription>
              </CardHeader>
              <CardContent>
                {typeof window !== 'undefined' && (
                  <Chart
                    options={{
                      ...costChartOptions,
                      chart: {
                        ...costChartOptions.chart,
                        background: 'transparent'
                      }
                    }}
                    series={costBreakdownData.series}
                    type="bar"
                    height={320}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Análisis Detallado</CardTitle>
                  <CardDescription>Datos completos de producción y costos</CardDescription>
                </div>
                <Button 
                  onClick={exportToExcel}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="summary">
                    Resumen por Resistencia
                  </TabsTrigger>
                  <TabsTrigger value="materials">
                    Desglose de Materiales por Resistencia
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Resistencia</TableHead>
                          <TableHead>Código Receta</TableHead>
                          <TableHead className="text-right">Volumen (m³)</TableHead>
                          <TableHead className="text-right">Remisiones</TableHead>
                          <TableHead className="text-right">Costo por m³</TableHead>
                          <TableHead className="text-right">Costo Total</TableHead>
                          <TableHead className="text-right">Precio Promedio</TableHead>
                          <TableHead className="text-right">Margen por m³</TableHead>
                          <TableHead className="text-right">% Cemento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProductionData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant="outline">
                                {item.strength_fc} kg/cm²
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.recipe_code}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.total_volume.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.remisiones_count}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.avg_cost_per_m3)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.total_material_cost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.avg_selling_price || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.margin_per_m3 || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-sm font-medium">
                                {((item.cement_cost / item.total_material_cost) * 100).toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredProductionData.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="font-bold">TOTAL</TableCell>
                            <TableCell className="text-right font-bold">
                              {summaryMetrics.totalVolume.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {filteredProductionData.reduce((sum, item) => sum + item.remisiones_count, 0)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(summaryMetrics.weightedAvgCostPerM3)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(summaryMetrics.totalMaterialCost)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency((() => {
                                const vols = filteredProductionData.reduce((acc, i) => acc + i.total_volume, 0);
                                const rev = filteredProductionData.reduce((acc, i) => acc + (i.avg_selling_price || 0) * i.total_volume, 0);
                                return vols > 0 ? rev / vols : 0;
                              })())}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency((() => {
                                const vols = filteredProductionData.reduce((acc, i) => acc + i.total_volume, 0);
                                const rev = filteredProductionData.reduce((acc, i) => acc + (i.avg_selling_price || 0) * i.total_volume, 0);
                                return vols > 0 ? (rev / vols) - summaryMetrics.weightedAvgCostPerM3 : 0;
                              })())}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-200 text-orange-900 text-sm font-bold">
                                {summaryMetrics.cementCostPercentage.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="materials">
                  <div className="space-y-6">
                    {/* Aggregate materials by strength across recipes */}
                    {Array.from(
                      filteredProductionData.reduce((map, item) => {
                        const key = item.strength_fc;
                        const existing = map.get(key) || {
                          strength_fc: key,
                          total_volume: 0,
                          total_cost: 0,
                          breakdown: new Map<string, MaterialBreakdown>()
                        };
                        existing.total_volume += item.total_volume;
                        existing.total_cost += item.total_material_cost;
                        item.materials_breakdown.forEach(mb => {
                          const b = existing.breakdown.get(mb.material_name) || {
                            material_type: mb.material_type,
                            material_name: mb.material_name,
                            total_consumption: 0,
                            unit: mb.unit,
                            total_cost: 0,
                            cost_per_unit: mb.cost_per_unit,
                            cost_per_m3: 0
                          };
                          b.total_consumption += mb.total_consumption;
                          b.total_cost += mb.total_cost;
                          existing.breakdown.set(mb.material_name, b);
                        });
                        map.set(key, existing);
                        return map;
                      }, new Map<number, any>())
                    ).sort((a, b) => a[0] - b[0]).map(([strength, agg]: any, idx: number) => (
                      <Card key={idx}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-lg font-semibold mb-1">
                                Resistencia {strength} kg/cm²
                              </h4>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">
                                  {strength} kg/cm²
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  Volumen total: {agg.total_volume.toFixed(2)} m³
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                {formatCurrency(agg.total_cost)}
                              </div>
                              <div className="text-sm text-muted-foreground">Costo total</div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Material</TableHead>
                                  <TableHead className="text-right">Consumo Total</TableHead>
                                  <TableHead className="text-right">Unidad</TableHead>
                                  <TableHead className="text-right">Precio Unitario</TableHead>
                                  <TableHead className="text-right">Costo por m³</TableHead>
                                  <TableHead className="text-right">Costo Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Array.from(agg.breakdown.values()).sort((a: any, b: any) => b.total_cost - a.total_cost).map((material: any, materialIndex: number) => {
                                  const costPerM3 = agg.total_volume > 0 ? material.total_cost / agg.total_volume : 0;
                                  return (
                                    <TableRow key={materialIndex}>
                                      <TableCell className="font-medium">
                                        {material.material_name}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {material.total_consumption.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="text-right text-muted-foreground">
                                        {material.unit}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatCurrency(material.cost_per_unit)}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatCurrency(costPerM3)}
                                      </TableCell>
                                      <TableCell className="text-right font-bold">
                                        {formatCurrency(material.total_cost)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
