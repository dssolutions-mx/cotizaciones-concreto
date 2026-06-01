import { describe, expect, it } from 'vitest'
import { parseCompanyRfcSetting, compareReceptorRfc } from './companyRfc'
import { buildMatchDetails, scoreFromMatchDetails } from './cfdiEntryMatchDetails'
import type { ParsedCfdi } from '@/types/finance'

describe('parseCompanyRfcSetting', () => {
  it('parses plain RFC', () => {
    expect(parseCompanyRfcSetting('DCO180612U76')).toBe('DCO180612U76')
  })

  it('parses JSON string RFC', () => {
    expect(parseCompanyRfcSetting('"DCO180612U76"')).toBe('DCO180612U76')
  })

  it('parses JSON object with rfc', () => {
    expect(parseCompanyRfcSetting('{"rfc":"DCO180612U76"}')).toBe('DCO180612U76')
  })
})

describe('compareReceptorRfc', () => {
  it('returns skipped when company RFC missing', () => {
    expect(compareReceptorRfc('DCO180612U76', null).receptor_match).toBe('skipped')
  })

  it('matches CEMEX sample receptor', () => {
    const r = compareReceptorRfc('DCO180612U76', 'DCO180612U76')
    expect(r.receptor_match).toBe('ok')
  })
})

describe('cement CFDI match details', () => {
  const cfdi: ParsedCfdi = {
    uuid: 'cc9bd47e-97c1-4b9b-a24e-7b05b62f44ae',
    serie: 'ZFE',
    folio: '24788041',
    tipo_comprobante: 'I',
    fecha_emision: '2026-04-14T21:50:00',
    fecha_timbrado: '2026-04-15T00:11:20',
    emisor_rfc: 'CEM880726UZA',
    emisor_nombre: 'CEMEX',
    receptor_rfc: 'DCO180612U76',
    receptor_nombre: 'DC CONCRETOS',
    subtotal: 85351.35,
    descuento: 0,
    total: 99007.57,
    iva_trasladado: 13656.22,
    isr_retenido: 0,
    iva_retenido: 0,
    vat_rate: 0.16,
    retention_isr_rate: 0,
    retention_iva_rate: 0,
    retenciones: [],
    metodo_pago: 'PPD',
    forma_pago: '99',
    uso_cfdi: 'G01',
    moneda: 'MXN',
    tipo_cambio: 1,
    cfdi_relacionados: [],
    pagos_doctos: [],
    conceptos: [{
      clave_prod_serv: '30111601',
      clave_unidad: 'TNE',
      unidad: 'TN',
      no_identificacion: '10000050',
      cantidad: 28.03,
      descripcion: 'VERTUA PLUS GRIS CPC 40 GRANEL',
      valor_unitario: 3045,
      importe: 85351.35,
      descuento: 0,
      objeto_imp: '02',
    }],
  }

  const entry = {
    id: 'e1',
    entry_number: 'REC-100',
    entry_date: '2026-04-14',
    plant_id: 'p1',
    total_cost: 85351.35,
    supplier_invoice: 'ZFE-24788041',
    received_qty_entered: 28.03,
    received_qty_kg: 28030,
    received_uom: 'TN',
    unit_price: 3045,
    material: { id: 'm1', material_name: 'CEMENTO VERTUA GRIS CPC 40' },
    supplier: {
      group_id: 'g-cemex',
      supplier_group: { id: 'g-cemex', name: 'CEMEX', rfc: 'CEM880726UZA' },
    },
  }

  it('scores high on folio, amount, description, qty and unit price', () => {
    const score = scoreFromMatchDetails(entry, cfdi)
    expect(score).toBeGreaterThanOrEqual(150)
    const { fields } = buildMatchDetails(entry, cfdi)
    const subtotal = fields.find(f => f.label === 'Subtotal línea')
    expect(subtotal?.status).toBe('match')
    const qty = fields.find(f => f.label.startsWith('Cantidad'))
    expect(qty?.status).toBe('match')
    const price = fields.find(f => f.label === 'Precio unitario')
    expect(price?.status).toBe('match')
  })

  it('marks unit price mismatch when subtotal still matches', () => {
    const mismatched = { ...entry, unit_price: 3200 }
    const { fields } = buildMatchDetails(mismatched, cfdi)
    const price = fields.find(f => f.label === 'Precio unitario')
    expect(price?.status).toBe('mismatch')
    const subtotal = fields.find(f => f.label === 'Subtotal línea')
    expect(subtotal?.status).toBe('match')
  })
})
