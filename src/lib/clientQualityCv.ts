import type { ClientQualityRemisionData, RecipeCVBreakdown } from '@/types/clientQuality';
import { resolveEnsayoResistenciaReportada, resolveEnsayoPorcentajeCumplimiento } from '@/lib/qualityHelpers';

export function avg(arr: number[]) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

export function coefficientVariationFromValues(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = avg(values);
  if (mean <= 0) return 0;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const std = Math.sqrt(variance);
  return (std / mean) * 100;
}

/** One average resistance per muestreo (guarantee-age, on-time ensayos). */
export function muestreoAvgResistenciasForRemisiones(remisiones: ClientQualityRemisionData[]): number[] {
  const out: number[] = [];
  remisiones.forEach((r) => {
    r.muestreos.forEach((m) => {
      const vals: number[] = [];
      m.muestras.forEach((s) => {
        s.ensayos
          .filter(
            (e) =>
              e.isEdadGarantia === true &&
              !e.isEnsayoFueraTiempo &&
              (e.resistenciaCalculada || 0) > 0 &&
              e.porcentajeCumplimiento !== null &&
              e.porcentajeCumplimiento !== undefined
          )
          .forEach((e) => {
            const res = resolveEnsayoResistenciaReportada(e);
            if (res > 0) vals.push(res);
          });
      });
      if (vals.length > 0) out.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    });
  });
  return out;
}

export function buildCvByRecipe(remisiones: ClientQualityRemisionData[]): RecipeCVBreakdown[] {
  const byRecipe = new Map<string, ClientQualityRemisionData[]>();
  remisiones.forEach((r) => {
    const k = r.recipeCode || 'N/A';
    if (!byRecipe.has(k)) byRecipe.set(k, []);
    byRecipe.get(k)!.push(r);
  });
  const breakdown: RecipeCVBreakdown[] = [];
  byRecipe.forEach((rems, recipeCode) => {
    const mAvgs = muestreoAvgResistenciasForRemisiones(rems);
    let ensayoCount = 0;
    let muestreoCount = 0;
    let totalRes = 0;
    let resCount = 0;
    let totalComp = 0;
    let compCount = 0;
    rems.forEach((r) => {
      r.muestreos.forEach((m) => {
        let mHas = false;
        m.muestras.forEach((s) => {
          s.ensayos
            .filter(
              (e) =>
                e.isEdadGarantia &&
                !e.isEnsayoFueraTiempo &&
                (e.resistenciaCalculada || 0) > 0 &&
                e.porcentajeCumplimiento !== null &&
                e.porcentajeCumplimiento !== undefined
            )
            .forEach((e) => {
              ensayoCount += 1;
              mHas = true;
              const resAdj = resolveEnsayoResistenciaReportada(e);
              if (resAdj > 0) {
                totalRes += resAdj;
                resCount += 1;
              }
              const compAdj = resolveEnsayoPorcentajeCumplimiento(e, r.recipeFc || 0);
              if (compAdj > 0) {
                totalComp += compAdj;
                compCount += 1;
              }
            });
        });
        if (mHas) muestreoCount += 1;
      });
    });
    const first = rems[0];
    breakdown.push({
      recipeCode,
      strengthFc: first?.recipeFc ?? 0,
      ageDays: 0,
      coefficientVariation: coefficientVariationFromValues(mAvgs),
      ensayoCount,
      muestreoCount,
      avgResistencia: resCount > 0 ? totalRes / resCount : 0,
      avgCompliance: compCount > 0 ? totalComp / compCount : 0,
    });
  });
  return breakdown.sort((a, b) => b.ensayoCount - a.ensayoCount);
}
