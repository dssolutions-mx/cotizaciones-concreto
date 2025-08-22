import { supabase } from '@/lib/supabase/client';
import { 
  StagingRemision, 
  DuplicateRemisionInfo, 
  DuplicateHandlingStrategy, 
  DuplicateHandlingDecision,
  DuplicateHandlingResult 
} from '@/types/arkik';

export class ArkikDuplicateHandler {
  private plantId: string;
  tableCheckCache: Map<string, boolean>;

  constructor(plantId: string) {
    this.plantId = plantId;
    this.tableCheckCache = new Map();
    console.log(`[ArkikDuplicateHandler] Initialized with plant ID: ${plantId}`);
  }

  /**
   * Detect and analyze duplicate remisiones in the uploaded file
   */
  async detectDuplicates(
    stagingRemisiones: StagingRemision[]
  ): Promise<DuplicateRemisionInfo[]> {
    const remisionNumbers = stagingRemisiones.map(r => r.remision_number);
    
    console.log('[ArkikDuplicateHandler] detectDuplicates called with:', {
      totalRemisiones: stagingRemisiones.length,
      sampleRemisionNumbers: remisionNumbers.slice(0, 5),
      allRemisionNumbers: remisionNumbers
    });
    
    if (remisionNumbers.length === 0) {
      console.log('[ArkikDuplicateHandler] No remision numbers to check');
      return [];
    }

    try {
      console.log(`[ArkikDuplicateHandler] Checking for duplicates among ${remisionNumbers.length} remision numbers`);
      
      // First, check if remisiones table exists and get existing remisiones
      let existingRemisiones: any[] = [];
      try {
        console.log(`[ArkikDuplicateHandler] Querying remisiones table for plant ${this.plantId}`);
        console.log(`[ArkikDuplicateHandler] Looking for remision numbers:`, remisionNumbers.slice(0, 5), '...');
        
        const { data, error } = await supabase
          .from('remisiones')
          .select(`
            id,
            remision_number,
            fecha,
            volumen_fabricado,
            recipe_id,
            order_id,
            plant_id
          `)
          .eq('plant_id', this.plantId)
          .in('remision_number', remisionNumbers);

        if (error) {
          console.error('[ArkikDuplicateHandler] Error fetching existing remisiones:', error);
          return [];
        }
        
        console.log(`[ArkikDuplicateHandler] Query successful, got ${data?.length || 0} results`);
        existingRemisiones = data || [];
        
        // Debug: Show first few results
        if (existingRemisiones.length > 0) {
          console.log('[ArkikDuplicateHandler] First few existing remisiones:', 
            existingRemisiones.slice(0, 3).map(r => ({
              id: r.id,
              remision_number: r.remision_number,
              plant_id: r.plant_id
            }))
          );
        }
      } catch (error) {
        console.error('[ArkikDuplicateHandler] Table remisiones not accessible:', error);
        return [];
      }

      if (existingRemisiones.length === 0) {
        console.log('[ArkikDuplicateHandler] No existing remisiones found - no duplicates');
        
        // Debug: Let's check if there are ANY remisiones in the database for this plant
        try {
          const { data: anyRemisiones, error: anyError } = await supabase
            .from('remisiones')
            .select('id, remision_number, plant_id')
            .eq('plant_id', this.plantId)
            .limit(5);
          
          if (anyError) {
            console.error('[ArkikDuplicateHandler] Error checking for any remisiones:', anyError);
          } else {
            console.log(`[ArkikDuplicateHandler] Total remisiones in database for plant ${this.plantId}:`, anyRemisiones?.length || 0);
            if (anyRemisiones && anyRemisiones.length > 0) {
              console.log('[ArkikDuplicateHandler] Sample remisiones in database:', 
                anyRemisiones.map(r => ({ id: r.id, remision_number: r.remision_number, plant_id: r.plant_id }))
              );
            }
          }
        } catch (debugError) {
          console.warn('[ArkikDuplicateHandler] Could not check for any remisiones:', debugError);
        }
        
        return [];
      }

      console.log(`[ArkikDuplicateHandler] Found ${existingRemisiones.length} existing remisiones`);

      // Get order information for existing remisiones
      const orderIds = existingRemisiones.map(r => r.order_id).filter(Boolean);
      let orderNumbers: Map<string, string> = new Map();
      let orderClientIds: Map<string, string> = new Map();
      let orderSiteIds: Map<string, string> = new Map();
      
      if (orderIds.length > 0) {
        try {
          const { data: orders } = await supabase
            .from('orders')
            .select('id, order_number, client_id, construction_site_id')
            .in('id', orderIds);
          
          if (orders) {
            orders.forEach(order => {
              orderNumbers.set(order.id, order.order_number);
              if (order.client_id) orderClientIds.set(order.id, order.client_id);
              if (order.construction_site_id) orderSiteIds.set(order.id, order.construction_site_id);
            });
          }
        } catch (error) {
          console.warn('[ArkikDuplicateHandler] Could not fetch order information:', error);
        }
      }

      // Discover available auxiliary tables once to avoid 404 spam
      const materialsTable = await this.findFirstExistingTable([
        'remision_materiales',
        'remision_materials',
        'remision_material',
        'materials_remision'
      ]);

      // Disable status processing lookups to avoid 404s on non-existent tables
      const statusProcessingTable = null;

      const reassignmentsTable = await this.findFirstExistingTable([
        'remision_reassignments',
        'remision_reassignment',
        'reassignments',
        'remision_transfers'
      ]);

      const wasteMaterialsTable = await this.findFirstExistingTable([
        'waste_materials',
        'waste_material',
        'materials_waste',
        'remision_waste'
      ]);

      // Check for materials data - use the first table that exists
      const remisionIds = existingRemisiones.map(r => r.id);
      const remisionNumbersAll = existingRemisiones.map(r => r.remision_number);
      let materialsData: any[] = [];
      
      if (materialsTable) {
        try {
          materialsData = await this.fetchDataInChunks(
            materialsTable,
            'remision_id',
            remisionIds,
            'remision_id, material_type, cantidad_real, cantidad_teorica, ajuste'
          );
          console.log(`[ArkikDuplicateHandler] Found materials data in ${materialsTable}: ${materialsData.length} records`);
        } catch (error) {
          console.warn(`[ArkikDuplicateHandler] Could not fetch materials from ${materialsTable}:`, error);
        }
      } else {
        console.log('[ArkikDuplicateHandler] No materials table found; skipping materials fetch');
      }

      // Check for status processing decisions - try different possible table names
      let statusDecisions: any[] = [];
      if (statusProcessingTable) {
        try {
          statusDecisions = await this.fetchDataInChunks(
            statusProcessingTable,
            'remision_id',
            remisionIds,
            'remision_id, action, target_remision_number, waste_reason',
            30
          );
          console.log(`[ArkikDuplicateHandler] Found status decisions in ${statusProcessingTable}: ${statusDecisions.length} records`);
        } catch (error) {
          console.warn(`[ArkikDuplicateHandler] Could not fetch status decisions from ${statusProcessingTable}:`, error);
        }
      } else {
        console.log('[ArkikDuplicateHandler] No status processing table found; skipping status decisions');
      }

      // Check for reassignments - try different possible table names
      let reassignments: any[] = [];
      if (reassignmentsTable) {
        try {
          const sourceReassign = await this.fetchDataInChunks(
            reassignmentsTable,
            'source_remision_id',
            remisionIds,
            'source_remision_id, target_remision_id, reason, materials_transferred'
          );
          const targetReassign = await this.fetchDataInChunks(
            reassignmentsTable,
            'target_remision_id',
            remisionIds,
            'source_remision_id, target_remision_id, reason, materials_transferred'
          );
          const allReassignments = [...(sourceReassign || []), ...(targetReassign || [])];
          reassignments = allReassignments.filter((item, index, self) => 
            index === self.findIndex(t => t.source_remision_id === item.source_remision_id && 
                                         t.target_remision_id === item.target_remision_id)
          );
          console.log(`[ArkikDuplicateHandler] Found reassignments in ${reassignmentsTable}: ${reassignments.length} records`);
        } catch (error) {
          console.warn(`[ArkikDuplicateHandler] Could not fetch reassignments from ${reassignmentsTable}:`, error);
        }
      } else {
        console.log('[ArkikDuplicateHandler] No reassignments table found; skipping reassignments');
      }

      // Check for waste materials - try different possible table names
      let wasteMaterials: any[] = [];
      if (wasteMaterialsTable) {
        try {
          wasteMaterials = await this.fetchDataInChunks(
            wasteMaterialsTable,
            'remision_number',
            remisionNumbersAll,
            'remision_number, plant_id, material_code, material_name, theoretical_amount, actual_amount, waste_amount, waste_reason, fecha'
          );
          console.log(`[ArkikDuplicateHandler] Found waste materials in ${wasteMaterialsTable}: ${wasteMaterials.length} records`);
        } catch (error) {
          console.warn(`[ArkikDuplicateHandler] Could not fetch waste materials from ${wasteMaterialsTable}:`, error);
        }
      } else {
        console.log('[ArkikDuplicateHandler] No waste materials table found; skipping waste lookup');
      }

      // Build duplicate info
      const duplicates: DuplicateRemisionInfo[] = [];
      
      for (const existing of existingRemisiones) {
        const stagingRemision = stagingRemisiones.find(r => r.remision_number === existing.remision_number);
        if (!stagingRemision) continue;

        const hasMaterials = materialsData.some(m => m.remision_id === existing.id);
        const hasStatusDecisions = statusDecisions.some(s => s.remision_id === existing.id);
        const hasReassignments = reassignments.some(r => 
          r.source_remision_id === existing.id || r.target_remision_id === existing.id
        );
        const hasWasteMaterials = wasteMaterials.some(w =>
          w.remision_number === existing.remision_number &&
          w.plant_id === existing.plant_id
        );

        // Analyze differences
        const volumeChanged = Math.abs(existing.volumen_fabricado - stagingRemision.volumen_fabricado) > 0.01;
        const dateChanged = existing.fecha !== stagingRemision.fecha.toISOString().split('T')[0];
        
        // Check if materials are missing in existing data
        const materialsMissing = !hasMaterials && (
          Object.keys(stagingRemision.materials_teorico).length > 0 ||
          Object.keys(stagingRemision.materials_real).length > 0
        );

        // Determine risk level and suggested strategy
        const { riskLevel, suggestedStrategy, notes } = this.analyzeRiskAndStrategy({
          hasMaterials,
          hasStatusDecisions,
          hasReassignments,
          hasWasteMaterials,
          volumeChanged,
          dateChanged,
          materialsMissing
        });

        duplicates.push({
          remision_number: existing.remision_number,
          existing_remision_id: existing.id,
          existing_order_id: existing.order_id,
          existing_order_number: orderNumbers.get(existing.order_id) || 'Unknown',
          existing_data: {
            fecha: existing.fecha,
            volumen_fabricado: existing.volumen_fabricado,
            client_id: existing.order_id ? orderClientIds.get(existing.order_id) : undefined,
            construction_site_id: existing.order_id ? orderSiteIds.get(existing.order_id) : undefined,
            recipe_id: existing.recipe_id,
            has_materials: hasMaterials,
            has_status_decisions: hasStatusDecisions,
            has_reassignments: hasReassignments,
            has_waste_materials: hasWasteMaterials,
            status: 'active'
          },
          new_data: {
            fecha: stagingRemision.fecha,
            volumen_fabricado: stagingRemision.volumen_fabricado,
            materials_teorico: stagingRemision.materials_teorico,
            materials_real: stagingRemision.materials_real,
            materials_retrabajo: stagingRemision.materials_retrabajo || {},
            materials_manual: stagingRemision.materials_manual || {}
          },
          differences: {
            volume_changed: volumeChanged,
            materials_changed: false, // Will be determined during processing
            date_changed: dateChanged,
            materials_missing: materialsMissing
          },
          suggested_strategy: suggestedStrategy,
          risk_level: riskLevel,
          notes
        });
      }

      console.log(`[ArkikDuplicateHandler] Analysis complete: ${duplicates.length} duplicates found`);
      return duplicates;
    } catch (error) {
      console.error('[ArkikDuplicateHandler] Error detecting duplicates:', error);
      return [];
    }
  }

