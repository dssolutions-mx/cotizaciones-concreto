import { tStudent95 } from '@/lib/ema/studentT'
import type { BudgetResult, UncertaintyComponent } from '@/lib/ema/uncertaintyBudget'
import type { VerificacionMetrologiaRecord } from '@/types/ema'

export function parseUncertaintyComponents(
  presupuesto_json: unknown,
): UncertaintyComponent[] {
  if (!Array.isArray(presupuesto_json)) return []
  return presupuesto_json as UncertaintyComponent[]
}

/** Rebuild GUM rollup summary from stored components + issued U/k when available. */
export function rebuildVerificationBudget(
  components: UncertaintyComponent[],
  u_expandida: number | null,
  k_factor: number | null,
): BudgetResult {
  const u_c = Math.sqrt(
    components.reduce((s, c) => {
      const v = Number(c.ui2_y)
      return s + (Number.isFinite(v) ? v : 0)
    }, 0),
  )
  const denom = components.reduce((s, c) => {
    const ui2 = Number(c.ui2_y)
    const nu = Number(c.nu)
    if (!Number.isFinite(ui2) || !Number.isFinite(nu) || nu === 0) return s
    return s + ui2 ** 2 / nu
  }, 0)
  const nu_eff = denom > 0 && Number.isFinite(u_c) ? u_c ** 4 / denom : Infinity
  const k = k_factor ?? tStudent95(nu_eff)
  const U =
    u_expandida != null && Number.isFinite(u_expandida)
      ? u_expandida
      : Number.isFinite(u_c) && Number.isFinite(k)
        ? u_c * k
        : 0
  const typeAComp = components.find((c) => c.tipo === 'A')
  const meanRaw = typeAComp?.valor_xi
  const mean_value =
    meanRaw != null && Number.isFinite(Number(meanRaw)) ? Number(meanRaw) : 0
  return {
    components,
    mean_value,
    u_c,
    nu_eff,
    k,
    U,
    U_rel_pct: null,
  }
}

export function metrologiaBudgetForPdf(
  metrologia: VerificacionMetrologiaRecord | null | undefined,
  cal: { u_expandida: number | null; k_factor: number | null } | null | undefined,
): BudgetResult | null {
  if (!metrologia || metrologia.gum_rollup_status !== 'ok') return null
  const components = parseUncertaintyComponents(metrologia.presupuesto_json)
  if (!components.length) return null
  return rebuildVerificationBudget(components, cal?.u_expandida ?? null, cal?.k_factor ?? null)
}
