/**
 * Inventory Monitoring Service
 * 
 * Provides monitoring and health check capabilities for the inventory system.
 * Use this to track performance, identify bottlenecks, and monitor system health.
 */

import { supabase } from '@/lib/supabase/client';

export interface InventoryHealthMetric {
  metric_name: string;
  metric_value: number;
  status: 'OK' | 'CAUTION' | 'WARNING' | 'HIGH' | 'LOW' | 'INFO';
  message: string;
}

export interface MaterialUpdateFrequency {
  material_name: string;
  material_code: string;
  plant_id: string;
  plant_name: string;
  current_stock: number;
  updates_last_24h: number;
  updates_last_7d: number;
  last_update_time: string;
}

export interface DailyInventorySummary {
  log_date: string;
  plant_id: string;
  plant_name: string;
  total_entries: number;
  total_adjustments: number;
  total_consumption: number;
  is_closed: boolean;
  actual_entries_count: number;
  actual_adjustments_count: number;
  remisiones_count: number;
}

export class InventoryMonitoringService {
  /**
   * Get inventory system health metrics
   */
  static async getSystemHealth(): Promise<InventoryHealthMetric[]> {
    try {
      const { data, error } = await supabase.rpc('get_inventory_system_health');

      if (error) {
        console.error('[InventoryMonitoringService] Error getting health:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        metric_name: row.metric_name,
        metric_value: Number(row.metric_value),
        status: row.status as InventoryHealthMetric['status'],
        message: row.message
      }));
    } catch (error) {
      console.error('[InventoryMonitoringService] Unexpected error:', error);
      return [];
    }
  }

  /**
   * Get material update frequency
   */
  static async getMaterialUpdateFrequency(): Promise<MaterialUpdateFrequency[]> {
    try {
      const { data, error } = await supabase
        .from('vw_material_update_frequency')
        .select('*')
        .order('updates_last_24h', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[InventoryMonitoringService] Error getting update frequency:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        material_name: row.material_name,
        material_code: row.material_code,
        plant_id: row.plant_id,
        plant_name: row.plant_name,
        current_stock: Number(row.current_stock),
        updates_last_24h: Number(row.updates_last_24h || 0),
        updates_last_7d: Number(row.updates_last_7d || 0),
        last_update_time: row.last_update_time
      }));
    } catch (error) {
      console.error('[InventoryMonitoringService] Unexpected error:', error);
      return [];
    }
  }

  /**
   * Get daily inventory summary
   */
  static async getDailySummary(
    startDate?: string,
    endDate?: string,
    plantId?: string
  ): Promise<DailyInventorySummary[]> {
    try {
      let query = supabase
        .from('vw_daily_inventory_summary')
        .select('*')
        .order('log_date', { ascending: false })
        .limit(100);

      if (startDate) {
        query = query.gte('log_date', startDate);
      }

      if (endDate) {
        query = query.lte('log_date', endDate);
      }

      if (plantId) {
        query = query.eq('plant_id', plantId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[InventoryMonitoringService] Error getting daily summary:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        log_date: row.log_date,
        plant_id: row.plant_id,
        plant_name: row.plant_name,
        total_entries: Number(row.total_entries || 0),
        total_adjustments: Number(row.total_adjustments || 0),
        total_consumption: Number(row.total_consumption || 0),
        is_closed: Boolean(row.is_closed),
        actual_entries_count: Number(row.actual_entries_count || 0),
        actual_adjustments_count: Number(row.actual_adjustments_count || 0),
        remisiones_count: Number(row.remisiones_count || 0)
      }));
    } catch (error) {
      console.error('[InventoryMonitoringService] Unexpected error:', error);
      return [];
    }
  }

  /**
   * Get lock status and table statistics
   */
  static async getLockStatus(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('vw_inventory_lock_status')
        .select('*');

      if (error) {
        console.error('[InventoryMonitoringService] Error getting lock status:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[InventoryMonitoringService] Unexpected error:', error);
      return [];
    }
  }

  /**
   * Check if system needs maintenance (VACUUM, etc.)
   */
  static async checkMaintenanceNeeded(): Promise<{
    needsVacuum: boolean;
    tablesNeedingVacuum: string[];
    deadRowRatios: Record<string, number>;
  }> {
    try {
      const lockStatus = await this.getLockStatus();
      const tablesNeedingVacuum: string[] = [];
      const deadRowRatios: Record<string, number> = {};

      lockStatus.forEach((table: any) => {
        const ratio = Number(table.dead_row_percentage || 0);
        deadRowRatios[table.table_name] = ratio;

        // Flag tables with >10% dead rows
        if (ratio > 10) {
          tablesNeedingVacuum.push(table.table_name);
        }
      });

      return {
        needsVacuum: tablesNeedingVacuum.length > 0,
        tablesNeedingVacuum,
        deadRowRatios
      };
    } catch (error) {
      console.error('[InventoryMonitoringService] Error checking maintenance:', error);
      return {
        needsVacuum: false,
        tablesNeedingVacuum: [],
        deadRowRatios: {}
      };
    }
  }
}