  /**
   * Analyze risk level and suggest handling strategy
   */
  private analyzeRiskAndStrategy(data: {
    hasMaterials: boolean;
    hasStatusDecisions: boolean;
    hasReassignments: boolean;
    hasWasteMaterials: boolean;
    volumeChanged: boolean;
    dateChanged: boolean;
    materialsMissing: boolean;
  }): {
    riskLevel: 'low' | 'medium' | 'high';
    suggestedStrategy: DuplicateHandlingStrategy;
    notes: string[];
  } {
    const notes: string[] = [];
    let riskScore = 0;

    // Assess risk factors
    if (data.hasStatusDecisions) {
      riskScore += 3;
      notes.push('⚠️ Tiene decisiones de procesamiento de estado');
    }
    
    if (data.hasReassignments) {
      riskScore += 3;
      notes.push('⚠️ Tiene reasignaciones activas');
    }
    
    if (data.hasWasteMaterials) {
      riskScore += 2;
      notes.push('⚠️ Tiene materiales marcados como desperdicio');
    }
    
    if (data.volumeChanged) {
      riskScore += 2;
      notes.push('⚠️ El volumen ha cambiado');
    }
    
    if (data.dateChanged) {
      riskScore += 1;
      notes.push('ℹ️ La fecha ha cambiado');
    }
    
    if (data.materialsMissing) {
      riskScore += 1;
      notes.push('ℹ️ Faltan datos de materiales');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore <= 2) {
      riskLevel = 'low';
    } else if (riskScore <= 5) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    // Suggest strategy based on risk and data state
    let suggestedStrategy: DuplicateHandlingStrategy;
    
    if (data.materialsMissing && !data.hasStatusDecisions && !data.hasReassignments && !data.hasWasteMaterials) {
      suggestedStrategy = DuplicateHandlingStrategy.UPDATE_MATERIALS_ONLY;
      notes.push('💡 Sugerencia: Actualizar solo materiales (bajo riesgo)');
    } else if (riskLevel === 'high') {
      suggestedStrategy = DuplicateHandlingStrategy.SKIP;
      notes.push('🚨 Sugerencia: Omitir (alto riesgo de pérdida de datos)');
    } else if (riskLevel === 'medium') {
      suggestedStrategy = DuplicateHandlingStrategy.MERGE;
      notes.push('⚠️ Sugerencia: Combinar datos (riesgo medio)');
    } else {
      suggestedStrategy = DuplicateHandlingStrategy.UPDATE_MATERIALS_ONLY;
      notes.push('✅ Sugerencia: Actualizar solo materiales (bajo riesgo)');
    }

    return { riskLevel, suggestedStrategy, notes };
  }

