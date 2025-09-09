'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { BarChart3, TrendingUp, Package, DollarSign, ArrowRight, Eye, Download, TrendingDown, Crown } from "lucide-react";
import * as XLSX from 'xlsx';
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets"
import Link from 'next/link';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Filter } from "lucide-react";

// Types for comparative production data
interface PlantProductionData {
  plant_id: string;
  plant_code: string;
  plant_name: string;
  total_volume: number;
  total_material_cost: number;
  cement_consumption: number;
  cement_cost_per_m3: number;
  avg_cost_per_m3: number;
  remisiones_count: number;
  additive_consumption: number;
  additive_cost: number;
  aggregate_consumption: number;
  aggregate_cost: number;
  water_consumption: number;
  fc_ponderada: number;
  edad_ponderada: number;
}

interface ComparativeData {
  section1: PlantProductionData[];  // Consumo
  section2: PlantProductionData[];  // Precios MP
  section3: PlantProductionData[];  // Costo Total MP
  section4: PlantProductionData[];  // Rendimientos
}

export default function ComparativaProduccion() {
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [comparativeData, setComparativeData] = useState<ComparativeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availablePlants, setAvailablePlants] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [previousMonthData, setPreviousMonthData] = useState<PlantProductionData[]>([]);

  // Format the dates for display
  const dateRangeText = useMemo(() => {
    if (!startDate || !endDate) return 'Seleccione un rango de fechas';
    return `${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`;
  }, [startDate, endDate]);

  // Fetch available plants
  useEffect(() => {
    async function fetchPlants() {
      try {
        const { data: plants, error: plantsError } = await supabase
          .from('plants')
          .select('id, code, name')
          .eq('is_active', true)
          .order('code');

        if (plantsError) throw plantsError;
        setAvailablePlants(plants || []);
        // Select all plants by default
        setSelectedPlants((plants || []).map(p => p.id));
      } catch (error) {
        console.error('Error fetching plants:', error);
      }
    }

    fetchPlants();
  }, []);

  // Fetch comparative production data
  useEffect(() => {
    async function fetchComparativeData() {
      if (!startDate || !endDate || availablePlants.length === 0 || selectedPlants.length === 0) {
        setComparativeData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        const plantData: PlantProductionData[] = [];

        // Fetch data only for selected plants
        const plantsToProcess = availablePlants.filter(plant => selectedPlants.includes(plant.id));
        for (const plant of plantsToProcess) {
          const plantProduction = await fetchPlantProductionData(
            plant.id,
            plant.code,
            plant.name,
            formattedStartDate,
            formattedEndDate
          );
          if (plantProduction) {
            plantData.push(plantProduction);
          }
        }

        // Get previous month data for comparison
        const prevMonthData = await fetchPreviousMonthData();
        setPreviousMonthData(prevMonthData);

        // Organize data into sections like the reference image
        const comparative: ComparativeData = {
          section1: plantData, // Consumo (Volume and cement consumption)
          section2: plantData, // Precios MP (Material prices)
          section3: plantData, // Costo Total MP (Total material costs)
          section4: plantData  // Rendimientos (Performance metrics)
        };

        setComparativeData(comparative);

      } catch (error) {
        console.error('Error fetching comparative data:', error);
        setError('Error al cargar los datos comparativos. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchComparativeData();
  }, [startDate, endDate, availablePlants, selectedPlants]);

  // Function to fetch previous month data for comparison
  const fetchPreviousMonthData = async (): Promise<PlantProductionData[]> => {
    if (!startDate || selectedPlants.length === 0) return [];

    try {
      // Calculate previous month date range
      const prevMonthStart = startOfMonth(subMonths(startDate, 1));
      const prevMonthEnd = endOfMonth(subMonths(startDate, 1));
      const formattedPrevStart = format(prevMonthStart, 'yyyy-MM-dd');
      const formattedPrevEnd = format(prevMonthEnd, 'yyyy-MM-dd');

      const plantData: PlantProductionData[] = [];

      // Fetch data only for selected plants
      const plantsToProcess = availablePlants.filter(plant => selectedPlants.includes(plant.id));
      for (const plant of plantsToProcess) {
        const plantProduction = await fetchPlantProductionData(
          plant.id,
          plant.code,
          plant.name,
          formattedPrevStart,
          formattedPrevEnd
        );
        if (plantProduction) {
          plantData.push(plantProduction);
        }
      }

      return plantData;
    } catch (error) {
      console.error('Error fetching previous month data:', error);
      return [];
    }
  };

  // Fetch production data for a specific plant
  const fetchPlantProductionData = async (
    plantId: string,
    plantCode: string,
    plantName: string,
    startDateStr: string,
    endDateStr: string
  ): Promise<PlantProductionData | null> => {
    try {
      // Fetch remisiones for this plant
      const { data: remisiones, error: remisionesError } = await supabase
        .from('remisiones')
        .select(`
          id,
          volumen_fabricado,
          recipe_id,
          recipes!inner(
            id,
            recipe_code,
            strength_fc,
            age_days
          )
        `)
        .eq('tipo_remision', 'CONCRETO')
        .eq('plant_id', plantId)
        .gte('fecha', startDateStr)
        .lte('fecha', endDateStr);

      if (remisionesError) throw remisionesError;

      if (!remisiones || remisiones.length === 0) {
        return {
          plant_id: plantId,
          plant_code: plantCode,
          plant_name: plantName,
          total_volume: 0,
          total_material_cost: 0,
          cement_consumption: 0,
          cement_cost_per_m3: 0,
          avg_cost_per_m3: 0,
          remisiones_count: 0,
          additive_consumption: 0,
          additive_cost: 0,
          aggregate_consumption: 0,
          aggregate_cost: 0,
          water_consumption: 0,
          fc_ponderada: 0,
          edad_ponderada: 0
        };
      }

      const totalVolume = remisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
      const remisionIds = remisiones.map(r => r.id);

      // Fetch material costs for these remisiones
      const materialCosts = await calculateMaterialCosts(remisionIds, totalVolume, plantId);

      // Calculate F'c ponderada and edad ponderada
      let fcPonderada = 0;
      let edadPonderada = 0;
      
      if (totalVolume > 0) {
        let sumFcVolume = 0;
        let sumEdadVolume = 0;
        
        remisiones.forEach(remision => {
          const volume = remision.volumen_fabricado || 0;
          const fc = remision.recipes?.strength_fc || 0;
          const edad = remision.recipes?.age_days || 28;
          
          sumFcVolume += fc * volume;
          sumEdadVolume += edad * volume;
        });
        
        fcPonderada = sumFcVolume / totalVolume;
        edadPonderada = sumEdadVolume / totalVolume;
      }

      return {
        plant_id: plantId,
        plant_code: plantCode,
        plant_name: plantName,
        total_volume: totalVolume,
        total_material_cost: materialCosts.totalCost,
        cement_consumption: materialCosts.cementConsumption,
        cement_cost_per_m3: totalVolume > 0 ? materialCosts.cementCost / totalVolume : 0,
        avg_cost_per_m3: totalVolume > 0 ? materialCosts.totalCost / totalVolume : 0,
        remisiones_count: remisiones.length,
        additive_consumption: materialCosts.additiveConsumption,
        additive_cost: materialCosts.additiveCost,
        aggregate_consumption: materialCosts.aggregateConsumption,
        aggregate_cost: materialCosts.aggregateCost,
        water_consumption: materialCosts.waterConsumption,
        fc_ponderada: fcPonderada,
        edad_ponderada: edadPonderada
      };

    } catch (error) {
      console.error(`Error fetching data for plant ${plantCode}:`, error);
      return null;
    }
  };

  // Calculate material costs for remisiones using the same logic as detail page
  const calculateMaterialCosts = async (remisionIds: string[], totalVolume: number, plantId: string) => {
    try {
      if (!remisionIds || remisionIds.length === 0 || totalVolume <= 0) {
        return {
          totalCost: 0,
          cementConsumption: 0,
          cementCost: 0,
          additiveConsumption: 0,
          additiveCost: 0,
          aggregateConsumption: 0,
          aggregateCost: 0,
          waterConsumption: 0
        };
      }

      // Fetch actual consumptions from remision_materiales with proper material relationships
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
          totalCost: 0,
          cementConsumption: 0,
          cementCost: 0,
          additiveConsumption: 0,
          additiveCost: 0,
          aggregateConsumption: 0,
          aggregateCost: 0,
          waterConsumption: 0
        };
      }

      // Aggregate by material_id
      const aggregatedByMaterial = new Map<string, { qty: number, material: any, fallbackType?: string }>();
      materiales.forEach((m: any) => {
        if (!m.material_id || !m.materials) return;
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
      if (plantId) {
        pricesQuery = pricesQuery.eq('plant_id', plantId);
      }

      const { data: materialPrices, error: pricesError } = await pricesQuery;

      if (pricesError) {
        console.error('Error fetching material prices:', pricesError);
      }

      // Create price lookup by material_id
      const priceMap = new Map();
      materialPrices?.forEach((mp: any) => {
        if (!priceMap.has(mp.material_id)) {
          priceMap.set(mp.material_id, mp.price_per_unit);
        }
      });

      // Calculate costs and categorize materials
      let totalCost = 0;
      let cementConsumption = 0;
      let cementCost = 0;
      let additiveConsumption = 0;
      let additiveCost = 0;
      let aggregateConsumption = 0;
      let aggregateCost = 0;
      let waterConsumption = 0;

      aggregatedByMaterial.forEach(({ qty, material, fallbackType }, materialId) => {
        const price = Number(priceMap.get(materialId)) || 0;
        const cost = qty * price;

        totalCost += cost;

        // Categorize materials based on name and category
        const typeOrName = String(
          material.category || material.material_name || fallbackType || ''
        ).toLowerCase();

        if (typeOrName.includes('cement') || typeOrName.includes('cemento')) {
          cementConsumption += qty;
          cementCost += cost;
        } else if (typeOrName.includes('aditivo') || typeOrName.includes('additive') || 
                   typeOrName.includes('plastificante') || typeOrName.includes('superplastificante')) {
          additiveConsumption += qty;
          additiveCost += cost;
        } else if (typeOrName.includes('agregado') || typeOrName.includes('arena') || 
                   typeOrName.includes('grava') || typeOrName.includes('piedra') ||
                   typeOrName.includes('aggregate') || typeOrName.includes('sand') ||
                   typeOrName.includes('gravel') || typeOrName.includes('stone')) {
          aggregateConsumption += qty;
          aggregateCost += cost;
        } else if (typeOrName.includes('agua') || typeOrName.includes('water')) {
          waterConsumption += qty;
        }
      });

      return {
        totalCost,
        cementConsumption,
        cementCost,
        additiveConsumption,
        additiveCost,
        aggregateConsumption,
        aggregateCost,
        waterConsumption
      };

    } catch (error) {
      console.error('Error calculating material costs:', error);
      return {
        totalCost: 0,
        cementConsumption: 0,
        cementCost: 0,
        additiveConsumption: 0,
        additiveCost: 0,
        aggregateConsumption: 0,
        aggregateCost: 0,
        waterConsumption: 0
      };
    }
  };

  // Export data to Excel
  const exportToExcel = () => {
    if (!comparativeData || comparativeData.section1.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Create data for each section
    const section1Data = comparativeData.section1.map(plant => ({
      'Planta': plant.plant_code,
      'Nombre': plant.plant_name,
      'Volumen Total (m³)': plant.total_volume.toFixed(2),
      'Cemento (kg)': plant.cement_consumption.toFixed(2),
      'Aditivo (kg)': plant.additive_consumption.toFixed(2),
      'Agua (L)': plant.water_consumption.toFixed(2)
    }));

    const section2Data = comparativeData.section2.map(plant => ({
      'Planta': plant.plant_code,
      'Volumen Total (m³)': plant.total_volume.toFixed(2),
      'Cemento ($/m³)': plant.cement_cost_per_m3.toFixed(2),
      'Agregado ($/m³)': (plant.total_volume > 0 ? plant.aggregate_cost / plant.total_volume : 0).toFixed(2),
      'Aditivo ($/m³)': (plant.total_volume > 0 ? plant.additive_cost / plant.total_volume : 0).toFixed(2)
    }));

    const section3Data = comparativeData.section3.map(plant => ({
      'Planta': plant.plant_code,
      'Volumen Total (m³)': plant.total_volume.toFixed(2),
      'Cemento ($)': plant.total_material_cost.toFixed(2),
      'Agregado ($)': plant.aggregate_cost.toFixed(2),
      'Aditivo ($)': plant.additive_cost.toFixed(2)
    }));

    const section4Data = comparativeData.section4.map(plant => ({
      'Planta': plant.plant_code,
      'Total $ Materia Prima': plant.total_material_cost.toFixed(2),
      'Total $ Materia Prima / m³': plant.avg_cost_per_m3.toFixed(2),
      'F\'c Ponderada (kg/cm²)': plant.fc_ponderada.toFixed(0),
      'Edad Ponderada (días)': plant.edad_ponderada.toFixed(0),
      'Cemento / m³ (kg)': (plant.total_volume > 0 ? plant.cement_consumption / plant.total_volume : 0).toFixed(2),
      '$ Cemento / m³': plant.cement_cost_per_m3.toFixed(2)
    }));

    // Add worksheets
    const ws1 = XLSX.utils.json_to_sheet(section1Data);
    const ws2 = XLSX.utils.json_to_sheet(section2Data);
    const ws3 = XLSX.utils.json_to_sheet(section3Data);
    const ws4 = XLSX.utils.json_to_sheet(section4Data);

    XLSX.utils.book_append_sheet(workbook, ws4, 'Rendimientos');
    XLSX.utils.book_append_sheet(workbook, ws1, 'Consumo');
    XLSX.utils.book_append_sheet(workbook, ws2, 'Precios MP');
    XLSX.utils.book_append_sheet(workbook, ws3, 'Costo Total MP');

    // Save file
    const fileName = `Comparativo_Plantas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setStartDate(range.from);
      setEndDate(range.to);
    }
  };

  // Handle plant selection
  const handlePlantToggle = (plantId: string) => {
    setSelectedPlants(prev => {
      if (prev.includes(plantId)) {
        return prev.filter(id => id !== plantId);
      } else {
        return [...prev, plantId];
      }
    });
  };

  const handleSelectAllPlants = () => {
    setSelectedPlants(availablePlants.map(p => p.id));
  };

  const handleDeselectAllPlants = () => {
    setSelectedPlants([]);
  };

  // Helper function for ranking indicators (for volume columns)
  const getRankingIndicator = (position: number, currentValue: number, previousValue: number | null) => {
    const ranking = position + 1;
    let percentage = 0;
    
    if (position > 0 && previousValue && previousValue > 0) {
      percentage = Math.round(((previousValue - currentValue) / previousValue) * 100);
    }
    
    return {
      position: ranking,
      percentage: percentage,
      isFirst: position === 0
    };
  };


  // Helper function to render normal cell without indicators
  const renderNormalCell = (formattedValue: string) => {
    return <TableCell>{formattedValue}</TableCell>;
  };

  // Helper function to render volume cell with ranking indicator
  const renderVolumeCell = (position: number, currentValue: number, previousValue: number | null, formattedValue: string) => {
    const indicator = getRankingIndicator(position, currentValue, previousValue);
    
    const getBadgeColor = () => {
      switch (indicator.position) {
        case 1: return 'bg-green-100 text-green-800 border-green-200'; // Green for Top 1 (best)
        case 2: return 'bg-green-50 text-green-700 border-green-200'; // Light green for Top 2
        case 3: return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Yellow for Top 3 (warning)
        default: return 'bg-red-100 text-red-700 border-red-200'; // Red for others (poor performance)
      }
    };

    const getRankText = () => {
      if (indicator.isFirst) {
        return `Top ${indicator.position}`;
      } else {
        return `Top ${indicator.position} (-${indicator.percentage}%)`;
      }
    };

    return (
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{formattedValue}</span>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeColor()}`}>
            <TrendingDown className="h-3 w-3" />
            <span>{getRankText()}</span>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper functions for sorting data
  const getSortedDataByVolume = (data: PlantProductionData[]) => {
    return [...data].sort((a, b) => b.total_volume - a.total_volume); // Descending (mayor a menor)
  };

  const getSortedDataByCementPerM3 = (data: PlantProductionData[]) => {
    return [...data].sort((a, b) => {
      const aCementPerM3 = a.total_volume > 0 ? a.cement_consumption / a.total_volume : 0;
      const bCementPerM3 = b.total_volume > 0 ? b.cement_consumption / b.total_volume : 0;
      return aCementPerM3 - bCementPerM3; // Ascending (menor a mayor)
    });
  };

  // Helper function to render cement consumption cell with monthly comparison
  const renderCementConsumptionCell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.total_volume > 0 && plant.total_volume > 0) {
      const currentCementPerM3 = plant.cement_consumption / plant.total_volume;
      const prevCementPerM3 = prevMonthPlant.cement_consumption / prevMonthPlant.total_volume;
      
      if (prevCementPerM3 > 0) {
        monthlyChange = Math.round(((currentCementPerM3 - prevCementPerM3) / prevCementPerM3) * 100);
        hasComparison = true;
      }
    }

    const getBadgeColor = () => {
      if (!hasComparison) return 'bg-gray-100 text-gray-600 border-gray-200';
      if (monthlyChange < 0) return 'bg-green-100 text-green-800 border-green-200'; // Improvement (less cement)
      if (monthlyChange > 0) return 'bg-red-100 text-red-700 border-red-200'; // Worse (more cement)
      return 'bg-blue-100 text-blue-700 border-blue-200'; // No change
    };

    const getChangeText = () => {
      if (!hasComparison) return 'Sin datos';
      
      const prevCementPerM3 = prevMonthPlant && prevMonthPlant.total_volume > 0 
        ? prevMonthPlant.cement_consumption / prevMonthPlant.total_volume 
        : 0;
      
      const prevValueFormatted = prevCementPerM3.toLocaleString('es-MX', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
      
      if (monthlyChange === 0) return `0% (${prevValueFormatted})`;
      if (monthlyChange > 0) return `+${monthlyChange}% (${prevValueFormatted})`;
      return `${monthlyChange}% (${prevValueFormatted})`;
    };

    const getIcon = () => {
      if (!hasComparison) return <TrendingDown className="h-3 w-3" />;
      if (monthlyChange < 0) return <TrendingDown className="h-3 w-3 rotate-180" />; // Arrow up for improvement
      if (monthlyChange > 0) return <TrendingDown className="h-3 w-3" />; // Arrow down for worse
      return <TrendingDown className="h-3 w-3 rotate-90" />; // Arrow right for no change
    };

    return (
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{formattedValue}</span>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeColor()}`}>
            {getIcon()}
            <div className="flex flex-col">
              <span>
                {hasComparison ? (
                  monthlyChange === 0 ? '0%' : 
                  monthlyChange > 0 ? `+${monthlyChange}%` : `${monthlyChange}%`
                ) : 'Sin datos'}
              </span>
              {hasComparison && (
                <span className="text-gray-700 text-xs">
                  Anterior: {(prevMonthPlant && prevMonthPlant.total_volume > 0 
                    ? (prevMonthPlant.cement_consumption / prevMonthPlant.total_volume).toLocaleString('es-MX', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })
                    : '0.00'
                  )} kg/m³
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper function to render cement cost cell with monthly comparison
  const renderCementCostCell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.cement_cost_per_m3 > 0 && plant.cement_cost_per_m3 > 0) {
      monthlyChange = Math.round(((plant.cement_cost_per_m3 - prevMonthPlant.cement_cost_per_m3) / prevMonthPlant.cement_cost_per_m3) * 100);
      hasComparison = true;
    }

    const getBadgeColor = () => {
      if (!hasComparison) return 'bg-gray-100 text-gray-600 border-gray-200';
      if (monthlyChange < 0) return 'bg-green-100 text-green-800 border-green-200'; // Improvement (lower cost)
      if (monthlyChange > 0) return 'bg-red-100 text-red-700 border-red-200'; // Worse (higher cost)
      return 'bg-blue-100 text-blue-700 border-blue-200'; // No change
    };

    const getIcon = () => {
      if (!hasComparison) return <TrendingDown className="h-3 w-3" />;
      if (monthlyChange < 0) return <TrendingDown className="h-3 w-3 rotate-180" />; // Arrow up for improvement (lower cost)
      if (monthlyChange > 0) return <TrendingDown className="h-3 w-3" />; // Arrow down for worse (higher cost)
      return <TrendingDown className="h-3 w-3 rotate-90" />; // Arrow right for no change
    };

    return (
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{formattedValue}</span>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeColor()}`}>
            {getIcon()}
            <div className="flex flex-col">
              <span>
                {hasComparison ? (
                  monthlyChange === 0 ? '0%' : 
                  monthlyChange > 0 ? `+${monthlyChange}%` : `${monthlyChange}%`
                ) : 'Sin datos'}
              </span>
              {hasComparison && prevMonthPlant && (
                <span className="text-gray-700 text-xs">
                  Anterior: ${prevMonthPlant.cement_cost_per_m3.toLocaleString('es-MX', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper function to render F'c ponderada cell with monthly comparison
  const renderFcPonderadaCell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.fc_ponderada > 0 && plant.fc_ponderada > 0) {
      monthlyChange = Math.round(((plant.fc_ponderada - prevMonthPlant.fc_ponderada) / prevMonthPlant.fc_ponderada) * 100);
      hasComparison = true;
    }

    const getBadgeColor = () => {
      if (!hasComparison) return 'bg-gray-100 text-gray-600 border-gray-200';
      if (monthlyChange > 0) return 'bg-blue-100 text-blue-700 border-blue-200'; // Higher F'c
      if (monthlyChange < 0) return 'bg-blue-100 text-blue-700 border-blue-200'; // Lower F'c
      return 'bg-blue-100 text-blue-700 border-blue-200'; // No change
    };

    const getIcon = () => {
      if (!hasComparison) return <TrendingDown className="h-3 w-3" />;
      if (monthlyChange > 0) return <TrendingDown className="h-3 w-3 rotate-180" />; // Arrow up for improvement
      if (monthlyChange < 0) return <TrendingDown className="h-3 w-3" />; // Arrow down for worse
      return <TrendingDown className="h-3 w-3 rotate-90" />; // Arrow right for no change
    };

    return (
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{formattedValue}</span>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeColor()}`}>
            {getIcon()}
            <div className="flex flex-col">
              <span>
                {hasComparison ? (
                  monthlyChange === 0 ? '0%' : 
                  monthlyChange > 0 ? `+${monthlyChange}%` : `${monthlyChange}%`
                ) : 'Sin datos'}
              </span>
              {hasComparison && prevMonthPlant && (
                <span className="text-gray-700 text-xs">
                  Anterior: {prevMonthPlant.fc_ponderada.toLocaleString('es-MX', { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 0 
                  })} kg/cm²
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper function to render edad ponderada cell with monthly comparison
  const renderEdadPonderadaCell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.edad_ponderada > 0 && plant.edad_ponderada > 0) {
      monthlyChange = Math.round(((plant.edad_ponderada - prevMonthPlant.edad_ponderada) / prevMonthPlant.edad_ponderada) * 100);
      hasComparison = true;
    }

    const getBadgeColor = () => {
      if (!hasComparison) return 'bg-gray-100 text-gray-600 border-gray-200';
      if (monthlyChange > 0) return 'bg-blue-100 text-blue-700 border-blue-200'; // Higher age could be neutral
      if (monthlyChange < 0) return 'bg-blue-100 text-blue-700 border-blue-200'; // Lower age could be neutral
      return 'bg-blue-100 text-blue-700 border-blue-200'; // No change
    };

    const getIcon = () => {
      if (!hasComparison) return <TrendingDown className="h-3 w-3" />;
      if (monthlyChange > 0) return <TrendingDown className="h-3 w-3 rotate-180" />; // Arrow up
      if (monthlyChange < 0) return <TrendingDown className="h-3 w-3" />; // Arrow down
      return <TrendingDown className="h-3 w-3 rotate-90" />; // Arrow right for no change
    };

    return (
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{formattedValue}</span>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeColor()}`}>
            {getIcon()}
            <div className="flex flex-col">
              <span>
                {hasComparison ? (
                  monthlyChange === 0 ? '0%' : 
                  monthlyChange > 0 ? `+${monthlyChange}%` : `${monthlyChange}%`
                ) : 'Sin datos'}
              </span>
              {hasComparison && prevMonthPlant && (
                <span className="text-gray-700 text-xs">
                  Anterior: {prevMonthPlant.edad_ponderada.toLocaleString('es-MX', { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 0 
                  })} días
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análisis Comparativo de Plantas</h1>
          <p className="text-muted-foreground mt-2">
            Comparación de rendimiento y costos entre plantas - {dateRangeText}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Plant Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Plantas ({selectedPlants.length})
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Seleccionar Plantas</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllPlants}
                      className="h-6 px-2 text-xs"
                    >
                      Todas
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAllPlants}
                      className="h-6 px-2 text-xs"
                    >
                      Ninguna
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availablePlants.map((plant) => (
                    <div key={plant.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={plant.id}
                        checked={selectedPlants.includes(plant.id)}
                        onCheckedChange={() => handlePlantToggle(plant.id)}
                      />
                      <Label
                        htmlFor={plant.id}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        <span className="font-medium">{plant.code}</span> - {plant.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button 
            onClick={exportToExcel} 
            variant="outline" 
            className="gap-2"
            disabled={!comparativeData || comparativeData.section1.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
          <DateRangePickerWithPresets
            dateRange={{ from: startDate, to: endDate }}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Quick access to detailed analysis */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Análisis Detallado por Planta</h3>
              <p className="text-sm text-muted-foreground">
                Accede al análisis completo con desglose de materiales y tendencias
              </p>
            </div>
            <Link href="/finanzas/produccion/detalle">
              <Button variant="outline" className="gap-2">
                <Eye className="h-4 w-4" />
                Ver Análisis Detallado
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {comparativeData && (
        <div className="space-y-8">
          {/* Sección 1: Rendimientos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Rendimientos
              </CardTitle>
              <CardDescription>
                Métricas de rendimiento y eficiencia por planta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Total $ Materia Prima</TableHead>
                    <TableHead>Total $ Materia Prima / m³</TableHead>
                    <TableHead>F'c Ponderada</TableHead>
                    <TableHead>Edad Ponderada</TableHead>
                    <TableHead>Cemento / m³</TableHead>
                    <TableHead>$ Cemento / m³</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedDataByCementPerM3(comparativeData.section4).map((plant) => {
                    return (
                      <TableRow key={plant.plant_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plant.plant_code}</div>
                          </div>
                        </TableCell>
                        {renderNormalCell(formatCurrency(plant.total_material_cost))}
                        {renderNormalCell(formatCurrency(plant.avg_cost_per_m3))}
                        {renderFcPonderadaCell(
                          plant,
                          `${plant.fc_ponderada.toLocaleString('es-MX', { 
                            minimumFractionDigits: 0, 
                            maximumFractionDigits: 0 
                          })} kg/cm²`
                        )}
                        {renderEdadPonderadaCell(
                          plant,
                          `${plant.edad_ponderada.toLocaleString('es-MX', { 
                            minimumFractionDigits: 0, 
                            maximumFractionDigits: 0 
                          })} días`
                        )}
                        {renderCementConsumptionCell(
                          plant,
                          `${plant.total_volume > 0 
                            ? (plant.cement_consumption / plant.total_volume).toLocaleString('es-MX', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                              })
                            : '0.00'
                          } kg/m³`
                        )}
                        {renderCementCostCell(plant, formatCurrency(plant.cement_cost_per_m3))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sección 2: Consumo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Consumo
              </CardTitle>
              <CardDescription>
                Volumen total producido y consumo de cemento por planta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Volumen Total (m³)</TableHead>
                    <TableHead>Cemento (kg)</TableHead>
                    <TableHead>Agregado (kg)</TableHead>
                    <TableHead>Aditivo (kg)</TableHead>
                    <TableHead>Agua (L)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedDataByVolume(comparativeData.section1).map((plant, index) => {
                    const sortedData = getSortedDataByVolume(comparativeData.section1);
                    const previousPlant = index > 0 ? sortedData[index - 1] : null;

                    return (
                      <TableRow key={plant.plant_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plant.plant_code}</div>
                            <div className="text-sm text-muted-foreground">{plant.plant_name}</div>
                          </div>
                        </TableCell>
                        {renderVolumeCell(
                          index,
                          plant.total_volume,
                          previousPlant?.total_volume || null,
                          plant.total_volume.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })
                        )}
                        {renderNormalCell(plant.cement_consumption.toLocaleString('es-MX'))}
                        {renderNormalCell(plant.aggregate_consumption.toLocaleString('es-MX'))}
                        {renderNormalCell(plant.additive_consumption.toLocaleString('es-MX'))}
                        {renderNormalCell(plant.water_consumption.toLocaleString('es-MX'))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sección 3: Precios MP */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Precios MP
              </CardTitle>
              <CardDescription>
                Precios promedio de materias primas por planta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Volumen Total (m³)</TableHead>
                    <TableHead>Cemento</TableHead>
                    <TableHead>Agregado</TableHead>
                    <TableHead>Aditivo</TableHead>
                    <TableHead>Agua</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedDataByVolume(comparativeData.section2).map((plant, index) => {
                    const sortedData = getSortedDataByVolume(comparativeData.section2);
                    const previousPlant = index > 0 ? sortedData[index - 1] : null;

                    return (
                      <TableRow key={plant.plant_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plant.plant_code}</div>
                          </div>
                        </TableCell>
                        {renderVolumeCell(
                          index,
                          plant.total_volume,
                          previousPlant?.total_volume || null,
                          plant.total_volume.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })
                        )}
                        {renderNormalCell(formatCurrency(plant.cement_cost_per_m3))}
                        {renderNormalCell(formatCurrency(plant.total_volume > 0 ? plant.aggregate_cost / plant.total_volume : 0))}
                        {renderNormalCell(formatCurrency(plant.total_volume > 0 ? plant.additive_cost / plant.total_volume : 0))}
                        <TableCell>
                          {plant.water_consumption > 0 ? '$0.00' : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sección 4: Costo Total MP */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Costo Total MP
              </CardTitle>
              <CardDescription>
                Costo total de materias primas por planta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Volumen Total (m³)</TableHead>
                    <TableHead>Cemento</TableHead>
                    <TableHead>Agregado</TableHead>
                    <TableHead>Aditivo</TableHead>
                    <TableHead>Agua</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedDataByVolume(comparativeData.section3).map((plant, index) => {
                    const sortedData = getSortedDataByVolume(comparativeData.section3);
                    const previousPlant = index > 0 ? sortedData[index - 1] : null;

                    return (
                      <TableRow key={plant.plant_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plant.plant_code}</div>
                          </div>
                        </TableCell>
                        {renderVolumeCell(
                          index,
                          plant.total_volume,
                          previousPlant?.total_volume || null,
                          plant.total_volume.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })
                        )}
                        {renderNormalCell(formatCurrency(plant.total_material_cost))}
                        {renderNormalCell(formatCurrency(plant.aggregate_cost))}
                        {renderNormalCell(formatCurrency(plant.additive_cost))}
                        <TableCell>
                          {plant.water_consumption > 0 ? '$0.00' : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {(!comparativeData || comparativeData.section1.length === 0) && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">Sin datos de producción</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No se encontraron datos de producción para el rango de fechas seleccionado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
