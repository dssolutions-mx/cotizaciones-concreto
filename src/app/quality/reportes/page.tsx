'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  BarChart2, 
  PieChart,
  AlertTriangle,
  Filter,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import type { DateRange } from "react-day-picker";
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import PlantRestrictedAccess from '@/components/quality/PlantRestrictedAccess';
import { isQualityTeamInRestrictedPlant } from '@/app/layout';
import { 
  fetchResistenciaReporteData,
  fetchEficienciaReporteData,
  fetchDistribucionResistenciaData,
  fetchResistenciaReporteDataFixed,
  fetchEficienciaReporteDataFixed
} from '@/services/qualityReportService';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { calcularMediaSinCeros } from '@/lib/qualityMetricsUtils';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import dynamic from 'next/dynamic';
import RemisionesProduccionTab from '@/components/remisiones/RemisionesProduccionTab';
import { useClientsWithQualityData } from '@/hooks/useClientsWithQualityData';
import { useConstructionSitesWithQualityData } from '@/hooks/useConstructionSitesWithQualityData';
import { useRecipesWithQualityData } from '@/hooks/useRecipesWithQualityData';

// Re-add dynamic import for Chart
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Helper function for safe number formatting
const formatMetric = (value: number | null | undefined, decimals: number = 2, suffix: string = '') => {
  if (value === null || value === undefined) return 'N/A';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';
  return `${numValue.toFixed(decimals)}${suffix}`;
};

// Helper function to safely display potentially missing string data
const formatString = (value: string | null | undefined) => {
  return value ?? 'N/A';
};

// Completamente reescrita para asegurar encontrar la resistencia de edad garantía
const getResistenciaForDisplay = (muestras: any[], fallbackValue: number = 0): number => {
  console.log('===== INICIO CÁLCULO RESISTENCIA =====');
  console.log(`Procesando ${muestras?.length || 0} muestras para resistencia`);
  

  console.log('Estructura completa de muestras:', JSON.stringify(muestras, null, 2));
  
  if (!muestras || !Array.isArray(muestras) || muestras.length === 0) {
    console.log('Sin muestras, usando fallback:', fallbackValue);
    return fallbackValue;
  }
  

  const allValues: {source: string, value: number, isGarantia: boolean}[] = [];
  
  // First, collect all direct resistance values
  muestras.forEach((muestra, idx) => {
    // Check all possible paths for "is guarantee age"
    const isGarantia = 
      muestra.is_edad_garantia === true || 
      muestra.fecha_programada_matches_garantia === true ||
      (muestra.ensayos && muestra.ensayos.some((e: any) => e.is_edad_garantia === true));
    

    console.log(`Muestra ${idx} propiedades:`, {
      id: muestra.id || muestra.muestra_id,
      resistencia: muestra.resistencia,
      isGarantia,
      ensayosCount: muestra.ensayos?.length || 0
    });
    
    // Direct resistencia property
    if (typeof muestra.resistencia === 'number' && !isNaN(muestra.resistencia) && muestra.resistencia > 0) {
      allValues.push({
        source: `muestra.resistencia (${muestra.id || muestra.muestra_id})`,
        value: muestra.resistencia,
        isGarantia
      });
    }
    
    // Check in ensayos
    if (muestra.ensayos && Array.isArray(muestra.ensayos) && muestra.ensayos.length > 0) {
      muestra.ensayos.forEach((ensayo: any, ensayoIdx: number) => {
        const ensayoIsGarantia = ensayo.is_edad_garantia === true;
        
        // Check resistencia_calculada
        if (typeof ensayo.resistencia_calculada === 'number' && !isNaN(ensayo.resistencia_calculada) && ensayo.resistencia_calculada > 0) {
          allValues.push({
            source: `ensayo.resistencia_calculada (muestra ${muestra.id || muestra.muestra_id}, ensayo ${ensayoIdx})`,
            value: ensayo.resistencia_calculada,
            isGarantia: isGarantia || ensayoIsGarantia
          });
        }
      });
    }
  });
  
  console.log('Todos los valores de resistencia encontrados:', allValues);
  
  // Filter only guarantee age values
  const garantiaValues = allValues.filter(item => item.isGarantia);
  console.log('Valores con edad garantía:', garantiaValues);
  
  // If we have guarantee age values, use the minimum
  if (garantiaValues.length > 0) {
    const values = garantiaValues.map(item => item.value);
    const minValue = Math.min(...values);
    console.log(`Usando resistencia mínima de edad garantía: ${minValue} (de ${garantiaValues.length} valores)`);
    console.log('===== FIN CÁLCULO RESISTENCIA =====');
    return minValue;
  }
  
  // If no guarantee age values, use minimum of all values as fallback
  if (allValues.length > 0) {
    const values = allValues.map(item => item.value);
    const minValue = Math.min(...values);
    console.log(`Usando resistencia mínima general: ${minValue} (de ${allValues.length} valores)`);
    console.log('===== FIN CÁLCULO RESISTENCIA =====');
    return minValue;
  }
  
  // Last resort, use provided fallback
  console.log(`No se encontraron resistencias, usando fallback: ${fallbackValue}`);
  console.log('===== FIN CÁLCULO RESISTENCIA =====');
  return fallbackValue;
};

