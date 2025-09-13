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
import { useProgressiveProductionDetails } from '@/hooks/useProgressiveProductionDetails';
import { formatCurrency } from '@/lib/utils';
import { useCementTrend } from '@/hooks/useCementTrend';
import { CementTrend as CementTrendComponent } from '@/components/production/CementTrend';
import { SummaryCards as SummaryCardsV2 } from '@/components/production/SummaryCards';
import { VolumeByStrengthCards as VolumeByStrengthCardsV2 } from '@/components/production/VolumeByStrengthCards';
import { ProductionSummaryTable as ProductionSummaryTableV2 } from '@/components/production/Tables/ProductionSummaryTable';
import { MaterialsByStrengthTable as MaterialsByStrengthTableV2 } from '@/components/production/Tables/MaterialsByStrengthTable';
import { Download, TrendingUp, Package, DollarSign, BarChart3, ArrowUpIcon, ArrowDownIcon, AlertTriangle, CheckCircle2, Search, CheckCircle, Info } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";


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
    client_id: string | null;
    clients: {
      business_name: string;
    };
  };
}

// New interface for investigation data
interface InvestigationData {
  remisiones: RemisionData[];
  materialPrices: MaterialPriceData[];
  recipeConsumption: RecipeConsumptionData[];
  missingPrices: MissingPriceData[];
}

interface MaterialPriceData {
  material_id: string;
  material_name: string;
  material_code: string;
  category: string;
  unit_of_measure: string;
  current_price: number;
  effective_date: string;
  plant_id: string | null;
  has_price: boolean;
}

interface RecipeConsumptionData {
  recipe_id: string;
  recipe_code: string;
  strength_fc: number;
  remisiones_count: number;
  total_volume: number;
  materials: MaterialConsumptionDetail[];
}

interface MaterialConsumptionDetail {
  material_id: string;
  material_name: string;
  material_code: string;
  category: string;
  total_consumption: number;
  unit: string;
  has_price: boolean;
  price: number;
  total_cost: number;
}

interface MissingPriceData {
  material_id: string;
  material_name: string;
  material_code: string;
  category: string;
  unit_of_measure: string;
  last_known_price?: number;
  last_price_date?: string;
}

