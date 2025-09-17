// Funciones de cálculo para estudios de agregados
// Basadas en las fórmulas de las normas NMX-C mostradas en las imágenes

import { 
  MasaEspecifica, 
  MasaVolumetrica, 
  Absorcion, 
  PerdidaPorLavado,
  DatosGranulometricos 
} from '@/types/agregados';

/**
 * Calcula la masa específica según NMX-C-164-ONNCCE-2014
 */
export function calcularMasaEspecifica(datos: {
  a: number; // Masa de la muestra S.S.S (Masa en el aire) (kg)
  b: number; // Masa de la canastilla incluyendo la muestra, dentro del agua (kg)
  c: number; // Masa de canastilla dentro del tanque de agua (kg)
  v: number; // Volumen desplazado de agua en (dm3)
  ms: number; // Masa de la muestra seca (kg)
}): Partial<MasaEspecifica> {
  // Me_sss = A - (B - C)
  const messsCalculado = datos.a - (datos.b - datos.c);
  
  // Me_s = A/V * Me_sss = 900/340 = 2.65 kg/dm³
  // Nota: Los valores 900/340 son específicos del ejemplo en la imagen
  // En la implementación real, usamos los valores proporcionados
  const mesCalculado = (datos.a / datos.v) * (messsCalculado / datos.a);
  
  // Me = Ms / (Ms + B + C)
  const meCalculado = datos.ms / (datos.ms + datos.b + datos.c);

  return {
    ...datos,
    messsCalculado: Number(messsCalculado.toFixed(3)),
    mesCalculado: Number(mesCalculado.toFixed(3)),
    meCalculado: Number(meCalculado.toFixed(3))
  };
}

/**
 * Calcula la masa volumétrica según NMX-C-073-ONNCCE-2004
 */
export function calcularMasaVolumetrica(datos: {
  masaVSuelta: number; // kg
  masaVCompactada: number; // kg
  factor?: number; // Factor personalizado
}): Partial<MasaVolumetrica> {
  // Si no se proporciona factor, calculamos uno estándar
  // En la imagen se muestra 1.385 y 1.558 como factores
  const factorCalculado = datos.factor || 1.385; // Factor estándar para el cálculo
  
  const resultadoVSuelta = datos.masaVSuelta * factorCalculado;
  const resultadoVCompactada = datos.masaVCompactada * (datos.factor || 1.558);

  return {
    masaVSuelta: datos.masaVSuelta,
    factorVSuelta: factorCalculado,
    resultadoVSuelta: Number(resultadoVSuelta.toFixed(2)),
    
    masaVCompactada: datos.masaVCompactada,
    factorVCompactada: datos.factor || 1.558,
    resultadoVCompactada: Number(resultadoVCompactada.toFixed(2)),
    
    factorCalculado: Number(factorCalculado.toFixed(3))
  };
}

/**
 * Calcula el porcentaje de absorción según NMX-C-164-ONNCCE-2014
 */
export function calcularAbsorcion(datos: {
  masaMuestraSSS: number; // masa muestra SSS (g)
  masaMuestraSeca: number; // masa muestra seca (g)
}): Partial<Absorcion> {
  // % Absorción = ((masa muestra SSS - masa muestra seca) / masa muestra seca) * 100
  const porcentajeAbsorcion = ((datos.masaMuestraSSS - datos.masaMuestraSeca) / datos.masaMuestraSeca) * 100;

  return {
    masaMuestraSSS: datos.masaMuestraSSS,
    masaMuestraSeca: datos.masaMuestraSeca,
    porcentajeAbsorcion: Number(porcentajeAbsorcion.toFixed(2))
  };
}

/**
 * Calcula el porcentaje de pérdida por lavado según NMX-C-084-ONNCCE-2018
 */
export function calcularPerdidaPorLavado(datos: {
  masaMuestraSeca: number; // "Ms" (g)
  masaMuestraSecaLavada: number; // "Msl" (g)
  secadoMasaConstante?: boolean;
}): Partial<PerdidaPorLavado> {
  // % P x L = (Ms - Msl) / Ms * 100
  const porcentajePerdida = ((datos.masaMuestraSeca - datos.masaMuestraSecaLavada) / datos.masaMuestraSeca) * 100;

  return {
    secadoMasaConstante: datos.secadoMasaConstante || true,
    masaMuestraSeca: datos.masaMuestraSeca,
    masaMuestraSecaLavada: datos.masaMuestraSecaLavada,
    porcentajePerdida: Number(porcentajePerdida.toFixed(2))
  };
}

/**
 * Calcula los porcentajes granulométricos
 */
export function calcularGranulometria(datosRetenido: Array<{
  noMalla: string;
  retenidoG: number;
}>): DatosGranulometricos[] {
  const total = datosRetenido.reduce((sum, dato) => sum + dato.retenidoG, 0);
  
  let acumulado = 0;
  
  return datosRetenido.map(dato => {
    const porcentajeRetenido = (dato.retenidoG / total) * 100;
    acumulado += porcentajeRetenido;
    const porcentajePasa = 100 - acumulado;
    
    return {
      noMalla: dato.noMalla,
      retenidoG: dato.retenidoG,
      porcentajeRetenido: Number(porcentajeRetenido.toFixed(1)),
      porcentajeAcumulado: Number(acumulado.toFixed(1)),
      porcentajePasa: Number(Math.max(0, porcentajePasa).toFixed(1))
    };
  });
}

