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

  const hasCilindroViga = input.specimenTypes.some((t) => t === 'CILINDRO' || t === 'VIGA');
  const hasCubo = input.specimenTypes.some((t) => t === 'CUBO');
  if (hasCilindroViga) out.push({ codigo: 'FC', reason: 'Resistencia cilindro/viga' });
  if (hasCubo) out.push({ codigo: 'FC_CUBO', reason: 'Resistencia cubo' });

  return out;
}

export function fcMeasurandForTipo(tipo: string): MeasurandCodigo {
  return tipo === 'CUBO' ? 'FC_CUBO' : 'FC';
}
