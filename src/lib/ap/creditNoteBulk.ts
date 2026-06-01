import type { SupabaseClient } from '@supabase/supabase-js'
import type { CfdiMatchDiagnostics, ParsedCfdi } from '@/types/finance'
import { cfdiUuidsEqual } from '@/lib/sat/normalizeCfdiUuid'
import { markUploadDuplicates } from '@/lib/ap/bulkCfdiValidation'
import { lookupCreditNoteDuplicates } from '@/lib/ap/cfdiImportReview'
import {
  buildNcMatchDiagnostics,
  loadOpenInvoicesForSupplierGroup,
  markRelatedUuidMatches,
  relatedUuidsFromCfdi,
} from '@/lib/ap/cfdiMatchDiagnostics'

export type CreditNoteBulkPreviewStatus =
  | 'ready'
  | 'duplicate'
  | 'no_related_invoices'
  | 'allocation_mismatch'
  | 'receptor_mismatch'
  | 'missing_supplier_group'

export type CreditNoteBulkPreviewRow = {
  cfdi_uuid: string
  file_name: string
  credit_number: string
  credit_date: string
  cfdi_serie: string | null
  cfdi_folio: string | null
  emisor_rfc: string
  emisor_nombre: string | null
  receptor_rfc: string
  amount: number
  vat_rate: number
  reason: string
  status: CreditNoteBulkPreviewStatus
  supplier_group_id: string | null
  supplier_group_name: string | null
  plant_id: string | null
  invoice_allocations: Array<{
    invoice_id: string
    invoice_number: string
    allocated_subtotal: number
  }>
  match_diagnostics?: CfdiMatchDiagnostics
  message?: string
}

function distributeProportional(
  invoices: Array<{
    id: string
    invoice_number: string
    available: number
  }>,
  total: number,
): Array<{ invoice_id: string; invoice_number: string; allocated_subtotal: number }> {
  if (invoices.length === 0) return []
  const sumAvailable = invoices.reduce((s, inv) => s + inv.available, 0)
  const next: Array<{ invoice_id: string; invoice_number: string; allocated_subtotal: number }> = []
  let remaining = total
  invoices.forEach((inv, idx) => {
    const isLast = idx === invoices.length - 1
    const share = isLast
      ? Math.round(remaining * 100) / 100
      : Math.round((inv.available / (sumAvailable || 1)) * total * 100) / 100
    if (!isLast) remaining -= share
    next.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      allocated_subtotal: share,
    })
  })
  return next
}

export type BuildCreditNoteBulkOptions = {
  companyRfc?: string | null
  plantId?: string | null
}

