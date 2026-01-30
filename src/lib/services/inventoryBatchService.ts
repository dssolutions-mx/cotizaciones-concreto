/**
 * Inventory Batch Processing Service
 * 
 * Optimizes inventory updates for bulk operations (Arkik imports).
 * Use this service when importing large numbers of remisiones to avoid
 * triggering individual inventory updates for each remision_materiales record.
 */

import { supabase } from '@/lib/supabase/client';

export interface BatchInventoryUpdateResult {
  success: boolean;
  materialsUpdated: number;
  inventoryChanges: Array<{
    material_id: string;
    plant_id: string;
    total_consumption: number;
    inventory_before: number;
    inventory_after: number;
  }>;
  error?: string;
}

export class InventoryBatchService {
  /**
   * Batch update inventory for multiple remisiones
   * 
   * This is more efficient than individual triggers when processing
   * bulk imports (e.g., 100+ remisiones from Arkik files).
   * 
   * @param remisionIds Array of remision IDs to process
   * @returns Result with inventory changes
   */
  static async batchUpdateInventory(
    remisionIds: string[]
  ): Promise<BatchInventoryUpdateResult> {
    try {
      if (!remisionIds || remisionIds.length === 0) {
        return {
          success: true,
          materialsUpdated: 0,
          inventoryChanges: []
        };
      }

      // Call the batch update function
      const { data, error } = await supabase.rpc(
        'batch_update_inventory_from_remisiones',
        { remision_ids: remisionIds }
      );

      if (error) {
        console.error('[InventoryBatchService] Error in batch update:', error);
        return {
          success: false,
          materialsUpdated: 0,
          inventoryChanges: [],
          error: error.message
        };
      }

      return {
        success: true,
        materialsUpdated: data?.length || 0,
        inventoryChanges: (data || []).map((row: any) => ({
          material_id: row.material_id,
          plant_id: row.plant_id,
          total_consumption: Number(row.total_consumption),
          inventory_before: Number(row.inventory_before),
          inventory_after: Number(row.inventory_after)
        }))
      };
    } catch (error) {
      console.error('[InventoryBatchService] Unexpected error:', error);
      return {
        success: false,
        materialsUpdated: 0,
        inventoryChanges: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Disable inventory trigger temporarily for bulk operations
   * 
   * WARNING: Use with extreme caution. Always re-enable the trigger
   * and call batchUpdateInventory() after bulk inserts.
   * 
   * @returns Success status
   */
  static async disableTrigger(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('disable_inventory_trigger');
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Re-enable inventory trigger after bulk operations
   * 
   * @returns Success status
   */
  static async enableTrigger(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('enable_inventory_trigger');
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process bulk remision imports with optimized inventory updates
   * 
   * This is the recommended method for bulk Arkik imports:
   * 1. Disable trigger
   * 2. Insert remisiones and remision_materiales
   * 3. Re-enable trigger
   * 4. Batch update inventory
   * 
   * @param remisionIds Array of remision IDs that were inserted
   * @returns Result with inventory changes
   */
  static async processBulkImport(
    remisionIds: string[]
  ): Promise<BatchInventoryUpdateResult> {
    try {
      // Step 1: Disable trigger
      const disableResult = await this.disableTrigger();
      if (!disableResult.success) {
        return {
          success: false,
          materialsUpdated: 0,
          inventoryChanges: [],
          error: `Failed to disable trigger: ${disableResult.error}`
        };
      }

      // Step 2: Batch update inventory (trigger is disabled, so this handles all updates)
      const updateResult = await this.batchUpdateInventory(remisionIds);

      // Step 3: Re-enable trigger (important!)
      const enableResult = await this.enableTrigger();
      if (!enableResult.success) {
        console.error('[InventoryBatchService] WARNING: Failed to re-enable trigger!', enableResult.error);
        // Don't fail the operation, but log the error
      }

      return updateResult;
    } catch (error) {
      // Ensure trigger is re-enabled even on error
      await this.enableTrigger();
      
      return {
        success: false,
        materialsUpdated: 0,
        inventoryChanges: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
