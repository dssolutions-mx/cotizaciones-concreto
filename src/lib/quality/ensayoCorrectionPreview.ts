import type { SpecimenTypeSpec } from '@/types/quality'

export function roundResistenciaCorregida(raw: number, factor: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1
  return Math.round(raw * f * 100) / 100
}

export function effectiveFactor(
  stored: number | null | undefined,
  fallback = 1
): number {
  const f = Number(stored)
  return Number.isFinite(f) && f > 0 ? f : fallback
}

/** Rough preview % when RPC is unavailable — scales with corrected strength ratio. */
export function approximatePorcentajePreview(
  actualPct: number | null | undefined,
  actualRes: number,
  simulatedRes: number
): number | null {
  const pct = Number(actualPct)
  if (!Number.isFinite(pct) || pct <= 0) return null
  if (!Number.isFinite(actualRes) || actualRes <= 0) return null
  if (!Number.isFinite(simulatedRes) || simulatedRes <= 0) return null
  return Math.round(((pct * simulatedRes) / actualRes) * 100) / 100
}

export function resolveDraftFactor(
  specId: string | null | undefined,
  specsById: Map<string, SpecimenTypeSpec>,
  draftFactors: Record<string, string>
): number | null {
  if (!specId) return null
  const draft = draftFactors[specId]
  if (draft !== undefined && draft !== '') {
    const n = parseFloat(draft)
    if (Number.isFinite(n) && n > 0) return n
  }
  const spec = specsById.get(specId)
  if (spec?.correction_factor != null) return Number(spec.correction_factor)
  return null
}

export function factorsDiffer(a: number, b: number, epsilon = 0.0001): boolean {
  return Math.abs(a - b) > epsilon
}
