/**
 * TypeScript DTOs for the EMA Measurement Uncertainty module.
 * NMX-EC-17025-IMNC-2018 §7.6 / JCGM 100:2008 (GUM)
 */

import type { BudgetResult, UncertaintyComponent } from '@/lib/ema/uncertaintyBudget';

// Re-export engine types for use across the app
export type {
  BudgetResult,
  UncertaintyComponent,
  TypeBInput,
  ExtraTypeAInput,
  VerificationPoint,
  VerificationBudgetResult,
} from '@/lib/ema/uncertaintyBudget';

// ---------------------------------------------------------------------------
// GUM reference entry (stored in gum_references_json)
// ---------------------------------------------------------------------------
export interface GumReference {
  step: string;          // e.g. 'u_A'
  ref: string;           // e.g. 'GUM §4.2.3'
  formula: string;       // e.g. 'u_A = s/√n'
  formula_display?: string;
}

// ---------------------------------------------------------------------------
// Measurand catalogue
// ---------------------------------------------------------------------------
export type MeasurandCodigo = 'TEMP' | 'REV' | 'AIRE' | 'MU' | 'FC' | 'FC_CUBO' | 'VIGAS';

export interface UncertaintyMeasurand {
  id: string;
  codigo: MeasurandCodigo;
  nombre: string;
  unidad: string;
  metodo_norma: string;
  formula_expr: string | null;
  formula_descr: string | null;
  documento_codigo: string | null;
  gum_references_json: GumReference[];
  is_active: boolean;
  created_at: string;
  inputs?: UncertaintyMeasurandInput[];
  recommended_contributors_json?: RecommendedContributor[] | null;
}

/**
 * A recommended contributor for the study's "Contribuyentes según norma + GUM" wizard.
 * The `mode` drives the UI: each mode is rendered differently and may auto-include,
 * deep-link, or prompt the user to add.
 *
 * - `auto-replicas`: Type A repetibilidad, computed automatically from the study's
 *   replicates. Wizard renders as included; no add button.
 * - `auto-from-instrument`: Type B calibración pulled from the linked verification
 *   or external cert. Wizard renders as included when present, missing when not.
 *   Already contains the instrument's resolution per GUM §4.3.4 — DO NOT add
 *   "Resolución" separately when this is present.
 * - `stopgap-only-when-no-cert`: Type B resolution = (divMin/2)/√3. Only meaningful
 *   when no cert/verification exists; otherwise hidden as ⚪ "ya incluida en
 *   Calibración" with a tooltip.
 * - `auto-anova`: Type A reproducibility, computed automatically by the engine
 *   when ≥2 operators × ≥2 replicas exist.
 */
export interface RecommendedContributor {
  key: string;
  nombre_display: string;
  tipo_ab: 'A' | 'B';
  mode: 'auto-replicas' | 'auto-from-instrument' | 'stopgap-only-when-no-cert' | 'auto-anova';
  b_subtipo?: 'resolucion' | 'rectangular' | 'triangular' | 'normal' | 'u-shaped';
  defaults?: { div_min?: number; half_width?: number; unidad?: string };
  norma_ref?: string;
  descripcion?: string;
}

export type MeasurandInputKind =
  | 'measured'
  | 'constant'
  | 'derived'
  | 'environmental'
  | 'method'
  | 'systematic';

/** Geometry discriminator — only relevant for FC_CUBO vs FC (cilindro). */
export type FCGeometria = 'cilindro' | 'cubo';

export interface UncertaintyMeasurandInput {
  id: string;
  measurand_id: string;
  simbolo: string;
  nombre_display: string;
  unidad: string;
  kind: MeasurandInputKind;
  /** 'A' or 'B' — explicit classification matching GUM §4.2 / §4.3 */
  tipo_ab: 'A' | 'B' | null;
  default_resolucion: number | null;
  /** Half-width for rectangular Type B contributors (environmental/method/systematic) */
  default_semiamplitud: number | null;
  default_distribucion: 'normal' | 'rectangular' | 'triangular' | 'u-shaped';
  default_divisor: number;
  sensitivity_expr: string | null;
  /** Specific norm clause governing this contributor (e.g. 'NMX-C-156 §6.3') */
  norma_ref: string | null;
  /** Human-readable description shown in the UI as a tooltip */
  descripcion: string | null;
  /** Which specimen geometry this input applies to */
  aplica_geometria: 'cilindro' | 'cubo' | 'ambos' | null;
  orden: number;
}


// ---------------------------------------------------------------------------
// Study
// ---------------------------------------------------------------------------
export type StudyEstado = 'borrador' | 'publicado' | 'reemplazado';

/** Study-level participants / instruments (Config tab); ISO 5725-2 design roster */
export interface UncertaintyEquipoPool {
  operator_ids: string[];
  instrumento_ids: string[];
  /**
   * Optional role assignment per instrument, keyed by instrumento_id.
   * Values are `MeasurandInstrumentRole.key` strings from MEASURAND_INSTRUMENT_ROLES.
   *
   * Multi-input measurands (FC, FC_CUBO, VIGAS) require two physical instrument types
   * (e.g. Prensa for load, Vernier for dimensions). Without role assignment the engine
   * cannot apply the correct GUM sensitivity coefficient to each instrument's calibration U.
   *
   * Single-input measurands (TEMP, REV, AIRE) leave this field absent — all pool
   * instruments implicitly cover the single measured symbol with c_i = 1.
   *
   * Example (VIGAS):
   *   { "uuid-prensa": "carga", "uuid-vernier": "dimensiones" }
   */
  instrumento_roles?: Record<string, string>;
}

