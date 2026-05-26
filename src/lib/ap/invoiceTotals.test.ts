import assert from 'node:assert'
import {
  computeInvoiceTotals,
  computeInvoiceTotalsFromRates,
  deriveInvoiceSource,
  rollupRetentionsToHeader,
} from './invoiceTotals'

{
  const result = computeInvoiceTotals({
    subtotal: 1000,
    discount: 0,
    vatRate: 0.16,
    retentions: [
      { impuesto_sat: '001', amount: 12.5 },
      { impuesto_sat: '001', amount: 100 },
      { impuesto_sat: '002', amount: 40 },
    ],
  })
  assert.strictEqual(result.tax, 160)
  assert.strictEqual(result.retentionTotal, 152.5)
  assert.strictEqual(result.total, 1007.5)
}

{
  const result = computeInvoiceTotals({
    subtotal: 500,
    discount: 50,
    vatRate: 0.16,
    retentions: [],
  })
  assert.strictEqual(result.taxableBase, 450)
  assert.strictEqual(result.tax, 72)
  assert.strictEqual(result.total, 522)
}

{
  const result = computeInvoiceTotalsFromRates({
    subtotal: 1000,
    discount: 0,
    vatRate: 0.16,
    isrRate: 0.0125,
    ivaRetRate: 0.04,
  })
  assert.strictEqual(result.retentionRows.length, 2)
  assert.strictEqual(result.isrAmt, 12.5)
  assert.strictEqual(result.ivaRetAmt, 40)
}

{
  const roll = rollupRetentionsToHeader(
    [
      { impuesto_sat: '001', amount: 10 },
      { impuesto_sat: '001', amount: 5 },
      { impuesto_sat: '002', amount: 4 },
    ],
    100,
  )
  assert.strictEqual(roll.retention_isr_amount, 15)
  assert.strictEqual(roll.retention_iva_amount, 4)
}

assert.strictEqual(
  deriveInvoiceSource([
    { line_source: 'entry', entry_id: 'a' },
    { line_source: 'manual', entry_id: null },
  ]),
  'mixed',
)
assert.strictEqual(deriveInvoiceSource([{ line_source: 'manual' }]), 'historical')
assert.strictEqual(deriveInvoiceSource([{ entry_id: 'x' }]), 'system')

console.log('invoiceTotals.test.ts: ok')
