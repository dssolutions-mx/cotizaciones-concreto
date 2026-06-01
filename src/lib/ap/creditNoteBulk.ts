import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedCfdi } from '@/types/finance'
import { cfdiUuidsEqual } from '@/lib/sat/normalizeCfdiUuid'

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
  emisor_rfc: string
  emisor_nombre: string | null
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

  for (const { file_name, cfdi } of items) {
    const folio =
      [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || cfdi.uuid.slice(0, 8)
    const base: CreditNoteBulkPreviewRow = {
      cfdi_uuid: cfdi.uuid,
      file_name,
      credit_number: folio,
      credit_date: cfdi.fecha_emision.slice(0, 10),
      emisor_rfc: cfdi.emisor_rfc,
      emisor_nombre: cfdi.emisor_nombre,
      amount: cfdi.subtotal > 0 ? cfdi.subtotal : cfdi.total,
      vat_rate: cfdi.vat_rate > 0 ? cfdi.vat_rate : 0.16,
      reason: 'price_adjustment',
      status: 'ready',
      supplier_group_id: null,
      supplier_group_name: null,
      plant_id: plantFilter,
      invoice_allocations: [],
    }

    if (companyRfc && cfdi.receptor_rfc.toUpperCase() !== companyRfc) {
      rows.push({
        ...base,
        status: 'receptor_mismatch',
        message: `Receptor ${cfdi.receptor_rfc} no coincide con empresa`,
      })
      continue
    }

    const { data: dup } = await supabase
      .from('invoice_credit_notes')
      .select('id, credit_number')
      .eq('cfdi_uuid', cfdi.uuid)
      .maybeSingle()
    if (dup) {
      rows.push({
        ...base,
        status: 'duplicate',
        message: `Ya registrada como NC ${dup.credit_number ?? dup.id}`,
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
      rows.push({
        ...base,
        status: 'missing_supplier_group',
        message: `Sin grupo de proveedor para RFC ${cfdi.emisor_rfc}`,
      })
      continue
    }

    base.supplier_group_id = matchingGroup.id
    base.supplier_group_name = matchingGroup.name

    const relUuids = cfdi.cfdi_relacionados.map((r) => r.uuid.toLowerCase())
    if (relUuids.length === 0) {
      rows.push({
        ...base,
        status: 'no_related_invoices',
        message: 'Sin CfdiRelacionados en el XML',
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
      rows.push({
        ...base,
        status: 'no_related_invoices',
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
      rows.push({
        ...base,
        status: 'allocation_mismatch',
        invoice_allocations: allocations,
        message: `No se pudo repartir ${base.amount} entre facturas (suma ${allocSum})`,
      })
      continue
    }

    base.plant_id = (matched[0] as { plant_id: string }).plant_id ?? plantFilter
    base.invoice_allocations = allocations
    rows.push(base)
  }

  return rows
}
