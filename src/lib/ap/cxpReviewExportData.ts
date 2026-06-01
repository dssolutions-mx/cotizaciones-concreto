import type { SupabaseClient } from '@supabase/supabase-js'
import { MANUAL_REASON_LABELS } from '@/lib/ap/invoiceTotals'
import {
  cfdiEstadoSatLabelEs,
  cfdiMetodoPagoLabelEs,
  costCategoryLabelEs,
  creditNoteReasonLabelEs,
  creditNoteStatusLabelEs,
  invoiceLineLinkageLabelEs,
  invoiceSourceLabelEs,
  invoiceStatusLabelEs,
  orphanEntryKindLabelEs,
  paymentMethodLabelEs,
  paymentSourceLabelEs,
  pricingStatusLabelEs,
} from '@/lib/ap/cxpReviewLabels'

const PAGE = 500

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function fetchAllPaged<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ rows: T[]; total: number }>,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  let total = 0
  while (true) {
    const { rows, total: t } = await fetchPage(offset, PAGE)
    total = t
    all.push(...rows)
    if (rows.length === 0 || all.length >= total) break
    offset += rows.length
  }
  return all
}

const ORPHAN_SELECT = `
  id, entry_number, entry_date, plant_id,
  supplier_id, fleet_supplier_id, material_id, pricing_status,
  received_qty_entered, received_qty_kg, received_uom,
  unit_price, total_cost, fleet_cost, landed_unit_price,
  supplier_invoice, fleet_invoice,
  ap_due_date_material, ap_due_date_fleet
`

const INVOICE_SELECT = `
  id, supplier_group_id, plant_id,
  invoice_number, is_internal, invoice_date, due_date,
  currency, vat_rate, subtotal, discount_amount, tax, total,
  retention_isr_amount, retention_iva_amount,
  status, source, notes,
  cfdi_uuid, cfdi_folio, cfdi_serie, cfdi_metodo_pago, cfdi_estado_sat,
  created_at,
  supplier_group:supplier_groups!supplier_group_id(id, name, rfc),
  items:supplier_invoice_items(
    id, entry_id, line_source, manual_reason, cost_category, description, qty, unit_price, amount,
    entry:material_entries!entry_id(
      id, entry_number, entry_date, received_qty_entered, received_uom,
      unit_price, supplier_invoice, material_id,
      material:materials(id, material_name)
    )
  ),
  payable:payables!invoice_id(
    id, status, subtotal, tax, total,
    payments:payments!payable_id(
      id, payment_date, amount, method, reference, source,
      cfdi_rep_uuid, cfdi_docto_uuid, cfdi_num_parcialidad
    )
  ),
  cn_allocations:credit_note_invoice_allocations(
    id, credit_note_id, allocated_subtotal, allocated_tax, allocated_total
  )
`

const CREDIT_NOTE_SELECT = `
  id, supplier_group_id, plant_id,
  credit_number, credit_date, reason,
  amount, tax_amount, total, vat_rate, status,
  notes, cfdi_uuid, cfdi_estado_sat, cfdi_emisor_rfc, cfdi_relacionado_uuid,
  created_at,
  supplier_group:supplier_groups!supplier_group_id(id, name, rfc),
  invoice_allocations:credit_note_invoice_allocations(
    id, invoice_id, allocated_subtotal, allocated_tax, allocated_total,
    invoice:supplier_invoices!invoice_id(
      id, invoice_number, subtotal, total, status
    )
  )
`

export type CxpReviewOrphanRow = {
  kind: 'material' | 'fleet'
  kind_label: string
  id: string
  entry_number: string
  entry_date: string
  plant_id: string
  plant_name: string
  supplier_group_id: string | null
  supplier_group_name: string
  supplier_name: string
  material_name: string
  received_qty: string
  unit_price: number | null
  material_cost: number
  fleet_cost: number
  total_exposure: number
  supplier_remision: string
  fleet_guia: string
  ap_due_material: string | null
  ap_due_fleet: string | null
  pricing_status: string
}

export type CxpReviewInvoiceRow = {
  id: string
  supplier_group_id: string
  supplier_group_name: string
  supplier_rfc: string | null
  plant_id: string
  plant_name: string
  invoice_number: string
  invoice_date: string
  due_date: string
  source: string
  source_label: string
  status: string
  status_label: string
  subtotal: number
  discount_amount: number
  tax: number
  total: number
  paid_to_date: number
  credit_applied_total: number
  balance: number
  cfdi_uuid: string | null
  cfdi_metodo_pago: string
  cfdi_estado_sat: string
  line_count: number
  lines_with_entry: number
  lines_without_entry: number
  payment_count: number
  payments_with_rep: number
}

