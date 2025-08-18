'use client';

import React, { useState, useMemo } from 'react';
import { Upload, AlertTriangle, CheckCircle, Clock, Zap, Download, TruckIcon, Loader2, FileSpreadsheet, ChevronRight, CheckCircle2 } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { DebugArkikValidator } from '@/services/debugArkikValidator';
import { ArkikRawParser } from '@/services/arkikRawParser';
import type { StagingRemision, OrderSuggestion, ValidationError, StatusProcessingDecision, StatusProcessingResult } from '@/types/arkik';
import StatusProcessingDialog from './StatusProcessingDialog';
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
  const [currentStep, setCurrentStep] = useState<'validation' | 'status-processing' | 'grouping' | 'confirmation'>('validation');
  
  // Status Processing state
  const [statusProcessingDecisions, setStatusProcessingDecisions] = useState<StatusProcessingDecision[]>([]);
  const [statusProcessingResult, setStatusProcessingResult] = useState<StatusProcessingResult | null>(null);
  const [problemRemisiones, setProblemRemisiones] = useState<StagingRemision[]>([]);
  const [potentialReassignments, setPotentialReassignments] = useState<Map<string, StagingRemision[]>>(new Map());
  
  // Dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedRemisionForProcessing, setSelectedRemisionForProcessing] = useState<StagingRemision | null>(null);
  
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

  const handleStatusProcessing = async () => {
    if (!result?.validated || !currentPlant) return;
    
    try {
      // Import the status processor service
      const { ArkikStatusProcessor } = await import('@/services/arkikStatusProcessor');
      const processor = new ArkikStatusProcessor(currentPlant.id, crypto.randomUUID());
      
      // Analyze remision statuses
      const analysis = processor.analyzeRemisionStatuses(result.validated);
      
      // Identify problem remisiones (non-terminado)
      const problems = [...analysis.incompletos, ...analysis.cancelados];
      setProblemRemisiones(problems);
      
      // Detect potential reassignments
      if (problems.length > 0) {
        const reassignments = processor.detectPotentialReassignments(problems, result.validated);
        setPotentialReassignments(reassignments);
      }
      
      // Move to status processing step
      setCurrentStep('status-processing');
      
    } catch (error) {
      console.error('Error in status processing:', error);
      alert('Error al procesar estados');
    }
  };

  const handleStatusDecision = (remisionId: string) => {
    if (!result?.validated) return;
    
    const remision = result.validated.find(r => r.id === remisionId);
    if (!remision) return;
    
    setSelectedRemisionForProcessing(remision);
    setStatusDialogOpen(true);
  };

  const handleSaveStatusDecision = (decision: StatusProcessingDecision) => {
    // Add or update the decision
    setStatusProcessingDecisions(prev => {
      const existing = prev.findIndex(d => d.remision_id === decision.remision_id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = decision;
        return updated;
      } else {
        return [...prev, decision];
      }
    });

    // Remove the remision from problem remisiones if it has a decision
    setProblemRemisiones(prev => 
      prev.filter(r => r.id !== decision.remision_id)
    );
  };

  const handleProcessStatusDecisions = async () => {
    if (!result?.validated || !currentPlant) return;
    
    setLoading(true);
    
    try {
      // Import services
      const { ArkikStatusProcessor } = await import('@/services/arkikStatusProcessor');
      const { ArkikStatusStorage } = await import('@/services/arkikStatusStorage');
      
      const currentSessionId = crypto.randomUUID();
      const processor = new ArkikStatusProcessor(currentPlant.id, currentSessionId);
      const storage = new ArkikStatusStorage();
      
      // Apply decisions to the data
      const processingResult = processor.applyProcessingDecisions(result.validated, statusProcessingDecisions);
      setStatusProcessingResult(processingResult);
      
      // Save to database using Supabase MCP
      if (processingResult.waste_materials.length > 0) {
        await storage.saveWasteMaterials(processingResult.waste_materials);
      }
      
      if (processingResult.reassignments.length > 0) {
        await storage.saveRemisionReassignments(processingResult.reassignments, currentSessionId, currentPlant.id);
      }
      
      // Save session information
      await storage.saveImportSession({
        sessionId: currentSessionId,
        plantId: currentPlant.id,
        fileName: file?.name || 'unknown',
        fileSize: file?.size,
        result: processingResult
      });
      
      console.log('Status processing completed:', {
        normal: processingResult.normal_remisiones,
        reassigned: processingResult.reassigned_remisiones,
        waste: processingResult.waste_remisiones,
        wasteRecords: processingResult.waste_materials.length,
        reassignmentRecords: processingResult.reassignments.length
      });
      
      // Continue to grouping with the processed data
      handleOrderGrouping();
      
    } catch (error) {
      console.error('Error processing status decisions:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Error al procesar decisiones de estado:\n${errorMessage}`);
    } finally {
      setLoading(false);
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
      
    } catch (error) {
      console.error('Error in order grouping:', error);
      alert('Error al agrupar las órdenes');
    }
  };

  const handleFinalConfirmation = async () => {
    if (!orderSuggestions.length || !currentPlant) return;
    
    setLoading(true);
    
    try {
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
      
      // Show success message with detailed results
      alert(`Importación completada exitosamente!\n\nResumen:\n• ${creationResult.ordersCreated} órdenes creadas\n• ${creationResult.remisionesCreated} remisiones procesadas\n• ${creationResult.materialsProcessed} registros de materiales\n• ${creationResult.orderItemsCreated} items de orden creados`);
      
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
      console.error('Error in final confirmation:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Error durante la importación:\n${errorMessage}`);
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
          camion: String(row.placas || ''),
          orden_original: undefined,
          prod_tecnico: String(row.prod_tecnico || ''),
          quote_id: undefined,
          estatus: String(row.estatus || 'pendiente'),
          suggested_order_group: ''
        } as StagingRemision));

      // Then validate using the debug validator
      const validator = new DebugArkikValidator(currentPlant.id);
      const { validated, errors } = await validator.validateBatch(stagingRows);
      
      const processingTime = Date.now() - startTime;
      const successRate = validated.length > 0 ? (validated.filter(r => r.validation_status === 'valid').length / validated.length) * 100 : 0;

              setResult({
          validated,
          errors,
          debugLogs: [],
          processingTime,
          totalRows: validated.length,
          successRate
        });

              setStagingData(stagingRows);
        setValidationErrors(errors);
        
        // Auto-load names after processing
        if (validated.length > 0) {
          loadNamesFromDatabase(validated);
        }
        
      } catch (error) {
      console.error('Processing error:', error);
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
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
      
      // Load names when expanding
      if (result?.validated) {
        loadNamesFromDatabase(result.validated);
      }
    }
    setExpandedRows(newExpanded);
  };

  // Load names from database when expanding rows
  const loadNamesFromDatabase = async (rows: StagingRemision[]) => {
    if (!currentPlant) return;

    setNamesLoading(true);

    try {
      // Get unique IDs
      const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter((id): id is string => Boolean(id))));
      const siteIds = Array.from(new Set(rows.map(r => r.construction_site_id).filter((id): id is string => Boolean(id))));
      const recipeIds = Array.from(new Set(rows.map(r => r.recipe_id).filter((id): id is string => Boolean(id))));

      console.log('Loading names for:', { clientIds, siteIds, recipeIds });

      // Load client names
      if (clientIds.length > 0) {
        const { data: clients, error: clientError } = await supabase
          .from('clients')
          .select('id, business_name')
          .in('id', clientIds);
        
        if (clientError) {
          console.error('Error loading clients:', clientError);
        } else {
          const clientMap = new Map<string, string>();
          (clients || []).forEach((client: any) => {
            clientMap.set(client.id, client.business_name);
          });
          setClientNames(clientMap);
          console.log('Loaded client names:', clientMap);
        }
      }

      // Load site names
      if (siteIds.length > 0) {
        const { data: sites, error: siteError } = await supabase
          .from('construction_sites')
          .select('id, name')
          .in('id', siteIds);
        
        if (siteError) {
          console.error('Error loading sites:', siteError);
        } else {
          const siteMap = new Map<string, string>();
          (sites || []).forEach((site: any) => {
            siteMap.set(site.id, site.name);
          });
          setSiteNames(siteMap);
          console.log('Loaded site names:', siteMap);
        }
      }

      // Load recipe names
      if (recipeIds.length > 0) {
        const { data: recipes, error: recipeError } = await supabase
          .from('recipes')
          .select('id, recipe_code')
          .in('id', recipeIds);
        
        if (recipeError) {
          console.error('Error loading recipes:', recipeError);
        } else {
          const recipeMap = new Map<string, string>();
          (recipes || []).forEach((recipe: any) => {
            const recipeName = `Receta: ${recipe.recipe_code}`;
            recipeMap.set(recipe.id, recipeName);
          });
          setRecipeNames(recipeMap);
          console.log('Loaded recipe names:', recipeMap);
        }
      }

      // Refresh order suggestions if they exist to show updated names
      if (orderSuggestions.length > 0) {
        setOrderSuggestions([...orderSuggestions]);
      }
    } catch (error) {
      console.error('Error loading names from database:', error);
    } finally {
      setNamesLoading(false);
    }
  };

  const forceReloadNames = () => {
    if (result?.validated) {
      loadNamesFromDatabase(result.validated);
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

  if (!currentPlant) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg">No hay planta seleccionada</div>
        <div className="text-gray-600 mt-2">Selecciona una planta para continuar</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Proceso de Importación</h2>
          <div className="text-sm text-gray-500">
            Planta: {currentPlant.name}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`flex items-center ${currentStep === 'validation' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'validation' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
              {currentStep === 'validation' ? '1' : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <span className="ml-2 font-medium">Validación</span>
          </div>
          
          <ChevronRight className="h-5 w-5 text-gray-300" />
          
          <div className={`flex items-center ${currentStep === 'status-processing' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'status-processing' ? 'border-blue-600 bg-blue-600 text-white' : ['grouping', 'confirmation'].includes(currentStep) ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300'}`}>
              {currentStep === 'status-processing' ? '2' : ['grouping', 'confirmation'].includes(currentStep) ? <CheckCircle2 className="h-5 w-5" /> : '2'}
            </div>
            <span className="ml-2 font-medium">Estados</span>
          </div>
          
          <ChevronRight className="h-5 w-5 text-gray-300" />
          
          <div className={`flex items-center ${currentStep === 'grouping' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'grouping' ? 'border-blue-600 bg-blue-600 text-white' : currentStep === 'confirmation' ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300'}`}>
              {currentStep === 'grouping' ? '3' : currentStep === 'confirmation' ? <CheckCircle2 className="h-5 w-5" /> : '3'}
            </div>
            <span className="ml-2 font-medium">Agrupación</span>
          </div>
          
          <ChevronRight className="h-5 w-5 text-gray-300" />
          
          <div className={`flex items-center ${currentStep === 'confirmation' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'confirmation' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
              {currentStep === 'confirmation' ? '4' : '4'}
            </div>
            <span className="ml-2 font-medium">Confirmación</span>
          </div>
        </div>
      </div>

      {/* File Upload */}
      {currentStep === 'validation' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Subir Archivo Excel
            </CardTitle>
            <CardDescription>
              Selecciona tu archivo de Arkik para comenzar el procesamiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="space-y-2">
                    <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-blue-600 hover:text-blue-500">
                        Haz clic para seleccionar
                      </span>{' '}
                      o arrastra y suelta
                    </div>
                    <p className="text-xs text-gray-500">
                      Excel (.xlsx, .xls) o CSV
                    </p>
                  </div>
                </label>
              </div>
              
              {file && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">{file.name}</span>
                      <span className="text-sm text-blue-700">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      onClick={processFile}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Procesar Archivo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {result && currentStep === 'validation' && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Procesamiento</CardTitle>
            <CardDescription>
              Resultados de la validación del archivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{result.totalRows}</div>
                <div className="text-sm text-blue-800">Total Filas</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {result.validated.filter(r => r.validation_status === 'valid').length}
                </div>
                <div className="text-sm text-green-800">Válidas</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-amber-600">
                  {result.validated.filter(r => r.validation_status === 'warning').length}
                </div>
                <div className="text-sm text-amber-800">Con Avisos</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {result.validated.filter(r => r.validation_status === 'error').length}
                </div>
                <div className="text-sm text-red-800">Con Errores</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Tiempo de procesamiento: {result.processingTime}ms
              </div>
              <Button
                onClick={handleStatusProcessing}
                disabled={result.validated.filter(r => r.validation_status === 'error').length > 0}
                className="bg-green-600 hover:bg-green-700"
              >
                Continuar a Procesamiento de Estados
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Processing Step */}
      {currentStep === 'status-processing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Procesamiento de Estados
            </CardTitle>
            <CardDescription>
              Revisar y procesar remisiones con estados especiales (canceladas, incompletas)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Status Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-amber-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result?.validated.filter(r => r.estatus.toLowerCase().includes('terminado') && !r.estatus.toLowerCase().includes('incompleto')).length || 0}
                  </div>
                  <div className="text-sm text-green-700">Terminadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {result?.validated.filter(r => r.estatus.toLowerCase().includes('incompleto')).length || 0}
                  </div>
                  <div className="text-sm text-orange-700">Incompletas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {result?.validated.filter(r => r.estatus.toLowerCase().includes('cancelado')).length || 0}
                  </div>
                  <div className="text-sm text-red-700">Canceladas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {problemRemisiones.length}
                  </div>
                  <div className="text-sm text-blue-700">Requieren Atención</div>
                </div>
              </div>

              {/* Problem Remisiones */}
              {problemRemisiones.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Remisiones que Requieren Decisión ({problemRemisiones.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {problemRemisiones.map((remision) => (
                      <Card key={remision.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className="font-mono">
                                  #{remision.remision_number}
                                </Badge>
                                <Badge 
                                  variant={remision.estatus.toLowerCase().includes('cancelado') ? 'destructive' : 'secondary'}
                                  className="capitalize"
                                >
                                  {remision.estatus}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                                <div>
                                  <span className="font-medium text-gray-700">Cliente:</span>
                                  <div className="text-gray-600">{remision.cliente_name}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Obra:</span>
                                  <div className="text-gray-600">{remision.obra_name}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Fecha:</span>
                                  <div className="text-gray-600">{remision.fecha.toLocaleDateString('es-MX')}</div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Volumen:</span>
                                  <div className="text-gray-600">{remision.volumen_fabricado.toFixed(1)} m³</div>
                                </div>
                              </div>

                              {/* Potential Reassignments */}
                              {potentialReassignments.has(remision.id) && (
                                <div className="bg-blue-50 p-3 rounded-lg mb-3">
                                  <div className="text-sm font-medium text-blue-900 mb-2">
                                    Posibles Reasignaciones:
                                  </div>
                                  <div className="space-y-1">
                                    {potentialReassignments.get(remision.id)?.slice(0, 3).map((candidate, idx) => (
                                      <div key={idx} className="text-xs text-blue-700 flex justify-between">
                                        <span>#{candidate.remision_number}</span>
                                        <span>{candidate.fecha.toLocaleDateString('es-MX')} - {candidate.volumen_fabricado.toFixed(1)}m³</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                                onClick={() => handleStatusDecision(remision.id)}
                              >
                                Procesar Remisión
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center gap-4 pt-4 border-t">
                <Button 
                  onClick={() => setCurrentStep('validation')}
                  variant="outline"
                  className="px-6"
                >
                  ← Volver a Validación
                </Button>
                
                {problemRemisiones.length === 0 && (
                  <Button 
                    onClick={handleOrderGrouping}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
                  >
                    Continuar a Agrupación →
                  </Button>
                )}
                
                {problemRemisiones.length > 0 && statusProcessingDecisions.length > 0 && (
                  <Button 
                    onClick={handleProcessStatusDecisions}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando Decisiones...
                      </>
                    ) : (
                      'Aplicar Decisiones y Continuar →'
                    )}
                  </Button>
                )}

                {problemRemisiones.length > 0 && statusProcessingDecisions.length === 0 && (
                  <div className="text-sm text-gray-600 text-center">
                    Procesa todas las remisiones problemáticas para continuar
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

             {/* Order Grouping */}
       {currentStep === 'grouping' && orderSuggestions.length > 0 && (
         <Card>
           <CardHeader>
             <CardTitle>Agrupación de Órdenes</CardTitle>
             <CardDescription>
               Órdenes sugeridas basadas en las remisiones validadas
             </CardDescription>
           </CardHeader>
           <CardContent>
             <div className="space-y-6">
               {/* Summary Stats */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                 <div className="text-center">
                   <div className="text-2xl font-bold text-blue-600">{orderSuggestions.length}</div>
                   <div className="text-sm text-blue-700">Órdenes Sugeridas</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-bold text-green-600">
                     {orderSuggestions.reduce((sum, s) => sum + s.total_volume, 0).toFixed(1)}
                   </div>
                   <div className="text-sm text-green-700">Volumen Total (m³)</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-bold text-purple-600">
                     {orderSuggestions.reduce((sum, s) => sum + s.remisiones.length, 0)}
                   </div>
                   <div className="text-sm text-purple-700">Total Remisiones</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-bold text-orange-600">
                     ${orderSuggestions.reduce((sum, s) => {
                       const orderTotal = s.remisiones.reduce((orderSum, r) => 
                         orderSum + (r.unit_price || 0) * r.volumen_fabricado, 0
                       );
                       return sum + orderTotal;
                     }, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                   </div>
                   <div className="text-sm text-orange-700">Valor Total</div>
                 </div>
               </div>

               {/* Order Details */}
               {orderSuggestions.map((suggestion, index) => (
                 <Card key={index} className="border-l-4 border-l-blue-500">
                   <CardHeader className="pb-3">
                     <div className="flex items-start justify-between">
                       <div className="flex-1">
                         <div className="flex items-center gap-3 mb-2">
                           <Badge variant="outline" className="text-blue-700 border-blue-300">
                             Orden {index + 1}
                           </Badge>
                           {!suggestion.remisiones[0]?.orden_original && (
                             <Badge variant="secondary" className="bg-green-100 text-green-800">
                               Nueva
                             </Badge>
                           )}
                           {suggestion.remisiones[0]?.orden_original && (
                             <Badge variant="outline" className="text-gray-700">
                               Existente: {suggestion.remisiones[0].orden_original}
                             </Badge>
                           )}
                         </div>
                         
                         <h4 className="font-semibold text-lg text-gray-900 mb-1">
                           {suggestion.comentarios_externos?.length > 0 
                             ? suggestion.comentarios_externos[0]
                             : 'Sin elemento especificado'
                           }
                         </h4>
                         
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                           <div>
                             <span className="font-medium">Cliente:</span> {
                               suggestion.remisiones[0]?.client_id && clientNames.has(suggestion.remisiones[0].client_id!)
                                 ? clientNames.get(suggestion.remisiones[0].client_id!)
                                 : suggestion.remisiones[0]?.cliente_name
                             }
                           </div>
                           <div>
                             <span className="font-medium">Obra:</span> {
                               suggestion.remisiones[0]?.construction_site_id && siteNames.has(suggestion.remisiones[0].construction_site_id!)
                                 ? siteNames.get(suggestion.remisiones[0].construction_site_id!)
                                 : suggestion.remisiones[0]?.obra_name
                             }
                           </div>
                           <div>
                             <span className="font-medium">Fecha:</span> {suggestion.date_range?.start.toLocaleDateString('es-MX')}
                           </div>
                           <div>
                             <span className="font-medium">Volumen:</span> {suggestion.total_volume.toFixed(1)} m³
                           </div>
                         </div>
                         
                         {/* Recipe Codes */}
                         {(() => {
                           const recipeCodes = new Set(
                             suggestion.remisiones
                               .map(r => r.product_description || r.recipe_code)
                               .filter(Boolean)
                           );
                           if (recipeCodes.size > 0) {
                             return (
                               <div className="mb-3">
                                 <span className="text-sm font-medium text-gray-700">Recetas:</span>
                                 <div className="flex flex-wrap gap-1 mt-1">
                                   {Array.from(recipeCodes).map((code, idx) => (
                                     <Badge key={idx} variant="outline" className="text-xs">
                                       {code}
                                     </Badge>
                                   ))}
                                 </div>
                               </div>
                             );
                           }
                           return null;
                         })()}
                         
                         {/* Elemento (Comentarios Externos) */}
                         {suggestion.comentarios_externos && suggestion.comentarios_externos.length > 0 && (
                           <div className="mb-3">
                             <span className="text-sm font-medium text-gray-700">Elemento:</span>
                             <div className="text-sm text-gray-600 mt-1">
                               {suggestion.comentarios_externos.join(', ')}
                             </div>
                           </div>
                         )}
                       </div>
                     </div>
                   </CardHeader>
                   
                   <CardContent className="pt-0">
                     {/* Remisiones in this order */}
                     <div className="mt-4">
                       <h5 className="text-sm font-medium text-gray-700 mb-3">
                         Remisiones ({suggestion.remisiones.length}):
                       </h5>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                         {suggestion.remisiones.map((remision, idx) => (
                           <div key={idx} className="bg-gray-50 p-3 rounded border text-xs">
                             <div className="flex justify-between items-start mb-2">
                               <div className="font-medium text-gray-800">
                                 #{remision.remision_number}
                               </div>
                               <Badge variant="outline" className="text-xs">
                                 {remision.volumen_fabricado.toFixed(1)} m³
                               </Badge>
                             </div>
                             <div className="space-y-1 text-gray-600">
                               <div className="flex justify-between">
                                 <span>Fecha:</span>
                                 <span className="font-medium">
                                   {remision.fecha.toLocaleDateString('es-MX')}
                                 </span>
                               </div>
                               <div className="flex justify-between">
                                 <span>Hora:</span>
                                 <span className="font-medium">
                                   {remision.hora_carga instanceof Date 
                                     ? remision.hora_carga.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                     : new Date(remision.hora_carga as any).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                   }
                                 </span>
                               </div>
                               <div className="flex justify-between">
                                 <span>Receta:</span>
                                 <span className="font-medium">
                                   {remision.product_description || remision.recipe_code || 'No especificada'}
                                 </span>
                               </div>
                               <div className="flex justify-between">
                                 <span>Precio:</span>
                                 <span className="font-medium">
                                   ${(remision.unit_price || 0).toLocaleString('es-MX')}
                                 </span>
                               </div>
                                                             {remision.quote_detail_id && (
                                <div className="flex justify-between">
                                  <span>Quote Detail ID:</span>
                                  <span className="font-medium text-green-600 text-xs truncate" title={remision.quote_detail_id}>
                                    {remision.quote_detail_id.substring(0, 8)}...
                                  </span>
                                </div>
                              )}
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               ))}
               
               {/* Action Buttons */}
               <div className="flex justify-center gap-4 pt-4 border-t">
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
             </div>
           </CardContent>
         </Card>
       )}

      {/* Final Confirmation */}
      {currentStep === 'confirmation' && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmación Final</CardTitle>
            <CardDescription>
              Revisa los detalles antes de crear las órdenes en la base de datos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalRows}</div>
                  <div className="text-sm text-blue-800">Remisiones</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.ordersToCreate}</div>
                  <div className="text-sm text-green-800">Órdenes</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.newClients}</div>
                  <div className="text-sm text-purple-800">Nuevos Clientes</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.newSites}</div>
                  <div className="text-sm text-orange-800">Nuevas Obras</div>
                </div>
              </div>
              
              <div className="text-center">
                <Button
                  onClick={handleFinalConfirmation}
                  disabled={loading}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 px-8"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creando Órdenes...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Confirmar e Importar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table - Only show in validation step */}
      {result && currentStep === 'validation' && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle de Remisiones</CardTitle>
            <CardDescription>
              Estado de validación de cada remisión procesada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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

                {result?.validated && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
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
                    {recipeNames.size > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {recipeNames.size} recetas
                      </Badge>
                    )}
                  </Button>
                )}
              </div>

              {/* Table */}
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
                      <th className="p-2">Quote Detail ID</th>
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
                                {row.suggested_client_id ? 'Auto-detectado' : row.cliente_name}
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
                              {row.quote_detail_id ? (
                                <div className="text-xs font-mono text-green-600 truncate" title={row.quote_detail_id}>
                                  {row.quote_detail_id}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">No encontrado</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[120px]">
                              <div className="text-xs font-medium">
                                {row.recipe_id ? (
                                  namesLoading ? (
                                    <span className="flex items-center gap-1">
                                      <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                      Cargando...
                                    </span>
                                  ) : recipeNames.get(row.recipe_id) ? (
                                    recipeNames.get(row.recipe_id)
                                  ) : (
                                    <span className="text-gray-500">Cargando...</span>
                                  )
                                ) : (
                                  <span className="text-gray-400">No encontrada</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="text-xs font-mono">
                              {row.volumen_fabricado.toFixed(2)} m³
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="max-w-[100px]">
                              {(() => {
                                const materialCodes = Object.keys(row.materials_teorico || {});
                                if (materialCodes.length === 0) {
                                  return <span className="text-xs text-gray-400">Sin materiales</span>;
                                }
                                return (
                                  <div className="text-xs">
                                    <div className="font-medium">{materialCodes.length} códigos</div>
                                    <div className="text-gray-500 truncate">
                                      {materialCodes.slice(0, 2).join(', ')}
                                      {materialCodes.length > 2 && '...'}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="p-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => toggleRowExpansion(row.id)}
                              className="flex items-center gap-1"
                            >
                              {expandedRows.has(row.id) ? '−' : '+'}
                              {expandedRows.has(row.id) ? 'Ocultar' : 'Ver'}
                            </Button>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {expandedRows.has(row.id) && (
                          <tr className="border-t bg-gray-50">
                            <td colSpan={12} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                {/* Validation Results */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-blue-900">Validación Exitosa</h4>
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
                                      <span className="font-medium text-gray-700">Quote Detail ID:</span>
                                      <span className="text-blue-800 font-medium">
                                        {row.quote_detail_id ? (
                                          <span className="flex flex-col items-end">
                                            <span className="text-sm font-medium text-green-600">
                                              {row.quote_detail_id}
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

                                {/* Materials Detail */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-green-900">Materiales Detectados</h4>
                                  <div className="space-y-1">
                                    {Object.keys(row.materials_teorico || {}).map(materialCode => {
                                      const teorico = Number(row.materials_teorico?.[materialCode] || 0);
                                      const real = Number(row.materials_real?.[materialCode] || 0);
                                      const variacion = teorico > 0 ? ((real - teorico) / teorico) * 100 : 0;
                                      
                                      return (
                                        <div key={materialCode} className="border-l-2 border-green-200 pl-2">
                                          <div className="font-medium text-gray-800">{materialCode}</div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="text-center">
                                              <div className="text-gray-600">Teórica</div>
                                              <div className="font-mono">{teorico.toFixed(2)}</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="text-gray-600">Real</div>
                                              <div className="font-mono">{real.toFixed(2)}</div>
                                            </div>
                                          </div>
                                          <div className="text-center text-xs">
                                            <span className={`font-medium ${Math.abs(variacion) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                                              {variacion > 0 ? '+' : ''}{variacion.toFixed(1)}%
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Additional Info */}
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-gray-900">Información Adicional</h4>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Conductor:</span>
                                      <span className="text-gray-800">{row.conductor || 'No especificado'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Placas:</span>
                                      <span className="text-gray-800">{row.placas || 'No especificadas'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Punto de entrega:</span>
                                      <span className="text-gray-800">{row.punto_entrega || 'No especificado'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Producto comercial:</span>
                                      <span className="text-gray-800">{row.product_description || 'No especificado'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Comentarios externos:</span>
                                      <span className="text-gray-800">{row.comentarios_externos || 'Sin comentarios'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Comentarios internos:</span>
                                      <span className="text-gray-800">{row.comentarios_internos || 'Sin comentarios'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Processing Dialog */}
      <StatusProcessingDialog
        isOpen={statusDialogOpen}
        onClose={() => {
          setStatusDialogOpen(false);
          setSelectedRemisionForProcessing(null);
        }}
        remision={selectedRemisionForProcessing}
        potentialTargets={selectedRemisionForProcessing ? potentialReassignments.get(selectedRemisionForProcessing.id) || [] : []}
        onSaveDecision={handleSaveStatusDecision}
      />
    </div>
  );
}



