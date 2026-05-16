import { XMLParser } from 'fast-xml-parser'
import type { ParsedCfdi, CfdiTipoComprobante } from '@/types/finance'

export class CfdiParseError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'CfdiParseError'
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
})

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length === 0 ? null : s
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

export function parseCfdiXml(xml: string): ParsedCfdi {
  let parsed: any
  try {
    parsed = parser.parse(xml)
  } catch (err) {
    throw new CfdiParseError(`XML inválido: ${(err as Error).message}`)
  }

  const comprobante = parsed?.Comprobante
  if (!comprobante) {
    throw new CfdiParseError('No se encontró el nodo cfdi:Comprobante', 'Comprobante')
  }

  const emisor = comprobante.Emisor
  const receptor = comprobante.Receptor
  if (!emisor?.['@_Rfc']) throw new CfdiParseError('Falta Emisor.Rfc', 'Emisor.Rfc')
  if (!receptor?.['@_Rfc']) throw new CfdiParseError('Falta Receptor.Rfc', 'Receptor.Rfc')

  // Timbre Fiscal Digital (UUID lives here)
  const complemento = comprobante.Complemento
  const tfd = complemento?.TimbreFiscalDigital
  if (!tfd?.['@_UUID']) {
    throw new CfdiParseError('Falta TimbreFiscalDigital.UUID — el CFDI no está timbrado', 'UUID')
  }

  const tipo = String(comprobante['@_TipoDeComprobante'] ?? '').toUpperCase()
  if (!['I', 'E', 'P', 'N', 'T'].includes(tipo)) {
    throw new CfdiParseError(`TipoDeComprobante inválido: "${tipo}"`, 'TipoDeComprobante')
  }
  const tipo_comprobante = tipo as CfdiTipoComprobante

  const subtotal = num(comprobante['@_SubTotal'])
  const descuento = num(comprobante['@_Descuento'])
  const total = num(comprobante['@_Total'])

  // Impuestos
  const impuestos = comprobante.Impuestos
  let iva_trasladado = 0
  let vat_rate = 0
  if (impuestos?.Traslados) {
    const traslados = asArray(impuestos.Traslados.Traslado)
    for (const t of traslados) {
      // Impuesto 002 = IVA
      if (String(t?.['@_Impuesto']) === '002') {
        iva_trasladado += num(t?.['@_Importe'])
        const tasa = num(t?.['@_TasaOCuota'])
        if (tasa > vat_rate) vat_rate = tasa
      }
    }
  }
  let isr_retenido = 0
  let iva_retenido = 0
  if (impuestos?.Retenciones) {
    const retenciones = asArray(impuestos.Retenciones.Retencion)
    for (const r of retenciones) {
      const imp = String(r?.['@_Impuesto'])
      const importe = num(r?.['@_Importe'])
      if (imp === '001') isr_retenido += importe // ISR
      else if (imp === '002') iva_retenido += importe // IVA retenido
    }
  }

  // Retention rates: derived against the taxable base / IVA
  const taxable_base = Math.max(0, subtotal - descuento)
  const retention_isr_rate = taxable_base > 0 ? Math.round((isr_retenido / taxable_base) * 10000) / 10000 : 0
  const retention_iva_rate = iva_trasladado > 0 ? Math.round((iva_retenido / iva_trasladado) * 10000) / 10000 : 0

  // CfdiRelacionados — CFDI 4.0 wraps in CfdiRelacionados/CfdiRelacionado
  const cfdi_relacionados: Array<{ uuid: string; tipo_relacion: string }> = []
  const relWrappers = asArray(comprobante.CfdiRelacionados)
  for (const wrap of relWrappers) {
    const tipoRel = String(wrap?.['@_TipoRelacion'] ?? '')
    const related = asArray(wrap?.CfdiRelacionado)
    for (const r of related) {
      const uuid = str(r?.['@_UUID'])
      if (uuid) cfdi_relacionados.push({ uuid: uuid.toLowerCase(), tipo_relacion: tipoRel })
    }
  }

  // REP (Complemento de Pago) — present when tipo='P'
  const pagos_doctos: ParsedCfdi['pagos_doctos'] = []
  if (tipo_comprobante === 'P' && complemento?.Pagos) {
    const pagos = asArray(complemento.Pagos.Pago)
    for (const p of pagos) {
      const doctos = asArray(p?.DoctoRelacionado)
      for (const d of doctos) {
        const docUuid = str(d?.['@_IdDocumento'])
        if (!docUuid) continue
        pagos_doctos.push({
          uuid: String(tfd['@_UUID']).toLowerCase(),
          docto_relacionado_uuid: docUuid.toLowerCase(),
          imp_pagado: num(d?.['@_ImpPagado']),
          num_parcialidad: num(d?.['@_NumParcialidad'], 1),
        })
      }
    }
  }

  return {
    uuid: String(tfd['@_UUID']).toLowerCase(),
    serie: str(comprobante['@_Serie']),
    folio: str(comprobante['@_Folio']),
    tipo_comprobante,
    fecha_emision: String(comprobante['@_Fecha']),
    fecha_timbrado: String(tfd['@_FechaTimbrado']),
    emisor_rfc: String(emisor['@_Rfc']).toUpperCase(),
    emisor_nombre: str(emisor['@_Nombre']),
    receptor_rfc: String(receptor['@_Rfc']).toUpperCase(),
    receptor_nombre: str(receptor['@_Nombre']),
    subtotal,
    descuento,
    total,
    iva_trasladado,
    isr_retenido,
    iva_retenido,
    vat_rate,
    retention_isr_rate,
    retention_iva_rate,
    metodo_pago: str(comprobante['@_MetodoPago']),
    forma_pago: str(comprobante['@_FormaPago']),
    uso_cfdi: str(receptor?.['@_UsoCFDI']),
    moneda: str(comprobante['@_Moneda']) ?? 'MXN',
    tipo_cambio: num(comprobante['@_TipoCambio'], 1),
    cfdi_relacionados,
    pagos_doctos,
  }
}
