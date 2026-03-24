/**
 * Material Alert & Reorder Types
 *
 * Implements the 9-step materials flow from SOP POL-OPE-003:
 * 1. System auto-alert on low stock
 * 2. Dosificador physical verification
 * 3. Dosificador confirms alert (4h deadline)
 * 4. Jefe de Planta validates need
 * 5. Jefe BU approves PO if needed
 * 6. Admin coordinates delivery
 * 7. Supplier delivers
 * 8. Dosificador receives with 3-way verification
 * 9. Accounting close
 */

export type AlertStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'expired'
  | 'pending_validation'
  | 'validated'
  | 'pending_po'
  | 'po_linked'
  | 'delivery_scheduled'
  | 'delivered'
  | 'closed'
  | 'cancelled';

export interface MaterialAlert {
  id: string;
  alert_number: string;
  plant_id: string;
  material_id: string;
  reorder_config_id?: string | null;

  // Trigger context
  triggered_at: string;
  triggered_stock_kg: number;
  reorder_point_kg: number;

  // Lifecycle
  status: AlertStatus;

  // Dosificador confirmation (Steps 2-3)
  confirmation_deadline?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  physical_count_kg?: number | null;
  discrepancy_kg?: number | null;
  discrepancy_notes?: string | null;

  // Jefe validation (Step 4)
  validated_by?: string | null;
  validated_at?: string | null;
  existing_po_id?: string | null;
  validation_notes?: string | null;

  // Delivery scheduling (Step 6)
  scheduled_delivery_date?: string | null;
  scheduled_by?: string | null;
  scheduled_at?: string | null;

  // Resolution
  resolved_entry_id?: string | null;
  resolved_lot_id?: string | null;
  resolved_at?: string | null;

  created_at: string;
  updated_at: string;

  // Optional joined data
  material?: {
    id: string;
    material_name: string;
    category: string;
    unit_of_measure: string;
  };
  plant?: {
    id: string;
    name: string;
    code: string;
  };
  confirmed_by_user?: {
    first_name: string;
    last_name: string;
  };
  validated_by_user?: {
    first_name: string;
    last_name: string;
  };
  scheduled_by_user?: {
    first_name: string;
    last_name: string;
  };
}

export interface MaterialAlertEvent {
  id: string;
  alert_id: string;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  performed_by?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
  performed_by_user?: {
    first_name: string;
    last_name: string;
  };
}

export interface ReorderConfig {
  id: string;
  plant_id: string;
  material_id: string;
  reorder_point_kg: number;
  reorder_qty_kg?: number | null;
  configured_by: string;
  configured_at: string;
  is_active: boolean;
  notes?: string | null;
  material?: {
    id: string;
    material_name: string;
    category: string;
  };
}

export interface PlantShiftConfig {
  id: string;
  plant_id: string;
  shift_name: string;
  start_time: string;  // HH:MM:SS
  end_time: string;    // HH:MM:SS
  is_active: boolean;
}

// API input types
export interface ConfirmAlertInput {
  physical_count_kg: number;
  discrepancy_notes?: string;
}

export interface ValidateAlertInput {
  existing_po_id?: string;
  validation_notes?: string;
  needs_new_po?: boolean;
}

export interface ScheduleDeliveryInput {
  scheduled_delivery_date: string;
}

export interface ResolveAlertInput {
  entry_id: string;
  lot_id?: string;
}

export interface ReorderConfigInput {
  plant_id: string;
  material_id: string;
  reorder_point_kg: number;
  reorder_qty_kg?: number;
  notes?: string;
}

export interface AlertFilters {
  plant_id?: string;
  status?: AlertStatus | AlertStatus[];
  material_id?: string;
  date_from?: string;
  date_to?: string;
}

/** Dosificador-initiated request: enters workflow at pending_validation (no 4h confirmation step). */
export interface ManualMaterialRequestInput {
  plant_id: string;
  material_id: string;
  notes?: string;
  estimated_need_kg?: number;
}