export type CxpReviewInvoiceLineRow = {
  invoice_id: string
  invoice_number: string
  supplier_group_name: string
  plant_name: string
  line_id: string
  cost_category: string
  cost_category_label: string
  linkage: string
  entry_number: string | null
  entry_date: string | null
  material_name: string | null
  manual_reason: string | null
  description: string | null
  qty: number | null
  unit_price: number | null
  amount: number
}

export type CxpReviewPaymentRow = {
  payment_id: string
  payment_date: string
  amount: number
  method: string | null
  reference: string | null
  source: string
  method_label: string
  has_complemento: boolean
  complemento_label: string
  cfdi_rep_uuid: string | null
  cfdi_docto_uuid: string | null
  cfdi_num_parcialidad: number | null
  invoice_id: string
  invoice_number: string
  supplier_group_name: string
  plant_name: string
  invoice_status: string
  invoice_status_label: string
}

export type CxpReviewCreditNoteRow = {
  id: string
  supplier_group_id: string
  supplier_group_name: string
  plant_name: string
  credit_number: string
  credit_date: string
  reason: string
  amount: number
  tax_amount: number
  total: number
  allocated_total: number
  unapplied_total: number
  status: string
  status_label: string
  cfdi_uuid: string | null
  cfdi_estado_sat: string
  invoices_touched: string
}

export type CxpReviewCreditNoteAllocRow = {
  credit_note_id: string
  credit_number: string
  supplier_group_name: string
  invoice_id: string
  invoice_number: string
  invoice_status: string
  invoice_status_label: string
  allocated_subtotal: number
  allocated_tax: number
  allocated_total: number
}

export type CxpReviewProviderSummaryRow = {
  supplier_group_id: string
  supplier_group_name: string
  supplier_rfc: string | null
  orphan_material_count: number
  orphan_fleet_count: number
  orphan_exposure: number
  invoice_count: number
  invoices_open: number
  invoices_paid: number
  invoice_total: number
  paid_to_date: number
  credit_applied: number
  balance_open: number
  credit_note_count: number
  credit_unapplied: number
  payments_rep_count: number
  alert_orphan_and_open: string
}

export type CxpReviewExportData = {
  plantScopeLabel: string
  plantId: string | null
  orphanRows: CxpReviewOrphanRow[]
  invoices: CxpReviewInvoiceRow[]
  invoiceLines: CxpReviewInvoiceLineRow[]
  payments: CxpReviewPaymentRow[]
  creditNotes: CxpReviewCreditNoteRow[]
  creditNoteAllocations: CxpReviewCreditNoteAllocRow[]
  providerSummaries: CxpReviewProviderSummaryRow[]
}

