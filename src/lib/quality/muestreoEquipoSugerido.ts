import type { PlannedSample } from '@/components/quality/muestreos/dateUtils';

/** Hint fields from the muestreo form — drives conditional extras (aire, balanza). */
export type MuestreoMeasurementsHint = {
  revenimiento_sitio?: number | null;
  temperatura_ambiente?: number | null;
  temperatura_concreto?: number | null;
  contenido_aire?: number | null;
  peso_recipiente_vacio?: number | null;
  peso_recipiente_lleno?: number | null;
};

export type CategorySuggestion = {
  key: string;
  label: string;
  /** Must match `conjuntos_herramientas.categoria` for `/api/ema/instrumentos?categoria=` */
  categoria: string;
};

function finiteNum(v: unknown): boolean {
  return v != null && Number.isFinite(Number(v));
}

/**
 * Ordered “conjunto habitual de campo” for muestreos, aligned with plant catalog categories.
 * Labels are UX-facing; `categoria` must match the DB.
 */
export function deriveSuggestedMuestreoEquipoCategories(
  plannedSamples: PlannedSample[] | undefined,
  m: MuestreoMeasurementsHint | undefined,
): CategorySuggestion[] {
  const samples = plannedSamples ?? [];
  const hasCubo = samples.some((s) => s.tipo_muestra === 'CUBO');
  const hasCil = samples.some((s) => s.tipo_muestra === 'CILINDRO');
  const hasViga = samples.some((s) => s.tipo_muestra === 'VIGA');

  const rows: CategorySuggestion[] = [];
  const seen = new Set<string>();

  const add = (key: string, label: string, categoria: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ key, label, categoria });
  };

  // Order matches habitual field workflow (lab-provided list).
  add('cucharon', 'Cucharón', 'Cucharón');
  add('varilla', 'Varillas 30 / 60 cm', 'Varilla p/compactar');

  if (hasCubo) add('molde_cubo', 'Moldes cúbicos', 'Molde cúbico');
  if (hasCil) add('molde_cil', 'Molde cilíndrico', 'Molde cilíndrico');
  if (hasViga) add('molde_viga', 'Molde para viga', 'Molde para viga');

  add('rev', 'Equipo de revenimiento', 'Equipo de revenimiento');
  add('enrasador', 'Enrasador', 'Enrasador');
  add('recipiente_mu', 'Ollita / recipiente (masa unit.)', 'Recipiente PV');
  add('term', 'Termómetro', 'Termómetro');
  add('mazo', 'Mazo de goma', 'Mazo de goma');
  add('flexometro', 'Flexómetro', 'Flexómetro');

  if (finiteNum(m?.contenido_aire)) {
    add('aire', 'Equipo contenido de aire', 'Equipo contenido de aire');
  }

  if (finiteNum(m?.peso_recipiente_vacio) || finiteNum(m?.peso_recipiente_lleno)) {
    add('balanza', 'Balanza', 'Balanza');
  }

  return rows;
}
