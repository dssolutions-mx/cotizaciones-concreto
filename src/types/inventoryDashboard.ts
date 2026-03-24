/**
 * Dashboard summary for dosificador Material Command Center
 * (mirrors GET /api/inventory/dashboard-summary response rows)
 */
export type MaterialHealth = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface DashboardMaterialSummary {
  material_id: string;
  material_name: string;
  category: string | null;
  unit_of_measure: string | null;
  current_stock_kg: number;
  reorder_point_kg: number | null;
  reorder_qty_kg: number | null;
  reorder_config_id: string | null;
  health: MaterialHealth;
  fill_ratio: number;
  active_alerts: Array<{
    id: string;
    alert_number: string;
    status: string;
    confirmation_deadline: string | null;
  }>;
}

export interface DashboardSummaryResponse {
  success: boolean;
  plant_id: string;
  materials: DashboardMaterialSummary[];
  summary: {
    material_count: number;
    pending_confirmation_alerts: number;
    critical_count: number;
    warning_count: number;
  };
}
