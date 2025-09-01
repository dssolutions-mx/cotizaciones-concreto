// Types for the Quality Control Module

// Muestreo type
export interface Muestreo {
  id: string;
  remision_id: string;
  fecha_muestreo: string;
  hora_muestreo?: string; // HH:MM:SS format
  numero_muestreo: number;
  planta: 'P001' | 'P002' | 'P003' | 'P004' | 'P005';
  plant_id?: string; // prefer server-side filtering by plant_id
  revenimiento_sitio: number;
  masa_unitaria: number;
  temperatura_ambiente: number;
  temperatura_concreto: number;

  concrete_specs?: {
    clasificacion?: 'FC' | 'MR';
    unidad_edad?: 'DÍA' | 'HORA' | 'D' | 'H' | string;
    valor_edad?: number;
    // Note: fc/resistance field removed to standardize to age and unit only
  } | null;

  manual_reference?: string;
  // Timestamp fields
  fecha_muestreo_ts?: string; // Precise timestamp of sampling
  event_timezone?: string; // Timezone information
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Muestra type
export interface Muestra {
  id: string;
  muestreo_id: string;
  tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
  identificacion: string;
  fecha_programada_ensayo: string;
  estado: 'PENDIENTE' | 'ENSAYADO' | 'DESCARTADO';
  // Optional specimen dimensions (persisted in DB after migration)
  diameter_cm?: number | null; // for cylinders
  cube_side_cm?: number | null; // for cubes
  beam_width_cm?: number | null; // for beams (optional future use)
  beam_height_cm?: number | null; // for beams (optional future use)
  beam_span_cm?: number | null; // for beams (optional future use)
  // Timestamp fields
  fecha_programada_ensayo_ts?: string; // Precise timestamp of scheduled test
  event_timezone?: string; // Timezone information
  // Guarantee age metrics
  is_edad_garantia?: boolean; // Indicates if the sample was scheduled for testing at guarantee age
  created_at?: string;
  updated_at?: string;
}

// Ensayo type
export interface Ensayo {
  id: string;
  muestra_id: string;
  fecha_ensayo: string;
  hora_ensayo?: string; // Time when the essay was completed
  carga_kg: number;
  resistencia_calculada: number;
  porcentaje_cumplimiento: number;
  tiempo_desde_carga?: string; // Calculated time since load (when remision data is available)
  observaciones?: string;
  // Timestamp fields
  fecha_ensayo_ts?: string; // Precise timestamp of the test
  event_timezone?: string; // Timezone information
  // Guarantee age metrics
  is_edad_garantia?: boolean; // Indicates if the test was performed at guarantee age
  is_ensayo_fuera_tiempo?: boolean; // Indicates if the test was performed outside the guarantee age window
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Evidencia type
export interface Evidencia {
  id: string;
  ensayo_id: string;
  path: string;
  nombre_archivo: string;
  tipo_archivo: string;
  tamano_kb: number;
  created_by?: string;
  created_at?: string;
}

// Alerta type
export interface Alerta {
  id: string;
  muestra_id: string;
  fecha_alerta: string;
  estado: 'PENDIENTE' | 'VISTA' | 'COMPLETADA';
  created_at?: string;
  updated_at?: string;
}

// Extended types for data with joined relations
export interface MuestreoWithRelations extends Muestreo {
  muestras?: MuestraWithRelations[];
  remision?: {
    id: string;
    remision_number: string;
    fecha: string;
    fecha_remision?: string; // Alternative field name
    hora_carga: string;
    volumen_fabricado: number;
    recipe_id: string;
    created_at?: string; // For fallback date
    recipe?: {
      id: string;
      recipe_code: string;
      strength_fc: number;
      slump: number;
      age_days: number;
      age_hours?: number;
      recipe_versions?: {
        id: string;
        notes?: string;
        is_current: boolean;
      }[];
    };
    order?: {
      id: string;
      order_number: string;
      construction_site: string;
      delivery_date: string;
      delivery_time: string;
      clients?: {
        id: string;
        business_name: string;
      };
    };
    orders?: { // Alternative field name
      id: string;
      order_number: string;
      construction_site: string;
      delivery_date: string;
      delivery_time: string;
      clients?: {
        id: string;
        business_name: string;
      };
    };
  };
  plant?: {
    id: string;
    name: string;
    code: string;
    business_unit_id: string;
    business_unit?: {
      id: string;
      name: string;
      code: string;
    };
  };
}

export interface MuestraWithRelations extends Muestra {
  muestreo?: MuestreoWithRelations;
  ensayos?: Ensayo[];
  alertas?: Alerta[];
}

export interface EnsayoWithRelations extends Ensayo {
  muestra?: MuestraWithRelations;
  evidencias?: Evidencia[];
}

// Dashboard metrics type
export interface MetricasCalidad {
  numeroMuestras: number;
  muestrasEnCumplimiento: number;
  resistenciaPromedio: number;
  desviacionEstandar: number;
  porcentajeResistenciaGarantia: number;
  eficiencia: number;
  rendimientoVolumetrico: number;
  coeficienteVariacion: number;
}

// Chart data type
export type DatoGraficoResistencia = {
  x: number;
  y: number;
  clasificacion: 'FC' | 'MR';
  edad: number;
  fecha_ensayo: string;
  resistencia_calculada?: number;
  muestra?: any;
};

// Filters for quality data
export interface FiltrosCalidad {
  fechaDesde?: Date;
  fechaHasta?: Date;
  planta?: 'P001' | 'P002' | 'P003' | 'P004';
  clasificacion?: 'FC' | 'MR';
  estadoMuestra?: 'PENDIENTE' | 'ENSAYADO' | 'DESCARTADO';
  cliente?: string;
  receta?: string;
  plant_id?: string;
  plant_ids?: string[];
  business_unit_id?: string;
} 