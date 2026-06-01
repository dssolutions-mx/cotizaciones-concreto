import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedCfdi, RepPaymentPreviewRow, RepPaymentPreviewStatus } from '@/types/finance'
import { c_FormaPago } from '@/lib/sat/codigosSat'
import { syncInvoiceStatusFromPayable } from '@/lib/ap/syncPayableInvoiceStatus'
import { normalizeCfdiUuid } from '@/lib/sat/normalizeCfdiUuid'
import {
  buildRepMatchDiagnostics,
  loadSupplierContextByEmisorRfc,
} from '@/lib/ap/cfdiMatchDiagnostics'
import {
  backfillInvoiceCfdiUuid,
  ensurePayableForInvoice,
  invoiceBalance,
  loadInvoicesByCfdiUuids,
  normalizePayable,
  resolveRepInvoiceMatch,
  type InvoiceMatchRow,
} from '@/lib/sat/repInvoiceMatch'

const TOLERANCE = 0.02

export const REP_APPLICABLE_STATUSES: RepPaymentPreviewStatus[] = [
  'ready',
  'match_folio_confirm',
]

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

function validateInvoiceForPayment(
  inv: InvoiceMatchRow,
  impPagado: number,
  payableId: string | null,
): { status: RepPaymentPreviewStatus; message?: string; balance?: number } {
  if (inv.status === 'void') {
    return { status: 'invoice_void', message: 'Factura anulada' }
  }
  if (inv.status === 'paid') {
    return { status: 'invoice_paid', message: 'Factura ya marcada como pagada' }
  }
  if (!payableId) {
    return { status: 'no_payable', message: 'Factura sin cuenta por pagar enlazada' }
  }
  const invWithPayable: InvoiceMatchRow = {
    ...inv,
    payable: { id: payableId, payments: normalizePayable(inv)?.payments ?? [] },
  }
  const { balance } = invoiceBalance(invWithPayable)
  const rounded = Math.round(balance * 100) / 100
  if (impPagado > rounded + TOLERANCE) {
    return {
      status: 'overpayment',
      message: `Importe REP (${impPagado}) excede saldo (${rounded})`,
      balance: rounded,
    }
  }
  return { status: 'ready', balance: rounded }
}

export type BuildRepPreviewOptions = {
  companyRfc?: string | null
}

