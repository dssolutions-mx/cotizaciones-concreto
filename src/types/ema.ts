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

export type ResultadoVerificacion = 'conforme' | 'no_conforme' | 'condicional';

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

export type TipoChecklist =
  | 'recepcion'
  | 'periodico'
  | 'post_calibracion'
  | 'post_incidente';

export type EstadoGeneralChecklist = 'bueno' | 'regular' | 'malo' | 'fuera_de_servicio';

/** Estado snapshot stored at moment of muestreo/ensayo registration */
export type EstadoSnapshot = 'vigente' | 'proximo_vencer' | 'vencido';

// ─────────────────────────────────────────
// modelos_instrumento
// ─────────────────────────────────────────

export interface ModeloInstrumento {
  id: string;
  nombre_modelo: string;
  categoria: string;
  tipo_defecto: TipoInstrumento;
  periodo_calibracion_dias: number;
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

export type CreateModeloInput = Omit<ModeloInstrumento,
  'id' | 'created_by' | 'created_at' | 'updated_at'>;

export type UpdateModeloInput = Partial<CreateModeloInput>;

// ─────────────────────────────────────────
// instrumentos
// ─────────────────────────────────────────

export interface Instrumento {
  id: string;
  codigo: string;
  nombre: string;
  modelo_id: string;
  tipo: TipoInstrumento;
  plant_id: string;
  numero_serie: string | null;
  marca: string | null;
  modelo_comercial: string | null;
  instrumento_maestro_id: string | null;  // only for Type C
  periodo_calibracion_dias: number | null; // null = inherit from model
  estado: EstadoInstrumento;
  fecha_proximo_evento: string | null;    // ISO date
  motivo_inactivo: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Instrumento with joined relations for detail views */
export interface InstrumentoDetalle extends Instrumento {
  modelo: ModeloInstrumento;
  instrumento_maestro?: Instrumento | null;
  plant?: { id: string; name: string; code: string };
  /** Effective period considering model default */
  periodo_efectivo_dias: number;
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

export type CreateInstrumentoInput = Omit<Instrumento,
  'id' | 'estado' | 'created_by' | 'created_at' | 'updated_at'>;

export type UpdateInstrumentoInput = Partial<Pick<Instrumento,
  'nombre' | 'numero_serie' | 'marca' | 'modelo_comercial' |
  'instrumento_maestro_id' | 'periodo_calibracion_dias' |
  'estado' | 'motivo_inactivo' | 'notas'>>;

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
// verificaciones_internas
// ─────────────────────────────────────────

/** Individual reading point in a verification */
export interface LecturaVerificacion {
  punto: string;            // e.g. "500 kN", "Punto 1", "25 °C"
  lectura_maestro: number;  // Master instrument reading
  lectura_trabajo: number;  // Working instrument reading
  desviacion: number;       // Difference (trabajo - maestro)
  unidad: string;           // Unit of measurement
}

export interface VerificacionInterna {
  id: string;
  instrumento_id: string;          // Type C instrument being verified
  instrumento_maestro_id: string;  // Type A instrument used
  fecha_verificacion: string;      // ISO date
  fecha_proxima_verificacion: string; // ISO date
  resultado: ResultadoVerificacion;
  lecturas: LecturaVerificacion[];   // Measurement comparison data
  criterio_aceptacion: string | null; // e.g. "±1% de la lectura"
  condiciones_ambientales: CondicionesAmbientales | null;
  observaciones: string | null;
  realizado_por: string | null;
  created_at: string;
}

export interface VerificacionInternaDetalle extends VerificacionInterna {
  instrumento_maestro?: InstrumentoCard;
  realizado_por_profile?: { id: string; full_name: string };
}

export type CreateVerificacionInput = Omit<VerificacionInterna,
  'id' | 'created_at'>;

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
// checklist_instrumento
// ─────────────────────────────────────────

export interface ChecklistItem {
  item_nombre: string;
  passed: boolean;
  observacion: string;
}

export interface ChecklistInstrumento {
  id: string;
  instrumento_id: string;
  tipo_checklist: TipoChecklist;
  fecha_inspeccion: string;    // ISO date
  realizado_por: string | null;
  estado_general: EstadoGeneralChecklist;
  items: ChecklistItem[];
  observaciones_generales: string | null;
  created_at: string;
}

export type CreateChecklistInput = Omit<ChecklistInstrumento,
  'id' | 'created_at'>;

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

/** Trazabilidad view from instrument perspective */
export interface InstrumentoTrazabilidad {
  instrumento: InstrumentoDetalle;
  certificados: CertificadoCalibracion[];
  verificaciones: VerificacionInternaDetalle[];
  muestreos_count: number;
  ensayos_count: number;
  ultimo_muestreo_fecha: string | null;
  muestreos: TrazabilidadUsoMuestreo[];
  ensayos: TrazabilidadUsoEnsayo[];
}
