import { createServerSupabaseClient } from '@/lib/supabase/server';
import { 
  InventoryDashboardData, 
  InventoryDashboardFilters, 
  MaterialFlowSummary,
  InventoryMovement,
  RemisionMaterialConsumption,
  InventoryDashboardSummary
} from '@/types/inventory';

export class InventoryDashboardService {
  private supabase;
  
  constructor(supabase: any) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createServerSupabaseClient();
    return new InventoryDashboardService(supabase);
  }

  /**
   * Get comprehensive inventory dashboard data with OPTIMIZED single-query approach
   */
  async getDashboardData(filters: InventoryDashboardFilters, userId: string): Promise<InventoryDashboardData> {
    try {
      console.time('🚀 Dashboard Data Fetch');
      
      // Get user profile to ensure proper plant access
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profile) {
        throw new Error('Usuario no encontrado');
      }

      // Determine plant ID to use
      const plantId = filters.plant_id && profile.role === 'EXECUTIVE' ? 
        filters.plant_id : profile.plant_id;

      if (!plantId) {
        throw new Error('Planta no especificada o sin acceso');
      }

      // PERFORMANCE: Execute all base queries in parallel
      const [
        plantResult,
        materialsResult,
        remisionesResult,
        entriesResult,
        adjustmentsResult,
        inventoryResult
      ] = await Promise.all([
        // Plant info
        this.supabase
          .from('plants')
          .select('id, name, code')
          .eq('id', plantId)
          .single(),
        
        // Materials for this plant
        this.supabase
          .from('materials')
          .select('*')
          .eq('plant_id', plantId)
          .eq('is_active', true)
          .order('material_name'),
        
        // All remisiones for date range
        this.supabase
          .from('remisiones')
          .select('id, fecha, remision_number')
          .eq('plant_id', plantId)
          .gte('fecha', filters.start_date)
          .lte('fecha', filters.end_date)
          .order('fecha', { ascending: false }),
        
        // Material entries count
        this.supabase
          .from('material_entries')
          .select('id', { count: 'exact' })
          .eq('plant_id', plantId)
          .gte('entry_date', filters.start_date)
          .lte('entry_date', filters.end_date),
        
        // Material adjustments count  
        this.supabase
          .from('material_adjustments')
          .select('id', { count: 'exact' })
          .eq('plant_id', plantId)
          .gte('adjustment_date', filters.start_date)
          .lte('adjustment_date', filters.end_date),
        
        // Current inventory for all materials
        this.supabase
          .from('material_inventory')
          .select('material_id, current_stock')
          .eq('plant_id', plantId)
      ]);

      if (plantResult.error) throw new Error('Planta no encontrada');
      if (materialsResult.error || !materialsResult.data?.length) {
        throw new Error('No se encontraron materiales para esta planta');
      }

      const plant = plantResult.data;
      const materials = materialsResult.data;
      const plantRemisiones = remisionesResult.data || [];
      const totalEntries = entriesResult.data?.length || 0;
      const totalAdjustments = adjustmentsResult.data?.length || 0;
      const inventoryMap = new Map(
        inventoryResult.data?.map(inv => [inv.material_id, inv.current_stock]) || []
      );

      // Filter materials if specific ones are requested
      const filteredMaterials = filters.material_ids && filters.material_ids.length > 0
        ? materials.filter(m => filters.material_ids!.includes(m.id))
        : materials;

      console.log('📊 Base data loaded:', {
        materials: filteredMaterials.length,
        remisiones: plantRemisiones.length,
        entries: totalEntries,
        adjustments: totalAdjustments
      });

      // PERFORMANCE: Batch fetch ALL material-related data in parallel
      const dashboardData = await this.buildDashboardDataOptimized(
        filteredMaterials,
        plantRemisiones,
        inventoryMap,
        plantId,
        filters.start_date,
        filters.end_date
      );

      // Build final summary
      const summary: InventoryDashboardSummary = {
        date_range: {
          start_date: filters.start_date,
          end_date: filters.end_date
        },
        plant_info: plant,
        total_materials_tracked: filteredMaterials.length,
        total_remisiones: plantRemisiones.length,
        total_entries: totalEntries,
        total_adjustments: totalAdjustments,
        materials_with_variance: dashboardData.materialFlows.filter(m => Math.abs(m.variance_percentage) > 1).length,
        material_flows: dashboardData.materialFlows
      };

      console.timeEnd('🚀 Dashboard Data Fetch');
      
      return {
        summary,
        movements: dashboardData.movements,
        consumption_details: dashboardData.consumptionDetails
      };

    } catch (error) {
      console.error('Error in getDashboardData:', error);
      throw error;
    }
  }

  /**
   * OPTIMIZED: Build all dashboard data with minimal database queries
   */
  private async buildDashboardDataOptimized(
    materials: any[],
    plantRemisiones: any[],
    inventoryMap: Map<string, number>,
    plantId: string,
    startDate: string,
    endDate: string
  ) {
    const materialIds = materials.map(m => m.id);
    const remisionIds = plantRemisiones.map(r => r.id);

    // PERFORMANCE: Execute all material queries in parallel - 3 queries instead of N*3
    const [
      remisionMaterialsResult,
      entriesResult,
      adjustmentsResult,
      wasteMaterialsResult
    ] = await Promise.all([
      // ALL remision materials for ALL materials at once
      remisionIds.length > 0 
        ? this.supabase
            .from('remision_materiales')
            .select('material_id, remision_id, cantidad_real, cantidad_teorica')
            .in('material_id', materialIds)
            .in('remision_id', remisionIds)
        : { data: [] },

      // ALL material entries at once
      this.supabase
        .from('material_entries')
        .select('material_id, quantity_received, entry_date, entry_number, notes')
        .eq('plant_id', plantId)
        .in('material_id', materialIds)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: false }),

      // ALL material adjustments at once
      this.supabase
        .from('material_adjustments')
        .select('material_id, quantity_adjusted, adjustment_type, adjustment_date, adjustment_number, reference_notes')
        .eq('plant_id', plantId)
        .in('material_id', materialIds)
        .gte('adjustment_date', startDate)
        .lte('adjustment_date', endDate)
        .order('adjustment_date', { ascending: false }),

      // ALL waste materials at once
      this.supabase
        .from('waste_materials')
        .select('material_code, waste_amount, fecha')
        .eq('plant_id', plantId)
        .gte('fecha', startDate)
        .lte('fecha', endDate)
    ]);

    // Group data by material for processing
    const remisionMaterialsByMaterial = this.groupByMaterialId(remisionMaterialsResult.data || []);
    const entriesByMaterial = this.groupByMaterialId(entriesResult.data || []);
    const adjustmentsByMaterial = this.groupByMaterialId(adjustmentsResult.data || []);
    const wasteMaterialsByCode = this.groupByField(wasteMaterialsResult.data || [], 'material_code');

    // Process each material with pre-grouped data
    const materialFlows: MaterialFlowSummary[] = [];
    const movements: InventoryMovement[] = [];
    const consumptionDetails: RemisionMaterialConsumption[] = [];

    for (const material of materials) {
      // Calculate flows with pre-fetched data
      const flow = this.calculateMaterialFlowOptimized(
        material,
        remisionMaterialsByMaterial.get(material.id) || [],
        entriesByMaterial.get(material.id) || [],
        adjustmentsByMaterial.get(material.id) || [],
        wasteMaterialsByCode.get(material.material_code) || [],
        inventoryMap.get(material.id) || 0
      );
      materialFlows.push(flow);

      // Build movements with pre-fetched data
      const materialMovements = this.buildMovementsOptimized(
        material,
        remisionMaterialsByMaterial.get(material.id) || [],
        entriesByMaterial.get(material.id) || [],
        adjustmentsByMaterial.get(material.id) || [],
        plantRemisiones
      );
      movements.push(...materialMovements);

      // Build consumption details
      const materialConsumption = this.buildConsumptionDetailsOptimized(
        material,
        remisionMaterialsByMaterial.get(material.id) || [],
        plantRemisiones
      );
      consumptionDetails.push(...materialConsumption);
    }

    return {
      materialFlows,
      movements: movements.sort((a, b) => b.movement_date.localeCompare(a.movement_date)),
      consumptionDetails: consumptionDetails.sort((a, b) => b.remision_date.localeCompare(a.remision_date))
    };
  }

  /**
   * Helper: Group array by material_id
   */
  private groupByMaterialId<T extends { material_id: string }>(items: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    items.forEach(item => {
      if (!map.has(item.material_id)) {
        map.set(item.material_id, []);
      }
      map.get(item.material_id)!.push(item);
    });
    return map;
  }

  /**
   * Helper: Group array by any field
   */
  private groupByField<T>(items: T[], field: keyof T): Map<any, T[]> {
    const map = new Map<any, T[]>();
    items.forEach(item => {
      const key = item[field];
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });
    return map;
  }

  /**
   * OPTIMIZED: Calculate material flow with pre-fetched data
   */
  private calculateMaterialFlowOptimized(
    material: any,
    remisionMaterials: any[],
    entries: any[],
    adjustments: any[],
    wasteMaterials: any[],
    currentStock: number
  ): MaterialFlowSummary {
    // Calculate totals from pre-fetched data
    const totalEntries = entries.reduce((sum, e) => sum + Number(e.quantity_received), 0);
    const totalRemisionConsumption = remisionMaterials.reduce((sum, rm) => sum + (Number(rm.cantidad_real) || 0), 0);
    
    let totalManualAdditions = 0;
    let totalManualWithdrawals = 0;
    let totalAdjustments = 0;

    adjustments.forEach(adj => {
      const qty = Number(adj.quantity_adjusted);
      totalAdjustments += Math.abs(qty);
      
      if (adj.adjustment_type === 'correction' && qty > 0) {
        totalManualAdditions += qty;
      } else if (['consumption', 'waste', 'loss'].includes(adj.adjustment_type)) {
        totalManualWithdrawals += Math.abs(qty);
      }
    });

    const totalWaste = wasteMaterials.reduce((sum, w) => sum + Number(w.waste_amount), 0);
    
    // For now use current stock as initial (TODO: implement historical calculation)
    const initialStock = currentStock;
    const theoreticalFinalStock = initialStock + totalEntries + totalManualAdditions - totalRemisionConsumption - totalManualWithdrawals - totalWaste;
    const variance = currentStock - theoreticalFinalStock;
    const variancePercentage = theoreticalFinalStock !== 0 ? (variance / theoreticalFinalStock) * 100 : 0;

    return {
      material_id: material.id,
      material_name: material.material_name,
      unit: material.unit_of_measure,
      initial_stock: initialStock,
      total_entries: totalEntries,
      total_manual_additions: totalManualAdditions,
      total_remisiones_consumption: totalRemisionConsumption,
      total_manual_withdrawals: totalManualWithdrawals,
      total_adjustments: totalAdjustments,
      total_waste: totalWaste,
      theoretical_final_stock: theoreticalFinalStock,
      actual_current_stock: currentStock,
      variance: variance,
      variance_percentage: variancePercentage
    };
  }

  /**
   * OPTIMIZED: Build movements with pre-fetched data
   */
  private buildMovementsOptimized(
    material: any,
    remisionMaterials: any[],
    entries: any[],
    adjustments: any[],
    plantRemisiones: any[]
  ): InventoryMovement[] {
    const movements: InventoryMovement[] = [];

    // Add entries
    entries.forEach(entry => {
      movements.push({
        movement_type: 'ENTRY',
        movement_date: entry.entry_date,
        material_id: material.id,
        material_name: material.material_name,
        quantity: Number(entry.quantity_received),
        unit: material.unit_of_measure,
        reference: entry.entry_number,
        notes: entry.notes
      });
    });

    // Add adjustments
    adjustments.forEach(adj => {
      movements.push({
        movement_type: 'ADJUSTMENT',
        movement_date: adj.adjustment_date,
        material_id: material.id,
        material_name: material.material_name,
        quantity: Number(adj.quantity_adjusted),
        unit: material.unit_of_measure,
        reference: `${adj.adjustment_number} (${adj.adjustment_type})`,
        notes: adj.reference_notes
      });
    });

    // Add remision consumption
    remisionMaterials.forEach(rm => {
      const remisionInfo = plantRemisiones.find(r => r.id === rm.remision_id);
      if (remisionInfo) {
        movements.push({
          movement_type: 'REMISION',
          movement_date: remisionInfo.fecha,
          material_id: material.id,
          material_name: material.material_name,
          quantity: -Number(rm.cantidad_real),
          unit: material.unit_of_measure,
          reference: remisionInfo.remision_number,
          notes: 'Consumo por remisión'
        });
      }
    });

    return movements;
  }

  /**
   * OPTIMIZED: Build consumption details with pre-fetched data
   */
  private buildConsumptionDetailsOptimized(
    material: any,
    remisionMaterials: any[],
    plantRemisiones: any[]
  ): RemisionMaterialConsumption[] {
    return remisionMaterials.map(rm => {
      const remisionInfo = plantRemisiones.find(r => r.id === rm.remision_id);
      return {
        remision_number: remisionInfo?.remision_number || 'N/A',
        remision_date: remisionInfo?.fecha || '',
        material_id: material.id,
        material_name: material.material_name,
        cantidad_teorica: Number(rm.cantidad_teorica) || 0,
        cantidad_real: Number(rm.cantidad_real) || 0,
        variance: (Number(rm.cantidad_real) || 0) - (Number(rm.cantidad_teorica) || 0)
      };
    }).filter(c => c.remision_date);
  }

  /**
   * Calculate comprehensive material flow for a specific material
   */
  private async calculateMaterialFlow(
    material: any, 
    plantId: string, 
    startDate: string, 
    endDate: string,
    plantRemisiones: any[]
  ): Promise<MaterialFlowSummary> {
    
    // Get initial stock (stock at start date)
    const initialStock = await this.getInitialStock(material.id, plantId, startDate);

    // Get current stock (actual current stock)
    const { data: currentInventory } = await this.supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', plantId)
      .eq('material_id', material.id)
      .single();

    const actualCurrentStock = currentInventory?.current_stock || 0;

    // Get material entries (additions) during period
    const { data: entries } = await this.supabase
      .from('material_entries')
      .select('quantity_received')
      .eq('plant_id', plantId)
      .eq('material_id', material.id)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    const totalEntries = entries?.reduce((sum, e) => sum + Number(e.quantity_received), 0) || 0;

    // Get manual adjustments (additions and subtractions)
    const { data: adjustments } = await this.supabase
      .from('material_adjustments')
      .select('quantity_adjusted, adjustment_type')
      .eq('plant_id', plantId)
      .eq('material_id', material.id)
      .gte('adjustment_date', startDate)
      .lte('adjustment_date', endDate);

    let totalManualAdditions = 0;
    let totalManualWithdrawals = 0;
    let totalAdjustments = 0;

    adjustments?.forEach(adj => {
      const qty = Number(adj.quantity_adjusted);
      totalAdjustments += Math.abs(qty);
      
      if (adj.adjustment_type === 'correction' && qty > 0) {
        totalManualAdditions += qty;
      } else if (['consumption', 'waste', 'loss'].includes(adj.adjustment_type)) {
        totalManualWithdrawals += Math.abs(qty);
      }
    });

    // Get remision consumption during period - USING SHARED DATA
    let totalRemisionConsumption = 0;
    if (plantRemisiones && plantRemisiones.length > 0) {
      const remisionIds = plantRemisiones.map(r => r.id);
      
      const { data: remisionMaterials } = await this.supabase
        .from('remision_materiales')
        .select('cantidad_real')
        .eq('material_id', material.id)
        .in('remision_id', remisionIds);

      totalRemisionConsumption = remisionMaterials?.reduce(
        (sum, rm) => sum + (Number(rm.cantidad_real) || 0), 0
      ) || 0;
    }

    // Get waste materials during period
    const { data: wasteMaterials } = await this.supabase
      .from('waste_materials')
      .select('waste_amount')
      .eq('plant_id', plantId)
      .eq('material_code', material.material_code) // Use material_code for waste tracking
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    const totalWaste = wasteMaterials?.reduce(
      (sum, w) => sum + Number(w.waste_amount), 0
    ) || 0;

    // Calculate theoretical final stock
    const theoreticalFinalStock = initialStock 
      + totalEntries 
      + totalManualAdditions 
      - totalRemisionConsumption 
      - totalManualWithdrawals 
      - totalWaste;

    const variance = actualCurrentStock - theoreticalFinalStock;
    const variancePercentage = theoreticalFinalStock !== 0 
      ? (variance / theoreticalFinalStock) * 100 
      : 0;

    return {
      material_id: material.id,
      material_name: material.material_name,
      unit: material.unit_of_measure,
      initial_stock: initialStock,
      total_entries: totalEntries,
      total_manual_additions: totalManualAdditions,
      total_remisiones_consumption: totalRemisionConsumption,
      total_manual_withdrawals: totalManualWithdrawals,
      total_adjustments: totalAdjustments,
      total_waste: totalWaste,
      theoretical_final_stock: theoreticalFinalStock,
      actual_current_stock: actualCurrentStock,
      variance: variance,
      variance_percentage: variancePercentage
    };
  }

  /**
   * Get initial stock for a material at a specific date
   */
  private async getInitialStock(materialId: string, plantId: string, startDate: string): Promise<number> {
    // This is a simplified calculation - in a more sophisticated system, 
    // you'd reconstruct historical stock levels
    const { data: inventory } = await this.supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', plantId)
      .eq('material_id', materialId)
      .single();

    // For now, we use current stock as initial stock
    // TODO: Implement proper historical stock calculation
    return inventory?.current_stock || 0;
  }

  /**
   * Get all inventory movements for a material during the date range
   */
  private async getMaterialMovements(
    material: any, 
    plantId: string, 
    startDate: string, 
    endDate: string,
    plantRemisiones: any[]
  ): Promise<InventoryMovement[]> {
    const movements: InventoryMovement[] = [];

    // Get material entries
    const { data: entries } = await this.supabase
      .from('material_entries')
      .select('entry_date, quantity_received, entry_number, notes')
      .eq('plant_id', plantId)
      .eq('material_id', material.id)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false });

    entries?.forEach(entry => {
      movements.push({
        movement_type: 'ENTRY',
        movement_date: entry.entry_date,
        material_id: material.id,
        material_name: material.material_name,
        quantity: Number(entry.quantity_received),
        unit: material.unit_of_measure,
        reference: entry.entry_number,
        notes: entry.notes
      });
    });

    // Get adjustments
    const { data: adjustments } = await this.supabase
      .from('material_adjustments')
      .select('adjustment_date, quantity_adjusted, adjustment_number, reference_notes, adjustment_type')
      .eq('plant_id', plantId)
      .eq('material_id', material.id)
      .gte('adjustment_date', startDate)
      .lte('adjustment_date', endDate)
      .order('adjustment_date', { ascending: false });

    adjustments?.forEach(adj => {
      movements.push({
        movement_type: 'ADJUSTMENT',
        movement_date: adj.adjustment_date,
        material_id: material.id,
        material_name: material.material_name,
        quantity: Number(adj.quantity_adjusted),
        unit: material.unit_of_measure,
        reference: `${adj.adjustment_number} (${adj.adjustment_type})`,
        notes: adj.reference_notes
      });
    });

    // Get remision consumption - USING SHARED DATA
    if (plantRemisiones && plantRemisiones.length > 0) {
      const remisionIds = plantRemisiones.map(r => r.id);
      
      const { data: remisionMaterials } = await this.supabase
        .from('remision_materiales')
        .select('cantidad_real, remision_id')
        .eq('material_id', material.id)
        .in('remision_id', remisionIds);

      remisionMaterials?.forEach(rm => {
        // Find the matching remision data
        const remisionInfo = plantRemisiones.find(r => r.id === rm.remision_id);
        if (remisionInfo) {
          movements.push({
            movement_type: 'REMISION',
            movement_date: remisionInfo.fecha,
            material_id: material.id,
            material_name: material.material_name,
            quantity: -Number(rm.cantidad_real), // Negative because it's consumption
            unit: material.unit_of_measure,
            reference: remisionInfo.remision_number,
            notes: 'Consumo por remisión'
          });
        }
      });
    }

    return movements;
  }

  /**
   * Get detailed remision consumption for a material
   */
  private async getRemisionConsumption(
    material: any, 
    plantId: string, 
    startDate: string, 
    endDate: string,
    plantRemisiones: any[]
  ): Promise<RemisionMaterialConsumption[]> {
    if (!plantRemisiones || plantRemisiones.length === 0) {
      return [];
    }

    const remisionIds = plantRemisiones.map(r => r.id);
    
    const { data: consumption } = await this.supabase
      .from('remision_materiales')
      .select('cantidad_teorica, cantidad_real, remision_id')
      .eq('material_id', material.id)
      .in('remision_id', remisionIds);

    return consumption?.map(c => {
      const remisionInfo = plantRemisiones.find(r => r.id === c.remision_id);
      return {
        remision_number: remisionInfo?.remision_number || 'N/A',
        remision_date: remisionInfo?.fecha || '',
        material_id: material.id,
        material_name: material.material_name,
        cantidad_teorica: Number(c.cantidad_teorica) || 0,
        cantidad_real: Number(c.cantidad_real) || 0,
        variance: (Number(c.cantidad_real) || 0) - (Number(c.cantidad_teorica) || 0)
      };
    }).filter(c => c.remision_date) // Filter out invalid entries
    .sort((a, b) => b.remision_date.localeCompare(a.remision_date)) || [];
  }

  /**
   * Get total remision count for period
   */
  private async getRemisionCount(plantId: string, startDate: string, endDate: string): Promise<number> {
    const { data } = await this.supabase
      .from('remisiones')
      .select('id', { count: 'exact' })
      .eq('plant_id', plantId)
      .gte('fecha', startDate)
      .lte('fecha', endDate);

    return data?.length || 0;
  }

  /**
   * Get total entries count for period
   */
  private async getEntriesCount(plantId: string, startDate: string, endDate: string): Promise<number> {
    const { data } = await this.supabase
      .from('material_entries')
      .select('id', { count: 'exact' })
      .eq('plant_id', plantId)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    return data?.length || 0;
  }

  /**
   * Get total adjustments count for period
   */
  private async getAdjustmentsCount(plantId: string, startDate: string, endDate: string): Promise<number> {
    const { data } = await this.supabase
      .from('material_adjustments')
      .select('id', { count: 'exact' })
      .eq('plant_id', plantId)
      .gte('adjustment_date', startDate)
      .lte('adjustment_date', endDate);

    return data?.length || 0;
  }
}
