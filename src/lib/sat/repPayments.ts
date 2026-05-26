import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedCfdi, RepPaymentPreviewRow, RepPaymentPreviewStatus } from '@/types/finance'
import { c_FormaPago } from '@/lib/sat/codigosSat'
import { syncInvoiceStatusFromPayable } from '@/lib/ap/syncPayableInvoiceStatus'

const TOLERANCE = 0.02

function formaPagoLabel(code: string | null): string | null {
  if (!code) return null
  const found = c_FormaPago.find((f) => f.code === code)
  return found?.label ?? code
}

function repReference(cfdi: ParsedCfdi): string {
  if (cfdi.serie || cfdi.folio) {
    return `REP ${[cfdi.serie, cfdi.folio].filter(Boolean).join('-')}`
  }
  return `REP ${cfdi.uuid.slice(0, 8)}`
}

type InvoiceRow = {
  id: string
  invoice_number: string
  status: string
  total: number
  cfdi_uuid: string | null
  payable: { id: string; payments?: { amount: number }[] } | { id: string; payments?: { amount: number }[] }[] | null
  cn_allocations?: { allocated_total: number }[]
}

function normalizePayable(inv: InvoiceRow) {
  const p = inv.payable
  if (!p) return null
  return Array.isArray(p) ? p[0] ?? null : p
}

function invoiceBalance(inv: InvoiceRow): { paid_to_date: number; credit_applied_total: number; balance: number } {
  const payable = normalizePayable(inv)
  const payments = payable?.payments ?? []
  const paid_to_date = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const cnAllocs = inv.cn_allocations ?? []
  const credit_applied_total = cnAllocs.reduce((s, a) => s + Number(a.allocated_total ?? 0), 0)
  const balance = Number(inv.total) - paid_to_date - credit_applied_total
  return { paid_to_date, credit_applied_total, balance }
}

