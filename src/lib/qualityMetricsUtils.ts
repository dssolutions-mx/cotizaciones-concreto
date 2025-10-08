/**
 * Utility functions for quality metrics calculations across the application
 */

/**
 * Interface for detailed metrics at the sampling level
 */
export interface MuestreoDetailedMetrics {
  id: string;
  fecha_muestreo: string;
  planta_nombre: string;
  tipo_concreto: string;
  resistencia: string;
  clasificacion: string;
  recipe_id: string;
  
  // Resistance metrics
  resistencia_promedio: number;
  desviacion_estandar: number;
  porcentaje_cumplimiento: number;
  coeficiente_variacion: number;
  
  // Efficiency metrics  
  eficiencia: number;
  consumo_cemento: number;
  
  // Volumetric yield metrics
  rendimiento_volumetrico: number;
  suma_materiales: number;
  masa_unitaria: number;
  
  // Additional info
  volumen_fabricado: number;
  cliente_nombre: string;
  remision_numero: string;
  notes: string | null;
}

/**
 * Calculate average without zero values
 * @param values Array of numbers to average
 * @returns The average of non-zero values or 0 if no valid values
 */
export function calcularMediaSinCeros(values: number[]): number {
  const nonZeroValues = values.filter(val => val !== 0 && val !== null && !isNaN(val));
  if (nonZeroValues.length === 0) return 0;
  
  const sum = nonZeroValues.reduce((acc, val) => acc + val, 0);
  return sum / nonZeroValues.length;
}

/**
 * Calculate standard deviation without zero values
 * @param values Array of numbers
 * @returns Standard deviation of non-zero values or 0 if no valid values
 */
