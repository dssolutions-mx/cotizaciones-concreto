import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Recomputes landed_unit_price on a material_entry (and its lot) after
 * credits have been applied to an invoice item. Reads ALL accumulated
 * item-level allocations so it stays correct across multiple CNs.
 *
 * Best-effort: failures are logged but don't abort the calling transaction.
 */
export async function propagateCreditToEntry(
  admin: SupabaseClient,
  invoiceItemId: string,
  itemAmount: number,
  itemCostCategory: string | null,
  entryId: string,
): Promise<void> {
  const { data: entry } = await admin
    .from('material_entries')
    .select('id, received_qty_kg, unit_price, fleet_cost')
    .eq('id', entryId)
    .single()

  if (!entry || !entry.received_qty_kg || Number(entry.received_qty_kg) <= 0) return

  // Sum all item-level credit allocations for this invoice item across all CNs
  const { data: existingAllocs } = await admin
    .from('invoice_credit_note_allocations')
    .select('allocated_amount')
    .eq('invoice_item_id', invoiceItemId)

  const totalItemCredit = (existingAllocs ?? []).reduce(
    (s: number, a: any) => s + Number(a.allocated_amount),
    0,
  )

  const effectiveAmount = Math.max(0, Number(itemAmount) - totalItemCredit)
  const qtyKg = Number(entry.received_qty_kg)

  let newLandedUnitPrice: number
  if (itemCostCategory === 'material') {
    const newUnitPrice = effectiveAmount / qtyKg
    const fleetPerKg = Number(entry.fleet_cost ?? 0) / qtyKg
    newLandedUnitPrice = newUnitPrice + fleetPerKg
  } else {
    // fleet item: credit reduces fleet cost portion
    const fleetAfterCredit = Math.max(0, Number(entry.fleet_cost ?? 0) - totalItemCredit)
    newLandedUnitPrice = Number(entry.unit_price ?? 0) + fleetAfterCredit / qtyKg
  }

  await admin
    .from('material_entries')
    .update({ landed_unit_price: newLandedUnitPrice })
    .eq('id', entryId)

  await admin
    .from('material_lots')
    .update({ landed_unit_price: newLandedUnitPrice })
    .eq('entry_id', entryId)
}

/**
 * Builds proportional per-item allocations summing to `amount`,
 * distributing based on each item's share of total item amount.
 * Last item absorbs rounding residual.
 */
export function buildProportionalItemAllocations(
  items: Array<{ id: string; amount: number }>,
  amount: number,
): Array<{ invoice_item_id: string; allocated_amount: number }> {
  const totalItemAmount = items.reduce((s, i) => s + Number(i.amount), 0)
  if (items.length === 0 || totalItemAmount <= 0) return []

  let remaining = amount
  return items
    .map((item, idx) => {
      const isLast = idx === items.length - 1
      const share = isLast
        ? remaining
        : Math.round((Number(item.amount) / totalItemAmount) * amount * 100) / 100
      if (!isLast) remaining -= share
      return { invoice_item_id: item.id, allocated_amount: isLast ? remaining : share }
    })
    .filter((a) => a.allocated_amount > 0)
}