  /**
   * Apply duplicate handling decisions to staging data
   */
  applyDuplicateDecisions(
    stagingRemisiones: StagingRemision[],
    decisions: DuplicateHandlingDecision[],
    duplicates: DuplicateRemisionInfo[]
  ): {
    processedRemisiones: StagingRemision[];
    skippedRemisiones: StagingRemision[];
    updatedRemisiones: StagingRemision[];
    result: DuplicateHandlingResult;
  } {
    const processedRemisiones: StagingRemision[] = [];
    const skippedRemisiones: StagingRemision[] = [];
    const updatedRemisiones: StagingRemision[] = [];

    let updatedMaterials = 0;
    let updatedAll = 0;
    let merged = 0;
    let skipped = 0;

    for (const remision of stagingRemisiones) {
      const decision = decisions.find(d => d.remision_number === remision.remision_number);
      const duplicateInfo = duplicates.find(d => d.remision_number === remision.remision_number);

      if (!decision || !duplicateInfo) {
        // No duplicate, process normally
        processedRemisiones.push(remision);
        continue;
      }

      switch (decision.strategy) {
        case DuplicateHandlingStrategy.SKIP:
          skippedRemisiones.push(remision);
          skipped++;
          break;

        case DuplicateHandlingStrategy.UPDATE_MATERIALS_ONLY:
          // Mark for materials-only update
          const materialsUpdateRemision = {
            ...remision,
            is_duplicate_update: true,
            duplicate_strategy: 'materials_only' as const,
            existing_remision_id: duplicateInfo.existing_remision_id,
            preserve_existing_data: true
          };
          updatedRemisiones.push(materialsUpdateRemision);
          updatedMaterials++;
          break;

        case DuplicateHandlingStrategy.UPDATE_ALL:
          // Mark for full update
          const fullUpdateRemision = {
            ...remision,
            is_duplicate_update: true,
            duplicate_strategy: 'update_all' as const,
            existing_remision_id: duplicateInfo.existing_remision_id,
            preserve_existing_data: false
          };
          updatedRemisiones.push(fullUpdateRemision);
          updatedAll++;
          break;

        case DuplicateHandlingStrategy.MERGE:
          // Mark for intelligent merge
          const mergeRemision = {
            ...remision,
            is_duplicate_update: true,
            duplicate_strategy: 'merge' as const,
            existing_remision_id: duplicateInfo.existing_remision_id,
            preserve_existing_data: true
          };
          updatedRemisiones.push(mergeRemision);
          merged++;
          break;

        default:
          // Default to skip
          skippedRemisiones.push(remision);
          skipped++;
      }
    }

    const result: DuplicateHandlingResult = {
      total_duplicates: duplicates.length,
      processed_duplicates: decisions.length,
      skipped_duplicates: skipped,
      updated_materials: updatedMaterials,
      updated_all: updatedAll,
      merged,
      decisions,
      summary: {
        low_risk: duplicates.filter(d => d.risk_level === 'low').length,
        medium_risk: duplicates.filter(d => d.risk_level === 'medium').length,
        high_risk: duplicates.filter(d => d.risk_level === 'high').length,
        materials_only_updates: updatedMaterials,
        full_updates: updatedAll,
        skipped
      }
    };

    return {
      processedRemisiones,
      skippedRemisiones,
      updatedRemisiones,
      result
    };
  }



