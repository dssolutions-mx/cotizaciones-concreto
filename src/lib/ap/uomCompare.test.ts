import { describe, expect, it } from 'vitest'
import {
  cfdiConceptoQtyKg,
  entryQtyKg,
  normalizedUnitPrice,
  qtyToKg,
  uomDimension,
} from './uomCompare'

describe('uomCompare', () => {
  it('converts CFDI tonnes to kg', () => {
    expect(qtyToKg(28.03, 'TNE')).toBe(28030)
    expect(qtyToKg(28.03, 'TN')).toBe(28030)
  })

  it('converts internal tons to kg', () => {
    expect(qtyToKg(28.03, 'tons')).toBe(28030)
  })

  it('uses received_qty_kg when present', () => {
    expect(entryQtyKg({
      received_qty_kg: 28030,
      received_qty_entered: 28.03,
      received_uom: 'tons',
    })).toBe(28030)
  })

  it('converts entry kg uom', () => {
    expect(entryQtyKg({
      received_qty_entered: 28030,
      received_uom: 'kg',
    })).toBe(28030)
  })

  it('normalizes unit price per ton vs per kg', () => {
    const perTon = normalizedUnitPrice(3045, 'TN')
    const perKg = normalizedUnitPrice(3.045, 'kg')
    expect(perTon?.dimension).toBe('mass')
    expect(perKg?.dimension).toBe('mass')
    expect(perTon?.price).toBeCloseTo(3.045, 4)
    expect(perKg?.price).toBeCloseTo(3.045, 4)
  })

  it('detects volume dimension', () => {
    expect(uomDimension('l')).toBe('volume')
    expect(uomDimension('LTR')).toBe('volume')
  })

  it('reads CEMEX concepto UOM from clave or unidad', () => {
    expect(cfdiConceptoQtyKg({
      cantidad: 28.03,
      clave_unidad: 'TNE',
      unidad: 'TN',
    })).toBe(28030)
  })
})
