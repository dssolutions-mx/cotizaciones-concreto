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

type InvoiceGuardRow = {
  id: string
  status: string
  subtotal: number
  vat_rate: number
  discount_amount: number | null
  retention_isr_rate: number | null
  retention_iva_rate: number | null
}

async function loadInvoiceGuard(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<{ ok: true; invoice: InvoiceGuardRow } | { ok: false; error: string; status: number }> {
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select(`
      id, status, subtotal, vat_rate, discount_amount,
      retention_isr_rate, retention_iva_rate,
      cn_allocations:credit_note_invoice_allocations(allocated_total)
    `)
    .eq('id', invoiceId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }
  if (!data) {
    return { ok: false, error: 'Factura no encontrada', status: 404 }
  }

  const invoice = data as InvoiceGuardRow & {
    cn_allocations?: Array<{ allocated_total?: number | null }>
  }

  if (invoice.status === 'paid' || invoice.status === 'void') {
    return {
      ok: false,
      error: 'No se puede modificar una factura pagada o anulada',
      status: 400,
    }
  }

  const creditApplied = (invoice.cn_allocations ?? []).reduce(
    (s, a) => s + Number(a.allocated_total ?? 0),
    0,
  )
  if (creditApplied > 0.01) {
    return {
      ok: false,
      error: 'No se puede eliminar: la factura tiene notas de crédito aplicadas',
      status: 400,
    }
  }

  return { ok: true, invoice: data as InvoiceGuardRow }
}

async function loadPayableIds(supabase: SupabaseClient, invoiceId: string): Promise<string[]> {
  const { data } = await supabase.from('payables').select('id').eq('invoice_id', invoiceId)
  return (data ?? []).map(row => String(row.id))
}

async function assertNoPayments(
  supabase: SupabaseClient,
  payableIds: string[],
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (payableIds.length === 0) return { ok: true }

  const { count, error } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .in('payable_id', payableIds)

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: 'No se puede eliminar: la factura ya tiene pagos registrados',
      status: 400,
    }
  }
  return { ok: true }
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

async function invoiceStillExists(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('supplier_invoices')
    .select('id')
    .eq('id', invoiceId)
    .maybeSingle()
  return Boolean(data)
}

/**
 * Deletes an invoice and all CxP children in FK-safe order.
 * supplier_invoices DELETE cascades to supplier_invoice_items and retentions.
 */
export async function cascadeDeleteSupplierInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const guard = await loadInvoiceGuard(supabase, invoiceId)
  if (!guard.ok) return guard

  const payableIds = await loadPayableIds(supabase, invoiceId)
  const payGuard = await assertNoPayments(supabase, payableIds)
  if (!payGuard.ok) return payGuard

  const { data: itemRows } = await supabase
    .from('supplier_invoice_items')
    .select('id')
    .eq('invoice_id', invoiceId)
  const itemIds = (itemRows ?? []).map(row => String(row.id))

  if (itemIds.length > 0) {
    const itemCreditCount = await countItemCreditAllocations(supabase, itemIds)
    if (itemCreditCount > 0) {
      return {
        ok: false,
        error: 'No se puede eliminar: hay notas de crédito aplicadas a líneas de la factura',
        status: 400,
      }
    }
  }

  if (itemIds.length > 0) {
    const { error: itemCnErr } = await supabase
      .from('invoice_credit_note_allocations')
      .delete()
      .in('invoice_item_id', itemIds)
    if (itemCnErr) {
      return { ok: false, error: itemCnErr.message, status: 500 }
    }
  }

  const { error: cnHdrErr } = await supabase
    .from('credit_note_invoice_allocations')
    .delete()
    .eq('invoice_id', invoiceId)
  if (cnHdrErr) {
    return { ok: false, error: cnHdrErr.message, status: 500 }
  }

  const { data: deletedPayableItems, error: piErr } = await supabase
    .from('payable_items')
    .delete()
    .eq('invoice_id', invoiceId)
    .select('id')
  if (piErr) {
    return { ok: false, error: piErr.message, status: 500 }
  }
  void deletedPayableItems

  if (payableIds.length > 0) {
    const { data: deletedPayables, error: payErr } = await supabase
      .from('payables')
      .delete()
      .in('id', payableIds)
      .select('id')
    if (payErr) {
      return { ok: false, error: payErr.message, status: 500 }
    }
    if ((deletedPayables ?? []).length < payableIds.length) {
      return {
        ok: false,
        error: 'No se pudieron eliminar todos los registros de cuentas por pagar vinculados',
        status: 500,
      }
    }
  }

  const { data: deletedInvoice, error: invErr } = await supabase
    .from('supplier_invoices')
    .delete()
    .eq('id', invoiceId)
    .select('id')
    .maybeSingle()

  if (invErr) {
    return { ok: false, error: invErr.message, status: 500 }
  }
  if (!deletedInvoice) {
    return {
      ok: false,
      error:
        'No se eliminó la factura en la base de datos (0 filas). Falta política RLS DELETE en supplier_invoices o hay dependencias pendientes.',
      status: 403,
    }
  }

  if (await invoiceStillExists(supabase, invoiceId)) {
    return {
      ok: false,
      error: 'La factura sigue existiendo después del intento de eliminación',
      status: 500,
    }
  }

  return { ok: true }
}

