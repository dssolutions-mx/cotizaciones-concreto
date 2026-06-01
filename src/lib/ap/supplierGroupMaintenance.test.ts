import { describe, expect, it } from 'vitest'
import {
  buildDuplicateClusters,
  normalizeGroupName,
  pickCanonicalGroupId,
  type EnrichedSupplierGroup,
} from './supplierGroupMaintenance'

function group(
  partial: Partial<EnrichedSupplierGroup> & Pick<EnrichedSupplierGroup, 'id' | 'name'>,
): EnrichedSupplierGroup {
  return {
    rfc: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    supplier_count: 0,
    invoice_count: 0,
    credit_note_count: 0,
    suggested_rfc: null,
    rfc_conflict: false,
    ...partial,
  }
}

describe('normalizeGroupName', () => {
  it('trims and uppercases', () => {
    expect(normalizeGroupName('  promexma  ')).toBe('PROMEXMA')
  })
})

describe('pickCanonicalGroupId', () => {
  it('prefers group with RFC', () => {
    const id = pickCanonicalGroupId([
      group({ id: 'a', name: 'CEMEX', supplier_count: 5 }),
      group({ id: 'b', name: 'CEMEX', rfc: 'CEM880726UZA', supplier_count: 1 }),
    ])
    expect(id).toBe('b')
  })

  it('prefers more linked records when no RFC', () => {
    const id = pickCanonicalGroupId([
      group({ id: 'a', name: 'X', supplier_count: 0 }),
      group({ id: 'b', name: 'X', supplier_count: 3, invoice_count: 2 }),
    ])
    expect(id).toBe('b')
  })
})

describe('buildDuplicateClusters', () => {
  it('groups by normalized name', () => {
    const clusters = buildDuplicateClusters([
      group({ id: '1', name: 'PROMEXMA' }),
      group({ id: '2', name: 'promexma' }),
      group({ id: '3', name: 'CEMEX', rfc: 'X' }),
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].normalized_name).toBe('PROMEXMA')
    expect(clusters[0].groups).toHaveLength(2)
  })
})
