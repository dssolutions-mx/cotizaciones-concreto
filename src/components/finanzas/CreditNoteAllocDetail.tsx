'use client'

import React from 'react'
import { FileText, Package, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export type CreditNoteItemAllocDetail = {
  id: string
  invoice_item_id: string
  allocated_amount: number
  invoice_item?: {
    id: string
    description: string | null
    cost_category: string | null
    entry_id: string | null
    entry?: { id: string; entry_number: string | null } | null
  } | null
}

export type CreditNoteInvoiceAllocDetail = {
  id: string
  invoice_id: string
  allocated_subtotal: number
  allocated_tax?: number
  allocated_total?: number | null
  invoice?: {
    id: string
    invoice_number: string
    status?: string
  } | null
  item_allocations?: CreditNoteItemAllocDetail[]
}

type Props = {
  allocations: CreditNoteInvoiceAllocDetail[]
  className?: string
  showActions?: boolean
  onRemoveAllocation?: (allocationId: string) => void
  onReassign?: () => void
  onDelete?: () => void
  adminActions?: boolean
}

export default function CreditNoteAllocDetail({
  allocations,
  className,
  showActions = false,
  onRemoveAllocation,
  onReassign,
  onDelete,
  adminActions = false,
}: Props) {
  if (allocations.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin facturas vinculadas.</p>
  }

  return (
    <div className={cn('space-y-2', className)}>
      {allocations.map((alloc) => {
        const items = alloc.item_allocations ?? []
        const displayTotal = Number(alloc.allocated_total ?? alloc.allocated_subtotal)

        return (
          <div
            key={alloc.id}
            className="rounded border border-stone-100 bg-white overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-stone-50/80">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                <span className="font-mono text-xs font-semibold text-stone-800">
                  {alloc.invoice?.invoice_number ?? alloc.invoice_id.slice(0, 8)}
                </span>
                {alloc.invoice?.status && (
                  <span className="text-[10px] text-stone-400">({alloc.invoice.status})</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="tabular-nums text-xs font-medium text-emerald-700">
                  −{mxn.format(displayTotal)}
                </span>
                {showActions && adminActions && allocations.length > 1 && onRemoveAllocation && (
                  <button
                    type="button"
                    className="text-[10px] text-red-600 hover:underline"
                    onClick={() => onRemoveAllocation(alloc.id)}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            {items.length > 0 && (
              <div className="px-3 py-2 space-y-1 border-t border-stone-100">
                {items.map((item) => {
                  const line = item.invoice_item
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-[10px]">
                      {line?.cost_category === 'fleet'
                        ? <Truck className="h-3 w-3 text-blue-500 shrink-0" />
                        : <Package className="h-3 w-3 text-emerald-600 shrink-0" />}
                      <span className="flex-1 truncate text-stone-600">
                        {line?.description ?? 'Línea'}
                        {line?.entry?.entry_number && (
                          <span className="ml-1 font-mono text-stone-400">{line.entry.entry_number}</span>
                        )}
                      </span>
                      <span className="tabular-nums text-emerald-700 font-medium">
                        −{mxn.format(Number(item.allocated_amount))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {showActions && adminActions && (onReassign || onDelete) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {onReassign && (
            <button
              type="button"
              className="text-xs text-sky-700 hover:underline"
              onClick={onReassign}
            >
              Reasignar facturas
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="text-xs text-red-600 hover:underline"
              onClick={onDelete}
            >
              Eliminar nota de crédito
            </button>
          )}
        </div>
      )}
    </div>
  )
}
