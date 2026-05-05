/**
 * Inventario teórico desde el corte ERP abril 2026 (Planta 5 y mismo patrón en otras plantas).
 *
 * En Postgres (`fn_reconciled_stock_since_cutover`): saldo tras conteo (`inventory_after` del
 * `initial_count` *_opening), más recepciones físicas posteriores al día del ajuste (sin capas `0OPEN`/`ADJP`),
 * menos remisiones/merma/ajustes salida también posteriores a ese día — evita doble resta de remisiones
 * previas al conteo.
 *
 * @see supabase/migrations/20260507130100_fix_reconciled_fn_anchor_post_opening_day.sql
 */

/** Primer día del reporte de inventario post-cutover (movimientos “desde abril”). */
export const INVENTORY_CUTOVER_REPORT_START_DATE = '2026-04-01'

export type OpeningInitialCountRow = {
  inventory_before: number
  inventory_after?: number | null
  reference_type?: string | null
  adjustment_type: string
}

export function isPlantOpeningInitialCountRow(row: OpeningInitialCountRow): boolean {
  if (row.adjustment_type !== 'initial_count') return false
  const rt = (row.reference_type ?? '').trim()
  return rt.endsWith('_opening')
}

/**
 * Saldo físico de apertura (conteo): `inventory_after` del `initial_count` *_opening`.
 * Debe coincidir con el 0OPEN y con el CSV de conteo; no usar `inventory_before` (puede ser negativo o legacy).
 */
export function openingBaselineQuantity(row: OpeningInitialCountRow): number | null {
  if (!isPlantOpeningInitialCountRow(row)) return null
  const after = row.inventory_after
  if (after == null) return null
  const v = Number(after)
  if (!Number.isFinite(v)) return null
  return v
}

export type RollforwardPeriodTotals = {
  /** Σ material_entries.quantity_received desde corte (capas 0OPEN no son recepción física). */
  sumEntries: number
  /** Σ remision_materiales.cantidad_real en remisiones con fecha ≥ corte. */
  sumRemisionConsumption: number
  /** Σ waste en el periodo. */
  sumWaste: number
  /** Σ ajustes consumption/waste/loss/transfer en el periodo. */
  sumAdjustmentWithdrawals: number
  /** Σ otros ajustes positivos (no initial_count ya excluido en caller). */
  sumManualAdditions: number
}

/**
 * Stock teórico al cierre del rango [startDate,endDate] cuando el reporte arranca en el día de corte
 * y existe conteo inicial de planta `_opening`.
 */
export function theoreticalClosingFromOpeningBaseline(
  baseline: number,
  p: RollforwardPeriodTotals,
): number {
  return (
    baseline +
    p.sumEntries +
    p.sumManualAdditions -
    p.sumRemisionConsumption -
    p.sumAdjustmentWithdrawals -
    p.sumWaste
  )
}
