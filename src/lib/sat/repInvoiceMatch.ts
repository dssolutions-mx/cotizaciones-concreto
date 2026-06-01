import type { SupabaseClient } from '@supabase/supabase-js'
import { cfdiUuidsEqual, normalizeCfdiUuid } from '@/lib/sat/normalizeCfdiUuid'

export type InvoiceMatchRow = {
  id: string
  invoice_number: string
  status: string
  total: number
  plant_id: string
  supplier_group_id: string
  cfdi_uuid: string | null
  cfdi_folio: string | null
  cfdi_serie: string | null
  cfdi_emisor_rfc: string | null
  payable: { id: string; payments?: { amount: number }[] } | { id: string; payments?: { amount: number }[] }[] | null
  cn_allocations?: { allocated_total: number }[]
}

export type RepMatchResult =
  | {
      kind: 'found'
      invoice: InvoiceMatchRow
      method: 'uuid' | 'sat_bridge' | 'folio'
      backfill_cfdi_uuid: boolean
    }
  | { kind: 'ambiguous'; candidates: Array<{ id: string; invoice_number: string }> }
  | { kind: 'sat_without_invoice' }
  | { kind: 'not_found' }

export function normalizeFolioForMatch(value: string | null | undefined): string {
  if (!value) return ''
  return String(value).trim().toLowerCase().replace(/^0+/, '') || '0'
}

export function invoiceFolioKeys(inv: {
  invoice_number: string
  cfdi_folio?: string | null
  cfdi_serie?: string | null
}): string[] {
  const keys = new Set<string>()
  const add = (v: string | null | undefined) => {
    const n = normalizeFolioForMatch(v)
    if (n) keys.add(n)
  }
  add(inv.invoice_number)
  add(inv.cfdi_folio)
  if (inv.cfdi_serie && inv.cfdi_folio) {
    add([inv.cfdi_serie, inv.cfdi_folio].filter(Boolean).join('-'))
  }
  return [...keys]
}

export function folioMatchesInvoice(
  inv: { invoice_number: string; cfdi_folio?: string | null; cfdi_serie?: string | null },
  doctoFolio: string | null | undefined,
  doctoSerie?: string | null,
): boolean {
  const target = normalizeFolioForMatch(doctoFolio)
  if (!target) return false
  const keys = invoiceFolioKeys(inv)
  if (keys.includes(target)) return true
  if (doctoSerie && doctoFolio) {
    const combined = normalizeFolioForMatch([doctoSerie, doctoFolio].filter(Boolean).join('-'))
    if (combined && keys.includes(combined)) return true
  }
  return false
}

export function normalizePayable(inv: InvoiceMatchRow) {
  const p = inv.payable
  if (!p) return null
  return Array.isArray(p) ? p[0] ?? null : p
}

export function invoiceBalance(inv: InvoiceMatchRow): {
  paid_to_date: number
  credit_applied_total: number
  balance: number
} {
  const payable = normalizePayable(inv)
  const payments = payable?.payments ?? []
  const paid_to_date = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const cnAllocs = inv.cn_allocations ?? []
  const credit_applied_total = cnAllocs.reduce((s, a) => s + Number(a.allocated_total ?? 0), 0)
  const balance = Number(inv.total) - paid_to_date - credit_applied_total
  return { paid_to_date, credit_applied_total, balance }
}

const INVOICE_SELECT = `
  id, invoice_number, status, total, plant_id, supplier_group_id,
  cfdi_uuid, cfdi_folio, cfdi_serie, cfdi_emisor_rfc,
  payable:payables!invoice_id(
    id,
    payments:payments!payable_id(amount)
  ),
  cn_allocations:credit_note_invoice_allocations(allocated_total)
`

