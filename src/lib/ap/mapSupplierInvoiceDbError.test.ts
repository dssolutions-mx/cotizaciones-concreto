import { describe, expect, it } from 'vitest'
import { mapSupplierInvoiceDbError } from './mapSupplierInvoiceDbError'

describe('mapSupplierInvoiceDbError', () => {
  it('maps payable_items duplicate to Spanish', () => {
    const msg = mapSupplierInvoiceDbError(
      'duplicate key value violates unique constraint "payable_items_entry_id_cost_category_key"',
      '23505',
    )
    expect(msg).toContain('cuentas por pagar')
    expect(msg).not.toContain('duplicate key')
  })

  it('passes through non-duplicate errors', () => {
    expect(mapSupplierInvoiceDbError('Campo requerido')).toBe('Campo requerido')
  })
})
