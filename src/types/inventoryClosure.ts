export type ClosureStatus =
  | 'draft'
  | 'physical_count'
  | 'reconciled'
  | 'justified'
  | 'sealed'
  | 'cancelled';

export type PhysicalCountUnit = 'kg' | 'm3' | 'ton' | 'unit';

export type VolumetricWeightSourceClosure =
  | 'quality_study'
  | 'closure_override'
  | 'po_item'
  | 'supplier_agreement'
  | 'material_default'
  | 'entry';

export interface InventoryClosure {
  id: string;
  plant_id: string;
  period_start: string;   // YYYY-MM-DD
  period_end: string;     // YYYY-MM-DD
  status: ClosureStatus;
  initiated_by: string;
  initiated_at: string;
  signed_by?: string | null;
  signed_at?: string | null;
  signature_image_url?: string | null;
  variance_threshold_pct: number;
  notes?: string | null;
  excel_export_path?: string | null;
  parent_closure_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  plant?: { id: string; name: string; code?: string | null } | null;
  initiated_by_user?: { id: string; first_name: string; last_name: string } | null;
  signed_by_user?: { id: string; first_name: string; last_name: string } | null;
}

export interface InventoryClosureMaterial {
  id: string;
  closure_id: string;
  material_id: string;

  // Theoretical snapshot
  initial_stock_kg: number;
  period_entries_kg: number;
  period_consumption_kg: number;
  period_adjustments_kg: number;
  period_waste_kg: number;
  theoretical_final_kg: number;

  // Physical count
  physical_count_value?: number | null;
  physical_count_unit?: PhysicalCountUnit | null;
  volumetric_weight_kg_per_m3?: number | null;
  volumetric_weight_source?: VolumetricWeightSourceClosure | null;
  quality_study_id?: string | null;

  // Derived
  physical_count_kg?: number | null;
  variance_kg?: number | null;
  variance_pct?: number | null;
  requires_justification: boolean;
  justification_text?: string | null;

  // Created at seal
  adjustment_id?: string | null;

  created_at: string;
  updated_at: string;

  // Joined
  material?: {
    id: string;
    material_code?: string;
    material_name: string;
    category: string;
    unit_of_measure: string;
    bulk_density_kg_per_m3?: number | null;
  } | null;
  evidence?: InventoryClosureEvidence[];
}

export interface InventoryClosureEvidence {
  id: string;
  closure_id: string;
  material_id?: string | null;
  file_path: string;
  file_type?: string | null;
  original_name: string;
  uploaded_by: string;
  uploaded_at: string;
  // For display: signed URL resolved on fetch
  signed_url?: string | null;
}

// Full payload returned by GET /[id]
export interface InventoryClosureDetail extends InventoryClosure {
  materials: InventoryClosureMaterial[];
  evidence: InventoryClosureEvidence[];
}

// Input for initiating a closure
export interface InitiateClosureInput {
  plant_id: string;
  period_start: string;
  period_end: string;
  variance_threshold_pct?: number;
  notes?: string;
  parent_closure_id?: string;
}

// Input for bulk-upserting physical counts
export interface PhysicalCountInput {
  material_id: string;
  physical_count_value: number;
  physical_count_unit: PhysicalCountUnit;
  volumetric_weight_kg_per_m3?: number;
  volumetric_weight_source?: VolumetricWeightSourceClosure;
  quality_study_id?: string;
}

// Input for justification step
export interface JustificationInput {
  material_id: string;
  justification_text: string;
}

// Input for seal step
export interface SealClosureInput {
  signed_by: string;
  signature_image_url: string;
}

// Summary item in list view
export interface InventoryClosureSummary {
  id: string;
  plant_id: string;
  plant_name: string;
  period_start: string;
  period_end: string;
  status: ClosureStatus;
  initiated_at: string;
  initiated_by_name: string;
  sealed_at?: string | null;
  material_count: number;
  materials_requiring_justification: number;
  parent_closure_id?: string | null;
}
