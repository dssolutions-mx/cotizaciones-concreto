/**
 * EMA Instrument Traceability Module Types
 *
 * Supports EMA (Entidad Mexicana de Acreditación) certification compliance.
 * Instruments are classified by traceability chain:
 *   Type A (maestro)  → externally calibrated, verifies Type C
 *   Type B (externo)  → externally calibrated, standalone
 *   Type C (trabajo)  → internally verified using a Type A instrument
 *
 * Traceability is captured at two levels:
 *   muestreo_instrumentos → sampling event (cone, thermometer)
 *   ensayo_instrumentos   → individual test (press, caliper)
 */

// ─────────────────────────────────────────
// Enums / union types
// ─────────────────────────────────────────

export type TipoInstrumento = 'A' | 'B' | 'C';

export type EstadoInstrumento =
  | 'vigente'
  | 'proximo_vencer'
  | 'vencido'
  | 'en_revision'
  | 'inactivo';

export type ResultadoVerificacion = 'conforme' | 'no_conforme' | 'condicional' | 'pendiente';

export type TipoEvento =
  | 'calibracion_externa'
  | 'verificacion_interna'
  | 'verificacion_post_incidente';

export type EstadoPrograma = 'pendiente' | 'completado' | 'vencido' | 'cancelado';

export type TipoIncidente =
  | 'dano_fisico'
  | 'perdida'
  | 'mal_funcionamiento'
  | 'desviacion_lectura'
  | 'otro';

export type SeveridadIncidente = 'baja' | 'media' | 'alta' | 'critica';

export type EstadoIncidente = 'abierto' | 'en_revision' | 'resuelto' | 'cerrado';

/** Estado snapshot stored at moment of muestreo/ensayo registration */
export type EstadoSnapshot = 'vigente' | 'proximo_vencer' | 'vencido';

// ─────────────────────────────────────────
// conjuntos_herramientas
// ─────────────────────────────────────────

export type TipoServicio = 'calibracion' | 'verificacion' | 'ninguno';

