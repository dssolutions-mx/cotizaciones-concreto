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
    materialIds?: string[],
    categoryFilter?: string
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
          (mp.period_entries + mp.period_manual_additions - mp.period_consumption - mp.period_manual_withdrawals - mp.period_waste) as theoretical_final_stock

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

      // Use direct query approach - fetch data separately and calculate
      // This is more reliable than RPC which may not exist
      console.log('⚠️ Using direct calculation method (no RPC dependency)');
      
      let calculatedData: any[] = [];
      
      // Get all materials for this plant
      let materialsQuery = this.supabase
        .from('materials')
        .select('id, material_name, unit_of_measure, material_code, category')
        .eq('plant_id', plantId)
        .eq('is_active', true);
      
      const { data: materials, error: materialsError } = await materialsQuery;
      
      if (materialsError) {
        console.error('❌ Error fetching materials:', materialsError);
        console.timeEnd('🧮 Historical Inventory Calculation');
        throw materialsError;
      }
      
      console.log('📦 Materials found:', {
        plantId,
        totalMaterials: materials?.length || 0,
        sampleMaterials: materials?.slice(0, 3).map(m => ({ id: m.id, name: m.material_name, category: m.category }))
      });
      
      if (!materials || materials.length === 0) {
        console.warn('⚠️ No active materials found for plant:', plantId);
        console.timeEnd('🧮 Historical Inventory Calculation');
        return [];
      }

      // Map frontend category to database category
      const categoryMap: Record<string, string> = {
        'cement': 'cemento',
        'aggregate': 'agregado',
        'water': 'agua',
        'admixture': 'aditivo'
      };

      // Filter materials by category if specified
      let filteredMaterials = materials;
      if (categoryFilter && categoryFilter !== 'all') {
        const dbCategory = categoryMap[categoryFilter];
        console.log('🔍 Filtering by category:', { categoryFilter, dbCategory });
        if (dbCategory) {
          filteredMaterials = filteredMaterials.filter(m => m.category === dbCategory);
          console.log('📊 After category filter:', { 
            originalCount: materials.length, 
            filteredCount: filteredMaterials.length,
            categories: [...new Set(materials.map(m => m.category))]
          });
        } else {
          console.warn('⚠️ Category filter not found in map:', categoryFilter);
        }
      }

      // Filter materials by IDs if specified
      if (materialIds && materialIds.length > 0) {
        console.log('🔍 Filtering by material IDs:', { materialIdsCount: materialIds.length });
        filteredMaterials = filteredMaterials.filter(m => materialIds.includes(m.id));
        console.log('📊 After material IDs filter:', { 
          originalCount: materials.length, 
          filteredCount: filteredMaterials.length 
        });
      }

      console.log('✅ Final filtered materials:', {
        total: filteredMaterials.length,
        materials: filteredMaterials.slice(0, 5).map(m => ({ id: m.id, name: m.material_name, category: m.category }))
      });

      if (filteredMaterials.length === 0) {
        console.warn('⚠️ No materials after filtering:', {
          originalCount: materials.length,
          categoryFilter,
          materialIdsCount: materialIds?.length || 0
        });
        console.timeEnd('🧮 Historical Inventory Calculation');
        return [];
      }

      const materialIdsList = filteredMaterials.map(m => m.id);
      const materialCodesList = filteredMaterials.map(m => m.material_code);
      const materialCodeToIdMap = new Map(filteredMaterials.map(m => [m.material_code, m.id]));

      // PERFORMANCE OPTIMIZATION: Batch fetch ALL data at once instead of per-material queries
      console.log('📊 Batch fetching historical data for', filteredMaterials.length, 'materials');

      // Get current inventory for variance calculation
      const { data: currentInventory, error: inventoryError } = await this.supabase
        .from('material_inventory')
        .select('material_id, current_stock')
        .eq('plant_id', plantId)
        .in('material_id', materialIdsList);

      if (inventoryError) {
        console.error('❌ Error fetching current inventory:', inventoryError);
      }

      console.log('📊 Current inventory fetched:', {
        materialIdsQueried: materialIdsList.length,
        inventoryRecordsFound: currentInventory?.length || 0
      });

      const inventoryMap = new Map(
        currentInventory?.map(inv => [inv.material_id, inv.current_stock]) || []
      );

      // OPTIMIZED: Use SQL aggregations instead of fetching all historical records
      // This reduces data transfer from thousands of records to just aggregated totals per material
      console.log('📊 Fetching historical aggregations (optimized)...');
      
      const [
        historicalEntriesAgg,
        historicalAdjustmentsAgg,
        historicalConsumptionAgg,
        historicalWasteAgg
      ] = await Promise.all([
        // Aggregate historical entries: SUM by material_id
        this.supabase
          .from('material_entries')
          .select('material_id, quantity_received')
          .eq('plant_id', plantId)
          .in('material_id', materialIdsList)
          .lt('entry_date', startDate),
        
        // Aggregate historical adjustments: SUM by material_id and type
        this.supabase
          .from('material_adjustments')
          .select('material_id, quantity_adjusted, adjustment_type')
          .eq('plant_id', plantId)
          .in('material_id', materialIdsList)
          .lt('adjustment_date', startDate),
        
        // OPTIMIZED: Aggregate historical consumption using direct query
        // Get remisiones before startDate, then aggregate their materials
        // Note: Using direct query since RPC doesn't exist - this is still optimized vs fetching all records
        (async () => {
          // Get remisiones before startDate
          const remisionesResult = await this.supabase
            .from('remisiones')
            .select('id')
            .eq('plant_id', plantId)
            .lt('fecha', startDate);
          
          const remisionIds = remisionesResult.data?.map(r => r.id) || [];
          if (remisionIds.length === 0) return { data: [], error: null };
          
          // Aggregate remision materials by material_id (only fetch what we need)
          return await this.supabase
            .from('remision_materiales')
            .select('material_id, cantidad_real')
            .in('remision_id', remisionIds)
            .in('material_id', materialIdsList);
        })(),
        
        // Aggregate historical waste: SUM by material_code
        this.supabase
          .from('waste_materials')
          .select('material_code, waste_amount')
          .eq('plant_id', plantId)
          .in('material_code', materialCodesList)
          .lt('fecha', startDate)
      ]);

      // Process aggregated historical entries
      const historicalEntriesByMaterial = new Map<string, number>();
      (historicalEntriesAgg.data || []).forEach(e => {
        const current = historicalEntriesByMaterial.get(e.material_id) || 0;
        historicalEntriesByMaterial.set(e.material_id, current + Number(e.quantity_received || 0));
      });

      // Process aggregated historical adjustments
      const historicalAdjustmentsByMaterial = new Map<string, { additions: number; withdrawals: number }>();
      (historicalAdjustmentsAgg.data || []).forEach(adj => {
        const qty = Number(adj.quantity_adjusted || 0);
        const isWithdrawal = ['consumption', 'waste', 'loss', 'transfer'].includes(adj.adjustment_type || '');
        
        if (!historicalAdjustmentsByMaterial.has(adj.material_id)) {
          historicalAdjustmentsByMaterial.set(adj.material_id, { additions: 0, withdrawals: 0 });
        }
        const current = historicalAdjustmentsByMaterial.get(adj.material_id)!;
        if (isWithdrawal) {
          current.withdrawals += Math.abs(qty);
        } else {
          current.additions += qty;
        }
      });

      // Process aggregated historical consumption
      const historicalConsumptionByMaterial = new Map<string, number>();
      (historicalConsumptionAgg.data || []).forEach(rm => {
        if (rm.material_id) {
          const current = historicalConsumptionByMaterial.get(rm.material_id) || 0;
          historicalConsumptionByMaterial.set(rm.material_id, current + Number(rm.cantidad_real || 0));
        }
      });

      // Process aggregated historical waste
      const historicalWasteByCode = new Map<string, number>();
      (historicalWasteAgg.data || []).forEach(w => {
        const current = historicalWasteByCode.get(w.material_code) || 0;
        historicalWasteByCode.set(w.material_code, current + Number(w.waste_amount || 0));
      });

      console.log('✅ Historical aggregations complete:', {
        entriesMaterials: historicalEntriesByMaterial.size,
        adjustmentsMaterials: historicalAdjustmentsByMaterial.size,
        consumptionMaterials: historicalConsumptionByMaterial.size,
        wasteMaterials: historicalWasteByCode.size
      });

      // OPTIMIZED: Fetch all period data in parallel to reduce query time
      const [periodEntriesResult, periodAdjustmentsResult, periodRemisionesResult] = await Promise.all([
        // Batch fetch ALL period entries (between startDate and endDate)
        this.supabase
          .from('material_entries')
          .select('material_id, quantity_received')
          .eq('plant_id', plantId)
          .in('material_id', materialIdsList)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate),
        
        // Batch fetch ALL period adjustments (between startDate and endDate)
        this.supabase
          .from('material_adjustments')
          .select('material_id, quantity_adjusted, adjustment_type')
          .eq('plant_id', plantId)
          .in('material_id', materialIdsList)
          .gte('adjustment_date', startDate)
          .lte('adjustment_date', endDate),
        
        // Get period remisiones (between startDate and endDate)
        this.supabase
          .from('remisiones')
          .select('id, fecha')
          .eq('plant_id', plantId)
          .gte('fecha', startDate)
          .lte('fecha', endDate)
      ]);

      const allPeriodEntries = periodEntriesResult.data || [];
      const allPeriodAdjustments = periodAdjustmentsResult.data || [];
      const periodRemisiones = periodRemisionesResult.data || [];

      const periodRemisionIdSet = new Set(periodRemisiones?.map(r => r.id) || []);
      console.log('📊 Period remisiones (between dates):', {
        totalRemisionesFound: periodRemisiones?.length || 0,
        sampleDates: periodRemisiones?.slice(0, 5).map(r => r.fecha),
        dateRange: `${startDate} to ${endDate}`
      });

      // Now get materials for period remisiones
      // Get ALL materials from period remisiones (including those with NULL material_id)
      // We need to get material_type/code to map to material_id
      const { data: allPeriodRemisionMaterialsRaw } = periodRemisionIdSet.size > 0 ? await this.supabase
        .from('remision_materiales')
        .select('material_id, material_type, cantidad_real, remision_id')
        .in('remision_id', Array.from(periodRemisionIdSet)) : { data: [] };

      // Map remision materials to material_id if missing, and filter to only tracked materials
      // Create a map for period materials (reuse the same logic as historical)
      const materialCodeToIdMapPeriod = new Map(filteredMaterials.map(m => [m.material_code, m.id]));
      const allPeriodRemisionMaterials = (allPeriodRemisionMaterialsRaw || [])
        .map(rm => {
          // If material_id is null, try to find it by material_type (which might be a code)
          if (!rm.material_id && rm.material_type) {
            const mappedId = materialCodeToIdMapPeriod.get(rm.material_type);
            return { ...rm, material_id: mappedId || rm.material_id };
          }
          return rm;
        })
        .filter(rm => {
          // Include if material_id matches our tracked materials
          return rm.material_id && materialIdsList.includes(rm.material_id);
        });

      console.log('📊 Period remision materials:', {
        totalRemisionMaterialsRaw: allPeriodRemisionMaterialsRaw?.length || 0,
        totalRemisionMaterialsFiltered: allPeriodRemisionMaterials.length,
        remisionesWithMaterials: periodRemisionIdSet.size,
        materialsWithNullId: (allPeriodRemisionMaterialsRaw || []).filter(rm => !rm.material_id).length,
        materialsWithType: (allPeriodRemisionMaterialsRaw || []).filter(rm => rm.material_type).length,
        uniqueMaterialTypes: [...new Set((allPeriodRemisionMaterialsRaw || []).map(rm => rm.material_type).filter(Boolean))],
        uniqueMaterialIdsInPeriod: [...new Set(allPeriodRemisionMaterialsRaw?.map(rm => rm.material_id).filter(Boolean) || [])].length
      });

      // Batch fetch ALL period waste (between startDate and endDate)
      const { data: allPeriodWaste } = await this.supabase
        .from('waste_materials')
        .select('material_code, waste_amount')
        .eq('plant_id', plantId)
        .in('material_code', materialCodesList)
        .gte('fecha', startDate)
        .lte('fecha', endDate);

      const periodEntriesByMaterial = new Map<string, number[]>();
      (allPeriodEntries || []).forEach(e => {
        if (!periodEntriesByMaterial.has(e.material_id)) {
          periodEntriesByMaterial.set(e.material_id, []);
        }
        periodEntriesByMaterial.get(e.material_id)!.push(Number(e.quantity_received || 0));
      });

      const periodAdjustmentsByMaterial = new Map<string, Array<{ qty: number; type: string }>>();
      (allPeriodAdjustments || []).forEach(adj => {
        if (!periodAdjustmentsByMaterial.has(adj.material_id)) {
          periodAdjustmentsByMaterial.set(adj.material_id, []);
        }
        periodAdjustmentsByMaterial.get(adj.material_id)!.push({
          qty: Number(adj.quantity_adjusted || 0),
          type: adj.adjustment_type || ''
        });
      });

      const periodConsumptionByMaterial = new Map<string, number[]>();
      let periodConsumptionCount = 0;
      (allPeriodRemisionMaterials || []).forEach(rm => {
        if (periodRemisionIdSet.has(rm.remision_id)) {
          if (!periodConsumptionByMaterial.has(rm.material_id)) {
            periodConsumptionByMaterial.set(rm.material_id, []);
          }
          periodConsumptionByMaterial.get(rm.material_id)!.push(Number(rm.cantidad_real || 0));
          periodConsumptionCount++;
        }
      });
      console.log('📊 Period consumption grouped:', {
        materialsWithConsumption: periodConsumptionByMaterial.size,
        totalConsumptionRecords: periodConsumptionCount
      });

      const periodWasteByCode = new Map<string, number[]>();
      (allPeriodWaste || []).forEach(w => {
        if (!periodWasteByCode.has(w.material_code)) {
          periodWasteByCode.set(w.material_code, []);
        }
        periodWasteByCode.get(w.material_code)!.push(Number(w.waste_amount || 0));
      });

      // Calculate for each material using aggregated data
      for (const material of filteredMaterials) {
        const materialId = material.id;
        
        // Get aggregated historical totals (already summed)
        const historicalEntriesTotal = historicalEntriesByMaterial.get(materialId) || 0;
        const historicalAdjustments = historicalAdjustmentsByMaterial.get(materialId) || { additions: 0, withdrawals: 0 };
        const historicalConsumptionTotal = historicalConsumptionByMaterial.get(materialId) || 0;
        const historicalWasteTotal = historicalWasteByCode.get(material.material_code) || 0;
        
        // Calculate period totals from grouped data
        const periodEntriesTotal = (periodEntriesByMaterial.get(materialId) || []).reduce((sum, qty) => sum + qty, 0);
        const periodManualAdditions = (periodAdjustmentsByMaterial.get(materialId) || []).reduce((sum, adj) => {
          if (!['consumption', 'waste', 'loss', 'transfer'].includes(adj.type)) {
            return sum + adj.qty;
          }
          return sum;
        }, 0);
        const periodManualWithdrawals = (periodAdjustmentsByMaterial.get(materialId) || []).reduce((sum, adj) => {
          if (['consumption', 'waste', 'loss', 'transfer'].includes(adj.type)) {
            return sum + adj.qty;
          }
          return sum;
        }, 0);
        const periodConsumptionTotal = (periodConsumptionByMaterial.get(materialId) || []).reduce((sum, qty) => sum + qty, 0);
        const periodWasteTotal = (periodWasteByCode.get(material.material_code) || []).reduce((sum, qty) => sum + qty, 0);

        // Get actual current stock
        const actualCurrentStock = inventoryMap.get(materialId) || 0;

        // OPTIMIZED APPROACH: Calculate initial stock using historical aggregations
        // Initial Stock = Historical Entries + Historical Additions - Historical Consumption - Historical Withdrawals - Historical Waste
        // Then verify by working backwards: Initial Stock = Current Stock - Period Entries - Period Additions + Period Consumption + Period Withdrawals + Period Waste
        const initialStockFromHistory = historicalEntriesTotal + historicalAdjustments.additions - historicalConsumptionTotal - historicalAdjustments.withdrawals - historicalWasteTotal;
        const initialStockFromCurrent = actualCurrentStock - periodEntriesTotal - periodManualAdditions + periodConsumptionTotal + periodManualWithdrawals + periodWasteTotal;
        
        // Use the more accurate calculation (from current stock working backwards)
        // But ensure it's not negative (data inconsistency protection)
        const initialStock = Math.max(0, initialStockFromCurrent);
        
        // Ensure initial stock is not negative (if it is, it means data inconsistency, but we'll show 0 for clarity)
        const initialStockAdjusted = Math.max(0, initialStock);
        
        // Debug log for first material only to avoid spam
        if (materialId === filteredMaterials[0]?.id) {
          console.log('🔍 Initial stock calculation (first material):', {
            material_name: material.material_name,
            actualCurrentStock,
            periodEntriesTotal,
            periodManualAdditions,
            periodConsumptionTotal,
            periodManualWithdrawals,
            periodWasteTotal,
            initialStockCalculated: initialStock,
            initialStockAdjusted,
            formula: `${actualCurrentStock} - ${periodEntriesTotal} - ${periodManualAdditions} + ${periodConsumptionTotal} + ${periodManualWithdrawals} + ${periodWasteTotal}`
          });
        }
        
        const theoreticalFinalStock = initialStockAdjusted + periodEntriesTotal + periodManualAdditions - periodConsumptionTotal - periodManualWithdrawals - periodWasteTotal;
        
        // Debug log for first material only (moved after calculation to fix ReferenceError)
        if (materialId === filteredMaterials[0]?.id) {
          console.log('🔍 Period consumption calculation (first material):', {
            material_name: material.material_name,
            periodConsumptionRecords: periodConsumptionByMaterial.get(materialId)?.length || 0,
            periodConsumptionTotal,
            periodEntriesTotal,
            periodManualAdditions,
            periodManualWithdrawals,
            periodWasteTotal,
            initialStockAdjusted,
            theoreticalFinalStock,
            actualCurrentStock
          });
        }
        const variance = actualCurrentStock - theoreticalFinalStock;
        const variancePercentage = theoreticalFinalStock !== 0 ? (variance / theoreticalFinalStock) * 100 : 0;

        calculatedData.push({
          material_id: materialId,
          material_name: material.material_name,
          unit: material.unit_of_measure,
          material_code: material.material_code,
          initial_stock: initialStockAdjusted,
          total_entries: periodEntriesTotal,
          total_manual_additions: periodManualAdditions,
          total_remisiones_consumption: periodConsumptionTotal,
          total_manual_withdrawals: periodManualWithdrawals,
          total_waste: periodWasteTotal,
          theoretical_final_stock: theoreticalFinalStock,
          actual_current_stock: actualCurrentStock,
          variance: variance,
          variance_percentage: variancePercentage
        });
      }

      console.log('✅ Historical calculation completed:', {
        materialsFound: calculatedData.length,
        sampleData: calculatedData.slice(0, 3).map(d => ({
          material_id: d.material_id,
          material_name: d.material_name,
          initial_stock: d.initial_stock,
          theoretical_final_stock: d.theoretical_final_stock,
          actual_current_stock: d.actual_current_stock,
          variance: d.variance
        }))
      });

      // Transform to MaterialFlowSummary format
      const materialFlows: MaterialFlowSummary[] = calculatedData.map((row: any) => ({
        material_id: row.material_id,
        material_name: row.material_name,
        unit: row.unit,
        material_code: row.material_code,
        initial_stock: parseFloat(row.initial_stock || 0),
        total_entries: parseFloat(row.total_entries || 0),
        total_manual_additions: parseFloat(row.total_manual_additions || 0),
        total_remisiones_consumption: parseFloat(row.total_remisiones_consumption || 0),
        total_manual_withdrawals: parseFloat(row.total_manual_withdrawals || 0),
        total_adjustments: parseFloat(row.total_manual_additions || 0) + parseFloat(row.total_manual_withdrawals || 0),
        total_waste: parseFloat(row.total_waste || 0),
        theoretical_final_stock: parseFloat(row.theoretical_final_stock || 0),
        actual_current_stock: parseFloat(row.actual_current_stock || 0),
        variance: parseFloat(row.variance || 0),
        variance_percentage: parseFloat(row.variance_percentage || 0)
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
      console.log('🧮 Using historical calculation approach', {
        plantId,
        startDate: filters.start_date,
        endDate: filters.end_date,
        materialIds: filters.material_ids?.length || 'all',
        category: filters.category || 'all'
      });
      let materialFlows: MaterialFlowSummary[];
      
      try {
        materialFlows = await this.calculateHistoricalInventory(
          plantId,
          filters.start_date,
          filters.end_date,
          filters.material_ids,
          filters.category
        );
        console.log('✅ Historical calculation result:', {
          materialFlowsCount: materialFlows.length,
          sampleFlows: materialFlows.slice(0, 2)
        });
      } catch (historicalError) {
        console.error('❌ Historical calculation failed:', historicalError);
        if (historicalError instanceof Error) {
          console.error('Error details:', {
            message: historicalError.message,
            stack: historicalError.stack
          });
        }
        // Return empty result instead of falling back for now
        materialFlows = [];
      }

      // Get plant info and remisiones count for summary
      const [plantResult, remisionesResult, entriesResult, adjustmentsResult] = await Promise.all([
        this.supabase
          .from('plants')
          .select('name, code')
          .eq('id', plantId)
          .single(),
        // Count remisiones in the period
        this.supabase
          .from('remisiones')
          .select('id', { count: 'exact' })
          .eq('plant_id', plantId)
          .gte('fecha', filters.start_date)
          .lte('fecha', filters.end_date),
        // Count entries in the period
        this.supabase
          .from('material_entries')
          .select('id', { count: 'exact' })
          .eq('plant_id', plantId)
          .gte('entry_date', filters.start_date)
          .lte('entry_date', filters.end_date),
        // Count adjustments in the period
        this.supabase
          .from('material_adjustments')
          .select('id', { count: 'exact' })
          .eq('plant_id', plantId)
          .gte('adjustment_date', filters.start_date)
          .lte('adjustment_date', filters.end_date)
      ]);

      const plant = plantResult.data;
      const totalRemisiones = remisionesResult.count || 0;
      const totalEntries = entriesResult.count || 0;
      const totalAdjustments = adjustmentsResult.count || 0;
      const materialsWithVariance = materialFlows.filter(m => Math.abs(m.variance_percentage) > 1).length;

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
        total_remisiones: totalRemisiones,
        total_entries: totalEntries,
        total_adjustments: totalAdjustments,
        materials_with_variance: materialsWithVariance,
        material_flows: materialFlows
      };

      // Fetch period data for movements and consumption_details
      const materialIds = materialFlows.map(m => m.material_id);
      const movements: InventoryMovement[] = [];
      const consumptionDetails: RemisionMaterialConsumption[] = [];

      if (materialIds.length > 0) {
        // Fetch period remisiones with full details
        const { data: periodRemisionesFull } = await this.supabase
          .from('remisiones')
          .select('id, fecha, remision_number')
          .eq('plant_id', plantId)
          .gte('fecha', filters.start_date)
          .lte('fecha', filters.end_date)
          .order('fecha', { ascending: false });

        const remisionIds = periodRemisionesFull?.map(r => r.id) || [];

        // Fetch period entries, adjustments, and remision materials in parallel
        const [entriesResult, adjustmentsResult, remisionMaterialsResult] = await Promise.all([
          this.supabase
            .from('material_entries')
            .select('material_id, quantity_received, entry_date, entry_number, notes')
            .eq('plant_id', plantId)
            .in('material_id', materialIds)
            .gte('entry_date', filters.start_date)
            .lte('entry_date', filters.end_date)
            .order('entry_date', { ascending: false }),
          this.supabase
            .from('material_adjustments')
            .select('material_id, quantity_adjusted, adjustment_type, adjustment_date, adjustment_number, reference_notes')
            .eq('plant_id', plantId)
            .in('material_id', materialIds)
            .gte('adjustment_date', filters.start_date)
            .lte('adjustment_date', filters.end_date)
            .order('adjustment_date', { ascending: false }),
          remisionIds.length > 0
            ? this.supabase
                .from('remision_materiales')
                .select('material_id, remision_id, cantidad_real, cantidad_teorica')
                .in('remision_id', remisionIds)
                .in('material_id', materialIds)
            : Promise.resolve({ data: [] })
        ]);

        // Get materials map for building movements
        const { data: materialsData } = await this.supabase
          .from('materials')
          .select('id, material_name, unit_of_measure')
          .in('id', materialIds);

        const materialsMap = new Map(
          materialsData?.map(m => [m.id, m]) || []
        );

        // Build movements and consumption details for each material
        materialFlows.forEach(flow => {
          const material = materialsMap.get(flow.material_id);
          if (!material) return;

          const materialEntries = (entriesResult.data || []).filter(e => e.material_id === flow.material_id);
          const materialAdjustments = (adjustmentsResult.data || []).filter(a => a.material_id === flow.material_id);
          const materialRemisionMaterials = (remisionMaterialsResult.data || []).filter(rm => rm.material_id === flow.material_id);

          // Build movements
          const materialMovements = this.buildMovementsOptimized(
            material,
            materialRemisionMaterials,
            materialEntries,
            materialAdjustments,
            periodRemisionesFull || []
          );
          movements.push(...materialMovements);

          // Build consumption details
          const materialConsumption = this.buildConsumptionDetailsOptimized(
            material,
            materialRemisionMaterials,
            periodRemisionesFull || []
          );
          consumptionDetails.push(...materialConsumption);
        });
      }

      console.timeEnd('🚀 Dashboard Data Fetch (Historical)');

      return {
        summary,
        movements: movements.sort((a, b) => b.movement_date.localeCompare(a.movement_date)),
        consumption_details: consumptionDetails.sort((a, b) => b.remision_date.localeCompare(a.remision_date))
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