async function deleteInvoiceItemsByIds(
  supabase: SupabaseClient,
  invoiceId: string,
  itemIds: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string; status: number }> {
  const { data, error } = await supabase
    .from('supplier_invoice_items')
    .delete()
    .eq('invoice_id', invoiceId)
    .in('id', itemIds)
    .select('id')

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  const ids = (data ?? []).map(row => String(row.id))
  if (ids.length < itemIds.length) {
    return {
      ok: false,
      error:
        'No se pudieron eliminar las líneas de la factura. Verifique permisos RLS en supplier_invoice_items.',
      status: 403,
    }
  }

  return { ok: true, ids }
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

  const guard = await loadInvoiceGuard(supabase, invoiceId)
  if (!guard.ok) {
    return { ok: false, error: guard.error, status: guard.status }
  }
  const existing = guard.invoice

  const payableIds = await loadPayableIds(supabase, invoiceId)
  const payGuard = await assertNoPayments(supabase, payableIds)
  if (!payGuard.ok) {
    return { ok: false, error: payGuard.error, status: payGuard.status }
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
    await supabase
      .from('payable_items')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('entry_id', row.entry_id)
      .eq('cost_category', category)
  }

  const itemDel = await deleteInvoiceItemsByIds(supabase, invoiceId, uniqueIds)
  if (!itemDel.ok) {
    return itemDel
  }

  const { data: remaining, error: remErr } = await supabase
    .from('supplier_invoice_items')
    .select('id, entry_id, line_source, amount')
    .eq('invoice_id', invoiceId)

  if (remErr) {
    return { ok: false, error: remErr.message, status: 500 }
  }

  const remainingRows = remaining ?? []

  if (remainingRows.length === 0) {
    const cascade = await cascadeDeleteSupplierInvoice(supabase, invoiceId)
    if (!cascade.ok) {
      return cascade
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
  } = buildInvoiceTotalsFromBody(totalsPayload, subtotal)

  const invoiceSource = deriveInvoiceSource(
    remainingRows.map(r => ({
      line_source: r.line_source,
      entry_id: r.entry_id,
    })),
  )

  const { data: updated, error: updErr } = await supabase
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
    .select('id')
    .maybeSingle()

  if (updErr) {
    return { ok: false, error: updErr.message, status: 500 }
  }
  if (!updated) {
    return {
      ok: false,
      error: 'No se pudieron actualizar los totales de la factura',
      status: 403,
    }
  }

  if (payableIds.length > 0) {
    const { data: payUpdated, error: payUpdErr } = await supabase
      .from('payables')
      .update({
        subtotal,
        tax,
        total,
        vat_rate: Number(existing.vat_rate),
      })
      .in('id', payableIds)
      .select('id')

    if (payUpdErr) {
      return { ok: false, error: payUpdErr.message, status: 500 }
    }
    if (!payUpdated?.length) {
      return {
        ok: false,
        error: 'No se pudieron actualizar los totales de cuentas por pagar',
        status: 403,
      }
    }
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

  const ids = (items ?? []).map(r => String(r.id))
  const cascade = await cascadeDeleteSupplierInvoice(supabase, invoiceId)
  if (!cascade.ok) {
    return cascade
  }

  return {
    ok: true,
    invoiceId,
    deletedItemIds: ids,
    invoiceDeleted: true,
    remainingItemCount: 0,
  }
}
