import { describe, expect, it } from 'vitest'
import { cfdiFolioUploadKey, invoiceNumberFromCfdi, markUploadDuplicates } from './bulkCfdiValidation'
import type { ParsedCfdi } from '@/types/finance'

function miniCfdi(overrides: Partial<ParsedCfdi> = {}): ParsedCfdi {
  return {
    uuid: 'uuid-a',
    serie: 'A',
    folio: '1',
    tipo_comprobante: 'I',
    emisor_rfc: 'EMI123',
    emisor_nombre: 'P',
    receptor_rfc: 'REC',
    fecha_emision: '2026-01-01',
    fecha_timbrado: '2026-01-01',
    subtotal: 100,
    descuento: 0,
    total: 116,
    vat_rate: 0.16,
    iva_trasladado: 16,
    forma_pago: '03',
    metodo_pago: 'PUE',
    uso_cfdi: 'G03',
    conceptos: [],
    retenciones: [],
    pagos_doctos: [],
    ...overrides,
  }
}

describe('markUploadDuplicates', () => {
  it('flags duplicate UUIDs in the same upload', () => {
    const items = [
      { id: 'same-uuid', file_name: 'a.xml', cfdi: miniCfdi({ uuid: 'same-uuid' }) },
      { id: 'same-uuid', file_name: 'b.xml', cfdi: miniCfdi({ uuid: 'same-uuid', folio: '2' }) },
    ]
    const marked = markUploadDuplicates(items)
    expect(marked[0].duplicate_cfdi_in_upload).toBe(true)
    expect(marked[1].duplicate_cfdi_in_upload).toBe(true)
  })

  it('flags duplicate emisor+folio in the same upload', () => {
    const items = [
      { id: 'u1', file_name: 'a.xml', cfdi: miniCfdi({ uuid: 'u1', folio: '99' }) },
      { id: 'u2', file_name: 'b.xml', cfdi: miniCfdi({ uuid: 'u2', folio: '99' }) },
    ]
    const marked = markUploadDuplicates(items)
    expect(marked[0].duplicate_folio_in_upload).toBe(true)
    expect(marked[1].duplicate_folio_in_upload).toBe(true)
  })
})

describe('invoiceNumberFromCfdi', () => {
  it('joins serie and folio', () => {
    expect(invoiceNumberFromCfdi(miniCfdi({ serie: 'ZFE', folio: '123' }))).toBe('ZFE-123')
  })
})

describe('cfdiFolioUploadKey', () => {
  it('normalizes emisor and folio', () => {
    expect(cfdiFolioUploadKey(miniCfdi({ emisor_rfc: 'emi123', serie: 'a', folio: '1' }))).toBe(
      'EMI123|A-1',
    )
  })
})
