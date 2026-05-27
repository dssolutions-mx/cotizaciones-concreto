export const LABORATORIO_PROTOCOL_TYPES = [
  'formulacion',
  'validacion_receta',
  'sustitucion_material',
  'calibracion_proceso',
  'punto_curva',
  'otro',
] as const;

export type LaboratorioProtocolType = (typeof LABORATORIO_PROTOCOL_TYPES)[number];

export const LABORATORIO_LOTE_STATUSES = [
  'borrador',
  'muestreado',
  'cerrado',
  'evaluado',
] as const;

export type LaboratorioLoteStatus = (typeof LABORATORIO_LOTE_STATUSES)[number];

export const PROTOCOL_TYPE_LABELS: Record<LaboratorioProtocolType, string> = {
  formulacion: 'Formulación',
  validacion_receta: 'Validación de receta',
  sustitucion_material: 'Sustitución de material',
  calibracion_proceso: 'Calibración de proceso',
  punto_curva: 'Punto de curva (Abrams)',
  otro: 'Otro',
};

export type RecipeSnapshotMaterial = {
  material_id: string;
  material_type: string;
  quantity: number;
  unit: string;
};

export type RecipeSnapshot = {
  recipe_code: string;
  strength_fc: number | null;
  age_days: number | null;
  age_hours: number | null;
  slump: number | null;
  materials: RecipeSnapshotMaterial[];
};

export type LaboratorioLoteMaterial = {
  id: string;
  laboratorio_lote_id: string;
  material_id: string;
  material_type: string;
  cantidad_teorica: number | null;
  cantidad_real: number | null;
  unit: string | null;
  created_at?: string;
};

export type LaboratorioLoteMaterialInput = {
  material_id: string;
  material_type: string;
  cantidad_teorica?: number | null;
  cantidad_real?: number | null;
  unit?: string | null;
};

export type LaboratorioLote = {
  id: string;
  plant_id: string;
  lote_number: string;
  study_name: string;
  protocol_type: LaboratorioProtocolType;
  hypothesis_notes?: string | null;
  study_description?: string | null;
  notes?: string | null;
  fecha: string;
  hora_elaboracion: string;
  volumen_m3: number;
  recipe_id?: string | null;
  recipe_version_id?: string | null;
  master_recipe_id?: string | null;
  recipe_snapshot?: RecipeSnapshot | null;
  concrete_specs?: {
    clasificacion?: 'FC' | 'MR';
    unidad_edad?: 'DÍA' | 'HORA' | string;
    valor_edad?: number;
  } | null;
  designacion_ehe?: string | null;
  status: LaboratorioLoteStatus;
  outcome_notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LaboratorioLoteMuestraEnsayo = {
  id: string;
  resistencia_calculada?: number | null;
  porcentaje_cumplimiento?: number | null;
  fecha_ensayo?: string | null;
};

export type LaboratorioLoteMuestra = {
  id: string;
  tipo_muestra?: string | null;
  estado?: string | null;
  identificacion?: string | null;
  fecha_programada_ensayo?: string | null;
  ensayos?: LaboratorioLoteMuestraEnsayo[];
};

export type LaboratorioLoteMuestreo = {
  id: string;
  fecha_muestreo: string;
  numero_muestreo?: number | null;
  sampling_type?: string | null;
  muestras?: LaboratorioLoteMuestra[];
};

export type LaboratorioLoteWithRelations = LaboratorioLote & {
  materials?: LaboratorioLoteMaterial[];
  recipe?: { id: string; recipe_code: string; strength_fc?: number | null } | null;
  plant?: { id: string; code: string; name: string } | null;
  muestreos?: LaboratorioLoteMuestreo[];
};

export type UpdateLaboratorioLoteInput = {
  study_name?: string;
  protocol_type?: LaboratorioProtocolType;
  hypothesis_notes?: string | null;
  study_description?: string | null;
  notes?: string | null;
  fecha?: string;
  hora_elaboracion?: string;
  volumen_m3?: number;
  recipe_id?: string | null;
  concrete_specs?: LaboratorioLote['concrete_specs'];
  designacion_ehe?: string | null;
  materials?: LaboratorioLoteMaterialInput[];
};

export type CreateLaboratorioLoteInput = {
  plant_id: string;
  study_name: string;
  protocol_type: LaboratorioProtocolType;
  hypothesis_notes?: string | null;
  study_description?: string | null;
  notes?: string | null;
  fecha: string;
  hora_elaboracion: string;
  volumen_m3: number;
  recipe_id?: string | null;
  concrete_specs?: LaboratorioLote['concrete_specs'];
  designacion_ehe?: string | null;
  materials: LaboratorioLoteMaterialInput[];
  created_by?: string;
};
