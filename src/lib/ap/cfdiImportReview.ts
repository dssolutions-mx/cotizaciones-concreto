import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeCfdiUuid } from '../sat/normalizeCfdiUuid'
import { invoiceNumberFromCfdi } from './bulkCfdiValidation'
import type { ParsedCfdi } from '@/types/finance'

export type ExistingDocumentRef = { id: string; document_number: string }

export type SupplierInvoiceDuplicates = {
  by_uuid: ExistingDocumentRef | null
  by_folio: ExistingDocumentRef | null
}

export type CreditNoteDuplicates = {
  by_uuid: ExistingDocumentRef | null
  by_folio: ExistingDocumentRef | null
}

export async function lookupSupplierInvoiceDuplicates(
  supabase: SupabaseClient,
  params: {
    cfdiUuid: string
    supplierGroupId?: string | null
    plantId?: string | null
    cfdi?: Pick<ParsedCfdi, 'serie' | 'folio' | 'uuid'>
  },
): Promise<SupplierInvoiceDuplicates> {
  const uuid = normalizeCfdiUuid(params.cfdiUuid) ?? params.cfdiUuid

  const { data: byUuid } = await supabase
    .from('supplier_invoices')
    .select('id, invoice_number')
    .eq('cfdi_uuid', uuid)
    .maybeSingle()

  let byFolio: ExistingDocumentRef | null = null
  const invoiceNumber = params.cfdi ? invoiceNumberFromCfdi(params.cfdi) : null
  if (params.supplierGroupId && params.plantId && invoiceNumber) {
    const { data: byFolioRow } = await supabase
      .from('supplier_invoices')
      .select('id, invoice_number')
      .eq('supplier_group_id', params.supplierGroupId)
      .eq('plant_id', params.plantId)
      .eq('invoice_number', invoiceNumber)
      .maybeSingle()
    if (byFolioRow) {
      byFolio = {
        id: byFolioRow.id,
        document_number: byFolioRow.invoice_number,
      }
    }
  }

  return {
    by_uuid: byUuid
      ? { id: byUuid.id, document_number: byUuid.invoice_number }
      : null,
    by_folio: byFolio,
  }
}

export async function lookupCreditNoteDuplicates(
  supabase: SupabaseClient,
  params: {
    cfdiUuid: string
    supplierGroupId?: string | null
    plantId?: string | null
    creditNumber?: string | null
  },
): Promise<CreditNoteDuplicates> {
  const uuid = normalizeCfdiUuid(params.cfdiUuid) ?? params.cfdiUuid

  const { data: byUuid } = await supabase
    .from('invoice_credit_notes')
    .select('id, credit_number')
    .eq('cfdi_uuid', uuid)
    .maybeSingle()

  let byFolio: ExistingDocumentRef | null = null
  const folio = params.creditNumber?.trim()
  if (params.supplierGroupId && folio) {
    let q = supabase
      .from('invoice_credit_notes')
      .select('id, credit_number')
      .eq('supplier_group_id', params.supplierGroupId)
      .eq('credit_number', folio)
    if (params.plantId) q = q.eq('plant_id', params.plantId)
    const { data: byFolioRow } = await q.maybeSingle()
    if (byFolioRow) {
      byFolio = {
        id: byFolioRow.id,
        document_number: byFolioRow.credit_number ?? byFolioRow.id,
      }
    }
  }

  return {
    by_uuid: byUuid
      ? { id: byUuid.id, document_number: byUuid.credit_number ?? byUuid.id }
      : null,
    by_folio: byFolio,
  }
}

export function isSupplierInvoiceAlreadyRegistered(d: SupplierInvoiceDuplicates): boolean {
  return Boolean(d.by_uuid ?? d.by_folio)
}

export function isCreditNoteAlreadyRegistered(d: CreditNoteDuplicates): boolean {
  return Boolean(d.by_uuid ?? d.by_folio)
}

export function supplierInvoiceAllocatedMessage(d: SupplierInvoiceDuplicates): string | null {
  if (d.by_uuid) {
    return `Ya facturado en sistema (${d.by_uuid.document_number})`
  }
  if (d.by_folio) {
    return `Folio ya registrado (${d.by_folio.document_number})`
  }
  return null
}

export function creditNoteAllocatedMessage(d: CreditNoteDuplicates): string | null {
  if (d.by_uuid) {
    return `Ya registrada en sistema (${d.by_uuid.document_number})`
  }
  if (d.by_folio) {
    return `Folio NC ya registrado (${d.by_folio.document_number})`
  }
  return null
}

export function repPaymentAllocatedMessage(alreadyInDb: boolean, duplicateInUpload: boolean): string | null {
  if (alreadyInDb) return 'Pago ya registrado en el sistema'
  if (duplicateInUpload) return 'Pago repetido en el archivo — omitido'
  return null
}
