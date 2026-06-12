'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import CreditNoteInvoiceAllocator from './CreditNoteInvoiceAllocator'
import type {
  CreditNoteAvailableInvoice,
  CreditNoteInvoiceAllocationInput,
} from '@/lib/ap/creditNoteAllocationTypes'
import { isAllocationBalanced } from '@/lib/ap/creditNoteAllocationTypes'

type CreditNoteHeader = {
  id: string
  credit_number: string | null
  amount: number
  supplier_group_id: string
  plant_id: string
  status: string
  invoice_allocations?: Array<{
    id: string
    invoice_id: string
    allocated_subtotal: number
    invoice?: { invoice_number: string } | null
    item_allocations?: Array<{ invoice_item_id: string; allocated_amount: number }>
  }>
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  creditNote: CreditNoteHeader | null
  onSuccess: () => void
}

export default function EditCreditNoteAllocationsDrawer({
  open, onOpenChange, creditNote, onSuccess,
}: Props) {
  const [invoices, setInvoices] = useState<CreditNoteAvailableInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [allocations, setAllocations] = useState<CreditNoteInvoiceAllocationInput[]>([])
  const [submitting, setSubmitting] = useState(false)

  const fetchInvoices = useCallback(async () => {
    if (!creditNote) return
    setLoadingInvoices(true)
    try {
      const url = `/api/ap/invoices?supplier_group_id=${creditNote.supplier_group_id}&plant_id=${creditNote.plant_id}&include_paid=true&limit=50`
      const res = await fetch(url)
      const data = await res.json()
      const list: CreditNoteAvailableInvoice[] = (data.invoices ?? [])
        .filter((inv: { status: string }) => inv.status !== 'void')
        .map((inv: {
          id: string
          invoice_number: string
          plant_id: string
          subtotal: number
          discount_amount: number
          credit_applied_subtotal: number
          status: string
          cfdi_uuid: string | null
          items?: Array<{
            id: string
            entry_id: string | null
            cost_category: string
            description: string | null
            amount: number
            entry?: { entry_number: string } | null
          }>
        }) => {
          const taxable = Number(inv.subtotal) - Number(inv.discount_amount ?? 0)
          const currentAlloc = creditNote.invoice_allocations?.find((a) => a.invoice_id === inv.id)
          const creditedOthers = Number(inv.credit_applied_subtotal ?? 0) - Number(currentAlloc?.allocated_subtotal ?? 0)
          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            plant_id: inv.plant_id,
            taxable_base: taxable,
            credit_applied_subtotal: creditedOthers,
            available: Math.max(0, taxable - creditedOthers),
            status: inv.status,
            cfdi_uuid: inv.cfdi_uuid,
            items: (inv.items ?? []).map((item) => ({
              id: item.id,
              entry_id: item.entry_id,
              cost_category: item.cost_category,
              description: item.description,
              amount: Number(item.amount),
              entry_number: item.entry?.entry_number ?? null,
            })),
          }
        })
      setInvoices(list)
    } finally {
      setLoadingInvoices(false)
    }
  }, [creditNote])

  useEffect(() => {
    if (!open || !creditNote) return
    setAllocations(
      (creditNote.invoice_allocations ?? []).map((a) => ({
        invoice_id: a.invoice_id,
        invoice_number: a.invoice?.invoice_number,
        allocated_subtotal: Number(a.allocated_subtotal),
        item_allocations: a.item_allocations?.map((ia) => ({
          invoice_item_id: ia.invoice_item_id,
          allocated_amount: Number(ia.allocated_amount),
        })),
      })),
    )
    void fetchInvoices()
  }, [open, creditNote, fetchInvoices])

  const canSubmit =
    creditNote &&
    creditNote.status !== 'void' &&
    allocations.length > 0 &&
    isAllocationBalanced(creditNote.amount, allocations) &&
    !submitting

  const handleSubmit = async () => {
    if (!creditNote || !canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ap/credit-notes/${creditNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_allocations: allocations }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al reasignar')
        return
      }
      toast.success('Asignación actualizada')
      onOpenChange(false)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-stone-200 shrink-0">
          <SheetTitle>Reasignar nota de crédito</SheetTitle>
          <SheetDescription className="text-xs">
            {creditNote?.credit_number ?? 'NC'} · Monto {creditNote?.amount.toFixed(2)} (sin IVA)
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loadingInvoices ? (
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando facturas…
            </div>
          ) : creditNote ? (
            <CreditNoteInvoiceAllocator
              amount={creditNote.amount}
              invoices={invoices}
              allocations={allocations}
              onChange={setAllocations}
            />
          ) : null}
        </div>

        <div className="shrink-0 border-t border-stone-200 px-6 py-4 flex justify-end gap-3 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="bg-sky-700 hover:bg-sky-800 text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Guardar asignación
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
