'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import dynamic from 'next/dynamic'; // Import dynamic
import { ApexOptions } from 'apexcharts'; // Import ApexOptions
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { 
  fetchRawQualityData
} from '@/services/qualityDataService';
import type { 
  EnsayosData,
  MuestrasData,
  MuestreosData,
  RemisionesData,
  RecipeVersionsData,
  RemisionMaterialesData 
} from '@/types/quality';
import { calculateAllMetrics, CalculatedMetrics } from '@/lib/qualityMetricsCalculator'; // Import calculator
import { fetchMetricasCalidad } from '@/services/qualityMetricsService';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // For displaying metrics
import { Skeleton } from "@/components/ui/skeleton"; // For chart loading state
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Import table components
import { supabase } from '@/lib/supabase'; // Import supabase
import { 
  calcularMediaSinCeros, 
  calculateAggregateMetrics,
  MuestreoDetailedMetrics,
  MuestreoHybridMetrics,
  RemisionData,
  RecipeVersionData,
  MaterialData
} from '@/lib/qualityMetricsUtils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import RemisionesProduccionTab from '@/components/remisiones/RemisionesProduccionTab';

// Dynamically import Chart
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Define a type for the expected structure of server metrics
interface ServerMetricsData {
  numeroMuestras: number;
  muestrasEnCumplimiento: number;
  resistenciaPromedio: number | null;
  desviacionEstandar: number | null;
  porcentajeResistenciaGarantia: number | null;
  coeficienteVariacion: number | null;
  eficiencia?: number | null;
  rendimientoVolumetrico?: number | null;
  muestreos?: {
    id: string;
    fecha: string;
    clasificacion: string;
    masa_unitaria: number;
    suma_materiales: number;
    volumen_real: number;
    volumen_registrado: number;
    rendimiento_volumetrico: number;
    kg_cemento: number;
    consumo_cemento: number;
    resistencia_promedio: number;
    eficiencia: number;
  }[];
}



interface ChartSeriesData {
  x: string; // Date string
  y: number; // Compliance percentage
  // Add other fields if needed for tooltip later
}

// Define a type for individual muestreo metrics
interface MuestreoMetrics {
  id: string;
  fecha: string; // Date of 'muestreo'
  remisionId: string;
  resistenciaPromedio: number | null;
  rendimientoVolumetrico: number | null;
  eficiencia: number | null;
  volumenReal: number | null;
  volumenRegistrado: number | null;
  kgCemento: number | null;
  consumoCemento: number | null;
  clasificacion: string | null; // MR or FC
  masaUnitaria: number | null; // Adding masa unitaria
  sumaMateriales: number | null; // Adding suma de materiales
}

// Clean version of fetchMetricasMuestreo
// Remove explicit return type to avoid mismatch errors
const fetchMetricasMuestreo = async (muestreoId: string) => {
  try {
    // Get muestreo details
    const { data: muestreoData, error: muestreoError } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo, masa_unitaria, remision_id')
      .eq('id', muestreoId)
      .single();
    
    if (muestreoError) return null;
    
    // Get metrics from server function
    const { data: metricasRPC, error: metricasError } = await supabase
      .rpc('calcular_metricas_muestreo', {
        p_muestreo_id: muestreoId
      });
    
    if (metricasError || !metricasRPC || metricasRPC.length === 0) return null;
    
    // Create a results object with the essential data
    return {
      id: muestreoId,
      fecha_muestreo: muestreoData.fecha_muestreo,
      volumen_real: metricasRPC[0].volumen_real,
      rendimiento_volumetrico: metricasRPC[0].rendimiento_volumetrico,
      consumo_cemento: metricasRPC[0].consumo_cemento_real,
      eficiencia: metricasRPC[0].eficiencia
    };
  } catch (error) {
    return null;
  }
};

// Clean version of fetchServerDetailedMetrics
const fetchServerDetailedMetrics = async (fromDate: string, toDate: string): Promise<MuestreoDetailedMetrics[]> => {
  try {
    // Get muestreos in date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo')
      .gte('fecha_muestreo', fromDate)
      .lte('fecha_muestreo', toDate)
      .order('fecha_muestreo', { ascending: false });
    
    if (muestreosError || !muestreosData || muestreosData.length === 0) return [];
    
    // Get metrics for each muestreo
    const metricsPromises = muestreosData.map(muestreo => fetchMetricasMuestreo(muestreo.id));
    const results = await Promise.all(metricsPromises);
    
    // Filter out null results and use 'as any[]' to bypass type mismatch error
    return results.filter(Boolean) as any[]; // Changed from MuestreoDetailedMetrics[]
  } catch (error) {
    return [];
  }
};