export async function loadInvoicesByCfdiUuids(
  supabase: SupabaseClient,
  uuids: string[],
): Promise<Map<string, InvoiceMatchRow>> {
  const normalized = [...new Set(uuids.map((u) => normalizeCfdiUuid(u)).filter(Boolean) as string[])]
  if (normalized.length === 0) return new Map()

  const { data } = await supabase
    .from('supplier_invoices')
    .select(INVOICE_SELECT)
    .not('cfdi_uuid', 'is', null)

  const map = new Map<string, InvoiceMatchRow>()
  for (const inv of data ?? []) {
    const key = normalizeCfdiUuid((inv as InvoiceMatchRow).cfdi_uuid)
    if (key && normalized.some((u) => cfdiUuidsEqual(u, key))) {
      map.set(key, inv as InvoiceMatchRow)
    }
  }
  return map
}

export async function loadInvoicesByEmisorRfc(
  supabase: SupabaseClient,
  emisorRfc: string,
): Promise<InvoiceMatchRow[]> {
  const rfc = emisorRfc.trim().toUpperCase()
  const { data: byCfdi } = await supabase
    .from('supplier_invoices')
    .select(INVOICE_SELECT)
    .eq('cfdi_emisor_rfc', rfc)
    .in('status', ['open', 'partially_paid'])

  const { data: group } = await supabase
    .from('supplier_groups')
    .select('id')
    .eq('rfc', rfc)
    .eq('is_active', true)
    .maybeSingle()

  if (!group?.id) return (byCfdi ?? []) as InvoiceMatchRow[]

  const { data: byGroup } = await supabase
    .from('supplier_invoices')
    .select(INVOICE_SELECT)
    .eq('supplier_group_id', group.id)
    .in('status', ['open', 'partially_paid'])

  const seen = new Set<string>()
  const merged: InvoiceMatchRow[] = []
  for (const inv of [...(byCfdi ?? []), ...(byGroup ?? [])]) {
    const row = inv as InvoiceMatchRow
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return merged
}

export async function resolveRepInvoiceMatch(
  supabase: SupabaseClient,
  params: {
    docto_uuid: string
    docto_folio: string | null
    docto_serie: string | null
    emisor_rfc: string
  },
  invByUuid: Map<string, InvoiceMatchRow>,
): Promise<RepMatchResult> {
  const doctoNorm = normalizeCfdiUuid(params.docto_uuid)
  if (!doctoNorm) return { kind: 'not_found' }

  const byUuid = invByUuid.get(doctoNorm)
  if (byUuid) {
    return {
      kind: 'found',
      invoice: byUuid,
      method: 'uuid',
      backfill_cfdi_uuid: false,
    }
  }

  const { data: satRow } = await supabase
    .from('sat_cfdi_recibidos')
    .select('uuid, folio, serie, emisor_rfc, tipo_comprobante')
    .eq('uuid', doctoNorm)
    .maybeSingle()

  if (satRow?.tipo_comprobante === 'I') {
    const satFolio = satRow.folio ?? params.docto_folio
    const satSerie = satRow.serie ?? params.docto_serie
    const emisor = String(satRow.emisor_rfc ?? params.emisor_rfc).toUpperCase()
    const candidates = (await loadInvoicesByEmisorRfc(supabase, emisor)).filter((inv) =>
      folioMatchesInvoice(inv, satFolio, satSerie),
    )
    if (candidates.length === 1) {
      return {
        kind: 'found',
        invoice: candidates[0],
        method: 'sat_bridge',
        backfill_cfdi_uuid: true,
      }
    }
    if (candidates.length > 1) {
      return {
        kind: 'ambiguous',
        candidates: candidates.map((c) => ({
          id: c.id,
          invoice_number: c.invoice_number,
          cfdi_uuid: c.cfdi_uuid,
          balance: invoiceBalance(c).balance,
        })),
      }
    }
    return { kind: 'sat_without_invoice' }
  }

  const folioCandidates = (await loadInvoicesByEmisorRfc(supabase, params.emisor_rfc)).filter((inv) =>
    folioMatchesInvoice(inv, params.docto_folio, params.docto_serie),
  )

  if (folioCandidates.length === 1) {
    return {
      kind: 'found',
      invoice: folioCandidates[0],
      method: 'folio',
      backfill_cfdi_uuid: true,
    }
  }
  if (folioCandidates.length > 1) {
    return {
      kind: 'ambiguous',
      candidates: folioCandidates.map((c) => ({
        id: c.id,
        invoice_number: c.invoice_number,
        cfdi_uuid: c.cfdi_uuid,
        balance: invoiceBalance(c).balance,
      })),
    }
  }

  return { kind: 'not_found' }
}

export async function backfillInvoiceCfdiUuid(
  supabase: SupabaseClient,
  invoiceId: string,
  doctoUuid: string,
  emisorRfc: string,
  doctoFolio: string | null,
  doctoSerie: string | null,
): Promise<void> {
  const uuid = normalizeCfdiUuid(doctoUuid)
  if (!uuid) return

  const { data: existing } = await supabase
    .from('supplier_invoices')
    .select('cfdi_uuid, cfdi_emisor_rfc, cfdi_folio, cfdi_serie')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!existing) return

  const patch: Record<string, string | null> = {}
  if (!existing.cfdi_uuid) patch.cfdi_uuid = uuid
  if (!existing.cfdi_emisor_rfc) patch.cfdi_emisor_rfc = emisorRfc.toUpperCase()
  if (!existing.cfdi_folio && doctoFolio) patch.cfdi_folio = doctoFolio
  if (!existing.cfdi_serie && doctoSerie) patch.cfdi_serie = doctoSerie

  if (Object.keys(patch).length > 0) {
    await supabase.from('supplier_invoices').update(patch).eq('id', invoiceId)
  }
}

