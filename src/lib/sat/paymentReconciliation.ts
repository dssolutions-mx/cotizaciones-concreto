import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentReconciliationReport } from '@/types/finance'

const TOLERANCE = 0.02

export async function buildPaymentReconciliationReport(
  supabase: SupabaseClient,
  from: string,
  to: string,
  emisorRfc?: string,
): Promise<PaymentReconciliationReport> {
  let satQuery = supabase
    .from('sat_cfdi_recibidos')
    .select('uuid, emisor_rfc, fecha_emision, pagos_doctos, tipo_comprobante')
    .eq('tipo_comprobante', 'P')
    .gte('fecha_emision', from)
    .lte('fecha_emision', to + 'T23:59:59')

  if (emisorRfc) satQuery = satQuery.eq('emisor_rfc', emisorRfc)

  const { data: satRows } = await satQuery
  const repList = satRows ?? []

  let payQuery = supabase
    .from('payments')
    .select(`
      id, payment_date, amount, method, cfdi_rep_uuid, cfdi_docto_uuid, cfdi_num_parcialidad, source,
      payable:payables!payable_id(
        invoice:supplier_invoices!invoice_id(invoice_number, cfdi_uuid)
      )
    `)
    .gte('payment_date', from)
    .lte('payment_date', to)

  const { data: paymentRows } = await payQuery
  const payments = paymentRows ?? []

  const repDoctoKeys: Array<{
    rep_uuid: string
    docto_uuid: string
    num_parcialidad: number
    imp_pagado: number
    emisor_rfc: string
    fecha_emision: string
  }> = []

  for (const sat of repList) {
    const docs = (sat.pagos_doctos as Array<{
      uuid?: string
      docto_relacionado_uuid: string
      imp_pagado: number
      num_parcialidad: number
    }> | null) ?? []
    for (const d of docs) {
      const repUuid = (d.uuid ?? sat.uuid).toLowerCase()
      const docto = d.docto_relacionado_uuid.toLowerCase()
      const par = d.num_parcialidad ?? 1
      const key = `${repUuid}|${docto}|${par}`
      repDoctoKeys.push({
        rep_uuid: repUuid,
        docto_uuid: docto,
        num_parcialidad: par,
        imp_pagado: Number(d.imp_pagado),
        emisor_rfc: sat.emisor_rfc,
        fecha_emision: sat.fecha_emision,
      })
    }
  }

  const systemByKey = new Map<string, { amount: number; payment_id: string; invoice_number: string | null }>()
  const repNotApplied: PaymentReconciliationReport['rep_not_applied'] = []
  const matched: PaymentReconciliationReport['matched'] = []
  const amountMismatch: PaymentReconciliationReport['amount_mismatch'] = []
  const paymentWithoutRep: PaymentReconciliationReport['payment_without_rep'] = []

  for (const p of payments) {
    const inv = Array.isArray(p.payable) ? p.payable[0]?.invoice : (p.payable as any)?.invoice
    const invoiceNumber = Array.isArray(inv) ? inv[0]?.invoice_number : inv?.invoice_number

    if (!p.cfdi_rep_uuid) {
      paymentWithoutRep.push({
        payment_id: p.id,
        payment_date: p.payment_date,
        amount: Number(p.amount),
        invoice_number: invoiceNumber ?? null,
        method: p.method,
      })
      continue
    }

    const key = `${p.cfdi_rep_uuid}|${p.cfdi_docto_uuid}|${p.cfdi_num_parcialidad}`
    systemByKey.set(key, {
      amount: Number(p.amount),
      payment_id: p.id,
      invoice_number: invoiceNumber ?? null,
    })
  }

  for (const rd of repDoctoKeys) {
    const key = `${rd.rep_uuid}|${rd.docto_uuid}|${rd.num_parcialidad}`
    const sys = systemByKey.get(key)
    if (!sys) {
      repNotApplied.push({
        rep_uuid: rd.rep_uuid,
        docto_uuid: rd.docto_uuid,
        num_parcialidad: rd.num_parcialidad,
        imp_pagado: rd.imp_pagado,
        emisor_rfc: rd.emisor_rfc,
        fecha_emision: rd.fecha_emision,
      })
      continue
    }

    const amountMatch = Math.abs(rd.imp_pagado - sys.amount) <= TOLERANCE
    matched.push({
      rep_uuid: rd.rep_uuid,
      docto_uuid: rd.docto_uuid,
      num_parcialidad: rd.num_parcialidad,
      invoice_number: sys.invoice_number,
      sat_amount: rd.imp_pagado,
      system_amount: sys.amount,
      amount_match: amountMatch,
    })

    if (!amountMatch) {
      amountMismatch.push({
        rep_uuid: rd.rep_uuid,
        docto_uuid: rd.docto_uuid,
        invoice_number: sys.invoice_number,
        sat_amount: rd.imp_pagado,
        system_amount: sys.amount,
        diff: Math.round((sys.amount - rd.imp_pagado) * 100) / 100,
      })
    }
  }

  return {
    matched,
    rep_not_applied: repNotApplied,
    payment_without_rep: paymentWithoutRep,
    amount_mismatch: amountMismatch,
    summary: {
      total_rep_doctos: repDoctoKeys.length,
      matched: matched.length,
      rep_not_applied: repNotApplied.length,
      payment_without_rep: paymentWithoutRep.length,
      amount_mismatch: amountMismatch.length,
    },
  }
}
