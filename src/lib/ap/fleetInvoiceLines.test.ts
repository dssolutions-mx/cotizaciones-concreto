import { describe, expect, it } from 'vitest'
import {
  buildFleetInvoiceAggregatedLines,
  fleetQtyForBilling,
  fleetUnitPriceForBilling,
} from './fleetInvoiceLines'

const base = {
  id: 'e1',
  entry_number: 'ENT-001',
  material_id: 'm1',
  material: { material_name: 'Cemento' },
}

describe('fleetQtyForBilling', () => {
  it('uses fleet_qty_entered for tons', () => {
    expect(
      fleetQtyForBilling({
        ...base,
        fleet_cost: 900,
        fleet_qty_entered: 12.5,
        fleet_uom: 'tons',
      }),
    ).toBe(12.5)
  })

  it('defaults to 1 per entry for trips when qty missing', () => {
    expect(
      fleetQtyForBilling({
        ...base,
        fleet_cost: 450,
        fleet_uom: 'trips',
      }),
    ).toBe(1)
  })
})

describe('buildFleetInvoiceAggregatedLines', () => {
  it('aggregates tons by PO UoM not by entry count', () => {
    const lines = buildFleetInvoiceAggregatedLines([
      {
        ...base,
        id: 'e1',
        entry_number: 'ENT-001',
        fleet_cost: 450,
        fleet_qty_entered: 10,
        fleet_uom: 'tons',
        fleet_po_item_id: 'poi-1',
      },
      {
        ...base,
        id: 'e2',
        entry_number: 'ENT-002',
        fleet_cost: 450,
        fleet_qty_entered: 8,
        fleet_uom: 'tons',
        fleet_po_item_id: 'poi-1',
      },
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].qty).toBe('18.000')
    expect(lines[0].qtyUom).toBe('ton')
    expect(lines[0].amount).toBe('900.00')
    expect(lines[0].qty).not.toBe('2.00')
    expect(lines[0].description).toMatch(/18.*ton/)
    expect(lines[0].description).toContain('2 recepciones')
  })

  it('keeps trip billing as viaje count when qty is 1 per entry', () => {
    const lines = buildFleetInvoiceAggregatedLines([
      {
        ...base,
        fleet_cost: 450,
        fleet_uom: 'trips',
        fleet_po_item_id: 'poi-t',
      },
      {
        ...base,
        id: 'e2',
        entry_number: 'ENT-002',
        fleet_cost: 450,
        fleet_uom: 'trips',
        fleet_po_item_id: 'poi-t',
      },
    ])
    expect(lines[0].qty).toBe('2.00')
    expect(lines[0].qtyUom).toBe('viajes')
  })
})

describe('fleetUnitPriceForBilling', () => {
  it('derives MXN per ton from cost and qty', () => {
    expect(
      fleetUnitPriceForBilling({
        ...base,
        fleet_cost: 900,
        fleet_qty_entered: 12,
        fleet_uom: 'tons',
      }),
    ).toBe(75)
  })
})
