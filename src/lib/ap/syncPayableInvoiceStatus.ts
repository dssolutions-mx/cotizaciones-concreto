import type { SupabaseClient } from '@supabase/supabase-js'

/** After payments_recalc trigger updates payables.status, mirror to supplier_invoices. */
export async function syncInvoiceStatusFromPayable(
  supabase: SupabaseClient,
  payableId: string,
): Promise<void> {
  const { data: payable } = await supabase
    .from('payables')
    .select('invoice_id, status')
    .eq('id', payableId)
    .single()

  if (payable?.invoice_id && payable.status) {
    await supabase
      .from('supplier_invoices')
      .update({ status: payable.status })
      .eq('id', payable.invoice_id)
  }
}
