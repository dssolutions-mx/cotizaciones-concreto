/**
 * Puente teórico de inventario — misma aritmética que consumos / cierre.
 * Inv. final = inicial + entradas + ajustes+ − ajustes− − consumo − desperdicio
 */

import type { MaterialFlowSummary } from '@/types/inventory'
import type { LedgerAuditAdjustmentTotals } from '@/lib/inventory/ledgerAuditPeriodTotals'

export type TheoreticalBridgeKg = {
  initial_stock_kg: number
  period_entries_kg: number
  period_adjustments_positive_kg: number
  period_adjustments_negative_kg: number
  period_adjustments_kg: number
  period_consumption_kg: number
  period_waste_kg: number
  theoretical_final_kg: number
  system_current_stock_kg: number
  variance_vs_system_kg: number
  adjustments_from_ledger_audit: boolean
}

export function bridgeAdjustmentColumns(
  flow: MaterialFlowSummary | undefined,
  ledger?: LedgerAuditAdjustmentTotals,
): { positive_kg: number; negative_kg: number; fromLedger: boolean } {
  if (ledger) {
    return {
      positive_kg: ledger.adj_positive_kg,
      negative_kg: ledger.adj_negative_abs_kg,
      fromLedger: true,
    }
  }
  return {
    positive_kg: flow?.total_manual_additions ?? 0,
    negative_kg: Math.abs(flow?.total_manual_withdrawals ?? 0),
    fromLedger: false,
  }
}

export function computeBridgeTheoreticalFinalKg(parts: {
  initial_stock_kg: number
  period_entries_kg: number
  period_adjustments_positive_kg: number
  period_adjustments_negative_kg: number
  period_consumption_kg: number
  period_waste_kg: number
}): number {
  return (
    parts.initial_stock_kg +
    parts.period_entries_kg +
    parts.period_adjustments_positive_kg -
    parts.period_adjustments_negative_kg -
    parts.period_consumption_kg -
    parts.period_waste_kg
  )
}

/** Net period adjustments as used by `calculateHistoricalInventory` flow summary. */
export function flowPeriodAdjustmentNetKg(flow: MaterialFlowSummary): number {
  return (
    Number(flow.total_manual_additions ?? 0) - Math.abs(Number(flow.total_manual_withdrawals ?? 0))
  )
}

/** Build kg columns from dashboard flow + optional ledger audit overrides (consumos contable). */
export function buildTheoreticalBridgeFromFlow(
  flow: MaterialFlowSummary,
  ledger?: LedgerAuditAdjustmentTotals,
): TheoreticalBridgeKg {
  const { positive_kg, negative_kg, fromLedger } = bridgeAdjustmentColumns(flow, ledger)
  const period_entries_kg = flow.total_entries
  const period_consumption_kg = flow.total_remisiones_consumption
  const period_waste_kg = flow.total_waste

  const ledgerPeriodAdjNet = positive_kg - negative_kg
  const flowPeriodAdjNet = flowPeriodAdjustmentNetKg(flow)

  // Dashboard flow omits paired positive adjustments on OPEN/ADJP FIFO materials; ledger audit does not.
  const theoretical_final_kg = fromLedger
    ? Number(flow.theoretical_final_stock) + (ledgerPeriodAdjNet - flowPeriodAdjNet)
    : computeBridgeTheoreticalFinalKg({
        initial_stock_kg: flow.initial_stock,
        period_entries_kg,
        period_adjustments_positive_kg: positive_kg,
        period_adjustments_negative_kg: negative_kg,
        period_consumption_kg,
        period_waste_kg,
      })

  // Foot the bridge columns to the corrected final (inicial absorbs period adj delta vs dashboard).
  const initial_stock_kg = fromLedger
    ? theoretical_final_kg -
      period_entries_kg -
      positive_kg +
      negative_kg +
      period_consumption_kg +
      period_waste_kg
    : flow.initial_stock

  const system_current_stock_kg = flow.actual_current_stock
  return {
    initial_stock_kg,
    period_entries_kg,
    period_adjustments_positive_kg: positive_kg,
    period_adjustments_negative_kg: negative_kg,
    period_adjustments_kg: positive_kg - negative_kg,
    period_consumption_kg,
    period_waste_kg,
    theoretical_final_kg,
    system_current_stock_kg,
    variance_vs_system_kg: system_current_stock_kg - theoretical_final_kg,
    adjustments_from_ledger_audit: fromLedger,
  }
}
