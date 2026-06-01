import { describe, expect, it } from 'vitest'
import {
  matchCfdiToEntries,
  type MatchableOrphanEntry,
  type ParsedCfdiForMatch,
} from './matchCfdiToEntries'
import type { ParsedCfdi } from '@/types/finance'

function makeCfdi(overrides: Partial<ParsedCfdi> = {}): ParsedCfdi {
  return {
    uuid: 'uuid-1',
    serie: 'A',
    folio: '100',
    tipo_comprobante: 'I',
    emisor_rfc: 'EMI123',
    emisor_nombre: 'Proveedor SA',
    receptor_rfc: 'REC456',
    fecha_emision: '2026-01-15T10:00:00',
    fecha_timbrado: '2026-01-15T10:01:00',
    subtotal: 1000,
    descuento: 0,
    total: 1160,
    vat_rate: 0.16,
    iva_trasladado: 160,
    forma_pago: '03',
    metodo_pago: 'PUE',
    uso_cfdi: 'G03',
    conceptos: [],
    retenciones: [],
    pagos_doctos: [],
    ...overrides,
  }
}

function makeEntry(overrides: Partial<MatchableOrphanEntry> = {}): MatchableOrphanEntry {
  return {
    id: 'entry-1',
    entry_number: 'REC-001',
    entry_date: '2026-01-14',
    plant_id: 'plant-1',
    total_cost: 1000,
    supplier_invoice: 'A-100',
    supplier: {
      group_id: 'group-1',
      supplier_group: { id: 'group-1', name: 'Proveedor SA', rfc: 'EMI123' },
    },
    ...overrides,
  }
}

function makeParsed(
  id: string,
  cfdi: Partial<ParsedCfdi> = {},
  extra: Partial<ParsedCfdiForMatch> = {},
): ParsedCfdiForMatch {
  const full = makeCfdi(cfdi)
  return {
    id,
    file_name: `${id}.xml`,
    cfdi: full,
    supplier_group: { id: 'group-1', name: 'Proveedor SA', rfc: full.emisor_rfc },
    receptor_match: 'ok',
    duplicate_invoice: null,
    duplicate_invoice_folio: null,
    duplicate_cfdi_in_upload: false,
    duplicate_folio_in_upload: false,
    ...extra,
  }
}

describe('matchCfdiToEntries', () => {
  it('matches by folio and amount with high confidence', () => {
    const entries = [makeEntry()]
    const parsed = [makeParsed('cfdi-1', { folio: '100', subtotal: 1000 })]
    const result = matchCfdiToEntries(entries, parsed)
    expect(result).toHaveLength(1)
    expect(result[0].cfdi_id).toBe('cfdi-1')
    expect(result[0].confidence).toBe('high')
  })

  it('filters CFDIs with wrong supplier group', () => {
    const entries = [makeEntry()]
    const parsed = [
      makeParsed('cfdi-wrong', {}, {
        supplier_group: { id: 'group-other', name: 'Otro', rfc: 'XXX999' },
      }),
    ]
    const result = matchCfdiToEntries(entries, parsed)
    expect(result[0].cfdi_id).toBeNull()
  })

  it('assigns unique CFDIs when two entries same supplier', () => {
    const entries = [
      makeEntry({ id: 'e1', supplier_invoice: 'A-100', total_cost: 500 }),
      makeEntry({ id: 'e2', supplier_invoice: 'A-101', total_cost: 800 }),
    ]
    const parsed = [
      makeParsed('c1', { folio: '100', subtotal: 500, uuid: 'u1' }),
      makeParsed('c2', { folio: '101', subtotal: 800, uuid: 'u2' }),
    ]
    const result = matchCfdiToEntries(entries, parsed)
    const ids = result.map(r => r.cfdi_id).sort()
    expect(ids).toEqual(['c1', 'c2'])
  })

  it('does not auto-assign CFDIs already in the system', () => {
    const entries = [makeEntry()]
    const parsed = [
      makeParsed('cfdi-dup', {}, {
        duplicate_invoice: { id: 'inv-1', invoice_number: 'FAC-001' },
      }),
    ]
    const result = matchCfdiToEntries(entries, parsed)
    expect(result[0].cfdi_id).toBeNull()
    expect(result[0].include_in_create).toBe(false)
  })

  it('prefers CFDI with closer date when amounts tie', () => {
    const entries = [
      makeEntry({ id: 'e1', entry_date: '2026-01-15', total_cost: 1000, supplier_invoice: null }),
    ]
    const parsed = [
      makeParsed('c-far', {
        uuid: 'u-far',
        folio: '200',
        subtotal: 1000,
        fecha_emision: '2026-01-25T10:00:00',
      }),
      makeParsed('c-near', {
        uuid: 'u-near',
        folio: '201',
        subtotal: 1000,
        fecha_emision: '2026-01-16T10:00:00',
      }),
    ]
    const result = matchCfdiToEntries(entries, parsed)
    expect(result[0].cfdi_id).toBe('c-near')
  })

  it('matches by amount within tolerance when folio differs', () => {
    const entries = [makeEntry({ supplier_invoice: null, total_cost: 1000.5 })]
    const parsed = [makeParsed('cfdi-amt', { folio: '999', subtotal: 1000 })]
    const result = matchCfdiToEntries(entries, parsed)
    expect(result[0].cfdi_id).toBe('cfdi-amt')
    expect(result[0].confidence).toBe('medium')
  })
})
