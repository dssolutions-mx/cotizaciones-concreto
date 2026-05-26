import type { MeasurandCodigo } from '@/types/ema-uncertainty';

export type RequiredMeasurand = {
  codigo: MeasurandCodigo;
  reason: string;
};

/** Pure helper — safe for client and server bundles. */
export function requiredMeasurandsForMuestreo(input: {
  revenimiento_sitio?: number | null;
  temperatura_concreto?: number | null;
  contenido_aire?: number | null;
  masa_unitaria?: number | null;
  specimenTypes: string[];
}): RequiredMeasurand[] {
  const out: RequiredMeasurand[] = [];
  if (input.revenimiento_sitio != null) out.push({ codigo: 'REV', reason: 'Revenimiento reportado' });
  if (input.temperatura_concreto != null) out.push({ codigo: 'TEMP', reason: 'Temperatura concreto' });
  if (input.contenido_aire != null) out.push({ codigo: 'AIRE', reason: 'Contenido de aire' });
  if (input.masa_unitaria != null) out.push({ codigo: 'MU', reason: 'Masa unitaria' });

  const hasCilindro = input.specimenTypes.some((t) => t === 'CILINDRO');
  const hasViga = input.specimenTypes.some((t) => t === 'VIGA');
  const hasCubo = input.specimenTypes.some((t) => t === 'CUBO');
  if (hasCilindro) out.push({ codigo: 'FC', reason: 'Resistencia cilindro' });
  if (hasViga) out.push({ codigo: 'VIGAS', reason: 'Módulo de rotura (vigas, NMX-C-191)' });
  if (hasCubo) out.push({ codigo: 'FC_CUBO', reason: 'Resistencia cubo' });

  return out;
}

export function fcMeasurandForTipo(tipo: string): MeasurandCodigo {
  if (tipo === 'CUBO') return 'FC_CUBO';
  if (tipo === 'VIGA') return 'VIGAS';
  return 'FC';
}
