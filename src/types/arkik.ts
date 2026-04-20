export type ArkikMaterialCode = string;
export type ArkikMeasureKey = 'teorica' | 'real' | 'retrabajo' | 'manual';

export enum ArkikErrorType {
  CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND',
  CONSTRUCTION_SITE_NOT_FOUND = 'CONSTRUCTION_SITE_NOT_FOUND',
  RECIPE_NOT_FOUND = 'RECIPE_NOT_FOUND',
  RECIPE_NO_PRICE = 'RECIPE_NO_PRICE',
  MATERIAL_NOT_FOUND = 'MATERIAL_NOT_FOUND',
  DUPLICATE_REMISION = 'DUPLICATE_REMISION',
  INVALID_DATE = 'INVALID_DATE',
  INVALID_VOLUME = 'INVALID_VOLUME',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  DATA_TYPE_ERROR = 'DATA_TYPE_ERROR',
  PRODUCT_CODE_MISMATCH = 'PRODUCT_CODE_MISMATCH',
  ZERO_MATERIAL_TERMINADO = 'ZERO_MATERIAL_TERMINADO'
}

// Duplicate Handling Types
export enum DuplicateHandlingStrategy {
  SKIP = 'skip',                    // Skip duplicate remisiones entirely
  UPDATE_MATERIALS_ONLY = 'update_materials_only',  // Only update materials data
  UPDATE_ALL = 'update_all',        // Update all data (overwrite existing)
  MERGE = 'merge',                  // Merge data intelligently
  SKIP_NEW_ONLY = 'skip_new_only'  // Skip only new duplicates, process existing ones
}

export interface DuplicateRemisionInfo {
  remision_number: string;
  existing_remision_id: string;
  existing_order_id: string;
  existing_order_number: string;
  existing_data: {
    fecha: string;
    volumen_fabricado: number;
    client_id?: string;
    construction_site_id?: string;
    recipe_id: string;
    has_materials: boolean;
    has_status_decisions: boolean;
    has_reassignments: boolean;
    has_waste_materials: boolean;
    status: string;
  };
  new_data: {
    fecha: Date;
    volumen_fabricado: number;
    materials_teorico: Record<string, number>;
    materials_real: Record<string, number>;
    materials_retrabajo: Record<string, number>;
    materials_manual: Record<string, number>;
  };
  differences: {
    volume_changed: boolean;
    materials_changed: boolean;
    date_changed: boolean;
    materials_missing: boolean;
  };
  suggested_strategy: DuplicateHandlingStrategy;
  risk_level: 'low' | 'medium' | 'high';
  notes: string[];
}

export interface DuplicateHandlingDecision {
  remision_number: string;
  strategy: DuplicateHandlingStrategy;
  custom_notes?: string;
  preserve_existing_data?: boolean;
  update_materials_only?: boolean;
  skip_entirely?: boolean;
}

export interface DuplicateHandlingResult {
  total_duplicates: number;
  processed_duplicates: number;
  skipped_duplicates: number;
  updated_materials: number;
  updated_all: number;
  merged: number;
  decisions: DuplicateHandlingDecision[];
  summary: {
    low_risk: number;
    medium_risk: number;
    high_risk: number;
    materials_only_updates: number;
    full_updates: number;
    skipped: number;
  };
}

// Enhanced Status Processing Types
export enum RemisionStatus {
  TERMINADO = 'terminado',
  TERMINADO_INCOMPLETO = 'terminado incompleto', 
  CANCELADO = 'cancelado',
  PENDIENTE = 'pendiente'
}

export enum StatusProcessingAction {
  PROCEED_NORMAL = 'proceed_normal',        // Terminado - process normally
  REASSIGN_TO_EXISTING = 'reassign_to_existing',  // Reassign to another remision
  MARK_AS_WASTE = 'mark_as_waste',          // Mark materials as waste
  MARK_AS_CROSS_PLANT_PRODUCTION = 'mark_as_cross_plant_production',  // Produced here, billed at another plant (Plant B side)
  MARK_AS_CROSS_PLANT_BILLING = 'mark_as_cross_plant_billing'  // Billed here, produced at another plant (Plant A side)
}

export interface RemisionReassignment {
  source_remision_id: string;
  source_remision_number: string;
  target_remision_id: string;
  target_remision_number: string;
  materials_to_transfer: Record<string, number>;
  reason: string;
  created_at: Date;
}

export interface WasteMaterial {
  id: string;
  session_id: string;
  remision_number: string;
  material_code: string;
  material_name?: string;
  /** Resolved from materials table at save time (optional until persisted) */
  material_id?: string | null;
  theoretical_amount: number;
  actual_amount: number;
  waste_amount: number;
  waste_reason: 'cancelled' | 'incomplete' | 'quality_issue' | 'other';
  plant_id: string;
  fecha: Date;
  /** User-facing reason / context (dialog + optional notes) */
  notes?: string;
  created_at: Date;
}

export interface StatusProcessingDecision {
  remision_id: string;
  remision_number: string;
  original_status: string;
  action: StatusProcessingAction;
  target_remision_number?: string;
  materials_to_transfer?: Record<string, number>;
  waste_reason?: string;
  notes?: string;
  // Cross-plant production fields
  target_plant_id?: string;
  target_plant_name?: string;
  cross_plant_confirmed?: boolean;  // true = preview found the billing remision, false = pending resolution
}

