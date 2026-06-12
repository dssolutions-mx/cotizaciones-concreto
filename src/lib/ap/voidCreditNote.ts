import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { propagateCreditToEntry } from '@/lib/ap/creditPropagation'
import { recalcCreditNoteStatus, recalcInvoiceStatusAfterCreditChange } from '@/lib/ap/recalcInvoiceCreditStatus'
import type { CreditNoteInvoiceAllocationInput } from '@/lib/ap/creditNoteAllocationTypes'
import { buildProportionalItemAllocations } from '@/lib/ap/creditPropagation'

type AffectedItem = {
  invoice_item_id: string
  invoice_id: string
  item_amount: number
  cost_category: string | null
  entry_id: string | null
}

async function loadAffectedItems(
  admin: SupabaseClient,
  creditNoteId: string,
  invoiceId?: string,
): Promise<AffectedItem[]> {
  let allocQuery = admin
    .from('credit_note_invoice_allocations')
    .select(`
      id, invoice_id,
      item_allocations:invoice_credit_note_allocations(invoice_item_id),
      invoice:supplier_invoices!invoice_id(
        items:supplier_invoice_items(id, entry_id, amount, cost_category)
      )
    `)
    .eq('credit_note_id', creditNoteId)

  if (invoiceId) allocQuery = allocQuery.eq('invoice_id', invoiceId)

  const { data: allocs } = await allocQuery
  const items: AffectedItem[] = []
  const seen = new Set<string>()

  for (const alloc of allocs ?? []) {
    const invItems = (alloc.invoice as {
      items?: Array<{ id: string; entry_id: string | null; amount: number; cost_category: string | null }>
    } | null)?.items ?? []
    const itemIdsFromAlloc = (alloc.item_allocations ?? []).map(
      (a: { invoice_item_id: string }) => a.invoice_item_id,
    )

    const targetIds = itemIdsFromAlloc.length > 0
      ? itemIdsFromAlloc
      : invItems.map((i) => i.id)

    for (const itemId of targetIds) {
      if (seen.has(itemId)) continue
      seen.add(itemId)
      const item = invItems.find((i) => (i as { id: string }).id === itemId) as
        | { id: string; entry_id: string | null; amount: number; cost_category: string | null }
        | undefined
      if (!item) continue
      items.push({
        invoice_item_id: item.id,
        invoice_id: alloc.invoice_id as string,
        item_amount: Number(item.amount),
        cost_category: item.cost_category,
        entry_id: item.entry_id,
      })
    }
  }

  return items
}

async function repropagateItems(admin: SupabaseClient, items: AffectedItem[]): Promise<void> {
  for (const item of items) {
    if (!item.entry_id) continue
    await propagateCreditToEntry(
      admin,
      item.invoice_item_id,
      item.item_amount,
      item.cost_category,
      item.entry_id,
    ).catch((e) => console.error('propagateCreditToEntry error:', e))
  }
}

export type DeleteCreditNoteResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

/** Removes the NC and all allocations; reverts entry prices and invoice status. */
export async function deleteCreditNote(
  _supabase: SupabaseClient,
  creditNoteId: string,
): Promise<DeleteCreditNoteResult> {
  let admin: ReturnType<typeof createServiceClient>
  try {
    admin = createServiceClient()
  } catch {
    return { ok: false, error: 'Configuración del servidor incompleta', status: 503 }
  }

  const { data: cn } = await admin
    .from('invoice_credit_notes')
    .select('id')
    .eq('id', creditNoteId)
    .single()

  if (!cn) return { ok: false, error: 'Nota de crédito no encontrada', status: 404 }

  const affected = await loadAffectedItems(admin, creditNoteId)
  const invoiceIds = [...new Set(affected.map((i) => i.invoice_id))]

  const { data: invAllocs } = await admin
    .from('credit_note_invoice_allocations')
    .select('id')
    .eq('credit_note_id', creditNoteId)

  const allocIds = (invAllocs ?? []).map((a) => a.id)
  if (allocIds.length > 0) {
    await admin.from('invoice_credit_note_allocations').delete().in('invoice_allocation_id', allocIds)
    await admin.from('credit_note_invoice_allocations').delete().eq('credit_note_id', creditNoteId)
  }

  const { error: delErr } = await admin
    .from('invoice_credit_notes')
    .delete()
    .eq('id', creditNoteId)

  if (delErr) {
    return { ok: false, error: delErr.message ?? 'No se pudo eliminar la nota de crédito', status: 500 }
  }

  await repropagateItems(admin, affected)

  for (const invoiceId of invoiceIds) {
    await recalcInvoiceStatusAfterCreditChange(admin, invoiceId)
  }

  return { ok: true }
}