export async function loadCxpReviewExportData(
  supabase: SupabaseClient,
  options: { plantId?: string | null } = {},
): Promise<CxpReviewExportData> {
  const plantId = options.plantId?.trim() || null

  const { data: plants } = await supabase.from('plants').select('id, name, code')
  const plantById = new Map(
    (plants ?? []).map((p: { id: string; name: string; code: string | null }) => [
      p.id,
      p.name || p.code || p.id,
    ]),
  )
  const plantScopeLabel = plantId
    ? (plantById.get(plantId) ?? plantId)
    : 'Todas las plantas'

  const enrichOrphans = async (
    source: 'ap_orphan_material_entries' | 'ap_orphan_fleet_entries',
    kind: 'material' | 'fleet',
  ) => {
    const raw = await fetchAllPaged(async (offset, limit) => {
      let q = supabase
        .from(source)
        .select(ORPHAN_SELECT, { count: 'exact' })
        .order('entry_date', { ascending: false })
        .order('entry_number', { ascending: false })
        .range(offset, offset + limit - 1)
      if (plantId) q = q.eq('plant_id', plantId)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    })

    const supplierIds = [
      ...new Set(
        raw.flatMap((e) => [e.supplier_id, e.fleet_supplier_id].filter(Boolean) as string[]),
      ),
    ]
    const materialIds = [...new Set(raw.map((e) => e.material_id).filter(Boolean) as string[])]

    const suppliers: Array<{
      id: string
      name: string
      group_id: string | null
      supplier_group?: { id: string; name: string; rfc: string | null } | null
    }> = []
    for (const batch of chunk(supplierIds, 200)) {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, group_id, supplier_group:supplier_groups!group_id(id, name, rfc)')
        .in('id', batch)
      if (error) throw error
      suppliers.push(...(data ?? []))
    }
    const materials: Array<{ id: string; material_name: string }> = []
    for (const batch of chunk(materialIds, 200)) {
      const { data, error } = await supabase
        .from('materials')
        .select('id, material_name')
        .in('id', batch)
      if (error) throw error
      materials.push(...(data ?? []))
    }
    const supplierById = new Map(suppliers.map((s) => [s.id, s]))
    const materialById = new Map(materials.map((m) => [m.id, m]))

    return raw.map((entry): CxpReviewOrphanRow => {
      const primarySupplier =
        kind === 'fleet' && entry.fleet_supplier_id
          ? supplierById.get(entry.fleet_supplier_id)
          : entry.supplier_id
            ? supplierById.get(entry.supplier_id)
            : undefined
      const sg = primarySupplier?.supplier_group
      const materialCost = Number(entry.total_cost ?? 0)
      const fleetCost = Number(entry.fleet_cost ?? 0)
      const qty =
        entry.received_qty_entered != null
          ? `${entry.received_qty_entered} ${entry.received_uom ?? ''}`.trim()
          : entry.received_qty_kg != null
            ? `${entry.received_qty_kg} kilogramos`
            : '—'

      return {
        kind,
        kind_label: orphanEntryKindLabelEs(kind),
        id: entry.id,
        entry_number: entry.entry_number,
        entry_date: entry.entry_date,
        plant_id: entry.plant_id,
        plant_name: plantById.get(entry.plant_id) ?? entry.plant_id,
        supplier_group_id: sg?.id ?? primarySupplier?.group_id ?? null,
        supplier_group_name: sg?.name ?? primarySupplier?.name ?? 'Sin proveedor',
        supplier_name: primarySupplier?.name ?? '—',
        material_name: entry.material_id
          ? (materialById.get(entry.material_id)?.material_name ?? '—')
          : '—',
        received_qty: qty,
        unit_price: entry.unit_price != null ? Number(entry.unit_price) : null,
        material_cost: materialCost,
        fleet_cost: fleetCost,
        total_exposure: kind === 'fleet' ? fleetCost : materialCost + fleetCost,
        supplier_remision: entry.supplier_invoice?.trim() ?? '',
        fleet_guia: entry.fleet_invoice?.trim() ?? '',
        ap_due_material: entry.ap_due_date_material,
        ap_due_fleet: entry.ap_due_date_fleet,
        pricing_status: pricingStatusLabelEs(entry.pricing_status),
      }
    })
  }

  const [orphanMaterial, orphanFleet] = await Promise.all([
    enrichOrphans('ap_orphan_material_entries', 'material'),
    enrichOrphans('ap_orphan_fleet_entries', 'fleet'),
  ])
  const orphanRows = [...orphanMaterial, ...orphanFleet]

  const rawInvoices = await fetchAllPaged(async (offset, limit) => {
    let q = supabase
      .from('supplier_invoices')
      .select(INVOICE_SELECT, { count: 'exact' })
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1)
    if (plantId) q = q.eq('plant_id', plantId)
    const { data, error, count } = await q
    if (error) throw error
    return { rows: data ?? [], total: count ?? 0 }
  })

  const invoices: CxpReviewInvoiceRow[] = []
  const invoiceLines: CxpReviewInvoiceLineRow[] = []
  const payments: CxpReviewPaymentRow[] = []

  for (const inv of rawInvoices) {
    const sg = Array.isArray(inv.supplier_group) ? inv.supplier_group[0] : inv.supplier_group
    const items: any[] = inv.items ?? []
    const payable = Array.isArray(inv.payable) ? inv.payable[0] : inv.payable
    const payList: any[] = payable?.payments ?? []
    const cnAllocs: any[] = inv.cn_allocations ?? []
    const paid_to_date = payList.reduce((s, p) => s + Number(p.amount ?? 0), 0)
    const credit_applied_total = cnAllocs.reduce(
      (s, a) => s + Number(a.allocated_total ?? 0),
      0,
    )
    const lines_with_entry = items.filter((it) => it.entry_id).length
    const payments_with_rep = payList.filter((p) => p.cfdi_rep_uuid).length

    invoices.push({
      id: inv.id,
      supplier_group_id: inv.supplier_group_id,
      supplier_group_name: sg?.name ?? inv.supplier_group_id,
      supplier_rfc: sg?.rfc ?? null,
      plant_id: inv.plant_id,
      plant_name: plantById.get(inv.plant_id) ?? inv.plant_id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      source: inv.source,
      source_label: invoiceSourceLabelEs(inv.source, Boolean(inv.is_internal)),
      status: inv.status,
      status_label: invoiceStatusLabelEs(inv.status),
      subtotal: Number(inv.subtotal),
      discount_amount: Number(inv.discount_amount ?? 0),
      tax: Number(inv.tax),
      total: Number(inv.total),
      paid_to_date,
      credit_applied_total,
      balance: Number(inv.total) - paid_to_date - credit_applied_total,
      cfdi_uuid: inv.cfdi_uuid,
      cfdi_metodo_pago: cfdiMetodoPagoLabelEs(inv.cfdi_metodo_pago),
      cfdi_estado_sat: cfdiEstadoSatLabelEs(inv.cfdi_estado_sat),
      line_count: items.length,
      lines_with_entry,
      lines_without_entry: items.length - lines_with_entry,
      payment_count: payList.length,
      payments_with_rep,
    })

    for (const it of items) {
      const entry = Array.isArray(it.entry) ? it.entry[0] : it.entry
      const mat = entry?.material
      invoiceLines.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        supplier_group_name: sg?.name ?? '',
        plant_name: plantById.get(inv.plant_id) ?? inv.plant_id,
        line_id: it.id,
        cost_category: it.cost_category,
        cost_category_label: costCategoryLabelEs(it.cost_category),
        linkage: invoiceLineLinkageLabelEs(it.entry_id, it.line_source, it.manual_reason),
        entry_number: entry?.entry_number ?? null,
        entry_date: entry?.entry_date ?? null,
        material_name: mat?.material_name ?? null,
        manual_reason: it.manual_reason
          ? (MANUAL_REASON_LABELS[it.manual_reason] ?? it.manual_reason)
          : null,
        description: it.description,
        qty: it.qty != null ? Number(it.qty) : null,
        unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        amount: Number(it.amount),
      })
    }

    for (const p of payList) {
      payments.push({
        payment_id: p.id,
        payment_date: p.payment_date,
        amount: Number(p.amount),
        method: p.method,
        method_label: paymentMethodLabelEs(p.method),
        reference: p.reference,
        source: paymentSourceLabelEs(p.source),
        has_complemento: Boolean(p.cfdi_rep_uuid),
        complemento_label: p.cfdi_rep_uuid ? 'Sí' : 'No',
        cfdi_rep_uuid: p.cfdi_rep_uuid,
        cfdi_docto_uuid: p.cfdi_docto_uuid,
        cfdi_num_parcialidad: p.cfdi_num_parcialidad,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        supplier_group_name: sg?.name ?? '',
        plant_name: plantById.get(inv.plant_id) ?? inv.plant_id,
        invoice_status: inv.status,
        invoice_status_label: invoiceStatusLabelEs(inv.status),
      })
    }
  }

  const rawCreditNotes = await fetchAllPaged(async (offset, limit) => {
    let q = supabase
      .from('invoice_credit_notes')
      .select(CREDIT_NOTE_SELECT, { count: 'exact' })
      .order('credit_date', { ascending: false })
      .range(offset, offset + limit - 1)
    if (plantId) q = q.eq('plant_id', plantId)
    const { data, error, count } = await q
    if (error) throw error
    return { rows: data ?? [], total: count ?? 0 }
  })

  const creditNotes: CxpReviewCreditNoteRow[] = []
  const creditNoteAllocations: CxpReviewCreditNoteAllocRow[] = []

  for (const cn of rawCreditNotes) {
    const sg = Array.isArray(cn.supplier_group) ? cn.supplier_group[0] : cn.supplier_group
    const allocs: any[] = cn.invoice_allocations ?? []
    const allocated_total = allocs.reduce(
      (s, a) => s + Number(a.allocated_total ?? 0),
      0,
    )
    const credit_number = cn.credit_number ?? cn.id.slice(0, 8)

    creditNotes.push({
      id: cn.id,
      supplier_group_id: cn.supplier_group_id,
      supplier_group_name: sg?.name ?? cn.supplier_group_id,
      plant_name: plantById.get(cn.plant_id) ?? cn.plant_id,
      credit_number,
      credit_date: cn.credit_date,
      reason: creditNoteReasonLabelEs(cn.reason),
      amount: Number(cn.amount),
      tax_amount: Number(cn.tax_amount),
      total: Number(cn.total),
      allocated_total,
      unapplied_total: Math.max(0, Number(cn.total) - allocated_total),
      status: cn.status,
      status_label: creditNoteStatusLabelEs(cn.status),
      cfdi_uuid: cn.cfdi_uuid,
      cfdi_estado_sat: cfdiEstadoSatLabelEs(cn.cfdi_estado_sat),
      invoices_touched: allocs
        .map((a) => {
          const inv = Array.isArray(a.invoice) ? a.invoice[0] : a.invoice
          return inv?.invoice_number
        })
        .filter(Boolean)
        .join(', '),
    })

    for (const a of allocs) {
      const inv = Array.isArray(a.invoice) ? a.invoice[0] : a.invoice
      creditNoteAllocations.push({
        credit_note_id: cn.id,
        credit_number,
        supplier_group_name: sg?.name ?? '',
        invoice_id: a.invoice_id,
        invoice_number: inv?.invoice_number ?? a.invoice_id,
        invoice_status: inv?.status ?? '',
        invoice_status_label: invoiceStatusLabelEs(inv?.status ?? ''),
        allocated_subtotal: Number(a.allocated_subtotal),
        allocated_tax: Number(a.allocated_tax),
        allocated_total: Number(a.allocated_total ?? 0),
      })
    }
  }

  const providerSummaries = buildProviderSummaries(
    orphanRows,
    invoices,
    creditNotes,
    payments,
  )

  return {
    plantScopeLabel,
    plantId,
    orphanRows,
    invoices,
    invoiceLines,
    payments,
    creditNotes,
    creditNoteAllocations,
    providerSummaries,
  }
}

