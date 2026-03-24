/**
 * Material Lot Types
 *
 * A lot represents a received batch of material with centralized cost info.
 * Each lot is 1:1 with a material_entry and carries the landed cost
 * (material price + fleet cost per kg).
 */

export interface MaterialLot {
  id: string;
  lot_number: string;
  entry_id: string;
  plant_id: string;
  material_id: string;
  supplier_id?: string | null;

  // Cost aggregation
  material_unit_price: number;
  fleet_cost: number;
  received_qty_kg: number;
  fleet_unit_cost: number;       // GENERATED: fleet_cost / received_qty_kg
  landed_unit_price: number;     // GENERATED: material_unit_price + fleet_unit_cost
  remaining_quantity_kg: number | null;

  // PO references (denormalized)
  material_po_id?: string | null;
  material_po_item_id?: string | null;
  fleet_po_id?: string | null;
  fleet_po_item_id?: string | null;

  // Quality/metadata
  quality_certificate_url?: string | null;
  quality_status: 'pending' | 'approved' | 'rejected' | 'na';
  expiry_date?: string | null;
  notes?: string | null;

  // Audit
  created_at: string;
  updated_at: string;

  // Optional joined data
  material?: {
    id: string;
    material_name: string;
    category: string;
    unit_of_measure: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
  entry?: {
    id: string;
    entry_number: string;
    entry_date: string;
    entry_time: string;
  };
}

export interface MaterialLotDetail extends MaterialLot {
  allocations?: LotAllocationSummary[];
  total_consumed_kg?: number;
  total_cost_consumed?: number;
}

export interface LotAllocationSummary {
  id: string;
  remision_id: string;
  remision_number?: string;
  remision_date?: string;
  quantity_consumed_kg: number;
  unit_price: number;
  total_cost: number;
  consumption_date: string;
}

export interface LotCostBreakdown {
  lot_id: string;
  lot_number: string;
  material_unit_price: number;
  fleet_cost: number;
  fleet_unit_cost: number;
  landed_unit_price: number;
  received_qty_kg: number;
  remaining_quantity_kg: number;
  total_material_value: number;    // material_unit_price * received_qty_kg
  total_fleet_value: number;       // fleet_cost
  total_landed_value: number;      // landed_unit_price * received_qty_kg
  consumed_qty_kg: number;
  consumed_value: number;
}

export interface LotFilters {
  plant_id?: string;
  material_id?: string;
  supplier_id?: string;
  date_from?: string;
  date_to?: string;
  has_remaining?: boolean;
  quality_status?: 'pending' | 'approved' | 'rejected' | 'na';
  limit?: number;
  offset?: number;
}

export interface LotMetadataUpdate {
  quality_certificate_url?: string;
  quality_status?: 'pending' | 'approved' | 'rejected' | 'na';
  expiry_date?: string | null;
  notes?: string;
}