export interface ConjuntoHerramientas {
  id: string;
  codigo_conjunto: string;         // 'NN' or 'NNN' — unique, owns DC-CC-NN prefix
  nombre_conjunto: string;
  categoria: string;
  tipo_defecto: TipoInstrumento;
  tipo_servicio: TipoServicio;
  mes_inicio_servicio: number | null;  // 1-12; null when tipo_servicio = 'ninguno'
  mes_fin_servicio: number | null;     // 1-12
  cadencia_meses: number;              // default 12
  secuencia_actual: number;            // last NN auto-assigned
  norma_referencia: string | null;     // e.g. "NMX-C-083-ONNCCE-2014"
  unidad_medicion: string | null;      // e.g. "kN", "°C", "kg"
  rango_medicion_tipico: string | null; // e.g. "0-2000 kN"
  descripcion: string | null;
  business_unit_id: string | null;
  manual_path: string | null;
  instrucciones_path: string | null;
  documentos_adicionales: DocumentoAdicional[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentoAdicional {
  nombre: string;
  path: string;
}

export type CreateConjuntoInput = Omit<ConjuntoHerramientas,
  'id' | 'secuencia_actual' | 'created_by' | 'created_at' | 'updated_at'>;

export type UpdateConjuntoInput = Partial<CreateConjuntoInput>;

// ─────────────────────────────────────────
// instrumentos
// ─────────────────────────────────────────

export interface Instrumento {
  id: string;
  codigo: string;                          // 'DC-CC-NN' — server-generated
  nombre: string;
  conjunto_id: string;
  tipo: TipoInstrumento;
  plant_id: string;
  numero_serie: string | null;
  marca: string | null;
  modelo_comercial: string | null;
  instrumento_maestro_id: string | null;   // only for Type C
  mes_inicio_servicio_override: number | null; // per-instrument window override
  mes_fin_servicio_override: number | null;
  ubicacion_dentro_planta: string | null;
  fecha_alta: string | null;               // ISO date
  fecha_baja: string | null;               // ISO date — null if vigente
  baja_observaciones: string | null;
  estado: EstadoInstrumento;
  fecha_proximo_evento: string | null;     // ISO date
  motivo_inactivo: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Effective service window for an instrument (after override resolution) */
export interface EffectiveServiceWindow {
  tipo_servicio: TipoServicio;
  mes_inicio: number | null;
  mes_fin: number | null;
  cadencia_meses: number;
  from_override: boolean;
}

/** Instrumento with joined relations for detail views */
export interface InstrumentoDetalle extends Instrumento {
  conjunto: ConjuntoHerramientas;
  instrumento_maestro?: Instrumento | null;
  plant?: { id: string; name: string; code: string };
  /** Effective window resolved from override → conjunto */
  ventana_efectiva: EffectiveServiceWindow;
}

/** Lightweight card for lists and pickers */
export interface InstrumentoCard {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoInstrumento;
  categoria: string;
  estado: EstadoInstrumento;
  fecha_proximo_evento: string | null;
  plant_id: string;
  marca: string | null;
  modelo_comercial: string | null;
}

/** Payload for creating an instrument — server generates `codigo` via ema_next_instrument_code. */
export type CreateInstrumentoInput = Omit<Instrumento,
  'id' | 'codigo' | 'estado' | 'created_by' | 'created_at' | 'updated_at'>;

export type UpdateInstrumentoInput = Partial<Pick<Instrumento,
  'nombre' | 'tipo' | 'numero_serie' | 'marca' | 'modelo_comercial' |
  'instrumento_maestro_id' | 'plant_id' |
  'mes_inicio_servicio_override' | 'mes_fin_servicio_override' |
  'ubicacion_dentro_planta' | 'fecha_alta' | 'fecha_baja' | 'baja_observaciones' |
  'estado' | 'fecha_proximo_evento' | 'motivo_inactivo' | 'notas'>>;

// ─────────────────────────────────────────
// mantenimientos_instrumento (Phase-1 preventive-maintenance log)
// ─────────────────────────────────────────

export interface MantenimientoInstrumento {
  id: string;
  instrumento_id: string;
  fecha_mantenimiento: string;               // ISO date
  fecha_proximo_mantenimiento: string | null; // ISO date
  descripcion: string | null;
  realizado_por: string | null;
  notas: string | null;
  created_at: string;
  created_by: string | null;
}

export type CreateMantenimientoInput = Omit<MantenimientoInstrumento,
  'id' | 'created_at' | 'created_by'>;

// ─────────────────────────────────────────
// certificados_calibracion
// ─────────────────────────────────────────

export interface CertificadoCalibracion {
  id: string;
  instrumento_id: string;
  numero_certificado: string | null;
  laboratorio_externo: string;
  acreditacion_laboratorio: string | null;  // EMA accreditation number (e.g. "CAL-123-456/24")
  metodo_calibracion: string | null;        // Calibration method/standard reference
  fecha_emision: string;       // ISO date
  fecha_vencimiento: string;   // ISO date
  archivo_path: string;        // Storage: calibration-certificates
  // Measurement uncertainty (NMX-EC-17025 §5.4.6)
  incertidumbre_expandida: number | null;   // Expanded uncertainty U (±)
  incertidumbre_unidad: string | null;      // Unit for uncertainty value
  factor_cobertura: number | null;          // Coverage factor k (typically 2)
  rango_medicion: string | null;            // Calibrated range e.g. "0-2000 kN"
  condiciones_ambientales: CondicionesAmbientales | null;
  tecnico_responsable: string | null;       // Calibration technician name
  observaciones: string | null;
  is_vigente: boolean;
  created_by: string | null;
  created_at: string;
}

/** Environmental conditions during calibration/verification */
export interface CondicionesAmbientales {
  temperatura?: string;   // e.g. "22 ± 1 °C"
  humedad?: string;       // e.g. "45 ± 5 %HR"
  presion?: string;       // e.g. "780 mmHg" (calibration only)
}

export type CreateCertificadoInput = Omit<CertificadoCalibracion,
  'id' | 'is_vigente' | 'created_by' | 'created_at'>;

// ─────────────────────────────────────────
// Verification Templates (Phase 2) — per conjunto_herramientas
// ─────────────────────────────────────────

export type EstadoTemplate = 'borrador' | 'publicado' | 'archivado';

export type TipoItemVerificacion =
  | 'medicion'          // numeric measurement against expected ± tolerance
  | 'booleano'          // ¿Cumple? Sí/No
  | 'numero'            // free numeric (no tolerance)
  | 'texto'             // free text
  | 'calculado'         // derived from other items via `formula`
  | 'referencia_equipo'; // free-text pointer to calibration standard used

export type ToleranciaTipo = 'absoluta' | 'porcentual' | 'rango';

/** Section layout (v2 plantillas). Legacy snapshots may omit `layout`. */
export type SectionLayout = 'linear' | 'instrument_grid' | 'reference_series';

/** Storage primitive for template item values */
export type ItemPrimitive = 'numero' | 'booleano' | 'texto';

/** Semantic role — drives validation & UI */
export type ItemRole =
  | 'input_medicion'
  | 'input_numero'
  | 'input_booleano'
  | 'input_texto'
  | 'input_referencia'
  | 'derivado'
  | 'reference_point';

/** JSONB pass/fail rule attached to items that contribute to cumple */
export type PassFailRule =
  | { kind: 'none' }
  | { kind: 'tolerance_abs'; expected: number; tolerance: number; unit?: string | null }
  | { kind: 'tolerance_pct'; expected: number; tolerance_pct: number; unit?: string | null }
  | { kind: 'range'; min: number | null; max: number | null; unit?: string | null }
  | { kind: 'expected_bool'; value: boolean }
  | { kind: 'expression'; expr: string }
  /** Generalized bound — any combination of fixed min/max and formula-resolved min_formula/max_formula.
   *  min_formula / max_formula are evaluated against the header + measurement scope. */
  | { kind: 'formula_bound'; min?: number | null; max?: number | null; min_formula?: string | null; max_formula?: string | null; unit?: string | null };

export interface InstancesConfig {
  min_count: number;
  max_count: number;
  instance_label?: string;
  codigo_required?: boolean;
}

export interface SeriesDerivedColumn {
  name: string;
  formula: string;
}

/** Reference series (balanza / flexómetro rows) */
export interface SeriesConfig {
  reference_variable?: string;
  input_variable?: string;
  unit?: string | null;
  points?: number[];
  row_pass_expr?: string | null;
  derived?: SeriesDerivedColumn[];
}

export interface VerificacionTemplateHeaderField {
  id: string;
  template_id: string;
  orden: number;
  field_key: string;
  label: string;
  source: 'instrumento' | 'manual' | 'computed';
  variable_name: string | null;
  formula: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificacionTemplate {
  id: string;
  conjunto_id: string;
  codigo: string;                      // e.g. "DCEMA-HC-LC-6.4-01"
  nombre: string;
  norma_referencia: string | null;
  descripcion: string | null;
  estado: EstadoTemplate;
  active_version_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface VerificacionTemplateSection {
  id: string;
  template_id: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
  repetible: boolean;
  repeticiones_default: number;
  /** v2: linear | instrument_grid | reference_series */
  layout?: SectionLayout;
  instances_config?: InstancesConfig;
  series_config?: SeriesConfig;
  evidencia_config: { min_photos?: number; labels?: string[] };
  created_at: string;
  updated_at: string;
}

export interface VerificacionTemplateItem {
  id: string;
  section_id: string;
  orden: number;
  tipo: TipoItemVerificacion;
  punto: string;
  valor_esperado: number | null;
  tolerancia: number | null;
  tolerancia_tipo: ToleranciaTipo;
  tolerancia_min: number | null;
  tolerancia_max: number | null;
  unidad: string | null;
  formula: string | null;
  requerido: boolean;
  observacion_prompt: string | null;
  /** v2 */
  primitive?: ItemPrimitive | null;
  item_role?: ItemRole | null;
  variable_name?: string | null;
  pass_fail_rule?: PassFailRule | null;
  contributes_to_cumple?: boolean;
  depends_on?: string[] | null;
  created_at: string;
  updated_at: string;
}

/** Snapshot stored in verificacion_template_versions.snapshot */
export interface VerificacionTemplateSnapshot {
  template: Pick<VerificacionTemplate,
    'id' | 'codigo' | 'nombre' | 'norma_referencia' | 'descripcion'>;
  sections: Array<
    VerificacionTemplateSection & { items: VerificacionTemplateItem[] }
  >;
  /** When absent in stored JSON, API may merge from `verificacion_template_header_fields`. */
  header_fields?: VerificacionTemplateHeaderField[];
}

export interface VerificacionTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  snapshot: VerificacionTemplateSnapshot;
  published_at: string;
  published_by: string | null;
}

/** Template + draft children + version metadata */
export interface VerificacionTemplateDetalle extends VerificacionTemplate {
  sections: Array<
    VerificacionTemplateSection & { items: VerificacionTemplateItem[] }
  >;
  header_fields?: VerificacionTemplateHeaderField[];
  active_version: VerificacionTemplateVersion | null;
  versions_count: number;
}

// ─────────────────────────────────────────
// Completed verifications (execution)
// ─────────────────────────────────────────

export type EstadoCompletedVerificacion =
  | 'en_proceso'
  | 'firmado_operador'
  | 'firmado_revisor'
  | 'cerrado'
  | 'cancelado';

export type RolFirma = 'elaborado' | 'revisado';

export interface CompletedVerificacion {
  id: string;
  instrumento_id: string;
  template_version_id: string;
  instrumento_maestro_id: string | null;
  fecha_verificacion: string;            // ISO date
  fecha_proxima_verificacion: string | null;
  resultado: ResultadoVerificacion;      // includes 'pendiente'
  condiciones_ambientales: CondicionesAmbientales | null;
  observaciones_generales: string | null;
  estado: EstadoCompletedVerificacion;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface CompletedVerificacionMeasurement {
  id: string;
  completed_id: string;
  section_id: string;
  section_repeticion: number;
  item_id: string;
  valor_observado: number | null;
  valor_booleano: boolean | null;
  valor_texto: string | null;
  error_calculado: number | null;
  cumple: boolean | null;
  observacion: string | null;
  /** v2: código de instancia en grilla de instrumentos */
  instance_code?: string | null;
  /** v2: valor patrón de la fila en serie de referencia */
  reference_point_value?: number | null;
  created_at: string;
  updated_at: string;
}

export interface VerificacionEvidencia {
  id: string;
  completed_id: string;
  section_id: string | null;
  section_repeticion: number | null;
  storage_path: string;
  mime_type: string | null;
  caption: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface VerificacionSignature {
  id: string;
  completed_id: string;
  rol: RolFirma;
  signer_user_id: string;
  signer_name: string;
  signature_storage_path: string;
  signed_at: string;
}

export interface VerificacionIssue {
  id: string;
  completed_id: string;
  measurement_id: string | null;
  severidad: SeveridadIncidente | null;
  descripcion: string;
  estado: 'abierta' | 'en_proceso' | 'resuelta' | 'ignorada';
  resuelto_por: string | null;
  resuelto_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface CompletedVerificacionDetalle extends CompletedVerificacion {
  snapshot: VerificacionTemplateSnapshot;
  template_version_number: number | null;
  measurements: CompletedVerificacionMeasurement[];
  evidencias: VerificacionEvidencia[];
  signatures: VerificacionSignature[];
  issues: VerificacionIssue[];
  instrumento?: InstrumentoCard;
  instrumento_maestro?: InstrumentoCard | null;
  created_by_profile?: { id: string; full_name: string } | null;
}

export type CreateCompletedVerificacionInput = {
  instrumento_id: string;
  template_version_id: string;
  instrumento_maestro_id?: string | null;
  fecha_verificacion?: string;
  condiciones_ambientales?: CondicionesAmbientales | null;
};

export type UpsertMeasurementInput = {
  section_id: string;
  section_repeticion?: number;
  item_id: string;
  valor_observado?: number | null;
  valor_booleano?: boolean | null;
  valor_texto?: string | null;
  observacion?: string | null;
};

export type UpdateCompletedVerificacionInput = Partial<Pick<CompletedVerificacion,
  'instrumento_maestro_id' | 'fecha_verificacion' | 'fecha_proxima_verificacion' |
  'resultado' | 'condiciones_ambientales' | 'observaciones_generales' | 'estado'>>;

// ─────────────────────────────────────────
// programa_calibraciones
// ─────────────────────────────────────────

export interface ProgramaCalibracion {
  id: string;
  instrumento_id: string;
  tipo_evento: TipoEvento;
  fecha_programada: string;  // ISO date
  estado: EstadoPrograma;
  certificado_id: string | null;
  verificacion_id: string | null;
  notif_7dias_enviada: boolean;
  notif_1dia_enviada: boolean;
  roles_notificar: string[];
  completado_en: string | null;
  completado_por: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramaCalibacionConInstrumento extends ProgramaCalibracion {
  instrumento: InstrumentoCard;
}

// ─────────────────────────────────────────
// paquetes_equipo
// ─────────────────────────────────────────

export interface PaqueteEquipo {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo_prueba: string | null;
  business_unit_id: string | null;
  plant_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaqueteInstrumento {
  id: string;
  paquete_id: string;
  instrumento_id: string;
  orden: number;
  is_required: boolean;
}

/** Package with its instruments loaded */
export interface PaqueteConInstrumentos extends PaqueteEquipo {
  instrumentos: Array<PaqueteInstrumento & { instrumento: InstrumentoCard }>;
}

export type CreatePaqueteInput = Omit<PaqueteEquipo,
  'id' | 'created_by' | 'created_at' | 'updated_at'>;

// ─────────────────────────────────────────
// muestreo_instrumentos / ensayo_instrumentos
// (immutable snapshots)
// ─────────────────────────────────────────

export interface MuestreoInstrumento {
  id: string;
  muestreo_id: string;
  instrumento_id: string;
  paquete_id: string | null;
  estado_al_momento: EstadoSnapshot;
  fecha_vencimiento_al_momento: string;   // ISO date — immutable
  instrumento_maestro_snap_id: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface EnsayoInstrumento {
  id: string;
  ensayo_id: string;
  instrumento_id: string;
  estado_al_momento: EstadoSnapshot;
  fecha_vencimiento_al_momento: string;   // ISO date — immutable
  instrumento_maestro_snap_id: string | null;
  observaciones: string | null;
  created_at: string;
}

/** Used when building snapshots before saving */
export interface InstrumentoSeleccionado {
  instrumento: InstrumentoCard;
  paquete_id?: string;
  observaciones?: string;
}

// ─────────────────────────────────────────
// incidentes_instrumento
// ─────────────────────────────────────────

export interface IncidenteInstrumento {
  id: string;
  instrumento_id: string;
  tipo: TipoIncidente;
  severidad: SeveridadIncidente;
  descripcion: string;
  fecha_incidente: string;      // ISO date
  reportado_por: string | null;
  estado: EstadoIncidente;
  resolucion: string | null;
  resuelto_por: string | null;
  resuelto_en: string | null;
  evidencia_paths: string[];
  programa_id: string | null;   // auto-created for alta/critica
  created_at: string;
  updated_at: string;
}

export type CreateIncidenteInput = Omit<IncidenteInstrumento,
  'id' | 'estado' | 'resolucion' | 'resuelto_por' | 'resuelto_en' |
  'programa_id' | 'created_at' | 'updated_at'>;

export type ResolverIncidenteInput = {
  resolucion: string;
};

// ─────────────────────────────────────────
// ema_configuracion
// ─────────────────────────────────────────

export interface EmaConfiguracion {
  id: string;
  bloquear_vencidos: boolean;
  dias_alerta_proximo_vencer: number;
  roles_notificar_vencimiento: string[];
  updated_by: string | null;
  updated_at: string;
}

export type UpdateEmaConfigInput = Partial<Pick<EmaConfiguracion,
  'bloquear_vencidos' | 'dias_alerta_proximo_vencer' | 'roles_notificar_vencimiento'>>;

// ─────────────────────────────────────────
// API response / query types
// ─────────────────────────────────────────

export interface InstrumentosListParams {
  plant_id?: string;
  business_unit_id?: string;
  tipo?: TipoInstrumento;
  estado?: EstadoInstrumento;
  categoria?: string;
  conjunto_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProgramaCalendarParams {
  plant_id?: string;
  business_unit_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  tipo_evento?: TipoEvento;
  estado?: EstadoPrograma;
}

/** Result returned when checking instruments before muestreo/ensayo save */
export interface InstrumentosValidationResult {
  valid: boolean;
  bloquear_vencidos: boolean;
  vencidos: InstrumentoCard[];
  proximo_vencer: InstrumentoCard[];
}

/** Latest usage rows for tab Trazabilidad (instrument detail) */
export interface TrazabilidadUsoMuestreo {
  id: string;
  muestreo_id: string;
  fecha_muestreo: string | null;
  estado_al_momento: EstadoSnapshot;
}

export interface TrazabilidadUsoEnsayo {
  id: string;
  ensayo_id: string;
  fecha_ensayo: string | null;
  estado_al_momento: EstadoSnapshot;
}

/** Lightweight summary of a completed verification for lists */
export interface CompletedVerificacionCard {
  id: string;
  fecha_verificacion: string;
  fecha_proxima_verificacion: string | null;
  resultado: ResultadoVerificacion;
  estado: EstadoCompletedVerificacion;
  template_codigo: string;
  template_version_number: number;
  created_by_name: string | null;
  created_at: string;
}

/** Trazabilidad view from instrument perspective */
export interface InstrumentoTrazabilidad {
  instrumento: InstrumentoDetalle;
  certificados: CertificadoCalibracion[];
  verificaciones: CompletedVerificacionCard[];
  muestreos_count: number;
  ensayos_count: number;
  ultimo_muestreo_fecha: string | null;
  muestreos: TrazabilidadUsoMuestreo[];
  ensayos: TrazabilidadUsoEnsayo[];
}