export type RemoveAllocationResult = DeleteCreditNoteResult

export async function removeCreditNoteInvoiceAllocation(
  _supabase: SupabaseClient,
  allocationId: string,
): Promise<RemoveAllocationResult> {
  let admin: ReturnType<typeof createServiceClient>
  try {
    admin = createServiceClient()
  } catch {
    return { ok: false, error: 'Configuración del servidor incompleta', status: 503 }
  }

  const { data: alloc } = await admin
    .from('credit_note_invoice_allocations')
    .select('id, credit_note_id, invoice_id, credit_note:invoice_credit_notes(status)')
    .eq('id', allocationId)
    .single()

  if (!alloc) return { ok: false, error: 'Asignación no encontrada', status: 404 }

  const affected = await loadAffectedItems(admin, alloc.credit_note_id as string, alloc.invoice_id as string)

  await admin.from('invoice_credit_note_allocations').delete().eq('invoice_allocation_id', allocationId)
  await admin.from('credit_note_invoice_allocations').delete().eq('id', allocationId)

  const { data: remaining } = await admin
    .from('credit_note_invoice_allocations')
    .select('id')
    .eq('credit_note_id', alloc.credit_note_id as string)

  if (!remaining || remaining.length === 0) {
    await admin.from('invoice_credit_notes').delete().eq('id', alloc.credit_note_id as string)
  } else {
    await recalcCreditNoteStatus(admin, alloc.credit_note_id as string)
  }

  await repropagateItems(admin, affected)
  await recalcInvoiceStatusAfterCreditChange(admin, alloc.invoice_id as string)

  return { ok: true }
}

export type UpdateAllocationsResult =
  | { ok: true; credit_note: Record<string, unknown> }
  | { ok: false; error: string; status: number }

