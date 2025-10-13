// Exportar todos los formularios de caracterización de materiales
export { default as GranulometriaForm } from './GranulometriaForm';
export { default as DensidadForm } from './DensidadForm';
export { default as MasaVolumetricoForm } from './MasaVolumetricoForm';
export { default as PerdidaLavadoForm } from './PerdidaLavadoForm';
export { default as AbsorcionForm } from './AbsorcionForm';

// Tipos de datos para los resultados
export interface GranulometriaResultados {
  mallas: Array<{
    id: string;
    numero_malla: string;
    abertura_mm: number;
    peso_retenido: number;
    porcentaje_retenido: number;
    porcentaje_acumulado: number;
    porcentaje_pasa: number;
  }>;
  peso_muestra_inicial: number;
  peso_total_retenido: number;
  perdida_lavado: number;
  modulo_finura: number;
  tamaño_maximo_nominal: string;
  observaciones?: string;
}

export interface DensidadResultados {
  peso_muestra_seca: number;
  peso_muestra_sss: number;
  peso_muestra_sumergida: number;
  densidad_relativa: number;
  densidad_sss: number;
  densidad_aparente: number;
  absorcion: number;
  temperatura_agua: number;
  factor_correccion_temperatura: number;
  observaciones?: string;
}

export interface MasaVolumetricoResultados {
  peso_recipiente_vacio: number;
  volumen_recipiente: number;
  peso_recipiente_muestra_suelta: number;
  peso_muestra_suelta: number;
  masa_volumetrica_suelta: number;
  peso_recipiente_muestra_compactada: number;
  peso_muestra_compactada: number;
  masa_volumetrica_compactada: number;
  factor_compactacion: number;
  porcentaje_vacios_suelta: number;
  porcentaje_vacios_compactada: number;
  densidad_relativa_agregado: number;
  observaciones?: string;
}

export interface PerdidaLavadoResultados {
  peso_muestra_inicial: number;
  peso_muestra_despues_lavado: number;
  perdida_lavado: number;
  porcentaje_perdida: number;
  porcentaje_retenido: number;
  temperatura_agua: number;
  tiempo_lavado: number;
  presion_agua: string;
  clasificacion_limpieza: string;
  observaciones?: string;
}

export interface AbsorcionResultados {
  peso_muestra_seca: number;
  peso_muestra_saturada: number;
  tiempo_saturacion: number;
  temperatura_agua: number;
  metodo_secado: string;
  absorcion_porcentaje: number;
  incremento_peso: number;
  clasificacion_absorcion: string;
  observaciones?: string;
}

// Tipo unión para todos los tipos de resultados
export type EstudioResultados = 
  | GranulometriaResultados 
  | DensidadResultados 
  | MasaVolumetricoResultados 
  | PerdidaLavadoResultados 
  | AbsorcionResultados;

// Props comunes para todos los formularios
export interface BaseFormProps<T> {
  estudioId: string;
  initialData?: T;
  onSave: (data: T) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}
