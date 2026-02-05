export type POStatus = 'open' | 'partial' | 'fulfilled' | 'cancelled';
export type MaterialUom = 'kg' | 'l' | 'm3';
export type ServiceUom = 'trips' | 'tons' | 'hours' | 'loads' | 'units';
export type POItemUom = MaterialUom | ServiceUom;

export interface PurchaseOrder {
  id: string;
  plant_id: string;
  supplier_id: string;
  currency: 'MXN';
  status: POStatus;
  notes?: string;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
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
  // Computed
  qty_remaining?: number; // remaining in native UoM
}