export async function buildRepPaymentPreview(
  supabase: SupabaseClient,
  cfdis: ParsedCfdi[],
  options: BuildRepPreviewOptions = {},
): Promise<RepPaymentPreviewRow[]> {
  const companyRfc = (options.companyRfc ?? '').trim().toUpperCase()
  const doctoUuids: string[] = []

  for (const cfdi of cfdis) {
    if (cfdi.tipo_comprobante !== 'P') continue
    for (const d of cfdi.pagos_doctos) {
      doctoUuids.push(d.docto_relacionado_uuid)
    }
  }

  if (doctoUuids.length === 0) return []

  const { data: existingPayments } = await supabase
    .from('payments')
    .select('cfdi_rep_uuid, cfdi_docto_uuid, cfdi_num_parcialidad')
    .not('cfdi_rep_uuid', 'is', null)

  const appliedSet = new Set(
    (existingPayments ?? []).map(
      (p) =>
        `${normalizeCfdiUuid(p.cfdi_rep_uuid)}|${normalizeCfdiUuid(p.cfdi_docto_uuid)}|${p.cfdi_num_parcialidad}`,
    ),
  )

  const invByUuid = await loadInvoicesByCfdiUuids(supabase, doctoUuids)
  const rows: RepPaymentPreviewRow[] = []
  const batchPaymentKeys = new Set<string>()
  const supplierCtxCache = new Map<
    string,
    Awaited<ReturnType<typeof loadSupplierContextByEmisorRfc>>
  >()

  const supplierCtx = async (emisorRfc: string) => {
    if (!supplierCtxCache.has(emisorRfc)) {
      supplierCtxCache.set(emisorRfc, await loadSupplierContextByEmisorRfc(supabase, emisorRfc))
    }
    return supplierCtxCache.get(emisorRfc)!
  }

  const enrichRow = async (
    row: RepPaymentPreviewRow,
    cfdi: ParsedCfdi,
  ): Promise<RepPaymentPreviewRow> => {
    const ctx = await supplierCtx(row.emisor_rfc)
    return {
      ...row,
      receptor_rfc: cfdi.receptor_rfc,
      match_diagnostics: buildRepMatchDiagnostics({
        emisor_rfc: row.emisor_rfc,
        emisor_nombre: row.emisor_nombre,
        docto_uuid: row.docto_uuid,
        docto_folio: row.docto_folio,
        status: row.status,
        match_method: row.match_method,
        supplierGroupName: ctx.groupName,
        openInvoices: ctx.openInvoices,
        companyRfc,
      }),
    }
  }

  for (const cfdi of cfdis) {
    if (cfdi.tipo_comprobante !== 'P') continue
    const receptorOk = !companyRfc || cfdi.receptor_rfc.toUpperCase() === companyRfc

    for (const d of cfdi.pagos_doctos) {
      const key = `${d.uuid}|${d.docto_relacionado_uuid}|${d.num_parcialidad}`
      const base: RepPaymentPreviewRow = {
        rep_uuid: d.uuid,
        docto_uuid: d.docto_relacionado_uuid,
        docto_folio: d.docto_folio ?? null,
        num_parcialidad: d.num_parcialidad,
        status: 'ready',
        match_method: null,
        imp_pagado: d.imp_pagado,
        fecha_pago: d.fecha_pago,
        forma_pago_p: d.forma_pago_p,
        emisor_rfc: cfdi.emisor_rfc,
        emisor_nombre: cfdi.emisor_nombre,
        rep_serie: cfdi.serie,
        rep_folio: cfdi.folio,
        supplier_invoice_id: null,
        invoice_number: null,
        payable_id: null,
        balance: null,
        proposed_payment_date: d.fecha_pago,
        proposed_amount: d.imp_pagado,
        proposed_method: formaPagoLabel(d.forma_pago_p),
        backfill_cfdi_uuid: false,
      }

      if (!receptorOk) {
        rows.push(
          await enrichRow(
            {
              ...base,
              status: 'receptor_mismatch',
              message: `Receptor ${cfdi.receptor_rfc} no coincide con RFC empresa (${companyRfc || 'no configurado'})`,
            },
            cfdi,
          ),
        )
        continue
      }

      const paymentKey = `${normalizeCfdiUuid(d.uuid)}|${normalizeCfdiUuid(d.docto_relacionado_uuid)}|${d.num_parcialidad}`
      if (batchPaymentKeys.has(paymentKey)) {
        rows.push(
          await enrichRow(
            {
              ...base,
              status: 'already_applied',
              message: 'Pago repetido en el archivo — omitido',
            },
            cfdi,
          ),
        )
        continue
      }
      batchPaymentKeys.add(paymentKey)

      if (appliedSet.has(paymentKey)) {
        rows.push(
          await enrichRow(
            {
              ...base,
              status: 'already_applied',
              message: 'Pago ya registrado en el sistema',
            },
            cfdi,
          ),
        )
        continue
      }

      const match = await resolveRepInvoiceMatch(
        supabase,
        {
          docto_uuid: d.docto_relacionado_uuid,
          docto_folio: d.docto_folio ?? null,
          docto_serie: d.docto_serie ?? null,
          emisor_rfc: cfdi.emisor_rfc,
        },
        invByUuid,
      )

      if (match.kind === 'not_found') {
        const folioHint = d.docto_folio ? ` · folio SAT ${d.docto_folio}` : ''
        rows.push(
          await enrichRow(
            {
              ...base,
              status: 'invoice_not_found',
              message: `Sin factura con UUID ${d.docto_relacionado_uuid.slice(0, 8)}…${folioHint}`,
            },
            cfdi,
          ),
        )
        continue
      }

      if (match.kind === 'sat_without_invoice') {
        rows.push(
          await enrichRow(
            {
              ...base,
              status: 'sat_without_invoice',
              message: 'CFDI de ingreso en inventario SAT, sin factura en CxP',
            },
            cfdi,
          ),
        )
        continue
      }

      if (match.kind === 'ambiguous') {
        rows.push(
          await enrichRow(
            {
              ...base,
              status: 'ambiguous_match',
              match_method: 'ambiguous',
              ambiguous_candidates: match.candidates,
              message: `${match.candidates.length} facturas posibles — seleccione una`,
            },
            cfdi,
          ),
        )
        continue
      }

      const inv = match.invoice
      base.supplier_invoice_id = inv.id
      base.invoice_number = inv.invoice_number
      base.match_method = match.method
      base.backfill_cfdi_uuid = match.backfill_cfdi_uuid

      const payableId = normalizePayable(inv)?.id ?? null
      base.payable_id = payableId
      if (!payableId) {
        rows.push(
          await enrichRow(
            {
              ...base,
              status: 'no_payable',
              message: 'Sin CxP enlazada — se intentará crear al aplicar el pago',
            },
            cfdi,
          ),
        )
        continue
      }

      const previewStatus =
        match.method === 'folio' || match.method === 'sat_bridge' ? 'match_folio_confirm' : 'ready'

      const validation = validateInvoiceForPayment(inv, d.imp_pagado, payableId)
      if (validation.status !== 'ready') {
        rows.push(
          await enrichRow(
            {
              ...base,
              status: validation.status,
              message: validation.message,
              balance: validation.balance ?? null,
            },
            cfdi,
          ),
        )
        continue
      }

      base.balance = validation.balance ?? null
      rows.push(await enrichRow({ ...base, status: previewStatus }, cfdi))
    }
  }

  return rows
}

