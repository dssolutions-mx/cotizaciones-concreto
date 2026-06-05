'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileText, Loader2, Trash2, Truck, Package } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type InvoiceLink = {
  id: string
  cost_category: string | null
  amount: number
  line_source: string | null
  invoice: {
    id: string
    invoice_number: string
    invoice_date: string
    status: string
    total: number
    plant_id: string
    supplier_group?: { id: string; name: string } | null
  } | null
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierta',
  partially_paid: 'Pago parcial',
  paid: 'Pagada',
  void: 'Anulada',
}

interface Props {
  entryId: string
  className?: string
  onUnlinked?: () => void
}

export default function EntrySupplierInvoiceLinks({ entryId, className, onUnlinked }: Props) {
  const [links, setLinks] = useState<InvoiceLink[]>([])
  const [loading, setLoading] = useState(true)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  const mxn = React.useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }),
    [],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/entries/${entryId}/supplier-invoice-links`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status !== 403) toast.error(data.error ?? 'No se pudieron cargar facturas vinculadas')
        setLinks([])
        return
      }
      setLinks(data.links ?? [])
    } catch {
      toast.error('Error de red al cargar facturas vinculadas')
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [entryId])

  useEffect(() => {
    void load()
  }, [load])

  const unlink = async (itemId: string, invoiceNumber: string) => {
    const msg =
      `¿Quitar esta recepción de la factura ${invoiceNumber}? ` +
      'La entrada volverá a aparecer como pendiente de facturar si aplica. ' +
      'Si era la única línea, se eliminará la factura en CxP.'
    if (!window.confirm(msg)) return

    setUnlinkingId(itemId)
    try {
      const res = await fetch(
        `/api/inventory/entries/${entryId}/supplier-invoice-links?item_id=${encodeURIComponent(itemId)}`,
        { method: 'DELETE' },
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo quitar el vínculo')
        return
      }
      const deletedInv = data.results?.some((r: { invoice_deleted: boolean }) => r.invoice_deleted)
      toast.success(
        deletedInv
          ? `Factura ${invoiceNumber} eliminada; la entrada quedó sin facturar en CxP`
          : `Recepción desvinculada de ${invoiceNumber}`,
      )
      onUnlinked?.()
      await load()
    } finally {
      setUnlinkingId(null)
    }
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-stone-500 py-2', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Facturas CxP…
      </div>
    )
  }

  if (links.length === 0) return null

  return (
    <div className={cn('rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2.5 space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs font-semibold text-sky-950">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        Facturas de proveedor (CxP)
      </div>
      <p className="text-[11px] text-sky-900/85 leading-snug">
        Si esta recepción se asignó a la factura equivocada, puede quitar el vínculo sin borrar la entrada de inventario.
      </p>
      <ul className="space-y-1.5">
        {links.map(link => {
          const inv = link.invoice
          if (!inv) return null
          const canUnlink = inv.status === 'open' || inv.status === 'partially_paid'
          const cat = link.cost_category === 'fleet' ? 'flete' : 'material'
          return (
            <li
              key={link.id}
              className="flex flex-wrap items-center gap-2 text-xs bg-white rounded border border-sky-100 px-2 py-1.5"
            >
              {link.cost_category === 'fleet' ? (
                <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              ) : (
                <Package className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              )}
              <span className="font-mono text-stone-800">{inv.invoice_number}</span>
              <span className="text-stone-500">({cat})</span>
              <span className="text-stone-500 truncate max-w-[120px]">
                {inv.supplier_group?.name ?? '—'}
              </span>
              <span className="tabular-nums text-stone-700">{mxn.format(Number(link.amount))}</span>
              <span className="text-[10px] px-1 rounded bg-stone-100 text-stone-600">
                {STATUS_LABEL[inv.status] ?? inv.status}
              </span>
              <Link
                href={`/finanzas/procurement?tab=cxp&cxp_tab=facturas`}
                className="text-sky-700 hover:underline text-[11px]"
              >
                Ver en CxP
              </Link>
              {canUnlink ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-red-700 hover:text-red-800 hover:bg-red-50 ml-auto"
                  disabled={unlinkingId === link.id}
                  onClick={() => void unlink(link.id, inv.invoice_number)}
                >
                  {unlinkingId === link.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3 mr-0.5" />
                      Quitar vínculo
                    </>
                  )}
                </Button>
              ) : (
                <span className="text-[10px] text-stone-400 ml-auto">No editable</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
