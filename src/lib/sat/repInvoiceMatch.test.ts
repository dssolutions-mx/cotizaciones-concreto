import assert from 'node:assert'
import { cfdiUuidsEqual } from './normalizeCfdiUuid'
import { folioMatchesInvoice, normalizeFolioForMatch } from './repInvoiceMatch'

assert.strictEqual(normalizeFolioForMatch('06278'), '6278')
assert.strictEqual(normalizeFolioForMatch(' 6278 '), '6278')

assert.ok(
  folioMatchesInvoice(
    { invoice_number: '6278', cfdi_folio: null, cfdi_serie: null },
    '6278',
    null,
  ),
)
assert.ok(
  folioMatchesInvoice(
    { invoice_number: 'A-6278', cfdi_folio: '6278', cfdi_serie: 'A' },
    '6278',
    'A',
  ),
)

assert.ok(cfdiUuidsEqual('FD4BC521-B096-4CA6-A0C1-B2D44F7499EA', 'fd4bc521-b096-4ca6-a0c1-b2d44f7499ea'))
assert.ok(!cfdiUuidsEqual('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee'))

console.log('repInvoiceMatch.test.ts: ok')
