import { XMLParser } from 'fast-xml-parser'
import type { CfdiConcepto, ParsedCfdi, CfdiRetencion, CfdiTipoComprobante } from '@/types/finance'

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
  const retenciones: CfdiRetencion[] = []
  const impuestoCounts: Record<string, number> = {}
  if (impuestos?.Retenciones) {
    const retencionNodes = asArray(impuestos.Retenciones.Retencion)
    for (const r of retencionNodes) {
      const imp = String(r?.['@_Impuesto'] ?? '')
      const importe = num(r?.['@_Importe'])
      const tasa = num(r?.['@_TasaOCuota'])
      if (imp === '001') isr_retenido += importe
      else if (imp === '002') iva_retenido += importe
      const idx = impuestoCounts[imp] ?? 0
      impuestoCounts[imp] = idx + 1
      retenciones.push({
        impuesto_sat: imp,
        importe,
        tasa_o_cuota: tasa > 0 ? tasa : undefined,
      })
    }
  }

  // Retention rates: both expressed as a fraction of the taxable base (pre-IVA).
  // This aligns with SAT TasaOCuota convention and the invoice route formula
  // ivaRetAmt = taxableBase * retention_iva_rate.
  // Example: IVA ret 2/3 (10.67% of base) → retention_iva_rate = 0.106667
  const taxable_base = Math.max(0, subtotal - descuento)
  // Use 6 decimal places so rates like 0.106667 (2/3 of 16%) round correctly
  const retention_isr_rate = taxable_base > 0 ? Math.round((isr_retenido / taxable_base) * 1000000) / 1000000 : 0
  const retention_iva_rate = taxable_base > 0 ? Math.round((iva_retenido / taxable_base) * 1000000) / 1000000 : 0

  // Conceptos (line items)
  const conceptos: CfdiConcepto[] = []
  const conceptoNodes = asArray(comprobante.Conceptos?.Concepto)
  for (const c of conceptoNodes) {
    conceptos.push({
      clave_prod_serv: str(c?.['@_ClaveProdServ']),
      clave_unidad: str(c?.['@_ClaveUnidad']),
      unidad: str(c?.['@_Unidad']),
      no_identificacion: str(c?.['@_NoIdentificacion']),
      cantidad: num(c?.['@_Cantidad'], 1),
      descripcion: str(c?.['@_Descripcion']) ?? '',
      valor_unitario: num(c?.['@_ValorUnitario']),
      importe: num(c?.['@_Importe']),
      descuento: num(c?.['@_Descuento']),
      objeto_imp: str(c?.['@_ObjetoImp']),
    })
  }

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
  const repUuid = String(tfd['@_UUID']).toLowerCase()
  if (tipo_comprobante === 'P' && complemento?.Pagos) {
    const pagos = asArray(complemento.Pagos.Pago)
    for (const p of pagos) {
      const fechaPagoRaw = str(p?.['@_FechaPago'])
      const fecha_pago = fechaPagoRaw ? fechaPagoRaw.slice(0, 10) : null
      const forma_pago_p = str(p?.['@_FormaDePagoP'])
      const moneda_p = str(p?.['@_MonedaP'])
      const doctos = asArray(p?.DoctoRelacionado)
      for (const d of doctos) {
        const docUuid = str(d?.['@_IdDocumento'])
        if (!docUuid) continue
        pagos_doctos.push({
          uuid: repUuid,
          docto_relacionado_uuid: docUuid.toLowerCase(),
          imp_pagado: num(d?.['@_ImpPagado']),
          num_parcialidad: num(d?.['@_NumParcialidad'], 1),
          fecha_pago,
          forma_pago_p,
          moneda_p,
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
    retenciones,
    metodo_pago: str(comprobante['@_MetodoPago']),
    forma_pago: str(comprobante['@_FormaPago']),
    uso_cfdi: str(receptor?.['@_UsoCFDI']),
    moneda: str(comprobante['@_Moneda']) ?? 'MXN',
    tipo_cambio: num(comprobante['@_TipoCambio'], 1),
    cfdi_relacionados,
    pagos_doctos,
    conceptos,
  }
}
