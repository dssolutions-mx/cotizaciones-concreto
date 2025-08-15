'use client';

import React, { useState, useMemo } from 'react';
import { Upload, AlertTriangle, CheckCircle, Clock, Zap, Eye, EyeOff, Download, TruckIcon, Loader2, FileSpreadsheet } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { DebugArkikValidator } from '@/services/debugArkikValidator';
import { ArkikRawParser } from '@/services/arkikRawParser';
import type { StagingRemision, OrderSuggestion, ValidationError } from '@/types/arkik';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';

export default function ArkikProcessor() {
  const { currentPlant } = usePlantContext();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    validated: StagingRemision[];
    errors: any[];
    debugLogs: string[];
    processingTime: number;
    totalRows: number;
    successRate: number;
  } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [clientNames, setClientNames] = useState<Map<string, string>>(new Map());
  const [siteNames, setSiteNames] = useState<Map<string, string>>(new Map());
  const [recipeNames, setRecipeNames] = useState<Map<string, string>>(new Map());
  const [namesLoading, setNamesLoading] = useState(false);

  // Processing state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stagingData, setStagingData] = useState<StagingRemision[]>([]);
  const [orderSuggestions, setOrderSuggestions] = useState<OrderSuggestion[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [currentStep, setCurrentStep] = useState<'validation' | 'grouping' | 'confirmation'>('validation');
  
  // Statistics
  const [stats, setStats] = useState({
    totalRows: 0,
    validRows: 0,
    errorRows: 0,
    ordersToCreate: 0,
    remisionsWithoutOrder: 0,
    newClients: 0,
    newSites: 0,
    newTrucks: 0,
    newDrivers: 0
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
    }
  };

  const handleOrderGrouping = () => {
    if (!result?.validated) return;
    
    try {
      // Import the order grouper service
      const { ArkikOrderGrouper } = require('@/services/arkikOrderGrouper');
      const grouper = new ArkikOrderGrouper();
      
      // Group the validated remisiones
      const suggestions = grouper.groupRemisiones(result.validated);
      setOrderSuggestions(suggestions);
      
      // Update statistics
      const stats = {
        totalRows: result.validated.length,
        validRows: result.validated.filter(r => r.validation_status === 'valid').length,
        errorRows: result.validated.filter(r => r.validation_status === 'error').length,
        ordersToCreate: suggestions.filter((s: OrderSuggestion) => !s.remisiones[0].orden_original).length,
        remisionsWithoutOrder: result.validated.filter(r => !r.orden_original).length,
        newClients: new Set(result.validated.filter(r => !r.client_id).map(r => r.cliente_name)).size,
        newSites: new Set(result.validated.filter(r => !r.construction_site_id).map(r => r.obra_name)).size,
        newTrucks: new Set(result.validated.map(r => r.camion).filter(Boolean)).size,
        newDrivers: new Set(result.validated.map(r => r.conductor).filter(Boolean)).size
      };
      
      setStats(stats);
      setCurrentStep('grouping');
      
      console.log('[ArkikProcessor] Order grouping completed:', {
        suggestions: suggestions.length,
        stats
      });
      
    } catch (error) {
      console.error('[ArkikProcessor] Error in order grouping:', error);
      alert('Error al agrupar las órdenes');
    }
  };

  const handleFinalConfirmation = async () => {
    setLoading(true);
    
    try {
      console.log('[ArkikProcessor] Starting final confirmation process...');
      console.log('[ArkikProcessor] Processing', orderSuggestions.length, 'order suggestions');
      
      // Import the order creation service
      const { createOrdersFromSuggestions } = await import('@/services/arkikOrderCreator');
      
      // Execute the creation process
      if (!currentPlant) {
        throw new Error('No hay planta seleccionada');
      }
      
      const creationResult = await createOrdersFromSuggestions(
        orderSuggestions, 
        currentPlant.id, 
        result?.validated || []
      );
      
      console.log('[ArkikProcessor] Order creation completed:', creationResult);
      
      // Show success message with detailed results
      alert(`✅ Importación completada exitosamente!\n\n📊 Resumen:\n• ${creationResult.ordersCreated} órdenes creadas\n• ${creationResult.remisionesCreated} remisiones procesadas\n• ${creationResult.materialsProcessed} registros de materiales\n• ${creationResult.orderItemsCreated} items de orden creados`);
      
      // Reset to validation step
      setCurrentStep('validation');
      setOrderSuggestions([]);
      setResult(null);
      setFile(null);
      setStats({
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        ordersToCreate: 0,
        remisionsWithoutOrder: 0,
        newClients: 0,
        newSites: 0,
        newTrucks: 0,
        newDrivers: 0
      });
      
    } catch (error) {
      console.error('[ArkikProcessor] Error in final confirmation:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`❌ Error durante la importación:\n${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const processFile = async () => {
    if (!file || !currentPlant) return;

    setLoading(true);
    const startTime = Date.now();

    try {
      // First parse the file
      const parser = new ArkikRawParser();
      const { data: rawData, errors: parseErrors } = await parser.parseFile(file);
      
      // Convert to StagingRemision format
      const stagingRows = rawData.map((row, index) => ({
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        row_number: index + 1,
        fecha: new Date(row.fecha),
        hora_carga: new Date(row.hora_carga),
        remision_number: String(row.remision),
        cliente_name: String(row.cliente_nombre || ''),
        cliente_codigo: String(row.cliente_codigo || ''),
        obra_name: String(row.obra || ''),
        volumen_fabricado: Number(row.volumen || 0),
        conductor: String(row.chofer || ''),
        placas: String(row.placas || ''),
        product_description: String(row.product_description || ''),
        recipe_code: String(row.prod_tecnico || ''),
        materials_teorico: Object.fromEntries(
          Object.entries(row.materials || {}).map(([code, values]: [string, any]) => [
            code, 
            values?.teorica || 0
          ])
        ),
        materials_real: Object.fromEntries(
          Object.entries(row.materials || {}).map(([code, values]: [string, any]) => [
            code, 
            values?.real || 0
          ])
        ),
        validation_status: 'pending' as const,
        validation_errors: [],
        client_id: undefined,
        construction_site_id: undefined,
        recipe_id: undefined,
        unit_price: undefined,
        price_source: undefined,
        suggested_client_id: undefined,
        suggested_site_name: undefined,
        comentarios_externos: String(row.comentarios_externos || ''),
        comentarios_internos: String(row.comentarios_internos || ''),
        punto_entrega: String(row.punto_entrega || ''),
        prod_comercial: String(row.prod_comercial || ''),
        prod_tecnico: String(row.prod_tecnico || ''),
        bombeable: false,
        camion: String(row.camion || ''),
        elementos: String(row.elementos || ''),
        orden_original: undefined,
        estatus: String(row.estatus || ''),
        rfc: String(row.rfc || ''),
        suggested_order_group: '',
        materials_retrabajo: {},
        materials_manual: {},
      } as unknown as StagingRemision));

      // Then validate the parsed data
      const validator = new DebugArkikValidator(currentPlant.id);
      const { validated, errors, debugLogs } = await validator.validateBatch(stagingRows);

      const processingTime = Date.now() - startTime;
      const totalRows = validated.length;
      const successRate = totalRows > 0 ? ((totalRows - errors.length) / totalRows) * 100 : 0;

      setResult({
        validated,
        errors: [...parseErrors, ...errors],
        debugLogs,
        processingTime,
        totalRows,
        successRate
      });

      console.log(`[ArkikProcessor] Processing completed in ${processingTime}ms`);
      console.log(`[ArkikProcessor] Success rate: ${successRate.toFixed(1)}%`);
    } catch (error) {
      console.error('[ArkikProcessor] Processing error:', error);
      setResult({
        validated: [],
        errors: [{ message: String(error) }],
        debugLogs: [`Error: ${error}`],
        processingTime: 0,
        totalRows: 0,
        successRate: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const toggleRowExpansion = (rowId: string) => {
    console.log('[ArkikProcessor] Toggling row expansion for:', rowId);
    
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
      console.log('[ArkikProcessor] Row collapsed:', rowId);
    } else {
      newExpanded.add(rowId);
      console.log('[ArkikProcessor] Row expanded:', rowId);
      
      // Load names when expanding
      if (result?.validated) {
        console.log('[ArkikProcessor] Loading names for expanded rows...');
        loadNamesFromDatabase(result.validated);
      } else {
        console.log('[ArkikProcessor] No validated data available for loading names');
      }
    }
    setExpandedRows(newExpanded);
  };

  // Load names from database when expanding rows
  const loadNamesFromDatabase = async (rows: StagingRemision[]) => {
    if (!currentPlant) return;

    console.log('[ArkikProcessor] Loading names from database...');
    console.log('[ArkikProcessor] Rows to process:', rows.length);
    
    setNamesLoading(true);

    try {
      // Get unique IDs
      const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter((id): id is string => Boolean(id))));
      const siteIds = Array.from(new Set(rows.map(r => r.construction_site_id).filter((id): id is string => Boolean(id))));
      const recipeIds = Array.from(new Set(rows.map(r => r.recipe_id).filter((id): id is string => Boolean(id))));

      console.log('[ArkikProcessor] Unique IDs found:', {
        clients: clientIds.length,
        sites: siteIds.length,
        recipes: recipeIds.length
      });

      // Load client names
      if (clientIds.length > 0) {
        console.log('[ArkikProcessor] Loading client names for IDs:', clientIds);
        
        // Check table structure
        try {
          const { data: sampleClient, error: sampleError } = await supabase
            .from('clients')
            .select('id, business_name')
            .limit(1);
          
          if (sampleError) {
            console.error('[ArkikProcessor] Error checking clients table structure:', sampleError);
          } else {
            console.log('[ArkikProcessor] Sample client structure:', sampleClient?.[0]);
          }
        } catch (e) {
          console.log('[ArkikProcessor] Could not check clients table structure:', e);
        }
        
        const { data: clients, error: clientError } = await supabase
          .from('clients')
          .select('id, business_name')
          .in('id', clientIds);
        
        if (clientError) {
          console.error('[ArkikProcessor] Error loading clients:', clientError);
        } else {
          console.log('[ArkikProcessor] Clients loaded:', clients?.length || 0);
          const clientMap = new Map<string, string>();
          (clients || []).forEach((client: any) => {
            clientMap.set(client.id, client.business_name);
          });
          setClientNames(clientMap);
        }
      }

      // Load site names
      if (siteIds.length > 0) {
        console.log('[ArkikProcessor] Loading site names for IDs:', siteIds);
        
        // Check table structure
        try {
          const { data: sampleSite, error: sampleError } = await supabase
            .from('construction_sites')
            .select('id, name')
            .limit(1);
          
          if (sampleError) {
            console.error('[ArkikProcessor] Error checking construction_sites table structure:', sampleError);
          } else {
            console.log('[ArkikProcessor] Sample site structure:', sampleSite?.[0]);
          }
        } catch (e) {
          console.log('[ArkikProcessor] Could not check construction_sites table structure:', e);
        }
        
        const { data: sites, error: siteError } = await supabase
          .from('construction_sites')
          .select('id, name')
          .in('id', siteIds);
        
        if (siteError) {
          console.error('[ArkikProcessor] Error loading sites:', siteError);
        } else {
          console.log('[ArkikProcessor] Sites loaded:', sites?.length || 0);
          const siteMap = new Map<string, string>();
          (sites || []).forEach((site: any) => {
            siteMap.set(site.id, site.name);
          });
          setSiteNames(siteMap);
        }
      }

      // Load recipe names
      if (recipeIds.length > 0) {
        console.log('[ArkikProcessor] Loading recipe names for IDs:', recipeIds);
        
        // First, let's check what columns exist in the recipes table
        try {
          const { data: sampleRecipe, error: sampleError } = await supabase
            .from('recipes')
            .select('id, recipe_code')
            .limit(1);
          
          if (sampleError) {
            console.error('[ArkikProcessor] Error checking recipes table structure:', sampleError);
          } else {
            console.log('[ArkikProcessor] Sample recipe structure:', sampleRecipe?.[0]);
          }
        } catch (e) {
          console.log('[ArkikProcessor] Could not check table structure:', e);
        }
        
        const { data: recipes, error: recipeError } = await supabase
          .from('recipes')
          .select('id, recipe_code')
          .in('id', recipeIds);
        
        if (recipeError) {
          console.error('[ArkikProcessor] Error loading recipes:', recipeError);
        } else {
          console.log('[ArkikProcessor] Recipes loaded:', recipes?.length || 0);
          console.log('[ArkikProcessor] Recipe data:', recipes);
          const recipeMap = new Map<string, string>();
          (recipes || []).forEach((recipe: any) => {
            const recipeName = `Receta: ${recipe.recipe_code}`;
            recipeMap.set(recipe.id, recipeName);
            console.log(`[ArkikProcessor] Recipe ${recipe.id} -> ${recipeName}`);
          });
          setRecipeNames(recipeMap);
        }
      } else {
        console.log('[ArkikProcessor] No recipe IDs found to load');
        // Debug: show what recipe IDs are in the rows
        const allRecipeIds = rows.map(r => r.recipe_id).filter(Boolean);
        console.log('[ArkikProcessor] All recipe IDs in rows:', allRecipeIds);
        console.log('[ArkikProcessor] Sample row recipe_id:', rows[0]?.recipe_id);
      }

      // Refresh order suggestions if they exist to show updated names
      if (orderSuggestions.length > 0) {
        setOrderSuggestions([...orderSuggestions]);
        console.log('[ArkikProcessor] Order suggestions refreshed with new names');
      }

      console.log('[ArkikProcessor] Names loading completed');
    } catch (error) {
      console.error('[ArkikProcessor] Error loading names from database:', error);
    } finally {
      setNamesLoading(false);
    }
  };

  const getValidationIcon = (status: StagingRemision['validation_status']) => {
    switch (status) {
      case 'valid': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getValidationStatusText = (status: StagingRemision['validation_status']) => {
    switch (status) {
      case 'valid': return 'Válida';
      case 'warning': return 'Aviso';
      case 'error': return 'Error';
      default: return 'Pendiente';
    }
  };

  const getPriceSourceIcon = (source?: string) => {
    switch (source) {
      case 'client_site': return <Badge variant="default" className="bg-green-100 text-green-800">Cliente-Obra</Badge>;
      case 'client': return <Badge variant="default" className="bg-blue-100 text-blue-800">Cliente</Badge>;
      case 'plant': return <Badge variant="default" className="bg-gray-100 text-gray-800">Planta</Badge>;
      case 'quotes': return <Badge variant="default" className="bg-purple-100 text-purple-800">Cotización</Badge>;
      default: return <Badge variant="outline">Sin precio</Badge>;
    }
  };

  const visibleRows = useMemo(() => {
    if (!result?.validated) return [];
    if (!showOnlyIssues) return result.validated;
    return result.validated.filter(row => 
      row.validation_status !== 'valid' || (row.validation_errors?.length || 0) > 0
    );
  }, [result?.validated, showOnlyIssues]);

  const summaryStats = useMemo(() => {
    if (!result?.validated) return null;
    
    const total = result.validated.length;
    const valid = result.validated.filter(r => r.validation_status === 'valid').length;
    const warning = result.validated.filter(r => r.validation_status === 'warning').length;
    const error = result.validated.filter(r => r.validation_status === 'error').length;
    const withPrices = result.validated.filter(r => r.unit_price != null).length;
    const avgPrice = result.validated.filter(r => r.unit_price != null)
      .reduce((sum, r) => sum + (r.unit_price || 0), 0) / (withPrices || 1);
    
    return { total, valid, warning, error, withPrices, avgPrice };
  }, [result?.validated]);

  if (!currentPlant) {
  return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Planta no seleccionada</h3>
          <p className="text-gray-600">Selecciona una planta para procesar archivos Arkik</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Procesador Arkik</h1>
        <p className="text-gray-600">Procesa archivos Excel de producción de concreto</p>
        <div className="mt-2">
          <Badge variant="outline" className="text-sm">
            Planta: {currentPlant.name}
          </Badge>
        </div>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            Procesador Arkik - Importación de Remisiones
          </CardTitle>
          <CardDescription>
            Sube un archivo Excel de Arkik para procesar y validar las remisiones
          </CardDescription>
        </CardHeader>
        
        {/* Step Indicator */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center ${currentStep === 'validation' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium ${
                  currentStep === 'validation' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  1
          </div>
                <span className="ml-2 text-sm font-medium">Validación</span>
      </div>

              <div className="w-8 h-0.5 bg-gray-300"></div>
              
              <div className={`flex items-center ${currentStep === 'grouping' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium ${
                  currentStep === 'grouping' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  2
        </div>
                <span className="ml-2 text-sm font-medium">Agrupación por Elemento</span>
              </div>
              
              <div className="w-8 h-0.5 bg-gray-300"></div>
              
              <div className={`flex items-center ${currentStep === 'confirmation' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium ${
                  currentStep === 'confirmation' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  3
          </div>
                <span className="ml-2 text-sm font-medium">Confirmación</span>
          </div>
        </div>
          </div>
        </div>
        
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="flex-1"
              disabled={loading}
            />
            <Button
              onClick={processFile}
              disabled={!file || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Zap className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Procesar
                </>
              )}
            </Button>
          </div>
          
          {file && (
            <div className="text-sm text-gray-600">
              Archivo seleccionado: <span className="font-medium">{file.name}</span>
              <span className="ml-2 text-gray-500">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Procesamiento</CardTitle>
              <CardDescription>
                {result.totalRows} remisiones procesadas en {result.processingTime}ms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summaryStats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{summaryStats.valid}</div>
                    <div className="text-sm text-green-700">Válidas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">{summaryStats.warning}</div>
                    <div className="text-sm text-amber-700">Avisos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{summaryStats.error}</div>
                    <div className="text-sm text-red-700">Errores</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{summaryStats.withPrices}</div>
                    <div className="text-sm text-blue-700">Con Precio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      ${summaryStats.avgPrice.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-sm text-gray-700">Precio Prom.</div>
          </div>
        </div>
      )}

              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Tasa de éxito</span>
                  <span>{result.successRate.toFixed(1)}%</span>
          </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${result.successRate}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Materials Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Materiales</CardTitle>
              <CardDescription>
                Cantidades extraídas y mapeadas del archivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const allMaterialCodes = new Set<string>();
                const rowsWithMaterials = result.validated.filter(row => {
                  const codes = Object.keys(row.materials_teorico || {});
                  codes.forEach(code => allMaterialCodes.add(code));
                  return codes.length > 0;
                });
                
                const materialCodeArray = Array.from(allMaterialCodes);
                const materialErrors = result.errors.filter(e => e.field_name === 'materials');
                
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{materialCodeArray.length}</div>
                        <div className="text-sm text-purple-800">Códigos Detectados</div>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-indigo-600">{rowsWithMaterials.length}</div>
                        <div className="text-sm text-indigo-800">Filas con Materiales</div>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-amber-600">{materialErrors.length}</div>
                        <div className="text-sm text-amber-800">Errores de Materiales</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-gray-600">
                          {materialCodeArray.length > 0 ? '✅' : '❌'}
                        </div>
                        <div className="text-sm text-gray-800">Estado Detección</div>
                      </div>
                    </div>
                    
                    {materialCodeArray.length > 0 && (
                  <div>
                        <h4 className="font-medium text-gray-900 mb-2">Códigos Detectados:</h4>
                        <div className="flex flex-wrap gap-2">
                          {materialCodeArray.map(code => (
                            <Badge key={code} variant="secondary" className="text-xs">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={showOnlyIssues} 
                  onChange={e => setShowOnlyIssues(e.target.checked)} 
                />
                Mostrar sólo incidencias
              </label>
              <span className="text-gray-500">
                Mostrando: {visibleRows.length} de {result.totalRows}
              </span>
                  </div>
                  <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-2"
              >
                {showDebug ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showDebug ? 'Ocultar Debug' : 'Ver Debug'}
              </Button>
              {result?.validated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('[ArkikProcessor] Force reloading names...');
                    loadNamesFromDatabase(result.validated);
                  }}
                  className="flex items-center gap-2"
                  disabled={namesLoading}
                >
                  {namesLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Recargar Nombres
                </Button>
              )}
                  </div>
                </div>

          {/* Debug Logs */}
          {showDebug && (
            <Card>
              <CardHeader>
                <CardTitle>Logs de Debug</CardTitle>
                <CardDescription>
                  Información detallada del procesamiento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-96">
                  {result.debugLogs.map((log, idx) => (
                    <div key={idx} className="mb-1">{log}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Remisiones Procesadas</CardTitle>
              <CardDescription>
                Detalle de cada remisión con su estado de validación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left">
                      <th className="p-2 w-8"></th>
                      <th className="p-2">Estado</th>
                      <th className="p-2">Remisión</th>
                      <th className="p-2">Fecha</th>
                      <th className="p-2">Cliente</th>
                      <th className="p-2">Obra</th>
                      <th className="p-2">Precio</th>
                      <th className="p-2">Quote ID</th>
                      <th className="p-2">Receta</th>
                      <th className="p-2">Volumen</th>
                      <th className="p-2">Materiales</th>
                      <th className="p-2">Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(row => (
                      <React.Fragment key={row.id}>
                        <tr className="border-t hover:bg-gray-50">
                          <td className="p-2">
                            <input 
                              type="checkbox" 
                              checked={selectedRows.has(row.id)} 
                              onChange={e => toggleRowSelection(row.id)} 
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {getValidationIcon(row.validation_status)}
                              <span className="text-xs">
                                {getValidationStatusText(row.validation_status)}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 font-medium">{row.remision_number}</td>
                          <td className="p-2">
                            <div>{row.fecha.toISOString().split('T')[0]}</div>
                            <div className="text-xs text-gray-500">
                              {row.hora_carga instanceof Date 
                                ? row.hora_carga.toISOString().split('T')[1]?.split('.')[0] || ''
                                : new Date(row.hora_carga as any).toISOString().split('T')[1]?.split('.')[0] || ''
                              }
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[150px]">
                              <div className="font-medium text-xs">
                                {row.suggested_client_id ? '✓ Auto-detectado' : row.cliente_name}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {row.cliente_name}
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[150px]">
                              <div className="font-medium text-xs">
                                {row.suggested_site_name || row.obra_name}
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {getPriceSourceIcon(row.price_source)}
                              {row.unit_price != null ? (
                                <span className="text-xs font-mono">
                                  ${Number(row.unit_price).toLocaleString('es-MX')}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Sin precio</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[120px]">
                              {row.quote_id ? (
                                <div className="text-xs font-mono text-green-600 truncate" title={row.quote_id}>
                                  {row.quote_id}
                                </div>
                              ) : (
                                <div className="text-xs text-amber-600">No encontrado</div>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[150px]">
                              <div className="text-xs font-mono truncate" title={row.product_description}>
                                {row.product_description}
                              </div>
                              {row.recipe_id && (
                                <div className="text-xs text-green-600">✓ Vinculada</div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-center">{row.volumen_fabricado}</td>
                          <td className="p-2">
                            <div className="text-xs">
                              {Object.keys(row.materials_teorico || {}).length} mat.
                            </div>
                          </td>
                          <td className="p-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => toggleRowExpansion(row.id)}
                              className="flex items-center gap-1"
                            >
                              {expandedRows.has(row.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {expandedRows.has(row.id) ? 'Ocultar' : 'Ver'}
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {expandedRows.has(row.id) && (
                          <tr className="border-t bg-gray-50">
                            <td colSpan={12} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                {/* Validation Results - More User Friendly */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-blue-900">✅ Validación Exitosa</h4>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Cliente:</span>
                                      <span className="text-blue-800 font-medium">
                                        {row.client_id ? (
                                          <span className="flex flex-col items-end">
                                            <span className="text-sm font-medium">
                                              {clientNames.get(row.client_id) || 'Cargando...'}
                                            </span>
                                            <span className="text-xs text-gray-500">ID: {row.client_id}</span>
                                          </span>
                                        ) : (
                                          row.suggested_client_id ? 'Sugerido' : 'Manual'
                                        )}
                                      </span>
                      </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Obra:</span>
                                      <span className="text-blue-800 font-medium">
                                        {row.construction_site_id ? (
                                          <span className="flex flex-col items-end">
                                            <span className="text-sm font-medium">
                                              {siteNames.get(row.construction_site_id) || 'Cargando...'}
                                            </span>
                                            <span className="text-xs text-gray-500">ID: {row.construction_site_id}</span>
                                          </span>
                                        ) : (
                                          row.suggested_site_name ? 'Sugerida' : 'Manual'
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Receta:</span>
                                      <span className="text-blue-800 font-medium">
                                        {row.recipe_id ? (
                                          <span className="flex flex-col items-end">
                                            <span className="text-sm font-medium">
                                              {namesLoading ? (
                                                <span className="flex items-center gap-1">
                                                  <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                                  Cargando...
                                                </span>
                                              ) : recipeNames.get(row.recipe_id) ? (
                                                recipeNames.get(row.recipe_id)
                                              ) : (
                                                <span className="text-amber-600">Error al cargar</span>
                                              )}
                                            </span>
                                            <span className="text-xs text-gray-500">ID: {row.recipe_id}</span>
                                          </span>
                                        ) : 'No encontrada'
                                        }
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Precio:</span>
                                      <span className="text-blue-800 font-medium">
                                        {row.price_source === 'client_site' ? 'Cliente + Obra' :
                                         row.price_source === 'client' ? 'Por Cliente' :
                                         row.price_source === 'plant' ? 'General Planta' :
                                         row.price_source === 'none' ? 'Sin precio' : 'Sin precio'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Quote ID:</span>
                                      <span className="text-blue-800 font-medium">
                                        {row.quote_id ? (
                                          <span className="flex flex-col items-end">
                                            <span className="text-sm font-medium text-green-600">
                                              {row.quote_id}
                                            </span>
                                            <span className="text-xs text-gray-500">Vinculado</span>
                                          </span>
                                        ) : (
                                          <span className="text-amber-600 text-sm">No encontrado</span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Original Data - Enhanced */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-gray-900">📋 Datos del Excel</h4>
                                  <div className="space-y-1">
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Cliente:</span>
                                      <span className="text-gray-800">{row.cliente_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Código:</span>
                                      <span className="text-gray-800 font-mono">{row.cliente_codigo}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Obra:</span>
                                      <span className="text-gray-800">{row.obra_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Conductor:</span>
                                      <span className="text-gray-800">{row.conductor || 'No especificado'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Placas:</span>
                                      <span className="text-gray-800">{row.placas || 'No especificadas'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="font-medium text-gray-700">Volumen:</span>
                                      <span className="text-gray-800 font-medium">{row.volumen_fabricado} m³</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Materials Detail - Enhanced */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-green-900">🧱 Materiales ({Object.keys(row.materials_teorico || {}).length})</h4>
                                  <div className="max-h-32 overflow-auto space-y-1">
                                    {Object.keys(row.materials_teorico || {}).length > 0 ? (
                                      Object.keys(row.materials_teorico || {}).map(code => {
                                        const teorico = row.materials_teorico[code] || 0;
                                        const real = row.materials_real[code] || 0;
                                        const diferencia = Math.abs(teorico - real);
                                        const variacion = teorico > 0 ? ((diferencia / teorico) * 100) : 0;
                                        
                                        return (
                                          <div key={code} className="text-xs p-2 bg-green-50 border border-green-200 rounded">
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="font-medium text-green-800">{code}</span>
                                              <span className={`text-xs px-1 py-0.5 rounded ${
                                                variacion <= 2 ? 'bg-green-100 text-green-700' :
                                                variacion <= 5 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                              }`}>
                                                {variacion.toFixed(1)}%
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div className="text-center">
                                                <div className="text-blue-600 font-medium">Teórica</div>
                                                <div className="font-mono">{teorico.toFixed(2)}</div>
                                              </div>
                                              <div className="text-center">
                                                <div className="text-green-600 font-medium">Real</div>
                                                <div className="font-mono">{real.toFixed(2)}</div>
                                              </div>
                                            </div>
                                            {diferencia > 0 && (
                                              <div className="text-center mt-1 text-xs text-gray-600">
                                                Δ: {diferencia.toFixed(2)}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="text-gray-500 text-center py-2">Sin materiales</div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Additional Info Row */}
                              <div className="mt-4 pt-3 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Comments and Notes */}
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-purple-900 text-sm">📝 Comentarios</h4>
                                    <div className="text-xs space-y-1">
                                      {row.comentarios_externos ? (
                                        <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                                          <span className="font-medium text-purple-800">Externos:</span>
                                          <div className="text-purple-700 mt-1">{row.comentarios_externos}</div>
                                        </div>
                                      ) : (
                                        <div className="text-gray-400">Sin comentarios externos</div>
                                      )}
                                      {row.comentarios_internos && (
                                        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                                          <span className="font-medium text-blue-800">Internos:</span>
                                          <div className="text-blue-700 mt-1">{row.comentarios_internos}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Technical Details */}
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-gray-900 text-sm">🔧 Detalles Técnicos</h4>
                                    <div className="text-xs space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Punto de entrega:</span>
                                        <span className="text-gray-800">{row.punto_entrega || 'No especificado'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Producto comercial:</span>
                                        <span className="text-gray-800">{row.prod_comercial || 'No especificado'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Producto técnico:</span>
                                        <span className="text-gray-800">{row.prod_tecnico || 'No especificado'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Bombeable:</span>
                                        <span className={`font-medium ${row.bombeable ? 'text-green-600' : 'text-red-600'}`}>
                                          {row.bombeable ? 'Sí' : 'No'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Validation Issues */}
                              {(row.validation_errors || []).length > 0 && (
                                <div className="mt-4 pt-3 border-t">
                                  <h4 className="font-semibold text-sm mb-2 text-amber-900">
                                    ⚠️ Incidencias ({(row.validation_errors || []).length})
                                  </h4>
                                  <div className="space-y-2">
                                    {(row.validation_errors || []).map((error, idx) => (
                                      <div key={idx} className="text-xs p-2 bg-amber-50 border border-amber-200 rounded">
                      <div className="flex items-center gap-2">
                                          <span className="text-amber-600">⚠️</span>
                                          <div>
                                            <div className="font-medium text-amber-800">{error.error_type}</div>
                                            <div className="text-amber-700">{error.message}</div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                      </div>
                    </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                  ))}
                  </tbody>
                </table>
                </div>
            </CardContent>
          </Card>

          {/* Errors */}
          {result.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Errores de Validación</CardTitle>
                <CardDescription>
                  {result.errors.length} errores encontrados durante el procesamiento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.errors.map((error, idx) => (
                    <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded">
                      <div className="font-medium text-red-800">
                        Fila {error.row_number}: {error.error_type}
                      </div>
                      <div className="text-red-700">{error.message}</div>
                      {error.field_value && (
                        <div className="text-sm text-red-600">
                          Valor: "{error.field_value}"
                        </div>
                      )}
              </div>
            ))}
          </div>
              </CardContent>
            </Card>
          )}

          {/* Selection Actions */}
          {selectedRows.size > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-900">
                    {selectedRows.size} remisiones seleccionadas
                  </span>
            <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedRows(new Set())}
                    >
                      Limpiar selección
                    </Button>
                    <Button size="sm" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Exportar Seleccionadas
                    </Button>
            </div>
          </div>
              </CardContent>
            </Card>
          )}
          
          {/* Order Grouping Button */}
          {result && result.validated.length > 0 && (
            <div className="mt-6 text-center">
              <Button 
                onClick={handleOrderGrouping}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                disabled={currentStep !== 'validation'}
              >
                <TruckIcon className="w-5 h-5 mr-2" />
                Continuar a Agrupación por Elemento
              </Button>
            </div>
          )}
          
          {/* Order Grouping View */}
          {currentStep === 'grouping' && orderSuggestions.length > 0 && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TruckIcon className="w-6 h-6 text-blue-600" />
                    Agrupación por Elemento - Órdenes Sugeridas
                  </CardTitle>
                  <CardDescription>
                    Se han agrupado {orderSuggestions.length} órdenes basadas en cliente, obra y elemento (comentario externo)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Order Grouping Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{orderSuggestions.length}</div>
                      <div className="text-sm text-blue-700">Órdenes Sugeridas</div>
          </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{stats.ordersToCreate}</div>
                      <div className="text-sm text-green-700">Nuevas Órdenes</div>
        </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600">{stats.remisionsWithoutOrder}</div>
                      <div className="text-sm text-amber-700">Sin Orden Original</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {orderSuggestions.reduce((sum, s) => sum + s.total_volume, 0).toFixed(1)}
                      </div>
                      <div className="text-sm text-purple-700">Volumen Total (m³)</div>
                    </div>
                  </div>
                  
                  {/* Order Suggestions Table */}
                  <div className="space-y-4">
                    {orderSuggestions.map((suggestion, index) => (
                      <Card key={suggestion.group_key} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className="text-blue-700 border-blue-300">
                                  Orden {index + 1}
                                </Badge>
                                {!suggestion.remisiones[0].orden_original && (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    Nueva
                                  </Badge>
                                )}
                                {suggestion.remisiones[0].orden_original && (
                                  <Badge variant="outline" className="text-gray-700">
                                    Existente: {suggestion.remisiones[0].orden_original}
                                  </Badge>
      )}
    </div>
                              
                              <h4 className="font-semibold text-lg text-gray-900 mb-1">
                                {suggestion.comentarios_externos.length > 0 
                                  ? suggestion.comentarios_externos[0]
                                  : 'Sin elemento especificado'
                                }
                              </h4>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                                <div>
                                  <span className="font-medium">Cliente:</span> {
                                    suggestion.remisiones[0].client_id && clientNames.has(suggestion.remisiones[0].client_id!)
                                      ? clientNames.get(suggestion.remisiones[0].client_id!)
                                      : suggestion.remisiones[0].cliente_name
                                  }
                                </div>
                                <div>
                                  <span className="font-medium">Obra:</span> {
                                    suggestion.remisiones[0].construction_site_id && siteNames.has(suggestion.remisiones[0].construction_site_id!)
                                      ? siteNames.get(suggestion.remisiones[0].construction_site_id!)
                                      : suggestion.remisiones[0].obra_name
                                  }
                                </div>
                                <div>
                                  <span className="font-medium">Fecha:</span> {suggestion.date_range.start.toLocaleDateString('es-MX')}
                                </div>
                                <div>
                                  <span className="font-medium">Volumen:</span> {suggestion.total_volume.toFixed(1)} m³
                                </div>
                              </div>
                              
                                {/* Recipe Codes */}
                                {suggestion.recipe_codes.size > 0 && (
                                  <div className="mb-3">
                                    <span className="text-sm font-medium text-gray-700">Recetas:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {Array.from(suggestion.recipe_codes).map((code, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {code}
                                        </Badge>
      ))}
    </div>
                                  </div>
                                )}
                                
                                {/* Elemento (Comentarios Externos) */}
                                {suggestion.comentarios_externos.length > 0 && (
                                  <div className="mb-3">
                                    <span className="text-sm font-medium text-gray-700">Elemento:</span>
                                    <div className="text-sm text-gray-600 mt-1">
                                      {suggestion.comentarios_externos.join(', ')}
                                    </div>
                                  </div>
                                )}
                              
                              {/* Remisiones in this order */}
    <div className="mt-3">
                                <span className="text-sm font-medium text-gray-700">
                                  Remisiones ({suggestion.remisiones.length}):
                                </span>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                                  {suggestion.remisiones.map((remision, idx) => (
                                    <div key={idx} className="text-xs bg-gray-50 p-2 rounded border">
                                      <div className="font-medium">{remision.remision_number}</div>
                                      <div className="text-gray-600">{remision.volumen_fabricado.toFixed(1)} m³</div>
                                      <div className="text-gray-500">{remision.fecha.toLocaleDateString('es-MX')}</div>
                                    </div>
        ))}
      </div>
    </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="mt-6 flex justify-center gap-4">
                    <Button 
                      onClick={() => setCurrentStep('validation')}
                      variant="outline"
                      className="px-6"
                    >
                      ← Volver a Validación
                    </Button>
                    <Button 
                      onClick={() => setCurrentStep('confirmation')}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
                    >
                      Continuar a Confirmación →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Final Confirmation View */}
          {currentStep === 'confirmation' && orderSuggestions.length > 0 && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    Confirmación Final - Crear Órdenes
                  </CardTitle>
                  <CardDescription>
                    Revisa el resumen y confirma la creación de las órdenes sugeridas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Final Summary */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-4">
                      Resumen de la Importación
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.totalRows}</div>
                        <div className="text-sm text-green-700">Total Remisiones</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{orderSuggestions.length}</div>
                        <div className="text-sm text-blue-700">Órdenes a Crear</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {orderSuggestions.reduce((sum, s) => sum + s.total_volume, 0).toFixed(1)}
                        </div>
                        <div className="text-sm text-purple-700">Volumen Total (m³)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-amber-600">
                          ${orderSuggestions.reduce((sum, s) => {
                            const orderTotal = s.remisiones.reduce((orderSum, r) => 
                              orderSum + (r.unit_price || 0) * r.volumen_fabricado, 0
                            );
                            return sum + orderTotal;
                          }, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-sm text-amber-700">Valor Total</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* New Entities to Create */}
                  {(stats.newClients > 0 || stats.newSites > 0 || stats.newTrucks > 0 || stats.newDrivers > 0) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                      <h4 className="font-medium text-amber-800 mb-2">
                        Nuevas Entidades que se Crearán:
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {stats.newClients > 0 && (
                          <div className="text-amber-700">
                            <span className="font-medium">{stats.newClients}</span> nuevos clientes
                          </div>
                        )}
                        {stats.newSites > 0 && (
                          <div className="text-amber-700">
                            <span className="font-medium">{stats.newSites}</span> nuevas obras
                          </div>
                        )}
                        {stats.newTrucks > 0 && (
                          <div className="text-amber-700">
                            <span className="font-medium">{stats.newTrucks}</span> nuevos camiones
                          </div>
                        )}
                        {stats.newDrivers > 0 && (
                          <div className="text-amber-700">
                            <span className="font-medium">{stats.newDrivers}</span> nuevos conductores
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Order Creation Preview */}
                  <div className="space-y-3 mb-6">
                    <h4 className="font-medium text-gray-900">
                      Órdenes que se Crearán:
                    </h4>
                    {orderSuggestions.filter(s => !s.remisiones[0].orden_original).map((suggestion, index) => (
                      <div key={suggestion.group_key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">
                            {suggestion.comentarios_externos.length > 0 
                              ? suggestion.comentarios_externos[0]
                              : 'Sin elemento especificado'
                            }
                          </div>
                          <div className="text-sm text-gray-600">
                            {suggestion.remisiones.length} remisiones • {suggestion.total_volume.toFixed(1)} m³
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Cliente: {
                              suggestion.remisiones[0].client_id && clientNames.has(suggestion.remisiones[0].client_id!)
                                ? clientNames.get(suggestion.remisiones[0].client_id!)
                                : suggestion.remisiones[0].cliente_name
                            } • Obra: {
                              suggestion.remisiones[0].construction_site_id && siteNames.has(suggestion.remisiones[0].construction_site_id!)
                                ? siteNames.get(suggestion.remisiones[0].construction_site_id!)
                                : suggestion.remisiones[0].obra_name
                            }
                          </div>
                        </div>
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          Nueva Orden
                        </Badge>
                      </div>
                    ))}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-center gap-4">
                    <Button 
                      onClick={() => setCurrentStep('grouping')}
                      variant="outline"
                      className="px-6"
                    >
                      ← Volver a Agrupación
                    </Button>
                    <Button 
                      onClick={handleFinalConfirmation}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Confirmar y Crear Órdenes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}