export default function ReportesPage() {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();

  // Block QUALITY_TEAM from restricted plants (P002, P003, P004) from accessing reports
  if (isQualityTeamInRestrictedPlant(profile?.role, currentPlant?.code)) {
    return <PlantRestrictedAccess plantCode={currentPlant?.code || ''} sectionName="los reportes de calidad" />;
  }
  
  // Estados para filtrado
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 3),
    to: new Date()
  });
  const [selectedPlanta, setSelectedPlanta] = useState<string>('all');
  const [selectedClasificacion, setSelectedClasificacion] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('tabla');
  
  // Add new filter states
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('all');
  
  // Use our new filtered hooks
  const { clients, loading: clientsLoading } = useClientsWithQualityData(dateRange);
  
  const { constructionSites, loading: sitesLoading } = useConstructionSitesWithQualityData(
    selectedClient, 
    dateRange
  );
  
  const { recipes, loading: recipesLoading } = useRecipesWithQualityData(
    dateRange,
    selectedClient,
    selectedConstructionSite
  );
  
  // Estados para datos
  const [tablaData, setTablaData] = useState<any[]>([]);
  const [eficienciaData, setEficienciaData] = useState<any[]>([]);
  const [distribucionData, setDistribucionData] = useState<any[]>([]);
  
  // Estado para muestreos y métricas agregadas
  const [aggregateMetrics, setAggregateMetrics] = useState({
    rendimientoPromedio: 0,
    eficienciaPromedio: 0,
    resistenciaPromedio: 0,
    consumoPromedio: 0,
    totalMuestreos: 0
  });
  
  // Estado de carga
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  
  // Add state for expanded rows
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  
  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  // Reset construction site and recipe when client changes
  useEffect(() => {
    setSelectedConstructionSite('all');
    setSelectedRecipe('all');
  }, [selectedClient]);
  
  // Reset recipe when construction site changes
  useEffect(() => {
    setSelectedRecipe('all');
  }, [selectedConstructionSite]);
  
  // Cargar datos al cambiar filtros
  const loadReportData = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError('Por favor selecciona un rango de fechas válido.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setTablaData([]);
      setEficienciaData([]);
      setDistribucionData([]);

      setAggregateMetrics({
        rendimientoPromedio: 0,
        eficienciaPromedio: 0,
        resistenciaPromedio: 0,
        consumoPromedio: 0,
        totalMuestreos: 0
      });
      
      // Cargar datos según la pestaña activa
      if (activeTab === 'tabla') {
        // Use the fixed function instead and pass the new filters
        const data = await fetchResistenciaReporteDataFixed(
          dateRange.from,
          dateRange.to,
          selectedPlanta === 'all' ? undefined : selectedPlanta,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe
        );
        setTablaData(data);
      } 
      else if (activeTab === 'eficiencia') {
        const data = await fetchEficienciaReporteDataFixed(
          dateRange.from,
          dateRange.to,
          selectedPlanta === 'all' ? undefined : selectedPlanta,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe
        );
        
        // Log the structure to see what we're getting
        console.log('Eficiencia data structure:', data);
        if (data && data.length > 0 && data[0] && 'muestras' in data[0]) {
          console.log('Sample muestras:', data[0].muestras);
        } else {
          console.log('No muestras found in eficiencia data');
        }
        
        setEficienciaData(data);
        
        // Calculate aggregate metrics
        if (data && data.length > 0) {
          const rendimientos = data
            .filter(m => m !== null)
            .map(m => m.rendimiento_volumetrico)
            .filter(r => r !== null && r !== 0);
          
          const eficiencias = data
            .filter(m => m !== null)
            .map(m => m.eficiencia)
            .filter(e => e !== null && e !== 0);
          
          const resistencias = data
            .filter((m): m is NonNullable<typeof m> => m !== null && !!m.muestras && Array.isArray(m.muestras))
            .map(m => getResistenciaForDisplay(m.muestras, m.resistencia_promedio));
          
          const consumos = data
            .filter(m => m !== null)
            .map(m => m.consumo_cemento)
            .filter(c => c !== null && c !== 0);
            
          setAggregateMetrics({
            rendimientoPromedio: rendimientos.length > 0 ? calcularMediaSinCeros(rendimientos) : 0,
            eficienciaPromedio: eficiencias.length > 0 ? calcularMediaSinCeros(eficiencias) : 0,
            resistenciaPromedio: resistencias.length > 0 ? calcularMediaSinCeros(resistencias) : 0,
            consumoPromedio: consumos.length > 0 ? calcularMediaSinCeros(consumos) : 0,
            totalMuestreos: data.length
          });
        }
      }
      else if (activeTab === 'distribucion') {
        const data = await fetchDistribucionResistenciaData(
          dateRange.from,
          dateRange.to,
          selectedClasificacion === 'all' ? undefined : selectedClasificacion,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe
        );
        setDistribucionData(data);
      }

    } catch (err) {
      console.error('Error cargando datos de reportes:', err);
      setError('Error al cargar los datos del reporte: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // useEffect for initial data load
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array for initial load only

  // useEffect to respond to tab and filter changes
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      loadReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dateRange, selectedPlanta, selectedClasificacion, selectedClient, selectedConstructionSite, selectedRecipe]);
  
  // Opciones para el gráfico de distribución
  const distribucionChartOptions = {
    chart: {
      type: 'pie' as const,
      height: 350,
    },
    labels: distribucionData.map(d => d.rango),
    colors: distribucionData.map(d => d.color),
    legend: {
      position: 'bottom' as const
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 300
        },
        legend: {
          position: 'bottom' as const
        }
      }
    }],
    tooltip: {
      y: {
        formatter: (value: number) => `${value} muestras`
      }
    }
  };
  
  // Group tablaData by muestreoId using useMemo for performance
  const groupedTablaData = useMemo(() => {
    if (!tablaData || tablaData.length === 0) return {};
    return tablaData.reduce((acc, ensayo) => {
      const key = ensayo.muestreoId;
      if (!acc[key]) {
        acc[key] = {
          muestreoFecha: ensayo.muestreoFecha ?? 'N/A',
          ensayos: []
        };
      }
      acc[key].ensayos.push(ensayo);
      return acc;
    }, {});
  }, [tablaData]);
  
  // Exportar a Excel
  const exportToExcel = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let dataToExport = [];
      let sheetName = "Reporte";

      if (activeTab === 'tabla') {
        dataToExport = Object.entries(groupedTablaData).flatMap(([muestreoId, group]: [string, any]) => 
          group.ensayos.map((ensayo: any) => ({
            'Fecha Muestreo': group.muestreoFecha,
            'Muestreo ID': muestreoId.startsWith('nomuestreoid') ? '-' : muestreoId,
            'Ensayo ID': ensayo.id,
            'Fecha Ensayo': ensayo.fechaEnsayo,
            'Código Muestra': ensayo.muestraCodigo,
            'Clasificación': ensayo.clasificacion,
            'Edad (días)': ensayo.edadDias,
            'Carga (kg)': ensayo.cargaKg,
            'Resistencia (kg/cm²)': ensayo.resistencia,
            'Cumplimiento (%)': ensayo.cumplimiento,
          }))
        );
        sheetName = "Resistencia_Detalle";
      } else if (activeTab === 'eficiencia') {
        dataToExport = eficienciaData.map(dato => ({
          'Fecha': dato.fecha,
          'Planta': dato.planta,
          'Receta': dato.receta,
          'Clasificación': dato.clasificacion,
          'Masa Unitaria (kg/m³)': dato.masa_unitaria,
          'Suma Materiales (kg)': dato.suma_materiales,
          'Vol. Real (m³)': dato.volumen_real,
          'Vol. Registrado (m³)': dato.volumen_registrado,
          'Rendimiento (%)': dato.rendimiento_volumetrico,
          'kg Cemento': dato.kg_cemento,
          'Consumo Cemento (kg/m³)': dato.consumo_cemento,
          'Resistencia Promedio (kg/cm²)': dato.resistencia_promedio,
          'Eficiencia': dato.eficiencia
        }));
        sheetName = "Eficiencia_Detalle";
      }
      
      if (!dataToExport || dataToExport.length === 0) {
        setError('No hay datos para exportar en la pestaña actual');
        return;
      }
      
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      
      const fileName = `reporte_calidad_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      await saveAs(blob, fileName);
    } catch (err) {
      console.error('Error exportando a Excel:', err);
      setError('Error al exportar los datos: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Rewrite toggle function completely
  const toggleRowExpansion = (rowId: string) => {
    console.log('Toggle called for row:', rowId);
    setLastClickedId(rowId);
    
    setExpandedRows(prev => {
      const isCurrentlyExpanded = !!prev[rowId];
      console.log(`Row ${rowId} is currently ${isCurrentlyExpanded ? 'expanded' : 'collapsed'}`);
      
      // Create new state object with toggled value for this row
      const newState = { ...prev, [rowId]: !isCurrentlyExpanded };
      console.log('New expanded rows state:', newState);
      return newState;
    });
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder a los reportes de calidad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Reportes de Calidad</h1>
          <p className="text-gray-500">
            Genera informes y análisis de calidad del concreto
          </p>
        </div>
      </div>
      
      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Período</p>
              <DatePickerWithRange
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Planta</p>
              <Select value={selectedPlanta} onValueChange={setSelectedPlanta}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas las plantas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  <SelectItem value="1">Planta 1</SelectItem>
                  <SelectItem value="2">Planta 2</SelectItem>
                  <SelectItem value="3">Planta 3</SelectItem>
                  <SelectItem value="4">Planta 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Clasificación</p>
              <Select value={selectedClasificacion} onValueChange={setSelectedClasificacion}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas las clasificaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="FC">FC</SelectItem>
                  <SelectItem value="MR">MR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Client filter */}
            <div>
              <p className="text-sm font-medium mb-2">Cliente</p>
              <Select 
                value={selectedClient} 
                onValueChange={setSelectedClient} 
                disabled={clientsLoading || clients.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    clientsLoading 
                      ? "Cargando clientes..." 
                      : clients.length === 0 
                      ? "No hay clientes disponibles" 
                      : "Todos los clientes"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients && clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.business_name || client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Construction Site filter */}
            <div>
              <p className="text-sm font-medium mb-2">Obra</p>
              <Select 
                value={selectedConstructionSite} 
                onValueChange={setSelectedConstructionSite}
                disabled={sitesLoading || constructionSites.length === 0 || selectedClient === 'all'}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    selectedClient === 'all'
                      ? "Seleccione un cliente primero"
                      : sitesLoading
                      ? "Cargando obras..."
                      : constructionSites.length === 0
                      ? "No hay obras disponibles"
                      : "Todas las obras"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las obras</SelectItem>
                  {constructionSites && constructionSites.map((site: any) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Recipe filter */}
            <div>
              <p className="text-sm font-medium mb-2">Receta</p>
              <Select 
                value={selectedRecipe} 
                onValueChange={setSelectedRecipe}
                disabled={recipesLoading || recipes.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    recipesLoading 
                      ? "Cargando recetas..." 
                      : recipes.length === 0 
                      ? "No hay recetas disponibles" 
                      : "Todas las recetas"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las recetas</SelectItem>
                  {recipes && recipes.map((recipe: any) => (
                    <SelectItem key={recipe.id} value={recipe.recipe_code}>
                      {recipe.recipe_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button 
              onClick={loadReportData} 
              disabled={loading}
              variant="default"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4" />
                  Aplicar Filtros
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Contenedor de reportes */}
      <Tabs value={activeTab} className="mb-6" onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="tabla">Datos por Muestreo</TabsTrigger>
          <TabsTrigger value="eficiencia">Análisis de Eficiencia</TabsTrigger>
          <TabsTrigger value="distribucion">Distribución Resistencias</TabsTrigger>
          <TabsTrigger value="produccion">Producción</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tabla">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Datos de Resistencia por Muestreo</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToExcel}
                disabled={loading || Object.keys(groupedTablaData).length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead colSpan={3}>Información del Muestreo</TableHead> 
                      <TableHead>Ensayo: Código Muestra</TableHead>
                      <TableHead>Ensayo: Fecha</TableHead>
                      <TableHead>Ensayo: Edad (días)</TableHead>
                      <TableHead className="text-right">Ensayo: Carga (kg)</TableHead>
                      <TableHead className="text-right">Ensayo: Resistencia (kg/cm²)</TableHead>
                      <TableHead className="text-right">Ensayo: Cumplimiento (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6 text-gray-500">
                          <div className="flex items-center justify-center">
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Cargando datos...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : Object.keys(groupedTablaData).length > 0 ? (
                      Object.entries(groupedTablaData).map(([muestreoId, group]: [string, any]) => (
                        <React.Fragment key={muestreoId}>
                          <TableRow className="bg-gray-50 hover:bg-gray-100">
                            <TableCell colSpan={3} className="font-semibold">
                              Muestreo ID: {muestreoId.startsWith('nomuestreoid') ? '-' : muestreoId}
                              <span className="ml-4 font-normal">Fecha: {formatString(group.muestreoFecha)}</span>
                            </TableCell>
                            <TableCell colSpan={6}></TableCell> 
                          </TableRow>
                          {group.ensayos.map((ensayo: any) => (
                            <TableRow key={ensayo.id}>
                              <TableCell colSpan={3}></TableCell>
                              <TableCell>{formatString(ensayo.muestraCodigo)}</TableCell>
                              <TableCell>{formatString(ensayo.fechaEnsayo)}</TableCell>
                              <TableCell>{formatString(ensayo.edadDias)}</TableCell>
                              <TableCell className="text-right">{formatMetric(ensayo.cargaKg, 0)}</TableCell>
                              <TableCell className="text-right">{formatMetric(ensayo.resistencia)}</TableCell>
                              <TableCell className="text-right">
                                <span 
                                  className={`font-semibold ${
                                    (ensayo.cumplimiento ?? 0) >= 100 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  {formatMetric(ensayo.cumplimiento, 2, '%')}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6 text-gray-500">
                          No hay datos disponibles para los filtros seleccionados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="eficiencia">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Resumen de Métricas de Eficiencia</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : eficienciaData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Rendimiento Volumétrico Prom.</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">
                        {formatMetric(aggregateMetrics.rendimientoPromedio, 2, '%')}
                      </div>
                      <p className="text-xs text-gray-500">Calculado sin valores cero</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Eficiencia Prom.</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">
                        {formatMetric(aggregateMetrics.eficienciaPromedio, 3)}
                      </div>
                      <p className="text-xs text-gray-500">Calculado sin valores cero</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Consumo Cemento Prom.</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">
                        {formatMetric(aggregateMetrics.consumoPromedio, 2, ' kg/m³')}
                      </div>
                      <p className="text-xs text-gray-500">Calculado sin valores cero</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Total Muestreos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">
                        {aggregateMetrics.totalMuestreos}
                      </div>
                      <p className="text-xs text-gray-500">Muestreos con datos válidos</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>No hay datos disponibles</AlertTitle>
                  <AlertDescription>
                    No se encontraron datos de eficiencia para el período seleccionado.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Detalle de Eficiencia por Muestreo</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToExcel}
                disabled={loading || !eficienciaData.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Datos
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                 <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                    <p className="text-gray-500">Cargando datos de eficiencia...</p>
                  </div>
                </div>
              ) : eficienciaData.length > 0 ? (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Planta</TableHead>
                        <TableHead>Remisión</TableHead>
                        <TableHead>Receta</TableHead>
                        <TableHead>Clasificación</TableHead>
                        <TableHead className="text-right">Masa Unit. (kg/m³)</TableHead>
                        <TableHead className="text-right">Vol. Real (m³)</TableHead>
                        <TableHead className="bg-green-50 text-right">Rendimiento (%)</TableHead>
                        <TableHead className="text-right">kg Cemento</TableHead>
                        <TableHead className="bg-green-50 text-right">Consumo C. (kg/m³)</TableHead>
                        <TableHead className="text-right">Resist. (kg/cm²)</TableHead>
                        <TableHead className="bg-green-50 text-right">Eficiencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eficienciaData.map((dato, index) => {
                        // Generate a stable row ID
                        const rowId = dato.id ? dato.id.toString() : `row-${index}`;
                        // Check if this row is expanded
                        const isExpanded = !!expandedRows[rowId];
                        
                        return (
                          <React.Fragment key={rowId}>
                            <TableRow className="hover:bg-gray-100">
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    console.log(`Clicking expand button for row ${rowId}`);
                                    toggleRowExpansion(rowId);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  {isExpanded ? 
                                    <ChevronDown className="h-4 w-4" /> : 
                                    <ChevronRight className="h-4 w-4" />
                                  }
                                </Button>
                              </TableCell>
                              <TableCell>{formatString(dato.fecha)}</TableCell>
                              <TableCell>{formatString(dato.planta)}</TableCell>
                              <TableCell>{formatString(dato.remision_id || '-')}</TableCell>
                              <TableCell>{formatString(dato.receta)}</TableCell>
                              <TableCell>{formatString(dato.clasificacion)}</TableCell>
                              <TableCell className="text-right">{formatMetric(dato.masa_unitaria)}</TableCell>
                              <TableCell className="text-right">{formatMetric(dato.volumen_real)}</TableCell>
                              <TableCell className="bg-green-50 text-right">{formatMetric(dato.rendimiento_volumetrico, 2, '%')}</TableCell>
                              <TableCell className="text-right">{formatMetric(dato.kg_cemento)}</TableCell>
                              <TableCell className="bg-green-50 text-right">{formatMetric(dato.consumo_cemento)}</TableCell>
                              <TableCell className="text-right">{
                                dato.muestras && Array.isArray(dato.muestras) && dato.muestras.length > 0 
                                  ? formatMetric(getResistenciaForDisplay(dato.muestras, dato.resistencia_promedio)) 
                                  : formatMetric(dato.resistencia_promedio || 0)
                              }</TableCell>
                              <TableCell className="bg-green-50 text-right">{formatMetric(dato.eficiencia, 3)}</TableCell>
                            </TableRow>
                            
                            {/* Display expanded content conditionally */}
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={13} className="p-0 border-t-0">
                                  <div className="px-4 pb-4">
                                    <h4 className="text-sm font-semibold mb-2 mt-2">
                                      Muestras y Ensayos para Muestreo ID: {dato.id || '-'}
                                    </h4>
                                    
                                    {/* Check if muestras array exists and has content */}
                                    {dato.muestras && Array.isArray(dato.muestras) && dato.muestras.length > 0 ? (
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-gray-100">
                                            <TableHead className="py-2 text-xs">Muestra ID</TableHead>
                                            <TableHead className="py-2 text-xs">Identificación</TableHead>
                                            <TableHead className="py-2 text-xs">Tipo</TableHead>
                                            <TableHead className="py-2 text-xs">Fecha Programada</TableHead>
                                            <TableHead className="py-2 text-xs">Coincide Garantía</TableHead>
                                            <TableHead className="py-2 text-xs">Resistencia</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {dato.muestras.map((muestra: any, muestraIndex: number) => {

                                            console.log(`Muestra data (${muestraIndex}):`, {
                                              id: muestra.id || muestra.muestra_id,
                                              identificacion: muestra.identificacion || muestra.codigo,
                                              tipo: muestra.tipo_muestra,
                                              is_edad_garantia: muestra.is_edad_garantia,
                                              fecha_programada_matches: muestra.fecha_programada_matches_garantia,
                                              resistencia: muestra.resistencia,
                                              ensayos: muestra.ensayos
                                            });
                                            
                                            // Check if this sample matches guarantee age - multiple ways to check
                                            const isGarantia = 
                                              muestra.is_edad_garantia === true || 
                                              muestra.fecha_programada_matches_garantia === true ||
                                              (muestra.ensayos && muestra.ensayos.some((e: any) => e.is_edad_garantia === true));
                                            

                                            console.log(`Muestra ${muestra.id || muestra.muestra_id} is garantia:`, isGarantia);
                                            
                                            // Safely get resistance value - use any available source
                                            let resistencia = null;
                                            if (muestra.resistencia) {
                                              resistencia = muestra.resistencia;
                                              console.log('Using direct resistencia:', resistencia);
                                            } else if (muestra.ensayos && muestra.ensayos.length > 0) {
                                              // First try to find a guarantee age test
                                              const garantiaEnsayo = muestra.ensayos.find((e: any) => e.is_edad_garantia);
                                              if (garantiaEnsayo && garantiaEnsayo.resistencia_calculada) {
                                                resistencia = garantiaEnsayo.resistencia_calculada;
                                                console.log('Using garantia ensayo resistencia:', resistencia);
                                              } else {
                                                // If not found, use the first available resistance value
                                                const anyEnsayo = muestra.ensayos.find((e: any) => e.resistencia_calculada);
                                                if (anyEnsayo) {
                                                  resistencia = anyEnsayo.resistencia_calculada;
                                                  console.log('Using any ensayo resistencia:', resistencia);
                                                }
                                              }
                                            }
                                            
                                            // Safely get compliance value
                                            const cumplimiento = 
                                              muestra.cumplimiento || 
                                              muestra.ensayos?.find((e: any) => e.is_edad_garantia)?.porcentaje_cumplimiento ||
                                              muestra.ensayos?.[0]?.porcentaje_cumplimiento ||
                                              0;
                                            
                                            return (
                                              <TableRow 
                                                key={muestra.id || muestra.muestra_id || `muestra-${muestraIndex}`} 
                                                className={isGarantia ? "bg-green-50 hover:bg-green-100" : "hover:bg-gray-50"}
                                              >
                                                <TableCell className="py-2 text-xs">{muestra.id || muestra.muestra_id || '-'}</TableCell>
                                                <TableCell className="py-2 text-xs">{muestra.identificacion || muestra.codigo || '-'}</TableCell>
                                                <TableCell className="py-2 text-xs">{muestra.tipo_muestra || '-'}</TableCell>
                                                <TableCell className="py-2 text-xs">{muestra.fecha_programada || '-'}</TableCell>
                                                <TableCell className="py-2 text-xs">
                                                  {isGarantia ? (
                                                    <span className="text-green-600 font-medium">Sí</span>
                                                  ) : (
                                                    <span className="text-gray-500">No</span>
                                                  )}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs">
                                                  {isGarantia ? (
                                                    resistencia ? (
                                                      <span className="text-green-600 font-medium">
                                                        {formatMetric(resistencia)} kg/cm² | 
                                                        Cumplimiento: {formatMetric(cumplimiento, 2, '%')}
                                                      </span>
                                                    ) : (
                                                      <span className="text-amber-600">
                                                        Sin valor de resistencia para edad garantía
                                                      </span>
                                                    )
                                                  ) : (
                                                    <span className="text-gray-400">
                                                      Solo visible con edad garantía
                                                    </span>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    ) : (
                                      <div className="text-amber-600 text-sm p-4 bg-amber-50 border border-amber-200 rounded">
                                        <div className="flex items-center gap-2">
                                          <AlertTriangle className="h-4 w-4" />
                                          <span>No hay muestras disponibles para este muestreo.</span>
                                        </div>
                                        <p className="mt-2 text-xs">
                                          Es posible que necesite cargar los datos del modo de depuración primero para generar la relación entre muestreos y muestras.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="mt-2 text-xs text-gray-500 p-2">
                    <p><span className="inline-block bg-green-50 px-2 py-1 mr-2">Verde</span> = Datos calculados por el servidor</p>
                    <p>Resto = Datos calculados o extraídos por el cliente</p>
                  </div>
                </div>
              ) : (
                 <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <BarChart2 className="h-12 w-12 text-gray-300" />
                    <p className="text-gray-500">
                      No hay datos de eficiencia disponibles
                    </p>
                    <p className="text-xs text-gray-400">
                      Intente modificar los filtros o seleccionar otro período
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="distribucion">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Distribución de Resistencias</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                disabled={loading || !distribucionData.some(d => d.cantidad > 0)}
              >
                <PieChart className="h-4 w-4 mr-2" />
                Exportar Gráfico
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                    <p className="text-gray-500">Cargando datos de distribución...</p>
                  </div>
                </div>
              ) : distribucionData.some(d => d.cantidad > 0) ? (
                <div className="h-[400px] border rounded-md p-4">
                  {typeof window !== 'undefined' && (
                    <Chart 
                      options={distribucionChartOptions}
                      series={distribucionData.map(d => d.cantidad)}
                      type="pie"
                      height={350}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] border rounded-md bg-gray-50">
                  <div className="text-center flex flex-col items-center gap-2">
                    <PieChart className="h-12 w-12 text-gray-300" />
                    <p className="text-gray-500">
                      No hay datos suficientes para generar el gráfico
                    </p>
                    <p className="text-xs text-gray-400">
                      Intente modificar los filtros o seleccionar otro período
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="produccion">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Producción y Consumo de Materiales</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToExcel}
                disabled={loading}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            </CardHeader>
            <CardContent>
              <RemisionesProduccionTab />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      
      {/* Opciones de descarga y generación de reportes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Exportar a Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">
              Descarga los datos de la pestaña actual en formato Excel
            </p>
            <Button 
              onClick={exportToExcel}
              disabled={loading || 
                (activeTab === 'tabla' && Object.keys(groupedTablaData).length === 0) ||
                (activeTab === 'eficiencia' && eficienciaData.length === 0)
              } 
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Excel ({activeTab})
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generar Reporte PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">
              Genera un reporte completo en formato PDF (Próximamente)
            </p>
            <Button variant="outline" className="w-full" disabled={true}>
              <FileText className="h-4 w-4 mr-2" />
              Generar PDF
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Análisis Avanzado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">
              Genera un análisis estadístico avanzado (Próximamente)
            </p>
            <Button variant="secondary" className="w-full" disabled={true}>
              <BarChart2 className="h-4 w-4 mr-2" />
              Generar Análisis
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 