  /**
   * Get summary statistics for duplicate handling
   */
  getDuplicateSummary(duplicates: DuplicateRemisionInfo[]): {
    total: number;
    byRiskLevel: Record<string, number>;
    byStrategy: Record<string, number>;
    materialsMissing: number;
    hasStatusDecisions: number;
    hasReassignments: number;
  } {
    const byRiskLevel = {
      low: duplicates.filter(d => d.risk_level === 'low').length,
      medium: duplicates.filter(d => d.risk_level === 'medium').length,
      high: duplicates.filter(d => d.risk_level === 'high').length
    };

    const byStrategy = {
      skip: duplicates.filter(d => d.suggested_strategy === DuplicateHandlingStrategy.SKIP).length,
      materials_only: duplicates.filter(d => d.suggested_strategy === DuplicateHandlingStrategy.UPDATE_MATERIALS_ONLY).length,
      update_all: duplicates.filter(d => d.suggested_strategy === DuplicateHandlingStrategy.UPDATE_ALL).length,
      merge: duplicates.filter(d => d.suggested_strategy === DuplicateHandlingStrategy.MERGE).length
    };

    return {
      total: duplicates.length,
      byRiskLevel,
      byStrategy,
      materialsMissing: duplicates.filter(d => d.differences.materials_missing).length,
      hasStatusDecisions: duplicates.filter(d => d.existing_data.has_status_decisions).length,
      hasReassignments: duplicates.filter(d => d.existing_data.has_reassignments).length
    };
  }
}

