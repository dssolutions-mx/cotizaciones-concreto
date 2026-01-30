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
import { Download, TrendingUp, Package, DollarSign, BarChart3, ArrowUpIcon, ArrowDownIcon, AlertTriangle, CheckCircle2, Search, CheckCircle, Info, ArrowLeft, ChevronRight } from "lucide-react";
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
  recipeAnalysis: RecipeAnalysis[]; // New: detailed recipe analysis with patterns
  problematicRemisiones: ProblematicRemision[]; // Remisiones with no materials or < 3 materials
}

// Extended interfaces for drill-down analysis
interface RecipeAnalysis {
  recipe_id: string;
  recipe_code: string;
  strength_fc: number;
  remisiones_count: number;
  total_volume: number;
  remisiones: RemisionAnalysis[];
  averages: {
    cement_kg_per_m3: number;
    [material_id: string]: number; // consumption per m³ for each material
  };
}

interface RemisionAnalysis {
  remision_id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado: number;
  cement_kg_per_m3: number;
  deviation_from_avg: number; // percentage
  status: 'normal' | 'above_avg' | 'below_avg';
  materials: MaterialConsumptionDetail[];
  order_info: {
    client_id: string | null;
    business_name: string;
    construction_site?: string;
    order_number?: string;
  };
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
  total_consumption: number; // cantidad_real (actual consumption)
  cantidad_teorica: number; // theoretical consumption
  cantidad_real: number; // actual consumption
  ajuste: number; // variance = cantidad_real - cantidad_teorica
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

interface ProblematicRemision {
  remision_id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado: number;
  materials_count: number;
  issue_type: 'no_materials' | 'few_materials'; // 0 materials or < 3 materials
  order_info: {
    client_id: string | null;
    business_name: string;
    construction_site?: string;
    order_number?: string;
  };
  recipe_info: {
    recipe_code: string;
    strength_fc: number;
  };
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
  // Navigation state for drill-down investigation
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedRemisionId, setSelectedRemisionId] = useState<string | null>(null);
  const [outlierThreshold, setOutlierThreshold] = useState<number>(10); // Default 10% deviation threshold

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

