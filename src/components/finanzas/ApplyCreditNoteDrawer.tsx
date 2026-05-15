'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight, Loader2, Package, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { SupplierInvoice } from '@/types/finance'

type InvoiceItem = {
  id: string
  entry_id: string | null
  cost_category: 'material' | 'fleet'
  description: string | null
  amount: number
}

type AvailableInvoice = Pick<
  SupplierInvoice,
  'id' | 'invoice_number' | 'subtotal' | 'discount_amount' | 'total' | 'status' | 'vat_rate'
> & {
  taxable_base?: number
  balance?: number
  credit_applied_subtotal?: number
  items?: InvoiceItem[]
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  supplierGroupId: string | null
  plantId: string | null
  /** When set, that invoice is pre-selected on open */
  preselectedInvoiceId?: string | null
  onSuccess: () => void
}

const REASON_LABELS: Record<string, string> = {
  price_adjustment: 'Ajuste de precio',
  return: 'Devolución',
  defect: 'Defecto / merma',
  other: 'Otro',
}

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export default function ApplyCreditNoteDrawer({
  open, onOpenChange, supplierGroupId, plantId, preselectedInvoiceId, onSuccess,
}: Props) {
  // ── Step 1: CN header ────────────────────────────────────────────────────────
  const [creditNumber, setCreditNumber] = useState('')
  const [creditDate, setCreditDate]     = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason]             = useState('price_adjustment')
  const [amount, setAmount]             = useState('')
  const [vatRate, setVatRate]           = useState('0.16')
  const [notes, setNotes]               = useState('')

  // ── Step 2: invoice selection + allocation ───────────────────────────────────
  const [invoices, setInvoices]               = useState<AvailableInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selected, setSelected]               = useState<Set<string>>(new Set())
  const [allocated, setAllocated]             = useState<Record<string, string>>({})

  // ── Step 3: per-invoice item allocations (optional, per-invoice expanded) ───
  const [expandedItems, setExpandedItems]     = useState<Set<string>>(new Set())
  const [itemAllocs, setItemAllocs]           = useState<Record<string, Record<string, string>>>({})

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const amountNum = parseFloat(amount) || 0
  const vatRateNum = parseFloat(vatRate) || 0

  // Fetch open/partially_paid invoices for the supplier group
  const fetchInvoices = useCallback(async () => {
    if (!supplierGroupId || !plantId) return
    setLoadingInvoices(true)
    try {
      const url = `/api/ap/invoices?supplier_group_id=${supplierGroupId}&plant_id=${plantId}&include_paid=false&limit=50`
      const res = await fetch(url)
      const data = await res.json()
      const list: AvailableInvoice[] = (data.invoices ?? []).map((inv: any) => ({
        ...inv,
        taxable_base: Number(inv.subtotal) - Number(inv.discount_amount ?? 0),
      }))
      setInvoices(list)
    } finally {
      setLoadingInvoices(false)
    }
  }, [supplierGroupId, plantId])

  // Reset on open
  useEffect(() => {
    if (!open) return
    setCreditNumber('')
    setCreditDate(new Date().toISOString().slice(0, 10))
    setReason('price_adjustment')
    setAmount('')
    setVatRate('0.16')
    setNotes('')
    setSelected(preselectedInvoiceId ? new Set([preselectedInvoiceId]) : new Set())
    setAllocated({})
    setExpandedItems(new Set())
    setItemAllocs({})
    setError(null)
    void fetchInvoices()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const toggleInvoice = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); return next }
      next.add(id)
      return next
    })
    setAllocated(prev => ({ ...prev, [id]: prev[id] ?? '' }))
  }

  const distributeProportionally = () => {
    if (amountNum <= 0 || selected.size === 0) return
    const selInvoices = invoices.filter(inv => selected.has(inv.id))
    const totalBalance = selInvoices.reduce((s, inv) => {
      const base = inv.taxable_base ?? (Number(inv.subtotal) - Number(inv.discount_amount ?? 0))
      const credited = Number(inv.credit_applied_subtotal ?? 0)
      return s + Math.max(0, base - credited)
    }, 0)
    const next: Record<string, string> = { ...allocated }
    let remaining = amountNum
    selInvoices.forEach((inv, idx) => {
      const base = inv.taxable_base ?? (Number(inv.subtotal) - Number(inv.discount_amount ?? 0))
      const credited = Number(inv.credit_applied_subtotal ?? 0)
      const available = Math.max(0, base - credited)
      const isLast = idx === selInvoices.length - 1
      const share = isLast
        ? Math.round(remaining * 100) / 100
        : Math.round((available / (totalBalance || 1)) * amountNum * 100) / 100
      if (!isLast) remaining -= share
      next[inv.id] = String(share)
    })
    setAllocated(next)
  }

  const allocatedSum = useMemo(
    () => Array.from(selected).reduce((s, id) => s + (parseFloat(allocated[id] ?? '0') || 0), 0),
    [selected, allocated]
  )

  const remaining = amountNum - allocatedSum

  // Per-invoice item allocation
  const setItemAlloc = (invoiceId: string, itemId: string, val: string) => {
    setItemAllocs(prev => ({
      ...prev,
      [invoiceId]: { ...(prev[invoiceId] ?? {}), [itemId]: val },
    }))
  }

  const canSubmit =
    amountNum > 0 &&
    reason &&
    creditDate &&
    selected.size > 0 &&
    Math.abs(remaining) <= 0.01 &&
    !submitting

  const handleSubmit = async () => {
    if (!supplierGroupId || !plantId || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const invoice_allocations = Array.from(selected).map(id => {
        const itemAllocsForInv = itemAllocs[id]
        const hasItemAllocs = itemAllocsForInv && Object.values(itemAllocsForInv).some(v => Number(v) > 0)
        return {
          invoice_id: id,
          allocated_subtotal: parseFloat(allocated[id] ?? '0') || 0,
          ...(hasItemAllocs ? {
            item_allocations: Object.entries(itemAllocsForInv)
              .filter(([, v]) => Number(v) > 0)
              .map(([invoice_item_id, v]) => ({ invoice_item_id, allocated_amount: Number(v) })),
          } : {}),
        }
      })

      const res = await fetch('/api/ap/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_group_id: supplierGroupId,
          plant_id: plantId,
          credit_number: creditNumber.trim() || undefined,
          credit_date: creditDate,
          reason,
          amount: amountNum,
          vat_rate: vatRateNum,
          notes: notes.trim() || undefined,
          invoice_allocations,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al aplicar nota de crédito')
      toast.success('Nota de crédito aplicada correctamente')
      onOpenChange(false)
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-stone-200 shrink-0">
          <SheetTitle>Aplicar nota de crédito</SheetTitle>
          <SheetDescription className="text-xs">
            Una NC puede distribuirse entre varias facturas del mismo proveedor.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Step 1: CN Header ──────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-900">Datos de la nota de crédito</h3>
            <div className="space-y-1">
              <Label className="text-xs">Número / UUID CFDI (opcional)</Label>
              <Input
                value={creditNumber}
                onChange={e => setCreditNumber(e.target.value)}
                placeholder="NC-001 o UUID del CFDI"
                className="bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fecha *</Label>
                <Input type="date" value={creditDate} onChange={e => setCreditDate(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo *</Label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full h-9 text-sm rounded-md border border-input px-3 bg-white"
                >
                  {Object.entries(REASON_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Monto total NC (sin IVA) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-white"
                />
                {amountNum > 0 && vatRateNum > 0 && (
                  <p className="text-[10px] text-stone-500">
                    IVA: {mxn.format(Math.round(amountNum * vatRateNum * 100) / 100)} · Total: {mxn.format(Math.round(amountNum * (1 + vatRateNum) * 100) / 100)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tasa IVA</Label>
                <select
                  value={vatRate}
                  onChange={e => setVatRate(e.target.value)}
                  className="w-full h-9 text-sm rounded-md border border-input px-3 bg-white"
                >
                  <option value="0">0%</option>
                  <option value="0.08">8%</option>
                  <option value="0.16">16%</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas internas</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Referencia, comentarios…" className="bg-white" />
            </div>
          </section>

          <Separator />

          {/* ── Step 2: Invoice selection ──────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Facturas a aplicar</h3>
              {selected.size > 0 && amountNum > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={distributeProportionally}
                >
                  Distribuir proporcionalmente
                </Button>
              )}
            </div>

            {loadingInvoices ? (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando facturas…
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-xs text-stone-500">No hay facturas abiertas para este proveedor.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => {
                  const base = inv.taxable_base ?? (Number(inv.subtotal) - Number(inv.discount_amount ?? 0))
                  const credited = Number(inv.credit_applied_subtotal ?? 0)
                  const available = Math.max(0, base - credited)
                  const isSelected = selected.has(inv.id)
                  const allocVal = parseFloat(allocated[inv.id] ?? '0') || 0
                  const overAlloc = allocVal > available + 0.01

                  return (
                    <div key={inv.id} className={cn(
                      'rounded-md border p-3 space-y-2',
                      isSelected ? 'border-sky-300 bg-sky-50/40' : 'border-stone-200 bg-stone-50/30',
                    )}>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleInvoice(inv.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-stone-800">{inv.invoice_number}</span>
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium',
                              inv.status === 'open' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                            )}>
                              {inv.status === 'open' ? 'Abierta' : 'Pago parcial'}
                            </span>
                          </div>
                          <div className="flex gap-3 mt-0.5 text-[10px] text-stone-500">
                            <span>Base gravable: {mxn.format(base)}</span>
                            {credited > 0 && <span className="text-amber-600">Ya acreditado: {mxn.format(credited)}</span>}
                            <span className="font-medium text-stone-700">Disponible: {mxn.format(available)}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            max={available}
                            value={allocated[inv.id] ?? ''}
                            onChange={e => setAllocated(prev => ({ ...prev, [inv.id]: e.target.value }))}
                            className={cn('w-32 h-7 text-xs text-right', overAlloc && 'border-red-400')}
                            placeholder="0.00"
                          />
                        )}
                      </div>

                      {/* Per-invoice item breakdown (optional) */}
                      {isSelected && inv.items && inv.items.length > 1 && allocVal > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setExpandedItems(prev => {
                              const next = new Set(prev)
                              next.has(inv.id) ? next.delete(inv.id) : next.add(inv.id)
                              return next
                            })}
                            className="flex items-center gap-1 text-[10px] text-stone-500 hover:text-stone-700"
                          >
                            {expandedItems.has(inv.id)
                              ? <ChevronDown className="h-3 w-3" />
                              : <ChevronRight className="h-3 w-3" />}
                            Distribución por línea (opcional — proporcional si se omite)
                          </button>
                          {expandedItems.has(inv.id) && (
                            <div className="mt-2 space-y-1.5 pl-2">
                              {inv.items.map(item => (
                                <div key={item.id} className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                    {item.cost_category === 'fleet'
                                      ? <Truck className="h-3 w-3 text-blue-500 shrink-0" />
                                      : <Package className="h-3 w-3 text-emerald-600 shrink-0" />}
                                    <span className="text-[10px] truncate text-stone-600">{item.description ?? item.cost_category}</span>
                                    <span className="text-[10px] text-stone-400 ml-auto shrink-0">{mxn.format(Number(item.amount))}</span>
                                  </div>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={itemAllocs[inv.id]?.[item.id] ?? ''}
                                    onChange={e => setItemAlloc(inv.id, item.id, e.target.value)}
                                    className="w-24 h-6 text-[10px] text-right"
                                    placeholder="0.00"
                                  />
                                </div>
                              ))}
                              {(() => {
                                const itemSum = Object.values(itemAllocs[inv.id] ?? {}).reduce((s, v) => s + (Number(v) || 0), 0)
                                const diff = Math.abs(itemSum - allocVal)
                                return diff > 0.01 ? (
                                  <p className="text-[10px] text-red-600 pl-4">
                                    Asignado: {mxn.format(itemSum)} ≠ {mxn.format(allocVal)}
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
            )}

            {/* Running total */}
            {selected.size > 0 && amountNum > 0 && (
              <div className={cn(
                'flex justify-between text-xs font-medium px-2',
                Math.abs(remaining) > 0.01 ? 'text-red-600' : 'text-emerald-700'
              )}>
                <span>Asignado: {mxn.format(allocatedSum)}</span>
                <span>Restante: {mxn.format(remaining)}</span>
              </div>
            )}
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
        </div>

        <div className="shrink-0 border-t border-stone-200 px-6 py-4 flex justify-end gap-3 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="bg-sky-700 hover:bg-sky-800 text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aplicar nota de crédito
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