export default function ProduccionDashboard() {
  const { currentPlant } = usePlantContext();
  const { categories: trendCatsV2, series: trendSeriesV2, loading: trendLoadingV2 } = useCementTrend(currentPlant?.id, 6);
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [investigationData, setInvestigationData] = useState<InvestigationData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [strengthFilter, setStrengthFilter] = useState<string>('all');
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [investigationProgress, setInvestigationProgress] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [materialConsumptionData, setMaterialConsumptionData] = useState<any>(null);
  const [materialAnalysisLoading, setMaterialAnalysisLoading] = useState(false);

  const {
    productionData: hookProductionData,
    remisionesData: hookRemisionesData,
    availableStrengths: hookAvailableStrengths,
    availableMaterials: hookAvailableMaterials,
    globalMaterialsSummary: hookGlobalMaterialsSummary,
    historicalTrends: hookHistoricalTrends,
    loading: hookLoading,
    streaming: hookStreaming,
    progress: hookProgress,
    calculateMaterialConsumption: hookCalculateMaterialConsumption,
  } = useProgressiveProductionDetails({
    plantId: currentPlant?.id,
    startDate,
    endDate
  });

  const productionData = hookProductionData;
  const remisionesData = hookRemisionesData;
  const availableStrengths = hookAvailableStrengths;
  const availableMaterials = hookAvailableMaterials;
  const globalMaterialsSummary = hookGlobalMaterialsSummary;
  const historicalTrends = hookHistoricalTrends;
  const loading = hookLoading;
  const streaming = hookStreaming;
  const progress = hookProgress;

  // Format the dates for display
  const dateRangeText = useMemo(() => {
    if (!startDate || !endDate) return 'Seleccione un rango de fechas';
    return `${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`;
  }, [startDate, endDate]);

  // Clear material analysis on date change
  useEffect(() => {
    setSelectedMaterial('');
    setMaterialConsumptionData(null);
  }, [startDate, endDate]);

  // Removed local heavy calculators: handled by useProgressiveProductionDetails

  // Calculate total consumption for a specific material
  const calculateMaterialConsumption = async (materialId: string) => {
    try {
      if (!remisionesData || remisionesData.length === 0 || !materialId) {
        return null;
      }

      const remisionIds = remisionesData.map(r => r.id);
      const chunkSize = 50;
      const materialesResults: any[] = [];

      // Fetch material consumption in chunks
      for (let i = 0; i < remisionIds.length; i += chunkSize) {
        const chunk = remisionIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('remision_materiales')
          .select(`
            remision_id,
            cantidad_real,
            materials!inner(
              material_name,
              material_code,
              category,
              unit_of_measure
            ),
            remisiones!inner(
              recipe_id,
              recipes!inner(
                recipe_code,
                strength_fc
              )
            )
          `)
          .in('remision_id', chunk)
          .eq('material_id', materialId);

        if (error) {
          console.error('Error fetching material consumption chunk:', error);
          continue;
        }
        if (data) materialesResults.push(...data);
      }

      if (materialesResults.length === 0) return null;

      // Get material price
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      let priceQuery = supabase
        .from('material_prices')
        .select('price_per_unit, effective_date, end_date, plant_id')
        .eq('material_id', materialId)
        .lte('effective_date', currentDate)
        .or(`end_date.is.null,end_date.gte.${currentDate}`)
        .order('effective_date', { ascending: false });

      if (currentPlant?.id) {
        priceQuery = priceQuery.eq('plant_id', currentPlant.id);
      }

      const { data: priceData, error: priceError } = await priceQuery;
      const materialPrice = priceData && priceData.length > 0 ? priceData[0].price_per_unit : 0;

      // Aggregate consumption by recipe/strength
      const consumptionByRecipe = new Map<string, {
        recipe_code: string;
        strength_fc: number;
        total_consumption: number;
        remisiones_count: number;
        total_volume: number;
      }>();

      let totalConsumption = 0;
      let totalVolume = 0;
      let remisionesCount = new Set<string>();

      materialesResults.forEach((m: any) => {
        const consumption = Number(m.cantidad_real) || 0;
        const remision = m.remisiones;
        const recipe = remision?.recipes;

        if (!recipe) return;

        const recipeKey = `${recipe.recipe_code}-${recipe.strength_fc}`;
        const remisionData = remisionesData.find(r => r.id === m.remision_id);

        totalConsumption += consumption;
        if (remisionData) {
          totalVolume += remisionData.volumen_fabricado;
          remisionesCount.add(m.remision_id);
        }

        if (consumptionByRecipe.has(recipeKey)) {
          const existing = consumptionByRecipe.get(recipeKey)!;
          existing.total_consumption += consumption;
          existing.remisiones_count += 1;
          if (remisionData) {
            existing.total_volume += remisionData.volumen_fabricado;
          }
        } else {
          consumptionByRecipe.set(recipeKey, {
            recipe_code: recipe.recipe_code,
            strength_fc: recipe.strength_fc,
            total_consumption: consumption,
            remisiones_count: 1,
            total_volume: remisionData ? remisionData.volumen_fabricado : 0
          });
        }
      });

      const material = materialesResults[0]?.materials;
      const totalCost = totalConsumption * materialPrice;
      const costPerM3 = totalVolume > 0 ? totalCost / totalVolume : 0;
      const consumptionPerM3 = totalVolume > 0 ? totalConsumption / totalVolume : 0;

      return {
        material: {
          id: materialId,
          name: material?.material_name || 'Material Desconocido',
          code: material?.material_code || '',
          category: material?.category || '',
          unit: material?.unit_of_measure || ''
        },
        totalConsumption,
        totalVolume,
        totalCost,
        costPerM3,
        consumptionPerM3,
        remisionesCount: remisionesCount.size,
        pricePerUnit: materialPrice,
        hasPrice: materialPrice > 0,
        consumptionByRecipe: Array.from(consumptionByRecipe.values())
          .sort((a, b) => b.total_consumption - a.total_consumption)
      };
    } catch (error) {
      console.error('Error calculating material consumption:', error);
      return null;
    }
  };

  // Handle material selection change
  const handleMaterialChange = async (materialId: string) => {
    setSelectedMaterial(materialId);
    if (!materialId) {
      setMaterialConsumptionData(null);
      return;
    }

    setMaterialAnalysisLoading(true);
    try {
      const data = await hookCalculateMaterialConsumption(materialId);
      setMaterialConsumptionData(data);
    } catch (error) {
      console.error('Error loading material consumption data:', error);
      setMaterialConsumptionData(null);
    } finally {
      setMaterialAnalysisLoading(false);
    }
  };

  // Material performance evaluation functions
  const getConsumptionStatus = (consumptionPerM3: number) => {
    // These thresholds would be configurable based on material type and historical data
    if (consumptionPerM3 <= 100) return "Óptimo";
    if (consumptionPerM3 <= 150) return "Bueno";
    if (consumptionPerM3 <= 200) return "Regular";
    return "Alto";
  };

  const getCostStatus = (costPerM3: number) => {
    if (costPerM3 <= 50) return "Económico";
    if (costPerM3 <= 100) return "Moderado";
    if (costPerM3 <= 150) return "Elevado";
    return "Muy Alto";
  };

  const getEfficiencyStatus = (consumptionPerM3: number) => {
    // Efficiency based on consistency of usage across recipes
    if (consumptionPerM3 <= 120) return "Alta";
    if (consumptionPerM3 <= 180) return "Media";
    return "Baja";
  };

  const getConsumptionStatusBadge = (consumption: number) => {
    const status = getConsumptionStatus(consumption);
    switch (status) {
      case "Óptimo": return "bg-green-50 text-green-700 border-green-200";
      case "Bueno": return "bg-blue-50 text-blue-700 border-blue-200";
      case "Regular": return "bg-orange-50 text-orange-700 border-orange-200";
      case "Alto": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getCostStatusBadge = (cost: number) => {
    const status = getCostStatus(cost);
    switch (status) {
      case "Económico": return "bg-green-50 text-green-700 border-green-200";
      case "Moderado": return "bg-blue-50 text-blue-700 border-blue-200";
      case "Elevado": return "bg-orange-50 text-orange-700 border-orange-200";
      case "Muy Alto": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getEfficiencyStatusBadge = (consumption: number) => {
    const status = getEfficiencyStatus(consumption);
    switch (status) {
      case "Alta": return "bg-green-50 text-green-700 border-green-200";
      case "Media": return "bg-blue-50 text-blue-700 border-blue-200";
      case "Baja": return "bg-orange-50 text-orange-700 border-orange-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  // Calculate global materials summary
  const calculateGlobalMaterialsSummary = async (remisiones: RemisionData[]) => {
    try {
      if (!remisiones || remisiones.length === 0) return null;

      const remisionIds = remisiones.map(r => r.id);
      const chunkSize = 50;
      const materialesResults: any[] = [];

      // Fetch all material consumptions
      for (let i = 0; i < remisionIds.length; i += chunkSize) {
        const chunk = remisionIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('remision_materiales')
          .select(`
            material_id,
            cantidad_real,
            materials!inner(
              material_name,
              material_code,
              category,
              unit_of_measure
            )
          `)
          .in('remision_id', chunk);

        if (error) continue;
        if (data) materialesResults.push(...data);
      }

      // Get material prices
      const materialIds = Array.from(new Set(materialesResults.map((m: any) => m.material_id)));
      const currentDate = format(new Date(), 'yyyy-MM-dd');

      let pricesQuery = supabase
        .from('material_prices')
        .select('material_id, price_per_unit')
        .in('material_id', materialIds)
        .lte('effective_date', currentDate)
        .or(`end_date.is.null,end_date.gte.${currentDate}`)
        .order('effective_date', { ascending: false });

      if (currentPlant?.id) {
        pricesQuery = pricesQuery.eq('plant_id', currentPlant.id);
      }

      const { data: prices } = await pricesQuery;
      const priceMap = new Map();
      prices?.forEach((p: any) => {
        if (!priceMap.has(p.material_id)) {
          priceMap.set(p.material_id, p.price_per_unit);
        }
      });

      // Aggregate by material
      const materialSummary = new Map<string, any>();
      materialesResults.forEach((material: any) => {
        const key = material.material_id;
        const quantity = Number(material.cantidad_real) || 0;
        const price = priceMap.get(material.material_id) || 0;

        if (materialSummary.has(key)) {
          const existing = materialSummary.get(key)!;
          existing.totalConsumption += quantity;
          existing.totalCost += quantity * price;
        } else {
          materialSummary.set(key, {
            material_id: key,
            material_name: material.materials.material_name,
            material_code: material.materials.material_code,
            category: material.materials.category,
            unit: material.materials.unit_of_measure,
            totalConsumption: quantity,
            totalCost: quantity * price,
            hasPrice: price > 0,
            pricePerUnit: price
          });
        }
      });

      // Convert to array and sort by total cost
      const materialsArray = Array.from(materialSummary.values())
        .sort((a, b) => b.totalCost - a.totalCost);

      const totalMaterialsCost = materialsArray.reduce((sum, m) => sum + m.totalCost, 0);
      const materialsWithPrices = materialsArray.filter(m => m.hasPrice);
      const materialsWithoutPrices = materialsArray.filter(m => !m.hasPrice);

      return {
        topMaterials: materialsArray.slice(0, 5),
        totalMaterialsCost,
        materialsWithPrices: materialsWithPrices.length,
        materialsWithoutPrices: materialsWithoutPrices.length,
        totalUniqueMaterials: materialsArray.length,
        materialsByCategory: materialsArray.reduce((acc, material) => {
          const category = material.category || 'Sin Categoría';
          if (!acc[category]) acc[category] = { count: 0, totalCost: 0 };
          acc[category].count++;
          acc[category].totalCost += material.totalCost;
          return acc;
        }, {} as Record<string, { count: number; totalCost: number }>)
      };
    } catch (error) {
      console.error('Error calculating global materials summary:', error);
      return null;
    }
  };

  // Calculate historical trends (comparing with previous periods)
  const calculateHistoricalTrends = async () => {
    try {
      if (!startDate || !endDate) return null;

      const currentPeriodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - currentPeriodDays);

      // Get previous period data
      const { data: previousRemisiones } = await supabase
        .from('remisiones')
        .select('id')
        .eq('tipo_remision', 'CONCRETO')
        .gte('fecha', format(previousPeriodStart, 'yyyy-MM-dd'))
        .lt('fecha', format(startDate, 'yyyy-MM-dd'));

      if (!previousRemisiones || previousRemisiones.length === 0) {
        return {
          comparisonAvailable: false,
          message: 'No hay datos suficientes del período anterior para comparación'
        };
      }

      // Get current period material costs
      const currentPeriodMaterials = await calculateGlobalMaterialsSummary(remisionesData);

      // Get previous period material costs (simplified)
      const previousRemisionIds = previousRemisiones.map(r => r.id);
      const chunkSize = 10;
      let previousTotalCost = 0;

      for (let i = 0; i < previousRemisionIds.length; i += chunkSize) {
        const chunk = previousRemisionIds.slice(i, i + chunkSize);
        const { data: materials } = await supabase
          .from('remision_materiales')
          .select(`
            material_id,
            cantidad_real
          `)
          .in('remision_id', chunk);

        if (materials) {
          const ids = Array.from(new Set(materials.map((m: any) => m.material_id))).filter(Boolean);
          const today = format(new Date(), 'yyyy-MM-dd');
          const priceMap = new Map<string, number>();
          for (let j = 0; j < ids.length; j += 10) {
            const idsChunk = ids.slice(j, j + 10);
            const { data: prices } = await supabase
              .from('material_prices')
              .select('material_id, price_per_unit, effective_date, end_date')
              .in('material_id', idsChunk)
              .lte('effective_date', today)
              .or(`end_date.is.null,end_date.gte.${today}`)
              .order('effective_date', { ascending: false });
            prices?.forEach((p: any) => {
              if (!priceMap.has(p.material_id)) priceMap.set(p.material_id, Number(p.price_per_unit) || 0);
            });
          }
          materials.forEach((m: any) => {
            const price = Number(priceMap.get(m.material_id)) || 0;
            previousTotalCost += (Number(m.cantidad_real) || 0) * price;
          });
        }
      }

      if (currentPeriodMaterials && previousTotalCost > 0) {
        const currentCost = currentPeriodMaterials.totalMaterialsCost;
        const costChange = ((currentCost - previousTotalCost) / previousTotalCost) * 100;

        return {
          comparisonAvailable: true,
          currentPeriod: {
            cost: currentCost,
            materials: currentPeriodMaterials.totalUniqueMaterials
          },
          previousPeriod: {
            cost: previousTotalCost,
            materials: previousRemisiones.length
          },
          costChange,
          costChangeStatus: costChange > 0 ? 'increase' : costChange < 0 ? 'decrease' : 'stable'
        };
      }

      return {
        comparisonAvailable: false,
        message: 'Datos insuficientes para análisis de tendencias'
      };
    } catch (error) {
      console.error('Error calculating historical trends:', error);
      return {
        comparisonAvailable: false,
        message: 'Error al calcular tendencias históricas'
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
    const avgCementConsumptionPerM3 = totalVolume > 0 ? totalCementConsumption / totalVolume : 0;

    return {
      totalVolume,
      totalMaterialCost,
      totalCementCost,
      totalCementConsumption,
      weightedAvgCostPerM3,
      avgCementConsumptionPerM3,
      cementCostPercentage: totalMaterialCost > 0 ? (totalCementCost / totalMaterialCost) * 100 : 0
    };
  }, [filteredProductionData]);

  // Data for volume by strength as percentage cards
  const volumeByStrengthCards = useMemo(() => {
    const totalVolume = filteredProductionData.reduce((sum, item) => sum + item.total_volume, 0);
    
    if (totalVolume === 0) return [];
    
    const cards = filteredProductionData.map((item, index) => ({
      id: `${item.recipe_id}-${item.strength_fc}-${index}`, // Unique key using recipe_id and index
      strength: item.strength_fc,
      volume: item.total_volume,
      percentage: (item.total_volume / totalVolume) * 100,
      remisiones: item.remisiones_count,
      recipe_code: item.recipe_code
    }));
    
    // Sort by percentage descending to show highest volume first
    return cards.sort((a, b) => b.percentage - a.percentage);
  }, [filteredProductionData]);

  // Chart data for cement consumption trend over the last months
  const [cementTrendData, setCementTrendData] = useState<{
    categories: string[];
    series: { name: string; data: number[] }[];
  }>({ categories: [], series: [] });
  const [trendLoading, setTrendLoading] = useState(false);

  // Fetch cement consumption trend data (optimized single-range approach)
  const fetchCementTrendData = async () => {
    if (!currentPlant?.id) return;

    setTrendLoading(true);
    try {
      const monthsToShow = 6;
      const monthKeys: string[] = [];
      const monthLabels: string[] = [];
      const now = new Date();
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const targetDate = subMonths(now, i);
        const key = format(targetDate, 'yyyy-MM');
        monthKeys.push(key);
        monthLabels.push(format(targetDate, 'MMM yyyy', { locale: es }));
      }

      const rangeStart = startOfMonth(subMonths(now, monthsToShow - 1));
      const rangeEnd = endOfMonth(now);
      const formattedStart = format(rangeStart, 'yyyy-MM-dd');
      const formattedEnd = format(rangeEnd, 'yyyy-MM-dd');

      // 1) Fetch all remisiones in the full range
      const { data: rems, error: remErr } = await supabase
        .from('remisiones')
        .select('id, fecha, volumen_fabricado')
        .eq('tipo_remision', 'CONCRETO')
        .eq('plant_id', currentPlant.id)
        .gte('fecha', formattedStart)
        .lte('fecha', formattedEnd);
      if (remErr) throw remErr;

      const monthToVolume = new Map<string, number>();
      const allIds: string[] = (rems || []).map((r: any) => r.id);

      if (allIds.length === 0) {
        setCementTrendData({ categories: monthLabels, series: [{ name: 'Consumo Cemento (kg/m³)', data: monthLabels.map(() => 0) }] });
        setTrendLoading(false);
        return;
      }

      // 2) Fetch remision_materiales for all ids with materials join in chunks (unified detection)
      const chunkSize = 25;
      const idToMonth = new Map<string, string>();
      const idToVolume = new Map<string, number>();
      (rems || []).forEach((r: any) => {
        const f: string = String(r.fecha || '');
        const mk = f.length >= 7 ? f.slice(0, 7) : '';
        if (mk) idToMonth.set(r.id, mk);
        idToVolume.set(r.id, Number(r.volumen_fabricado) || 0);
      });
      const monthToCement = new Map<string, number>();
      const includedRemisionIds = new Set<string>();
      for (let i = 0; i < allIds.length; i += chunkSize) {
        const chunk = allIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('remision_materiales')
          .select('remision_id, cantidad_real, materials(material_name, category, material_code)')
          .in('remision_id', chunk);
        if (error) {
          console.error('Error fetching materiales+materials chunk for trend:', error);
          continue;
        }
        (data || []).forEach((row: any) => {
          if (row && row.remision_id) includedRemisionIds.add(row.remision_id);
          const mk = idToMonth.get(row.remision_id);
          if (!mk) return;
          const haystack = `${String(row.materials?.category||'').toLowerCase()} ${String(row.materials?.material_name||'').toLowerCase()} ${String(row.materials?.material_code||'').toLowerCase()}`;
          const isCement = haystack.includes('cement') || haystack.includes('cemento') || haystack.includes('cem ') || haystack.includes(' cem') || haystack.includes('cem-') || haystack.includes('cem40') || haystack.includes('cem 40');
          if (!isCement) return;
          monthToCement.set(mk, (monthToCement.get(mk) || 0) + (Number(row.cantidad_real) || 0));
        });
      }

      // 3) Aggregate month volumes ONLY for remisiones that have materiales, by their own month
      (rems || []).forEach((r: any) => {
        if (!includedRemisionIds.has(r.id)) return;
        const mk = idToMonth.get(r.id);
        if (!mk) return;
        monthToVolume.set(mk, (monthToVolume.get(mk) || 0) + (idToVolume.get(r.id) || 0));
      });

      // 5) Build series in correct order
      let dataPoints = monthKeys.map(key => {
        const vol = monthToVolume.get(key) || 0;
        const cementQty = monthToCement.get(key) || 0;
        return vol > 0 ? cementQty / vol : 0;
      });

      // Fallback path no longer needed after unified join; keep for safety only if desired

      setCementTrendData({
        categories: monthLabels,
        series: [{ name: 'Consumo Cemento (kg/m³)', data: dataPoints }]
      });

    } catch (error) {
      console.error('Error fetching cement trend data:', error);
    } finally {
      setTrendLoading(false);
    }
  };

  // Fetch trend data when component mounts or plant changes
  useEffect(() => {
    fetchCementTrendData();
  }, [currentPlant]);


  // Chart options for cement consumption trend
  const cementTrendChartOptions: ApexOptions = {
    chart: {
      type: 'line',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    colors: ['#FF6B35'],
    stroke: {
      width: 3,
      curve: 'smooth'
    },
    markers: {
      size: 6,
      colors: ['#FF6B35'],
      strokeColors: '#ffffff',
      strokeWidth: 2,
      hover: {
        size: 8
      }
    },
    xaxis: {
      categories: cementTrendData.categories,
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
        text: 'Consumo de Cemento (kg/m³)',
        style: {
          fontSize: '14px',
          fontWeight: 600,
          color: '#374151'
        }
      },
      labels: {
        formatter: (val: number) => `${val.toFixed(1)}`,
        style: {
          fontSize: '12px',
          colors: '#6B7280'
        }
      }
    },
    grid: {
      borderColor: '#F3F4F6',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } }
    },
    tooltip: {
      y: {
        formatter: (val: number) => `${val.toFixed(2)} kg/m³`
      },
      style: { fontSize: '12px' }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val.toFixed(1)}`,
      style: {
        fontSize: '11px',
        fontWeight: 500,
        colors: ['#FF6B35']
      },
      background: {
        enabled: true,
        foreColor: '#ffffff',
        borderRadius: 4,
        padding: 4,
        opacity: 0.9
      },
      offsetY: -10
    }
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
        'Consumo Cemento (kg)': item.cement_consumption,
        'Cemento por m³ (kg/m³)': (item.cement_consumption / item.total_volume).toFixed(2)
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
        'Consumo Cemento (kg)': summaryMetrics.totalCementConsumption,
        'Cemento por m³ (kg/m³)': summaryMetrics.avgCementConsumptionPerM3.toFixed(2)
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
        { wch: 20 }, // Consumo Cemento
        { wch: 20 }  // Cemento por m³
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

  // Fetch investigation data
  const fetchInvestigationData = async () => {
    if (!startDate || !endDate) return;

    setInvestigationLoading(true);
    try {
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');

      // 1. Fetch all remisiones with detailed material consumption
      let remisionesQuery = supabase
        .from('remisiones')
        .select(`
          id,
          remision_number,
          fecha,
          volumen_fabricado,
          recipe_id,
          order_id,
          plant_id,
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

      if (currentPlant?.id) {
        remisionesQuery = remisionesQuery.eq('plant_id', currentPlant.id);
      }

      const { data: remisiones, error: remisionesError } = await remisionesQuery;
      if (remisionesError) throw remisionesError;

      // 2. Fetch material consumption details - chunked to avoid URL length limits
      const remisionIds = remisiones.map((r: any) => r.id);
      const chunkSize = 10; // Supabase has URL length limits, so we chunk the requests
      const materialesResults: any[] = [];
      
      console.log(`Fetching material consumption data for ${remisionIds.length} remisiones in chunks of ${chunkSize}`);
      
      for (let i = 0; i < remisionIds.length; i += chunkSize) {
        const chunk = remisionIds.slice(i, i + chunkSize);
        const currentChunk = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(remisionIds.length / chunkSize);
        
        setInvestigationProgress(`Procesando chunk ${currentChunk}/${totalChunks} - ${chunk.length} remisiones`);
        console.log(`Processing chunk ${currentChunk}/${totalChunks}`);
        
        const { data, error } = await supabase
          .from('remision_materiales')
          .select(`
            remision_id,
            material_id,
            cantidad_real,
            materials!inner(
              id,
              material_name,
              material_code,
              category,
              unit_of_measure
            )
          `)
          .in('remision_id', chunk);
        
        if (error) {
          console.error(`Error fetching remision_materiales chunk ${currentChunk}:`, error);
          
          // Try to retry the chunk once
          console.log(`Retrying chunk ${currentChunk}...`);
          const retryResult = await supabase
            .from('remision_materiales')
            .select(`
              remision_id,
              material_id,
              cantidad_real,
              materials!inner(
                id,
                material_name,
                material_code,
                category,
                unit_of_measure
              )
            `)
            .in('remision_id', chunk);
          
          if (retryResult.error) {
            console.error(`Retry failed for chunk ${currentChunk}:`, retryResult.error);
            continue; // Continue with other chunks even if retry fails
          }
          
          if (retryResult.data) {
            materialesResults.push(...retryResult.data);
            console.log(`Retry successful for chunk ${currentChunk}`);
          }
        }
        
        if (data) {
          materialesResults.push(...data);
        }
      }
      
      const materiales = materialesResults;
      const totalChunks = Math.ceil(remisionIds.length / chunkSize);
      console.log(`Successfully fetched material consumption data for ${materiales.length} records from ${totalChunks} chunks`);

      // 3. Fetch all material prices
      const materialIds = Array.from(new Set(materiales.map((m: any) => m.material_id)));
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      
      let pricesQuery = supabase
        .from('material_prices')
        .select('material_id, price_per_unit, effective_date, end_date, plant_id')
        .in('material_id', materialIds)
        .lte('effective_date', currentDate)
        .or(`end_date.is.null,end_date.gte.${currentDate}`)
        .order('effective_date', { ascending: false });

      if (currentPlant?.id) {
        pricesQuery = pricesQuery.eq('plant_id', currentPlant.id);
      }

      const { data: materialPrices, error: pricesError } = await pricesQuery;
      if (pricesError) throw pricesError;

      // 4. Create price lookup map
      const priceMap = new Map();
      materialPrices?.forEach((mp: any) => {
        if (!priceMap.has(mp.material_id)) {
          priceMap.set(mp.material_id, mp.price_per_unit);
        }
      });

      // 5. Process recipe consumption data
      const recipeConsumption = new Map<string, RecipeConsumptionData>();
      const materialConsumptionMap = new Map<string, MaterialConsumptionDetail>();

      // Group by recipe
      remisiones.forEach((remision: any) => {
        const recipeKey = remision.recipe_id;
        if (!recipeConsumption.has(recipeKey)) {
          recipeConsumption.set(recipeKey, {
            recipe_id: remision.recipe_id,
            recipe_code: remision.recipes.recipe_code,
            strength_fc: remision.recipes.strength_fc,
            remisiones_count: 0,
            total_volume: 0,
            materials: []
          });
        }

        const recipe = recipeConsumption.get(recipeKey)!;
        recipe.remisiones_count++;
        recipe.total_volume += remision.volumen_fabricado;
      });

      // Process material consumption
      materiales.forEach((material: any) => {
        const materialKey = `${material.material_id}-${material.materials.material_name}`;
        if (!materialConsumptionMap.has(materialKey)) {
          materialConsumptionMap.set(materialKey, {
            material_id: material.material_id,
            material_name: material.materials.material_name,
            material_code: material.materials.material_code,
            category: material.materials.category,
            total_consumption: 0,
            unit: material.materials.unit_of_measure,
            has_price: priceMap.has(material.material_id),
            price: priceMap.get(material.material_id) || 0,
            total_cost: 0
          });
        }

        const mat = materialConsumptionMap.get(materialKey)!;
        mat.total_consumption += material.cantidad_real;
        mat.total_cost = mat.total_consumption * mat.price;
      });

      // Add materials to recipes
      recipeConsumption.forEach((recipe) => {
        recipe.materials = Array.from(materialConsumptionMap.values());
      });

      // 6. Identify materials without prices
      const missingPrices: MissingPriceData[] = [];
      materialConsumptionMap.forEach((material) => {
        if (!material.has_price) {
          missingPrices.push({
            material_id: material.material_id,
            material_name: material.material_name,
            material_code: material.material_code,
            category: material.category,
            unit_of_measure: material.unit
          });
        }
      });

      // 7. Create material prices summary
      const materialPricesSummary: MaterialPriceData[] = Array.from(materialConsumptionMap.values()).map(material => ({
        material_id: material.material_id,
        material_name: material.material_name,
        material_code: material.material_code,
        category: material.category,
        unit_of_measure: material.unit,
        current_price: material.price,
        effective_date: material.has_price ? 'Current' : 'N/A',
        plant_id: currentPlant?.id || null,
        has_price: material.has_price
      }));

      setInvestigationData({
        remisiones: remisiones.map((r: any) => ({
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
        })),
        materialPrices: materialPricesSummary,
        recipeConsumption: Array.from(recipeConsumption.values()),
        missingPrices
      });

      setInvestigationProgress(''); // Clear progress when complete

    } catch (error) {
      console.error('Error fetching investigation data:', error);
    } finally {
      setInvestigationLoading(false);
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
                  {availableStrengths.map((strength: number) => (
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

      {(loading && productionData.length === 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : null}

      {streaming && (
        <div className="w-full mb-6">
          <div className="w-full bg-gray-100 border rounded h-2 overflow-hidden">
            <div className="bg-blue-500 h-2" style={{ width: `${Math.round((progress.processed / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
          <div className="text-xs text-muted-foreground mt-1 text-center">
            Progresando… {Math.round((progress.processed / Math.max(1, progress.total)) * 100)}%
          </div>
        </div>
      )}

      <div>
          <SummaryCardsV2
            totalVolume={summaryMetrics.totalVolume}
            totalMaterialCost={summaryMetrics.totalMaterialCost}
            weightedAvgCostPerM3={summaryMetrics.weightedAvgCostPerM3}
            totalCementConsumption={summaryMetrics.totalCementConsumption}
            avgCementPerM3={summaryMetrics.avgCementConsumptionPerM3}
          />

          {/* Global Materials Summary */}
          {globalMaterialsSummary && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Resumen Global de Materiales
                </CardTitle>
                <CardDescription>
                  Análisis rápido del estado general de consumo y costos de materiales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Total Materials Cost */}
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      <DollarSign className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Costo Total Materiales</p>
                      <p className="text-2xl font-bold">{formatCurrency(globalMaterialsSummary.totalMaterialsCost)}</p>
                    </div>
                  </div>

                  {/* Materials with/without prices */}
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      {globalMaterialsSummary.materialsWithoutPrices > 0 ? (
                        <AlertTriangle className="h-8 w-8 text-orange-500" />
                      ) : (
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Materiales con Precio</p>
                      <p className="text-2xl font-bold">
                        {globalMaterialsSummary.materialsWithPrices}/{globalMaterialsSummary.totalUniqueMaterials}
                      </p>
                      {globalMaterialsSummary.materialsWithoutPrices > 0 && (
                        <p className="text-xs text-orange-600">
                          {globalMaterialsSummary.materialsWithoutPrices} sin precio
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Top Material */}
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      <TrendingUp className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Material Principal</p>
                      <p className="text-lg font-bold truncate max-w-[150px]">
                        {globalMaterialsSummary.topMaterials[0]?.material_name || 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(globalMaterialsSummary.topMaterials[0]?.totalCost || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Historical Trend */}
                  <div className="flex items-center space-x-3 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      {historicalTrends?.costChangeStatus === 'increase' ? (
                        <ArrowUpIcon className="h-8 w-8 text-red-500" />
                      ) : historicalTrends?.costChangeStatus === 'decrease' ? (
                        <ArrowDownIcon className="h-8 w-8 text-green-500" />
                      ) : (
                        <TrendingUp className="h-8 w-8 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tendencia vs Período Anterior</p>
                      {historicalTrends?.comparisonAvailable ? (
                        <>
                          <p className={`text-2xl font-bold ${
                            historicalTrends?.costChangeStatus === 'increase' ? 'text-red-600' :
                            historicalTrends?.costChangeStatus === 'decrease' ? 'text-green-600' :
                            'text-gray-600'
                          }`}>
                            {(historicalTrends?.costChange ?? 0) >= 0 ? '+' : ''}{(historicalTrends?.costChange ?? 0).toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cambio en costo de materiales
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-gray-500">N/A</p>
                          <p className="text-xs text-muted-foreground">
                            {historicalTrends?.message || 'Datos insuficientes'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Materials Table */}
                <div className="mb-4">
                  <h4 className="text-lg font-semibold mb-3">Top 5 Materiales por Costo</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Material</th>
                          <th className="text-left py-2">Código</th>
                          <th className="text-left py-2">Categoría</th>
                          <th className="text-right py-2">Consumo Total</th>
                          <th className="text-right py-2">Costo Total</th>
                          <th className="text-center py-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalMaterialsSummary.topMaterials.slice(0, 5).map((material: any, index: number) => (
                          <tr key={material.material_id} className="border-b hover:bg-gray-50">
                            <td className="py-2 font-medium">{material.material_name}</td>
                            <td className="py-2 font-mono text-sm">{material.material_code}</td>
                            <td className="py-2">
                              <Badge variant="outline" className="text-xs">
                                {material.category}
                              </Badge>
                            </td>
                            <td className="py-2 text-right">
                              {material.totalConsumption.toFixed(2)} {material.unit}
                            </td>
                            <td className="py-2 text-right font-medium">
                              {formatCurrency(material.totalCost)}
                            </td>
                            <td className="py-2 text-center">
                              {material.hasPrice ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-orange-600 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Materials by Category */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Materiales por Categoría</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(globalMaterialsSummary.materialsByCategory).map(([category, data]: [string, any]) => (
                      <div key={category} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">{category}</h5>
                          <Badge variant="secondary">{data.count} materiales</Badge>
                        </div>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatCurrency(data.totalCost)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Costo total de la categoría
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Volumen por Resistencia</CardTitle>
                <CardDescription>Distribución de la producción por tipo de concreto</CardDescription>
              </CardHeader>
              <CardContent>
                <VolumeByStrengthCardsV2 items={volumeByStrengthCards as any} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Tendencia de Consumo de Cemento por m³
                </CardTitle>
                <CardDescription>
                  Evolución del consumo de cemento por metro cúbico en los últimos meses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CementTrendComponent
                  categories={trendCatsV2}
                  data={(trendSeriesV2 && trendSeriesV2[0] && Array.isArray(trendSeriesV2[0].data)) ? trendSeriesV2[0].data as number[] : []}
                  loading={!!trendLoadingV2}
                />
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="summary">
                    Resumen por Resistencia
                  </TabsTrigger>
                  <TabsTrigger value="materials">
                    Desglose de Materiales por Resistencia
                  </TabsTrigger>
                  <TabsTrigger value="material-analysis">
                    Análisis por Material
                  </TabsTrigger>
                  <TabsTrigger value="investigation">
                    Herramienta de Investigación
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <ProductionSummaryTableV2 items={filteredProductionData as any} summary={summaryMetrics as any} />
                </TabsContent>

                <TabsContent value="materials">
                  <div className="space-y-6">
                    {(() => {
                      const aggMap = filteredProductionData.reduce((map: Map<number, any>, item: any) => {
                        const key = item.strength_fc;
                        const existing = map.get(key) || {
                          strength_fc: key,
                          total_volume: 0,
                          total_cost: 0,
                          breakdown: new Map<string, any>()
                        };
                        existing.total_volume += item.total_volume;
                        existing.total_cost += item.total_material_cost;
                        item.materials_breakdown.forEach((mb: any) => {
                          const b = existing.breakdown.get(mb.material_name) || {
                            material_type: mb.material_type,
                            material_name: mb.material_name,
                            total_consumption: 0,
                            unit: mb.unit,
                            total_cost: 0,
                            cost_per_unit: mb.cost_per_unit,
                          };
                          b.total_consumption += mb.total_consumption;
                          b.total_cost += mb.total_cost;
                          existing.breakdown.set(mb.material_name, b);
                        });
                        map.set(key, existing);
                        return map;
                      }, new Map<number, any>());
                      const strengths = Array.from(aggMap.entries())
                        .sort((a, b) => a[0] - b[0])
                        .map(([k, v]) => v);
                      return <MaterialsByStrengthTableV2 strengths={strengths} />;
                    })()}
                  </div>
                </TabsContent>

                <TabsContent value="material-analysis">
                  <div className="space-y-6">
                    {/* Material Selection */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Análisis de Consumo por Material
                        </CardTitle>
                        <CardDescription>
                          Selecciona un material para analizar su consumo total en el período
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Seleccionar Material</Label>
                            <Select value={selectedMaterial} onValueChange={handleMaterialChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un material..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableMaterials.map((material: any) => (
                                  <SelectItem key={material.id} value={material.id}>
                                    {material.name} ({material.code}) - {material.category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {materialAnalysisLoading && (
                            <div className="flex items-center justify-center py-8">
                              <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-muted-foreground">Analizando consumo del material...</p>
                                <p className="text-xs text-muted-foreground mt-2">Esto puede tomar unos segundos</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Material Consumption Summary - Enhanced KPI Cards */}
                    {materialConsumptionData && materialConsumptionData.material && !materialAnalysisLoading && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Package className="h-5 w-5 text-blue-600" />
                                  <CardTitle className="text-lg font-bold">Consumo Total</CardTitle>
                                </div>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {getConsumptionStatus(materialConsumptionData.consumptionPerM3)}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">Material utilizado en el período</p>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold text-blue-600">
                                {materialConsumptionData.totalConsumption.toFixed(2)}
                                <span className="text-sm font-normal text-muted-foreground ml-1">
                                  {materialConsumptionData.material?.unit || 'unidades'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Promedio: {materialConsumptionData.consumptionPerM3.toFixed(3)} {materialConsumptionData.material?.unit || 'unidades'}/m³
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="absolute top-0 left-0 w-full h-1 bg-green-500" />
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <DollarSign className="h-5 w-5 text-green-600" />
                                  <CardTitle className="text-lg font-bold">Costo Total</CardTitle>
                                </div>
                                <Badge variant="outline" className={getCostStatusBadge(materialConsumptionData.costPerM3)}>
                                  {getCostStatus(materialConsumptionData.costPerM3)}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">Inversión en material</p>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold text-green-600">
                                {materialConsumptionData.hasPrice ? formatCurrency(materialConsumptionData.totalCost) : 'N/A'}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {materialConsumptionData.hasPrice
                                  ? `${formatCurrency(materialConsumptionData.costPerM3)}/m³`
                                  : 'Precio no configurado'
                                }
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="absolute top-0 left-0 w-full h-1 bg-purple-500" />
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <TrendingUp className="h-5 w-5 text-purple-600" />
                                  <CardTitle className="text-lg font-bold">Eficiencia</CardTitle>
                                </div>
                                <Badge variant="outline" className={getEfficiencyStatusBadge(materialConsumptionData.consumptionPerM3)}>
                                  {getEfficiencyStatus(materialConsumptionData.consumptionPerM3)}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">Rendimiento operativo</p>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold text-purple-600">
                                {materialConsumptionData.totalVolume.toFixed(1)} m³
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {materialConsumptionData.remisionesCount} remisiones procesadas
                              </p>
                            </CardContent>
                          </Card>

                          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <BarChart3 className="h-5 w-5 text-orange-600" />
                                  <CardTitle className="text-lg font-bold">Distribución</CardTitle>
                                </div>
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                  {materialConsumptionData.consumptionByRecipe.length} tipos
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">Variedad de aplicaciones</p>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold text-orange-600">
                                {materialConsumptionData.consumptionByRecipe.length}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Recetas que lo utilizan
                              </p>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Material Details */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Información del Material</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="font-medium">Nombre:</span>
                                  <span>{materialConsumptionData.material.name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-medium">Código:</span>
                                  <span className="font-mono">{materialConsumptionData.material.code}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-medium">Categoría:</span>
                                  <Badge variant="outline">{materialConsumptionData.material.category}</Badge>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="font-medium">Unidad:</span>
                                  <span>{materialConsumptionData.material?.unit || 'unidades'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-medium">Precio Unitario:</span>
                                  <span className={materialConsumptionData.hasPrice ? "font-medium" : "text-red-600"}>
                                    {materialConsumptionData.hasPrice ? formatCurrency(materialConsumptionData.pricePerUnit) : 'Sin precio'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="font-medium">Costo por m³:</span>
                                  <span className="font-medium">
                                    {materialConsumptionData.hasPrice ? formatCurrency(materialConsumptionData.costPerM3) : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Enhanced Visualizations */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                          {/* Consumption by Recipe Chart */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Consumo por Resistencia
                              </CardTitle>
                              <CardDescription>
                                Distribución del material por tipo de concreto
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {typeof window !== 'undefined' && (
                                <Chart
                                  options={{
                                    chart: {
                                      type: 'bar',
                                      toolbar: { show: false },
                                      background: 'transparent',
                                      fontFamily: 'Inter, system-ui, sans-serif'
                                    },
                                    colors: ['#3b82f6'],
                                    plotOptions: {
                                      bar: {
                                        borderRadius: 8,
                                        columnWidth: '60%',
                                        dataLabels: { position: 'top' }
                                      }
                                    },
                                    xaxis: {
                                      categories: materialConsumptionData.consumptionByRecipe.map((r: any) => `${r.strength_fc} kg/cm²`),
                                      labels: {
                                        style: {
                                          fontSize: '12px',
                                          fontWeight: 500,
                                          colors: '#6B7280'
                                        }
                                      }
                                    },
                                    yaxis: {
                                      title: {
                                        text: `Consumo (${materialConsumptionData.material?.unit || 'unidades'})`,
                                        style: {
                                          fontSize: '14px',
                                          fontWeight: 600,
                                          color: '#374151'
                                        }
                                      },
                                      labels: {
                                        formatter: (val: number) => val.toFixed(1),
                                        style: {
                                          fontSize: '12px',
                                          colors: '#6B7280'
                                        }
                                      }
                                    },
                                    tooltip: {
                                      y: {
                                        formatter: (val: number) => `${val.toFixed(2)} ${materialConsumptionData.material?.unit || 'unidades'}`
                                      }
                                    },
                                    dataLabels: {
                                      enabled: true,
                                      formatter: (val: number) => val.toFixed(1),
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
                                    }
                                  }}
                                  series={[{
                                    name: 'Consumo Total',
                                    data: materialConsumptionData.consumptionByRecipe.map((r: any) => r.total_consumption)
                                  }]}
                                  type="bar"
                                  height={300}
                                />
                              )}
                            </CardContent>
                          </Card>

                          {/* Efficiency Analysis Chart */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Eficiencia por Receta
                              </CardTitle>
                              <CardDescription>
                                Consumo por metro cúbico según resistencia
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {typeof window !== 'undefined' && (
                                <Chart
                                  options={{
                                    chart: {
                                      type: 'line',
                                      toolbar: { show: false },
                                      background: 'transparent',
                                      fontFamily: 'Inter, system-ui, sans-serif'
                                    },
                                    colors: ['#10b981', '#f59e0b'],
                                    stroke: {
                                      curve: 'smooth',
                                      width: [3, 3]
                                    },
                                    markers: {
                                      size: 6,
                                      colors: ['#10b981', '#f59e0b'],
                                      strokeColors: '#ffffff',
                                      strokeWidth: 2
                                    },
                                    xaxis: {
                                      categories: materialConsumptionData.consumptionByRecipe.map((r: any) => `${r.strength_fc}`),
                                      labels: {
                                        style: {
                                          fontSize: '12px',
                                          fontWeight: 500,
                                          colors: '#6B7280'
                                        }
                                      },
                                      title: {
                                        text: 'Resistencia (kg/cm²)',
                                        style: {
                                          fontSize: '14px',
                                          fontWeight: 600,
                                          color: '#374151'
                                        }
                                      }
                                    },
                                    yaxis: {
                                      title: {
                                        text: `${materialConsumptionData.material?.unit || 'unidades'}/m³`,
                                        style: {
                                          fontSize: '14px',
                                          fontWeight: 600,
                                          color: '#374151'
                                        }
                                      },
                                      labels: {
                                        formatter: (val: number) => val.toFixed(2),
                                        style: {
                                          fontSize: '12px',
                                          colors: '#6B7280'
                                        }
                                      }
                                    },
                                    tooltip: {
                                      shared: true,
                                      intersect: false,
                                      y: {
                                        formatter: (val: number) => `${val.toFixed(3)} ${materialConsumptionData.material?.unit || 'unidades'}/m³`
                                      }
                                    },
                                    legend: {
                                      position: 'top',
                                      horizontalAlign: 'left',
                                      fontSize: '14px'
                                    }
                                  }}
                                  series={[
                                    {
                                      name: 'Consumo por m³',
                                      data: materialConsumptionData.consumptionByRecipe.map((r: any) =>
                                        r.total_volume > 0 ? r.total_consumption / r.total_volume : 0
                                      )
                                    },
                                    {
                                      name: 'Línea Base',
                                      data: materialConsumptionData.consumptionByRecipe.map(() => materialConsumptionData.consumptionPerM3)
                                    }
                                  ]}
                                  type="line"
                                  height={300}
                                />
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Consumption by Recipe Table */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Consumo por Receta - Detalles</CardTitle>
                            <CardDescription>
                              Análisis detallado del consumo del material por tipo de concreto
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Receta</TableHead>
                                    <TableHead>Resistencia</TableHead>
                                    <TableHead className="text-right">Consumo Total</TableHead>
                                    <TableHead className="text-right">Remisiones</TableHead>
                                    <TableHead className="text-right">Volumen (m³)</TableHead>
                                    <TableHead className="text-right">Consumo/m³</TableHead>
                                    <TableHead className="text-right">Eficiencia</TableHead>
                                    {materialConsumptionData.hasPrice && (
                                      <TableHead className="text-right">Costo</TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {materialConsumptionData.consumptionByRecipe.map((recipe: any, index: number) => {
                                    const consumptionPerM3 = recipe.total_volume > 0 ? recipe.total_consumption / recipe.total_volume : 0;
                                    const efficiency = consumptionPerM3 / materialConsumptionData.consumptionPerM3;
                                    const efficiencyStatus = efficiency <= 0.9 ? "Excelente" : efficiency <= 1.1 ? "Normal" : "Ineficiente";

                                    return (
                                      <TableRow key={index}>
                                        <TableCell className="font-medium">
                                          {recipe.recipe_code}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline">
                                            {recipe.strength_fc} kg/cm²
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                          {recipe.total_consumption.toFixed(2)} {materialConsumptionData.material?.unit || 'unidades'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {recipe.remisiones_count}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {recipe.total_volume.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {consumptionPerM3.toFixed(3)} {materialConsumptionData.material?.unit || 'unidades'}/m³
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Badge variant="outline" className={
                                            efficiencyStatus === "Excelente" ? "bg-green-50 text-green-700 border-green-200" :
                                            efficiencyStatus === "Normal" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                            "bg-orange-50 text-orange-700 border-orange-200"
                                          }>
                                            {efficiencyStatus}
                                          </Badge>
                                        </TableCell>
                                        {materialConsumptionData.hasPrice && (
                                          <TableCell className="text-right font-medium">
                                            {formatCurrency(recipe.total_consumption * materialConsumptionData.pricePerUnit)}
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Export and Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                if (!materialConsumptionData) return;

                                const workbook = XLSX.utils.book_new();

                                // Summary sheet
                                const summaryData = [{
                                  'Material': materialConsumptionData.material.name,
                                  'Código': materialConsumptionData.material.code,
                                  'Categoría': materialConsumptionData.material.category,
                                  'Unidad': materialConsumptionData.material?.unit || 'unidades',
                                  'Consumo Total': materialConsumptionData.totalConsumption,
                                  'Consumo por m³': materialConsumptionData.consumptionPerM3,
                                  'Costo Total': materialConsumptionData.hasPrice ? materialConsumptionData.totalCost : 'N/A',
                                  'Precio Unitario': materialConsumptionData.hasPrice ? materialConsumptionData.pricePerUnit : 'N/A',
                                  'Remisiones': materialConsumptionData.remisionesCount,
                                  'Volumen Total (m³)': materialConsumptionData.totalVolume
                                }];

                                // Recipe breakdown sheet
                                const recipeData = materialConsumptionData.consumptionByRecipe.map((recipe: any) => ({
                                  'Receta': recipe.recipe_code,
                                  'Resistencia (kg/cm²)': recipe.strength_fc,
                                  'Consumo Total': recipe.total_consumption,
                                  'Remisiones': recipe.remisiones_count,
                                  'Volumen (m³)': recipe.total_volume,
                                  'Consumo por m³': recipe.total_volume > 0 ? recipe.total_consumption / recipe.total_volume : 0,
                                  'Costo': materialConsumptionData.hasPrice ? recipe.total_consumption * materialConsumptionData.pricePerUnit : 'N/A'
                                }));

                                XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryData), 'Resumen');
                                XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(recipeData), 'Por Receta');

                                const filename = `Analisis_Material_${materialConsumptionData.material.code}_${format(startDate!, 'dd-MM-yyyy')}_${format(endDate!, 'dd-MM-yyyy')}.xlsx`;
                                XLSX.writeFile(workbook, filename);
                              }}
                              variant="outline"
                              size="sm"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Exportar Excel
                            </Button>

                            <Button
                              onClick={() => setSelectedMaterial('')}
                              variant="outline"
                              size="sm"
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Cambiar Material
                            </Button>
                          </div>
                        </div>

                        {/* Interpretation Guide */}
                        <Card className="mt-6">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Info className="h-5 w-5" />
                              Guía de Interpretación
                            </CardTitle>
                            <CardDescription>
                              Cómo interpretar los indicadores y gráficos del análisis de materiales
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    Estados de Consumo
                                  </h4>
                                  <ul className="text-sm text-muted-foreground space-y-1">
                                    <li><strong>Óptimo:</strong> Consumo eficiente y controlado</li>
                                    <li><strong>Bueno:</strong> Consumo dentro de rangos normales</li>
                                    <li><strong>Regular:</strong> Consumo elevado, requiere atención</li>
                                    <li><strong>Alto:</strong> Consumo excesivo, acción inmediata</li>
                                  </ul>
                                </div>

                                <div>
                                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    Estados de Costo
                                  </h4>
                                  <ul className="text-sm text-muted-foreground space-y-1">
                                    <li><strong>Económico:</strong> Costo por debajo del promedio</li>
                                    <li><strong>Moderado:</strong> Costo dentro de lo esperado</li>
                                    <li><strong>Elevado:</strong> Costo superior al promedio</li>
                                    <li><strong>Muy Alto:</strong> Costo crítico, revisar precios</li>
                                  </ul>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    Eficiencia por Receta
                                  </h4>
                                  <ul className="text-sm text-muted-foreground space-y-1">
                                    <li><strong>Excelente:</strong> ≤90% del promedio (muy eficiente)</li>
                                    <li><strong>Normal:</strong> 90-110% del promedio (óptimo)</li>
                                    <li><strong>Ineficiente:</strong> &gt;110% del promedio (revisar)</li>
                                  </ul>
                                </div>

                                <div>
                                  <h4 className="font-semibold text-sm mb-2">Recomendaciones</h4>
                                  <ul className="text-sm text-muted-foreground space-y-1">
                                    <li>• Compare con datos históricos para tendencias</li>
                                    <li>• Revise precios cuando estado sea "Muy Alto"</li>
                                    <li>• Optimice recetas con eficiencia "Ineficiente"</li>
                                    <li>• Monitoree materiales sin precios configurados</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}

                    {!selectedMaterial && !materialAnalysisLoading && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Selecciona un material del listado para ver su análisis de consumo detallado.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="investigation">
                  <div className="space-y-6">
                    {/* Investigation Controls */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Search className="h-5 w-5" />
                          Herramienta de Investigación
                        </CardTitle>
                        <CardDescription>
                          Analiza datos detallados de remisiones, consumo de materiales y precios para validación.
                          <br />
                          <span className="text-sm text-amber-600 font-medium">
                            💡 Para períodos largos, considera usar rangos de fechas más pequeños para mejor rendimiento.
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 mb-4">
                          <Button 
                            onClick={fetchInvestigationData}
                            disabled={investigationLoading}
                            variant="outline"
                          >
                            {investigationLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                Procesando...
                              </>
                            ) : (
                              'Cargar Datos de Investigación'
                            )}
                          </Button>
                          {investigationData && (
                            <Button 
                              onClick={() => {
                                // Export investigation data to Excel
                                const workbook = XLSX.utils.book_new();
                                
                                // Export remisiones
                                const remisionesSheet = XLSX.utils.json_to_sheet(
                                  investigationData.remisiones.map((r: any) => ({
                                    'UUID': r.id,
                                    'Número Remisión': r.remision_number,
                                    'Fecha': r.fecha,
                                    'Volumen (m³)': r.volumen_fabricado,
                                    'Código Receta': r.recipe.recipe_code,
                                    'Resistencia (kg/cm²)': r.recipe.strength_fc,
                                    'Cliente': r.order.clients.business_name
                                  }))
                                );
                                XLSX.utils.book_append_sheet(workbook, remisionesSheet, 'Remisiones');
                                
                                // Export material prices
                                const pricesSheet = XLSX.utils.json_to_sheet(
                                  investigationData.materialPrices.map((m: any) => ({
                                    'ID Material': m.material_id,
                                    'Nombre': m.material_name,
                                    'Código': m.material_code,
                                    'Categoría': m.category,
                                    'Unidad': m.unit_of_measure,
                                    'Precio Actual': m.current_price,
                                    'Tiene Precio': m.has_price ? 'Sí' : 'No'
                                  }))
                                );
                                XLSX.utils.book_append_sheet(workbook, pricesSheet, 'Precios Materiales');
                                
                                XLSX.writeFile(workbook, `Investigacion_Produccion_${format(startDate!, 'dd-MM-yyyy')}_${format(endDate!, 'dd-MM-yyyy')}.xlsx`);
                              }}
                              variant="outline"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Exportar Datos
                            </Button>
                          )}
                        </div>

                        {investigationData && (
                          <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <Card>
                                <CardContent className="p-4">
                                  <div className="text-2xl font-bold text-blue-600">
                                    {investigationData.remisiones.length}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Total Remisiones</div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4">
                                  <div className="text-2xl font-bold text-green-600">
                                    {investigationData.recipeConsumption.length}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Recetas Utilizadas</div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4">
                                  <div className="text-2xl font-bold text-orange-600">
                                    {investigationData.materialPrices.length}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Materiales Totales</div>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4">
                                  <div className="text-2xl font-bold text-red-600">
                                    {investigationData.missingPrices.length}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Sin Precios</div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Missing Prices Alert */}
                            {investigationData.missingPrices.length > 0 && (
                              <Alert className="border-red-200 bg-red-50">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-red-800">
                                  <strong>¡Atención!</strong> Se encontraron {investigationData.missingPrices.length} materiales sin precios configurados. 
                                  Esto puede afectar los cálculos de costos.
                                </AlertDescription>
                              </Alert>
                            )}

                            {/* Remisiones with UUIDs */}
                            <Card>
                              <CardHeader>
                                <CardTitle>Remisiones Detalladas (con UUIDs)</CardTitle>
                                <CardDescription>
                                  Lista completa de remisiones con identificadores únicos para investigación en base de datos
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <ScrollArea className="h-96">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>UUID</TableHead>
                                        <TableHead>Número</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Volumen (m³)</TableHead>
                                        <TableHead>Receta</TableHead>
                                        <TableHead>Resistencia</TableHead>
                                        <TableHead>Cliente</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {investigationData.remisiones.map((remision) => (
                                        <TableRow key={remision.id}>
                                          <TableCell className="font-mono text-xs text-muted-foreground">
                                            {remision.id}
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {remision.remision_number}
                                          </TableCell>
                                          <TableCell>
                                            {format(new Date(remision.fecha), 'dd/MM/yyyy')}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {remision.volumen_fabricado.toFixed(2)}
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {remision.recipe.recipe_code}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline">
                                              {remision.recipe.strength_fc} kg/cm²
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="max-w-[200px] truncate">
                                            {remision.order.clients.business_name}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </ScrollArea>
                              </CardContent>
                            </Card>

                            {/* Material Prices Validation */}
                            <Card>
                              <CardHeader>
                                <CardTitle>Validación de Precios de Materiales</CardTitle>
                                <CardDescription>
                                  Estado de precios para todos los materiales utilizados en el período
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <ScrollArea className="h-96">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Material</TableHead>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Categoría</TableHead>
                                        <TableHead>Unidad</TableHead>
                                        <TableHead className="text-right">Precio</TableHead>
                                        <TableHead>Estado</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {investigationData.materialPrices.map((material) => (
                                        <TableRow key={material.material_id}>
                                          <TableCell className="font-mono text-xs text-muted-foreground">
                                            {material.material_id}
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {material.material_name}
                                          </TableCell>
                                          <TableCell className="font-mono text-sm">
                                            {material.material_code}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                              {material.category}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {material.unit_of_measure}
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            {material.has_price ? formatCurrency(material.current_price) : 'N/A'}
                                          </TableCell>
                                          <TableCell>
                                            {material.has_price ? (
                                              <div className="flex items-center gap-2 text-green-600">
                                                <CheckCircle className="h-4 w-4" />
                                                <span className="text-sm">Configurado</span>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2 text-red-600">
                                                <AlertTriangle className="h-4 w-4" />
                                                <span className="text-sm">Sin Precio</span>
                                              </div>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </ScrollArea>
                              </CardContent>
                            </Card>

                            {/* Recipe Consumption Analysis */}
                            <Card>
                              <CardHeader>
                                <CardTitle>Análisis de Consumo por Receta</CardTitle>
                                <CardDescription>
                                  Consumo detallado de materiales por receta con validación de precios
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-4">
                                  {investigationData.recipeConsumption.map((recipe) => (
                                    <div key={recipe.recipe_id} className="border rounded-lg p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <div>
                                          <h4 className="text-lg font-semibold">
                                            {recipe.recipe_code}
                                          </h4>
                                          <div className="flex items-center gap-3">
                                            <Badge variant="outline">
                                              {recipe.strength_fc} kg/cm²
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
                                              {recipe.remisiones_count} remisiones
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                              {recipe.total_volume.toFixed(2)} m³ total
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Material</TableHead>
                                              <TableHead>Código</TableHead>
                                              <TableHead className="text-right">Consumo Total</TableHead>
                                              <TableHead className="text-right">Unidad</TableHead>
                                              <TableHead className="text-right">Precio Unitario</TableHead>
                                              <TableHead className="text-right">Costo Total</TableHead>
                                              <TableHead>Estado Precio</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {recipe.materials.map((material, idx) => (
                                              <TableRow key={`${recipe.recipe_id}-${material.material_id}-${idx}`}>
                                                <TableCell className="font-medium">
                                                  {material.material_name}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                  {material.material_code}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  {material.total_consumption.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                  {material.unit}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                  {material.has_price ? formatCurrency(material.price) : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-right font-bold">
                                                  {material.has_price ? formatCurrency(material.total_cost) : 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                  {material.has_price ? (
                                                    <div className="flex items-center gap-2 text-green-600">
                                                      <CheckCircle className="h-4 w-4" />
                                                      <span className="text-xs">OK</span>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center gap-2 text-red-600">
                                                      <AlertTriangle className="h-4 w-4" />
                                                      <span className="text-xs">Sin Precio</span>
                                                    </div>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {investigationLoading && investigationProgress && (
                          <Alert className="border-blue-200 bg-blue-50">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                              {investigationProgress}
                            </AlertDescription>
                          </Alert>
                        )}

                        {!investigationData && !investigationLoading && (
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                              Haz clic en "Cargar Datos de Investigación" para analizar los datos del período seleccionado.
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