export interface StatusProcessingResult {
  total_remisiones: number;
  processed_remisiones: number;
  normal_remisiones: number;
  reassigned_remisiones: number;
  waste_remisiones: number;
  excluded_remisiones: number;
  cross_plant_remisiones: number;
  decisions: StatusProcessingDecision[];
  waste_materials: WasteMaterial[];
  reassignments: RemisionReassignment[];
}

export interface ArkikRawRow {
  orden: string | null;
  remision: string;
  estatus: string;
  volumen: number;
  cliente_codigo: string;
  cliente_nombre: string;
  rfc: string;
  obra: string;
  punto_entrega: string;
  prod_comercial: string;
  prod_tecnico: string;
  product_description: string;
  comentarios_internos: string;
  comentarios_externos: string;
  elementos: string;
  camion: string;
  placas: string;
  chofer: string;
  bombeable: string;
  fecha: Date;
  hora_carga: Date;
  materials: Record<ArkikMaterialCode, Record<ArkikMeasureKey, number>>;
}

export interface ValidationError {
  row_number: number;
  error_type: ArkikErrorType;
  field_name: string;
  field_value: any;
  message: string;
  suggestion?: any;
  recoverable: boolean;
}

export interface StagingRemision {
  id: string;
  session_id: string;
  row_number: number;
  orden_original?: string;
  fecha: Date;
  hora_carga: Date;
  remision_number: string;
  estatus: string;
  volumen_fabricado: number;
  cliente_codigo: string;
  cliente_name: string;
  rfc?: string;
  obra_name: string;
  punto_entrega?: string;
  comentarios_externos?: string;
  comentarios_internos?: string;
  prod_comercial?: string;
  prod_tecnico: string;
  product_description?: string;
  recipe_code?: string;
  camion?: string;
  placas?: string;
  conductor?: string;
  bombeable?: boolean;
  elementos?: string;
  client_id?: string;
  construction_site_id?: string;
  recipe_id?: string;
  master_recipe_id?: string; // NEW: Master recipe for order matching
  truck_id?: string;
  driver_id?: string;
  suggested_order_group: string;
  suggested_order_id?: string;
  materials_teorico: Record<string, number>;
  materials_real: Record<string, number>;
  materials_retrabajo?: Record<string, number>;
  materials_manual?: Record<string, number>;
  validation_status: 'pending' | 'valid' | 'warning' | 'error';
  validation_errors: ValidationError[];
  // Pricing (derived)
  unit_price?: number | null;
  price_source?: 'client_site' | 'client' | 'plant' | 'none';
  quote_id?: string;
  quote_detail_id?: string; // CRITICAL: Required for order creation
  // Suggestions (derived)
  suggested_client_id?: string;
  suggested_client_name?: string;
  suggested_site_id?: string;
  suggested_site_name?: string;
  // Status Processing (enhanced)
  status_processing_action?: StatusProcessingAction;
  target_remision_for_reassignment?: string;
  is_excluded_from_import?: boolean;
  waste_reason?: string;
  status_processing_notes?: string;
  // Duplicate Handling (new)
  is_duplicate_update?: boolean;
  duplicate_strategy?: 'materials_only' | 'update_all' | 'merge' | 'skip';
  existing_remision_id?: string;
  preserve_existing_data?: boolean;
  // Cross-plant production
  is_production_record?: boolean;
  cancelled_reason?: string;
  cross_plant_target_plant_id?: string;
  cross_plant_target_plant_name?: string;
  cross_plant_target_remision_number?: string;
  cross_plant_confirmed?: boolean;
  transferred_materials?: Record<string, number>;
}

export interface OrderSuggestion {
  group_key: string;
  client_id: string;
  construction_site_id?: string;
  obra_name: string;
  comentarios_externos: string[];
  /** Distinct non-empty Comentarios Internos from grouped remisiones (Excel → orders.comentarios_internos). */
  comentarios_internos: string[];
  /** Distinct non-empty Elementos column values (Excel → orders.elemento). */
  elementos: string[];
  date_range: { start: Date; end: Date };
  remisiones: StagingRemision[];
  total_volume: number;
  suggested_name: string;
  recipe_codes: Set<string>;
  validation_issues: ValidationError[];
  // Additional fields for existing order support
  existing_order_id?: string;
  existing_order_number?: string;
  match_score?: number;
  match_reasons?: string[];
  is_existing_order?: boolean;
  /** Present on some manual-assignment suggestions (legacy UI). */
  id?: string;
  construction_site?: string;
  delivery_date?: string;
  delivery_time?: string;
  quote_id?: string;
  quote_detail_id?: string;
  cliente_name?: string;
  total_amount?: number;
  prod_comercial?: string;
  prod_tecnico?: string;
  bombeable?: boolean;
}

export interface PlantMaterialMapping {
  plant_id: string;
  arkik_code_to_material_id: Record<string, string>;
}

export interface RemisionInsertPayload {
  order_id: string | null;
  remision_number: string;
  fecha: string;
  hora_carga: string;
  volumen_fabricado: number;
  conductor?: string | null;
  unidad?: string | null;
  tipo_remision: 'CONCRETO';
  is_production_record?: boolean;
  cancelled_reason?: string | null;
  cross_plant_billing_plant_id?: string | null;
}

export interface RemisionMaterialInsert {
  remision_id: string;
  material_type: string;
  cantidad_teorica: number;
  cantidad_real: number;
  ajuste?: number; // Sum of retrabajo + manual
}