export async function ensurePayableForInvoice(
  supabase: SupabaseClient,
  invoice: InvoiceMatchRow,
  userId: string,
): Promise<{ payableId: string | null; error?: string }> {
  const existing = normalizePayable(invoice)
  if (existing?.id) return { payableId: existing.id }

  const { data: invFull } = await supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_number, invoice_date, due_date, vat_rate, subtotal, tax, total, plant_id,
      items:supplier_invoice_items(entry_id, cost_category)
    `)
    .eq('id', invoice.id)
    .single()

  if (!invFull) return { payableId: null, error: 'Factura no encontrada' }

  let supplierId: string | null = null
  const items = (invFull.items ?? []) as Array<{ entry_id: string | null; cost_category: string }>
  const firstEntryId = items.find((it) => it.entry_id)?.entry_id
  if (firstEntryId) {
    const { data: entryRow } = await supabase
      .from('material_entries')
      .select('supplier_id, fleet_supplier_id')
      .eq('id', firstEntryId)
      .maybeSingle()
    const allFleet = items.length > 0 && items.every((it) => it.cost_category === 'fleet')
    supplierId = allFleet
      ? (entryRow?.fleet_supplier_id ?? entryRow?.supplier_id ?? null)
      : (entryRow?.supplier_id ?? null)
  }

  if (!supplierId) {
    const { data: sgSuppliers } = await supabase
      .from('suppliers')
      .select('id')
      .eq('group_id', invoice.supplier_group_id)
      .eq('is_active', true)
      .limit(1)
    supplierId = sgSuppliers?.[0]?.id ?? null
  }

  if (!supplierId) {
    return { payableId: null, error: 'No hay proveedor activo para crear CxP' }
  }

  const { data: payableRows, error: payErr } = await supabase
    .from('payables')
    .upsert(
      {
        supplier_id: supplierId,
        plant_id: invFull.plant_id,
        invoice_id: invoice.id,
        invoice_number: invFull.invoice_number,
        invoice_date: invFull.invoice_date,
        due_date: invFull.due_date,
        vat_rate: Number(invFull.vat_rate),
        subtotal: Number(invFull.subtotal),
        tax: Number(invFull.tax),
        total: Number(invFull.total),
        status: 'open',
        created_by: userId,
      },
      { onConflict: 'supplier_id,plant_id,invoice_number' },
    )
    .select('id')

  const payable = Array.isArray(payableRows) ? payableRows[0] : payableRows
  if (payErr || !payable?.id) {
    return { payableId: null, error: payErr?.message ?? 'Error al crear CxP' }
  }

  return { payableId: payable.id as string }
}
