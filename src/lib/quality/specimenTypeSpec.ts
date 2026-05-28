import {
  resolvePersistedCubeSideCm,
  resolvePersistedDiameterCm,
} from './moldeInstrumentoSpec';

export type MuestraSpecDims = {
  tipo_muestra: string;
  diameter_cm?: number | null;
  cube_side_cm?: number | null;
  beam_width_cm?: number | null;
  beam_height_cm?: number | null;
  beam_span_cm?: number | null;
};

/** dimension_key expected in specimen_type_specs for this muestra. */
export function expectedDimensionKeyFromMuestra(m: MuestraSpecDims): string | null {
  const tipo = m.tipo_muestra?.toUpperCase();
  if (tipo === 'CUBO') {
    return String(resolvePersistedCubeSideCm(m.cube_side_cm));
  }
  if (tipo === 'CILINDRO') {
    return String(resolvePersistedDiameterCm(m.diameter_cm));
  }
  if (tipo === 'VIGA') {
    const w = m.beam_width_cm;
    const h = m.beam_height_cm;
    const s = m.beam_span_cm;
    if (w != null && h != null && s != null && w > 0 && h > 0 && s > 0) {
      return `${Math.round(w)}x${Math.round(h)}x${Math.round(s)}`;
    }
  }
  return null;
}

export function ensayoSpecMismatchesMuestra(
  muestra: MuestraSpecDims,
  spec: { tipo_muestra?: string; dimension_key?: string } | null | undefined,
): boolean {
  if (!spec?.dimension_key) return false;
  const expected = expectedDimensionKeyFromMuestra(muestra);
  if (!expected) return false;
  return (
    spec.tipo_muestra?.toUpperCase() === muestra.tipo_muestra?.toUpperCase() &&
    spec.dimension_key !== expected
  );
}

export function rpcArgsForMuestraSpec(muestra: MuestraSpecDims) {
  const tipo = muestra.tipo_muestra.toUpperCase();
  return {
    p_tipo_muestra: tipo,
    p_diameter_cm: tipo === 'CILINDRO' ? resolvePersistedDiameterCm(muestra.diameter_cm) : 0,
    p_cube_side_cm: tipo === 'CUBO' ? resolvePersistedCubeSideCm(muestra.cube_side_cm) : 0,
    p_beam_width_cm: muestra.beam_width_cm ?? 0,
    p_beam_height_cm: muestra.beam_height_cm ?? 0,
    p_beam_span_cm: muestra.beam_span_cm ?? 0,
  };
}
