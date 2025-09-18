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
import { ChevronDown, Filter, Loader2 } from "lucide-react";
import { useProgressiveProductionComparison } from '@/hooks/useProgressiveProductionComparison';

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
  const { data: progData, previousMonthData: progPrev, loading: progLoading, streaming, progress, error: progError, comparisonStreaming, comparisonProgress } = useProgressiveProductionComparison({
    startDate,
    endDate,
    selectedPlantIds: selectedPlants,
  });

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

  // Mirror progressive results into local state for rendering
  useEffect(() => {
    if (progError) setError(progError);
    if (!progError && progLoading) setError(null);
    if (progData) setComparativeData(progData);
    if (progPrev) setPreviousMonthData(progPrev);
    setLoading(progLoading);
  }, [progData, progPrev, progLoading, progError]);

  // Previous month data now comes from the progressive hook

  // Plant-level fetching moved to the progressive hook

  // Cost calculation moved to the progressive hook

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

  // Helper function to render normal cell without indicators
  const renderNormalCell = (formattedValue: string) => {
    return <TableCell>{formattedValue}</TableCell>;
  };

  // Helper function to render volume cell with monthly comparison (vs previous month)
  const renderVolumeComparisonCell = (plant: PlantProductionData, formattedValue: string) => {
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.total_volume > 0 && plant.total_volume > 0) {
      monthlyChange = Math.round(((plant.total_volume - prevMonthPlant.total_volume) / prevMonthPlant.total_volume) * 100);
      hasComparison = true;
    }

    const getBadgeColor = () => {
      // Neutral styling (volume increase/decrease isn't inherently good/bad)
      return hasComparison ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200';
    };

    const getIcon = () => {
      if (!hasComparison) return <TrendingDown className="h-3 w-3" />;
      if (monthlyChange > 0) return <TrendingDown className="h-3 w-3 rotate-180" />; // up
      if (monthlyChange < 0) return <TrendingDown className="h-3 w-3" />; // down
      return <TrendingDown className="h-3 w-3 rotate-90" />; // flat
    };

    return (
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{formattedValue}</span>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getBadgeColor()}`}>
            {getIcon()}
            <div className="flex flex-col">
              <span>
                {hasComparison ? (
                  monthlyChange === 0 ? '0%' : monthlyChange > 0 ? `+${monthlyChange}%` : `${monthlyChange}%`
                ) : 'Sin datos'}
              </span>
              {hasComparison && prevMonthPlant && (
                <span className="text-gray-700 text-xs">
                  Anterior: {prevMonthPlant.total_volume.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³
                </span>
              )}
            </div>
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

  // Helper function to render total material cost cell with monthly comparison
  const renderTotalMaterialCostCell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.total_material_cost > 0 && plant.total_material_cost > 0) {
      monthlyChange = Math.round(((plant.total_material_cost - prevMonthPlant.total_material_cost) / prevMonthPlant.total_material_cost) * 100);
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
                  Anterior: {formatCurrency(prevMonthPlant.total_material_cost)}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper function to render average cost per m³ cell with monthly comparison
  const renderAvgCostPerM3Cell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.avg_cost_per_m3 > 0 && plant.avg_cost_per_m3 > 0) {
      monthlyChange = Math.round(((plant.avg_cost_per_m3 - prevMonthPlant.avg_cost_per_m3) / prevMonthPlant.avg_cost_per_m3) * 100);
      hasComparison = true;
    }

    const getBadgeColor = () => {
      if (!hasComparison) return 'bg-gray-100 text-gray-600 border-gray-200';
      if (monthlyChange < 0) return 'bg-green-100 text-green-800 border-green-200'; // Improvement (lower cost per m³)
      if (monthlyChange > 0) return 'bg-red-100 text-red-700 border-red-200'; // Worse (higher cost per m³)
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
                  Anterior: {formatCurrency(prevMonthPlant.avg_cost_per_m3)}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper function to render aggregate cost per m³ cell with monthly comparison
  const renderAggregateCostPerM3Cell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    const currentAggregatePerM3 = plant.total_volume > 0 ? plant.aggregate_cost / plant.total_volume : 0;
    const prevAggregatePerM3 = prevMonthPlant && prevMonthPlant.total_volume > 0 ? prevMonthPlant.aggregate_cost / prevMonthPlant.total_volume : 0;
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevAggregatePerM3 > 0 && currentAggregatePerM3 > 0) {
      monthlyChange = Math.round(((currentAggregatePerM3 - prevAggregatePerM3) / prevAggregatePerM3) * 100);
      hasComparison = true;
    }

    const getBadgeColor = () => {
      if (!hasComparison) return 'bg-gray-100 text-gray-600 border-gray-200';
      if (monthlyChange < 0) return 'bg-green-100 text-green-800 border-green-200'; // Improvement (lower cost per m³)
      if (monthlyChange > 0) return 'bg-red-100 text-red-700 border-red-200'; // Worse (higher cost per m³)
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
                  Anterior: {formatCurrency(prevAggregatePerM3)}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper function to render additive cost per m³ cell with monthly comparison
  const renderAdditiveCostPerM3Cell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    const currentAdditivePerM3 = plant.total_volume > 0 ? plant.additive_cost / plant.total_volume : 0;
    const prevAdditivePerM3 = prevMonthPlant && prevMonthPlant.total_volume > 0 ? prevMonthPlant.additive_cost / prevMonthPlant.total_volume : 0;
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevAdditivePerM3 > 0 && currentAdditivePerM3 > 0) {
      monthlyChange = Math.round(((currentAdditivePerM3 - prevAdditivePerM3) / prevAdditivePerM3) * 100);
      hasComparison = true;
    }

    const getBadgeColor = () => {
      if (!hasComparison) return 'bg-gray-100 text-gray-600 border-gray-200';
      if (monthlyChange < 0) return 'bg-green-100 text-green-800 border-green-200'; // Improvement (lower cost per m³)
      if (monthlyChange > 0) return 'bg-red-100 text-red-700 border-red-200'; // Worse (higher cost per m³)
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
                  Anterior: {formatCurrency(prevAdditivePerM3)}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper function to render aggregate total cost cell with monthly comparison
  const renderAggregateCostCell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.aggregate_cost > 0 && plant.aggregate_cost > 0) {
      monthlyChange = Math.round(((plant.aggregate_cost - prevMonthPlant.aggregate_cost) / prevMonthPlant.aggregate_cost) * 100);
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
                  Anterior: {formatCurrency(prevMonthPlant.aggregate_cost)}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Helper function to render additive total cost cell with monthly comparison
  const renderAdditiveCostCell = (plant: PlantProductionData, formattedValue: string) => {
    // Find corresponding previous month data for this plant
    const prevMonthPlant = previousMonthData.find(p => p.plant_id === plant.plant_id);
    
    let monthlyChange = 0;
    let hasComparison = false;
    
    if (prevMonthPlant && prevMonthPlant.additive_cost > 0 && plant.additive_cost > 0) {
      monthlyChange = Math.round(((plant.additive_cost - prevMonthPlant.additive_cost) / prevMonthPlant.additive_cost) * 100);
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
                  Anterior: {formatCurrency(prevMonthPlant.additive_cost)}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
    );
  };

  // Show top-level loader only before first chunk
  if (loading && !streaming) {
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
            disabled={streaming || !comparativeData || comparativeData.section1.length === 0}
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

      {(loading || streaming) && (
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-3 w-full max-w-xl">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando datos de producción...</span>
          </div>
          {streaming && (
            <div className="w-full mt-4">
              <div className="w-full bg-gray-100 border rounded h-2 overflow-hidden">
                <div className="bg-blue-500 h-2" style={{ width: `${Math.round((progress.processed / Math.max(1, progress.total)) * 100)}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-center">
                Progresando… {Math.round((progress.processed / Math.max(1, progress.total)) * 100)}% ({progress.processed}/{Math.max(1, progress.total)})
              </div>
            </div>
          )}
        </div>
      )}

      {/* Secondary comparison progress (previous month) */}
      {(!loading && !streaming && comparisonStreaming) && (
        <div className="flex items-center justify-center py-4">
          <div className="w-full max-w-xl">
            <div className="w-full bg-gray-100 border rounded h-2 overflow-hidden">
              <div className="bg-purple-500 h-2" style={{ width: `${Math.round((comparisonProgress.processed / Math.max(1, comparisonProgress.total)) * 100)}%` }} />
            </div>
            <div className="text-xs text-muted-foreground mt-1 text-center">
              Comparando con mes anterior… {Math.round((comparisonProgress.processed / Math.max(1, comparisonProgress.total)) * 100)}% ({comparisonProgress.processed}/{Math.max(1, comparisonProgress.total)})
            </div>
          </div>
        </div>
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
                    <TableHead>Volumen Total (m³)</TableHead>
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
                        {renderVolumeComparisonCell(
                          plant,
                          plant.total_volume.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        )}
                        {renderAvgCostPerM3Cell(plant, formatCurrency(plant.avg_cost_per_m3))}
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
                  {getSortedDataByVolume(comparativeData.section1).map((plant) => {
                    return (
                      <TableRow key={plant.plant_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plant.plant_code}</div>
                            <div className="text-sm text-muted-foreground">{plant.plant_name}</div>
                          </div>
                        </TableCell>
                        {renderVolumeComparisonCell(
                          plant,
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
                  {getSortedDataByVolume(comparativeData.section2).map((plant) => {
                    return (
                      <TableRow key={plant.plant_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plant.plant_code}</div>
                          </div>
                        </TableCell>
                        {renderVolumeComparisonCell(
                          plant,
                          plant.total_volume.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })
                        )}
                        {renderCementCostCell(plant, formatCurrency(plant.cement_cost_per_m3))}
                        {renderAggregateCostPerM3Cell(plant, formatCurrency(plant.total_volume > 0 ? plant.aggregate_cost / plant.total_volume : 0))}
                        {renderAdditiveCostPerM3Cell(plant, formatCurrency(plant.total_volume > 0 ? plant.additive_cost / plant.total_volume : 0))}
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
                  {getSortedDataByVolume(comparativeData.section3).map((plant) => {
                    return (
                      <TableRow key={plant.plant_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{plant.plant_code}</div>
                          </div>
                        </TableCell>
                        {renderVolumeComparisonCell(
                          plant,
                          plant.total_volume.toLocaleString('es-MX', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })
                        )}
                        {renderNormalCell(formatCurrency(plant.total_material_cost))}
                        {renderAggregateCostCell(plant, formatCurrency(plant.aggregate_cost))}
                        {renderAdditiveCostCell(plant, formatCurrency(plant.additive_cost))}
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
