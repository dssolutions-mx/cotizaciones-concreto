import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildInvoiceTotalsFromBody,
  deriveInvoiceSource,
} from '@/lib/ap/normalizeInvoicePayload'
import { roundMoney } from '@/lib/ap/invoiceTotals'

export type DeleteSupplierInvoiceItemsResult =
  | {
      ok: true
      invoiceId: string
      deletedItemIds: string[]
      invoiceDeleted: boolean
      remainingItemCount: number
    }
  | { ok: false; error: string; status: number }

type InvoiceItemRow = {
  id: string
  entry_id: string | null
  line_source: string | null
  cost_category: string | null
  amount: number
}

async function countPayments(supabase: SupabaseClient, payableId: string): Promise<number> {
  const { count, error } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('payable_id', payableId)
  if (error) throw error
  return count ?? 0
}

async function countItemCreditAllocations(
  supabase: SupabaseClient,
  itemIds: string[],
): Promise<number> {
  if (itemIds.length === 0) return 0
  const { count, error } = await supabase
    .from('invoice_credit_note_allocations')
    .select('id', { count: 'exact', head: true })
    .in('invoice_item_id', itemIds)
  if (error) throw error
  return count ?? 0
}

/**
 * Removes invoice line(s), matching payable_items, and recalculates or deletes the invoice header.
 */