  // Reset investigation navigation on date change
  useEffect(() => {
    setSelectedRecipeId(null);
    setSelectedRemisionId(null);
    setInvestigationData(null);
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
  // Analysis functions for pattern detection
  const calculateRecipeAverages = (
    recipeId: string,
    remisiones: any[],
    materiales: any[]
  ): { cement_kg_per_m3: number; [material_id: string]: number } => {
    const recipeRemisiones = remisiones.filter((r: any) => r.recipe_id === recipeId);
    if (recipeRemisiones.length === 0) return { cement_kg_per_m3: 0 };

    const averages: { cement_kg_per_m3: number; [material_id: string]: number } = {
      cement_kg_per_m3: 0
    };

    // Calculate cement average
    let totalCement = 0;
    let totalVolume = 0;
    const cementPerM3: number[] = [];

    recipeRemisiones.forEach((remision: any) => {
      const volume = Number(remision.volumen_fabricado) || 0;
      if (volume <= 0) return;

      // Find cement consumption for this remision
      const remisionMateriales = materiales.filter(
        (m: any) => m.remision_id === remision.id
      );
      
      // Aggregate cement by material_id to avoid duplicates
      let cementQty = 0;
      const cementMap = new Map<string, number>();
      remisionMateriales.forEach((m: any) => {
        const category = (m.materials?.category || '').toUpperCase();
        if (category === 'CEMENTO') {
          const materialId = m.material_id;
          const qty = Number(m.cantidad_real) || 0;
          const existingQty = cementMap.get(materialId) || 0;
          cementMap.set(materialId, existingQty + qty);
        }
      });
      
      // Sum all cement quantities
      cementMap.forEach((qty) => {
        cementQty += qty;
      });

      if (cementQty > 0 && volume > 0) {
        const cementPerM3Value = cementQty / volume;
        cementPerM3.push(cementPerM3Value);
        totalCement += cementQty;
        totalVolume += volume;
      }
    });

    if (cementPerM3.length > 0) {
      averages.cement_kg_per_m3 = cementPerM3.reduce((sum, val) => sum + val, 0) / cementPerM3.length;
    }

    // Calculate averages for other materials
    // Store per-m³ values for each material (similar to how we do it for cement)
    const materialPerM3Map = new Map<string, number[]>();
    
    recipeRemisiones.forEach((remision: any) => {
      const volume = Number(remision.volumen_fabricado) || 0;
      if (volume <= 0) return;

      const remisionMateriales = materiales.filter(
        (m: any) => m.remision_id === remision.id
      );

      // Aggregate materials by material_id within this remision to avoid duplicates
      const remisionMaterialMap = new Map<string, number>();
      remisionMateriales.forEach((m: any) => {
        const materialId = m.material_id;
        const category = (m.materials?.category || '').toUpperCase();
        // Skip cement as we already calculated it
        if (category === 'CEMENTO') return;

        const qty = Number(m.cantidad_real ?? 0) || 0;
        if (qty > 0) {
          const existingQty = remisionMaterialMap.get(materialId) || 0;
          remisionMaterialMap.set(materialId, existingQty + qty);
        }
      });

      // Calculate per-m³ for each material in this remision and add to the array
      remisionMaterialMap.forEach((qty, materialId) => {
        if (qty > 0 && volume > 0) {
          const perM3Value = qty / volume;
          if (!materialPerM3Map.has(materialId)) {
            materialPerM3Map.set(materialId, []);
          }
          materialPerM3Map.get(materialId)!.push(perM3Value);
        }
      });
    });

    // Calculate average per-m³ for each material
    materialPerM3Map.forEach((perM3Values, materialId) => {
      if (perM3Values.length > 0) {
        averages[materialId] = perM3Values.reduce((sum, val) => sum + val, 0) / perM3Values.length;
      }
    });

    return averages;
  };

  const analyzeRemisionPatterns = (
    recipeId: string,
    remisiones: any[],
    materiales: any[],
    averages: { cement_kg_per_m3: number; [material_id: string]: number },
    threshold: number = 10,
    priceMap?: Map<string, number>
  ): RemisionAnalysis[] => {
    const recipeRemisiones = remisiones.filter((r: any) => r.recipe_id === recipeId);
    
    return recipeRemisiones.map((remision: any) => {
      const volume = Number(remision.volumen_fabricado) || 0;
      
      // Get materials for this remision and aggregate by material_id to avoid duplicates
      const remisionMateriales = materiales.filter(
        (m: any) => m.remision_id === remision.id
      );

      // Aggregate materials by material_id (in case there are duplicate entries)
      const materialMap = new Map<string, {
        material_id: string;
        material_name: string;
        material_code: string;
        category: string;
        unit: string;
        cantidad_real: number;
        cantidad_teorica: number;
        price: number;
      }>();

      remisionMateriales.forEach((m: any) => {
        const materialId = m.material_id;
        const cantidadReal = Number(m.cantidad_real ?? 0) || 0;
        const cantidadTeorica = Number(m.cantidad_teorica ?? 0) || 0;
        const price = priceMap?.get(materialId) || 0;

        if (materialMap.has(materialId)) {
          // Aggregate quantities for existing material
          const existing = materialMap.get(materialId)!;
          existing.cantidad_real += cantidadReal;
          existing.cantidad_teorica += cantidadTeorica;
        } else {
          // Add new material entry
          materialMap.set(materialId, {
            material_id: materialId,
            material_name: m.materials?.material_name || '',
            material_code: m.materials?.material_code || '',
            category: m.materials?.category || '',
            unit: m.materials?.unit_of_measure || '',
            cantidad_real: cantidadReal,
            cantidad_teorica: cantidadTeorica,
            price: price
          });
        }
      });

      // Calculate cement consumption per m³
      let cementQty = 0;
      const materialsDetail: MaterialConsumptionDetail[] = [];

      materialMap.forEach((material) => {
        const category = (material.category || '').toUpperCase();
        const ajuste = material.cantidad_real - material.cantidad_teorica;
        
        if (category === 'CEMENTO') {
          cementQty += material.cantidad_real;
        }

        materialsDetail.push({
          material_id: material.material_id,
          material_name: material.material_name,
          material_code: material.material_code,
          category: material.category,
          total_consumption: material.cantidad_real, // Keep for backward compatibility
          cantidad_real: material.cantidad_real,
          cantidad_teorica: material.cantidad_teorica,
          ajuste: ajuste,
          unit: material.unit,
          has_price: material.price > 0,
          price: material.price,
          total_cost: material.cantidad_real * material.price
        });
      });

      const cementKgPerM3 = volume > 0 ? cementQty / volume : 0;
      const avgCementPerM3 = averages.cement_kg_per_m3 || 0;
      
      // Calculate deviation
      let deviation = 0;
      let status: 'normal' | 'above_avg' | 'below_avg' = 'normal';
      
      if (avgCementPerM3 > 0) {
        deviation = ((cementKgPerM3 - avgCementPerM3) / avgCementPerM3) * 100;
        const absDeviation = Math.abs(deviation);
        
        if (absDeviation > threshold) {
          status = deviation > 0 ? 'above_avg' : 'below_avg';
        }
      }

      return {
        remision_id: remision.id,
        remision_number: remision.remision_number,
        fecha: remision.fecha,
        volumen_fabricado: volume,
        cement_kg_per_m3: cementKgPerM3,
        deviation_from_avg: deviation,
        status: status,
        materials: materialsDetail,
        order_info: {
          client_id: remision.orders?.client_id || null,
          business_name: remision.orders?.clients?.business_name || 'Desconocido',
          construction_site: remision.orders?.construction_site,
          order_number: remision.orders?.order_number
        }
      };
    });
  };

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
            construction_site,
            order_number,
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
            cantidad_teorica,
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
              cantidad_teorica,
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

      // 2.5. Identify problematic remisiones (no materials or < 3 materials)
      setInvestigationProgress('Identificando remisiones con problemas de materiales...');
      const materialesByRemision = new Map<string, number>();
      materiales.forEach((m: any) => {
        const count = materialesByRemision.get(m.remision_id) || 0;
        materialesByRemision.set(m.remision_id, count + 1);
      });

      const problematicRemisiones: ProblematicRemision[] = [];
      remisiones.forEach((remision: any) => {
        const materialsCount = materialesByRemision.get(remision.id) || 0;
        if (materialsCount === 0 || materialsCount < 3) {
          problematicRemisiones.push({
            remision_id: remision.id,
            remision_number: remision.remision_number,
            fecha: remision.fecha,
            volumen_fabricado: remision.volumen_fabricado,
            materials_count: materialsCount,
            issue_type: materialsCount === 0 ? 'no_materials' : 'few_materials',
            order_info: {
              client_id: remision.orders?.client_id || null,
              business_name: remision.orders?.clients?.business_name || 'Desconocido',
              construction_site: remision.orders?.construction_site,
              order_number: remision.orders?.order_number
            },
            recipe_info: {
              recipe_code: remision.recipes?.recipe_code || 'N/A',
              strength_fc: remision.recipes?.strength_fc || 0
            }
          });
        }
      });
      console.log(`Identified ${problematicRemisiones.length} problematic remisiones (${problematicRemisiones.filter(r => r.issue_type === 'no_materials').length} with no materials, ${problematicRemisiones.filter(r => r.issue_type === 'few_materials').length} with < 3 materials)`);

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

      // 8. Calculate recipe analysis with pattern detection
      setInvestigationProgress('Calculando análisis de patrones por receta...');
      const recipeAnalysis: RecipeAnalysis[] = [];
      const uniqueRecipeIds = Array.from(new Set(remisiones.map((r: any) => r.recipe_id)));
      
      uniqueRecipeIds.forEach((recipeId) => {
        const recipeRemisiones = remisiones.filter((r: any) => r.recipe_id === recipeId);
        if (recipeRemisiones.length === 0) return;

        const firstRemision = recipeRemisiones[0];
        const totalVolume = recipeRemisiones.reduce((sum, r) => sum + (Number(r.volumen_fabricado) || 0), 0);
        
        // Calculate averages for this recipe
        const averages = calculateRecipeAverages(recipeId, remisiones, materiales);
        
        // Analyze remision patterns
        const remisionAnalyses = analyzeRemisionPatterns(
          recipeId,
          remisiones,
          materiales,
          averages,
          outlierThreshold,
          priceMap
        );

        recipeAnalysis.push({
          recipe_id: recipeId,
          recipe_code: firstRemision.recipes.recipe_code,
          strength_fc: firstRemision.recipes.strength_fc,
          remisiones_count: recipeRemisiones.length,
          total_volume: totalVolume,
          remisiones: remisionAnalyses,
          averages: averages
        });
      });

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
        missingPrices,
        recipeAnalysis: recipeAnalysis,
        problematicRemisiones: problematicRemisiones
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
                  series={Array.isArray(trendSeriesV2) ? trendSeriesV2 as any : []}
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
                          Herramienta de Investigación - Análisis de Patrones
                        </CardTitle>
                        <CardDescription>
                          Analiza patrones de consumo por receta, identifica remisiones con desviaciones y profundiza en detalles específicos.
                          <br />
                          <span className="text-sm text-amber-600 font-medium">
                            💡 Para períodos largos, considera usar rangos de fechas más pequeños para mejor rendimiento.
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 mb-4 items-center">
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
                            <>
                              <div className="flex items-center gap-2">
                                <Label htmlFor="threshold" className="text-sm">Umbral de Desviación (%):</Label>
                                <Input
                                  id="threshold"
                                  type="number"
                                  value={outlierThreshold}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val >= 0) {
                                      setOutlierThreshold(val);
                                      // Recalculate patterns with new threshold without re-fetching
                                      if (investigationData && investigationData.recipeAnalysis) {
                                        const updatedAnalysis = investigationData.recipeAnalysis.map(recipe => {
                                          const updatedRemisiones = recipe.remisiones.map(remision => {
                                            const avgCementPerM3 = recipe.averages.cement_kg_per_m3 || 0;
                                            let deviation = 0;
                                            let status: 'normal' | 'above_avg' | 'below_avg' = 'normal';
                                            
                                            if (avgCementPerM3 > 0 && remision.cement_kg_per_m3 > 0) {
                                              deviation = ((remision.cement_kg_per_m3 - avgCementPerM3) / avgCementPerM3) * 100;
                                              const absDeviation = Math.abs(deviation);
                                              
                                              if (absDeviation > val) {
                                                status = deviation > 0 ? 'above_avg' : 'below_avg';
                                              }
                                            }
                                            
                                            return {
                                              ...remision,
                                              deviation_from_avg: deviation,
                                              status: status
                                            };
                                          });
                                          
                                          return {
                                            ...recipe,
                                            remisiones: updatedRemisiones
                                          };
                                        });
                                        
                                        setInvestigationData({
                                          ...investigationData,
                                          recipeAnalysis: updatedAnalysis
                                        });
                                      }
                                    }
                                  }}
                                  className="w-20"
                                  min="0"
                                  max="100"
                                />
                              </div>
                              <Button 
                                onClick={() => {
                                  if (!investigationData) return;
                                  const workbook = XLSX.utils.book_new();
                                  
                                  // Export recipe analysis
                                  const recipeSheet = XLSX.utils.json_to_sheet(
                                    investigationData.recipeAnalysis.map((r: RecipeAnalysis) => ({
                                      'Código Receta': r.recipe_code,
                                      'Resistencia (kg/cm²)': r.strength_fc,
                                      'Remisiones': r.remisiones_count,
                                      'Volumen Total (m³)': r.total_volume,
                                      'Cemento Promedio (kg/m³)': r.averages.cement_kg_per_m3.toFixed(2)
                                    }))
                                  );
                                  XLSX.utils.book_append_sheet(workbook, recipeSheet, 'Recetas');
                                  
                                  // Export remisiones with patterns
                                  const remisionesSheet = XLSX.utils.json_to_sheet(
                                    investigationData.recipeAnalysis.flatMap((r: RecipeAnalysis) =>
                                      r.remisiones.map((rem: RemisionAnalysis) => ({
                                        'Receta': r.recipe_code,
                                        'Número Remisión': rem.remision_number,
                                        'Fecha': rem.fecha,
                                        'Volumen (m³)': rem.volumen_fabricado,
                                        'Cemento (kg/m³)': rem.cement_kg_per_m3.toFixed(2),
                                        'Desviación (%)': rem.deviation_from_avg.toFixed(2),
                                        'Estado': rem.status === 'above_avg' ? 'Arriba del Promedio' : 
                                                 rem.status === 'below_avg' ? 'Abajo del Promedio' : 'Normal',
                                        'Cliente': rem.order_info.business_name,
                                        'Obra': rem.order_info.construction_site || 'N/A'
                                      }))
                                    )
                                  );
                                  XLSX.utils.book_append_sheet(workbook, remisionesSheet, 'Remisiones');
                                  
                                  // Export problematic remisiones
                                  if (investigationData.problematicRemisiones && investigationData.problematicRemisiones.length > 0) {
                                    const problematicSheet = XLSX.utils.json_to_sheet(
                                      investigationData.problematicRemisiones.map((r: ProblematicRemision) => ({
                                        'Número Remisión': r.remision_number,
                                        'Fecha': r.fecha,
                                        'Volumen (m³)': r.volumen_fabricado,
                                        'Cantidad Materiales': r.materials_count,
                                        'Problema': r.issue_type === 'no_materials' ? 'Sin Materiales' : 'Pocos Materiales (< 3)',
                                        'Cliente': r.order_info.business_name,
                                        'Obra': r.order_info.construction_site || 'N/A',
                                        'Receta': r.recipe_info.recipe_code,
                                        'Resistencia (kg/cm²)': r.recipe_info.strength_fc
                                      }))
                                    );
                                    XLSX.utils.book_append_sheet(workbook, problematicSheet, 'Remisiones Problemáticas');
                                  }
                                  
                                  XLSX.writeFile(workbook, `Investigacion_Patrones_${format(startDate!, 'dd-MM-yyyy')}_${format(endDate!, 'dd-MM-yyyy')}.xlsx`);
                                }}
                                variant="outline"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Exportar Análisis
                              </Button>
                            </>
                          )}
                        </div>

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

                        {investigationData && investigationData.recipeAnalysis && (
                          <>
                            {/* Breadcrumb Navigation */}
                            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedRecipeId(null);
                                  setSelectedRemisionId(null);
                                }}
                                className={!selectedRecipeId ? 'hidden' : ''}
                              >
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Lista de Recetas
                              </Button>
                              {selectedRecipeId && (
                                <>
                                  <ChevronRight className="h-4 w-4" />
                                  <span className="font-medium text-foreground">
                                    {investigationData.recipeAnalysis.find(r => r.recipe_id === selectedRecipeId)?.recipe_code}
                                  </span>
                                </>
                              )}
                              {selectedRemisionId && selectedRecipeId && (
                                <>
                                  <ChevronRight className="h-4 w-4" />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedRemisionId(null)}
                                  >
                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                    Remisiones
                                  </Button>
                                  <ChevronRight className="h-4 w-4" />
                                  <span className="font-medium text-foreground">
                                    {investigationData.recipeAnalysis
                                      .find(r => r.recipe_id === selectedRecipeId)
                                      ?.remisiones.find(rem => rem.remision_id === selectedRemisionId)?.remision_number}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Problematic Remisiones Section */}
                            {investigationData.problematicRemisiones && investigationData.problematicRemisiones.length > 0 && !selectedRecipeId && !selectedRemisionId && (
                              <Card className="mb-4 border-orange-200">
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                                    Remisiones con Problemas de Materiales
                                  </CardTitle>
                                  <CardDescription>
                                    Remisiones que requieren atención por tener materiales faltantes o incompletos
                                  </CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-4">
                                    {/* Remisiones sin materiales */}
                                    {investigationData.problematicRemisiones.filter(r => r.issue_type === 'no_materials').length > 0 && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="destructive" className="text-sm">
                                            Sin Materiales
                                          </Badge>
                                          <span className="text-sm text-muted-foreground">
                                            {investigationData.problematicRemisiones.filter(r => r.issue_type === 'no_materials').length} remisión(es)
                                          </span>
                                        </div>
                                        <ScrollArea className="h-[200px] border rounded-md">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Remisión</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead className="text-right">Volumen (m³)</TableHead>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Obra</TableHead>
                                                <TableHead>Receta</TableHead>
                                                <TableHead className="text-right">Materiales</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {investigationData.problematicRemisiones
                                                .filter(r => r.issue_type === 'no_materials')
                                                .map((remision) => (
                                                  <TableRow key={remision.remision_id} className="bg-red-50/50">
                                                    <TableCell className="font-medium">
                                                      {remision.remision_number}
                                                    </TableCell>
                                                    <TableCell>
                                                      {format(new Date(remision.fecha), 'dd/MM/yyyy')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      {remision.volumen_fabricado.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate">
                                                      {remision.order_info.business_name}
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate">
                                                      {remision.order_info.construction_site || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                      <Badge variant="outline">
                                                        {remision.recipe_info.recipe_code}
                                                      </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      <Badge variant="destructive">0</Badge>
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                            </TableBody>
                                          </Table>
                                        </ScrollArea>
                                      </div>
                                    )}

                                    {/* Remisiones con pocos materiales */}
                                    {investigationData.problematicRemisiones.filter(r => r.issue_type === 'few_materials').length > 0 && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="outline" className="text-sm border-orange-300 text-orange-700 bg-orange-50">
                                            Con Pocos Materiales (&lt; 3)
                                          </Badge>
                                          <span className="text-sm text-muted-foreground">
                                            {investigationData.problematicRemisiones.filter(r => r.issue_type === 'few_materials').length} remisión(es)
                                          </span>
                                        </div>
                                        <ScrollArea className="h-[200px] border rounded-md">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Remisión</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead className="text-right">Volumen (m³)</TableHead>
                                                <TableHead>Cliente</TableHead>
                                                <TableHead>Obra</TableHead>
                                                <TableHead>Receta</TableHead>
                                                <TableHead className="text-right">Materiales</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {investigationData.problematicRemisiones
                                                .filter(r => r.issue_type === 'few_materials')
                                                .map((remision) => (
                                                  <TableRow key={remision.remision_id} className="bg-orange-50/50">
                                                    <TableCell className="font-medium">
                                                      {remision.remision_number}
                                                    </TableCell>
                                                    <TableCell>
                                                      {format(new Date(remision.fecha), 'dd/MM/yyyy')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      {remision.volumen_fabricado.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate">
                                                      {remision.order_info.business_name}
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate">
                                                      {remision.order_info.construction_site || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                      <Badge variant="outline">
                                                        {remision.recipe_info.recipe_code}
                                                      </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
                                                        {remision.materials_count}
                                                      </Badge>
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                            </TableBody>
                                          </Table>
                                        </ScrollArea>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Recipe List View (Default) */}
                            {!selectedRecipeId && !selectedRemisionId && (
                              <div className="space-y-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle>Análisis por Receta</CardTitle>
                                    <CardDescription>
                                      Selecciona una receta para ver sus remisiones y analizar patrones de consumo
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <ScrollArea className="h-[600px]">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Receta</TableHead>
                                            <TableHead>Resistencia</TableHead>
                                            <TableHead className="text-right">Remisiones</TableHead>
                                            <TableHead className="text-right">Volumen Total (m³)</TableHead>
                                            <TableHead className="text-right">Cemento Promedio (kg/m³)</TableHead>
                                            <TableHead>Acción</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {investigationData.recipeAnalysis.map((recipe) => (
                                            <TableRow 
                                              key={recipe.recipe_id}
                                              className="cursor-pointer hover:bg-muted/50"
                                              onClick={() => setSelectedRecipeId(recipe.recipe_id)}
                                            >
                                              <TableCell className="font-medium">
                                                {recipe.recipe_code}
                                              </TableCell>
                                              <TableCell>
                                                <Badge variant="outline">
                                                  {recipe.strength_fc} kg/cm²
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {recipe.remisiones_count}
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {recipe.total_volume.toFixed(2)}
                                              </TableCell>
                                              <TableCell className="text-right font-medium">
                                                {recipe.averages.cement_kg_per_m3 > 0 
                                                  ? recipe.averages.cement_kg_per_m3.toFixed(2)
                                                  : 'N/A'}
                                              </TableCell>
                                              <TableCell>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedRecipeId(recipe.recipe_id);
                                                  }}
                                                >
                                                  Ver Detalles <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </ScrollArea>
                                  </CardContent>
                                </Card>
                              </div>
                            )}

                            {/* Recipe Detail View */}
                            {selectedRecipeId && !selectedRemisionId && (() => {
                              const recipe = investigationData.recipeAnalysis.find(r => r.recipe_id === selectedRecipeId);
                              if (!recipe) return null;

                              const aboveAvgCount = recipe.remisiones.filter(r => r.status === 'above_avg').length;
                              const belowAvgCount = recipe.remisiones.filter(r => r.status === 'below_avg').length;
                              const normalCount = recipe.remisiones.filter(r => r.status === 'normal').length;

                              return (
                                <div className="space-y-4">
                                  {/* Recipe Summary Card */}
                                  <Card>
                                    <CardHeader>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <CardTitle className="text-2xl">{recipe.recipe_code}</CardTitle>
                                          <CardDescription>
                                            Resistencia: {recipe.strength_fc} kg/cm² | {recipe.remisiones_count} remisiones | {recipe.total_volume.toFixed(2)} m³ total
                                          </CardDescription>
                                        </div>
                                        <Button
                                          variant="outline"
                                          onClick={() => setSelectedRecipeId(null)}
                                        >
                                          <ArrowLeft className="h-4 w-4 mr-2" />
                                          Volver
                                        </Button>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm text-muted-foreground mb-1">Cemento Promedio</div>
                                          <div className="text-2xl font-bold text-blue-600">
                                            {recipe.averages.cement_kg_per_m3 > 0 
                                              ? `${recipe.averages.cement_kg_per_m3.toFixed(2)} kg/m³`
                                              : 'N/A'}
                                          </div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm text-muted-foreground mb-1">Arriba del Promedio</div>
                                          <div className="text-2xl font-bold text-orange-600">
                                            {aboveAvgCount}
                                          </div>
                                          <div className="text-xs text-muted-foreground">remisiones</div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm text-muted-foreground mb-1">Abajo del Promedio</div>
                                          <div className="text-2xl font-bold text-blue-600">
                                            {belowAvgCount}
                                          </div>
                                          <div className="text-xs text-muted-foreground">remisiones</div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm text-muted-foreground mb-1">Normal</div>
                                          <div className="text-2xl font-bold text-green-600">
                                            {normalCount}
                                          </div>
                                          <div className="text-xs text-muted-foreground">remisiones</div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Remisiones Table */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle>Remisiones - Análisis de Patrones</CardTitle>
                                      <CardDescription>
                                        Remisiones con indicadores de desviación del promedio. Haz clic en una remisión para ver detalles completos.
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      <ScrollArea className="h-[500px]">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Remisión</TableHead>
                                              <TableHead>Fecha</TableHead>
                                              <TableHead className="text-right">Volumen (m³)</TableHead>
                                              <TableHead className="text-right">Cemento (kg/m³)</TableHead>
                                              <TableHead className="text-right">Desviación</TableHead>
                                              <TableHead>Estado</TableHead>
                                              <TableHead>Cliente</TableHead>
                                              <TableHead>Acción</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {recipe.remisiones.map((remision) => {
                                              const statusColors = {
                                                'above_avg': 'bg-orange-50 text-orange-700 border-orange-200',
                                                'below_avg': 'bg-blue-50 text-blue-700 border-blue-200',
                                                'normal': 'bg-green-50 text-green-700 border-green-200'
                                              };
                                              const statusLabels = {
                                                'above_avg': 'Arriba del Promedio',
                                                'below_avg': 'Abajo del Promedio',
                                                'normal': 'Normal'
                                              };
                                              const statusIcons = {
                                                'above_avg': <TrendingUp className="h-4 w-4" />,
                                                'below_avg': <ArrowDownIcon className="h-4 w-4" />,
                                                'normal': <CheckCircle2 className="h-4 w-4" />
                                              };

                                              return (
                                                <TableRow 
                                                  key={remision.remision_id}
                                                  className={`cursor-pointer hover:bg-muted/50 ${
                                                    remision.status === 'above_avg' ? 'bg-orange-50/30' : 
                                                    remision.status === 'below_avg' ? 'bg-blue-50/30' : ''
                                                  }`}
                                                  onClick={() => setSelectedRemisionId(remision.remision_id)}
                                                >
                                                  <TableCell className="font-medium">
                                                    {remision.remision_number}
                                                  </TableCell>
                                                  <TableCell>
                                                    {format(new Date(remision.fecha), 'dd/MM/yyyy')}
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    {remision.volumen_fabricado.toFixed(2)}
                                                  </TableCell>
                                                  <TableCell className="text-right font-medium">
                                                    {remision.cement_kg_per_m3 > 0 
                                                      ? remision.cement_kg_per_m3.toFixed(2)
                                                      : 'N/A'}
                                                  </TableCell>
                                                  <TableCell className="text-right">
                                                    {remision.deviation_from_avg !== 0 ? (
                                                      <span className={`font-medium ${
                                                        remision.deviation_from_avg > 0 ? 'text-orange-600' : 'text-blue-600'
                                                      }`}>
                                                        {remision.deviation_from_avg > 0 ? '+' : ''}
                                                        {remision.deviation_from_avg.toFixed(1)}%
                                                      </span>
                                                    ) : (
                                                      <span className="text-muted-foreground">0%</span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell>
                                                    <Badge 
                                                      variant="outline" 
                                                      className={statusColors[remision.status]}
                                                    >
                                                      <span className="flex items-center gap-1">
                                                        {statusIcons[remision.status]}
                                                        {statusLabels[remision.status]}
                                                      </span>
                                                    </Badge>
                                                  </TableCell>
                                                  <TableCell className="max-w-[200px] truncate">
                                                    {remision.order_info.business_name}
                                                  </TableCell>
                                                  <TableCell>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedRemisionId(remision.remision_id);
                                                      }}
                                                    >
                                                      Ver Detalles <ChevronRight className="h-4 w-4 ml-1" />
                                                    </Button>
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>
                                      </ScrollArea>
                                    </CardContent>
                                  </Card>
                                </div>
                              );
                            })()}

                            {/* Remision Detail View */}
                            {selectedRecipeId && selectedRemisionId && (() => {
                              const recipe = investigationData.recipeAnalysis.find(r => r.recipe_id === selectedRecipeId);
                              if (!recipe) return null;
                              const remision = recipe.remisiones.find(r => r.remision_id === selectedRemisionId);
                              if (!remision) return null;

                              return (
                                <div className="space-y-4">
                                  {/* Remision Info Card */}
                                  <Card>
                                    <CardHeader>
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <CardTitle className="text-2xl">Remisión {remision.remision_number}</CardTitle>
                                          <CardDescription>
                                            Receta: {recipe.recipe_code} | Fecha: {format(new Date(remision.fecha), 'dd/MM/yyyy')} | Volumen: {remision.volumen_fabricado.toFixed(2)} m³
                                          </CardDescription>
                                        </div>
                                        <Button
                                          variant="outline"
                                          onClick={() => setSelectedRemisionId(null)}
                                        >
                                          <ArrowLeft className="h-4 w-4 mr-2" />
                                          Volver a Remisiones
                                        </Button>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Order Information */}
                                        <div className="space-y-3">
                                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                                            Información de Orden
                                          </h4>
                                          <div className="space-y-3">
                                            <div>
                                              <div className="text-xs text-muted-foreground mb-1">Cliente</div>
                                              <div className="font-medium">{remision.order_info.business_name}</div>
                                            </div>
                                            {remision.order_info.construction_site && (
                                              <div>
                                                <div className="text-xs text-muted-foreground mb-1">Obra</div>
                                                <div className="font-medium">{remision.order_info.construction_site}</div>
                                              </div>
                                            )}
                                            {remision.order_info.order_number && (
                                              <div>
                                                <div className="text-xs text-muted-foreground mb-1">Orden</div>
                                                <div className="font-medium font-mono text-sm">{remision.order_info.order_number}</div>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Cement Analysis - Highlighted */}
                                        <div className="space-y-3 lg:border-l lg:pl-6">
                                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                                            Análisis de Cemento
                                          </h4>
                                          <div className="space-y-4">
                                            <div className="p-4 rounded-lg bg-muted/50">
                                              <div className="text-xs text-muted-foreground mb-2">Esta Remisión</div>
                                              <div className="text-2xl font-bold">
                                                {remision.cement_kg_per_m3 > 0 
                                                  ? `${remision.cement_kg_per_m3.toFixed(2)}`
                                                  : 'N/A'}
                                                {remision.cement_kg_per_m3 > 0 && (
                                                  <span className="text-base font-normal text-muted-foreground ml-1">kg/m³</span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="p-4 rounded-lg bg-muted/30">
                                              <div className="text-xs text-muted-foreground mb-2">Promedio Receta</div>
                                              <div className="text-xl font-semibold text-muted-foreground">
                                                {recipe.averages.cement_kg_per_m3 > 0 
                                                  ? `${recipe.averages.cement_kg_per_m3.toFixed(2)}`
                                                  : 'N/A'}
                                                {recipe.averages.cement_kg_per_m3 > 0 && (
                                                  <span className="text-sm font-normal ml-1">kg/m³</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Deviation Status */}
                                        <div className="space-y-3 lg:border-l lg:pl-6">
                                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                                            Estado
                                          </h4>
                                          <div className="space-y-4">
                                            <div className={`p-4 rounded-lg border-2 ${
                                              remision.status === 'above_avg' ? 'bg-orange-50 border-orange-200' :
                                              remision.status === 'below_avg' ? 'bg-blue-50 border-blue-200' :
                                              'bg-green-50 border-green-200'
                                            }`}>
                                              <div className="text-xs text-muted-foreground mb-2">Desviación</div>
                                              <div className={`text-3xl font-bold ${
                                                remision.deviation_from_avg > 0 ? 'text-orange-600' : 
                                                remision.deviation_from_avg < 0 ? 'text-blue-600' : 
                                                'text-green-600'
                                              }`}>
                                                {remision.deviation_from_avg > 0 ? '+' : ''}
                                                {remision.deviation_from_avg.toFixed(1)}%
                                              </div>
                                            </div>
                                            <div className="flex justify-center">
                                              <Badge 
                                                variant="outline" 
                                                className={`text-sm py-1.5 px-3 ${
                                                  remision.status === 'above_avg' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                  remision.status === 'below_avg' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                  'bg-green-50 text-green-700 border-green-200'
                                                }`}
                                              >
                                                {remision.status === 'above_avg' ? (
                                                  <>
                                                    <TrendingUp className="h-4 w-4 mr-1" />
                                                    Arriba del Promedio
                                                  </>
                                                ) : remision.status === 'below_avg' ? (
                                                  <>
                                                    <ArrowDownIcon className="h-4 w-4 mr-1" />
                                                    Abajo del Promedio
                                                  </>
                                                ) : (
                                                  <>
                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    Normal
                                                  </>
                                                )}
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Materials Consumption - Redesigned with Apple HIG principles */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle>Consumo de Materiales</CardTitle>
                                      <CardDescription>
                                        Comparación con el promedio de la receta. Los materiales con desviaciones significativas se destacan.
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                      {(() => {
                                        // Group materials by category and calculate deviations
                                        const materialsWithDeviation = remision.materials.map((material) => {
                                          const consumptionPerM3 = remision.volumen_fabricado > 0 
                                            ? material.total_consumption / remision.volumen_fabricado 
                                            : 0;
                                          const avgConsumptionPerM3 = recipe.averages[material.material_id] || 0;
                                          const deviation = avgConsumptionPerM3 > 0 
                                            ? ((consumptionPerM3 - avgConsumptionPerM3) / avgConsumptionPerM3) * 100 
                                            : 0;
                                          const hasDeviation = Math.abs(deviation) > outlierThreshold;
                                          
                                          return {
                                            ...material,
                                            consumptionPerM3,
                                            avgConsumptionPerM3,
                                            deviation,
                                            hasDeviation
                                          };
                                        });

                                        // Separate materials with deviations and normal ones
                                        const materialsWithIssues = materialsWithDeviation.filter(m => m.hasDeviation && m.avgConsumptionPerM3 > 0);
                                        const normalMaterials = materialsWithDeviation.filter(m => !m.hasDeviation || m.avgConsumptionPerM3 === 0);

                                        // Group by category
                                        const groupByCategory = (materials: typeof materialsWithDeviation) => {
                                          const grouped = new Map<string, typeof materialsWithDeviation>();
                                          materials.forEach(m => {
                                            const category = m.category || 'Otros';
                                            if (!grouped.has(category)) {
                                              grouped.set(category, []);
                                            }
                                            grouped.get(category)!.push(m);
                                          });
                                          return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                                        };

                                        return (
                                          <div className="space-y-6">
                                            {/* Materials with Deviations - Highlighted Section */}
                                            {materialsWithIssues.length > 0 && (
                                              <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                                                  <h3 className="text-lg font-semibold">Atención: Desviaciones Detectadas</h3>
                                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                                    {materialsWithIssues.length} material{materialsWithIssues.length > 1 ? 'es' : ''}
                                                  </Badge>
                                                </div>
                                                
                                                {groupByCategory(materialsWithIssues).map(([category, materials]) => (
                                                  <div key={category} className="border-l-4 border-orange-500 pl-4 space-y-3">
                                                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                                                      {category}
                                                    </h4>
                                                    <div className="grid gap-3">
                                                      {materials.map((material) => (
                                                        <div 
                                                          key={material.material_id}
                                                          className="p-4 rounded-lg bg-orange-50/50 border border-orange-200 hover:bg-orange-50 transition-colors"
                                                        >
                                                          <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                              <div className="flex items-center gap-2 mb-2">
                                                                <span className="font-semibold text-base">{material.material_name}</span>
                                                                <Badge variant="outline" className="text-xs">
                                                                  {material.material_code}
                                                                </Badge>
                                                              </div>
                                                              <div className="space-y-4 mt-3">
                                                                {/* Breakdown: Teórico, Real, Ajuste */}
                                                                <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
                                                                  <div>
                                                                    <div className="text-xs text-muted-foreground mb-1">Teórico</div>
                                                                    <div className="text-base font-semibold">
                                                                      {material.cantidad_teorica.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{material.unit}</span>
                                                                    </div>
                                                                  </div>
                                                                  <div>
                                                                    <div className="text-xs text-muted-foreground mb-1">Real</div>
                                                                    <div className="text-base font-semibold">
                                                                      {material.cantidad_real.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{material.unit}</span>
                                                                    </div>
                                                                  </div>
                                                                  <div>
                                                                    <div className="text-xs text-muted-foreground mb-1">Ajuste</div>
                                                                    <div className={`text-base font-semibold ${
                                                                      material.ajuste > 0 ? 'text-orange-600' : 
                                                                      material.ajuste < 0 ? 'text-blue-600' : 
                                                                      'text-muted-foreground'
                                                                    }`}>
                                                                      {material.ajuste > 0 ? '+' : ''}{material.ajuste.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{material.unit}</span>
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                                
                                                                {/* Consumption per m³ */}
                                                                <div className="grid grid-cols-2 gap-4">
                                                                  <div>
                                                                    <div className="text-xs text-muted-foreground mb-1">Consumo por m³</div>
                                                                    <div className="text-lg font-semibold">
                                                                      {material.consumptionPerM3.toFixed(3)} <span className="text-sm font-normal text-muted-foreground">{material.unit}/m³</span>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                      ({material.cantidad_real.toFixed(2)} ÷ {remision.volumen_fabricado.toFixed(2)} m³)
                                                                    </div>
                                                                  </div>
                                                                  <div>
                                                                    <div className="text-xs text-muted-foreground mb-1">Promedio Receta</div>
                                                                    <div className="text-lg font-semibold text-muted-foreground">
                                                                      {material.avgConsumptionPerM3.toFixed(3)} <span className="text-sm font-normal">{material.unit}/m³</span>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                      Consumo por m³ promedio
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            </div>
                                                            <div className="ml-4 text-right">
                                                              <div className={`text-2xl font-bold ${
                                                                material.deviation > 0 ? 'text-orange-600' : 'text-blue-600'
                                                              }`}>
                                                                {material.deviation > 0 ? '+' : ''}{material.deviation.toFixed(1)}%
                                                              </div>
                                                              <div className="text-xs text-muted-foreground mt-1">
                                                                {material.deviation > 0 ? 'Arriba' : 'Abajo'} del promedio
                                                              </div>
                                                              {material.has_price && (
                                                                <div className="text-sm text-muted-foreground mt-2">
                                                                  {formatCurrency(material.total_cost)}
                                                                </div>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* Normal Materials - Collapsible Section */}
                                            {normalMaterials.length > 0 && (
                                              <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                  <h3 className="text-lg font-semibold">Materiales Dentro del Rango Normal</h3>
                                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    {normalMaterials.length} material{normalMaterials.length > 1 ? 'es' : ''}
                                                  </Badge>
                                                </div>
                                                
                                                <div className="border rounded-lg overflow-hidden">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead>Material</TableHead>
                                                        <TableHead className="text-right">Teórico</TableHead>
                                                        <TableHead className="text-right">Real</TableHead>
                                                        <TableHead className="text-right">Ajuste</TableHead>
                                                        <TableHead className="text-right">Consumo por m³</TableHead>
                                                        {normalMaterials.some(m => m.has_price) && (
                                                          <TableHead className="text-right">Costo</TableHead>
                                                        )}
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {groupByCategory(normalMaterials).flatMap(([category, materials]) => 
                                                        materials.map((material) => (
                                                          <TableRow key={material.material_id} className="hover:bg-muted/50">
                                                            <TableCell>
                                                              <div>
                                                                <div className="font-medium">{material.material_name}</div>
                                                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                                                  <span>{material.material_code}</span>
                                                                  <span>•</span>
                                                                  <span>{category}</span>
                                                                </div>
                                                              </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                              <div className="font-medium text-muted-foreground">
                                                                {material.cantidad_teorica.toFixed(2)} <span className="text-sm font-normal">{material.unit}</span>
                                                              </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                              <div className="font-semibold text-base">
                                                                {material.cantidad_real.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{material.unit}</span>
                                                              </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                              <div className={`font-medium ${
                                                                material.ajuste > 0 ? 'text-orange-600' : 
                                                                material.ajuste < 0 ? 'text-blue-600' : 
                                                                'text-muted-foreground'
                                                              }`}>
                                                                {material.ajuste > 0 ? '+' : ''}{material.ajuste.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{material.unit}</span>
                                                              </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                              <div className="font-medium">
                                                                {material.consumptionPerM3.toFixed(3)} <span className="text-sm font-normal text-muted-foreground">{material.unit}/m³</span>
                                                              </div>
                                                              {material.avgConsumptionPerM3 > 0 && (
                                                                <div className="text-xs text-muted-foreground mt-1">
                                                                  Promedio: {material.avgConsumptionPerM3.toFixed(3)} {material.unit}/m³
                                                                </div>
                                                              )}
                                                              <div className="text-xs text-muted-foreground mt-0.5">
                                                                ({material.cantidad_real.toFixed(2)} ÷ {remision.volumen_fabricado.toFixed(2)} m³)
                                                              </div>
                                                            </TableCell>
                                                            {normalMaterials.some(m => m.has_price) && (
                                                              <TableCell className="text-right">
                                                                {material.has_price ? (
                                                                  <div>
                                                                    <div className="font-medium">{formatCurrency(material.total_cost)}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatCurrency(material.price)}/{material.unit}</div>
                                                                  </div>
                                                                ) : (
                                                                  <span className="text-muted-foreground text-sm">N/A</span>
                                                                )}
                                                              </TableCell>
                                                            )}
                                                          </TableRow>
                                                        ))
                                                      )}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </div>
                                            )}

                                            {materialsWithDeviation.length === 0 && (
                                              <div className="text-center py-8 text-muted-foreground">
                                                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-600" />
                                                <p>No hay datos de materiales disponibles para esta remisión.</p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </CardContent>
                                  </Card>
                                </div>
                              );
                            })()}
                          </>
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
