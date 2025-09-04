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
   * Calculate historical inventory using proper date-based approach
   * This ensures accurate initial stock calculation for any period
   */
  async calculateHistoricalInventory(
    plantId: string, 
    startDate: string, 
    endDate: string, 
    materialIds?: string[]
  ): Promise<MaterialFlowSummary[]> {
    console.time('🧮 Historical Inventory Calculation');
    
    try {
      // Build material filter
      const materialFilter = materialIds && materialIds.length > 0 
        ? `AND m.id = ANY(ARRAY[${materialIds.map(id => `'${id}'`).join(',')}]::uuid[])`
        : '';

      // Calculate initial stock (everything before start_date) and period movements
      const query = `
        WITH stock_inicial AS (
          SELECT 
            m.id as material_id,
            m.name as material_name,
            m.unit,
            m.code as material_code,
            
            -- Historical entries (before period)
            COALESCE(SUM(me.quantity_received), 0) as total_entries_historical,
            
            -- Historical adjustments (before period)
            COALESCE(SUM(
              CASE 
                WHEN ma.adjustment_type IN ('consumption', 'waste', 'loss', 'transfer') 
                THEN -ma.quantity_adjusted 
                ELSE ma.quantity_adjusted 
              END
            ), 0) as total_adjustments_historical,
            
            -- Historical consumption from remisiones (before period)
            COALESCE(SUM(rm.cantidad_real), 0) as total_consumption_historical,
            
            -- Historical waste (before period)
            COALESCE(SUM(wm.waste_amount), 0) as total_waste_historical
            
          FROM materials m
          LEFT JOIN material_entries me ON m.id = me.material_id 
            AND me.plant_id = $1
            AND me.entry_date < $2
          LEFT JOIN material_adjustments ma ON m.id = ma.material_id 
            AND ma.plant_id = $1
            AND ma.adjustment_date < $2
          LEFT JOIN remision_materiales rm ON m.id = rm.material_id
          LEFT JOIN remisiones r ON rm.remision_id = r.id 
            AND r.plant_id = $1
            AND r.fecha < $2
          LEFT JOIN waste_materials wm ON m.code = wm.material_code 
            AND wm.plant_id = $1
            AND wm.fecha < $2
          WHERE m.plant_id = $1 ${materialFilter}
          GROUP BY m.id, m.name, m.unit, m.code
        ),
        
        movimientos_periodo AS (
          SELECT 
            m.id as material_id,
            
            -- Period entries
            COALESCE(SUM(me.quantity_received), 0) as period_entries,
            
            -- Period adjustments (positive)
            COALESCE(SUM(
              CASE 
                WHEN ma.adjustment_type NOT IN ('consumption', 'waste', 'loss', 'transfer') 
                THEN ma.quantity_adjusted 
                ELSE 0 
              END
            ), 0) as period_manual_additions,
            
            -- Period adjustments (negative)
            COALESCE(SUM(
              CASE 
                WHEN ma.adjustment_type IN ('consumption', 'waste', 'loss', 'transfer') 
                THEN ma.quantity_adjusted 
                ELSE 0 
              END
            ), 0) as period_manual_withdrawals,
            
            -- Period consumption from remisiones
            COALESCE(SUM(rm.cantidad_real), 0) as period_consumption,
            
            -- Period waste
            COALESCE(SUM(wm.waste_amount), 0) as period_waste
            
          FROM materials m
          LEFT JOIN material_entries me ON m.id = me.material_id 
            AND me.plant_id = $1
            AND me.entry_date BETWEEN $2 AND $3
          LEFT JOIN material_adjustments ma ON m.id = ma.material_id 
            AND ma.plant_id = $1
            AND ma.adjustment_date BETWEEN $2 AND $3
          LEFT JOIN remision_materiales rm ON m.id = rm.material_id
          LEFT JOIN remisiones r ON rm.remision_id = r.id 
            AND r.plant_id = $1
            AND r.fecha BETWEEN $2 AND $3
          LEFT JOIN waste_materials wm ON m.code = wm.material_code 
            AND wm.plant_id = $1
            AND wm.fecha BETWEEN $2 AND $3
          WHERE m.plant_id = $1 ${materialFilter}
          GROUP BY m.id
        )
        
        SELECT 
          si.material_id,
          si.material_name,
          si.unit,
          si.material_code,
          
          -- Initial stock calculated historically
          (si.total_entries_historical + si.total_adjustments_historical - si.total_consumption_historical - si.total_waste_historical) as initial_stock,
          
          -- Period movements
          mp.period_entries as total_entries,
          mp.period_manual_additions as total_manual_additions,
          mp.period_consumption as total_remisiones_consumption,
          mp.period_manual_withdrawals as total_manual_withdrawals,
          mp.period_waste as total_waste,
          
          -- Theoretical final stock
          (si.total_entries_historical + si.total_adjustments_historical - si.total_consumption_historical - si.total_waste_historical) + 
          (mp.period_entries + mp.period_manual_additions - mp.period_consumption - mp.period_manual_withdrawals - mp.period_waste) as theoretical_final_stock,
          
          -- For compatibility, set actual_current_stock to theoretical (since we don't rely on current_stock anymore)
          (si.total_entries_historical + si.total_adjustments_historical - si.total_consumption_historical - si.total_waste_historical) + 
          (mp.period_entries + mp.period_manual_additions - mp.period_consumption - mp.period_manual_withdrawals - mp.period_waste) as actual_current_stock

        FROM stock_inicial si
        LEFT JOIN movimientos_periodo mp ON si.material_id = mp.material_id
        WHERE (si.total_entries_historical + si.total_adjustments_historical - si.total_consumption_historical - si.total_waste_historical) != 0
           OR mp.period_entries != 0 
           OR mp.period_manual_additions != 0 
           OR mp.period_consumption != 0 
           OR mp.period_manual_withdrawals != 0 
           OR mp.period_waste != 0
        ORDER BY si.material_name
      `;

      console.log('🧮 Executing historical calculation query:', {
        plantId,
        startDate,
        endDate,
        materialIds: materialIds?.length || 'all materials'
      });

      // Execute the historical calculation using raw SQL
      const { data, error } = await this.supabase
        .rpc('calculate_historical_inventory', {
          p_plant_id: plantId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_material_ids: materialIds || null
        });

      if (error) {
        console.error('❌ Historical calculation error:', error);
        console.error('Error details:', error);
        throw new Error(`Error en cálculo histórico: ${error.message}`);
      }

      console.log('✅ Historical calculation completed:', {
        materialsFound: data?.length || 0
      });

      // Transform to MaterialFlowSummary format
      const materialFlows: MaterialFlowSummary[] = (data || []).map((row: any) => ({
        material_id: row.material_id,
        material_name: row.material_name,
        unit: row.unit,
        material_code: row.material_code,
        initial_stock: parseFloat(row.initial_stock || 0),
        total_entries: parseFloat(row.total_entries || 0),
        total_manual_additions: parseFloat(row.total_manual_additions || 0),
        total_remisiones_consumption: parseFloat(row.total_remisiones_consumption || 0),
        total_manual_withdrawals: parseFloat(row.total_manual_withdrawals || 0),
        total_waste: parseFloat(row.total_waste || 0),
        theoretical_final_stock: parseFloat(row.theoretical_final_stock || 0),
        actual_current_stock: parseFloat(row.actual_current_stock || 0),
        variance: 0, // No variance since we're using calculated values
        variance_percentage: 0
      }));

      console.timeEnd('🧮 Historical Inventory Calculation');
      return materialFlows;

    } catch (error) {
      console.timeEnd('🧮 Historical Inventory Calculation');
      console.error('❌ Historical calculation failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive inventory dashboard data with HISTORICAL CALCULATION approach
   * This method calculates initial stock from historical data rather than relying on current_stock
   */
  async getDashboardData(filters: InventoryDashboardFilters, userId: string): Promise<InventoryDashboardData> {
    try {
      console.time('🚀 Dashboard Data Fetch (Historical)');
      
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

      // Use the new historical calculation method
      console.log('🧮 Using historical calculation approach');
      let materialFlows: MaterialFlowSummary[];
      
      try {
        materialFlows = await this.calculateHistoricalInventory(
          plantId,
          filters.start_date,
          filters.end_date,
          filters.material_ids
        );
      } catch (historicalError) {
        console.error('❌ Historical calculation failed:', historicalError);
        // Return empty result instead of falling back for now
        materialFlows = [];
      }

      // Get plant info for summary
      const { data: plant } = await this.supabase
        .from('plants')
        .select('name, code')
        .eq('id', plantId)
        .single();

      // Build dashboard summary
      const summary: InventoryDashboardSummary = {
        date_range: {
          start_date: filters.start_date,
          end_date: filters.end_date
        },
        plant_info: {
          id: plantId,
          name: plant?.name || 'Planta Desconocida',
          code: plant?.code || 'N/A'
        },
        total_materials_tracked: materialFlows.length,
        total_remisiones: 0, // Will be calculated if needed
        material_flows: materialFlows
      };

      console.timeEnd('🚀 Dashboard Data Fetch (Historical)');

      return {
        summary,
        movements: [], // Historical method focuses on summary, movements can be added later if needed
        consumption_details: [] // Same as above
      };
    } catch (error) {
      console.timeEnd('🚀 Dashboard Data Fetch (Historical)');
      console.error('❌ Historical dashboard fetch failed:', error);
      throw error;
    }
  }

  /**
   * Legacy dashboard data method (fallback)
   */
  async getDashboardDataLegacy(filters: InventoryDashboardFilters, userId: string): Promise<InventoryDashboardData> {
    try {
      console.time('🚀 Dashboard Data Fetch (Legacy)');
      
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

    console.log('🔍 Batch fetching data for materials:', {
      materialCount: materialIds.length,
      remisionCount: remisionIds.length,
      dateRange: `${startDate} to ${endDate}`
    });

    // PERFORMANCE: Execute all material queries in parallel with proper limits
    const [
      remisionMaterialsResult,
      entriesResult,
      adjustmentsResult,
      wasteMaterialsResult
    ] = await Promise.all([
      // ALL remision materials for ALL materials at once - SMART QUERY STRATEGY
      remisionIds.length > 0 && materialIds.length > 0
        ? this.fetchRemisionMaterialsOptimized(materialIds, remisionIds, plantId, startDate, endDate)
        : Promise.resolve({ data: [] }),

      // ALL material entries at once - No artificial limits
      this.supabase
        .from('material_entries')
        .select('material_id, quantity_received, entry_date, entry_number, notes')
        .eq('plant_id', plantId)
        .in('material_id', materialIds)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: false }),

      // ALL material adjustments at once - No artificial limits  
      this.supabase
        .from('material_adjustments')
        .select('material_id, quantity_adjusted, adjustment_type, adjustment_date, adjustment_number, reference_notes')
        .eq('plant_id', plantId)
        .in('material_id', materialIds)
        .gte('adjustment_date', startDate)
        .lte('adjustment_date', endDate)
        .order('adjustment_date', { ascending: false }),

      // ALL waste materials at once - No artificial limits
      this.supabase
        .from('waste_materials')
        .select('material_code, waste_amount, fecha')
        .eq('plant_id', plantId)
        .gte('fecha', startDate)
        .lte('fecha', endDate)
    ]);

    // CRITICAL: Check for errors and data truncation
    if (remisionMaterialsResult.error) {
      console.error('❌ Error fetching remision materials:', remisionMaterialsResult.error);
      throw new Error('Error al obtener datos de materiales de remisiones');
    }
    if (entriesResult.error) {
      console.error('❌ Error fetching entries:', entriesResult.error);
      throw new Error('Error al obtener entradas de materiales');
    }
    if (adjustmentsResult.error) {
      console.error('❌ Error fetching adjustments:', adjustmentsResult.error);
      throw new Error('Error al obtener ajustes de materiales');
    }
    if (wasteMaterialsResult.error) {
      console.error('❌ Error fetching waste:', wasteMaterialsResult.error);
      throw new Error('Error al obtener desperdicios de materiales');
    }

    console.log('📊 Raw data fetched:', {
      remisionMaterials: remisionMaterialsResult.data?.length || 0,
      entries: entriesResult.data?.length || 0,
      adjustments: adjustmentsResult.data?.length || 0,
      waste: wasteMaterialsResult.data?.length || 0
    });

    // Group data by material for processing
    const remisionMaterialsByMaterial = this.groupByMaterialId(remisionMaterialsResult.data || []);
    const entriesByMaterial = this.groupByMaterialId(entriesResult.data || []);
    const adjustmentsByMaterial = this.groupByMaterialId(adjustmentsResult.data || []);
    const wasteMaterialsByCode = this.groupByField(wasteMaterialsResult.data || [], 'material_code');

    // Process each material with pre-grouped data
    const materialFlows: MaterialFlowSummary[] = [];
    const movements: InventoryMovement[] = [];
    const consumptionDetails: RemisionMaterialConsumption[] = [];

    // Process each material with comprehensive debugging
    for (const material of materials) {
      const materialRemisionData = remisionMaterialsByMaterial.get(material.id) || [];
      const materialEntries = entriesByMaterial.get(material.id) || [];
      const materialAdjustments = adjustmentsByMaterial.get(material.id) || [];
      const materialWaste = wasteMaterialsByCode.get(material.material_code) || [];
      const currentStock = inventoryMap.get(material.id) || 0;

      console.log(`🔧 Processing material: ${material.material_name}`, {
        id: material.id,
        code: material.material_code,
        remisionData: materialRemisionData.length,
        entries: materialEntries.length,
        adjustments: materialAdjustments.length,
        waste: materialWaste.length,
        currentStock
      });

      // Calculate flows with pre-fetched data
      const flow = this.calculateMaterialFlowOptimized(
        material,
        materialRemisionData,
        materialEntries,
        materialAdjustments,
        materialWaste,
        currentStock
      );
      materialFlows.push(flow);

      // Build movements with pre-fetched data
      const materialMovements = this.buildMovementsOptimized(
        material,
        materialRemisionData,
        materialEntries,
        materialAdjustments,
        plantRemisiones
      );
      movements.push(...materialMovements);

      // Build consumption details
      const materialConsumption = this.buildConsumptionDetailsOptimized(
        material,
        materialRemisionData,
        plantRemisiones
      );
      consumptionDetails.push(...materialConsumption);

      console.log(`✅ Completed material: ${material.material_name}`, {
        movements: materialMovements.length,
        consumption: materialConsumption.length,
        totalConsumption: flow.total_remisiones_consumption
      });
    }

    console.log('📊 Final processing results:', {
      materialFlows: materialFlows.length,
      totalMovements: movements.length,
      totalConsumption: consumptionDetails.length
    });

    return {
      materialFlows,
      movements: movements.sort((a, b) => b.movement_date.localeCompare(a.movement_date)),
      consumptionDetails: consumptionDetails.sort((a, b) => b.remision_date.localeCompare(a.remision_date))
    };
  }

  /**
   * SENIOR ENGINEER SOLUTION: Proper batching strategy for remision_materiales
   * Based on analysis: 8 materials/remision average, so 100 remisions = ~800 records (safe margin)
   */
  private async fetchRemisionMaterialsOptimized(
    materialIds: string[], 
    remisionIds: string[], 
    plantId: string, 
    startDate: string, 
    endDate: string
  ) {
    const BATCH_SIZE = 100; // Safe batch size based on 8 materials/remision average
    const expectedRecords = remisionIds.length * 8; // Estimated total records
    
    console.log('🧠 Smart remision materials fetch (BATCHED):', {
      materialIds: materialIds.length,
      remisionIds: remisionIds.length,
      expectedRecords,
      batchesNeeded: Math.ceil(remisionIds.length / BATCH_SIZE),
      strategy: remisionIds.length > BATCH_SIZE ? 'batched-processing' : 'single-query'
    });

    // STRATEGY 1: Single query for small datasets
    if (remisionIds.length <= BATCH_SIZE) {
      console.log('🎯 Using single query (small dataset)');
      
      return await this.supabase
        .from('remision_materiales')
        .select('material_id, remision_id, cantidad_real, cantidad_teorica')
        .in('material_id', materialIds)
        .in('remision_id', remisionIds);
    }

    // STRATEGY 2: Batched processing for large datasets
    console.log('📦 Using batched processing (large dataset)');
    
    const allData: any[] = [];
    const batches = [];
    
    // Split remision IDs into batches of 100
    for (let i = 0; i < remisionIds.length; i += BATCH_SIZE) {
      batches.push(remisionIds.slice(i, i + BATCH_SIZE));
    }

    console.log(`🔄 Processing ${batches.length} batches of ${BATCH_SIZE} remisiones each`);

    // Process batches in parallel (but limited to avoid overwhelming DB)
    const PARALLEL_LIMIT = 3; // Process max 3 batches simultaneously
    
    for (let i = 0; i < batches.length; i += PARALLEL_LIMIT) {
      const batchGroup = batches.slice(i, i + PARALLEL_LIMIT);
      
      console.log(`📊 Processing batch group ${Math.floor(i/PARALLEL_LIMIT) + 1}/${Math.ceil(batches.length/PARALLEL_LIMIT)}`);
      
      const batchPromises = batchGroup.map(async (batchRemisionIds, batchIndex) => {
        const globalBatchIndex = i + batchIndex + 1;
        
        console.log(`  🔍 Batch ${globalBatchIndex}: ${batchRemisionIds.length} remisiones`);
        
        const { data, error } = await this.supabase
          .from('remision_materiales')
          .select('material_id, remision_id, cantidad_real, cantidad_teorica')
          .in('material_id', materialIds)
          .in('remision_id', batchRemisionIds);

        if (error) {
          console.error(`❌ Error in batch ${globalBatchIndex}:`, error);
          throw error;
        }

        console.log(`  ✅ Batch ${globalBatchIndex}: ${data?.length || 0} records fetched`);
        return data || [];
      });

      // Wait for this group of batches to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Combine results
      batchResults.forEach(batchData => {
        allData.push(...batchData);
      });
    }

    console.log('📊 Batched fetch complete:', {
      totalBatches: batches.length,
      totalRecords: allData.length,
      avgRecordsPerBatch: Math.round(allData.length / batches.length)
    });

    return { data: allData, error: null };
  }

  /**
   * Helper: Group array by material_id with validation
   */
  private groupByMaterialId<T extends { material_id: string }>(items: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    let validItems = 0;
    let invalidItems = 0;
    
    items.forEach(item => {
      if (!item.material_id) {
        invalidItems++;
        console.warn('⚠️ Item missing material_id:', item);
        return;
      }
      
      validItems++;
      if (!map.has(item.material_id)) {
        map.set(item.material_id, []);
      }
      map.get(item.material_id)!.push(item);
    });

    console.log('📊 Grouping results:', {
      totalItems: items.length,
      validItems,
      invalidItems,
      uniqueMaterials: map.size
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
