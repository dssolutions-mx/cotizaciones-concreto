import { describe, expect, it } from 'vitest'
import { buildTheoreticalBridgeFromFlow } from '../theoreticalBridge'
import type { MaterialFlowSummary } from '../../../types/inventory'

function baseFlow(overrides: Partial<MaterialFlowSummary> = {}): MaterialFlowSummary {
  return {
    material_id: 'm1',
    material_name: 'Inclusor de aire',
    unit: 'L',
    material_code: 'A52',
    initial_stock: 100,
    total_entries: 0,
    total_manual_additions: 0,
    total_remisiones_consumption: 50,
    total_manual_withdrawals: 0,
    total_waste: 0,
    theoretical_final_stock: 50,
    actual_current_stock: 80,
    variance: 30,
    variance_percentage: 60,
    ...overrides,
  }
}

describe('buildTheoreticalBridgeFromFlow', () => {
  it('uses ledger period adjustments and opening when bridge totals are provided', () => {
    const flow = baseFlow({
      initial_stock: 100,
      total_manual_additions: 0,
      theoretical_final_stock: 50,
    })
    const bridge = buildTheoreticalBridgeFromFlow(flow, {
      adj_positive_kg: 25,
      adj_negative_abs_kg: 0,
      opening_kg: 120,
    })
    expect(bridge.period_adjustments_positive_kg).toBe(25)
    expect(bridge.initial_stock_kg).toBe(120)
    expect(bridge.theoretical_final_kg).toBe(120 + 0 + 25 - 50 - 0)
    expect(bridge.adjustments_from_ledger_audit).toBe(true)
  })

  it('falls back to flow initial when only adjustment ledger totals exist', () => {
    const flow = baseFlow({ initial_stock: 200 })
    const bridge = buildTheoreticalBridgeFromFlow(flow, {
      adj_positive_kg: 10,
      adj_negative_abs_kg: 5,
    })
    expect(bridge.initial_stock_kg).toBe(200)
    expect(bridge.theoretical_final_kg).toBe(200 + 10 - 5 - 50)
  })
})
