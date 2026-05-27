import type { LaboratorioLote, LaboratorioLoteMuestreo } from '@/types/laboratorioLote';

export type LoteConformidadStatus =
  | 'sin_ensayos'
  | 'sin_referencia'
  | 'cumple'
  | 'parcial'
  | 'no_cumple';

export type LoteConformidadSummary = {
  status: LoteConformidadStatus;
  targetFc: number | null;
  bestFc: number | null;
  bestPct: number | null;
  ensayoCount: number;
};

export const CONFORMIDAD_LABELS: Record<LoteConformidadStatus, string> = {
  sin_ensayos: 'Sin ensayos',
  sin_referencia: 'Sin f\'c ref.',
  cumple: 'Cumple',
  parcial: 'Parcial',
  no_cumple: 'No cumple',
};

export function resolveTargetFc(
  lote: Pick<LaboratorioLote, 'recipe_snapshot' | 'concrete_specs'> & {
    recipe?: { strength_fc?: number | null } | null;
  }
): number | null {
  const fromSnapshot = lote.recipe_snapshot?.strength_fc;
  if (fromSnapshot != null && Number(fromSnapshot) > 0) return Number(fromSnapshot);
  const fromRecipe = lote.recipe?.strength_fc;
  if (fromRecipe != null && Number(fromRecipe) > 0) return Number(fromRecipe);
  return null;
}

export function summarizeLoteConformidad(
  targetFc: number | null,
  muestreos: LaboratorioLoteMuestreo[]
): LoteConformidadSummary {
  const pctValues: number[] = [];
  const fcValues: number[] = [];
  let ensayoCount = 0;

  for (const m of muestreos) {
    for (const mu of m.muestras ?? []) {
      for (const e of mu.ensayos ?? []) {
        if (e.resistencia_calculada == null) continue;
        ensayoCount += 1;
        const fc = Number(e.resistencia_calculada);
        if (Number.isFinite(fc)) fcValues.push(fc);
        if (e.porcentaje_cumplimiento != null) {
          const pct = Number(e.porcentaje_cumplimiento);
          if (Number.isFinite(pct)) pctValues.push(pct);
        }
      }
    }
  }

  const bestFc = fcValues.length > 0 ? Math.max(...fcValues) : null;
  const bestPct = pctValues.length > 0 ? Math.max(...pctValues) : null;

  if (ensayoCount === 0) {
    return { status: 'sin_ensayos', targetFc, bestFc, bestPct, ensayoCount };
  }
  if (targetFc == null || targetFc <= 0) {
    return { status: 'sin_referencia', targetFc, bestFc, bestPct, ensayoCount };
  }

  if (pctValues.length > 0) {
    const minPct = Math.min(...pctValues);
    const status: LoteConformidadStatus =
      minPct >= 100 ? 'cumple' : Math.max(...pctValues) >= 100 ? 'parcial' : 'no_cumple';
    return { status, targetFc, bestFc, bestPct, ensayoCount };
  }

  if (bestFc != null) {
    let status: LoteConformidadStatus = 'no_cumple';
    if (bestFc >= targetFc) status = 'cumple';
    else if (bestFc >= targetFc * 0.95) status = 'parcial';
    return { status, targetFc, bestFc, bestPct, ensayoCount };
  }

  return { status: 'sin_referencia', targetFc, bestFc, bestPct, ensayoCount };
}
