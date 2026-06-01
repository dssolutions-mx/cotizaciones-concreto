import type { ParsedCfdi } from '@/types/finance'
import { normalizeCfdiUuid } from '../sat/normalizeCfdiUuid'

export function invoiceNumberFromCfdi(cfdi: Pick<ParsedCfdi, 'serie' | 'folio' | 'uuid'>): string {
  return [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || cfdi.uuid.slice(0, 8)
}

export function cfdiFolioUploadKey(cfdi: Pick<ParsedCfdi, 'emisor_rfc' | 'serie' | 'folio'>): string {
  const folio = [cfdi.serie, cfdi.folio].filter(Boolean).join('-').toUpperCase()
  return `${cfdi.emisor_rfc.trim().toUpperCase()}|${folio}`
}

export type UploadDuplicateFlags = {
  duplicate_cfdi_in_upload: boolean
  duplicate_folio_in_upload: boolean
}

export type CfdiAllocationFlags = {
  duplicate_invoice: { id: string; invoice_number: string } | null
  duplicate_invoice_folio: { id: string; invoice_number: string } | null
} & UploadDuplicateFlags

/** CFDI or folio already exists in supplier_invoices — do not create again. */
export function isCfdiAlreadyAllocated(p: CfdiAllocationFlags): boolean {
  return Boolean(p.duplicate_invoice ?? p.duplicate_invoice_folio)
}

/** Repeated UUID/folio inside the same ZIP upload — omit from batch. */
export function isCfdiUploadDuplicate(p: UploadDuplicateFlags): boolean {
  return p.duplicate_cfdi_in_upload || p.duplicate_folio_in_upload
}

export function shouldOmitCfdiFromBulkCreate(p: CfdiAllocationFlags): boolean {
  return isCfdiAlreadyAllocated(p) || isCfdiUploadDuplicate(p)
}

export function allocatedCfdiLabel(p: CfdiAllocationFlags): string | null {
  if (p.duplicate_invoice) {
    return `Ya facturado en sistema (${p.duplicate_invoice.invoice_number})`
  }
  if (p.duplicate_invoice_folio) {
    return `Folio ya registrado (${p.duplicate_invoice_folio.invoice_number})`
  }
  return null
}

export function uploadDuplicateCfdiLabel(p: UploadDuplicateFlags): string | null {
  if (p.duplicate_cfdi_in_upload) return 'CFDI repetido en el archivo — omitido'
  if (p.duplicate_folio_in_upload) return 'Folio repetido en el archivo — omitido'
  return null
}

/** Mark items whose UUID or emisor+folio appears more than once in the same upload. */
export function markUploadDuplicates<T extends { id: string; cfdi: ParsedCfdi }>(
  items: T[],
): Array<T & UploadDuplicateFlags> {
  const uuidCounts = new Map<string, number>()
  const folioCounts = new Map<string, number>()

  for (const item of items) {
    const uuid = normalizeCfdiUuid(item.id) ?? item.id
    uuidCounts.set(uuid, (uuidCounts.get(uuid) ?? 0) + 1)
    const folioKey = cfdiFolioUploadKey(item.cfdi)
    if (folioKey.endsWith('|')) continue
    folioCounts.set(folioKey, (folioCounts.get(folioKey) ?? 0) + 1)
  }

  return items.map(item => {
    const uuid = normalizeCfdiUuid(item.id) ?? item.id
    const folioKey = cfdiFolioUploadKey(item.cfdi)
    return {
      ...item,
      duplicate_cfdi_in_upload: (uuidCounts.get(uuid) ?? 0) > 1,
      duplicate_folio_in_upload: folioKey.endsWith('|')
        ? false
        : (folioCounts.get(folioKey) ?? 0) > 1,
    }
  })
}