export async function buildCreditNoteBulkPreview(
  supabase: SupabaseClient,
  items: Array<{ file_name: string; cfdi: ParsedCfdi }>,
  options: BuildCreditNoteBulkOptions = {},
): Promise<CreditNoteBulkPreviewRow[]> {
  const companyRfc = (options.companyRfc ?? '').trim().toUpperCase()
  const plantFilter = options.plantId ?? null
  const rows: CreditNoteBulkPreviewRow[] = []
  const openInvoicesCache = new Map<string, Awaited<ReturnType<typeof loadOpenInvoicesForSupplierGroup>>>()

  const withUploadFlags = markUploadDuplicates(
    items.map(i => ({ id: i.cfdi.uuid, cfdi: i.cfdi, file_name: i.file_name })),
  )
  const uploadFlagByUuid = new Map(withUploadFlags.map(i => [i.id, i]))

  async function openForGroup(groupId: string) {
    if (!openInvoicesCache.has(groupId)) {
      openInvoicesCache.set(
        groupId,
        await loadOpenInvoicesForSupplierGroup(supabase, groupId, plantFilter),
      )
    }
    return openInvoicesCache.get(groupId)!
  }

  for (const { file_name, cfdi } of items) {
    const uploadFlags = uploadFlagByUuid.get(cfdi.uuid)
    const folio =
      [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || cfdi.uuid.slice(0, 8)
    const relatedRaw = relatedUuidsFromCfdi(cfdi)

    const base: CreditNoteBulkPreviewRow = {
      cfdi_uuid: cfdi.uuid,
      file_name,
      credit_number: folio,
      credit_date: cfdi.fecha_emision.slice(0, 10),
      cfdi_serie: cfdi.serie,
      cfdi_folio: cfdi.folio,
      emisor_rfc: cfdi.emisor_rfc,
      emisor_nombre: cfdi.emisor_nombre,
      receptor_rfc: cfdi.receptor_rfc,
      amount: cfdi.subtotal > 0 ? cfdi.subtotal : cfdi.total,
      vat_rate: cfdi.vat_rate > 0 ? cfdi.vat_rate : 0.16,
      reason: 'price_adjustment',
      status: 'ready',
      supplier_group_id: null,
      supplier_group_name: null,
      plant_id: plantFilter,
      invoice_allocations: [],
    }

    const pushWithDiagnostics = (
      row: CreditNoteBulkPreviewRow,
      status: CreditNoteBulkPreviewStatus,
      extra: {
        supplierGroupName?: string | null
        openInvoices?: Awaited<ReturnType<typeof loadOpenInvoicesForSupplierGroup>>
        related?: ReturnType<typeof markRelatedUuidMatches>
        matchedCount?: number
        message?: string
      } = {},
    ) => {
      const open = extra.openInvoices ?? []
      const related = markRelatedUuidMatches(extra.related ?? relatedRaw, open)
      rows.push({
        ...row,
        status,
        message: extra.message ?? row.message,
        match_diagnostics: buildNcMatchDiagnostics({
          cfdi,
          status,
          supplierGroupName: extra.supplierGroupName ?? row.supplier_group_name,
          related,
          openInvoices: open,
          matchedInvoiceCount: extra.matchedCount,
        }),
      })
    }

    if (companyRfc && cfdi.receptor_rfc.toUpperCase() !== companyRfc) {
      pushWithDiagnostics(base, 'receptor_mismatch', {
        message: `Receptor ${cfdi.receptor_rfc} no coincide con empresa (${companyRfc})`,
      })
      continue
    }

    if (uploadFlags?.duplicate_cfdi_in_upload || uploadFlags?.duplicate_folio_in_upload) {
      pushWithDiagnostics(base, 'duplicate', {
        message: uploadFlags.duplicate_cfdi_in_upload
          ? 'CFDI repetido en el archivo — omitido'
          : 'Folio repetido en el archivo — omitido',
      })
      continue
    }

    const { data: matchingGroup } = await supabase
      .from('supplier_groups')
      .select('id, name, rfc')
      .eq('rfc', cfdi.emisor_rfc)
      .eq('is_active', true)
      .maybeSingle()

    if (!matchingGroup) {
      pushWithDiagnostics(base, 'missing_supplier_group', {
        message: `Sin grupo de proveedor para RFC ${cfdi.emisor_rfc}`,
      })
      continue
    }

    base.supplier_group_id = matchingGroup.id
    base.supplier_group_name = matchingGroup.name

    const ncDups = await lookupCreditNoteDuplicates(supabase, {
      cfdiUuid: cfdi.uuid,
      supplierGroupId: matchingGroup.id,
      plantId: plantFilter,
      creditNumber: folio,
    })
    if (ncDups.by_uuid) {
      pushWithDiagnostics(base, 'duplicate', {
        supplierGroupName: matchingGroup.name,
        message: `Ya registrada en sistema (${ncDups.by_uuid.document_number})`,
      })
      continue
    }
    if (ncDups.by_folio) {
      pushWithDiagnostics(base, 'duplicate', {
        supplierGroupName: matchingGroup.name,
        message: `Folio NC ya registrado (${ncDups.by_folio.document_number})`,
      })
      continue
    }

    const openInvoices = await openForGroup(matchingGroup.id)

    const relUuids = cfdi.cfdi_relacionados.map((r) => r.uuid.toLowerCase())
    if (relUuids.length === 0) {
      pushWithDiagnostics(base, 'no_related_invoices', {
        supplierGroupName: matchingGroup.name,
        openInvoices,
        message: 'Sin CfdiRelacionados en el XML — agregue la relación al CFDI o vincule manualmente',
      })
      continue
    }

    let invQuery = supabase
      .from('supplier_invoices')
      .select(`
        id, invoice_number, subtotal, discount_amount, status, plant_id, cfdi_uuid,
        cn_allocations:credit_note_invoice_allocations(allocated_subtotal)
      `)
      .eq('supplier_group_id', matchingGroup.id)
      .in('status', ['open', 'partially_paid'])

    if (plantFilter) invQuery = invQuery.eq('plant_id', plantFilter)

    const { data: invoices } = await invQuery
    const matched = (invoices ?? []).filter((inv) => {
      const uuid = (inv.cfdi_uuid ?? '').toLowerCase()
      return relUuids.some((u) => cfdiUuidsEqual(u, uuid))
    })

    if (matched.length === 0) {
      pushWithDiagnostics(base, 'no_related_invoices', {
        supplierGroupName: matchingGroup.name,
        openInvoices,
        message: `Ninguna factura abierta con UUID relacionado (${relUuids.length} en XML)`,
      })
      continue
    }

    const withAvailable = matched.map((inv) => {
      const taxable = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
      const credited = (inv.cn_allocations ?? []).reduce(
        (s: number, a: { allocated_subtotal: number }) => s + Number(a.allocated_subtotal ?? 0),
        0,
      )
      return {
        id: inv.id as string,
        invoice_number: inv.invoice_number as string,
        available: Math.max(0, taxable - credited),
      }
    })

    const allocations = distributeProportional(withAvailable, base.amount)
    const allocSum = allocations.reduce((s, a) => s + a.allocated_subtotal, 0)
    if (Math.abs(allocSum - base.amount) > 0.01) {
      pushWithDiagnostics(
        { ...base, invoice_allocations: allocations },
        'allocation_mismatch',
        {
          supplierGroupName: matchingGroup.name,
          openInvoices,
          matchedCount: matched.length,
          message: `No se pudo repartir ${base.amount} entre facturas (suma ${allocSum})`,
        },
      )
      continue
    }

    base.plant_id = (matched[0] as { plant_id: string }).plant_id ?? plantFilter
    base.invoice_allocations = allocations
    const related = markRelatedUuidMatches(relatedRaw, openInvoices)
    rows.push({
      ...base,
      match_diagnostics: buildNcMatchDiagnostics({
        cfdi,
        status: 'ready',
        supplierGroupName: matchingGroup.name,
        related,
        openInvoices,
        matchedInvoiceCount: matched.length,
      }),
    })
  }

  return rows
}
