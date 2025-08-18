import { StatusProcessingResult, WasteMaterial, RemisionReassignment } from '@/types/arkik';

declare global {
  function mcp_supabase_execute_sql(params: { project_id: string; query: string }): Promise<{ rows: any[] }>;
  function mcp_supabase_get_project(): Promise<{ id: string }>;
}

export class ArkikStatusStorage {
  private projectId: string | null = null;

  constructor() {}

  /**
   * Initialize the service with project ID
   */
  async initialize(): Promise<void> {
    try {
      const project = await mcp_supabase_get_project();
      this.projectId = project.id;
    } catch (error) {
      console.error('Failed to get Supabase project:', error);
      throw new Error('Failed to initialize status storage');
    }
  }

  /**
   * Save waste materials to database
   */
  async saveWasteMaterials(wasteMaterials: WasteMaterial[]): Promise<void> {
    if (!this.projectId) await this.initialize();
    if (wasteMaterials.length === 0) return;

    const values = wasteMaterials.map(waste => 
      `('${waste.id}', '${waste.session_id}', '${waste.remision_number}', '${waste.material_code}', ${waste.material_name ? `'${waste.material_name}'` : 'NULL'}, ${waste.theoretical_amount}, ${waste.actual_amount}, ${waste.waste_amount}, '${waste.waste_reason}', '${waste.plant_id}', '${waste.fecha.toISOString().split('T')[0]}', ${waste.created_at ? `'${waste.created_at.toISOString()}'` : 'NOW()'})`
    ).join(', ');

    const query = `
      INSERT INTO waste_materials (
        id, session_id, remision_number, material_code, material_name, 
        theoretical_amount, actual_amount, waste_amount, waste_reason, 
        plant_id, fecha, created_at
      ) VALUES ${values}
    `;

    try {
      await mcp_supabase_execute_sql({
        project_id: this.projectId!,
        query
      });
      console.log(`Saved ${wasteMaterials.length} waste material records`);
    } catch (error) {
      console.error('Failed to save waste materials:', error);
      throw new Error(`Failed to save waste materials: ${error}`);
    }
  }

  /**
   * Save remision reassignments to database
   */
  async saveRemisionReassignments(reassignments: RemisionReassignment[], sessionId: string, plantId: string): Promise<void> {
    if (!this.projectId) await this.initialize();
    if (reassignments.length === 0) return;
    
    const values = reassignments.map(reassignment => {
      const materialsJson = JSON.stringify(reassignment.materials_to_transfer);
      return `(gen_random_uuid(), '${sessionId}', '${reassignment.source_remision_number}', '${reassignment.target_remision_number}', '${materialsJson.replace(/'/g, "''")}', '${reassignment.reason.replace(/'/g, "''")}', '${plantId}', '${reassignment.created_at.toISOString()}')`;
    }).join(', ');

    const query = `
      INSERT INTO remision_reassignments (
        id, session_id, source_remision_number, target_remision_number,
        materials_transferred, reason, plant_id, created_at
      ) VALUES ${values}
    `;

    try {
      await mcp_supabase_execute_sql({
        project_id: this.projectId!,
        query
      });
      console.log(`Saved ${reassignments.length} reassignment records`);
    } catch (error) {
      console.error('Failed to save reassignments:', error);
      throw new Error(`Failed to save reassignments: ${error}`);
    }
  }

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
    if (!this.projectId) await this.initialize();

    const query = `
      INSERT INTO arkik_import_sessions (
        id, plant_id, file_name, file_size,
        total_rows, processed_rows, valid_rows, error_rows,
        status_processing_enabled, normal_remisiones, reassigned_remisiones,
        waste_remisiones, excluded_remisiones, processing_status
      ) VALUES (
        '${sessionData.sessionId}',
        '${sessionData.plantId}',
        '${sessionData.fileName}',
        ${sessionData.fileSize || 'NULL'},
        ${sessionData.result.total_remisiones},
        ${sessionData.result.processed_remisiones},
        ${sessionData.result.normal_remisiones + sessionData.result.reassigned_remisiones + sessionData.result.waste_remisiones},
        0,
        true,
        ${sessionData.result.normal_remisiones},
        ${sessionData.result.reassigned_remisiones},
        ${sessionData.result.waste_remisiones},
        0,
        'status_processing'
      )
      ON CONFLICT (id) DO UPDATE SET
        status_processing_enabled = EXCLUDED.status_processing_enabled,
        normal_remisiones = EXCLUDED.normal_remisiones,
        reassigned_remisiones = EXCLUDED.reassigned_remisiones,
        waste_remisiones = EXCLUDED.waste_remisiones,
        processing_status = EXCLUDED.processing_status,
        updated_at = NOW()
    `;

    try {
      await mcp_supabase_execute_sql({
        project_id: this.projectId!,
        query
      });
      console.log(`Saved import session data for ${sessionData.sessionId}`);
    } catch (error) {
      console.error('Failed to save import session:', error);
      throw new Error(`Failed to save import session: ${error}`);
    }
  }

  /**
   * Get waste materials summary for a plant
   */
  async getWasteMaterialsSummary(plantId: string, startDate: Date, endDate: Date): Promise<any[]> {
    if (!this.projectId) await this.initialize();

    const query = `
      SELECT 
        material_code,
        COUNT(*) as remision_count,
        SUM(waste_amount) as total_waste_amount,
        waste_reason,
        DATE(fecha) as waste_date
      FROM waste_materials 
      WHERE plant_id = '${plantId}' 
        AND fecha BETWEEN '${startDate.toISOString().split('T')[0]}' 
        AND '${endDate.toISOString().split('T')[0]}'
      GROUP BY material_code, waste_reason, DATE(fecha)
      ORDER BY waste_date DESC, total_waste_amount DESC
    `;

    try {
      const result = await mcp_supabase_execute_sql({
        project_id: this.projectId!,
        query
      });
      return result.rows;
    } catch (error) {
      console.error('Failed to get waste materials summary:', error);
      throw new Error(`Failed to get waste materials summary: ${error}`);
    }
  }

  /**
   * Get reassignment history for analysis
   */
  async getReassignmentHistory(plantId: string, limit: number = 100): Promise<any[]> {
    if (!this.projectId) await this.initialize();

    const query = `
      SELECT 
        source_remision_number,
        target_remision_number,
        materials_transferred,
        reason,
        created_at
      FROM remision_reassignments
      WHERE plant_id = '${plantId}'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    try {
      const result = await mcp_supabase_execute_sql({
        project_id: this.projectId!,
        query
      });
      return result.rows;
    } catch (error) {
      console.error('Failed to get reassignment history:', error);
      throw new Error(`Failed to get reassignment history: ${error}`);
    }
  }
}
