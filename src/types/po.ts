export type POStatus = 'open' | 'partial' | 'fulfilled' | 'cancelled';
export type MaterialUom = 'kg' | 'l' | 'm3';
export type ServiceUom = 'trips' | 'tons' | 'hours' | 'loads' | 'units';
export type POItemUom = MaterialUom | ServiceUom;

export interface PurchaseOrder {
  id: string;
  po_number?: string | null; // Human-readable PO reference (auto-generated, e.g. PO-2026-00001)
  plant_id: string;
  supplier_id: string;
  currency: 'MXN';
  status: POStatus;
  notes?: string;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
  po_date?: string | null;
  payment_terms_days?: number | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  is_service: boolean; // true for fleet/services
  material_id?: string | null;
  uom?: POItemUom | null;
  qty_ordered: number; // In native UoM for materials (kg/l/m3) and services (their own UoM)
  // Native and kg tracking for materials (services do not use kg)
  qty_received_native?: number; // e.g., m3 or l for materials; service native (trips, etc.)
  qty_received_kg?: number; // only for materials when conversion applies
  unit_price: number;
  status: POStatus;
  required_by?: string;
  created_at: string;
  // Optional conversion info for materials in m3
  volumetric_weight_kg_per_m3?: number; // if defined, locks entry conversion
  // Fleet PO material supplier linking (only for fleet/service items)
  material_supplier_id?: string | null; // Links fleet PO to specific material supplier for distance-based pricing
  // Credit/discount tracking
  credit_amount?: number | null; // Total credit/discount applied to this PO item
  credit_applied_at?: string | null; // When credit was applied
  credit_applied_by?: string | null; // User who applied the credit
  credit_notes?: string | null; // Notes about the credit
  original_unit_price?: number | null; // Original unit_price before credit (for audit trail)
  // Computed
  qty_remaining?: number; // remaining in native UoM
}

export interface POCreditHistoryEntry {
  id: string;
  po_item_id: string;
  applied_amount: number;
  cumulative_amount_after: number;
  unit_price_before: number;
  unit_price_after: number;
  notes?: string | null;
  applied_by?: string | null;
  applied_at: string;
}