export interface UncertaintyStudy {
  id: string;
  measurand_id: string;
  plant_id: string | null;
  fecha_estudio: string;  // ISO date
  n_replicas: number;
  estado: StudyEstado;
  published_at: string | null;
  published_by: string | null;
  valid_until: string | null;
  documento_codigo: string | null;
  notas: string | null;
  equipo_pool_json?: UncertaintyEquipoPool | null;
  env_overrides?: Record<string, number> | null;
  /**
   * Per-study list of measurand-input `simbolo` values to EXCLUDE from the budget.
   * `buildStudyInput` skips any seeded measurand input whose simbolo appears here.
   * Useful when a lab's actual test conditions don't include a particular seeded
   * contributor (e.g., the lab doesn't cap cubes, so `capping` should be removed
   * from a specific FC_CUBO study). Published studies snapshot presupuesto_json,
   * so the exclusion list never retroactively changes a published budget.
   */
  excluded_input_simbolos?: string[] | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  // Joined
  measurand?: UncertaintyMeasurand;
  replicas?: UncertaintyStudyReplica[];
  budget?: UncertaintyStudyBudget;
}

// ---------------------------------------------------------------------------
// Replica
// ---------------------------------------------------------------------------
export interface UncertaintyStudyReplica {
  id: string;
  study_id: string;
  orden: number;
  operator_id: string | null;
  instrumento_id: string | null;
  raw_values_json: Record<string, number>;
  computed_value: number | null;
  created_at: string;
  // Joined
  operator?: { id: string; email: string; full_name?: string | null };
  instrumento?: { id: string; codigo: string; nombre: string; estado?: string };
}

// ---------------------------------------------------------------------------
// Budget (frozen result)
// ---------------------------------------------------------------------------
export interface UncertaintyStudyBudget {
  study_id: string;
  presupuesto_json: UncertaintyComponent[];
  mean_value: number | null;
  u_repeatability: number | null;
  u_resolucion: number | null;
  u_calibracion: number | null;
  u_reproducibilidad_operador: number | null;
  u_combinado: number | null;
  nu_eff: number | null;
  k_factor: number | null;
  u_expandida: number | null;
  u_relativa_pct: number | null;
  unidad: string | null;
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Published declared U per measurand
// ---------------------------------------------------------------------------
export interface UncertaintyPublished {
  measurand_id: string;
  study_id: string;
  u_expandida: number;
  k_factor: number;
  nu_eff: number;
  unidad: string;
  valid_from: string;  // ISO date
  valid_until: string | null;
  updated_at: string;
  // Joined
  measurand?: UncertaintyMeasurand;
  study?: Pick<UncertaintyStudy, 'id' | 'fecha_estudio' | 'documento_codigo'>;
}

// ---------------------------------------------------------------------------
// Per-study custom variables (user-defined Type A and Type B)
// ---------------------------------------------------------------------------

export type CustomInputBSubtipo =
  | 'resolucion'
  | 'rectangular'
  | 'triangular'
  | 'normal'
  | 'u-shaped';

export interface StudyCustomInput {
  id: string;
  study_id: string;
  simbolo: string;
  nombre_display: string;
  unidad: string;
  tipo_ab: 'A' | 'B';
  /** Required when tipo_ab = 'B' */
  b_subtipo: CustomInputBSubtipo | null;
  /** Rectangular / triangular / u-shaped Type B */
  half_width: number | null;
  /** Resolution Type B */
  div_min: number | null;
  /** Normal (calibration-like) Type B */
  u_cert: number | null;
  k_cert: number | null;
  divisor: number | null;
  /** Required for Type B except resolucion */
  norma_ref: string | null;
  /** Type A: array of replicate values (≥ 2) */
  replica_values_json: number[] | null;
  descripcion: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomInputBody {
  simbolo: string;
  nombre_display: string;
  unidad?: string;
  tipo_ab: 'A' | 'B';
  b_subtipo?: CustomInputBSubtipo;
  half_width?: number;
  div_min?: number;
  u_cert?: number;
  k_cert?: number;
  divisor?: number;
  norma_ref?: string;
  replica_values_json?: number[];
  descripcion?: string;
  orden?: number;
}

export type UpdateCustomInputBody = Partial<Omit<CreateCustomInputBody, 'tipo_ab' | 'simbolo'>>;

// ---------------------------------------------------------------------------
// API request/response shapes
// ---------------------------------------------------------------------------
export interface CreateStudyInput {
  measurand_id: string;
  plant_id?: string | null;
  fecha_estudio: string;
  notas?: string | null;
}

export interface UpsertReplicasInput {
  replicas: Array<{
    orden: number;
    operator_id?: string | null;
    instrumento_id?: string | null;
    raw_values_json: Record<string, number>;
    computed_value?: number | null;
  }>;
}

export interface PublishStudyInput {
  valid_until?: string | null;
}

export interface PreviewBudgetResponse {
  budget: BudgetResult;
  warnings: string[];
}

export interface PublishStudyResponse {
  study: UncertaintyStudy;
  published: UncertaintyPublished;
  previous_u_expandida: number | null;
}

// ---------------------------------------------------------------------------
// Preflight validation result for publish gate
// ---------------------------------------------------------------------------
export interface PublishPreflight {
  ok: boolean;
  checks: Array<{
    label: string;
    passed: boolean;
    detail?: string;
  }>;
}
