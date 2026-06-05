import type { PlannedSample } from '@/components/quality/muestreos/dateUtils';

/** Parse cube side (cm) from EMA instrument name, e.g. "Molde Cúbico 15x15". */
export function inferCubeSideCmFromInstrumentName(nombre: string): number | null {
  const m = nombre.match(/(\d{1,2})\s*[x×]\s*(\d{1,2})/i);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a !== b) return null;
  if (a === 5 || a === 10 || a === 15) return a;
  return null;
}

/** Parse cylinder diameter (cm) from instrument name when present. */
export function inferCylinderDiameterCmFromInstrumentName(nombre: string): number | null {
  const m = nombre.match(/(?:Ø|d[ií]a(?:metro)?\.?)\s*(\d{1,2})|(\d{1,2})\s*cm/i);
  if (!m) return null;
  const n = parseInt(m[1] ?? m[2], 10);
  if (n === 10 || n === 15) return n;
  return null;
}

export function defaultSpecimenDimensionsForTipo(
  tipo: PlannedSample['tipo_muestra'],
): Pick<PlannedSample, 'diameter_cm' | 'cube_side_cm'> {
  if (tipo === 'CILINDRO') return { diameter_cm: 15, cube_side_cm: undefined };
  if (tipo === 'CUBO') return { cube_side_cm: 15, diameter_cm: undefined };
  return { diameter_cm: undefined, cube_side_cm: undefined };
}

/** Apply molde label hints onto a planned sample (does not change tipo). */
export function applyMoldeDimensionsToPlannedSample(
  sample: PlannedSample,
  moldeNombre: string,
): PlannedSample {
  if (sample.tipo_muestra === 'CUBO') {
    const side = inferCubeSideCmFromInstrumentName(moldeNombre);
    if (side != null) return { ...sample, cube_side_cm: side };
  }
  if (sample.tipo_muestra === 'CILINDRO') {
    const d = inferCylinderDiameterCmFromInstrumentName(moldeNombre);
    if (d != null) return { ...sample, diameter_cm: d };
  }
  return sample;
}

/**
 * Resolve cube side / diameter for resolving the spec of ALREADY-STORED data
 * (e.g. recomputing a spec for a legacy ensayo). Uses 15 as last-resort fallback.
 * Do NOT use this when creating new muestras — use requireSpecimenDimensionsForInsert.
 */
export function resolvePersistedCubeSideCm(cubeSide: number | null | undefined): number {
  return typeof cubeSide === 'number' && cubeSide > 0 ? cubeSide : 15;
}

export function resolvePersistedDiameterCm(diameter: number | null | undefined): number {
  return typeof diameter === 'number' && diameter > 0 ? diameter : 15;
}

export type SpecimenDimensionInput = {
  tipo_muestra: 'CILINDRO' | 'VIGA' | 'CUBO';
  diameter_cm?: number | null;
  cube_side_cm?: number | null;
};

/**
 * Strict capture: returns the dimensions to persist for a NEW muestra, and throws
 * a clear error if the required dimension was not registered. No silent defaults.
 */
export function requireSpecimenDimensionsForInsert(s: SpecimenDimensionInput): {
  diameter_cm: number | null;
  cube_side_cm: number | null;
} {
  if (s.tipo_muestra === 'CILINDRO') {
    if (!(typeof s.diameter_cm === 'number' && s.diameter_cm > 0)) {
      throw new Error(
        'Falta el diámetro del cilindro. Selecciona el diámetro (cm) de cada muestra antes de guardar.',
      );
    }
    return { diameter_cm: s.diameter_cm, cube_side_cm: null };
  }
  if (s.tipo_muestra === 'CUBO') {
    if (!(typeof s.cube_side_cm === 'number' && s.cube_side_cm > 0)) {
      throw new Error(
        'Falta el lado del cubo. Selecciona el tamaño (cm) de cada muestra antes de guardar.',
      );
    }
    return { diameter_cm: null, cube_side_cm: s.cube_side_cm };
  }
  return { diameter_cm: null, cube_side_cm: null };
}