// Clean version of fetchHybridMetrics
const fetchHybridMetrics = async (fromDate: string, toDate: string, rawData: any): Promise<MuestreoHybridMetrics[]> => {
  try {
    // Get muestreos in date range
    const { data: muestreosData, error: muestreosError } = await supabase
      .from('muestreos')
      .select('id, fecha_muestreo, remision_id, masa_unitaria')
      .gte('fecha_muestreo', fromDate)
      .lte('fecha_muestreo', toDate)
      .order('fecha_muestreo', { ascending: false });
    
    if (muestreosError || !muestreosData || muestreosData.length === 0) return [];
    
    // Create type-safe lookup maps
    const remisionesMap = new Map<string, RemisionData>();
    const recipeVersionsMap = new Map<string, RecipeVersionData>();
    const materialesMap = new Map<string, MaterialData[]>();
    
    if (rawData) {
      // Map remisiones with proper typing
      rawData.remisiones.forEach((remision: any) => {
        remisionesMap.set(remision.id, {
          id: remision.id,
          recipe_id: remision.recipe_id,
          volumen_fabricado: remision.volumen_fabricado
        });
      });
      
      // Map recipe versions with proper typing
      rawData.recipeVersions.forEach((version: any) => {
        recipeVersionsMap.set(version.recipe_id, {
          recipe_id: version.recipe_id,
          notes: version.notes,
          age_days: version.age_days
        });
      });
      
      // Map materials by remision with proper typing
      rawData.remisionMateriales.forEach((material: any) => {
        const materialData: MaterialData = {
          remision_id: material.remision_id,
          material_type: material.material_type,
          cantidad_real: material.cantidad_real
        };
        
        if (!materialesMap.has(material.remision_id)) {
          materialesMap.set(material.remision_id, []);
        }
        
        materialesMap.get(material.remision_id)!.push(materialData);
      });
    }
    
    // Get metrics for each muestreo
    const hybridMetricsPromises = muestreosData.map(async (muestreo) => {
      // Get server metrics
      const { data: metricasRPC, error: metricasError } = await supabase
        .rpc('calcular_metricas_muestreo', {
          p_muestreo_id: muestreo.id
        });
      
      if (metricasError || !metricasRPC || metricasRPC.length === 0) return null;
      
      // Calculate client metrics
      let clasificacion = 'FC';
      const masaUnitaria = muestreo.masa_unitaria || 0;
      let sumaMateriales = 0;
      let kgCemento = 0;
      let volumenRegistrado = 0;
      let resistenciaEdadGarantia = null;
      let edadGarantia = 28;
      
      // Get additional data if available
      const remision = remisionesMap.get(muestreo.remision_id);
      if (remision) {
        volumenRegistrado = remision.volumen_fabricado || 0;
        
        // Get recipe version
        const recipeVersion = recipeVersionsMap.get(remision.recipe_id);
        if (recipeVersion) {
          clasificacion = recipeVersion.notes && recipeVersion.notes.toUpperCase().includes('MR') ? 'MR' : 'FC';
          edadGarantia = recipeVersion.age_days || 28;
        }
        
        // Calculate suma materiales and kg cemento
        const materiales = materialesMap.get(remision.id) || [];
        if (materiales.length > 0) {
          sumaMateriales = materiales.reduce((sum: number, mat) => sum + (mat.cantidad_real || 0), 0);
          const cementoMaterial = materiales.find(m => m.material_type === 'cement');
          kgCemento = cementoMaterial ? cementoMaterial.cantidad_real || 0 : 0;
        }
      }
      
      // Get resistencia at edad garantia
      if (rawData) {
        // Calculate garantia date
        const fechaMuestreo = new Date(muestreo.fecha_muestreo);
        const fechaEdadGarantia = new Date(fechaMuestreo);
        fechaEdadGarantia.setDate(fechaMuestreo.getDate() + edadGarantia);
        const fechaEdadGarantiaStr = fechaEdadGarantia.toISOString().split('T')[0];
        
        // Find muestras at edad garantia
        const muestrasEdadGarantia = rawData.muestras.filter((m: any) => 
          m.muestreo_id === muestreo.id && 
          m.fecha_programada_ensayo === fechaEdadGarantiaStr &&
          m.estado === 'ENSAYADO'
        );
        
        // Find ensayos for those muestras
        if (muestrasEdadGarantia.length > 0) {
          const muestraIds = muestrasEdadGarantia.map((m: any) => m.id);
          const ensayosEdadGarantia = rawData.ensayos.filter((e: any) => 
            muestraIds.includes(e.muestra_id) && 
            e.resistencia_calculada !== null
          );
          
          // Get lowest resistencia
          if (ensayosEdadGarantia.length > 0) {
            const resistencias = ensayosEdadGarantia.map((e: any) => e.resistencia_calculada);
            resistenciaEdadGarantia = Math.min(...resistencias);
          }
        }
      }
      
      // Combine into hybrid object
      return {
        id: muestreo.id,
        fecha: muestreo.fecha_muestreo,
        clasificacion,
        masa_unitaria: masaUnitaria,
        suma_materiales: sumaMateriales,
        volumen_real: metricasRPC[0].volumen_real,
        volumen_registrado: volumenRegistrado,
        rendimiento_volumetrico: metricasRPC[0].rendimiento_volumetrico,
        kg_cemento: kgCemento,
        consumo_cemento: metricasRPC[0].consumo_cemento_real,
        resistencia_edad_garantia: resistenciaEdadGarantia,
        edad_garantia: edadGarantia,
        eficiencia: metricasRPC[0].eficiencia,
        _server_fields: ['volumen_real', 'rendimiento_volumetrico', 'consumo_cemento', 'eficiencia'],
        _client_fields: ['clasificacion', 'masa_unitaria', 'suma_materiales', 'volumen_registrado', 'kg_cemento', 'resistencia_edad_garantia']
      };
    });
    
    // Wait for all promises to resolve
    const results = await Promise.all(hybridMetricsPromises);
    
    // Filter out null results
    const validResults = results.filter(Boolean) as MuestreoHybridMetrics[];
    
   
    
    return validResults;
  } catch (error) {
    return [];
  }
};

