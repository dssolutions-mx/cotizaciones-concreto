'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { AlertTriangle, Package, Truck } from 'lucide-react'
import type { SupplierInvoice } from '@/types/finance'
import RetentionRateSelect, { useRetentionRateState } from '@/components/finanzas/RetentionRateSelect'
import {
  ISR_RETENTION_PRESETS,
  IVA_RETENTION_PRESETS,
  computeInvoiceTotals,
} from '@/lib/ap/retentionRates'

type EditableItem = {
  id: string
  cost_category: 'material' | 'fleet'
  description: string | null
  amount: string
}

type InvoiceForEdit = SupplierInvoice & {
  items?: Array<{
    id: string
    cost_category: 'material' | 'fleet'
    description: string | null
    amount: number
  }>
  paid_to_date?: number
  credit_applied_total?: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: InvoiceForEdit | null
  onSuccess: () => void
}

export default function EditSupplierInvoiceDrawer({ open, onOpenChange, invoice, onSuccess }: Props) {
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [vatRate, setVatRate] = useState('0.16')
  const [items, setItems] = useState<EditableItem[]>([])
  const [loading, setLoading] = useState(false)

  const isrRetention = useRetentionRateState(0, ISR_RETENTION_PRESETS)
  const ivaRetention = useRetentionRateState(0, IVA_RETENTION_PRESETS)

  useEffect(() => {
    if (!open || !invoice) return
    setDueDate(invoice.due_date)
    setNotes(invoice.notes ?? '')
    setDiscountAmount(String(invoice.discount_amount ?? 0))
    setVatRate(String(invoice.vat_rate))
    isrRetention.reset(Number(invoice.retention_isr_rate ?? 0))
    ivaRetention.reset(Number(invoice.retention_iva_rate ?? 0))
    setItems((invoice.items ?? []).map(it => ({
      id: it.id,
      cost_category: it.cost_category,
      description: it.description,
      amount: String(it.amount),
    })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id])

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0),
    [items],
  )

  const discount = parseFloat(discountAmount) || 0
  const vat = parseFloat(vatRate) || 0
  const totals = useMemo(() => computeInvoiceTotals({
    subtotal,
    discount,
    vatRate: vat,
    isrRate: isrRetention.rate,
    ivaRetRate: ivaRetention.rate,
  }), [subtotal, discount, vat, isrRetention.rate, ivaRetention.rate])

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const paidToDate = Number(invoice?.paid_to_date ?? 0)
  const creditApplied = Number(invoice?.credit_applied_total ?? 0)
  const minTotal = paidToDate + creditApplied

  const canEdit = invoice && invoice.status !== 'paid' && invoice.status !== 'void'

  const handleSubmit = async () => {
    if (!invoice || !canEdit) return
    if (!dueDate) { toast.error('Fecha de vencimiento requerida'); return }
    if (items.some(it => !it.amount || parseFloat(it.amount) <= 0)) {
      toast.error('Todas las líneas deben tener monto positivo')
      return
    }
    if (totals.total < minTotal - 0.01) {
      toast.error(`El total no puede ser menor a lo ya pagado/acreditado (${mxn.format(minTotal)})`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/ap/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          due_date: dueDate,
          notes: notes.trim() || null,
          vat_rate: vat,
          subtotal,
          discount_amount: discount,
          retention_isr_rate: isrRetention.rate,
          retention_iva_rate: ivaRetention.rate,
          items: items.map(it => ({
            id: it.id,
            amount: parseFloat(it.amount),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al guardar')
        return
      }
      toast.success(`Factura ${invoice.invoice_number} actualizada`)
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
            Ajusta montos, retenciones o vencimiento cuando la factura no coincide con el CFDI o la recepción.
          </SheetDescription>
        </SheetHeader>

        {!invoice ? null : !canEdit ? (
          <p className="mt-6 text-sm text-stone-500">
            Esta factura no se puede editar porque está {invoice.status === 'paid' ? 'pagada' : 'anulada'}.
          </p>
        ) : (
          <div className="mt-6 space-y-5 pb-8">
            <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
              <div className="font-mono font-semibold">{invoice.invoice_number}</div>
              <div className="text-xs text-stone-500 mt-0.5">
                {invoice.supplier_group?.name ?? 'Proveedor'}
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
              <div className="grid grid-cols-3 gap-3">
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
                <RetentionRateSelect
                  label="Retención ISR"
                  presets={ISR_RETENTION_PRESETS}
                  presetOptions={[
                    { value: '0', label: '0% (ninguna)' },
                    { value: '0.0125', label: '1.25% — fletes / RIF' },
                    { value: '0.10', label: '10% — honorarios PF' },
                  ]}
                  selectValue={isrRetention.selectValue}
                  customDraft={isrRetention.customDraft}
                  editingCustom={isrRetention.editingCustom}
                  onSelectValueChange={isrRetention.setSelectValue}
                  onCustomDraftChange={isrRetention.setCustomDraft}
                  onEditingCustomChange={isrRetention.setEditingCustom}
                />
                <RetentionRateSelect
                  label="Retención IVA"
                  presets={IVA_RETENTION_PRESETS}
                  presetOptions={[
                    { value: '0', label: '0% (ninguna)' },
                    { value: '0.04', label: '4% — autotransporte' },
                    { value: '0.106667', label: '10.67% — servicios 2/3' },
                  ]}
                  selectValue={ivaRetention.selectValue}
                  customDraft={ivaRetention.customDraft}
                  editingCustom={ivaRetention.editingCustom}
                  onSelectValueChange={ivaRetention.setSelectValue}
                  onCustomDraftChange={ivaRetention.setCustomDraft}
                  onEditingCustomChange={ivaRetention.setEditingCustom}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Líneas de factura</h3>
              <div className="space-y-2">
                {items.map(it => (
                  <div key={it.id} className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                    {it.cost_category === 'fleet'
                      ? <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      : <Package className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                    <span className="flex-1 text-xs text-stone-700 truncate">{it.description || '—'}</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.amount}
                      onChange={e => setItems(prev => prev.map(row => row.id === it.id ? { ...row, amount: e.target.value } : row))}
                      className="w-28 h-7 text-xs bg-white tabular-nums"
                    />
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
              {totals.isrAmt > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>− Ret. ISR ({(isrRetention.rate * 100).toFixed(2)}%)</span>
                  <span className="tabular-nums">−{mxn.format(totals.isrAmt)}</span>
                </div>
              )}
              {totals.ivaRetAmt > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>− Ret. IVA ({(ivaRetention.rate * 100).toFixed(2)}% s/base)</span>
                  <span className="tabular-nums">−{mxn.format(totals.ivaRetAmt)}</span>
                </div>
              )}
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
