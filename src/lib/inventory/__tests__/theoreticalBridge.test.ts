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
    total_entries: 10,
    total_manual_additions: 0,
    total_remisiones_consumption: 50,
    total_manual_withdrawals: 0,
    total_waste: 0,
    theoretical_final_stock: 60,
    actual_current_stock: 80,
    variance: 20,
    variance_percentage: 33.33,
    ...overrides,
  }
}

describe('buildTheoreticalBridgeFromFlow', () => {
  it('adds ledger period positive adjustments omitted from dashboard flow', () => {
    const flow = baseFlow({
      total_manual_additions: 0,
      theoretical_final_stock: 60,
    })
    const bridge = buildTheoreticalBridgeFromFlow(flow, {
      adj_positive_kg: 25,
      adj_negative_abs_kg: 0,
    })
    expect(bridge.period_adjustments_positive_kg).toBe(25)
    expect(bridge.theoretical_final_kg).toBe(85)
    expect(bridge.initial_stock_kg).toBe(100)
    expect(
      bridge.initial_stock_kg +
        bridge.period_entries_kg +
        bridge.period_adjustments_positive_kg -
        bridge.period_adjustments_negative_kg -
        bridge.period_consumption_kg -
        bridge.period_waste_kg,
    ).toBe(bridge.theoretical_final_kg)
  })

  it('uses flow columns arithmetically when no ledger override', () => {
    const flow = baseFlow({ initial_stock: 200, total_manual_additions: 5 })
    const bridge = buildTheoreticalBridgeFromFlow(flow)
    expect(bridge.initial_stock_kg).toBe(200)
    expect(bridge.theoretical_final_kg).toBe(165)
    expect(bridge.adjustments_from_ledger_audit).toBe(false)
  })
})