// Helper methods
// Note: Kept within the same file for cohesion with ArkikDuplicateHandler
export interface ChunkFetchOptions {
  chunkSize?: number;
}

// Extending the class with a private helper method
declare module './arkikDuplicateHandler' {}

// Re-open class to add method (keeps edits minimal while ensuring placement before export end)
export interface ArkikDuplicateHandler {
  fetchDataInChunks(
    tableName: string,
    columnName: string,
    ids: string[],
    selectColumns: string,
    chunkSize?: number
  ): Promise<any[]>;
  findFirstExistingTable(candidateTables: string[]): Promise<string | null>;
}

ArkikDuplicateHandler.prototype.fetchDataInChunks = async function (
  this: ArkikDuplicateHandler,
  tableName: string,
  columnName: string,
  ids: string[],
  selectColumns: string,
  chunkSize: number = 100
): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select(selectColumns)
        .in(columnName, chunk);
      if (error) {
        console.warn(`[ArkikDuplicateHandler] Error fetching chunk ${i / chunkSize + 1}:`, error);
        continue;
      }
      if (data) results.push(...data);
    } catch (err) {
      console.warn(`[ArkikDuplicateHandler] Exception fetching chunk ${i / chunkSize + 1}:`, err);
      continue;
    }
  }
  return results;
};

ArkikDuplicateHandler.prototype.findFirstExistingTable = async function (
  this: ArkikDuplicateHandler,
  candidateTables: string[]
): Promise<string | null> {
  for (const tableName of candidateTables) {
    if (this.tableCheckCache.has(tableName)) {
      if (this.tableCheckCache.get(tableName)) return tableName;
      continue;
    }
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*', { head: true, count: 'exact' })
        .limit(1);
      if (!error) {
        this.tableCheckCache.set(tableName, true);
        return tableName;
      }
      // Any error means we treat as non-existent/inaccessible to avoid spam
      this.tableCheckCache.set(tableName, false);
      continue;
    } catch (err) {
      // Treat errors as non-existent to prevent repeated failing calls
      this.tableCheckCache.set(tableName, false);
      continue;
    }
  }
  return null;
};
