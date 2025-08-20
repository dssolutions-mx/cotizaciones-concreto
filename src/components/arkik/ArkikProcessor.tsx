'use client';

import React, { useState, useMemo } from 'react';
import { Upload, AlertTriangle, CheckCircle, Clock, Zap, Download, TruckIcon, Loader2, FileSpreadsheet, ChevronRight, CheckCircle2 } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { DebugArkikValidator } from '@/services/debugArkikValidator';
import { ArkikRawParser } from '@/services/arkikRawParser';
import type { StagingRemision, OrderSuggestion, ValidationError, StatusProcessingDecision, StatusProcessingResult, RemisionReassignment } from '@/types/arkik';
import StatusProcessingDialog from './StatusProcessingDialog';
import ManualAssignmentInterface from './ManualAssignmentInterface';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';

// Helper functions for date formatting without timezone conversion
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

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
  const [currentStep, setCurrentStep] = useState<'validation' | 'status-processing' | 'grouping' | 'confirmation' | 'manual-assignment'>('validation');
  
  // Manual assignment state for commercial mode
  const [showManualAssignment, setShowManualAssignment] = useState(false);
  const [unmatchedRemisiones, setUnmatchedRemisiones] = useState<StagingRemision[]>([]);
  const [manualAssignments, setManualAssignments] = useState<Map<string, string>>(new Map()); // remision_number -> order_id
  
  // Status Processing state
  const [statusProcessingDecisions, setStatusProcessingDecisions] = useState<StatusProcessingDecision[]>([]);
  const [statusProcessingResult, setStatusProcessingResult] = useState<StatusProcessingResult | null>(null);
  const [problemRemisiones, setProblemRemisiones] = useState<StagingRemision[]>([]);
  const [potentialReassignments, setPotentialReassignments] = useState<Map<string, StagingRemision[]>>(new Map());
  
  // Processed data after status decisions are applied
  const [processedRemisiones, setProcessedRemisiones] = useState<StagingRemision[]>([]);
  
  // Cache reassignments until after remisiones are created
  const [pendingReassignments, setPendingReassignments] = useState<RemisionReassignment[]>([]);
  
  // Dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedRemisionForProcessing, setSelectedRemisionForProcessing] = useState<StagingRemision | null>(null);
  
  // Processing mode toggle
  const [processingMode, setProcessingMode] = useState<'dedicated' | 'commercial'>('dedicated');
  
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
      const { arkikStatusService } = await import('@/services/arkikStatusStorage');
      
      const currentSessionId = crypto.randomUUID();
      const processor = new ArkikStatusProcessor(currentPlant.id, currentSessionId);
      
      // Apply decisions to the data - this modifies the remisiones in place
      const processingResult = processor.applyProcessingDecisions(result.validated, statusProcessingDecisions);
      setStatusProcessingResult(processingResult);
      
      // Debug: Check if exclusions were applied correctly
      const excludedCount = result.validated.filter(r => r.is_excluded_from_import).length;
      const withStatusActions = result.validated.filter(r => r.status_processing_action).length;
      
      console.log('[ArkikProcessor] Status processing debug:', {
        totalRemisiones: result.validated.length,
        explicitDecisions: statusProcessingDecisions.length,
        remisionesWithoutDecisions: result.validated.length - statusProcessingDecisions.length,
        excludedAfterProcessing: excludedCount,
        withStatusActions: withStatusActions,
        wasteRemisiones: processingResult.waste_remisiones,
        reassignedRemisiones: processingResult.reassigned_remisiones,
        normalRemisiones: processingResult.normal_remisiones,
        expectedTotal: processingResult.waste_remisiones + processingResult.reassigned_remisiones + processingResult.normal_remisiones
      });
      
      // Store the processed remisiones data (with status decisions applied)
      // Make a deep copy to ensure state updates properly
      const processedData = result.validated.map(r => ({ ...r }));
      setProcessedRemisiones(processedData);
      
      console.log('[ArkikProcessor] Processed data sample:', processedData.slice(0, 3).map(r => ({
        remision_number: r.remision_number,
        is_excluded_from_import: r.is_excluded_from_import,
        status_processing_action: r.status_processing_action
      })));
      
      // Save waste materials immediately (they don't reference other remisiones)
      if (processingResult.waste_materials.length > 0) {
        await arkikStatusService.saveWasteMaterials(processingResult.waste_materials);
      }
      
      // Cache reassignments until after remisiones are created in the database
      if (processingResult.reassignments.length > 0) {
        setPendingReassignments(processingResult.reassignments);
        console.log(`💾 Cached ${processingResult.reassignments.length} reassignments until remisiones are created`);
      }
      
      // Note: Reassignments will be saved after order/remision creation completes
      
      console.log('Status processing completed:', {
        normal: processingResult.normal_remisiones,
        reassigned: processingResult.reassigned_remisiones,
        waste: processingResult.waste_remisiones,
        wasteRecords: processingResult.waste_materials.length,
        reassignmentsCached: processingResult.reassignments.length
      });
      
      console.log('Processed remisiones data updated with', result.validated.length, 'remisiones');
      
      // Continue to grouping with the processed data
      // Pass the processed data directly to avoid React state timing issues
      handleOrderGrouping(processedData);
      
    } catch (error) {
      console.error('Error processing status decisions:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Error al procesar decisiones de estado:\n${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderGrouping = async (directProcessedData?: StagingRemision[]) => {
    // Use direct data if provided, otherwise use processed data state, otherwise fall back to validated data
    const remisionesToProcess = directProcessedData || (processedRemisiones.length > 0 ? processedRemisiones : (result?.validated || []));
    
    if (remisionesToProcess.length === 0) return;
    
    try {
      console.log('[ArkikProcessor] === DEBUGGING ORDER GROUPING ===');
      console.log('[ArkikProcessor] Data source:', {
        usingDirectData: !!directProcessedData,
        usingProcessedState: !directProcessedData && processedRemisiones.length > 0,
        usingValidatedFallback: !directProcessedData && processedRemisiones.length === 0
      });
      console.log('[ArkikProcessor] Total remisiones to process:', remisionesToProcess.length);
      console.log('[ArkikProcessor] Processing mode:', processingMode);
      
      // Debug: Check exclusions in the data being used
      const excludedInData = remisionesToProcess.filter(r => r.is_excluded_from_import);
      console.log('[ArkikProcessor] Exclusions in order grouping data:', {
        totalRemisiones: remisionesToProcess.length,
        excludedRemisiones: excludedInData.length,
        excludedDetails: excludedInData.map(r => ({
          remision_number: r.remision_number,
          action: r.status_processing_action,
          reason: r.waste_reason
        }))
      });
      
      // Debug: Show first few remisiones to understand structure
      console.log('[ArkikProcessor] Sample remisiones (first 3):');
      remisionesToProcess.slice(0, 3).forEach((remision, index) => {
        console.log(`[ArkikProcessor] Sample ${index + 1}:`, {
          remision_number: remision.remision_number,
          client_id: remision.client_id,
          construction_site_id: remision.construction_site_id,
          recipe_id: remision.recipe_id,
          unit_price: remision.unit_price,
          validation_status: remision.validation_status,
          obra_name: remision.obra_name,
          cliente_name: remision.cliente_name,
          is_excluded_from_import: remision.is_excluded_from_import,
          status_processing_action: remision.status_processing_action
        });
      });

      // Filter remisiones that are ready for order creation (excluding processed exclusions)
      const readyForOrderCreation = remisionesToProcess.filter(remision => {
        // Skip if excluded from import due to status processing
        if (remision.is_excluded_from_import) {
          console.log(`[ArkikProcessor] Excluding remision ${remision.remision_number} due to status processing:`, remision.status_processing_action);
          return false;
        }
        
        // Must have all required IDs for order creation
        const hasClientId = !!remision.client_id;
        const hasConstructionSiteId = !!remision.construction_site_id;
        const hasRecipeId = !!remision.recipe_id;
        
        // Must have valid validation status (not error)
        const hasValidStatus = remision.validation_status !== 'error';
        
        // Must have pricing information
        const hasPricing = remision.unit_price != null && remision.unit_price > 0;
        
        // All modes require the same basic data - validation should have resolved missing IDs
        const hasRequiredIds = hasClientId && hasConstructionSiteId && hasRecipeId;
        
        console.log(`[ArkikProcessor] Filtering remision ${remision.remision_number}:`, {
          hasClientId,
          hasConstructionSiteId,
          hasRecipeId,
          hasValidStatus,
          hasPricing,
          processingMode,
          finalResult: hasRequiredIds && hasValidStatus && hasPricing
        });
        
        if (!hasClientId) {
          console.warn('[ArkikProcessor] ❌ Missing client_id for remision:', remision.remision_number, 'Cliente:', remision.cliente_name);
        }
        
        if (!hasConstructionSiteId) {
          console.warn('[ArkikProcessor] ❌ Missing construction_site_id for remision:', remision.remision_number, 'Obra:', remision.obra_name);
        }
        
        if (!hasRecipeId) {
          console.warn('[ArkikProcessor] ❌ Missing recipe_id for remision:', remision.remision_number);
        }
        
        if (!hasValidStatus) {
          console.warn('[ArkikProcessor] ❌ Invalid validation status for remision:', remision.remision_number, 'Status:', remision.validation_status);
        }
        
        if (!hasPricing) {
          console.warn('[ArkikProcessor] ❌ Missing pricing for remision:', remision.remision_number, 'Price:', remision.unit_price);
        }
        
        return hasRequiredIds && hasValidStatus && hasPricing;
      });

      console.log('[ArkikProcessor] Filtered remisiones for order creation:', {
        total: remisionesToProcess.length,
        ready: readyForOrderCreation.length,
        filtered_out: remisionesToProcess.length - readyForOrderCreation.length,
        excluded_by_status_processing: remisionesToProcess.filter(r => r.is_excluded_from_import).length
      });

      // Track filtered out remisiones for reporting
      const filteredOut = remisionesToProcess.filter(remision => {
        if (remision.is_excluded_from_import) return true; // Include status processing exclusions
        const hasRequiredIds = remision.client_id && remision.construction_site_id && remision.recipe_id;
        const hasValidStatus = remision.validation_status !== 'error';
        const hasPricing = remision.unit_price != null && remision.unit_price > 0;
        return !(hasRequiredIds && hasValidStatus && hasPricing);
      });

      if (readyForOrderCreation.length === 0) {
        const reasons = [];
        const excludedByStatus = filteredOut.filter(r => r.is_excluded_from_import).length;
        const missingConstructionSite = filteredOut.filter(r => !r.is_excluded_from_import && !r.construction_site_id).length;
        const missingClient = filteredOut.filter(r => !r.is_excluded_from_import && !r.client_id).length;
        const missingRecipe = filteredOut.filter(r => !r.is_excluded_from_import && !r.recipe_id).length;
        const missingPrice = filteredOut.filter(r => !r.is_excluded_from_import && (!r.unit_price || r.unit_price <= 0)).length;
        const hasErrors = filteredOut.filter(r => !r.is_excluded_from_import && r.validation_status === 'error').length;

        if (excludedByStatus > 0) reasons.push(`${excludedByStatus} excluidas por procesamiento de estado`);
        if (missingConstructionSite > 0) reasons.push(`${missingConstructionSite} sin obra válida`);
        if (missingClient > 0) reasons.push(`${missingClient} sin cliente válido`);
        if (missingRecipe > 0) reasons.push(`${missingRecipe} sin receta válida`);
        if (missingPrice > 0) reasons.push(`${missingPrice} sin precio válido`);
        if (hasErrors > 0) reasons.push(`${hasErrors} con errores de validación`);

        alert(`No hay remisiones válidas para crear órdenes.\n\nMotivos:\n• ${reasons.join('\n• ')}\n\nRevisa la validación y los procesamientos de estado antes de continuar.`);
        return;
      }

      if (filteredOut.length > 0) {
        console.warn('[ArkikProcessor] Remisiones filtradas:', filteredOut.map(r => ({
          remision_number: r.remision_number,
          is_excluded_from_import: r.is_excluded_from_import,
          status_processing_action: r.status_processing_action,
          missing_construction_site_id: !r.construction_site_id,
          missing_client_id: !r.client_id,
          missing_recipe_id: !r.recipe_id,
          missing_pricing: !r.unit_price || r.unit_price <= 0,
          validation_status: r.validation_status,
          obra_name: r.obra_name
        })));
      }

      // Use the UI toggle for processing mode
      let suggestions: OrderSuggestion[] = [];
      
      if (processingMode === 'commercial') {
        // Commercial mode: try to match existing orders first
        console.log('[ArkikProcessor] Commercial mode: Looking for existing orders to match');
        
        const { ArkikOrderMatcher } = await import('@/services/arkikOrderMatcher');
        const matcher = new ArkikOrderMatcher(currentPlant!.id);
        
        const { matchedOrders, unmatchedRemisiones } = await matcher.findMatchingOrders(readyForOrderCreation);
        
        console.log('[ArkikProcessor] Order matching results:', {
          totalRemisiones: readyForOrderCreation.length,
          matchedOrders: matchedOrders.length,
          unmatchedRemisiones: unmatchedRemisiones.length
        });
        
        // Check if we have unmatched remisiones that need manual assignment
        if (unmatchedRemisiones.length > 0) {
          console.log('[ArkikProcessor] Found unmatched remisiones, showing manual assignment interface');
          setUnmatchedRemisiones(unmatchedRemisiones);
          setShowManualAssignment(true);
          setCurrentStep('manual-assignment');
          return; // Stop here and let user manually assign
        }
        
        // Import the order grouper service
        const { ArkikOrderGrouper } = await import('@/services/arkikOrderGrouper');
        const grouper = new ArkikOrderGrouper();
        
        // Group with existing orders and any unmatched remisiones
        suggestions = grouper.groupRemisiones(readyForOrderCreation, {
          processingMode: 'commercial',
          existingOrderMatches: matchedOrders
        });
        
      } else {
        // Dedicated site mode: create new orders automatically
        console.log('[ArkikProcessor] Dedicated site mode: Creating new orders');
        
        const { ArkikOrderGrouper } = await import('@/services/arkikOrderGrouper');
        const grouper = new ArkikOrderGrouper();
        
        suggestions = grouper.groupRemisiones(readyForOrderCreation, {
          processingMode: 'dedicated'
        });
      }
      
      setOrderSuggestions(suggestions);
      
      // Update statistics based on ready remisiones
      const stats = {
        totalRows: readyForOrderCreation.length, // Use filtered count
        validRows: readyForOrderCreation.filter(r => r.validation_status === 'valid').length,
        errorRows: remisionesToProcess.filter(r => r.validation_status === 'error').length, // Show errors from processed data
        ordersToCreate: suggestions.filter((s: OrderSuggestion) => !s.remisiones[0].orden_original).length,
        remisionsWithoutOrder: readyForOrderCreation.filter(r => !r.orden_original).length,
        newClients: new Set(readyForOrderCreation.filter(r => !r.client_id).map(r => r.cliente_name)).size,
        newSites: new Set(readyForOrderCreation.filter(r => !r.construction_site_id).map(r => r.obra_name)).size,
        newTrucks: new Set(readyForOrderCreation.map(r => r.camion).filter(Boolean)).size,
        newDrivers: new Set(readyForOrderCreation.map(r => r.conductor).filter(Boolean)).size
      };
      
      setStats(stats);
      setCurrentStep('grouping');
      
    } catch (error) {
      console.error('Error in order grouping:', error);
      alert('Error al agrupar las órdenes');
    }
  };

  const handleManualAssignmentsComplete = async (assignments: Map<string, string>) => {
    console.log('[ArkikProcessor] Manual assignments completed:', Object.fromEntries(assignments));
    
    // Update manual assignments state
    setManualAssignments(assignments);
    setShowManualAssignment(false);
    
    try {
      // Now continue with order grouping including manual assignments
      const remisionesToProcess = processedRemisiones.length > 0 ? processedRemisiones : (result?.validated || []);
      const readyForOrderCreation = remisionesToProcess.filter(remision => {
        if (remision.is_excluded_from_import) return false;
        const hasRequiredIds = remision.client_id && remision.construction_site_id && remision.recipe_id;
        const hasValidStatus = remision.validation_status !== 'error';
        const hasPricing = remision.unit_price != null && remision.unit_price > 0;
        return hasRequiredIds && hasValidStatus && hasPricing;
      });

      // Get automatic matches first
      const { ArkikOrderMatcher } = await import('@/services/arkikOrderMatcher');
      const matcher = new ArkikOrderMatcher(currentPlant!.id);
      const { matchedOrders, unmatchedRemisiones } = await matcher.findMatchingOrders(readyForOrderCreation);

      // Combine automatic matches with manual assignments
      const { ArkikOrderGrouper } = await import('@/services/arkikOrderGrouper');
      const grouper = new ArkikOrderGrouper();
      
      const suggestions = grouper.groupRemisiones(readyForOrderCreation, {
        processingMode: 'commercial',
        existingOrderMatches: matchedOrders,
        manualAssignments: assignments
      });

      setOrderSuggestions(suggestions);
      setCurrentStep('grouping');
      
    } catch (error) {
      console.error('Error processing manual assignments:', error);
      alert('Error al procesar las asignaciones manuales');
    }
  };

  const handleManualAssignmentCancel = () => {
    setShowManualAssignment(false);
    setUnmatchedRemisiones([]);
    setManualAssignments(new Map());
    
    // Go back to the grouping step or allow user to continue with creating new orders
    setCurrentStep('grouping');
  };

  const handleFinalConfirmation = async () => {
    if (!orderSuggestions.length || !currentPlant) return;
    
    setLoading(true);
    
    try {
      // Use processed data if available, otherwise fall back to validated data
      // For final confirmation, we prioritize the processed data from state
      const finalRemisionesData = processedRemisiones.length > 0 ? processedRemisiones : (result?.validated || []);
      
      console.log('[ArkikProcessor] Final confirmation using:', {
        usingProcessedData: processedRemisiones.length > 0,
        totalRemisiones: finalRemisionesData.length,
        excludedRemisiones: finalRemisionesData.filter(r => r.is_excluded_from_import).length,
        processedDataLength: processedRemisiones.length,
        validatedDataLength: result?.validated?.length || 0,
        processingMode: processingMode
      });
      
      // Separate existing orders from new orders
      const existingOrderSuggestions = orderSuggestions.filter(s => s.is_existing_order);
      const newOrderSuggestions = orderSuggestions.filter(s => !s.is_existing_order);
      
      console.log('[ArkikProcessor] Order suggestions breakdown:', {
        total: orderSuggestions.length,
        existingOrders: existingOrderSuggestions.length,
        newOrders: newOrderSuggestions.length
      });
      
      let totalOrdersCreated = 0;
      let totalOrdersUpdated = 0;
      let totalRemisionesCreated = 0;
      let totalMaterialsProcessed = 0;
      let totalOrderItemsCreated = 0;
      
      // Handle existing orders (update them with new remisiones)
      if (existingOrderSuggestions.length > 0) {
        console.log('[ArkikProcessor] Updating existing orders...');
        
        const { ArkikOrderMatcher } = await import('@/services/arkikOrderMatcher');
        const matcher = new ArkikOrderMatcher(currentPlant!.id);
        
        for (const suggestion of existingOrderSuggestions) {
          const updateResult = await matcher.updateOrderWithRemisiones(
            suggestion.existing_order_id!,
            suggestion.remisiones
          );
          
          if (updateResult.success) {
            totalOrdersUpdated++;
            totalOrderItemsCreated += updateResult.updatedOrderItems?.length || 0;
            totalRemisionesCreated += suggestion.remisiones.length;
            // TODO: Add material processing count
          } else {
            console.error(`Failed to update order ${suggestion.existing_order_number}:`, updateResult.error);
          }
        }
      }
      
      // Handle new orders (create them)
      if (newOrderSuggestions.length > 0) {
        console.log('[ArkikProcessor] Creating new orders...');
        
        const { createOrdersFromSuggestions } = await import('@/services/arkikOrderCreator');
        
        const creationResult = await createOrdersFromSuggestions(
          newOrderSuggestions, 
          currentPlant.id, 
          finalRemisionesData
        );
        
        totalOrdersCreated = creationResult.ordersCreated;
        totalRemisionesCreated += creationResult.remisionesCreated;
        totalMaterialsProcessed = creationResult.materialsProcessed;
        totalOrderItemsCreated += creationResult.orderItemsCreated;
      }
      
      // Save pending reassignments after remisiones are created
      if (pendingReassignments.length > 0) {
        console.log(`🔄 Now saving ${pendingReassignments.length} cached reassignments to database`);
        const { arkikStatusService } = await import('@/services/arkikStatusStorage');
        await arkikStatusService.saveRemisionReassignments(pendingReassignments, crypto.randomUUID(), currentPlant.id);
        console.log(`✅ Saved ${pendingReassignments.length} reassignment records to database`);
        
        // Clear the cache
        setPendingReassignments([]);
      }
      
      // Show success message with detailed results
      const successMessage = [
        'Importación completada exitosamente!',
        '',
        'Resumen:',
        `• ${totalOrdersCreated} órdenes nuevas creadas`,
        `• ${totalOrdersUpdated} órdenes existentes actualizadas`,
        `• ${totalRemisionesCreated} remisiones procesadas`,
        `• ${totalMaterialsProcessed} registros de materiales`,
        `• ${totalOrderItemsCreated} items de orden creados/actualizados`
      ].join('\n');
      
      alert(successMessage);
      
      // Reset to validation step
      setCurrentStep('validation');
      setOrderSuggestions([]);
      setResult(null);
      setFile(null);
      setProcessedRemisiones([]);
      setPendingReassignments([]);
      setStatusProcessingDecisions([]);
      setStatusProcessingResult(null);
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
      
      // Debug: Log first few rows to verify date parsing after our fixes
      if (rawData.length > 0) {
        console.log('[ArkikProcessor] ✅ Date parsing verification after timezone fix - first 3 rows:');
        rawData.slice(0, 3).forEach((row, index) => {
          console.log(`[ArkikProcessor] Row ${index + 1}:`, {
            remision: row.remision,
            fecha: {
              value: row.fecha,
              type: typeof row.fecha,
              isDate: row.fecha instanceof Date,
              displayDate: row.fecha instanceof Date ? formatLocalDate(row.fecha) : 'Not a Date',
              localString: row.fecha instanceof Date ? row.fecha.toLocaleDateString() + ' ' + row.fecha.toLocaleTimeString() : 'Not a Date'
            },
            hora_carga: {
              value: row.hora_carga,
              type: typeof row.hora_carga,
              isDate: row.hora_carga instanceof Date,
              displayTime: row.hora_carga instanceof Date ? formatLocalTime(row.hora_carga) : 'Not a Date',
              localString: row.hora_carga instanceof Date ? row.hora_carga.toLocaleDateString() + ' ' + row.hora_carga.toLocaleTimeString() : 'Not a Date'
            }
          });
        });
      }
      
              // Convert to StagingRemision format
        const stagingRows = rawData.map((row, index) => ({
          id: crypto.randomUUID(),
          session_id: crypto.randomUUID(),
          row_number: index + 1,
          fecha: row.fecha, // Use date directly from parser (already properly handled)
          hora_carga: row.hora_carga, // Use date directly from parser (already properly handled)
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
          materials_retrabajo: Object.fromEntries(
            Object.entries(row.materials || {}).map(([code, values]: [string, any]) => [
              code, 
              values?.retrabajo || 0
            ])
          ),
          materials_manual: Object.fromEntries(
            Object.entries(row.materials || {}).map(([code, values]: [string, any]) => [
              code, 
              values?.manual || 0
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
              {/* Processing Mode Toggle */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="mb-3">
                  <h4 className="font-medium text-blue-900 mb-2">Modo de Procesamiento</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Selecciona cómo quieres procesar las remisiones de este archivo Arkik:
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      processingMode === 'dedicated' 
                        ? 'border-blue-500 bg-blue-100' 
                        : 'border-gray-300 bg-white hover:border-blue-300'
                    }`}
                    onClick={() => setProcessingMode('dedicated')}
                  >
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        checked={processingMode === 'dedicated'} 
                        onChange={() => setProcessingMode('dedicated')}
                        className="text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Obra Dedicada</div>
                        <div className="text-sm text-gray-600">Crear órdenes automáticamente para proyectos específicos</div>
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      processingMode === 'commercial' 
                        ? 'border-blue-500 bg-blue-100' 
                        : 'border-gray-300 bg-white hover:border-blue-300'
                    }`}
                    onClick={() => setProcessingMode('commercial')}
                  >
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        checked={processingMode === 'commercial'} 
                        onChange={() => setProcessingMode('commercial')}
                        className="text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Comercial</div>
                        <div className="text-sm text-gray-600">Vincular a órdenes existentes cuando sea posible</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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

              {/* Show cached reassignments info */}
              {pendingReassignments.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">
                      {pendingReassignments.length} reasignaciones en caché
                    </span>
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                    Se guardarán en la base de datos después de crear las remisiones
                  </div>
                </div>
              )}

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
                                  <div className="text-gray-600">{formatLocalDate(remision.fecha)}</div>
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
                                        <span>{formatLocalDate(candidate.fecha)} - {candidate.volumen_fabricado.toFixed(1)}m³</span>
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
                
                {/* Show "Continue to Grouping" only if no decisions were made at all */}
                {problemRemisiones.length === 0 && statusProcessingDecisions.length === 0 && (
                  <Button 
                    onClick={() => {
                      console.log('[ArkikProcessor] Direct grouping button clicked - no status processing needed');
                      handleOrderGrouping();
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
                  >
                    Continuar a Agrupación →
                  </Button>
                )}
                
                {/* Show "Apply Decisions" if there are any decisions made */}
                {statusProcessingDecisions.length > 0 && (
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
                      `Aplicar ${statusProcessingDecisions.length} Decisiones y Continuar →`
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
                           {suggestion.is_existing_order ? (
                             <div className="flex items-center gap-2">
                               <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                 Orden Existente: {suggestion.existing_order_number}
                               </Badge>
                               {suggestion.match_score && (
                                 <Badge variant="outline" className="text-green-700 border-green-300">
                                   Coincidencia: {(suggestion.match_score * 100).toFixed(0)}%
                                 </Badge>
                               )}
                             </div>
                           ) : suggestion.remisiones[0]?.orden_original ? (
                             <Badge variant="outline" className="text-gray-700">
                               Existente: {suggestion.remisiones[0].orden_original}
                             </Badge>
                           ) : (
                             <Badge variant="secondary" className="bg-green-100 text-green-800">
                               Nueva
                             </Badge>
                           )}
                         </div>
                         
                         {/* Show match reasons for existing orders */}
                         {suggestion.is_existing_order && suggestion.match_reasons && (
                           <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                             <div className="text-sm font-medium text-blue-900 mb-1">
                               Razones de coincidencia:
                             </div>
                             <div className="flex flex-wrap gap-1">
                               {suggestion.match_reasons.map((reason, idx) => (
                                 <Badge key={idx} variant="outline" className="text-xs text-blue-700 border-blue-300">
                                   {reason}
                                 </Badge>
                               ))}
                             </div>
                           </div>
                         )}
                         
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
                             <span className="font-medium">Fecha:</span> {formatLocalDate(suggestion.date_range?.start || new Date())}
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
                                   {formatLocalDate(remision.fecha)}
                                 </span>
                               </div>
                               <div className="flex justify-between">
                                 <span>Hora:</span>
                                 <span className="font-medium">
                                   {remision.hora_carga instanceof Date 
                                     ? formatLocalTime(remision.hora_carga).substring(0, 5) // HH:MM only
                                     : formatLocalTime(new Date(remision.hora_carga as any)).substring(0, 5)
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
                  <div className="text-2xl font-bold text-green-600">
                    {orderSuggestions.filter(s => !s.is_existing_order).length}
                  </div>
                  <div className="text-sm text-green-800">Órdenes Nuevas</div>
                </div>
                <div className="bg-cyan-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-cyan-600">
                    {orderSuggestions.filter(s => s.is_existing_order).length}
                  </div>
                  <div className="text-sm text-cyan-800">Órdenes Existentes</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.newClients}</div>
                  <div className="text-sm text-purple-800">Nuevos Clientes</div>
                </div>
              </div>
              
              {/* Show processing mode info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-gray-800">
                  <span className="font-medium">Modo de Procesamiento:</span>
                  <Badge variant="outline" className={
                    processingMode === 'commercial' 
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-green-100 text-green-800 border-green-300'
                  }>
                    {processingMode === 'commercial' ? 'Comercial' : 'Obra Dedicada'}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {processingMode === 'commercial' 
                    ? 'Las remisiones se vinculan a órdenes existentes cuando es posible'
                    : 'Se crean nuevas órdenes automáticamente'
                  }
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
                            <div>{formatLocalDate(row.fecha)}</div>
                            <div className="text-xs text-gray-500">
                              {row.hora_carga instanceof Date 
                                ? formatLocalTime(row.hora_carga)
                                : formatLocalTime(new Date(row.hora_carga as any))
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
                                      const realBase = Number(row.materials_real?.[materialCode] || 0);
                                      const retrabajo = Number(row.materials_retrabajo?.[materialCode] || 0);
                                      const manual = Number(row.materials_manual?.[materialCode] || 0);
                                      const ajuste = retrabajo + manual;
                                      const realFinal = realBase + ajuste;
                                      const variacion = teorico > 0 ? ((realFinal - teorico) / teorico) * 100 : 0;
                                      
                                      return (
                                        <div key={materialCode} className="border-l-2 border-green-200 pl-2">
                                          <div className="font-medium text-gray-800 mb-2">{materialCode}</div>
                                          
                                          {/* Main calculation breakdown */}
                                          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                            <div className="text-center bg-blue-50 p-1 rounded">
                                              <div className="text-blue-700 font-medium">Teórica</div>
                                              <div className="font-mono text-blue-900">{teorico.toFixed(2)}</div>
                                            </div>
                                            <div className="text-center bg-gray-50 p-1 rounded">
                                              <div className="text-gray-700 font-medium">Real Base</div>
                                              <div className="font-mono text-gray-900">{realBase.toFixed(2)}</div>
                                            </div>
                                            <div className="text-center bg-green-50 p-1 rounded">
                                              <div className="text-green-700 font-medium">Real Final</div>
                                              <div className="font-mono text-green-900 font-bold">{realFinal.toFixed(2)}</div>
                                            </div>
                                          </div>
                                          
                                          {/* Adjustment breakdown (only show if there are adjustments) */}
                                          {ajuste > 0 && (
                                            <div className="bg-amber-50 p-2 rounded mb-2">
                                              <div className="text-xs text-amber-800 font-medium mb-1">Ajustes:</div>
                                              <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="text-center">
                                                  <div className="text-amber-700">Retrabajo</div>
                                                  <div className="font-mono text-amber-900">{retrabajo.toFixed(2)}</div>
                                                </div>
                                                <div className="text-center">
                                                  <div className="text-amber-700">Manual</div>
                                                  <div className="font-mono text-amber-900">{manual.toFixed(2)}</div>
                                                </div>
                                                <div className="text-center bg-amber-100 p-1 rounded">
                                                  <div className="text-amber-800 font-medium">Total Ajuste</div>
                                                  <div className="font-mono text-amber-900 font-bold">{ajuste.toFixed(2)}</div>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Final calculation */}
                                          <div className="bg-blue-50 p-2 rounded">
                                            <div className="text-xs text-blue-800 mb-1">
                                              <span className="font-medium">Cálculo Final:</span> {realBase.toFixed(2)} + {ajuste.toFixed(2)} = {realFinal.toFixed(2)}
                                            </div>
                                            <div className="text-center text-xs">
                                              <span className="text-blue-700 font-medium">Variación vs Teórica: </span>
                                              <span className={`font-bold ${Math.abs(variacion) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                                                {variacion > 0 ? '+' : ''}{variacion.toFixed(1)}%
                                              </span>
                                            </div>
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



