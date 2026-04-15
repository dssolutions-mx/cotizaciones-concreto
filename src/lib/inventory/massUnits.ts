/** Tonelada métrica (t) — conversión estándar para OC de flota facturadas por tonelada y recepción en báscula (kg). */
export const KG_PER_METRIC_TON = 1000;

export function kgToMetricTons(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return kg / KG_PER_METRIC_TON;
}
