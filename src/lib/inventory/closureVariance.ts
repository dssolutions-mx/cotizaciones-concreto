/**
 * Variance fields for inventory closure materials (physical vs theoretical snapshot).
 */

export function computeClosureVarianceFields(
  physicalCountKg: number | null | undefined,
  theoreticalFinalKg: number,
  thresholdPct: number,
): {
  variance_kg: number | null
  variance_pct: number | null
  requires_justification: boolean
} {
  if (physicalCountKg == null) {
    return {
      variance_kg: null,
      variance_pct: null,
      requires_justification: false,
    }
  }

  const theoretical = Number(theoreticalFinalKg)
  const varianceKg = physicalCountKg - theoretical
  const variancePct =
    theoretical !== 0 ? (varianceKg / Math.abs(theoretical)) * 100 : null
  const requiresJustification =
    variancePct != null && Math.abs(variancePct) > thresholdPct

  return {
    variance_kg: varianceKg,
    variance_pct: variancePct,
    requires_justification: requiresJustification,
  }
}
