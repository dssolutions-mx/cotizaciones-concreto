import { StatusProcessingResult, WasteMaterial, RemisionReassignment } from '@/types/arkik';
import { supabase } from '@/lib/supabase/client';

export const arkikStatusService = {

  /**
   * Save waste materials to database
   */
  async saveWasteMaterials(wasteMaterials: WasteMaterial[]): Promise<void> {
    if (wasteMaterials.length === 0) return;

    try {
      const { error } = await supabase
        .from('waste_materials')
        .insert(wasteMaterials.map(waste => ({
          id: waste.id,
          session_id: waste.session_id,
          remision_number: waste.remision_number,
          material_code: waste.material_code,
          material_name: waste.material_name,
          theoretical_amount: waste.theoretical_amount,
          actual_amount: waste.actual_amount,
          waste_amount: waste.waste_amount,
          waste_reason: waste.waste_reason,
          plant_id: waste.plant_id,
          fecha: waste.fecha.toISOString().split('T')[0]
        })));

      if (error) throw error;
      
      console.log(`✅ Saved ${wasteMaterials.length} waste material records to database`);
    } catch (error) {
      console.error('Failed to save waste materials:', error);
      throw new Error(`Failed to save waste materials: ${error}`);
    }
  },

  /**
   * Save remision reassignments to database (without applying material transfers yet)
   * Material transfers will be applied later after orders are created
   */
  async saveRemisionReassignments(reassignments: RemisionReassignment[], sessionId: string, plantId: string): Promise<void> {
    if (reassignments.length === 0) return;

    try {
      // For fresh imports, we don't need to check for duplicates since this is a new session
      // The duplicate check was preventing all reassignments from being saved
      const { error } = await supabase
        .from('remision_reassignments')
        .insert(reassignments.map(reassignment => ({
          session_id: sessionId,
          source_remision_id: reassignment.source_remision_id,
          source_remision_number: reassignment.source_remision_number,
          target_remision_id: reassignment.target_remision_id,
          target_remision_number: reassignment.target_remision_number,
          materials_transferred: reassignment.materials_to_transfer,
          reason: reassignment.reason,
          plant_id: plantId
        })));

      if (error) throw error;

      console.log(`✅ Saved ${reassignments.length} reassignment records to database`);
    } catch (error) {
      console.error('Failed to save reassignments:', error);
      throw new Error(`Failed to save reassignments: ${error}`);
    }
  },

  /**
   * Apply pending material transfers AFTER orders have been created
   * This function should be called after order creation to ensure remisiones exist in the database
   */
  async applyPendingMaterialTransfers(plantId: string, sessionId: string): Promise<void> {
    try {
      console.log(`[ArkikStatusService] Applying pending material transfers for plant ${plantId}, session ${sessionId}`);
      
      // Get all reassignments for this session
      const { data: pendingReassignments, error: fetchError } = await supabase
        .from('remision_reassignments')
        .select('*')
        .eq('plant_id', plantId)
        .eq('session_id', sessionId);

      if (fetchError) {
        console.error('[ArkikStatusService] Error fetching pending reassignments:', fetchError);
        return;
      }

      console.log(`[ArkikStatusService] Found ${pendingReassignments?.length || 0} reassignments to process`);

      if (!pendingReassignments || pendingReassignments.length === 0) {
        console.log('[ArkikStatusService] No reassignments found for this session');
        return;
      }

      // Apply material transfers for each reassignment
      for (const reassignment of pendingReassignments) {
        try {
          console.log(`[ArkikStatusService] Processing reassignment: ${reassignment.source_remision_number} → ${reassignment.target_remision_number}`);

          // Check if target remision exists in database
          const { data: targetRemision, error: targetError } = await supabase
            .from('remisiones')
            .select('id')
            .eq('remision_number', reassignment.target_remision_number)
            .eq('plant_id', plantId)
            .single();

          if (targetError || !targetRemision) {
            console.log(`[ArkikStatusService] Target remision ${reassignment.target_remision_number} not found - skipping transfer`);
            continue;
          }

          // Get material mapping for plant
          const materialCodes = Object.keys(reassignment.materials_transferred);
          if (materialCodes.length === 0) {
            console.log(`[ArkikStatusService] No materials to transfer for reassignment ${reassignment.source_remision_number} → ${reassignment.target_remision_number}`);
            continue;
          }

          console.log(`[ArkikStatusService] Transferring ${materialCodes.length} materials from ${reassignment.source_remision_number} to ${reassignment.target_remision_number}`);

          const { data: materials, error: materialsError } = await supabase
            .from('materials')
            .select('id, material_code, material_name')
            .eq('plant_id', plantId)
            .in('material_code', materialCodes);

          if (materialsError) {
            console.error(`[ArkikStatusService] Error fetching materials:`, materialsError);
            continue;
          }

          const materialMap = new Map(materials?.map(m => [m.material_code, { id: m.id, name: m.material_name }]) || []);

          // Process each material transfer
          for (const [materialCode, transferAmount] of Object.entries(reassignment.materials_transferred)) {
            const materialInfo = materialMap.get(materialCode);
            if (!materialInfo) {
              console.warn(`[ArkikStatusService] Material code ${materialCode} not found in materials table`);
              continue;
            }

            // Check if material record exists for this remision
            const { data: existingMaterial, error: existingError } = await supabase
              .from('remision_materiales')
              .select('cantidad_real, cantidad_teorica, ajuste')
              .eq('remision_id', targetRemision.id)
              .eq('material_id', materialInfo.id)
              .maybeSingle();

            if (existingError) {
              console.error(`[ArkikStatusService] Error checking existing material:`, existingError);
              continue;
            }

            if (existingMaterial) {
              // Update existing material record by adding transferred amount
              const newCantidadReal = (existingMaterial.cantidad_real || 0) + Number(transferAmount);
              const newAjuste = (existingMaterial.ajuste || 0) + Number(transferAmount);
              
              const { error: updateError } = await supabase
                .from('remision_materiales')
                .update({
                  cantidad_real: newCantidadReal,
                  ajuste: newAjuste
                })
                .eq('remision_id', targetRemision.id)
                .eq('material_id', materialInfo.id);

              if (updateError) {
                console.error(`[ArkikStatusService] Error updating material ${materialCode}:`, updateError);
              } else {
                console.log(`[ArkikStatusService] ✅ Updated material ${materialCode}: +${transferAmount} (new total: ${newCantidadReal})`);
              }
            } else {
              // Create new material record with transferred amount
              const { error: insertError } = await supabase
                .from('remision_materiales')
                .insert({
                  remision_id: targetRemision.id,
                  material_id: materialInfo.id,
                  material_type: materialInfo.name,
                  cantidad_real: Number(transferAmount),
                  cantidad_teorica: 0,
                  ajuste: Number(transferAmount) // Mark as adjustment since it's transferred
                });

              if (insertError) {
                console.error(`[ArkikStatusService] Error inserting material ${materialCode}:`, insertError);
              } else {
                console.log(`[ArkikStatusService] ✅ Created material record ${materialCode}: ${transferAmount}`);
              }
            }
          }

          console.log(`[ArkikStatusService] ✅ Completed reassignment ${reassignment.source_remision_number} → ${reassignment.target_remision_number}`);

        } catch (error) {
          console.error(`[ArkikStatusService] Error processing reassignment:`, error);
        }
      }

      console.log(`[ArkikStatusService] ✅ Completed material transfers for session ${sessionId}`);
    } catch (error) {
      console.error('[ArkikStatusService] Error in applyPendingMaterialTransfers:', error);
      throw new Error(`Failed to apply pending material transfers: ${error}`);
    }
  },

  /**
   * Apply material transfers to existing remisiones in the database
   */
  async applyMaterialTransfers(reassignments: RemisionReassignment[], plantId: string): Promise<void> {
    if (reassignments.length === 0) return;

    console.log(`[ArkikStatusService] Applying material transfers for ${reassignments.length} reassignments`);

    for (const reassignment of reassignments) {
      try {
        // Check if target remision exists in database
        const { data: targetRemision, error: targetError } = await supabase
          .from('remisiones')
          .select('id')
          .eq('remision_number', reassignment.target_remision_number)
          .eq('plant_id', plantId)
          .single();

        if (targetError || !targetRemision) {
          console.log(`[ArkikStatusService] Target remision ${reassignment.target_remision_number} not found in database - materials will be created during order creation with transferred amounts already included`);
          continue;
        }



        // Get material mapping for plant
        const materialCodes = Object.keys(reassignment.materials_to_transfer);
        const { data: materials, error: materialsError } = await supabase
          .from('materials')
          .select('id, material_code, material_name')
          .eq('plant_id', plantId)
          .in('material_code', materialCodes);

        if (materialsError) {
          console.error(`[ArkikStatusService] Error fetching materials for plant ${plantId}:`, materialsError);
          continue;
        }

        const materialMap = new Map(materials?.map(m => [m.material_code, { id: m.id, name: m.material_name }]) || []);

        // Process each material transfer
        for (const [materialCode, transferAmount] of Object.entries(reassignment.materials_to_transfer)) {
          const materialInfo = materialMap.get(materialCode);
          if (!materialInfo) {
            console.warn(`[ArkikStatusService] Material code ${materialCode} not found in materials table for plant ${plantId}`);
            continue;
          }

          // Check if material record exists for this remision
          const { data: existingMaterial, error: existingError } = await supabase
            .from('remision_materiales')
            .select('cantidad_real, cantidad_teorica, ajuste')
            .eq('remision_id', targetRemision.id)
            .eq('material_id', materialInfo.id)
            .single();

          if (existingError && existingError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error(`[ArkikStatusService] Error checking existing material:`, existingError);
            continue;
          }

          if (existingMaterial) {
            // Update existing material record
            const newCantidadReal = (existingMaterial.cantidad_real || 0) + transferAmount;
            
            const { error: updateError } = await supabase
              .from('remision_materiales')
              .update({
                cantidad_real: newCantidadReal
              })
              .eq('remision_id', targetRemision.id)
              .eq('material_id', materialInfo.id);

            if (updateError) {
              console.error(`[ArkikStatusService] Error updating material ${materialCode}:`, updateError);
            } else {
              console.log(`[ArkikStatusService] ✅ Updated material ${materialCode} for remision ${reassignment.target_remision_number}: +${transferAmount} (new total: ${newCantidadReal})`);
            }
          } else {
            // Create new material record with transferred amount
            const { error: insertError } = await supabase
              .from('remision_materiales')
              .insert({
                remision_id: targetRemision.id,
                material_id: materialInfo.id,
                material_type: materialInfo.name,
                cantidad_real: transferAmount,
                cantidad_teorica: 0, // No theoretical amount from transfer
                ajuste: transferAmount // Mark as adjustment since it's transferred
              });

            if (insertError) {
              console.error(`[ArkikStatusService] Error inserting material ${materialCode}:`, insertError);
            } else {
              console.log(`[ArkikStatusService] ✅ Created new material record ${materialCode} for remision ${reassignment.target_remision_number}: ${transferAmount}`);
            }
          }
        }

        console.log(`[ArkikStatusService] ✅ Applied material transfers to remision ${reassignment.target_remision_number}`);

      } catch (error) {
        console.error(`[ArkikStatusService] Error applying material transfer for reassignment ${reassignment.source_remision_number} → ${reassignment.target_remision_number}:`, error);
        // Continue with other reassignments rather than failing completely
      }
    }

    console.log(`[ArkikStatusService] ✅ Completed applying material transfers for ${reassignments.length} reassignments`);
  },

  /**
   * Save import session information
   */
  async saveImportSession(sessionData: {
    sessionId: string;
    plantId: string;
    fileName: string;
    fileSize?: number;
    result: StatusProcessingResult;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('arkik_import_sessions')
        .upsert({
          id: sessionData.sessionId,
          plant_id: sessionData.plantId,
          file_name: sessionData.fileName,
          file_size: sessionData.fileSize,
          total_rows: sessionData.result.total_remisiones,
          processed_rows: sessionData.result.processed_remisiones,
          // Map to correct database schema fields
          status_processing_enabled: true,
          normal_remisiones: sessionData.result.normal_remisiones,
          reassigned_remisiones: sessionData.result.reassigned_remisiones,
          waste_remisiones: sessionData.result.waste_remisiones,
          // excluded_remisiones column doesn't exist in the actual database schema
          processing_status: 'status_processing' // Valid status value - status processing completed
        });

      if (error) throw error;
      
      console.log(`✅ Saved import session data for ${sessionData.sessionId}`);
    } catch (error) {
      console.error('Failed to save import session:', error);
      throw new Error(`Failed to save import session: ${error}`);
    }
  },

  /**
   * Get waste materials summary for a plant
   */
  async getWasteMaterialsSummary(plantId: string, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('waste_materials')
        .select('material_code, waste_amount, waste_reason, fecha')
        .eq('plant_id', plantId)
        .gte('fecha', startDate.toISOString().split('T')[0])
        .lte('fecha', endDate.toISOString().split('T')[0])
        .order('fecha', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Failed to get waste materials summary:', error);
      throw new Error(`Failed to get waste materials summary: ${error}`);
    }
  },

  /**
   * Get reassignment history for analysis
   */
  async getReassignmentHistory(plantId: string, limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('remision_reassignments')
        .select('source_remision_number, target_remision_number, materials_transferred, reason, created_at')
        .eq('plant_id', plantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Failed to get reassignment history:', error);
      throw new Error(`Failed to get reassignment history: ${error}`);
    }
  }
};
