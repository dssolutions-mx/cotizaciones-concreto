import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreditNoteAvailableInvoice } from '@/lib/ap/creditNoteAllocationTypes'

export async function loadAvailableInvoicesForCreditNote(
  supabase: SupabaseClient,
  supplierGroupId: string,
  plantId?: string | null,
  limit = 50,
): Promise<CreditNoteAvailableInvoice[]> {
  let q = supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_number, status, plant_id, cfdi_uuid,
      subtotal, discount_amount,
      cn_allocations:credit_note_invoice_allocations(allocated_subtotal),
      items:supplier_invoice_items(
        id, entry_id, cost_category, description, amount,
        entry:material_entries!entry_id(id, entry_number)
      )
    `)
    .eq('supplier_group_id', supplierGroupId)
    .in('status', ['open', 'partially_paid'])
    .order('invoice_date', { ascending: false })
    .limit(limit)

  if (plantId) q = q.eq('plant_id', plantId)

  const { data } = await q

  return (data ?? []).map((inv) => {
    const taxable = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
    const credited = (inv.cn_allocations ?? []).reduce(
      (s: number, a: { allocated_subtotal: number }) => s + Number(a.allocated_subtotal ?? 0),
      0,
    )
    return {
      id: inv.id as string,
      invoice_number: inv.invoice_number as string,
      plant_id: inv.plant_id as string,
      taxable_base: taxable,
      credit_applied_subtotal: credited,
      available: Math.max(0, taxable - credited),
      status: inv.status as string,
      cfdi_uuid: inv.cfdi_uuid as string | null,
      items: (inv.items ?? []).map((item: {
        id: string
        entry_id: string | null
        cost_category: string
        description: string | null
        amount: number
        entry?: { entry_number: string } | null
      }) => ({
        id: item.id,
        entry_id: item.entry_id,
        cost_category: item.cost_category,
        description: item.description,
        amount: Number(item.amount),
        entry_number: item.entry?.entry_number ?? null,
      })),
    }
  })
}