export function calcularDesviacionEstandarSinCeros(values: number[]): number {
  const nonZeroValues = values.filter(val => val !== 0 && val !== null && !isNaN(val));
  if (nonZeroValues.length <= 1) return 0;
  
  const mean = calcularMediaSinCeros(nonZeroValues);
  const squareDiffs = nonZeroValues.map(val => Math.pow(val - mean, 2));
  const variance = squareDiffs.reduce((acc, val) => acc + val, 0) / (nonZeroValues.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate coefficient of variation
 * @param mean Mean value
 * @param stdDev Standard deviation
 * @returns Coefficient of variation as a percentage
 */
export function calcularCoeficienteVariacion(mean: number, stdDev: number): number {
  if (mean === 0 || stdDev === 0) return 0;
  return (stdDev / mean) * 100;
}

/**
 * Calculate efficiency based on concrete type
 * For MR concrete: (resistencia / 0.13) / consumoCemento
 * For FC concrete: resistencia / consumoCemento
 * @param resistenciaPromedio Average resistance
 * @param consumoCemento Actual cement consumption
 * @param tipoConcreto Concrete type (MR or FC)
 * @returns Efficiency value
 */
export function calcularEficiencia(
  resistenciaPromedio: number, 
  consumoCemento: number, 
  tipoConcreto: string
): number {
  if (resistenciaPromedio === 0 || consumoCemento === 0) return 0;
  
  // For MR-type concrete, divide resistance by 0.13 first
  if (tipoConcreto.toUpperCase().startsWith('MR')) {
    return (resistenciaPromedio / 0.13) / consumoCemento;
  }
  
  // For all other concrete types (FC, etc.)
  return resistenciaPromedio / consumoCemento;
}

/**
 * Calculate volumetric yield percentage
 * @param volumenFabricado Manufactured volume (volumen_real)
 * @param sumaMateriales Sum of materials in the recipe
 * @param masaUnitaria Unit mass
 * @returns Volumetric yield as a percentage
 */
export function calcularRendimientoVolumetrico(
  volumenFabricado: number,
  sumaMateriales: number,
  masaUnitaria: number
): number {
  if (volumenFabricado === 0 || sumaMateriales === 0 || masaUnitaria === 0) return 0;
  
  // Calculate theoretical volume
  const volumenTeorico = sumaMateriales / masaUnitaria;
  if (volumenTeorico === 0) return 0;
  
  // CORRECTED FORMULA: (volumen_teorico / volumen_real) * 100
  return (volumenTeorico / volumenFabricado) * 100;
}

/**
 * Types for raw data from database
 */
export interface RemisionData {
  id: string;
  recipe_id: string;
  volumen_fabricado?: number | null;
}

export interface RecipeVersionData {
  recipe_id: string;
  notes?: string;
  age_days?: number;
}

export interface MaterialData {
  remision_id: string;
  material_type?: string;
  cantidad_real?: number | null;
}

/**
 * Types for various quality metrics 
 */
export interface BasicMetrics {
  // Basic metrics
  numeroMuestras: number;
  muestrasEnCumplimiento: number;
  resistenciaPromedio: number | null;
  desviacionEstandar: number | null;
  porcentajeResistenciaGarantia: number | null;
}

export interface AdvancedMetrics extends BasicMetrics {
  // Advanced metrics
  eficiencia?: number | null;
  rendimientoVolumetrico?: number | null;
  coeficienteVariacion?: number | null;
}

/**
 * Hybrid metrics interface that extends MuestreoDetailedMetrics with additional fields
 * and makes the original fields optional to support legacy data formats
 */
export interface MuestreoHybridMetrics {
  // Base fields from MuestreoDetailedMetrics that may be optional
  id: string;
  fecha_muestreo?: string;
  planta_nombre?: string;
  tipo_concreto?: string;
  resistencia?: string;
  clasificacion?: string;
  recipe_id?: string;
  
  // Resistance metrics (optional)
  resistencia_promedio?: number;
  desviacion_estandar?: number;
  porcentaje_cumplimiento?: number;
  coeficiente_variacion?: number;
  
  // Efficiency metrics (optional)
  eficiencia?: number;
  consumo_cemento?: number;
  
  // Volumetric yield metrics (optional)
  rendimiento_volumetrico?: number;
  suma_materiales?: number;
  masa_unitaria?: number | null;
  
  // Additional info (optional)
  volumen_fabricado?: number;
  cliente_nombre?: string;
  remision_numero?: string;
  notes?: string | null;
  
  // Legacy fields
  volumen_registrado?: number | null;
  kg_cemento?: number | null;
  resistencia_edad_garantia?: number | null;
  edad_garantia?: number | null;
  
  // Meta fields
  _server_fields?: string[];
  _client_fields?: string[];
  _metricas_generales?: {
    rendimientoVolumetricoPromedio?: number | null;
    eficienciaPromedio?: number | null;
    consumoCementoPromedio?: number | null;
    totalMuestreos?: number;
  };
}

/**
 * Calculates aggregate metrics from detailed individual metrics
 * @param metrics Array of individual metrics
 * @returns Object containing aggregate metrics
 */
export function calculateAggregateMetrics(
  metrics: MuestreoDetailedMetrics[]
): { 
  rendimientoVolumetricoPromedio: number | null;
  eficienciaPromedio: number | null;
  consumoCementoPromedio: number | null;
} {
  if (!metrics || metrics.length === 0) {
    return {
      rendimientoVolumetricoPromedio: null,
      eficienciaPromedio: null,
      consumoCementoPromedio: null
    };
  }

  const rendimientos = metrics
    .map(m => m.rendimiento_volumetrico)
    .filter(Boolean) as number[];
    
  const eficiencias = metrics
    .map(m => m.eficiencia)
    .filter(Boolean) as number[];
    
  const consumos = metrics
    .map(m => m.consumo_cemento)
    .filter(Boolean) as number[];
    
  return {
    rendimientoVolumetricoPromedio: calcularMediaSinCeros(rendimientos),
    eficienciaPromedio: calcularMediaSinCeros(eficiencias),
    consumoCementoPromedio: calcularMediaSinCeros(consumos)
  };
} 