export async function deleteSupplierInvoiceItems(
  supabase: SupabaseClient,
  invoiceId: string,
  itemIds: string[],
): Promise<DeleteSupplierInvoiceItemsResult> {
  const uniqueIds = [...new Set(itemIds.map(String).filter(Boolean))]
  if (uniqueIds.length === 0) {
    return { ok: false, error: 'Indique al menos una línea a quitar', status: 400 }
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('supplier_invoices')
    .select(`
      id, status, plant_id, subtotal, vat_rate, discount_amount,
      retention_isr_rate, retention_iva_rate,
      payable:payables!invoice_id(id, status),
      cn_allocations:credit_note_invoice_allocations(allocated_total)
    `)
    .eq('id', invoiceId)
    .single()

  if (fetchErr || !existing) {
    return { ok: false, error: 'Factura no encontrada', status: 404 }
  }

  if (existing.status === 'paid' || existing.status === 'void') {
    return {
      ok: false,
      error: 'No se puede modificar una factura pagada o anulada',
      status: 400,
    }
  }

  const cnAllocs: Array<{ allocated_total?: number | null }> =
    (existing as { cn_allocations?: Array<{ allocated_total?: number | null }> }).cn_allocations ?? []
  const creditApplied = cnAllocs.reduce((s, a) => s + Number(a.allocated_total ?? 0), 0)
  if (creditApplied > 0.01) {
    return {
      ok: false,
      error: 'No se puede quitar líneas: la factura tiene notas de crédito aplicadas',
      status: 400,
    }
  }

  const payable = Array.isArray(existing.payable)
    ? (existing.payable as { id: string; status: string }[])[0]
    : (existing.payable as { id: string; status: string } | null)

  if (payable?.id) {
    const payCount = await countPayments(supabase, payable.id)
    if (payCount > 0) {
      return {
        ok: false,
        error: 'No se puede quitar líneas: la factura ya tiene pagos registrados',
        status: 400,
      }
    }
  }

  const { data: toDelete, error: itemsErr } = await supabase
    .from('supplier_invoice_items')
    .select('id, entry_id, line_source, cost_category, amount')
    .eq('invoice_id', invoiceId)
    .in('id', uniqueIds)

  if (itemsErr) {
    return { ok: false, error: itemsErr.message, status: 500 }
  }

  const rows = (toDelete ?? []) as InvoiceItemRow[]
  if (rows.length !== uniqueIds.length) {
    return {
      ok: false,
      error: 'Una o más líneas no pertenecen a esta factura',
      status: 400,
    }
  }

  const itemCreditCount = await countItemCreditAllocations(supabase, uniqueIds)
  if (itemCreditCount > 0) {
    return {
      ok: false,
      error: 'No se puede quitar líneas con notas de crédito aplicadas a nivel de partida',
      status: 400,
    }
  }

  for (const row of rows) {
    if (!row.entry_id) continue
    const category = row.cost_category === 'fleet' ? 'fleet' : 'material'
    if (payable?.id) {
      const { error: piDelErr } = await supabase
        .from('payable_items')
        .delete()
        .eq('payable_id', payable.id)
        .eq('entry_id', row.entry_id)
        .eq('cost_category', category)
      if (piDelErr) {
        return { ok: false, error: piDelErr.message, status: 500 }
      }
    }
  }

  const { error: delErr } = await supabase
    .from('supplier_invoice_items')
    .delete()
    .eq('invoice_id', invoiceId)
    .in('id', uniqueIds)

  if (delErr) {
    return { ok: false, error: delErr.message, status: 500 }
  }

  const { data: remaining, error: remErr } = await supabase
    .from('supplier_invoice_items')
    .select('id, entry_id, line_source, amount')
    .eq('invoice_id', invoiceId)

  if (remErr) {
    return {
      ok: true,
      invoiceId,
      deletedItemIds: uniqueIds,
      invoiceDeleted: false,
      remainingItemCount: -1,
    }
  }

  const remainingRows = remaining ?? []

  if (remainingRows.length === 0) {
    await supabase.from('supplier_invoice_retentions').delete().eq('invoice_id', invoiceId)
    if (payable?.id) {
      await supabase.from('payable_items').delete().eq('payable_id', payable.id)
      await supabase.from('payables').delete().eq('id', payable.id)
    }
    const { error: invDelErr } = await supabase.from('supplier_invoices').delete().eq('id', invoiceId)
    if (invDelErr) {
      return {
        ok: false,
        error: `Líneas eliminadas pero no se pudo borrar la factura vacía: ${invDelErr.message}`,
        status: 500,
      }
    }
    return {
      ok: true,
      invoiceId,
      deletedItemIds: uniqueIds,
      invoiceDeleted: true,
      remainingItemCount: 0,
    }
  }

  let subtotal = remainingRows.reduce((sum, row) => sum + Number(row.amount), 0)
  subtotal = roundMoney(subtotal)

  const totalsPayload = {
    discount_amount: existing.discount_amount,
    vat_rate: existing.vat_rate,
    retention_isr_rate: existing.retention_isr_rate,
    retention_iva_rate: existing.retention_iva_rate,
  }
  const {
    tax,
    total,
    retention_isr_rate: isrRate,
    retention_isr_amount: isrAmt,
    retention_iva_rate: ivaRetRate,
    retention_iva_amount: ivaRetAmt,
    discountAmt,
    taxableBase,
  } = buildInvoiceTotalsFromBody(totalsPayload, subtotal)

  const invoiceSource = deriveInvoiceSource(
    remainingRows.map(r => ({
      line_source: r.line_source,
      entry_id: r.entry_id,
    })),
  )

  const { error: updErr } = await supabase
    .from('supplier_invoices')
    .update({
      subtotal,
      discount_amount: discountAmt,
      tax,
      total,
      retention_isr_rate: isrRate,
      retention_isr_amount: isrAmt,
      retention_iva_rate: ivaRetRate,
      retention_iva_amount: ivaRetAmt,
      source: invoiceSource,
    })
    .eq('id', invoiceId)

  if (updErr) {
    return { ok: false, error: updErr.message, status: 500 }
  }

  if (payable?.id) {
    await supabase
      .from('payables')
      .update({
        subtotal,
        tax,
        total,
        vat_rate: Number(existing.vat_rate),
      })
      .eq('id', payable.id)
  }

  return {
    ok: true,
    invoiceId,
    deletedItemIds: uniqueIds,
    invoiceDeleted: false,
    remainingItemCount: remainingRows.length,
  }
}

/**
 * Deletes an entire supplier invoice when it has no payments or credit notes applied.
 */
export async function deleteEntireSupplierInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<DeleteSupplierInvoiceItemsResult> {
  const { data: items, error: itemsErr } = await supabase
    .from('supplier_invoice_items')
    .select('id')
    .eq('invoice_id', invoiceId)

  if (itemsErr) {
    return { ok: false, error: itemsErr.message, status: 500 }
  }

  const ids = (items ?? []).map(r => r.id as string)
  if (ids.length === 0) {
    const { data: existing } = await supabase
      .from('supplier_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .maybeSingle()
    if (!existing) {
      return { ok: false, error: 'Factura no encontrada', status: 404 }
    }
    if (existing.status === 'paid' || existing.status === 'void') {
      return {
        ok: false,
        error: 'No se puede eliminar una factura pagada o anulada',
        status: 400,
      }
    }
    await supabase.from('supplier_invoice_retentions').delete().eq('invoice_id', invoiceId)
    const { data: payables } = await supabase
      .from('payables')
      .select('id')
      .eq('invoice_id', invoiceId)
    for (const p of payables ?? []) {
      await supabase.from('payable_items').delete().eq('payable_id', p.id)
      await supabase.from('payables').delete().eq('id', p.id)
    }
    await supabase.from('supplier_invoices').delete().eq('id', invoiceId)
    return {
      ok: true,
      invoiceId,
      deletedItemIds: [],
      invoiceDeleted: true,
      remainingItemCount: 0,
    }
  }

  return deleteSupplierInvoiceItems(supabase, invoiceId, ids)
}
