'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { AlertTriangle, Package, Plus, Trash2, Truck } from 'lucide-react'
import type { InvoiceManualReason, SupplierInvoice } from '@/types/finance'
import InvoiceRetentionsEditor, {
  retentionsFromApi,
  toRetentionPayload,
  type RetentionRowState,
} from '@/components/finanzas/InvoiceRetentionsEditor'
import { computeInvoiceTotals, MANUAL_REASON_LABELS } from '@/lib/ap/retentionRates'

type EditableItem = {
  key: string
  id?: string
  line_source: 'entry' | 'manual'
  manual_reason?: InvoiceManualReason
  cost_category: 'material' | 'fleet'
  description: string
  amount: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: SupplierInvoice | null
  onSuccess: () => void
}

export default function EditSupplierInvoiceDrawer({ open, onOpenChange, invoice, onSuccess }: Props) {
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [vatRate, setVatRate] = useState('0.16')
  const [items, setItems] = useState<EditableItem[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [retentionRows, setRetentionRows] = useState<RetentionRowState[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [paidToDate, setPaidToDate] = useState(0)
  const [creditApplied, setCreditApplied] = useState(0)
  const [invoiceMeta, setInvoiceMeta] = useState<SupplierInvoice | null>(null)

  useEffect(() => {
    if (!open || !invoice?.id) return
    setFetching(true)
    setDeletedIds([])
    fetch(`/api/ap/invoices/${invoice.id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.invoice) return
        const inv = data.invoice as SupplierInvoice
        setInvoiceMeta(inv)
        setDueDate(inv.due_date)
        setNotes(inv.notes ?? '')
        setDiscountAmount(String(inv.discount_amount ?? 0))
        setVatRate(String(inv.vat_rate))
        setPaidToDate(Number(data.invoice.paid_to_date ?? 0))
        setCreditApplied(0)
        if (inv.retentions?.length) {
          setRetentionRows(retentionsFromApi(inv.retentions))
        } else {
          setRetentionRows([])
        }
        setItems((inv.items ?? []).map(it => ({
          key: it.id,
          id: it.id,
          line_source: it.line_source ?? (it.entry_id ? 'entry' : 'manual'),
          manual_reason: it.manual_reason ?? undefined,
          cost_category: (it.cost_category ?? 'material') as 'material' | 'fleet',
          description: it.description ?? '',
          amount: String(it.amount),
        })))
      })
      .catch(() => toast.error('No se pudo cargar la factura'))
      .finally(() => setFetching(false))
  }, [open, invoice?.id])

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0),
    [items],
  )

  const discount = parseFloat(discountAmount) || 0
  const vat = parseFloat(vatRate) || 0
  const totals = useMemo(
    () => computeInvoiceTotals({
      subtotal,
      discount,
      vatRate: vat,
      retentions: toRetentionPayload(retentionRows),
    }),
    [subtotal, discount, vat, retentionRows],
  )

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const minTotal = paidToDate + creditApplied
  const canEdit = invoiceMeta && invoiceMeta.status !== 'paid' && invoiceMeta.status !== 'void'

  const addManualLine = (cost_category: 'material' | 'fleet') => {
    setItems(prev => [...prev, {
      key: crypto.randomUUID(),
      line_source: 'manual',
      manual_reason: cost_category === 'fleet' ? 'orphan_fleet' : 'period_gap',
      cost_category,
      description: '',
      amount: '',
    }])
  }

  const removeItem = (key: string) => {
    const row = items.find(i => i.key === key)
    if (!row) return
    if (row.line_source === 'entry') {
      const msg =
        '¿Quitar esta recepción de la factura? La entrada volverá a pendientes de facturar. ' +
        'Si es la única línea, se eliminará la factura completa en CxP.'
      if (!window.confirm(msg)) return
    }
    if (row.id) setDeletedIds(prev => [...prev, row.id!])
    setItems(prev => prev.filter(i => i.key !== key))
  }

  const deleteEntireInvoice = async () => {
    if (!invoiceMeta) return
    const msg =
      `¿Eliminar por completo la factura ${invoiceMeta.invoice_number}? ` +
      'Se quitarán todas las líneas y la recepción quedará disponible para facturar de nuevo. ' +
      'Solo es posible si no hay pagos ni notas de crédito aplicadas.'
    if (!window.confirm(msg)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/ap/invoices/${invoiceMeta.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo eliminar la factura')
        return
      }
      if (!data.invoice_deleted) {
        toast.error('La factura no se eliminó. Puede tener pagos, NC aplicadas o restricciones de permisos.')
        return
      }
      toast.success(`Factura ${invoiceMeta.invoice_number} eliminada`)
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!invoiceMeta || !canEdit) return
    if (!dueDate) { toast.error('Fecha de vencimiento requerida'); return }
    if (items.length === 0) { toast.error('Agrega al menos una línea'); return }
    if (items.some(it => !it.amount || parseFloat(it.amount) <= 0)) {
      toast.error('Todas las líneas deben tener monto positivo')
      return
    }
    if (items.some(it => it.line_source === 'manual' && !it.description.trim())) {
      toast.error('Las líneas manuales requieren descripción')
      return
    }
    if (totals.total < minTotal - 0.01) {
      toast.error(`El total no puede ser menor a lo ya pagado/acreditado (${mxn.format(minTotal)})`)
      return
    }

    const existingUpdates = items
      .filter(it => it.id)
      .map(it => ({ id: it.id!, amount: parseFloat(it.amount) }))

    const itemsToAdd = items
      .filter(it => !it.id)
      .map(it => ({
        entry_id: null,
        line_source: 'manual' as const,
        manual_reason: it.manual_reason ?? 'other',
        cost_category: it.cost_category,
        description: it.description.trim(),
        amount: parseFloat(it.amount),
      }))

    setLoading(true)
    try {
      const res = await fetch(`/api/ap/invoices/${invoiceMeta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          due_date: dueDate,
          notes: notes.trim() || null,
          vat_rate: vat,
          discount_amount: discount,
          retentions: toRetentionPayload(retentionRows).map((r, idx) => ({
            ...r,
            base_amount: r.base_amount ?? totals.taxableBase,
            sort_order: idx,
          })),
          items: existingUpdates,
          items_to_add: itemsToAdd,
          items_to_delete: deletedIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al guardar')
        return
      }
      if (data.invoice_deleted) {
        toast.success(`Factura ${invoiceMeta.invoice_number} eliminada (sin líneas restantes)`)
        onOpenChange(false)
        onSuccess()
        return
      }
      toast.success(`Factura ${invoiceMeta.invoice_number} actualizada`)
      onOpenChange(false)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar factura</SheetTitle>
          <SheetDescription>
            Ajusta montos, retenciones, líneas manuales o vencimiento cuando la factura no coincide con el CFDI.
          </SheetDescription>
        </SheetHeader>

        {fetching ? (
          <p className="mt-6 text-sm text-stone-500">Cargando…</p>
        ) : !invoiceMeta ? null : !canEdit ? (
          <p className="mt-6 text-sm text-stone-500">
            Esta factura no se puede editar porque está {invoiceMeta.status === 'paid' ? 'pagada' : 'anulada'}.
          </p>
        ) : (
          <div className="mt-6 space-y-5 pb-8">
            <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
              <div className="font-mono font-semibold">{invoiceMeta.invoice_number}</div>
              <div className="text-xs text-stone-500 mt-0.5">
                {invoiceMeta.supplier_group?.name ?? 'Proveedor'}
              </div>
            </div>

            {(paidToDate > 0 || creditApplied > 0) && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Pagado: {mxn.format(paidToDate)}
                  {creditApplied > 0 ? ` · NC aplicada: ${mxn.format(creditApplied)}` : ''}.
                  El total ajustado no puede quedar por debajo de {mxn.format(minTotal)}.
                </span>
              </div>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Datos generales</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Vencimiento</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">IVA (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(Math.round(vat * 10000) / 100)}
                    onChange={e => setVatRate(String((parseFloat(e.target.value) || 0) / 100))}
                    className="bg-white"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notas</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} className="bg-white" placeholder="Observaciones…" />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Descuentos y retenciones</h3>
              <div className="space-y-1">
                <Label className="text-xs">Descuento (pre-IVA)</Label>
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={e => setDiscountAmount(e.target.value)}
                  className="bg-white"
                  placeholder="0.00"
                />
              </div>
              <InvoiceRetentionsEditor
                rows={retentionRows}
                onChange={setRetentionRows}
                taxableBase={totals.taxableBase}
              />
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-900">Líneas de factura</h3>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => addManualLine('material')}>
                    + Material
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => addManualLine('fleet')}>
                    + Flete
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {items.map(it => (
                  <div key={it.key} className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 space-y-2">
                    <div className="flex items-center gap-2">
                      {it.cost_category === 'fleet'
                        ? <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        : <Package className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                      {it.line_source === 'manual' ? (
                        <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800 shrink-0">Sin entrada</span>
                      ) : (
                        <span className="text-[10px] px-1 rounded bg-sky-100 text-sky-800 shrink-0">Recepción</span>
                      )}
                      {it.line_source === 'manual' ? (
                        <Input
                          value={it.description}
                          onChange={e => setItems(prev => prev.map(row => row.key === it.key ? { ...row, description: e.target.value } : row))}
                          className="flex-1 h-7 text-xs bg-white"
                          placeholder="Descripción"
                        />
                      ) : (
                        <span className="flex-1 text-xs text-stone-700 truncate">{it.description || '—'}</span>
                      )}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.amount}
                        onChange={e => setItems(prev => prev.map(row => row.key === it.key ? { ...row, amount: e.target.value } : row))}
                        className="w-28 h-7 text-xs bg-white tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        className="text-stone-400 hover:text-red-600 shrink-0"
                        title={it.line_source === 'entry' ? 'Quitar recepción de esta factura' : 'Eliminar línea manual'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {it.line_source === 'manual' && (
                      <Select
                        value={it.manual_reason ?? 'other'}
                        onValueChange={v => setItems(prev => prev.map(row => row.key === it.key ? { ...row, manual_reason: v as InvoiceManualReason } : row))}
                      >
                        <SelectTrigger className="h-7 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(MANUAL_REASON_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="bg-stone-50 rounded-md p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-600">Subtotal</span>
                <span className="tabular-nums">{mxn.format(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>− Descuento</span>
                  <span className="tabular-nums">−{mxn.format(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-600">+ IVA ({Math.round(vat * 100)}%)</span>
                <span className="tabular-nums">{mxn.format(totals.tax)}</span>
              </div>
              {retentionRows.map(r => Number(r.amount) > 0 && (
                <div key={r.key} className="flex justify-between text-rose-700">
                  <span>− {r.label}</span>
                  <span className="tabular-nums">−{mxn.format(Number(r.amount))}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t border-stone-200 pt-2">
                <span>Total a pagar</span>
                <span className="tabular-nums">{mxn.format(totals.total)}</span>
              </div>
            </div>

            <Button
              className="w-full bg-stone-800 hover:bg-stone-900 text-white"
              onClick={() => void handleSubmit()}
              disabled={loading}
            >
              {loading ? 'Guardando…' : 'Guardar ajustes'}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full border-red-200 text-red-800 hover:bg-red-50"
              onClick={() => void deleteEntireInvoice()}
              disabled={loading}
            >
              Eliminar factura completa
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
