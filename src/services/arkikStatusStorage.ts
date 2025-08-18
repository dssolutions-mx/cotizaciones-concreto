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
   * Save remision reassignments to database
   */
  async saveRemisionReassignments(reassignments: RemisionReassignment[], sessionId: string, plantId: string): Promise<void> {
    if (reassignments.length === 0) return;
    
    try {
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
