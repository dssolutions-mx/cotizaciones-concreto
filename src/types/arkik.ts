export type ArkikMaterialCode = string;
export type ArkikMeasureKey = 'teorica' | 'real';

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
  PRODUCT_CODE_MISMATCH = 'PRODUCT_CODE_MISMATCH'
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
  // Suggestions (derived)
  suggested_client_id?: string;
  suggested_client_name?: string;
  suggested_site_id?: string;
  suggested_site_name?: string;
}

export interface OrderSuggestion {
  group_key: string;
  client_id: string;
  construction_site_id?: string;
  obra_name: string;
  comentarios_externos: string[];
  date_range: { start: Date; end: Date };
  remisiones: StagingRemision[];
  total_volume: number;
  suggested_name: string;
  recipe_codes: Set<string>;
  validation_issues: ValidationError[];
}

export interface PlantMaterialMapping {
  plant_id: string;
  arkik_code_to_material_id: Record<string, string>;
}

export interface RemisionInsertPayload {
  order_id: string;
  remision_number: string;
  fecha: string;
  hora_carga: string;
  volumen_fabricado: number;
  conductor?: string | null;
  unidad?: string | null;
  tipo_remision: 'CONCRETO';
}

export interface RemisionMaterialInsert {
  remision_id: string;
  material_type: string;
  cantidad_teorica: number;
  cantidad_real: number;
}


