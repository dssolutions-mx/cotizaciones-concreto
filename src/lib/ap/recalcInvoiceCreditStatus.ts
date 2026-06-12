import type { SupabaseClient } from '@supabase/supabase-js'

type InvoiceStatus = 'open' | 'partially_paid' | 'paid'

/** Recomputes supplier_invoices + payables status after credit note changes. */
export async function recalcInvoiceStatusAfterCreditChange(
  admin: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  const { data: inv } = await admin
    .from('supplier_invoices')
    .select('subtotal, discount_amount, total, status')
    .eq('id', invoiceId)
    .single()

  if (!inv || inv.status === 'void') return

  const taxableBase = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
  const invoiceTotal = Number(inv.total)

  const { data: cnAllocs } = await admin
    .from('credit_note_invoice_allocations')
    .select('allocated_subtotal, allocated_total')
    .eq('invoice_id', invoiceId)

  const totalCreditedSub = (cnAllocs ?? []).reduce(
    (s, a) => s + Number(a.allocated_subtotal ?? 0),
    0,
  )
  const totalCredited = (cnAllocs ?? []).reduce(
    (s, a) => s + Number(a.allocated_total ?? 0),
    0,
  )

  const { data: payable } = await admin
    .from('payables')
    .select('id, payments:payments!payable_id(amount)')
    .eq('invoice_id', invoiceId)
    .maybeSingle()

  const payments = (payable as { payments?: Array<{ amount: number }> } | null)?.payments ?? []
  const paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0)

  let newStatus: InvoiceStatus
  if (
    totalCreditedSub >= taxableBase - 0.01 ||
    paid + totalCredited >= invoiceTotal - 0.01
  ) {
    newStatus = 'paid'
  } else if (paid > 0.01 || totalCredited > 0.01) {
    newStatus = 'partially_paid'
  } else {
    newStatus = 'open'
  }

  await admin.from('supplier_invoices').update({ status: newStatus }).eq('id', invoiceId)
  if (payable?.id) {
    await admin.from('payables').update({ status: newStatus }).eq('id', payable.id)
  }
}

export async function recalcCreditNoteStatus(
  admin: SupabaseClient,
  creditNoteId: string,
): Promise<void> {
  const { data: cn } = await admin
    .from('invoice_credit_notes')
    .select('amount, status')
    .eq('id', creditNoteId)
    .single()

  if (!cn || cn.status === 'void') return

  const { data: allocs } = await admin
    .from('credit_note_invoice_allocations')
    .select('allocated_subtotal')
    .eq('credit_note_id', creditNoteId)

  const allocated = (allocs ?? []).reduce((s, a) => s + Number(a.allocated_subtotal ?? 0), 0)
  const cnAmount = Number(cn.amount)

  let status: 'open' | 'partially_applied' | 'fully_applied'
  if (allocated <= 0.01) {
    status = 'open'
  } else if (Math.abs(allocated - cnAmount) <= 0.01) {
    status = 'fully_applied'
  } else {
    status = 'partially_applied'
  }

  await admin.from('invoice_credit_notes').update({ status }).eq('id', creditNoteId)
}