export async function buildRepPaymentPreview(
  supabase: SupabaseClient,
  cfdis: ParsedCfdi[],
): Promise<RepPaymentPreviewRow[]> {
  const doctoUuids = new Set<string>()
  const repKeys: Array<{ rep: string; docto: string; par: number }> = []

  for (const cfdi of cfdis) {
    if (cfdi.tipo_comprobante !== 'P') continue
    for (const d of cfdi.pagos_doctos) {
      doctoUuids.add(d.docto_relacionado_uuid)
      repKeys.push({
        rep: d.uuid,
        docto: d.docto_relacionado_uuid,
        par: d.num_parcialidad,
      })
    }
  }

  if (repKeys.length === 0) return []

  const { data: existingPayments } = await supabase
    .from('payments')
    .select('cfdi_rep_uuid, cfdi_docto_uuid, cfdi_num_parcialidad')
    .not('cfdi_rep_uuid', 'is', null)

  const appliedSet = new Set(
    (existingPayments ?? []).map(
      (p) => `${p.cfdi_rep_uuid}|${p.cfdi_docto_uuid}|${p.cfdi_num_parcialidad}`,
    ),
  )

  const { data: invoices } = await supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_number, status, total, cfdi_uuid,
      payable:payables!invoice_id(
        id,
        payments:payments!payable_id(amount)
      ),
      cn_allocations:credit_note_invoice_allocations(allocated_total)
    `)
    .in('cfdi_uuid', [...doctoUuids])

  const invByUuid = new Map<string, InvoiceRow>()
  for (const inv of invoices ?? []) {
    if (inv.cfdi_uuid) invByUuid.set(String(inv.cfdi_uuid).toLowerCase(), inv as InvoiceRow)
  }

  const rows: RepPaymentPreviewRow[] = []

  for (const cfdi of cfdis) {
    if (cfdi.tipo_comprobante !== 'P') continue
    for (const d of cfdi.pagos_doctos) {
      const key = `${d.uuid}|${d.docto_relacionado_uuid}|${d.num_parcialidad}`
      const base: RepPaymentPreviewRow = {
        rep_uuid: d.uuid,
        docto_uuid: d.docto_relacionado_uuid,
        num_parcialidad: d.num_parcialidad,
        status: 'ready',
        imp_pagado: d.imp_pagado,
        fecha_pago: d.fecha_pago,
        forma_pago_p: d.forma_pago_p,
        emisor_rfc: cfdi.emisor_rfc,
        emisor_nombre: cfdi.emisor_nombre,
        rep_serie: cfdi.serie,
        rep_folio: cfdi.folio,
        supplier_invoice_id: null,
        invoice_number: null,
        balance: null,
        proposed_payment_date: d.fecha_pago,
        proposed_amount: d.imp_pagado,
        proposed_method: formaPagoLabel(d.forma_pago_p),
      }

      if (appliedSet.has(key)) {
        rows.push({ ...base, status: 'already_applied', message: 'Pago REP ya registrado' })
        continue
      }

      const inv = invByUuid.get(d.docto_relacionado_uuid)
      if (!inv) {
        rows.push({
          ...base,
          status: 'invoice_not_found',
          message: 'No hay factura con este UUID CFDI',
        })
        continue
      }

      base.supplier_invoice_id = inv.id
      base.invoice_number = inv.invoice_number

      if (inv.status === 'void') {
        rows.push({ ...base, status: 'invoice_void', message: 'Factura anulada' })
        continue
      }

      if (inv.status === 'paid') {
        rows.push({ ...base, status: 'invoice_paid', message: 'Factura ya marcada como pagada' })
        continue
      }

      const payable = normalizePayable(inv)
      if (!payable?.id) {
        rows.push({ ...base, status: 'no_payable', message: 'Factura sin cuenta por pagar enlazada' })
        continue
      }

      const { balance } = invoiceBalance(inv)
      base.balance = Math.round(balance * 100) / 100

      if (d.imp_pagado > balance + TOLERANCE) {
        rows.push({
          ...base,
          status: 'overpayment',
          message: `Importe REP (${d.imp_pagado}) excede saldo (${base.balance})`,
        })
        continue
      }

      rows.push({ ...base, status: 'ready' })
    }
  }

  return rows
}

export type RepPaymentApplyItem = {
  rep_uuid: string
  docto_uuid: string
  num_parcialidad: number
}

export function satRowsToParsedCfdis(
  rows: Array<{
    uuid: string
    serie: string | null
    folio: string | null
    fecha_emision: string
    emisor_rfc: string
    emisor_nombre: string | null
    receptor_rfc: string
    pagos_doctos: ParsedCfdi['pagos_doctos'] | null
  }>,
): ParsedCfdi[] {
  return rows.map((row) => ({
    uuid: row.uuid,
    serie: row.serie,
    folio: row.folio,
    tipo_comprobante: 'P',
    fecha_emision: row.fecha_emision,
    fecha_timbrado: row.fecha_emision,
    emisor_rfc: row.emisor_rfc,
    emisor_nombre: row.emisor_nombre,
    receptor_rfc: row.receptor_rfc,
    receptor_nombre: null,
    subtotal: 0,
    descuento: 0,
    total: 0,
    iva_trasladado: 0,
    isr_retenido: 0,
    iva_retenido: 0,
    vat_rate: 0,
    retention_isr_rate: 0,
    retention_iva_rate: 0,
    retenciones: [],
    metodo_pago: null,
    forma_pago: null,
    uso_cfdi: null,
    moneda: 'MXN',
    tipo_cambio: 1,
    cfdi_relacionados: [],
    pagos_doctos: (row.pagos_doctos ?? []) as ParsedCfdi['pagos_doctos'],
    conceptos: [],
  }))
}

export async function applyRepPayments(
  supabase: SupabaseClient,
  userId: string,
  items: RepPaymentApplyItem[],
): Promise<{ applied: number; skipped: number; errors: Array<{ key: string; message: string }> }> {
  let applied = 0
  let skipped = 0
  const errors: Array<{ key: string; message: string }> = []

  const repUuids = [...new Set(items.map((i) => i.rep_uuid))]
  const { data: satRows } = await supabase
    .from('sat_cfdi_recibidos')
    .select('uuid, serie, folio, fecha_emision, emisor_rfc, emisor_nombre, receptor_rfc, pagos_doctos')
    .in('uuid', repUuids)

  const cfdiByRepUuid = new Map(
    satRowsToParsedCfdis(satRows ?? []).map((c) => [c.uuid, c]),
  )

  const preview = await buildRepPaymentPreview(
    supabase,
    [...cfdiByRepUuid.values()],
  )
  const readyMap = new Map(
    preview
      .filter((r) => r.status === 'ready')
      .map((r) => [`${r.rep_uuid}|${r.docto_uuid}|${r.num_parcialidad}`, r]),
  )

  for (const item of items) {
    const key = `${item.rep_uuid}|${item.docto_uuid}|${item.num_parcialidad}`
    const row = readyMap.get(key)
    if (!row?.supplier_invoice_id) {
      skipped++
      errors.push({ key, message: 'Fila no elegible para aplicar' })
      continue
    }

    const cfdi = cfdiByRepUuid.get(item.rep_uuid)
    if (!cfdi) {
      skipped++
      errors.push({ key, message: 'REP no encontrado en el lote' })
      continue
    }

    const { data: payable } = await supabase
      .from('payables')
      .select('id')
      .eq('invoice_id', row.supplier_invoice_id)
      .maybeSingle()

    if (!payable?.id) {
      skipped++
      errors.push({ key, message: 'Payable no encontrado' })
      continue
    }

    const paymentDate = row.proposed_payment_date ?? cfdi.fecha_emision.slice(0, 10)
    const { error: insertErr } = await supabase.from('payments').insert({
      payable_id: payable.id,
      payment_date: paymentDate,
      amount: row.proposed_amount ?? row.imp_pagado,
      method: row.proposed_method ?? formaPagoLabel(row.forma_pago_p),
      reference: repReference(cfdi),
      created_by: userId,
      source: 'sat_rep',
      cfdi_rep_uuid: item.rep_uuid,
      cfdi_docto_uuid: item.docto_uuid,
      cfdi_num_parcialidad: item.num_parcialidad,
    })

    if (insertErr) {
      if (insertErr.code === '23505') {
        skipped++
        errors.push({ key, message: 'Pago REP duplicado' })
      } else {
        skipped++
        errors.push({ key, message: insertErr.message })
      }
      continue
    }

    await syncInvoiceStatusFromPayable(supabase, payable.id)
    applied++
  }

  return { applied, skipped, errors }
}

export function skippedNotPRow(file: string): RepPaymentPreviewRow {
  return {
    rep_uuid: '',
    docto_uuid: '',
    num_parcialidad: 0,
    status: 'skipped_not_p' as RepPaymentPreviewStatus,
    imp_pagado: 0,
    fecha_pago: null,
    forma_pago_p: null,
    emisor_rfc: '',
    emisor_nombre: null,
    rep_serie: null,
    rep_folio: null,
    supplier_invoice_id: null,
    invoice_number: null,
    balance: null,
    proposed_payment_date: null,
    proposed_amount: null,
    proposed_method: null,
    message: `Omitido (no es tipo P): ${file}`,
  }
}
