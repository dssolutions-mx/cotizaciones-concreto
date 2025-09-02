'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, subMonths, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Loader2, AlertTriangle, TrendingUp, BarChart3, Activity, Filter, ChevronsUpDown, Check, X, Beaker } from 'lucide-react';
import { fetchMetricasCalidad, fetchDatosGraficoResistencia, checkDatabaseContent } from '@/services/qualityService';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

import DetailedPointAnalysis from '@/components/quality/DetailedPointAnalysis';
import { supabase } from '@/lib/supabase';
import { calcularMediaSinCeros } from '@/lib/qualityMetricsUtils';
import { DatoGraficoResistencia } from '@/types/quality';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
// Popover + Command for combobox-like searchable filters
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Import MUI X Charts components for data visualization
import { 
  ScatterChart,
  ChartsGrid,
  ChartsReferenceLine
} from '@mui/x-charts';
import type { ScatterItemIdentifier } from '@mui/x-charts';

// Removed unused ApexCharts import for leaner bundle

export default function QualityDashboardPage() {
  const { profile } = useAuthBridge();
  
  // Block QUALITY_TEAM from accessing quality dashboard, redirect to muestreos
  if (profile?.role === 'QUALITY_TEAM') {
    if (typeof window !== 'undefined') {
      window.location.href = '/quality/muestreos';
      return null;
    }
  }
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 2),
    to: new Date()
  });
  const [metricas, setMetricas] = useState({
    numeroMuestras: 0,
    muestrasEnCumplimiento: 0,
    resistenciaPromedio: 0,
    desviacionEstandar: 0,
    porcentajeResistenciaGarantia: 0,
    eficiencia: 0,
    rendimientoVolumetrico: 0,
    coeficienteVariacion: 0
  });
  const [datosGrafico, setDatosGrafico] = useState<DatoGraficoResistencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper function to retry RPC calls with exponential backoff
  const retryRpcCall = async (rpcCall: () => Promise<any>, maxRetries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await rpcCall();
        return result;
      } catch (error) {
        console.warn(`RPC attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
      }
    }
  };
  const [error, setError] = useState<string | null>(null);
  // Add state for selected point
  const [selectedPoint, setSelectedPoint] = useState<DatoGraficoResistencia | null>(null);

  // Filter states
  const [clients, setClients] = useState<any[]>([]);
  const [constructionSites, setConstructionSites] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('all');
  const [soloEdadGarantia, setSoloEdadGarantia] = useState<boolean>(true);
  const [incluirEnsayosFueraTiempo, setIncluirEnsayosFueraTiempo] = useState<boolean>(false);
  // Inline filter popovers
  const [openClient, setOpenClient] = useState(false);
  const [openSite, setOpenSite] = useState(false);
  const [openRecipe, setOpenRecipe] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);
  const [openStrengthRange, setOpenStrengthRange] = useState(false);
  const [openAge, setOpenAge] = useState(false);

  // Extended filters for quality team needs
  const [plants, setPlants] = useState<string[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedClasificacion, setSelectedClasificacion] = useState<'all' | 'FC' | 'MR'>('all');
  const [selectedSpecimenType, setSelectedSpecimenType] = useState<'all' | 'CILINDRO' | 'VIGA' | 'CUBO'>('all');
  const [selectedStrengthRange, setSelectedStrengthRange] = useState<'all' | 'lt-200' | '200-250' | '250-300' | '300-350' | '350-400' | 'gt-400'>('all');
  const [selectedAge, setSelectedAge] = useState<string>('all');
  const [availableAges, setAvailableAges] = useState<Array<{value: string, label: string}>>([]);

  // State for filtered advanced metrics
  const [filteredAdvancedMetrics, setFilteredAdvancedMetrics] = useState({
    eficiencia: 0,
    rendimientoVolumetrico: 0
  });
  const [calculatingAdvancedMetrics, setCalculatingAdvancedMetrics] = useState(false);

  // Guard against race conditions on concurrent loads
  const requestIdRef = useRef(0);

  // Calculate filtered advanced metrics when filters or data change
  useEffect(() => {
    const calculateFilteredAdvancedMetrics = async () => {
      if (datosGrafico.length === 0) {
        setFilteredAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
        return;
      }

      setCalculatingAdvancedMetrics(true);
      try {
        // Extract unique muestreos from filtered data
        const uniqueMuestreos = new Map();
        datosGrafico.forEach(d => {
          if (d.muestra?.muestreo?.id) {
            uniqueMuestreos.set(d.muestra.muestreo.id, d.muestra.muestreo);
          }
        });

        // Calculate efficiency and rendimiento for each muestreo
        const eficiencias: number[] = [];
        const rendimientos: number[] = [];

        // Use Array.from to avoid TypeScript iteration issues
        const muestreosArray = Array.from(uniqueMuestreos.entries());
        
        // Process muestreos in batches to avoid overwhelming the server
        const batchSize = 5;
        for (let i = 0; i < muestreosArray.length; i += batchSize) {
          const batch = muestreosArray.slice(i, i + batchSize);
          
          for (const [muestreoId, muestreo] of batch) {
          try {
            const { data: metricasRPC, error } = await retryRpcCall(async () => {
              return await supabase
                .rpc('calcular_metricas_muestreo', {
                  p_muestreo_id: muestreoId
                });
            });
            
            if (error) {
              console.warn(`RPC error for muestreo ${muestreoId}:`, error);
              continue;
            }
            
            if (metricasRPC && metricasRPC.length > 0) {
              const metricas = metricasRPC[0];
              
              // Add efficiency if available and non-zero
              if (metricas.eficiencia && metricas.eficiencia > 0 && !isNaN(metricas.eficiencia)) {
                eficiencias.push(metricas.eficiencia);
              }
              
              // Add rendimiento volumétrico if available and non-zero
              if (metricas.rendimiento_volumetrico && metricas.rendimiento_volumetrico > 0 && !isNaN(metricas.rendimiento_volumetrico)) {
                rendimientos.push(metricas.rendimiento_volumetrico);
              }
            }
          } catch (err) {
            // Log connection errors more prominently
            console.error(`Connection error for muestreo ${muestreoId}:`, err);
            // Add a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          }
          
          // Add a delay between batches
          if (i + batchSize < muestreosArray.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Calculate averages using the utility function
        const eficiencia = eficiencias.length > 0 ? calcularMediaSinCeros(eficiencias) : 0;
        const rendimientoVolumetrico = rendimientos.length > 0 ? calcularMediaSinCeros(rendimientos) : 0;

        console.log('🔍 Filtered Advanced Metrics calculated:', {
          eficiencia,
          rendimientoVolumetrico,
          totalMuestreos: uniqueMuestreos.size,
          eficienciasFound: eficiencias.length,
          rendimientosFound: rendimientos.length
        });
        
        setFilteredAdvancedMetrics({ eficiencia, rendimientoVolumetrico });
      } catch (err) {
        console.error('Error calculating filtered advanced metrics:', err);
        setFilteredAdvancedMetrics({ eficiencia: 0, rendimientoVolumetrico: 0 });
      } finally {
        setCalculatingAdvancedMetrics(false);
      }
    };

    calculateFilteredAdvancedMetrics();
  }, [datosGrafico]);

  // Load available filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Initialize empty states - will be populated by dynamic filters
        setClients([]);
        setConstructionSites([]);
        setRecipes([]);
        setPlants([]);
        
        // Note: Recipes, clients, plants, and construction sites are now loaded dynamically
        // based on other filter selections through the useEffect hooks
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };
    
    loadFilterOptions();
  }, []);

  // OLD FUNCTION REMOVED - loadAvailableRecipes moved after getFilteredConstructionSites
  
  // Filter construction sites based on selected client
  useEffect(() => {
    if (selectedClient && selectedClient !== 'all') {
      // If client changes, reset construction site selection
      setSelectedConstructionSite('all');
    }
  }, [selectedClient]);
  
  // Function to get filtered construction sites based on selected client
  const getFilteredConstructionSites = useCallback(() => {
    if (!selectedClient || selectedClient === 'all') {
      return constructionSites;
    }
    
    return constructionSites.filter(site => site.client_id === selectedClient);
  }, [selectedClient, constructionSites]);

  // Function to load available recipes based on current filters
  const loadAvailableRecipes = useCallback(async () => {
    try {
      // Build the base query for recipes with quality data
      let query = supabase
            .from('ensayos')
            .select(`
              muestra:muestra_id (
                muestreo:muestreo_id (
                  remision:remision_id (
                order:order_id (
                  client_id,
                  construction_site
                ),
                    recipe:recipe_id (
                  id,
                  recipe_code
                    )
                  )
                )
              )
            `);
            
      // Apply date range filter if available
      if (dateRange?.from && dateRange?.to) {
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        query = query.gte('fecha_ensayo', fromDate).lte('fecha_ensayo', toDate);
      }

      const { data: recipesData, error } = await query;

      if (error) {
        console.error('Error fetching recipes data:', error);
        return;
      }

      if (recipesData) {
            // Extract unique recipes from the nested data
            const uniqueRecipes = new Map();
            
        recipesData.forEach((ensayo: any) => {
              const muestra = ensayo?.muestra;
              if (!muestra) return;
              
              const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
              if (!muestreo) return;
              
              const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
              if (!remision) return;
          
          const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
          if (!order) return;
              
              const recipe = Array.isArray(remision.recipe) ? remision.recipe[0] : remision.recipe;
              if (!recipe || !recipe.id || !recipe.recipe_code) return;

          // Apply client filter
          if (selectedClient !== 'all' && order.client_id !== selectedClient) {
            return;
          }

          // Apply construction site filter
          if (selectedConstructionSite !== 'all') {
            const siteName = getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name;
            if (siteName && order.construction_site !== siteName) {
              return;
            }
          }

          // Apply plant filter
          if (selectedPlant !== 'all' && muestreo.planta !== selectedPlant) {
            return;
          }

          // Apply classification filter
          if (selectedClasificacion !== 'all') {
            // This would need to be implemented based on how classification is stored
            // For now, we'll include all recipes
          }

          // Apply specimen type filter
          if (selectedSpecimenType !== 'all' && muestra.tipo_muestra !== selectedSpecimenType) {
            return;
          }

          // Apply strength range filter
          if (selectedStrengthRange !== 'all') {
            // This would need to be implemented based on how strength_fc is stored
            // For now, we'll include all recipes
          }
              
              uniqueRecipes.set(recipe.id, {
                id: recipe.id,
                recipe_code: recipe.recipe_code
              });
            });
            
        const formattedRecipes = Array.from(uniqueRecipes.values())
          .sort((a, b) => a.recipe_code.localeCompare(b.recipe_code));
        
        setRecipes(formattedRecipes);
        
        // Reset recipe selection if the currently selected recipe is no longer available
        if (selectedRecipe !== 'all' && !formattedRecipes.some(r => r.recipe_code === selectedRecipe)) {
          setSelectedRecipe('all');
        }
      }
    } catch (err) {
      console.error('Error loading available recipes:', err);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange]);

  // Base query function for getting filtered ensayos data
  const getFilteredEnsayosData = useCallback(async (excludeFilter?: string) => {
    let query = supabase
      .from('ensayos')
      .select(`
        muestra:muestra_id (
          id,
          tipo_muestra,
          muestreo:muestreo_id (
            id,
            planta,
            remision:remision_id (
              order:order_id (
                client_id,
                construction_site
              ),
              recipe:recipe_id (
                id,
                recipe_code,
                strength_fc
              )
            )
          )
        )
      `);

    // Apply date range filter if available
    if (dateRange?.from && dateRange?.to) {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      query = query.gte('fecha_ensayo', fromDate).lte('fecha_ensayo', toDate);
    }

    const { data: ensayosData, error } = await query;
    if (error || !ensayosData) return [];

    // Filter the data based on current selections (excluding the one we're updating)
    return ensayosData.filter((ensayo: any) => {
      const muestra = ensayo?.muestra;
      if (!muestra) return false;
      
      const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
      if (!muestreo) return false;
      
      const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
      if (!remision) return false;
      
      const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
      if (!order) return false;
      
      const recipe = Array.isArray(remision.recipe) ? remision.recipe[0] : remision.recipe;
      if (!recipe) return false;

      // Apply filters (excluding the one being updated)
      if (excludeFilter !== 'client' && selectedClient !== 'all' && order.client_id !== selectedClient) {
        return false;
      }

      if (excludeFilter !== 'construction_site' && selectedConstructionSite !== 'all') {
        const siteName = getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name;
        if (siteName && order.construction_site !== siteName) {
          return false;
        }
      }

      if (excludeFilter !== 'plant' && selectedPlant !== 'all' && muestreo.planta !== selectedPlant) {
        return false;
      }

      if (excludeFilter !== 'recipe' && selectedRecipe !== 'all' && recipe.recipe_code !== selectedRecipe) {
        return false;
      }

      if (excludeFilter !== 'specimen_type' && selectedSpecimenType !== 'all' && muestra.tipo_muestra !== selectedSpecimenType) {
        return false;
      }

      if (excludeFilter !== 'strength_range' && selectedStrengthRange !== 'all') {
        const fc = recipe.strength_fc;
        if (fc != null) {
          const inRange = (() => {
            switch (selectedStrengthRange) {
              case 'lt-200': return fc < 200;
              case '200-250': return fc >= 200 && fc < 250;
              case '250-300': return fc >= 250 && fc < 300;
              case '300-350': return fc >= 300 && fc < 350;
              case '350-400': return fc >= 350 && fc < 400;
              case 'gt-400': return fc >= 400;
              default: return true;
            }
          })();
          if (!inRange) return false;
        }
      }

      return true;
    });
  }, [dateRange, selectedClient, selectedConstructionSite, selectedPlant, selectedRecipe, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, getFilteredConstructionSites]);

  // Load available clients based on other filters
  const loadAvailableClients = useCallback(async () => {
    try {
      const filteredData = await getFilteredEnsayosData('client');
      
      // Get unique client IDs
      const clientIds = new Set<string>();
      filteredData.forEach((ensayo: any) => {
        const muestra = ensayo?.muestra;
        if (!muestra) return;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return;
        
        const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
        if (!order || !order.client_id) return;

        clientIds.add(order.client_id);
      });
      
      // Fetch client details for the available client IDs
      if (clientIds.size > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, business_name')
          .in('id', Array.from(clientIds))
          .order('business_name');
          
        if (clientsData) {
          setClients(clientsData);
          
          // Reset client selection if no longer available
          if (selectedClient !== 'all' && !clientsData.some(c => c.id === selectedClient)) {
            setSelectedClient('all');
          }
        }
      } else {
        setClients([]);
        setSelectedClient('all');
        }
      } catch (err) {
      console.error('Error loading available clients:', err);
    }
  }, [getFilteredEnsayosData, selectedClient]);

  // Load available plants based on other filters
  const loadAvailablePlants = useCallback(async () => {
    try {
      const filteredData = await getFilteredEnsayosData('plant');
      const uniquePlants = new Set<string>();
      
      filteredData.forEach((ensayo: any) => {
        const muestra = ensayo?.muestra;
        if (!muestra) return;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo || !muestreo.planta) return;
        
        uniquePlants.add(muestreo.planta);
      });
      
      const formattedPlants = Array.from(uniquePlants).sort();
      setPlants(formattedPlants);
      
      // Reset plant selection if no longer available
      if (selectedPlant !== 'all' && !formattedPlants.includes(selectedPlant)) {
        setSelectedPlant('all');
      }
    } catch (err) {
      console.error('Error loading available plants:', err);
    }
  }, [getFilteredEnsayosData, selectedPlant]);

  // Load available construction sites based on other filters
  const loadAvailableConstructionSites = useCallback(async () => {
    try {
      const filteredData = await getFilteredEnsayosData('construction_site');
      const uniqueSites = new Map();
      
      filteredData.forEach((ensayo: any) => {
        const muestra = ensayo?.muestra;
        if (!muestra) return;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return;
        
        const order = Array.isArray(remision.order) ? remision.order[0] : remision.order;
        if (!order || !order.construction_site || !order.client_id) return;

        // Create a unique site entry with client info for filtering
        const siteKey = `${order.client_id}-${order.construction_site}`;
        if (!uniqueSites.has(siteKey)) {
          uniqueSites.set(siteKey, {
            id: siteKey, // Use composite key as ID
            name: order.construction_site,
            client_id: order.client_id
          });
        }
      });
      
      const formattedSites = Array.from(uniqueSites.values())
        .sort((a, b) => a.name.localeCompare(b.name));
        
      setConstructionSites(formattedSites);
      
      // Reset construction site selection if no longer available
      if (selectedConstructionSite !== 'all' && !formattedSites.some(s => s.id === selectedConstructionSite)) {
        setSelectedConstructionSite('all');
      }
    } catch (err) {
      console.error('Error loading available construction sites:', err);
    }
  }, [getFilteredEnsayosData, selectedConstructionSite]);

  // Load available specimen types based on other filters
  const loadAvailableSpecimenTypes = useCallback(async () => {
    try {
      const filteredData = await getFilteredEnsayosData('specimen_type');
      const uniqueTypes = new Set<string>();
      
      filteredData.forEach((ensayo: any) => {
        const muestra = ensayo?.muestra;
        if (!muestra || !muestra.tipo_muestra) return;
        
        uniqueTypes.add(muestra.tipo_muestra);
      });
      
      const formattedTypes = Array.from(uniqueTypes).sort();
      
      // Update the specimen types state (you may need to add this state)
      // For now, we'll just log the available types
      console.log('Available specimen types:', formattedTypes);
      
      // Reset specimen type selection if no longer available
      if (selectedSpecimenType !== 'all' && !formattedTypes.includes(selectedSpecimenType)) {
        setSelectedSpecimenType('all');
      }
    } catch (err) {
      console.error('Error loading available specimen types:', err);
    }
  }, [getFilteredEnsayosData, selectedSpecimenType]);

  // Update the existing loadAvailableRecipes to use the new base query
  const loadAvailableRecipesDynamic = useCallback(async () => {
    try {
      const filteredData = await getFilteredEnsayosData('recipe');
      const uniqueRecipes = new Map();
      
      filteredData.forEach((ensayo: any) => {
        const muestra = ensayo?.muestra;
        if (!muestra) return;
        
        const muestreo = Array.isArray(muestra.muestreo) ? muestra.muestreo[0] : muestra.muestreo;
        if (!muestreo) return;
        
        const remision = Array.isArray(muestreo.remision) ? muestreo.remision[0] : muestreo.remision;
        if (!remision) return;
        
        const recipe = Array.isArray(remision.recipe) ? remision.recipe[0] : remision.recipe;
        if (!recipe || !recipe.id || !recipe.recipe_code) return;
        
        uniqueRecipes.set(recipe.id, {
          id: recipe.id,
          recipe_code: recipe.recipe_code
        });
      });
      
      const formattedRecipes = Array.from(uniqueRecipes.values())
        .sort((a, b) => a.recipe_code.localeCompare(b.recipe_code));
        
      setRecipes(formattedRecipes);
      
      // Reset recipe selection if no longer available
      if (selectedRecipe !== 'all' && !formattedRecipes.some(r => r.recipe_code === selectedRecipe)) {
        setSelectedRecipe('all');
      }
    } catch (err) {
      console.error('Error loading available recipes:', err);
    }
  }, [getFilteredEnsayosData, selectedRecipe]);

  // Load available ages based on current data
  const loadAvailableAges = useCallback(async () => {
    try {
      const filteredData = await getFilteredEnsayosData('age');
      
      // Extract unique ages from the data
      const ageSet = new Set<number>();
      
      filteredData.forEach((item: any) => {
        const concreteSpecs = item.muestra?.muestreo?.concrete_specs;
        if (concreteSpecs?.valor_edad && concreteSpecs?.unidad_edad) {
          let ageInDays: number;
          const { valor_edad, unidad_edad } = concreteSpecs;
          if (unidad_edad === 'HORA' || unidad_edad === 'H') {
            ageInDays = Math.round(valor_edad / 24);
          } else if (unidad_edad === 'DÍA' || unidad_edad === 'D') {
            ageInDays = valor_edad;
          } else {
            ageInDays = item.edad || 28; // Fallback to existing edad or default
          }
          ageSet.add(ageInDays);
        }
      });

      // Format ages for display
      const formattedAges = Array.from(ageSet)
        .sort((a, b) => a - b)
        .map(age => ({
          value: age.toString(),
          label: age === 1 ? '1 día' : `${age} días`
        }));

      setAvailableAges(formattedAges);
      
      // Reset age selection if no longer available
      if (selectedAge !== 'all' && !formattedAges.some(a => a.value === selectedAge)) {
        setSelectedAge('all');
      }
    } catch (err) {
      console.error('Error loading available ages:', err);
    }
  }, [getFilteredEnsayosData, selectedAge]);

  // Update all dynamic filters when any selection changes
  useEffect(() => {
    loadAvailableClients();
    loadAvailableConstructionSites();
    loadAvailablePlants();
    loadAvailableSpecimenTypes();
    loadAvailableRecipesDynamic();
    loadAvailableAges();
  }, [loadAvailableClients, loadAvailableConstructionSites, loadAvailablePlants, loadAvailableSpecimenTypes, loadAvailableRecipesDynamic, loadAvailableAges]);

  // Update available recipes when filters change (keep original for compatibility)
  useEffect(() => {
    loadAvailableRecipes();
  }, [loadAvailableRecipes]);
  
  // Filter construction sites based on selected client
  useEffect(() => {
    if (selectedClient && selectedClient !== 'all') {
      // If client changes, reset construction site selection
      setSelectedConstructionSite('all');
    }
  }, [selectedClient]);
  






  // Add this helper function near the top of the component, before the component definition
  const formatDataForChart = (ensayos: any[]): [number, number][] => {
    const formatted = ensayos
      .filter(e => e.fecha_ensayo && e.porcentaje_cumplimiento !== null)
      .map(e => {
        // Parse date and get timestamp
        const rawDateStr = e.fecha_ensayo;
        const [day, month, year] = rawDateStr.split('/').map(Number);
        const parsedDate = new Date(year, month - 1, day);
        const timestamp = parsedDate.getTime(); 
        const compliance = e.porcentaje_cumplimiento;
        
        // Ensure timestamp is a valid number before returning
        if (isNaN(timestamp)) {
          console.warn(`Invalid date encountered for chart: ${rawDateStr}`);
          return null;
        }

        return [timestamp, compliance] as [number, number];
      })
      // Filter out any null entries caused by invalid dates
      .filter((entry): entry is [number, number] => entry !== null)
      // Sort by timestamp
      .sort((a, b) => a[0] - b[0]);
    return formatted;
  };

  // Apply UI filters and aggregate guarantee-age duplicates by muestreo
  const applyFiltersAndAggregate = useCallback((data: DatoGraficoResistencia[]) => {
    let filtered = data.slice();

    // Plant filter
    if (selectedPlant && selectedPlant !== 'all') {
      filtered = filtered.filter((d) => d?.muestra?.muestreo?.planta === selectedPlant);
    }

    // Clasificacion filter (FC/MR)
    if (selectedClasificacion && selectedClasificacion !== 'all') {
      filtered = filtered.filter((d) => d?.clasificacion === selectedClasificacion);
    }

    // Specimen type filter
    if (selectedSpecimenType && selectedSpecimenType !== 'all') {
      filtered = filtered.filter((d) => d?.muestra?.tipo_muestra === selectedSpecimenType);
    }

    // Strength range filter (by recipe strength_fc)
    if (selectedStrengthRange && selectedStrengthRange !== 'all') {
      const inRange = (fc?: number | null) => {
        if (fc == null) return false;
        switch (selectedStrengthRange) {
          case 'lt-200': return fc < 200;
          case '200-250': return fc >= 200 && fc < 250;
          case '250-300': return fc >= 250 && fc < 300;
          case '300-350': return fc >= 300 && fc < 350;
          case '350-400': return fc >= 350 && fc < 400;
          case 'gt-400': return fc >= 400;
          default: return true;
        }
      };
      filtered = filtered.filter((d) => inRange(d?.muestra?.muestreo?.remision?.recipe?.strength_fc as number | null));
    }

    // Age filter
    if (selectedAge && selectedAge !== 'all') {
      filtered = filtered.filter((d) => {
        const concreteSpecs = d?.muestra?.muestreo?.concrete_specs;
        if (!concreteSpecs?.valor_edad || !concreteSpecs?.unidad_edad) return false;

        // Calculate age in days for comparison
        let ageInDays: number;
        const { valor_edad, unidad_edad } = concreteSpecs;
        if (unidad_edad === 'HORA' || unidad_edad === 'H') {
          ageInDays = Math.round(valor_edad / 24);
        } else if (unidad_edad === 'DÍA' || unidad_edad === 'D') {
          ageInDays = valor_edad;
        } else {
          ageInDays = d.edad || 28; // Fallback to existing edad or default
        }

        return ageInDays.toString() === selectedAge;
      });
    }

    // Aggregate duplicates only when focusing on guarantee age
    if (soloEdadGarantia) {
      console.log('🔍 Aggregating data for edad garantia - total points before aggregation:', filtered.length);
      
      const groups = new Map<string, DatoGraficoResistencia[]>();
      for (const item of filtered) {
        const muestreoId = item?.muestra?.muestreo?.id;
        const key = muestreoId || `${item.x}-${item.clasificacion}`;
        const arr = groups.get(key) || [];
        arr.push(item);
        groups.set(key, arr);
      }

      console.log('🔍 Grouped into', groups.size, 'unique muestreos');

      const aggregated: DatoGraficoResistencia[] = [];
      groups.forEach((items, key) => {
        if (items.length === 1) {
          aggregated.push(items[0]);
          return;
        }

        // Average resistance and recompute compliance if possible
        const resistencias = items
          .map((i) => i.resistencia_calculada)
          .filter((v): v is number => typeof v === 'number' && !isNaN(v));
        const avgResistencia = resistencias.length > 0
          ? resistencias.reduce((a, b) => a + b, 0) / resistencias.length
          : null;

        const strengthFc = items[0]?.muestra?.muestreo?.remision?.recipe?.strength_fc as number | undefined;
        const avgY = items.reduce((a, b) => a + (b.y ?? 0), 0) / items.length;

        const recomputedY = avgResistencia && strengthFc
          ? (avgResistencia / strengthFc) * 100
          : avgY;

        const xs = items.map((i) => i.x).sort((a, b) => a - b);
        const xAvg = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

        // Calculate the actual age from concrete_specs data
        const calculatedAge = (() => {
          const concreteSpecs = items[0]?.muestra?.muestreo?.concrete_specs;
          if (concreteSpecs?.valor_edad && concreteSpecs?.unidad_edad) {
            const { valor_edad, unidad_edad } = concreteSpecs;
            // Convert to days for display
            if (unidad_edad === 'HORA' || unidad_edad === 'H') {
              return Math.round(valor_edad / 24);
            } else if (unidad_edad === 'DÍA' || unidad_edad === 'D') {
              return valor_edad;
            }
          }
          return items[0].edad || 28; // Use existing age or default
        })();

        // Debug logging for aggregated points
        if (aggregated.length < 5) {
          console.log('🔍 Aggregated Point:', {
            key,
            originalCount: items.length,
            originalAges: items.map(i => i.edad),
            calculatedAge,
            concreteSpecs: items[0]?.muestra?.muestreo?.concrete_specs,
            recipeCode: items[0]?.muestra?.muestreo?.remision?.recipe?.recipe_code,
            // Add logging for new columns
            isEdadGarantiaValues: items.map(i => (i as any)?.muestra?.is_edad_garantia),
            isEnsayoFueraTiempoValues: items.map(i => (i as any)?.muestra?.is_ensayo_fuera_tiempo)
          });
        }

        aggregated.push({
          x: xAvg,
          y: recomputedY,
          clasificacion: items[0].clasificacion,
          edad: calculatedAge,
          fecha_ensayo: format(new Date(xAvg), 'dd/MM/yyyy'),
          resistencia_calculada: avgResistencia ?? items[0].resistencia_calculada,
          muestra: items[0].muestra
        } as DatoGraficoResistencia);
      });

      console.log('🔍 Aggregation complete - final aggregated points:', aggregated.length);
      return aggregated.sort((a, b) => a.x - b.x);
    }

    return filtered.sort((a, b) => a.x - b.x);
  }, [selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, selectedAge, soloEdadGarantia]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!dateRange?.from || !dateRange?.to) {
          throw new Error('Rango de fechas inválido');
        }
        
        // Format dates properly for API call with explicit format
        const fromDate = format(dateRange.from, 'yyyy-MM-dd');
        const toDate = format(dateRange.to, 'yyyy-MM-dd');
        
        // First try direct RPC call to Supabase
        try {
          // Get metrics directly from stored procedure with the same filters
          // used for the chart data
          const metricasData = await fetchMetricasCalidad(
            fromDate, 
            toDate,
            selectedClient === 'all' ? undefined : selectedClient,
            selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
            selectedRecipe === 'all' ? undefined : selectedRecipe
          );
          
          if (metricasData) {
            // Apply the same rendimiento volumétrico correction
            try {
              // Get all muestreos in the date range
              const { data: muestreosData } = await supabase
                .from('muestreos')
                .select('id, fecha_muestreo')
                .gte('fecha_muestreo', fromDate)
                .lte('fecha_muestreo', toDate);
                
              if (muestreosData && muestreosData.length > 0) {
                // Get metrics for each muestreo
                const metricsPromises = muestreosData.map(async (muestreo) => {
                  try {
                    const { data: metricasRPC, error } = await retryRpcCall(async () => {
                      return await supabase
                        .rpc('calcular_metricas_muestreo', {
                          p_muestreo_id: muestreo.id
                        });
                    });
                    
                    if (error) {
                      console.warn(`RPC error for muestreo ${muestreo.id}:`, error);
                      return null;
                    }
                    
                    return metricasRPC && metricasRPC.length > 0 ? metricasRPC[0] : null;
                  } catch (err) {
                    console.error(`Connection error for muestreo ${muestreo.id}:`, err);
                    return null;
                  }
                });
                
                const results = (await Promise.all(metricsPromises)).filter(Boolean);
                
                // Calculate corrected rendimiento volumétrico by ignoring zeros
                if (results.length > 0) {
                  const rendimientos = (results as Array<{ rendimiento_volumetrico: number | null }>)
                    .map((r) => r.rendimiento_volumetrico)
                    .filter((r): r is number => r !== null && r !== 0);
                    
                  if (rendimientos.length > 0) {
                    // Replace the global rendimiento with this corrected value
                    metricasData.rendimientoVolumetrico = 
                      calcularMediaSinCeros(rendimientos) || metricasData.rendimientoVolumetrico;
                  }
                  
                  // Apply same correction for eficiencia - ignoring zero values
                  const eficiencias = results
                    .map((r: any) => r.eficiencia)
                    .filter((e: any) => e !== null && e !== 0 && !isNaN(e));
                    
                    // Match the same calculation logic used in reports/page.tsx
                    if (eficiencias.length > 0) {

                      console.log('Efficiency values found:', {
                        count: eficiencias.length,
                        values: eficiencias,
                        originalValue: metricasData.eficiencia,
                        calculatedAverage: calcularMediaSinCeros(eficiencias)
                      });
                      
                      // Replace the global eficiencia with corrected value
                      metricasData.eficiencia = calcularMediaSinCeros(eficiencias);
                    } else {
                      console.log('No non-zero efficiency values found');
                      
                      // If no values were found, try to calculate efficiency directly
                      // based on the recipe classification (similar to reportes page)
                      try {
                        // If we have resistance and cement consumption data, calculate directly
                        if (metricasData.resistenciaPromedio > 0) {
                          const { data: recipesData } = await supabase
                            .from('recipe_versions')
                            .select('notes')
                            .order('created_at', { ascending: false })
                            .limit(10);
                          
                          // Check if any recipes are MR type
                          const hasMR = recipesData && recipesData.some(
                            (r: any) => r.notes && r.notes.toUpperCase().includes('MR')
                          );
                          
                          // Calculate efficiency based on recipe type
                          // This matches the calculation in qualityMetricsUtils.ts
                          if (metricasData.resistenciaPromedio > 0 && results.length > 0) {
                            const consumos = results
                              .map((r: any) => r.consumo_cemento_real)
                              .filter((c: any) => c !== null && c !== 0 && !isNaN(c));
                              
                            if (consumos.length > 0) {
                              const avgConsumo = calcularMediaSinCeros(consumos);
                              if (avgConsumo > 0) {
                                // For MR-type concrete, divide by 0.13 first
                                if (hasMR) {
                                  metricasData.eficiencia = (metricasData.resistenciaPromedio / 0.13) / avgConsumo;
                                } else {
                                  metricasData.eficiencia = metricasData.resistenciaPromedio / avgConsumo;
                                }
                                
                                console.log('Calculated efficiency directly:', {
                                  resistencia: metricasData.resistenciaPromedio,
                                  consumo: avgConsumo,
                                  isMR: hasMR,
                                  result: metricasData.eficiencia
                                });
                              }
                            }
                          }
                        }
                      } catch (err) {
                        console.error('Error calculating efficiency directly:', err);
                      }
                    }
                }
              }
            } catch (detailedError) {
              // Continue with the uncorrected value if there's an error
            }
            
            setMetricas(metricasData);
          } else {
            throw new Error('No se pudieron obtener métricas de calidad');
          }
        } catch (rpcError) {
          console.error('Error fetching metrics:', rpcError);
          // Use simplified metrics calculation as fallback
          const metricasData = await fetchMetricasCalidad(
            fromDate, 
            toDate,
            selectedClient === 'all' ? undefined : selectedClient,
            selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
            selectedRecipe === 'all' ? undefined : selectedRecipe
          );
          
          if (metricasData) {
            setMetricas(metricasData);
          } else {
            // If all fails, set zeros
            setMetricas({
              numeroMuestras: 0,
              muestrasEnCumplimiento: 0,
              resistenciaPromedio: 0,
              desviacionEstandar: 0,
              porcentajeResistenciaGarantia: 0,
              eficiencia: 0,
              rendimientoVolumetrico: 0,
              coeficienteVariacion: 0
            });
          }
        }
        
        // Get graph data with filters
        const graficosDataRaw = await fetchDatosGraficoResistencia(
          fromDate,
          toDate,
          selectedClient === 'all' ? undefined : selectedClient,
          selectedConstructionSite === 'all' ? undefined : selectedConstructionSite,
          selectedRecipe === 'all' ? undefined : selectedRecipe,
          soloEdadGarantia,
          incluirEnsayosFueraTiempo
        );
        
        console.log('🌟 Received Graph Data Raw:', {
          dataLength: graficosDataRaw.length,
          firstDataPoint: graficosDataRaw[0],
          lastDataPoint: graficosDataRaw[graficosDataRaw.length - 1]
        });

        // Process raw graph data into chart format
        if (graficosDataRaw && graficosDataRaw.length > 0) {
          // Directly use the processed data from the service
          console.log('📊 Setting Chart Data:', {
            dataPoints: graficosDataRaw.length,
            sampleDataPoint: graficosDataRaw[0]
          });
          
          setDatosGrafico(graficosDataRaw);
        } else {
          console.warn('❌ No chart data received from fetchDatosGraficoResistencia');
          setDatosGrafico([]); // Ensure it's an empty array if no data
        }
      } catch (err) {
        setError('Error al cargar los datos del dashboard: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboardData();
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, soloEdadGarantia, incluirEnsayosFueraTiempo]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };

  // Format date from timestamp for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return format(date, 'dd/MM/yyyy');
  };

  // Prepare data for MUI ScatterChart (memoized and filtered/aggregated)
  const preparedData = React.useMemo(() => applyFiltersAndAggregate(datosGrafico), [datosGrafico, applyFiltersAndAggregate]);

  // Calculate filtered metrics based on the actual displayed data
  const filteredMetrics = React.useMemo(() => {
    if (preparedData.length === 0) {
      return {
        numeroMuestras: 0,
        muestrasEnCumplimiento: 0,
        resistenciaPromedio: 0,
        porcentajeResistenciaGarantia: 0,
        coeficienteVariacion: 0,
        // Add advanced KPIs with default values
        eficiencia: 0,
        rendimientoVolumetrico: 0,
        desviacionEstandar: 0
      };
    }

    const resistencias = preparedData
      .map(d => d.resistencia_calculada)
      .filter((r): r is number => typeof r === 'number' && !isNaN(r));
    
    const cumplimientos = preparedData.map(d => d.y);
    const muestrasEnCumplimiento = preparedData.filter(d => d.y >= 100).length;
    
    const resistenciaPromedio = resistencias.length > 0 
      ? resistencias.reduce((a, b) => a + b, 0) / resistencias.length 
      : 0;
    
    const porcentajeResistenciaGarantia = cumplimientos.length > 0
      ? cumplimientos.reduce((a, b) => a + b, 0) / cumplimientos.length
      : 0;

    // Calculate standard deviation
    let desviacionEstandar = 0;
    if (resistencias.length > 1 && resistenciaPromedio > 0) {
      const variance = resistencias.reduce((acc, val) => acc + Math.pow(val - resistenciaPromedio, 2), 0) / resistencias.length;
      desviacionEstandar = Math.sqrt(variance);
    }

    // Calculate coefficient of variation
    let coeficienteVariacion = 0;
    if (resistencias.length > 1 && resistenciaPromedio > 0) {
      coeficienteVariacion = (desviacionEstandar / resistenciaPromedio) * 100;
    }

    // Note: Advanced KPIs (eficiencia, rendimientoVolumetrico) are calculated separately
    // in a useEffect to handle async operations, since React.useMemo doesn't support async
    const eficiencia = 0; // Will be populated by filteredAdvancedMetrics state
    const rendimientoVolumetrico = 0; // Will be populated by filteredAdvancedMetrics state

    return {
      numeroMuestras: preparedData.length,
      muestrasEnCumplimiento,
      resistenciaPromedio,
      porcentajeResistenciaGarantia,
      coeficienteVariacion,
      eficiencia,
      rendimientoVolumetrico,
      desviacionEstandar
    };
  }, [preparedData]);

  // Split into meaningful buckets by age for better readability
  const seriesBuckets = React.useMemo(() => {
    // Group data by age
    const ageGroups = new Map<number, typeof preparedData>();
    
    for (const p of preparedData) {
      const age = p.edad || 28; // Default to 28 days if no age specified
      if (!ageGroups.has(age)) {
        ageGroups.set(age, []);
      }
      ageGroups.get(age)!.push(p);
    }
    
    // Convert to array of age groups, sorted by age
    const sortedAges = Array.from(ageGroups.keys()).sort((a, b) => a - b);
    
    return sortedAges.reduce((acc, age) => {
      const ageKey = `age_${age}`;
      acc[ageKey] = ageGroups.get(age)!;
      return acc;
    }, {} as Record<string, typeof preparedData>);
  }, [preparedData]);

  const mapChartPoint = (item: DatoGraficoResistencia, idx: number) => {
    const dateObj = new Date(item.x);
    const formattedDate = format(dateObj, 'dd/MM/yyyy');
    
    // Extract comprehensive data for tooltip with proper null checks
    const resistencia = item.resistencia_calculada;
    const strengthFc = item.muestra?.muestreo?.remision?.recipe?.strength_fc;
    
    // Client name with fallback paths
    let cliente = 'N/A';
    if (item.muestra?.muestreo?.remision?.order?.client?.business_name) {
      cliente = item.muestra.muestreo.remision.order.client.business_name;
    } else if (item.muestra?.muestreo?.remision?.order?.clients?.business_name) {
      cliente = item.muestra.muestreo.remision.order.clients.business_name;
    }
    
    // Construction site with fallback paths
    let obra = 'N/A';
    if (item.muestra?.muestreo?.remision?.order?.construction_site_name) {
      obra = item.muestra.muestreo.remision.order.construction_site_name;
    } else if (item.muestra?.muestreo?.remision?.order?.construction_site) {
      // If it's an ID, try to find the name from constructionSites array
      const siteId = item.muestra.muestreo.remision.order.construction_site;
      const matchingSite = constructionSites.find(site => site.id === siteId);
      obra = matchingSite ? matchingSite.name : siteId;
    }
    
    // Recipe code
    const receta = item.muestra?.muestreo?.remision?.recipe?.recipe_code || 'N/A';
    
    // Plant
    const planta = item.muestra?.muestreo?.planta || 'N/A';
    
    // Classification and age
    const clasificacion = item.clasificacion || 'N/A';
    const edad = item.edad || 'N/A';
    
    // Sample type
    const tipoMuestra = item.muestra?.tipo_muestra || 'N/A';
    
    // Check if this is an aggregated point
    const isAggregated = (item as any)?.isAggregated;
    const aggregatedCount = (item as any)?.aggregatedCount;
    
    return {
      id: idx,
      x: item.x,
      y: item.y,
      fecha_muestreo: formattedDate,
      fecha_ensayo: item.fecha_ensayo,
      cumplimiento: `${item.y.toFixed(2)}%`,
      resistencia_real: resistencia,
      resistencia_esperada: strengthFc,
      client_name: cliente,
      construction_site_name: obra,
      recipe_code: receta,
      planta: planta,
      clasificacion: clasificacion,
      edad: edad,
      tipo_muestra: tipoMuestra,
      isAggregated,
      aggregatedCount,
      original_data: item
    };
  };

  const chartSeries = React.useMemo(() => {
    // Define colors for different ages
    const ageColors = [
      '#ef4444', // Red
      '#f59e0b', // Orange
      '#10b981', // Green
      '#3b82f6', // Blue
      '#8b5cf6', // Purple
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f97316', // Orange-600
      '#6366f1', // Indigo
      '#84cc16'  // Lime
    ];
    
    // Get sorted ages from seriesBuckets
    const ageKeys = Object.keys(seriesBuckets).sort((a, b) => {
      const ageA = parseInt(a.replace('age_', ''));
      const ageB = parseInt(b.replace('age_', ''));
      return ageA - ageB;
    });
    
    return ageKeys.map((ageKey, index) => {
      const age = parseInt(ageKey.replace('age_', ''));
      const colorIndex = index % ageColors.length;
      
      return {
        id: ageKey,
        label: age === 1 ? '1 día' : `${age} días`,
        color: ageColors[colorIndex],
        markerSize: 5,
        data: seriesBuckets[ageKey].map(mapChartPoint)
      };
    });
  }, [seriesBuckets]);

  // Custom tooltip formatter for MUI X Charts
  const formatTooltipContent = (params: any) => {
    if (!params || !params.datum) return '';
    
    const muestreoDate = params.datum.fecha_muestreo || format(new Date(params.datum.x), 'dd/MM/yyyy');
    const ensayoDate = params.datum.fecha_ensayo || 'N/A';
    const compliance = params.datum.cumplimiento || `${params.datum.y.toFixed(2)}%`;
    
    return `<div style="padding: 2px">
      <div><b>Fecha Muestreo:</b> ${muestreoDate}</div>
      <div><b>Fecha Ensayo:</b> ${ensayoDate}</div>
      <div><b>Cumplimiento:</b> ${compliance}</div>
    </div>`;
  };

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder al módulo de control de calidad.
          </p>
          
          <div className="bg-white p-4 rounded-lg border border-yellow-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">¿Por qué?</h3>
            <p className="text-gray-600">
              Este módulo está restringido a usuarios con roles específicos como Equipo de Calidad,
              Gerentes de Planta y Ejecutivos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 mb-2">Dashboard de Control de Calidad</h1>
        <p className="text-gray-500 mb-4">
          Métricas y análisis de resistencia de concreto
        </p>
        
        {/* Date Range Picker */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-gray-700">Período (Fecha de Muestreo):</span>
          <DatePickerWithRange
            value={dateRange}
            onChange={handleDateRangeChange}
          />
          
          {/* Check DB Data Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              setLoading(true);
              try {
                const result = await checkDatabaseContent();
                
                if (result.dateRange?.earliest && result.dateRange?.latest) {
                  alert(`Datos encontrados en la base de datos.\nRango de fechas: ${result.dateRange.earliest} a ${result.dateRange.latest}`);
                } else {
                  alert('No se encontraron datos en la base de datos.');
                }
              } catch (err) {
                alert('Error al revisar la base de datos');
              } finally {
                setLoading(false);
              }
            }}
            className="ml-2"
          >
            Check DB Data
          </Button>
        </div>
      </div>

      {/* Enhanced Filter Bar - More Space Efficient */}
      <Card className="mb-6 bg-white/80 backdrop-blur border border-slate-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-gray-800">Filtros de Análisis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Client Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Cliente</Label>
              <Popover open={openClient} onOpenChange={setOpenClient}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedClient === 'all' ? 'Todos los clientes' : (clients.find(c => c.id === selectedClient)?.business_name || 'Cliente')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[320px]">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedClient('all'); setOpenClient(false); }}>Todos</CommandItem>
                        {clients.filter(c => c.id && c.business_name).map(c => (
                          <CommandItem key={c.id} onSelect={() => { setSelectedClient(c.id); setOpenClient(false); }}>
                            {c.business_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Construction Site Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Obra</Label>
              <Popover open={openSite} onOpenChange={setOpenSite}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedConstructionSite === 'all' ? 'Todas las obras' : (getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name || 'Obra')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[320px]">
                  <Command>
                    <CommandInput placeholder="Buscar obra..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedConstructionSite('all'); setOpenSite(false); }}>Todas</CommandItem>
                        {getFilteredConstructionSites().filter(s => s.id && s.name).map(s => (
                          <CommandItem key={s.id} onSelect={() => { setSelectedConstructionSite(s.id); setOpenSite(false); }}>
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Recipe Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Receta</Label>
              <Popover open={openRecipe} onOpenChange={setOpenRecipe}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedRecipe === 'all' ? 'Todas las recetas' : selectedRecipe}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px]">
                  <Command>
                    <CommandInput placeholder="Buscar receta..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedRecipe('all'); setOpenRecipe(false); }}>Todas</CommandItem>
                        {recipes.filter(r => r.recipe_code?.trim()).map(r => (
                          <CommandItem key={r.id} onSelect={() => { setSelectedRecipe(r.recipe_code); setOpenRecipe(false); }}>
                            {r.recipe_code}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Plant Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Planta</Label>
              <Popover open={openPlant} onOpenChange={setOpenPlant}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedPlant === 'all' ? 'Todas las plantas' : selectedPlant}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[240px]">
                  <Command>
                    <CommandInput placeholder="Buscar planta..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedPlant('all'); setOpenPlant(false); }}>Todas</CommandItem>
                        {plants.map((plant) => (
                          <CommandItem key={plant} onSelect={() => { setSelectedPlant(plant); setOpenPlant(false); }}>
                            {plant}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Second Row of Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
            {/* Strength Range Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Rango fc</Label>
              <Popover open={openStrengthRange} onOpenChange={setOpenStrengthRange}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedStrengthRange === 'all' ? 'Todos fc' : 
                      selectedStrengthRange === 'lt-200' ? '&lt; 200' :
                      selectedStrengthRange === '200-250' ? '200-250' :
                      selectedStrengthRange === '250-300' ? '250-300' :
                      selectedStrengthRange === '300-350' ? '300-350' :
                      selectedStrengthRange === '350-400' ? '350-400' :
                      selectedStrengthRange === 'gt-400' ? '&gt; 400' : 'Todos fc'
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[200px]">
                  <Command>
                    <CommandInput placeholder="Buscar rango fc..." />
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('all'); setOpenStrengthRange(false); }}>Todos fc</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('lt-200'); setOpenStrengthRange(false); }}>&lt; 200 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('200-250'); setOpenStrengthRange(false); }}>200-250 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('250-300'); setOpenStrengthRange(false); }}>250-300 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('300-350'); setOpenStrengthRange(false); }}>300-350 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('350-400'); setOpenStrengthRange(false); }}>350-400 kg/cm²</CommandItem>
                        <CommandItem onSelect={() => { setSelectedStrengthRange('gt-400'); setOpenStrengthRange(false); }}>&gt; 400 kg/cm²</CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Classification Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Clasificación</Label>
              <div className="flex gap-2">
                <Button 
                  variant={selectedClasificacion === 'FC' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setSelectedClasificacion(selectedClasificacion === 'FC' ? 'all' : 'FC')}
                  className="flex-1"
                >
                  FC
                </Button>
                <Button 
                  variant={selectedClasificacion === 'MR' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setSelectedClasificacion(selectedClasificacion === 'MR' ? 'all' : 'MR')}
                  className="flex-1"
                >
                  MR
                </Button>
              </div>
            </div>

            {/* Specimen Type Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Tipo Probeta</Label>
              <Select value={selectedSpecimenType} onValueChange={(value: any) => setSelectedSpecimenType(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="CILINDRO">Cilindro</SelectItem>
                  <SelectItem value="VIGA">Viga</SelectItem>
                  <SelectItem value="CUBO">Cubo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Age Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Edad de Ensayo</Label>
              <Popover open={openAge} onOpenChange={setOpenAge}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between w-full">
                    {selectedAge === 'all' ? 'Todas las edades' : (availableAges.find(a => a.value === selectedAge)?.label || selectedAge)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar edad..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron edades.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setSelectedAge('all');
                            setOpenAge(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedAge === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                          Todas las edades
                        </CommandItem>
                        {availableAges.map((age) => (
                          <CommandItem
                            key={age.value}
                            value={age.value}
                            onSelect={() => {
                              setSelectedAge(age.value);
                              setOpenAge(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedAge === age.value ? 'opacity-100' : 'opacity-0'}`} />
                            {age.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Age Guarantee Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Edad Garantía</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="age-guarantee"
                  checked={soloEdadGarantia}
                  onCheckedChange={setSoloEdadGarantia}
                />
                <Label htmlFor="age-guarantee" className="text-sm">
                  {soloEdadGarantia ? 'Activado' : 'Desactivado'}
                </Label>
              </div>
            </div>

            {/* Outside Time Essays Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Incluir Ensayos Fuera de Tiempo</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="outside-time-essays"
                  checked={incluirEnsayosFueraTiempo}
                  onCheckedChange={setIncluirEnsayosFueraTiempo}
                />
                <Label htmlFor="outside-time-essays" className="text-sm">
                  {incluirEnsayosFueraTiempo ? 'Incluidos' : 'Excluidos'}
                </Label>
              </div>
            </div>

            {/* Reset Button */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">&nbsp;</Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setSelectedClient('all');
                  setSelectedConstructionSite('all');
                  setSelectedRecipe('all');
                  setSelectedPlant('all');
                  setSelectedClasificacion('all');
                  setSelectedSpecimenType('all');
                  setSelectedStrengthRange('all');
                  setSelectedAge('all');
                  setSoloEdadGarantia(true); // Default to true for guarantee age
                  setIncluirEnsayosFueraTiempo(false); // Default to false for outside time
                }}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Filters Display */}
      {(selectedClient !== 'all' || selectedConstructionSite !== 'all' || selectedRecipe !== 'all' ||
        selectedPlant !== 'all' || selectedClasificacion !== 'all' || selectedSpecimenType !== 'all' ||
        selectedStrengthRange !== 'all' || selectedAge !== 'all' || soloEdadGarantia || incluirEnsayosFueraTiempo) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {selectedClient !== 'all' && (
            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Cliente: {clients.find(c => c.id === selectedClient)?.business_name || selectedClient}</span>
              <button 
                className="hover:bg-blue-100 rounded-full p-1"
                onClick={() => setSelectedClient('all')}
              >
                ×
              </button>
            </div>
          )}
          
          {selectedConstructionSite !== 'all' && (
            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Obra: {getFilteredConstructionSites().find(s => s.id === selectedConstructionSite)?.name || selectedConstructionSite}</span>
              <button 
                className="hover:bg-green-100 rounded-full p-1"
                onClick={() => setSelectedConstructionSite('all')}
              >
                ×
              </button>
            </div>
          )}
          
          {selectedRecipe !== 'all' && (
            <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Receta: {selectedRecipe}</span>
              <button 
                className="hover:bg-purple-100 rounded-full p-1"
                onClick={() => setSelectedRecipe('all')}
              >
                ×
              </button>
            </div>
          )}

          {selectedPlant !== 'all' && (
            <div className="bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Planta: {selectedPlant}</span>
              <button className="hover:bg-cyan-100 rounded-full p-1" onClick={() => setSelectedPlant('all')}>×</button>
            </div>
          )}

          {selectedClasificacion !== 'all' && (
            <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Clasificación: {selectedClasificacion}</span>
              <button className="hover:bg-rose-100 rounded-full p-1" onClick={() => setSelectedClasificacion('all')}>×</button>
            </div>
          )}

          {selectedSpecimenType !== 'all' && (
            <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Probeta: {selectedSpecimenType}</span>
              <button className="hover:bg-emerald-100 rounded-full p-1" onClick={() => setSelectedSpecimenType('all')}>×</button>
            </div>
          )}

          {selectedStrengthRange !== 'all' && (
            <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>fc: {selectedStrengthRange}</span>
              <button className="hover:bg-amber-100 rounded-full p-1" onClick={() => setSelectedStrengthRange('all')}>×</button>
            </div>
          )}

          {selectedAge !== 'all' && (
            <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Edad: {availableAges.find(a => a.value === selectedAge)?.label || selectedAge}</span>
              <button className="hover:bg-indigo-100 rounded-full p-1" onClick={() => setSelectedAge('all')}>×</button>
            </div>
          )}
          
          {soloEdadGarantia && (
            <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Solo edad garantía</span>
              <button
                className="hover:bg-amber-100 rounded-full p-1"
                onClick={() => setSoloEdadGarantia(false)}
              >
                ×
              </button>
            </div>
          )}

          {incluirEnsayosFueraTiempo && (
            <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <span>Incluye ensayos fuera de tiempo</span>
              <button
                className="hover:bg-orange-100 rounded-full p-1"
                onClick={() => setIncluirEnsayosFueraTiempo(false)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item} className="bg-white/60 backdrop-blur border border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-[120px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-[80px]" />
                <Skeleton className="h-4 w-[180px] mt-2" />
              </CardContent>
            </Card>
          ))}
          <Card className="col-span-1 md:col-span-2 lg:col-span-4 bg-white/60 backdrop-blur border border-slate-200/60 shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-[200px]" />
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-8 bg-white/70 backdrop-blur border border-red-200/60">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button 
            className="mt-2" 
            variant="outline" 
            onClick={() => {
              setLoading(true);
              // Retry loading data after 1 second
              setTimeout(async () => {
                try {
                  const fromDate = dateRange?.from 
                    ? format(dateRange.from, 'yyyy-MM-dd')
                    : format(subMonths(new Date(), 1), 'yyyy-MM-dd');
                  const toDate = dateRange?.to
                    ? format(dateRange.to, 'yyyy-MM-dd')
                    : format(new Date(), 'yyyy-MM-dd');
                  
                  // Use Promise.all to load data concurrently
                  const [metricsData, chartDataRaw] = await Promise.all([
                    fetchMetricasCalidad(fromDate, toDate),
                    fetchDatosGraficoResistencia(fromDate, toDate)
                  ]);
                  
                  setMetricas(metricsData);
                  
                  // Process raw chart data within the retry logic as well
                  if (chartDataRaw && chartDataRaw.length > 0) {
                    console.log('Raw Retry Chart Data:', chartDataRaw);
                    
                    const processedChartData = chartDataRaw
                      .filter((d: any) => d.fecha_ensayo && d.y !== null && d.y !== undefined)
                      .map((d: any, index: number) => {
                        // Parse fecha_ensayo directly
                        const [day, month, year] = d.fecha_ensayo.split('/').map(Number);
                        const parsedDate = new Date(year, month - 1, day);
                        
                        console.log(`Retry Data Point ${index}:`, {
                          originalDateString: d.fecha_ensayo,
                          parsedDate: parsedDate,
                          timestamp: parsedDate.getTime(),
                          year: parsedDate.getFullYear(),
                          month: parsedDate.getMonth() + 1,
                          day: parsedDate.getDate(),
                          value: d.y
                        });
                        
                        const timestamp = parsedDate.getTime();
                        
                        return {
                          x: timestamp,
                          y: d.y,
                          clasificacion: 'FC', // Default classification
                          edad: 28, // Default age
                          fecha_ensayo: d.fecha_ensayo
                        } as DatoGraficoResistencia;
                      })
                      .sort((a, b) => a.x - b.x);
                      
                    console.log('Processed Retry Chart Data:', processedChartData);
                    
                    setDatosGrafico(processedChartData);
                  } else {
                    setDatosGrafico([]);
                  }
                  
                  setError(null);
                } catch (err) {
                  setError('No se pudieron cargar los datos del dashboard. Intente nuevamente más tarde.');
                } finally {
                  setLoading(false);
                }
              }, 1000);
            }}
          >
            Reintentar
          </Button>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* KPI: Muestras en cumplimiento */}
            <Card className="border-l-4 border-l-green-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Muestras en Cumplimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                      {filteredMetrics.muestrasEnCumplimiento}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      de {filteredMetrics.numeroMuestras} muestras mostradas
                    </div>
                  </div>
                  <div className="bg-green-100 p-2 rounded-md">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: Resistencia Promedio */}
            <Card className="border-l-4 border-l-blue-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Resistencia Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                      {typeof filteredMetrics.resistenciaPromedio === 'number' ? filteredMetrics.resistenciaPromedio.toFixed(2) : '0.00'}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      kg/cm²
                    </div>
                  </div>
                  <div className="bg-blue-100 p-2 rounded-md">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: % Resistencia Garantía */}
            <Card className="border-l-4 border-l-amber-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base font-semibold text-slate-700">% Resistencia a Garantía</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                      {typeof filteredMetrics.porcentajeResistenciaGarantia === 'number' ? filteredMetrics.porcentajeResistenciaGarantia.toFixed(2) : '0.00'}%
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      promedio de cumplimiento
                    </div>
                  </div>
                  <div className="bg-amber-100 p-2 rounded-md">
                    <Activity className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* KPI: Coeficiente de Variación */}
            <Card className="border-l-4 border-l-purple-500 bg-white/80 shadow-sm border border-slate-200 rounded-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm md:text-base font-semibold text-slate-700">Coeficiente de Variación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                      {typeof filteredMetrics.coeficienteVariacion === 'number' ? filteredMetrics.coeficienteVariacion.toFixed(2) : '0.00'}%
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      uniformidad del concreto
                    </div>
                  </div>
                  <div className="bg-purple-100 p-2 rounded-md">
                    <Activity className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="grafico" className="mb-6">
            <TabsList className="mb-4 bg-white/60 backdrop-blur border border-slate-200/60 rounded-md">
              <TabsTrigger value="grafico">Gráfico de Resistencia</TabsTrigger>
              <TabsTrigger value="metricas">Métricas Avanzadas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="grafico">
              <Card className="bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-[0_8px_24px_rgba(2,6,23,0.06)] rounded-2xl">
                <CardHeader className="pb-1">
                  <div className="flex items-end justify-between">
                    <CardTitle className="text-base md:text-lg font-medium text-slate-800">Cumplimiento de Resistencia por Fecha de Muestreo</CardTitle>
                    <div className="text-xs text-slate-500">Puntos: {preparedData.length}</div>
                  </div>
                  
                  {/* Age Information Display */}
                  {soloEdadGarantia && preparedData.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs text-blue-700">
                        <strong>Edad Garantía:</strong> Mostrando solo ensayos realizados en la edad de garantía especificada en la receta. Los puntos se grafican por fecha de muestreo.
                        {(() => {
                          const ages = Array.from(new Set(preparedData.map(d => d.edad))).sort((a, b) => a - b);
                          if (ages.length > 0) {
                            return ` Edades encontradas: ${ages.join(', ')} días`;
                          }
                          return '';
                        })()}
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {typeof window !== 'undefined' && preparedData.length > 0 ? (
                    <div>
                      <div style={{ height: 400, width: '100%' }}>
                        <ScatterChart
                          series={chartSeries as any}
                          xAxis={[{
                            scaleType: 'time',
                            // Format tick labels (dates on axis)
                            valueFormatter: (value) => format(new Date(value), 'dd/MM'),
                            // Calculate a reasonable number of ticks based on data points
                            tickNumber: Math.min(7, preparedData.length),
                            tickMinStep: 24 * 3600 * 1000, // 1 day minimum interval
                            tickLabelStyle: { 
                              angle: 0,
                              textAnchor: 'middle',
                              fontSize: 12
                            }
                          }]}
                          yAxis={[{
                            min: 0,
                            max: Math.max(110, ...preparedData.map(d => d.y)) + 10,
                            scaleType: 'linear',
                            label: 'Porcentaje de Cumplimiento (%)',
                            tickLabelStyle: {
                              fontSize: 12
                            }
                          }]}
                          height={400}
                          grid={{ 
                            vertical: true, 
                            horizontal: true
                          }}
                          margin={{ top: 20, right: 40, bottom: 50, left: 60 }}
                          onItemClick={(_: React.MouseEvent<SVGElement>, itemData: ScatterItemIdentifier) => {
                            if (itemData?.dataIndex !== undefined && itemData?.seriesId) {
                              // Find the correct series and data point
                              const series = chartSeries.find(s => s.id === itemData.seriesId);
                              if (series && series.data[itemData.dataIndex]) {
                                const datum = series.data[itemData.dataIndex];
                                console.log('🔍 Point clicked:', {
                                  datum: datum,
                                  original_data: datum?.original_data,
                                  hasMuestra: !!datum?.original_data?.muestra,
                                  hasMuestreo: !!datum?.original_data?.muestra?.muestreo,
                                  muestreoId: datum?.original_data?.muestra?.muestreo?.id
                                });
                                setSelectedPoint(datum?.original_data || null);
                              }
                            }
                          }}
                          slotProps={{
                            tooltip: {
                              sx: {
                                zIndex: 100,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(229,231,235,0.8)',
                                borderRadius: '12px',
                                padding: '16px',
                                minWidth: '280px',
                                // Enhanced tooltip styling
                                '& .MuiChartsTooltip-table': {
                                  padding: '0',
                                  fontSize: '13px',
                                  margin: 0,
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                  width: '100%'
                                },
                                // Hide marker and series cells for cleaner look
                                '& .MuiChartsTooltip-markCell': {
                                  display: 'none'
                                },
                                '& .MuiChartsTooltip-seriesCell': {
                                  display: 'none'
                                },
                                // Enhanced cell styling
                                '& .MuiChartsTooltip-cell': {
                                  padding: '8px 0',
                                  borderBottom: '1px solid rgba(229,231,235,0.5)',
                                  verticalAlign: 'top'
                                },
                                '& .MuiChartsTooltip-labelCell': {
                                  fontWeight: '600',
                                  color: '#374151',
                                  minWidth: '120px',
                                  paddingRight: '16px'
                                },
                                '& .MuiChartsTooltip-valueCell': {
                                  fontWeight: '500',
                                  color: '#6b7280',
                                  textAlign: 'left'
                                },
                                // Header styling
                                '& .MuiChartsTooltip-header': {
                                  backgroundColor: 'rgba(59,130,246,0.1)',
                                  borderBottom: '2px solid rgba(59,130,246,0.2)',
                                  padding: '12px 16px',
                                  margin: '-16px -16px 16px -16px',
                                  borderRadius: '12px 12px 0 0',
                                  color: '#1e40af',
                                  fontWeight: '600'
                                }
                              }
                            }
                          }}
                          axisHighlight={{
                            x: 'none', 
                            y: 'none'
                          }}
                        >
                          {/* Reference lines for quick thresholds */}
                          <ChartsReferenceLine 
                            y={90}
                            lineStyle={{
                              stroke: '#94a3b8',
                              strokeWidth: 1,
                              strokeDasharray: '4 4'
                            }}
                            label="90%"
                            labelAlign="end"
                            labelStyle={{
                              fill: '#64748b',
                              fontSize: 11
                            }}
                          />
                          <ChartsReferenceLine 
                            y={100}
                            lineStyle={{
                              stroke: '#FF4560',
                              strokeWidth: 1.5,
                              strokeDasharray: '5 5'
                            }}
                            label="100% Cumplimiento"
                            labelAlign="end"
                            labelStyle={{
                              fill: '#FF4560',
                              fontSize: 12
                            }}
                          />
                        </ScatterChart>
                      </div>

                      {/* Enhanced Point Information Panel */}
                      {selectedPoint && (
                        <DetailedPointAnalysis 
                          point={selectedPoint}
                          onClose={() => setSelectedPoint(null)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p>Cargando datos del gráfico...</p>
                        </div>
                      ) : (
                        <p>No hay datos suficientes para generar el gráfico</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="metricas">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Nota:</strong> Las métricas avanzadas ahora se calculan correctamente basándose en los datos filtrados, 
                  reflejando solo la información que coincide con los filtros aplicados (planta, clasificación, tipo de probeta, rango de resistencia, etc.).
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {calculatingAdvancedMetrics ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-gray-500">Calculando...</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-xl font-bold">{typeof filteredAdvancedMetrics.eficiencia === 'number' ? filteredAdvancedMetrics.eficiencia.toFixed(2) : '0.00'}</div>
                        <div className="text-xs text-gray-500">kg/cm² por kg de cemento</div>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Rendimiento Volumétrico</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {calculatingAdvancedMetrics ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-gray-500">Calculando...</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-xl font-bold">{typeof filteredAdvancedMetrics.rendimientoVolumetrico === 'number' ? filteredAdvancedMetrics.rendimientoVolumetrico.toFixed(2) : '0.00'}%</div>
                        <div className="text-xs text-gray-500">volumen real vs. registrado</div>
                      </>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="bg-white/70 backdrop-blur border border-slate-200/60 rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Desviación Estándar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{typeof filteredMetrics.desviacionEstandar === 'number' ? filteredMetrics.desviacionEstandar.toFixed(2) : '0.00'}</div>
                    <div className="text-xs text-gray-500">variabilidad de resistencia</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          

        </>
      )}
    </div>
  );
}

// Componente fallback para iconos que pueden no estar disponibles
function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
} 