export async function updateCreditNoteAllocations(
  _supabase: SupabaseClient,
  creditNoteId: string,
  invoice_allocations: CreditNoteInvoiceAllocationInput[],
): Promise<UpdateAllocationsResult> {
  let admin: ReturnType<typeof createServiceClient>
  try {
    admin = createServiceClient()
  } catch {
    return { ok: false, error: 'Configuración del servidor incompleta', status: 503 }
  }

  const { data: cn } = await admin
    .from('invoice_credit_notes')
    .select('id, status, amount, supplier_group_id, vat_rate')
    .eq('id', creditNoteId)
    .single()

  if (!cn) return { ok: false, error: 'Nota de crédito no encontrada', status: 404 }

  const allocSum = invoice_allocations.reduce((s, a) => s + Number(a.allocated_subtotal ?? 0), 0)
  if (Math.abs(allocSum - Number(cn.amount)) > 0.01) {
    return {
      ok: false,
      error: `La suma de asignaciones (${allocSum}) no coincide con el monto de la NC (${cn.amount})`,
      status: 400,
    }
  }

  const invoiceIds = invoice_allocations.map((a) => a.invoice_id)
  const { data: invoices } = await admin
    .from('supplier_invoices')
    .select(`
      id, supplier_group_id, invoice_number, subtotal, discount_amount, vat_rate, status,
      items:supplier_invoice_items(id, entry_id, amount, cost_category)
    `)
    .in('id', invoiceIds)

  if (!invoices || invoices.length !== invoiceIds.length) {
    return { ok: false, error: 'Una o más facturas no encontradas', status: 404 }
  }

  for (const inv of invoices) {
    if (inv.supplier_group_id !== cn.supplier_group_id) {
      return { ok: false, error: `Factura ${inv.invoice_number} no pertenece al mismo proveedor`, status: 400 }
    }
    if (inv.status === 'void') {
      return { ok: false, error: `Factura ${inv.invoice_number} está anulada`, status: 400 }
    }
  }

  const { data: oldAllocs } = await admin
    .from('credit_note_invoice_allocations')
    .select('id, invoice_id')
    .eq('credit_note_id', creditNoteId)

  const oldInvoiceIds = (oldAllocs ?? []).map((a) => a.invoice_id as string)
  const oldAllocIds = (oldAllocs ?? []).map((a) => a.id)

  const affectedBefore = await loadAffectedItems(admin, creditNoteId)

  if (oldAllocIds.length > 0) {
    await admin.from('invoice_credit_note_allocations').delete().in('invoice_allocation_id', oldAllocIds)
    await admin.from('credit_note_invoice_allocations').delete().eq('credit_note_id', creditNoteId)
  }

  for (const alloc of invoice_allocations) {
    const inv = invoices.find((i) => i.id === alloc.invoice_id)!
    const allocTax = Math.round(Number(alloc.allocated_subtotal) * Number(inv.vat_rate) * 100) / 100

    const { data: invAlloc, error: invAllocErr } = await admin
      .from('credit_note_invoice_allocations')
      .insert({
        credit_note_id: creditNoteId,
        invoice_id: alloc.invoice_id,
        allocated_subtotal: Number(alloc.allocated_subtotal),
        allocated_tax: allocTax,
      })
      .select('id')
      .single()

    if (invAllocErr || !invAlloc) continue

    const items = (inv.items ?? []).map((i: { id: string; amount: number }) => ({
      id: i.id,
      amount: Number(i.amount),
    }))

    const itemAllocs =
      (alloc.item_allocations?.length ?? 0) > 0
        ? alloc.item_allocations!
        : buildProportionalItemAllocations(items, Number(alloc.allocated_subtotal))

    if (itemAllocs.length > 0) {
      await admin.from('invoice_credit_note_allocations').insert(
        itemAllocs.map((a) => ({
          credit_note_id: creditNoteId,
          invoice_allocation_id: invAlloc.id,
          invoice_item_id: a.invoice_item_id,
          allocated_amount: a.allocated_amount,
        })),
      )
    }
  }

  const allAffectedIds = new Set([
    ...affectedBefore.map((i) => i.invoice_item_id),
    ...invoice_allocations.flatMap((a) => {
      const inv = invoices.find((i) => i.id === a.invoice_id)!
      return (inv.items ?? []).map((i: { id: string }) => i.id)
    }),
  ])

  const itemsToRepropagate: AffectedItem[] = []
  for (const inv of invoices) {
    for (const item of inv.items ?? []) {
      if (!allAffectedIds.has(item.id)) continue
      itemsToRepropagate.push({
        invoice_item_id: item.id,
        invoice_id: inv.id,
        item_amount: Number(item.amount),
        cost_category: item.cost_category,
        entry_id: item.entry_id,
      })
    }
  }
  for (const item of affectedBefore) {
    if (!itemsToRepropagate.some((i) => i.invoice_item_id === item.invoice_item_id)) {
      itemsToRepropagate.push(item)
    }
  }

  await repropagateItems(admin, itemsToRepropagate)

  const allInvoiceIds = [...new Set([...oldInvoiceIds, ...invoiceIds])]
  for (const invoiceId of allInvoiceIds) {
    await recalcInvoiceStatusAfterCreditChange(admin, invoiceId)
  }

  await recalcCreditNoteStatus(admin, creditNoteId)

  const { data: updated } = await admin
    .from('invoice_credit_notes')
    .select(`
      id, status, amount, credit_number, credit_date,
      invoice_allocations:credit_note_invoice_allocations(
        id, invoice_id, allocated_subtotal, allocated_tax, allocated_total,
        invoice:supplier_invoices!invoice_id(id, invoice_number, status),
        item_allocations:invoice_credit_note_allocations(
          id, invoice_item_id, allocated_amount,
          invoice_item:supplier_invoice_items!invoice_item_id(
            id, description, cost_category, entry_id,
            entry:material_entries!entry_id(id, entry_number)
          )
        )
      )
    `)
    .eq('id', creditNoteId)
    .single()

  return { ok: true, credit_note: updated ?? { id: creditNoteId } }
}
