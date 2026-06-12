export type CreditNoteItemAllocation = {
  invoice_item_id: string
  allocated_amount: number
}

export type CreditNoteInvoiceAllocationInput = {
  invoice_id: string
  invoice_number?: string
  allocated_subtotal: number
  item_allocations?: CreditNoteItemAllocation[]
}

export type CreditNoteAvailableInvoiceItem = {
  id: string
  entry_id: string | null
  cost_category: 'material' | 'fleet' | string
  description: string | null
  amount: number
  entry_number: string | null
}

export type CreditNoteAvailableInvoice = {
  id: string
  invoice_number: string
  plant_id: string
  taxable_base: number
  credit_applied_subtotal: number
  available: number
  status: string
  cfdi_uuid: string | null
  items: CreditNoteAvailableInvoiceItem[]
}

export function sumInvoiceAllocations(
  allocations: Array<{ allocated_subtotal: number }>,
): number {
  return allocations.reduce((s, a) => s + Number(a.allocated_subtotal ?? 0), 0)
}

export function isAllocationBalanced(amount: number, allocations: Array<{ allocated_subtotal: number }>): boolean {
  return Math.abs(sumInvoiceAllocations(allocations) - amount) <= 0.01
}

export function distributeProportionalInvoiceAllocations(
  invoices: Array<{ id: string; invoice_number: string; available: number }>,
  total: number,
): CreditNoteInvoiceAllocationInput[] {
  if (invoices.length === 0) return []
  const sumAvailable = invoices.reduce((s, inv) => s + inv.available, 0)
  const next: CreditNoteInvoiceAllocationInput[] = []
  let remaining = total
  invoices.forEach((inv, idx) => {
    const isLast = idx === invoices.length - 1
    const share = isLast
      ? Math.round(remaining * 100) / 100
      : Math.round((inv.available / (sumAvailable || 1)) * total * 100) / 100
    if (!isLast) remaining -= share
    next.push({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      allocated_subtotal: share,
    })
  })
  return next
}