export type RepPaymentApplyItem = {
  rep_uuid: string
  docto_uuid: string
  num_parcialidad: number
  /** When preview was ambiguous_match, user-selected invoice */
  supplier_invoice_id?: string
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
    uuid: normalizeCfdiUuid(row.uuid) ?? row.uuid,
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
  options: { plantIdScope?: string | null } = {},
): Promise<{ applied: number; skipped: number; errors: Array<{ key: string; message: string }> }> {
  let applied = 0
  let skipped = 0
  const errors: Array<{ key: string; message: string }> = []

  const repUuids = [...new Set(items.map((i) => normalizeCfdiUuid(i.rep_uuid) ?? i.rep_uuid))]
  const { data: satRows } = await supabase
    .from('sat_cfdi_recibidos')
    .select('uuid, serie, folio, fecha_emision, emisor_rfc, emisor_nombre, receptor_rfc, pagos_doctos')
    .in('uuid', repUuids)

  const cfdiByRepUuid = new Map(
    satRowsToParsedCfdis(satRows ?? []).map((c) => [c.uuid, c]),
  )

  const preview = await buildRepPaymentPreview(supabase, [...cfdiByRepUuid.values()])
  const previewMap = new Map(
    preview.map((r) => [`${r.rep_uuid}|${r.docto_uuid}|${r.num_parcialidad}`, r]),
  )

  for (const item of items) {
    const repUuid = normalizeCfdiUuid(item.rep_uuid) ?? item.rep_uuid
    const doctoUuid = normalizeCfdiUuid(item.docto_uuid) ?? item.docto_uuid
    const key = `${repUuid}|${doctoUuid}|${item.num_parcialidad}`
    let row = previewMap.get(key)

    if (item.supplier_invoice_id && row?.status === 'ambiguous_match') {
      const candidate = row.ambiguous_candidates?.find((c) => c.id === item.supplier_invoice_id)
      if (candidate) {
        row = {
          ...row,
          status: 'match_folio_confirm',
          supplier_invoice_id: item.supplier_invoice_id,
          invoice_number: candidate.invoice_number,
          backfill_cfdi_uuid: true,
        }
      }
    }

    if (!row || !REP_APPLICABLE_STATUSES.includes(row.status)) {
      skipped++
      errors.push({ key, message: 'Fila no elegible para aplicar' })
      continue
    }

    const invoiceId = item.supplier_invoice_id ?? row.supplier_invoice_id
    if (!invoiceId) {
      skipped++
      errors.push({ key, message: 'Factura no resuelta' })
      continue
    }

    if (options.plantIdScope) {
      const { data: invPlant } = await supabase
        .from('supplier_invoices')
        .select('plant_id')
        .eq('id', invoiceId)
        .maybeSingle()
      if (invPlant?.plant_id && invPlant.plant_id !== options.plantIdScope) {
        skipped++
        errors.push({ key, message: 'Factura fuera de la planta asignada' })
        continue
      }
    }

    const cfdi = cfdiByRepUuid.get(repUuid)
    if (!cfdi) {
      skipped++
      errors.push({ key, message: 'REP no encontrado en el lote' })
      continue
    }

    const docto = cfdi.pagos_doctos.find(
      (p) =>
        p.docto_relacionado_uuid === doctoUuid && p.num_parcialidad === item.num_parcialidad,
    )

    if (row.backfill_cfdi_uuid && docto) {
      await backfillInvoiceCfdiUuid(
        supabase,
        invoiceId,
        doctoUuid,
        cfdi.emisor_rfc,
        docto.docto_folio ?? null,
        docto.docto_serie ?? null,
      )
    }

    let payableId = row.payable_id
    if (!payableId) {
      const { data: payable } = await supabase
        .from('payables')
        .select('id')
        .eq('invoice_id', invoiceId)
        .maybeSingle()
      payableId = payable?.id ?? null
    }

    if (!payableId) {
      const { data: invRow } = await supabase
        .from('supplier_invoices')
        .select(`
          id, invoice_number, status, total, plant_id, supplier_group_id,
          cfdi_uuid, cfdi_folio, cfdi_serie, cfdi_emisor_rfc,
          payable:payables!invoice_id(id),
          cn_allocations:credit_note_invoice_allocations(allocated_total)
        `)
        .eq('id', invoiceId)
        .maybeSingle()
      if (invRow) {
        const healed = await ensurePayableForInvoice(
          supabase,
          invRow as import('@/lib/sat/repInvoiceMatch').InvoiceMatchRow,
          userId,
        )
        payableId = healed.payableId
        if (!healed.payableId && healed.error) {
          skipped++
          errors.push({ key, message: healed.error })
          continue
        }
      }
    }

    if (!payableId) {
      skipped++
      errors.push({ key, message: 'Payable no encontrado' })
      continue
    }

    const paymentDate = row.proposed_payment_date ?? cfdi.fecha_emision.slice(0, 10)
    const { error: insertErr } = await supabase.from('payments').insert({
      payable_id: payableId,
      payment_date: paymentDate,
      amount: row.proposed_amount ?? row.imp_pagado,
      method: row.proposed_method ?? formaPagoLabel(row.forma_pago_p),
      reference: repReference(cfdi),
      created_by: userId,
      source: 'sat_rep',
      cfdi_rep_uuid: repUuid,
      cfdi_docto_uuid: doctoUuid,
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

    await syncInvoiceStatusFromPayable(supabase, payableId)
    applied++
  }

  return { applied, skipped, errors }
}

export function skippedNotPRow(file: string): RepPaymentPreviewRow {
  return {
    rep_uuid: '',
    docto_uuid: '',
    docto_folio: null,
    num_parcialidad: 0,
    status: 'skipped_not_p' as RepPaymentPreviewStatus,
    match_method: null,
    imp_pagado: 0,
    fecha_pago: null,
    forma_pago_p: null,
    emisor_rfc: '',
    emisor_nombre: null,
    rep_serie: null,
    rep_folio: null,
    supplier_invoice_id: null,
    invoice_number: null,
    payable_id: null,
    balance: null,
    proposed_payment_date: null,
    proposed_amount: null,
    proposed_method: null,
    message: `Omitido (no es tipo P): ${file}`,
  }
}