/**
 * Valida los datos de entrada para masa específica
 */
export function validarDatosMasaEspecifica(datos: Partial<MasaEspecifica>): {
  esValido: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  if (!datos.a || datos.a <= 0) {
    errores.push('La masa de la muestra S.S.S (A) debe ser mayor a 0');
  }

  if (!datos.b || datos.b <= 0) {
    errores.push('La masa de la canastilla con muestra (B) debe ser mayor a 0');
  }

  if (!datos.c || datos.c <= 0) {
    errores.push('La masa de la canastilla (C) debe ser mayor a 0');
  }

  if (!datos.v || datos.v <= 0) {
    errores.push('El volumen desplazado (V) debe ser mayor a 0');
  }

  if (!datos.ms || datos.ms <= 0) {
    errores.push('La masa de la muestra seca (Ms) debe ser mayor a 0');
  }

  // Validaciones lógicas
  if (datos.b && datos.c && datos.b <= datos.c) {
    errores.push('La masa de la canastilla con muestra (B) debe ser mayor que la masa de la canastilla sola (C)');
  }

  return {
    esValido: errores.length === 0,
    errores
  };
}

/**
 * Valida los datos de entrada para absorción
 */
export function validarDatosAbsorcion(datos: Partial<Absorcion>): {
  esValido: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  if (!datos.masaMuestraSSS || datos.masaMuestraSSS <= 0) {
    errores.push('La masa de muestra S.S.S debe ser mayor a 0');
  }

  if (!datos.masaMuestraSeca || datos.masaMuestraSeca <= 0) {
    errores.push('La masa de muestra seca debe ser mayor a 0');
  }

  // Validación lógica: la masa SSS debe ser mayor o igual a la masa seca
  if (datos.masaMuestraSSS && datos.masaMuestraSeca && datos.masaMuestraSSS < datos.masaMuestraSeca) {
    errores.push('La masa de muestra S.S.S debe ser mayor o igual a la masa de muestra seca');
  }

  return {
    esValido: errores.length === 0,
    errores
  };
}

/**
 * Valida los datos de entrada para pérdida por lavado
 */
export function validarDatosPerdidaPorLavado(datos: Partial<PerdidaPorLavado>): {
  esValido: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  if (!datos.masaMuestraSeca || datos.masaMuestraSeca <= 0) {
    errores.push('La masa de muestra seca (Ms) debe ser mayor a 0');
  }

  if (!datos.masaMuestraSecaLavada || datos.masaMuestraSecaLavada < 0) {
    errores.push('La masa de muestra seca lavada (Msl) debe ser mayor o igual a 0');
  }

  // Validación lógica: la masa lavada debe ser menor o igual a la masa original
  if (datos.masaMuestraSeca && datos.masaMuestraSecaLavada && 
      datos.masaMuestraSecaLavada > datos.masaMuestraSeca) {
    errores.push('La masa de muestra seca lavada (Msl) no puede ser mayor que la masa original (Ms)');
  }

  return {
    esValido: errores.length === 0,
    errores
  };
}

/**
 * Valida los datos granulométricos
 */
export function validarDatosGranulometria(datos: Array<{ noMalla: string; retenidoG: number }>): {
  esValido: boolean;
  errores: string[];
} {
  const errores: string[] = [];

  if (!datos || datos.length === 0) {
    errores.push('Debe proporcionar al menos un dato granulométrico');
    return { esValido: false, errores };
  }

  datos.forEach((dato, index) => {
    if (!dato.noMalla || dato.noMalla.trim() === '') {
      errores.push(`La malla ${index + 1} debe tener un nombre`);
    }

    if (dato.retenidoG < 0) {
      errores.push(`El peso retenido en la malla ${dato.noMalla} no puede ser negativo`);
    }
  });

  const total = datos.reduce((sum, dato) => sum + dato.retenidoG, 0);
  if (total <= 0) {
    errores.push('La suma total de pesos retenidos debe ser mayor a 0');
  }

  return {
    esValido: errores.length === 0,
    errores
  };
}

/**
 * Función auxiliar para formatear números con decimales específicos
 */
export function formatearNumero(numero: number, decimales: number = 2): string {
  return numero.toFixed(decimales);
}

/**
 * Función auxiliar para convertir entre unidades
 */
export function convertirUnidades(valor: number, deUnidad: string, aUnidad: string): number {
  const conversiones: Record<string, Record<string, number>> = {
    'kg': {
      'g': 1000,
      'kg': 1
    },
    'g': {
      'kg': 0.001,
      'g': 1
    },
    'dm3': {
      'cm3': 1000,
      'dm3': 1,
      'm3': 0.001
    }
  };

  if (conversiones[deUnidad] && conversiones[deUnidad][aUnidad]) {
    return valor * conversiones[deUnidad][aUnidad];
  }

  throw new Error(`Conversión no soportada de ${deUnidad} a ${aUnidad}`);
}


