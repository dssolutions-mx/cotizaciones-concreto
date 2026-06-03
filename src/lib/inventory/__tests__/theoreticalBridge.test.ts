import { describe, expect, it } from 'vitest'
import { buildTheoreticalBridgeFromFlow } from '../theoreticalBridge'
import type { MaterialFlowSummary } from '../../../types/inventory'

function baseFlow(overrides: Partial<MaterialFlowSummary> = {}): MaterialFlowSummary {
  return {
    material_id: 'm1',
    material_name: 'Inclusor de aire',
    unit: 'L',
    material_code: 'A52',
    initial_stock: 0,
    total_entries: 0,
    total_manual_additions: 20,
    total_remisiones_consumption: 12.45,
    total_manual_withdrawals: 0,
    total_waste: 0,
    theoretical_final_stock: -12.45,
    actual_current_stock: 27,
    variance: 39.45,
    variance_percentage: 0,
    ...overrides,
  }
}

describe('buildTheoreticalBridgeFromFlow', () => {
  it('uses ledger adjustments in the bridge even when flow.theoretical_final_stock is stale', () => {
    const flow = baseFlow()
    const bridge = buildTheoreticalBridgeFromFlow(flow, {
      adj_positive_kg: 20,
      adj_negative_abs_kg: 0,
    })
    expect(bridge.period_adjustments_positive_kg).toBe(20)
    expect(bridge.theoretical_final_kg).toBeCloseTo(7.55, 2)
    expect(bridge.initial_stock_kg).toBe(0)
  })

  it('uses flow columns when no ledger override', () => {
    const flow = baseFlow({ initial_stock: 100, total_manual_additions: 5, theoretical_final_stock: 60 })
    const bridge = buildTheoreticalBridgeFromFlow(flow)
    expect(bridge.theoretical_final_kg).toBeCloseTo(92.55, 2)
    expect(bridge.adjustments_from_ledger_audit).toBe(false)
  })
})
