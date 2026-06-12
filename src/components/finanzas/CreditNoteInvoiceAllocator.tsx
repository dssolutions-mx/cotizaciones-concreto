'use client'

import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight, Package, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  CreditNoteAvailableInvoice,
  CreditNoteInvoiceAllocationInput,
} from '@/lib/ap/creditNoteAllocationTypes'
import {
  distributeProportionalInvoiceAllocations,
  isAllocationBalanced,
  sumInvoiceAllocations,
} from '@/lib/ap/creditNoteAllocationTypes'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type Props = {
  amount: number
  invoices: CreditNoteAvailableInvoice[]
  allocations: CreditNoteInvoiceAllocationInput[]
  onChange: (next: CreditNoteInvoiceAllocationInput[]) => void
  compact?: boolean
}

export default function CreditNoteInvoiceAllocator({
  amount, invoices, allocations, onChange, compact = false,
}: Props) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [itemAllocs, setItemAllocs] = useState<Record<string, Record<string, string>>>(() => {
    const init: Record<string, Record<string, string>> = {}
    for (const a of allocations) {
      if (a.item_allocations?.length) {
        init[a.invoice_id] = Object.fromEntries(
          a.item_allocations.map((ia) => [ia.invoice_item_id, String(ia.allocated_amount)]),
        )
      }
    }
    return init
  })

  const selectedIds = useMemo(
    () => new Set(allocations.map((a) => a.invoice_id)),
    [allocations],
  )

  const allocatedMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of allocations) {
      m.set(a.invoice_id, String(a.allocated_subtotal))
    }
    return m
  }, [allocations])

  const syncItemAllocsToParent = (
    invoiceId: string,
    subtotal: number,
    items: Record<string, string>,
  ) => {
    const item_allocations = Object.entries(items)
      .filter(([, v]) => Number(v) > 0)
      .map(([invoice_item_id, v]) => ({
        invoice_item_id,
        allocated_amount: Number(v),
      }))
    const itemSum = item_allocations.reduce((s, a) => s + a.allocated_amount, 0)
    if (item_allocations.length > 0 && Math.abs(itemSum - subtotal) > 0.01) return

    onChange(
      allocations.map((a) =>
        a.invoice_id === invoiceId
          ? {
              ...a,
              allocated_subtotal: subtotal,
              ...(item_allocations.length > 0 ? { item_allocations } : {}),
            }
          : a,
      ),
    )
  }

  const toggleInvoice = (inv: CreditNoteAvailableInvoice) => {
    if (selectedIds.has(inv.id)) {
      onChange(allocations.filter((a) => a.invoice_id !== inv.id))
      setItemAllocs((prev) => {
        const next = { ...prev }
        delete next[inv.id]
        return next
      })
      return
    }
    onChange([
      ...allocations,
      {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        allocated_subtotal: 0,
      },
    ])
  }

  const setAllocAmount = (invoiceId: string, val: string, inv: CreditNoteAvailableInvoice) => {
    const num = parseFloat(val) || 0
    const items = itemAllocs[invoiceId]
    onChange(
      allocations.map((a) =>
        a.invoice_id === invoiceId
          ? {
              ...a,
              allocated_subtotal: num,
              ...(items && Object.values(items).some((v) => Number(v) > 0)
                ? {
                    item_allocations: Object.entries(items)
                      .filter(([, v]) => Number(v) > 0)
                      .map(([invoice_item_id, v]) => ({
                        invoice_item_id,
                        allocated_amount: Number(v),
                      })),
                  }
                : {}),
            }
          : a,
      ),
    )
    if (items) syncItemAllocsToParent(invoiceId, num, items)
    void inv
  }

  const setItemAlloc = (invoiceId: string, itemId: string, val: string) => {
    const nextItems = { ...(itemAllocs[invoiceId] ?? {}), [itemId]: val }
    setItemAllocs((prev) => ({ ...prev, [invoiceId]: nextItems }))
    const alloc = allocations.find((a) => a.invoice_id === invoiceId)
    if (alloc) syncItemAllocsToParent(invoiceId, alloc.allocated_subtotal, nextItems)
  }

  const distributeProportionally = () => {
    const sel = invoices.filter((inv) => selectedIds.has(inv.id))
    if (sel.length === 0 || amount <= 0) return
    const next = distributeProportionalInvoiceAllocations(
      sel.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        available: inv.available,
      })),
      amount,
    )
    onChange(next)
    setItemAllocs({})
  }

  const allocatedSum = sumInvoiceAllocations(allocations)
  const remaining = amount - allocatedSum
  const balanced = isAllocationBalanced(amount, allocations)

  if (invoices.length === 0) {
    return <p className="text-xs text-stone-500">No hay facturas abiertas para este proveedor.</p>
  }

  return (
    <div className={cn('space-y-2', compact ? 'text-xs' : '')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-stone-700">Facturas a aplicar</p>
        {selectedIds.size > 0 && amount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            type="button"
            onClick={distributeProportionally}
          >
            Distribuir proporcionalmente
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {invoices.map((inv) => {
          const isSelected = selectedIds.has(inv.id)
          const allocVal = parseFloat(allocatedMap.get(inv.id) ?? '0') || 0
          const overAlloc = allocVal > inv.available + 0.01

          return (
            <div
              key={inv.id}
              className={cn(
                'rounded-md border p-2.5 space-y-2',
                isSelected ? 'border-sky-300 bg-sky-50/40' : 'border-stone-200 bg-stone-50/30',
              )}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleInvoice(inv)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-stone-800">{inv.invoice_number}</span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-medium',
                      inv.status === 'open' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700',
                    )}>
                      {inv.status === 'open' ? 'Abierta' : 'Pago parcial'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-0.5 text-[10px] text-stone-500">
                    <span>Base: {mxn.format(inv.taxable_base)}</span>
                    {inv.credit_applied_subtotal > 0 && (
                      <span className="text-amber-600">Ya NC: {mxn.format(inv.credit_applied_subtotal)}</span>
                    )}
                    <span className="font-medium text-stone-700">Disp: {mxn.format(inv.available)}</span>
                  </div>
                </div>
                {isSelected && (
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    max={inv.available}
                    value={allocatedMap.get(inv.id) ?? ''}
                    onChange={(e) => setAllocAmount(inv.id, e.target.value, inv)}
                    className={cn('w-28 h-7 text-xs text-right', overAlloc && 'border-red-400')}
                    placeholder="0.00"
                  />
                )}
              </div>

              {isSelected && inv.items.length > 0 && allocVal > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedItems((prev) => {
                      const next = new Set(prev)
                      if (next.has(inv.id)) next.delete(inv.id)
                      else next.add(inv.id)
                      return next
                    })}
                    className="flex items-center gap-1 text-[10px] text-stone-500 hover:text-stone-700"
                  >
                    {expandedItems.has(inv.id)
                      ? <ChevronDown className="h-3 w-3" />
                      : <ChevronRight className="h-3 w-3" />}
                    Por línea / entrada ({inv.items.length})
                  </button>
                  {expandedItems.has(inv.id) && (
                    <div className="mt-1.5 space-y-1 pl-2">
                      {inv.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            {item.cost_category === 'fleet'
                              ? <Truck className="h-3 w-3 text-blue-500 shrink-0" />
                              : <Package className="h-3 w-3 text-emerald-600 shrink-0" />}
                            <span className="text-[10px] truncate text-stone-600">
                              {item.description ?? item.cost_category}
                              {item.entry_number && (
                                <span className="ml-1 font-mono text-stone-400">{item.entry_number}</span>
                              )}
                            </span>
                            <span className="text-[10px] text-stone-400 ml-auto shrink-0">
                              {mxn.format(item.amount)}
                            </span>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={itemAllocs[inv.id]?.[item.id] ?? ''}
                            onChange={(e) => setItemAlloc(inv.id, item.id, e.target.value)}
                            className="w-24 h-6 text-[10px] text-right"
                            placeholder="0.00"
                          />
                        </div>
                      ))}
                      {(() => {
                        const itemSum = Object.values(itemAllocs[inv.id] ?? {}).reduce(
                          (s, v) => s + (Number(v) || 0),
                          0,
                        )
                        const diff = Math.abs(itemSum - allocVal)
                        return diff > 0.01 ? (
                          <p className="text-[10px] text-red-600 pl-4">
                            Líneas: {mxn.format(itemSum)} ≠ {mxn.format(allocVal)}
                          </p>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedIds.size > 0 && amount > 0 && (
        <div className={cn(
          'flex justify-between text-xs font-medium px-1',
          balanced ? 'text-emerald-700' : 'text-red-600',
        )}>
          <span>Asignado: {mxn.format(allocatedSum)}</span>
          <span>Restante: {mxn.format(remaining)}</span>
        </div>
      )}
    </div>
  )
}
