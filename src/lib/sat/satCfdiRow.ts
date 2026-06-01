import type { ParsedCfdi } from '@/types/finance'
import { normalizeCfdiUuid } from '@/lib/sat/normalizeCfdiUuid'

export type SatCfdiImportSource = 'manual_zip' | 'manual_xml' | 'pac'

export function parsedCfdiToSatRow(
  cfdi: ParsedCfdi,
  importedBy: string,
  source: SatCfdiImportSource,
) {
  return {
    uuid: normalizeCfdiUuid(cfdi.uuid) ?? cfdi.uuid,
    receptor_rfc: cfdi.receptor_rfc,
    emisor_rfc: cfdi.emisor_rfc,
    emisor_nombre: cfdi.emisor_nombre,
    serie: cfdi.serie,
    folio: cfdi.folio,
    fecha_emision: cfdi.fecha_emision,
    fecha_timbrado: cfdi.fecha_timbrado,
    tipo_comprobante: cfdi.tipo_comprobante,
    subtotal: cfdi.subtotal,
    descuento: cfdi.descuento,
    total: cfdi.total,
    iva_trasladado: cfdi.iva_trasladado,
    isr_retenido: cfdi.isr_retenido,
    iva_retenido: cfdi.iva_retenido,
    metodo_pago: cfdi.metodo_pago,
    forma_pago: cfdi.forma_pago,
    uso_cfdi: cfdi.uso_cfdi,
    moneda: cfdi.moneda,
    tipo_cambio: cfdi.tipo_cambio,
    cfdi_relacionados: cfdi.cfdi_relacionados.length > 0 ? cfdi.cfdi_relacionados : null,
    pagos_doctos: cfdi.pagos_doctos.length > 0 ? cfdi.pagos_doctos : null,
    estado_sat: 'vigente' as const,
    imported_by: importedBy,
    source,
  }
}
