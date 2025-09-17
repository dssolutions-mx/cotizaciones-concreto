// Tipos para el estudio de agregados basado en el formato de laboratorio profesional

export interface DatosGeneralesMuestra {
  // Información de la muestra
  minaProcedencia: string;
  ubicacion: string;
  tamanoGrava: string; // ej: "40-4 (1/2)"
  origenGrava: string;
  muestreaPor: string;
  cliente: string;
  idMuestra: string;
  plantaProcedencia: string;
}

export interface MasaEspecifica {
  // Masa específica (s.s.s. y seca) - Ref. NMX-C-164-ONNCCE-2014
  a: number; // Masa de la muestra S.S.S (Masa en el aire) (kg)
  b: number; // Masa de la canastilla incluyendo la muestra, dentro del agua (kg)
  c: number; // Masa de canastilla dentro del tanque de agua (kg)
  v: number; // Volumen desplazado de agua en (dm3)
  
  // Calculados automáticamente
  messsCalculado: number; // Me_sss = A - (B - C)
  mesCalculado: number; // Me_s = A/V * Me_sss = 900/340 = 2.65 kg/dm³
  
  // Masa específica seca
  ms: number; // Masa de la muestra seca (kg)
  meCalculado: number; // Me = Ms / (Ms + B + C)
}

export interface MasaVolumetrica {
  // Masa volumétrica - Ref. NMX-C-073-ONNCCE-2004
  masaVSuelta: number; // kg
  factorVSuelta: number; // Factor
  resultadoVSuelta: number; // kg/m³
  
  masaVCompactada: number; // kg
  factorVCompactada: number; // Factor
  resultadoVCompactada: number; // kg/m³
  
  // Factor calculado automáticamente
  factorCalculado: number; // 1/m³
}

export interface Absorcion {
  // Absorción - Ref. NMX-C-164-ONNCCE-2014
  masaMuestraSSS: number; // masa muestra SSS (g)
  masaMuestraSeca: number; // masa muestra seca (g)
  
  // Calculado automáticamente
  porcentajeAbsorcion: number; // % = ((masa muestra SSS - masa muestra seca) / masa muestra seca) * 100
}

export interface PerdidaPorLavado {
  // Pérdida por lavado - Ref. NMX-C-084-ONNCCE-2018
  secadoMasaConstante: boolean;
  masaMuestraSeca: number; // "Ms" (g)
  masaMuestraSecaLavada: number; // "Msl" (g)
  
  // Calculado automáticamente
  porcentajePerdida: number; // % P x L = (Ms - Msl) / Ms * 100
}

export interface DatosGranulometricos {
  // Datos de la tabla granulométrica
  noMalla: string; // ej: "2", "1 1/2", "1", "3/4", etc.
  retenidoG: number; // peso retenido en gramos
  porcentajeRetenido: number; // %
  porcentajeAcumulado: number; // %
  porcentajePasa: number; // %
}

export interface Granulometria {
  // Granulometría - Ref. NMX-C-077-ONNCCE-2019
  tamanoGrava: string; // ej: "40-4 mm (1/2)"
  datos: DatosGranulometricos[];
  total: number; // suma total de retenido
  
  // Gráfica automática generada
  graficaData: {
    x: string[]; // tamaños de malla
    y: number[]; // porcentajes que pasan
  };
}

export interface EstudioAgregados {
  id: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  
  // Datos generales
  datosGenerales: DatosGeneralesMuestra;
  
  // Estudios realizados
  masaEspecifica?: MasaEspecifica;
  masaVolumetrica?: MasaVolumetrica;
  absorcion?: Absorcion;
  perdidaPorLavado?: PerdidaPorLavado;
  granulometria?: Granulometria;
  
  // Estado y metadatos
  estado: 'borrador' | 'completado' | 'aprobado' | 'rechazado';
  observaciones?: string;
  tecnicoResponsable: string;
  supervisorAprobacion?: string;
  fechaAprobacion?: string;
  
  // Archivos adjuntos
  archivosAdjuntos?: {
    id: string;
    nombre: string;
    url: string;
    tipo: string;
  }[];
}

// Tipos para el formulario
export interface FormularioAgregados {
  // Paso 1: Datos generales
  datosGenerales: Partial<DatosGeneralesMuestra>;
  
  // Paso 2: Selección de estudios a realizar
  estudiosSeleccionados: {
    masaEspecifica: boolean;
    masaVolumetrica: boolean;
    absorcion: boolean;
    perdidaPorLavado: boolean;
    granulometria: boolean;
  };
  
  // Paso 3: Datos de cada estudio
  datosEstudios: {
    masaEspecifica?: Partial<MasaEspecifica>;
    masaVolumetrica?: Partial<MasaVolumetrica>;
    absorcion?: Partial<Absorcion>;
    perdidaPorLavado?: Partial<PerdidaPorLavado>;
    granulometria?: Partial<Granulometria>;
  };
}

// Tipos para las vistas
export interface VistaListaAgregados {
  id: string;
  fechaCreacion: string;
  cliente: string;
  plantaProcedencia: string;
  tipoMaterial: string;
  estado: EstudioAgregados['estado'];
  tecnicoResponsable: string;
  estudiosRealizados: string[]; // lista de estudios completados
}

// Constantes para el formulario
export const TAMAÑOS_GRAVA = [
  { value: '40-4', label: '40-4 mm (1/2)' },
  { value: '25-4', label: '25-4 mm (3/8)' },
  { value: '19-4', label: '19-4 mm (3/4)' },
  { value: '12-4', label: '12-4 mm (1/2)' },
  { value: '9-4', label: '9-4 mm (3/8)' }
];

export const MALLAS_GRANULOMETRICAS = [
  { id: '2', nombre: '2"', abertura: 50.8 },
  { id: '1_1_2', nombre: '1 1/2"', abertura: 38.1 },
  { id: '1', nombre: '1"', abertura: 25.4 },
  { id: '3_4', nombre: '3/4"', abertura: 19.05 },
  { id: '1_2', nombre: '1/2"', abertura: 12.7 },
  { id: '3_8', nombre: '3/8"', abertura: 9.525 },
  { id: 'charola', nombre: 'Charola', abertura: 0 }
];

export const TIPOS_ORIGEN_GRAVA = [
  'Volcánica',
  'Basáltica',
  'Caliza',
  'Granito',
  'Otra'
];

export const PLANTAS_DISPONIBLES = [
  { value: 'P1', label: 'Planta 1' },
  { value: 'P2', label: 'Planta 2' },
  { value: 'P3', label: 'Planta 3' },
  { value: 'P4', label: 'Planta 4' }
];