export default function QualityBasicTestPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    {
      from: new Date('2025-03-28'), // Default to the problematic range
      to: new Date('2025-05-28')
    }
  );
  const [rawData, setRawData] = useState<any>(null); // Keep raw data for inspection if needed
  const [calculatedMetrics, setCalculatedMetrics] = useState<CalculatedMetrics | null>(null); // State for metrics
  const [serverMetrics, setServerMetrics] = useState<ServerMetricsData | null>(null); // Use defined type
  const [chartData, setChartData] = useState<[number, number][]>([]); // State for chart data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverMetricsError, setServerMetricsError] = useState<string | null>(null); // Separate error state for server metrics
  const [individualMetrics, setIndividualMetrics] = useState<MuestreoMetrics[]>([]);
  const [serverIndividualMetrics, setServerIndividualMetrics] = useState<any[]>([]);
  const [hybridMetrics, setHybridMetrics] = useState<any[]>([]);
  const [metricasGenerales, setMetricasGenerales] = useState<any>(null);

  // Function to format raw ensayo data for the chart
  // Revert to output [timestamp, value]
  const formatDataForChart = (ensayos: EnsayosData[]): [number, number][] => {
    const formatted = ensayos
      .filter(e => e.fecha_ensayo && e.porcentaje_cumplimiento !== null)
      .map(e => {
        // Parse date and get timestamp
        const rawDateStr = e.fecha_ensayo;
        const dateParts = rawDateStr.split('-').map(Number);
        const parsedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const timestamp = parsedDate.getTime(); 
        const compliance = e.porcentaje_cumplimiento!;
        
        // Ensure timestamp is a valid number before returning
        if (isNaN(timestamp)) {
          console.warn(`Invalid date encountered for chart: ${rawDateStr}`);
          return null; // Mark as null to filter out later
        }

        return [timestamp, compliance] as [number, number]; // Return array
      })
      // Filter out any null entries caused by invalid dates
      .filter((entry): entry is [number, number] => entry !== null)
      // Sort by timestamp
      .sort((a, b) => a[0] - b[0]);
    return formatted;
  };

  // New function to calculate detailed metrics for each muestreo
  const calculateIndividualMuestreoMetrics = (rawData: any): MuestreoMetrics[] => {
    const { muestreos, remisiones, remisionMateriales, recipeVersions, muestras, ensayos } = rawData;

    if (!muestreos?.length) return [];

    // Create lookup maps with explicit types to help TypeScript
    const remisionesMap = new Map<string, RemisionesData>(remisiones.map((r: RemisionesData) => [r.id, r]));
    const recipeVersionsMap = new Map<string, RecipeVersionsData>(recipeVersions.map((rv: RecipeVersionsData) => [rv.recipe_id, rv]));
    
    const materialesMap = new Map<string, RemisionMaterialesData[]>();
    remisionMateriales.forEach((rm: RemisionMaterialesData) => {
      if (!materialesMap.has(rm.remision_id)) {
        materialesMap.set(rm.remision_id, []);
      }
      materialesMap.get(rm.remision_id)!.push(rm);
    });
    
    // Group muestras by muestreo ID
    const muestrasByMuestreoMap = new Map<string, MuestrasData[]>();
    muestras.forEach((m: MuestrasData) => {
      if (!muestrasByMuestreoMap.has(m.muestreo_id)) {
        muestrasByMuestreoMap.set(m.muestreo_id, []);
      }
      muestrasByMuestreoMap.get(m.muestreo_id)!.push(m);
    });

    // Group ensayos by muestra ID
    const ensayosByMuestraMap = new Map<string, EnsayosData[]>();
    ensayos.forEach((e: EnsayosData) => {
      if (!ensayosByMuestraMap.has(e.muestra_id)) {
        ensayosByMuestraMap.set(e.muestra_id, []);
      }
      ensayosByMuestraMap.get(e.muestra_id)!.push(e);
    });

    // Calculate metrics for each muestreo
    return muestreos.map((muestreo: MuestreosData) => {
      const remision = remisionesMap.get(muestreo.remision_id);
      const recipeVersion = remision?.recipe_id ? recipeVersionsMap.get(remision.recipe_id) : null;
      const materiales = remision?.id ? materialesMap.get(remision.id) || [] : [];
      const muestrasDelMuestreo = muestrasByMuestreoMap.get(muestreo.id) || [];
      
      // Get all ensayos for this muestreo's muestras
      let allEnsayosForMuestreo: EnsayosData[] = [];
      muestrasDelMuestreo.forEach(muestra => {
        const ensayosDeMuestra = ensayosByMuestraMap.get(muestra.id) || [];
        allEnsayosForMuestreo = [...allEnsayosForMuestreo, ...ensayosDeMuestra];
      });

      // Calculate resistencia promedio from ensayos
      const resistenciasValidas = allEnsayosForMuestreo
        .filter(e => e.resistencia_calculada !== null && e.resistencia_calculada !== undefined)
        .map(e => e.resistencia_calculada as number);
      const resistenciaPromedio = resistenciasValidas.length > 0
        ? resistenciasValidas.reduce((sum, val) => sum + val, 0) / resistenciasValidas.length
        : null;

      // Extract needed values
      const masaUnitaria = muestreo.masa_unitaria || 0;
      const volumenRegistrado = remision?.volumen_fabricado ?? 0;
      const sumaMateriales = materiales.reduce((sum, mat) => sum + (mat.cantidad_real || 0), 0);
      const kgCemento = materiales.find(m => m.material_type === 'cement')?.cantidad_real || 0;
      const clasificacion = recipeVersion?.notes ?
        (recipeVersion.notes.toUpperCase().includes('MR') ? 'MR' : 'FC') : 'FC';

      // Calculate metrics
      let volumenReal = null;
      let rendimientoVolumetrico = null;
      let consumoCemento = null;
      let eficiencia = null;

      // Calculate volumen teorico
      if (masaUnitaria > 0 && sumaMateriales > 0) {
        volumenReal = sumaMateriales / masaUnitaria;
        
        // CORRECTED FORMULA: Calculate rendimiento volumetrico
        if (volumenRegistrado > 0) {
          rendimientoVolumetrico = (volumenReal / volumenRegistrado) * 100;
        }

        // Calculate consumo cemento
        if (kgCemento > 0 && volumenReal > 0) {
          consumoCemento = kgCemento / volumenReal;
        }
      }

      // Calculate eficiencia
      if (consumoCemento !== null && consumoCemento > 0 && resistenciaPromedio !== null) {
        if (clasificacion === 'MR') {
          eficiencia = (resistenciaPromedio / 0.13) / consumoCemento;
        } else { // FC case
          eficiencia = resistenciaPromedio / consumoCemento;
        }
      }

      return {
        id: muestreo.id,
        fecha: muestreo.fecha_muestreo,
        remisionId: muestreo.remision_id,
        resistenciaPromedio,
        rendimientoVolumetrico,
        eficiencia,
        volumenReal,
        volumenRegistrado,
        kgCemento,
        consumoCemento,
        clasificacion,
        masaUnitaria,
        sumaMateriales
      };
    });
  };

  const loadTestData = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError('Por favor selecciona un rango de fechas válido.');
      return;
    }

    setLoading(true);
    setError(null);
    setServerMetricsError(null);
    setRawData(null);
    setCalculatedMetrics(null);
    setServerMetrics(null);
    setChartData([]);
    setIndividualMetrics([]);
    setServerIndividualMetrics([]);
    setHybridMetrics([]);
    setMetricasGenerales(null);

    const fromDate = format(dateRange.from!, 'yyyy-MM-dd');
    const toDate = format(dateRange.to!, 'yyyy-MM-dd');

    let clientMetricsResult: CalculatedMetrics | null = null;
    let serverMetricsResult: ServerMetricsData | null = null;
    let formattedChartData: [number, number][] = [];
    let fetchedRawData: any = null;

    try {
      // Fetch raw data based on sampling date
      fetchedRawData = await fetchRawQualityData(fromDate, toDate);
      setRawData(fetchedRawData);

      // Calculate client-side metrics
      if (fetchedRawData.ensayos.length > 0 || fetchedRawData.muestreos.length > 0) {
        clientMetricsResult = calculateAllMetrics(fetchedRawData);
        formattedChartData = formatDataForChart(fetchedRawData.ensayos); 
        
        // Calculate individual muestreo metrics
        const detailedMetrics = calculateIndividualMuestreoMetrics(fetchedRawData);
        setIndividualMetrics(detailedMetrics);
        
        // Correction for rendimiento volumétrico
        if (detailedMetrics && detailedMetrics.length > 0) {
          // Get valid rendimientos (non-zero, non-null)
          const rendimientos = detailedMetrics
            .map(m => m.rendimientoVolumetrico)
            .filter((r): r is number => r !== null && r !== 0); // Ensure filter result is number[]
            
          // Calculate corrected average with initial value for reduce
          if (rendimientos.length > 0) {
            const rendimientoCorregido = rendimientos.reduce((sum, val) => sum + val, 0) / rendimientos.length;
            
            // Apply correction to client metrics
            if (clientMetricsResult) {
              clientMetricsResult.rendimientoVolumetricoPromedio = rendimientoCorregido;
            }
          }
        }
        
        setCalculatedMetrics(clientMetricsResult);
        setChartData(formattedChartData);
      } else {
        clientMetricsResult = {
          numeroEnsayos: 0,
          ensayosEnCumplimiento: 0,
          resistenciaPromedio: null,
          desviacionEstandar: null,
          porcentajeResistenciaGarantia: null,
          coeficienteVariacion: null,
          eficienciaPromedio: null,
          rendimientoVolumetricoPromedio: null
        };
        setIndividualMetrics([]);
        setCalculatedMetrics(clientMetricsResult);
        setChartData([]);
      }
    } catch (clientErr) {
      setError('Error al cargar datos o calcular métricas cliente: ' + (clientErr instanceof Error ? clientErr.message : 'Error desconocido'));
      setCalculatedMetrics(null);
      setChartData([]);
      setIndividualMetrics([]);
    }

    // Fetch server metrics
    try {
      serverMetricsResult = await fetchMetricasCalidad(fromDate, toDate) as ServerMetricsData;
      setServerMetrics(serverMetricsResult);
      
      // Fetch server detailed metrics
      const detailedServerMetrics = await fetchServerDetailedMetrics(fromDate, toDate);
      setServerIndividualMetrics(detailedServerMetrics);
      
      // Calculate hybrid metrics (server + client)
      // Revert the complex filtering/mapping and just extract pre-calculated aggregate metrics
      if (fetchedRawData) {
        const hybridResults = await fetchHybridMetrics(fromDate, toDate, fetchedRawData);
        setHybridMetrics(hybridResults);

        // Extract general metrics calculated within fetchHybridMetrics if they exist
        if (hybridResults.length > 0 && hybridResults[0]._metricas_generales) {
          setMetricasGenerales(hybridResults[0]._metricas_generales);
        } else {
          setMetricasGenerales(null); // Reset if not found
        }
      }
    } catch (serverErr) {
      setServerMetricsError('Error al cargar métricas del servidor: ' + (serverErr instanceof Error ? serverErr.message : 'Error desconocido'));
      setServerMetrics(null);
      setServerIndividualMetrics([]);
      setHybridMetrics([]);
      setMetricasGenerales(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTestData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]); // Reload when date range changes

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  // Helper to format metric values
  const formatMetric = (value: number | null | undefined, decimals: number = 2, suffix: string = '') => {
    if (value === null || value === undefined) return 'N/A';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'N/A';
    return `${numValue.toFixed(decimals)}${suffix}`;
  };

  // Revert Chart Options back to using datetime axis
  const chartOptions: ApexOptions = {
    chart: {
      type: 'scatter',
      zoom: { enabled: true },
      toolbar: { show: true }
    },
    xaxis: {
      type: 'datetime', // Use datetime axis type
      labels: {
        datetimeUTC: false, // Display dates in local time usually preferred
        rotate: -45,
        rotateAlways: false,
        format: 'dd MMM' // Specify default datetime format
      }
    },
    yaxis: {
      min: 0,
      // Adjust max calculation based on the original data structure [timestamp, value]
      max: chartData.length > 0 ? Math.max(110, ...chartData.map(d => d[1])) + 10 : 110,
      tickAmount: 5,
      title: { text: 'Porcentaje de Cumplimiento (%)' },
      labels: {
        formatter: (value: number) => `${value.toFixed(2)}%`
      }
    },
    colors: ['#3EB56D'],
    markers: {
      size: 5
    },
    tooltip: {
      // Adjust tooltip for datetime axis
      x: {
        format: 'dd MMM yyyy' // Format date in tooltip
      },
      y: {
        formatter: (value: number) => `${value.toFixed(2)}%`
      }
    },
    annotations: {
      yaxis: [{
        y: 100,
        borderColor: '#FF4560',
        label: {
          borderColor: '#FF4560',
          style: { color: '#fff', background: '#FF4560' },
          text: '100% Cumplimiento'
        }
      }]
    }
  };

  // Component for displaying individual muestreo metrics
  const IndividualMetricsTable = ({ metrics }: { metrics: MuestreoMetrics[] }) => {
    if (!metrics.length) return null;
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead>Masa Unitaria</TableHead>
              <TableHead>Suma Materiales</TableHead>
              <TableHead>Vol. Real (m³)</TableHead>
              <TableHead>Vol. Registrado (m³)</TableHead>
              <TableHead>Rend. Volumétrico (%)</TableHead>
              <TableHead>kg Cemento</TableHead>
              <TableHead>Consumo Cemento</TableHead>
              <TableHead>Resistencia Prom.</TableHead>
              <TableHead>Eficiencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.id}>
                <TableCell>{metric.fecha}</TableCell>
                <TableCell>{metric.clasificacion || 'N/A'}</TableCell>
                <TableCell>{formatMetric(metric.masaUnitaria, 2, ' kg/m³')}</TableCell>
                <TableCell>{formatMetric(metric.sumaMateriales, 2, ' kg')}</TableCell>
                <TableCell>{formatMetric(metric.volumenReal, 2, ' m³')}</TableCell>
                <TableCell>{formatMetric(metric.volumenRegistrado, 2, ' m³')}</TableCell>
                <TableCell>{formatMetric(metric.rendimientoVolumetrico, 2, '%')}</TableCell>
                <TableCell>{formatMetric(metric.kgCemento, 2, ' kg')}</TableCell>
                <TableCell>{formatMetric(metric.consumoCemento, 2, ' kg/m³')}</TableCell>
                <TableCell>{formatMetric(metric.resistenciaPromedio, 2, ' kg/cm²')}</TableCell>
                <TableCell>{formatMetric(metric.eficiencia, 3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Modificar el componente ServerIndividualMetricsTable para mostrar la resistencia a edad garantía
  const ServerIndividualMetricsTable = ({ metrics }: { metrics: any[] }) => {
    if (!metrics || metrics.length === 0) {
      return (
        <div className="text-center p-4">
          <p>No hay datos de métricas detalladas del servidor disponibles.</p>
          <p className="text-sm text-gray-500 mt-2">
            Asegúrate de que existan muestreos en el rango de fechas seleccionado.
          </p>
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Volumen Real (m³)</TableHead>
              <TableHead>Rendimiento Volumétrico (%)</TableHead>
              <TableHead>Consumo Cemento</TableHead>
              <TableHead>Resist. a Edad Garantía</TableHead>
              <TableHead>Eficiencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.id || `server-metric-${Math.random()}`}>
                <TableCell>{metric.fecha || 'N/A'}</TableCell>
                <TableCell>{formatMetric(metric.volumen_real, 2, ' m³')}</TableCell>
                <TableCell>{formatMetric(metric.rendimiento_volumetrico, 2, '%')}</TableCell>
                <TableCell>{formatMetric(metric.consumo_cemento, 2, ' kg/m³')}</TableCell>
                <TableCell>
                  {metric.resistencia_edad_garantia !== null 
                    ? `${formatMetric(metric.resistencia_edad_garantia, 2, ' kg/cm²')} (${metric.edad_garantia}d)` 
                    : 'N/A'}
                </TableCell>
                <TableCell>{formatMetric(metric.eficiencia, 3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Tabla híbrida con datos del servidor y cálculos del cliente
  const HybridMetricsTable = ({ metrics }: { metrics: any[] }) => {
    if (!metrics || metrics.length === 0) {
      return (
        <div className="text-center p-4">
          <p>No hay datos de métricas híbridas disponibles.</p>
          <p className="text-sm text-gray-500 mt-2">
            Asegúrate de que existan muestreos en el rango de fechas seleccionado.
          </p>
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead>Masa Unitaria</TableHead>
              <TableHead>Suma Materiales</TableHead>
              <TableHead className="bg-green-50">Vol. Real (m³)</TableHead>
              <TableHead>Vol. Registrado (m³)</TableHead>
              <TableHead className="bg-green-50">Rend. Volumétrico (%)</TableHead>
              <TableHead>kg Cemento</TableHead>
              <TableHead className="bg-green-50">Consumo Cemento</TableHead>
              <TableHead>Resist. a Edad Garantía</TableHead>
              <TableHead className="bg-green-50">Eficiencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.id || `hybrid-metric-${Math.random()}`}>
                <TableCell>{metric.fecha || 'N/A'}</TableCell>
                <TableCell>{metric.clasificacion || 'N/A'}</TableCell>
                <TableCell>{formatMetric(metric.masa_unitaria, 2, ' kg/m³')}</TableCell>
                <TableCell>{formatMetric(metric.suma_materiales, 2, ' kg')}</TableCell>
                <TableCell className="bg-green-50">{formatMetric(metric.volumen_real, 2, ' m³')}</TableCell>
                <TableCell>{formatMetric(metric.volumen_registrado, 2, ' m³')}</TableCell>
                <TableCell className="bg-green-50">{formatMetric(metric.rendimiento_volumetrico, 2, '%')}</TableCell>
                <TableCell>{formatMetric(metric.kg_cemento, 2, ' kg')}</TableCell>
                <TableCell className="bg-green-50">{formatMetric(metric.consumo_cemento, 2, ' kg/m³')}</TableCell>
                <TableCell>
                  {metric.resistencia_edad_garantia !== null 
                    ? `${formatMetric(metric.resistencia_edad_garantia, 2, ' kg/cm²')} (${metric.edad_garantia}d)` 
                    : 'N/A'}
                </TableCell>
                <TableCell className="bg-green-50">{formatMetric(metric.eficiencia, 3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-2 text-xs text-gray-500">
          <p><span className="inline-block bg-green-50 px-2 py-1 mr-2">Verde</span> = Datos calculados por el servidor</p>
          <p>Resto = Datos calculados por el cliente</p>
        </div>
      </div>
    );
  };

  // Componente para mostrar las métricas generales corregidas
  const MetricasGeneralesCard = ({ metricas }: { metricas: any }) => {
    if (!metricas) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rendimiento Volumétrico Prom.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatMetric(metricas.rendimientoVolumetricoPromedio, 2, '%')}
            </div>
            <p className="text-xs text-gray-500">Calculado del servidor (sin ceros)</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia Prom.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatMetric(metricas.eficienciaPromedio, 3)}
            </div>
            <p className="text-xs text-gray-500">Calculado del servidor</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Consumo Cemento Prom.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatMetric(metricas.consumoCementoPromedio, 2, ' kg/m³')}
            </div>
            <p className="text-xs text-gray-500">Calculado del servidor</p>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Página de Comparación - Métricas Cliente vs. Servidor & Gráfico</h1>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold">Período:</h2>
        <DatePickerWithRange
          value={dateRange}
          onChange={handleDateRangeChange}
        />
        <Button onClick={loadTestData} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Cargar y Comparar Métricas
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center my-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Cargando y comparando...</p>
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error (Cálculo Cliente)</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && serverMetricsError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error (Métricas Servidor/RPC)</AlertTitle>
          <AlertDescription>{serverMetricsError}</AlertDescription>
        </Alert>
      )}

      {/* Results Area - Render only when not loading */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Client-Side Metrics */} 
          <div>
            <h2 className="text-xl font-semibold mb-3 text-blue-700">Métricas Calculadas (Cliente)</h2>
            {/* Check if metrics object exists before trying to access properties */}
            {calculatedMetrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ensayos Periodo</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{calculatedMetrics.numeroEnsayos}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ensayos Cumplimiento</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{calculatedMetrics.ensayosEnCumplimiento}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Resistencia Prom.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.resistenciaPromedio, 2, ' kg/cm²')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">% Res. Garantía</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.porcentajeResistenciaGarantia, 2, '%')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Desv. Estándar</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.desviacionEstandar, 2)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Coef. Variación</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.coeficienteVariacion, 2, '%')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Eficiencia Prom.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.eficienciaPromedio, 2)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rendim. Volum. Prom.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(calculatedMetrics.rendimientoVolumetricoPromedio, 2, '%')}</div></CardContent></Card>
              </div>
            ) : ( 
              /* Only show this message if there wasn't a general client-side error */
              !error && <p className="text-gray-500">(No hay datos de cliente para mostrar)</p> 
            )}
          </div>

          {/* Server-Side Metrics */} 
          <div>
            <h2 className="text-xl font-semibold mb-3 text-green-700">Métricas Obtenidas (Servidor/RPC)</h2>
            {/* Check if metrics object exists before trying to access properties */}
             {serverMetrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Muestreos Totales</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{serverMetrics.numeroMuestras ?? 'N/A'}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Muestreos en Cumplimiento</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{serverMetrics.muestrasEnCumplimiento ?? 'N/A'}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Resistencia Prom.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.resistenciaPromedio, 2, ' kg/cm²')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">% Res. Garantía</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.porcentajeResistenciaGarantia, 2, '%')}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Desv. Estándar</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.desviacionEstandar, 2)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Coef. Variación</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.coeficienteVariacion, 2, '%')}</div></CardContent></Card>
                {serverMetrics.eficiencia !== undefined && (
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Eficiencia</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.eficiencia, 2)}</div></CardContent></Card>
                )}
                {serverMetrics.rendimientoVolumetrico !== undefined && (
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rendim. Volum.</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatMetric(serverMetrics.rendimientoVolumetrico, 2, '%')}</div></CardContent></Card>
                )}
              </div>
            ) : ( 
              /* Only show this message if there wasn't a specific server error */
              !serverMetricsError && <p className="text-gray-500">(No hay datos de servidor para mostrar)</p> 
            )}
          </div>
          
        </div>
      )}

      {/* Metrics corrected section */}
      {!loading && metricasGenerales && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Métricas Promedios Corregidas (Ignorando Ceros)</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricasGeneralesCard metricas={metricasGenerales} />
            <p className="text-sm text-gray-500 mt-4">
              Estas métricas son calculadas como promedios de los valores obtenidos del servidor para cada muestreo, 
              ignorando valores cero que podrían distorsionar los resultados.
              Total de muestreos considerados: {metricasGenerales.totalMuestreos}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chart Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Gráfico de Cumplimiento de Resistencia (Cliente)</CardTitle>
        </CardHeader>
        <CardContent>
              {typeof window !== 'undefined' && chartData.length > 0 ? (
                <Chart 
                  key={JSON.stringify(chartData)} 
                  options={chartOptions}
                  series={[{ name: 'Cumplimiento', data: chartData }]}
                  type="scatter"
                  height={350}
                />
              ) : (
                <div className="text-center text-gray-500 py-8 h-[350px] flex items-center justify-center">
                  {loading ? ( 
                    <Skeleton className="h-full w-full" /> 
                  ) : (
                    <p>No hay datos suficientes para generar el gráfico</p>
                  )}
                </div>
              )}
            </CardContent>
      </Card>

      {/* Tabs section for detailed analyses */}
      <div className="mt-8">
        <Tabs defaultValue="hybrid">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hybrid">Métricas Híbridas</TabsTrigger>
            <TabsTrigger value="server">Métricas del Servidor</TabsTrigger>
            <TabsTrigger value="produccion">Producción</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hybrid">
            {hybridMetrics.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Métricas Detalladas Híbridas (Server + Client)</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center my-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="ml-2">Cargando métricas detalladas...</p>
                    </div>
                  ) : (
                    <HybridMetricsTable metrics={hybridMetrics} />
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>No hay datos de métricas híbridas disponibles.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="server">
            {serverIndividualMetrics.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Métricas Detalladas por Muestreo (Servidor)</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center my-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="ml-2">Cargando métricas detalladas...</p>
                    </div>
                  ) : (
                    <ServerIndividualMetricsTable metrics={serverIndividualMetrics} />
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>No hay datos de métricas del servidor disponibles.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="produccion">
            <Card>
              <CardContent className="pt-6">
                <RemisionesProduccionTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {!loading && !error && !calculatedMetrics && !serverMetrics && !serverMetricsError && (
          <div className="text-center text-gray-500 py-8">
              <p>Selecciona un rango de fechas y haz clic en el botón para empezar.</p>
          </div>
      )}
    </div>
  );
} 