function buildProviderSummaries(
  orphanRows: CxpReviewOrphanRow[],
  invoices: CxpReviewInvoiceRow[],
  creditNotes: CxpReviewCreditNoteRow[],
  payments: CxpReviewPaymentRow[],
): CxpReviewProviderSummaryRow[] {
  const map = new Map<string, CxpReviewProviderSummaryRow>()

  const ensure = (
    gid: string,
    name: string,
    rfc: string | null = null,
  ): CxpReviewProviderSummaryRow => {
    let row = map.get(gid)
    if (!row) {
      row = {
        supplier_group_id: gid,
        supplier_group_name: name,
        supplier_rfc: rfc,
        orphan_material_count: 0,
        orphan_fleet_count: 0,
        orphan_exposure: 0,
        invoice_count: 0,
        invoices_open: 0,
        invoices_paid: 0,
        invoice_total: 0,
        paid_to_date: 0,
        credit_applied: 0,
        balance_open: 0,
        credit_note_count: 0,
        credit_unapplied: 0,
        payments_rep_count: 0,
        alert_orphan_and_open: '',
      }
      map.set(gid, row)
    }
    if (rfc && !row.supplier_rfc) row.supplier_rfc = rfc
    return row
  }

  for (const o of orphanRows) {
    if (!o.supplier_group_id) continue
    const row = ensure(o.supplier_group_id, o.supplier_group_name)
    if (o.kind === 'material') row.orphan_material_count += 1
    else row.orphan_fleet_count += 1
    row.orphan_exposure += o.total_exposure
  }

  for (const inv of invoices) {
    const row = ensure(inv.supplier_group_id, inv.supplier_group_name, inv.supplier_rfc)
    row.invoice_count += 1
    row.invoice_total += inv.total
    row.paid_to_date += inv.paid_to_date
    row.credit_applied += inv.credit_applied_total
    if (inv.status === 'paid') row.invoices_paid += 1
    if (inv.status === 'open' || inv.status === 'partially_paid') {
      row.invoices_open += 1
      row.balance_open += inv.balance
    }
  }

  for (const cn of creditNotes) {
    const row = ensure(cn.supplier_group_id, cn.supplier_group_name)
    row.credit_note_count += 1
    row.credit_unapplied += cn.unapplied_total
  }

  const repByGroup = new Map<string, number>()
  for (const p of payments) {
    if (!p.has_complemento) continue
    const inv = invoices.find((i) => i.id === p.invoice_id)
    if (!inv) continue
    repByGroup.set(
      inv.supplier_group_id,
      (repByGroup.get(inv.supplier_group_id) ?? 0) + 1,
    )
  }
  for (const [gid, count] of repByGroup) {
    const row = map.get(gid)
    if (row) row.payments_rep_count = count
  }

  for (const row of map.values()) {
    const hasOrphan = row.orphan_material_count + row.orphan_fleet_count > 0
    const hasOpen = row.invoices_open > 0
    row.alert_orphan_and_open =
      hasOrphan && hasOpen
        ? 'Revisar: entradas sin factura y CxP abierta'
        : hasOrphan
          ? 'Entradas pendientes de facturar'
          : hasOpen
            ? 'CxP abierta'
            : ''
  }

  return [...map.values()].sort((a, b) =>
    a.supplier_group_name.localeCompare(b.supplier_group_name, 'es', { sensitivity: 'base' }),
  )
}
