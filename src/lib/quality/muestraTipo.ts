/** Normalized specimen types stored in `muestras.tipo_muestra`. */
export type TipoMuestraNorm = 'CILINDRO' | 'VIGA' | 'CUBO';

/**
 * Normalize DB/UI values so strict equality checks and aggregates stay consistent
 * (avoids mismatches when values have stray whitespace or different casing).
 */
export function normalizeTipoMuestra(raw: string | null | undefined): TipoMuestraNorm | null {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (t === 'CILINDRO' || t === 'VIGA' || t === 'CUBO') return t;
  return null;
}

export function tipoMuestraLabel(tipo: string | null | undefined): string {
  const n = normalizeTipoMuestra(tipo);
  if (n === 'CILINDRO') return 'Cilindro';
  if (n === 'VIGA') return 'Viga';
  if (n === 'CUBO') return 'Cubo';
  const s = String(tipo ?? '').trim();
  return s.length > 0 ? s : '—';
}
