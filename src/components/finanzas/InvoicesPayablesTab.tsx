'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format, isBefore, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, ChevronDown, ChevronRight, FileText, ExternalLink, Package, Truck, Download, Receipt, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePlantContext } from '@/contexts/PlantContext'
import type { SupplierInvoice, InvoiceStatus } from '@/types/finance'
import type { Payable } from '@/types/finance'
import RecordPaymentModal from './RecordPaymentModal'
import CreateSupplierInvoiceDrawer from './CreateSupplierInvoiceDrawer'
import ApplyCreditNoteDrawer from './ApplyCreditNoteDrawer'
import EditSupplierInvoiceDrawer from './EditSupplierInvoiceDrawer'
import { procurementEntriesUrl, purchaseOrderUrl } from '@/lib/procurement/navigation'
import { formatRetentionPct } from '@/lib/ap/retentionRates'
import Link from 'next/link'

// Shape returned by GET /api/ap/invoices/[id]/credit-notes (allocation-join projection)
type CreditNoteAllocation = {
  id: string                // credit_note_invoice_allocations.id
  credit_note_id: string
  allocated_subtotal: number
  allocated_tax: number
  allocated_total: number | null
  created_at: string
  credit_note: {
    id: string
    credit_number: string | null
    credit_date: string
    reason: string
    amount: number
    tax_amount: number
    total: number
    status: string
    notes: string | null
  } | null
}

type InvoiceItem = {
  id: string
  entry_id: string | null
  cost_category: 'material' | 'fleet'
  description: string | null
  amount: number
  entry?: any
}

type InvoiceWithEnrichment = SupplierInvoice & {
  paid_to_date: number
  credit_applied_subtotal: number
  credit_applied_total: number
  balance: number
  items?: InvoiceItem[]
  payable: (Payable & { payments?: any[] }) | null
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: 'Abierta',
  partially_paid: 'Parcial',
  paid: 'Pagada',
  void: 'Anulada',
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  partially_paid: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  void: 'bg-stone-100 text-stone-600',
}

interface Props {
  workspacePlantId?: string
  hidePlantFilter?: boolean
}

export default function InvoicesPayablesTab({ workspacePlantId = '', hidePlantFilter = false }: Props) {
  const { availablePlants } = usePlantContext()
  const [localPlantFilter, setLocalPlantFilter] = useState('')
  const plantFilter = hidePlantFilter ? workspacePlantId : (localPlantFilter || workspacePlantId)
  const [includePaid, setIncludePaid] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceWithEnrichment[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set())
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceWithEnrichment | null>(null)
  const [historicalDrawerOpen, setHistoricalDrawerOpen] = useState(false)
  const [orphanFleetDrawerOpen, setOrphanFleetDrawerOpen] = useState(false)
  const [editInvoice, setEditInvoice] = useState<InvoiceWithEnrichment | null>(null)
  // CN drawer: tracks which supplier group + optional pre-selected invoice
  const [cnContext, setCnContext] = useState<{ groupId: string; plantId: string; preselectedId?: string } | null>(null)
  const [creditNoteAllocs, setCreditNoteAllocs] = useState<Record<string, CreditNoteAllocation[]>>({}) // keyed by invoice id

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        if (plantFilter) qs.set('plant_id', plantFilter)
        if (includePaid) qs.set('include_paid', 'true')
        qs.set('limit', '300')
        const res = await fetch(`/api/ap/invoices?${qs}`, { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setInvoices(data.invoices ?? [])
        const groupKeys = new Set<string>((data.invoices ?? []).map((inv: InvoiceWithEnrichment) => inv.supplier_group_id))
        setExpandedGroups(groupKeys)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [plantFilter, includePaid, reloadKey])

  const loadCreditNotes = useCallback(async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/ap/invoices/${invoiceId}/credit-notes`)
      const data = await res.json()
      setCreditNoteAllocs(prev => {
        if (prev[invoiceId]) return prev
        return { ...prev, [invoiceId]: data.credit_notes ?? [] }
      })
    } catch { /* non-fatal */ }
  }, [])

  // Group by supplier_group
  const grouped = useMemo(() => {
    const map = new Map<string, { groupName: string; invoices: InvoiceWithEnrichment[] }>()
    for (const inv of invoices) {
      const gid = inv.supplier_group_id
      const gname = inv.supplier_group?.name ?? gid
      if (!map.has(gid)) map.set(gid, { groupName: gname, invoices: [] })
      map.get(gid)!.invoices.push(inv)
    }
    return map
  }, [invoices])

  const exportExcel = async () => {
    if (invoices.length === 0) return
    const XLSX = await import('xlsx')
    const rows = invoices.map(inv => ({
      Proveedor: inv.supplier_group?.name ?? '',
      Factura: inv.invoice_number,
      Tipo: inv.source === 'mixed' ? 'Mixta' : inv.source === 'historical' ? 'Histórico' : inv.is_internal ? 'Interno' : 'Normal',
      Fecha: inv.invoice_date,
      Vencimiento: inv.due_date,
      Subtotal: inv.subtotal,
      Descuento: inv.discount_amount ?? 0,
      Base_gravable: (Number(inv.subtotal) - Number(inv.discount_amount ?? 0)),
      IVA: inv.tax,
      Ret_ISR: inv.retention_isr_amount ?? 0,
      Ret_IVA: inv.retention_iva_amount ?? 0,
      Total_a_pagar: inv.total,
      NC_aplicada: inv.credit_applied_total ?? 0,
      Pagado: inv.paid_to_date,
      Saldo: inv.balance,
      Estado: STATUS_LABELS[inv.status] ?? inv.status,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `facturas_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) {
    return <div className="space-y-3 py-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {!hidePlantFilter && (
        <Select value={plantFilter || '__all__'} onValueChange={v => setLocalPlantFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[220px] bg-white border-stone-300">
            <SelectValue placeholder="Todas las plantas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las plantas</SelectItem>
            {availablePlants.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}

        <Button
          size="sm"
          variant={includePaid ? 'solid' : 'outline'}
          className="h-8 text-xs"
          onClick={() => setIncludePaid(v => !v)}
        >
          {includePaid ? 'Mostrando todas' : 'Mostrar pagadas'}
        </Button>

        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => void exportExcel()} disabled={invoices.length === 0}>
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 border-amber-300 text-amber-800"
            onClick={() => setOrphanFleetDrawerOpen(true)}
          >
            <Truck className="h-3.5 w-3.5" /> Flete sin entrada
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1 bg-stone-800 hover:bg-stone-900 text-white"
            onClick={() => setHistoricalDrawerOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" /> Nueva factura histórica
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="py-16 text-center text-stone-500">
          <FileText className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-sm font-medium">No hay facturas registradas</p>
          <p className="text-xs text-stone-400 mt-1">Crea facturas desde la pestaña «Recepciones sin factura» o registra facturas históricas aquí.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([groupId, { groupName, invoices: groupInvs }]) => {
            const totalBalance = groupInvs.reduce((s, inv) => s + inv.balance, 0)
            const openCount = groupInvs.filter(inv => inv.status === 'open' || inv.status === 'partially_paid').length
            const expanded = expandedGroups.has(groupId)

            return (
              <div key={groupId} className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                {/* Group header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-stone-50 cursor-pointer hover:bg-stone-100 transition-colors"
                  onClick={() => setExpandedGroups(prev => {
                    const next = new Set(prev)
                    if (next.has(groupId)) next.delete(groupId)
                    else next.add(groupId)
                    return next
                  })}
                >
                  {expanded ? <ChevronDown className="h-4 w-4 text-stone-500" /> : <ChevronRight className="h-4 w-4 text-stone-500" />}
                  <span className="font-semibold text-sm text-stone-900 flex-1">{groupName}</span>
                  <span className="text-xs text-stone-500 mr-3">{openCount} abiertas · {groupInvs.length} total</span>
                  {openCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 mr-2"
                      onClick={e => {
                        e.stopPropagation()
                        const pId = groupInvs[0]?.plant_id ?? plantFilter
                        setCnContext({ groupId, plantId: pId })
                      }}
                    >
                      <Receipt className="h-3 w-3" /> Aplicar NC
                    </Button>
                  )}
                  <span className="text-sm font-bold tabular-nums">{mxn.format(totalBalance)}</span>
                </div>

                {expanded && (
                  <div className="divide-y divide-stone-100">
                    {groupInvs.map(inv => {
                      const isPending = inv.status === 'open' || inv.status === 'partially_paid'
                      const isOverdue = isPending && inv.due_date && isBefore(new Date(inv.due_date + 'T00:00:00'), new Date())
                      const daysOv = isOverdue ? differenceInDays(new Date(), new Date(inv.due_date + 'T00:00:00')) : 0
                      const invExpanded = expandedInvoices.has(inv.id)
                      const payments = (inv.payable as any)?.payments ?? []

                      return (
                        <div key={inv.id}>
                          {/* Invoice row */}
                          <div
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors',
                              isOverdue && 'bg-red-50/60 hover:bg-red-50'
                            )}
                            onClick={() => {
                              setExpandedInvoices(prev => {
                                const next = new Set(prev)
                                if (next.has(inv.id)) next.delete(inv.id)
                                else { next.add(inv.id); void loadCreditNotes(inv.id) }
                                return next
                              })
                            }}
                          >
                            {invExpanded ? <ChevronDown className="h-3.5 w-3.5 text-stone-400" /> : <ChevronRight className="h-3.5 w-3.5 text-stone-400" />}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-semibold">{inv.invoice_number}</span>
                                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[inv.status])}>
                                  {STATUS_LABELS[inv.status]}
                                </span>
                                {inv.source === 'historical' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-500 border border-stone-200">Histórico</span>
                                )}
                                {inv.source === 'mixed' && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">Mixta</span>
                                )}
                                {inv.is_internal && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">Interno</span>
                                )}
                                {/* CFDI status chip */}
                                {inv.cfdi_uuid ? (
                                  inv.cfdi_estado_sat === 'cancelado' ? (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 cursor-default"
                                      title={`UUID: ${inv.cfdi_uuid}\nRFC: ${inv.cfdi_emisor_rfc ?? ''}`}
                                    >
                                      🛑 Cancelado SAT
                                    </span>
                                  ) : (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                                      title={`UUID: ${inv.cfdi_uuid}\nRFC: ${inv.cfdi_emisor_rfc ?? ''}`}
                                    >
                                      CFDI ✓
                                    </span>
                                  )
                                ) : (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-50 text-stone-400 border border-stone-200 cursor-default"
                                    title="Sin CFDI vinculado"
                                  >
                                    CFDI ✗
                                  </span>
                                )}
                                {isOverdue && (
                                  <span className="flex items-center gap-1 text-xs text-red-700 font-medium">
                                    <AlertTriangle className="h-3 w-3" /> {daysOv}d vencida
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500">
                                <span>Factura: {format(new Date(inv.invoice_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}</span>
                                <span>Vence: <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{format(new Date(inv.due_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}</span></span>
                                {inv.document_url && (
                                  <a href={inv.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-sky-600 hover:underline" onClick={e => e.stopPropagation()}>
                                    <ExternalLink className="h-3 w-3" /> PDF
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0 space-y-0.5">
                              <div className="text-sm font-bold tabular-nums">{mxn.format(inv.total)}</div>
                              {(Number(inv.retention_isr_amount ?? 0) + Number(inv.retention_iva_amount ?? 0)) > 0 && (
                                <div className="text-[10px] text-rose-600 tabular-nums">
                                  ret. {mxn.format(Number(inv.retention_isr_amount ?? 0) + Number(inv.retention_iva_amount ?? 0))}
                                </div>
                              )}
                              {Number(inv.credit_applied_total ?? 0) > 0 && (
                                <div className="text-xs text-emerald-600 tabular-nums">
                                  NC −{mxn.format(Number(inv.credit_applied_total))}
                                </div>
                              )}
                              {inv.paid_to_date > 0 && (
                                <div className="text-xs text-sky-600 tabular-nums">−{mxn.format(inv.paid_to_date)} pagado</div>
                              )}
                              {isPending && inv.balance > 0 && (
                                <div className="text-xs text-stone-700 tabular-nums font-semibold">Saldo: {mxn.format(inv.balance)}</div>
                              )}
                            </div>

                            {isPending && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs shrink-0 ml-1 gap-1"
                                onClick={e => {
                                  e.stopPropagation()
                                  setEditInvoice(inv)
                                }}
                              >
                                <Pencil className="h-3 w-3" /> Editar
                              </Button>
                            )}

                            {isPending && inv.payable && (
                              <Button
                                size="sm"
                                className={cn('h-7 text-xs shrink-0 ml-1', isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-700 hover:bg-sky-800')}
                                onClick={e => {
                                  e.stopPropagation()
                                  setPaymentInvoice(inv)
                                }}
                              >
                                Registrar pago
                              </Button>
                            )}
                          </div>

                          {/* Expanded detail */}
                          {invExpanded && (
                            <div className="px-10 pb-4 bg-stone-50/50 border-t border-stone-100 space-y-4">
                              {/* Line items */}
                              {(inv.items ?? []).length > 0 && (
                                <div className="pt-3">
                                  <p className="text-xs font-semibold text-stone-700 mb-2">Líneas de factura</p>
                                  <div className="space-y-1">
                                    {(inv.items ?? []).map((item: any) => (
                                      <div key={item.id} className="flex items-center gap-3 text-xs py-1.5 px-3 bg-white rounded border border-stone-100">
                                        {item.cost_category === 'fleet'
                                          ? <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                          : <Package className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                                        <span className="flex-1 text-stone-700 truncate">{item.description || '—'}</span>
                                        {item.entry && (
                                          <>
                                            <span className="font-mono text-stone-500">{item.entry.entry_number}</span>
                                            <Link
                                              href={procurementEntriesUrl({ entryId: item.entry_id })}
                                              className="text-sky-600 hover:underline flex items-center gap-0.5"
                                              onClick={e => e.stopPropagation()}
                                            >
                                              <ExternalLink className="h-3 w-3" /> Entrada
                                            </Link>
                                            {item.entry.po_id && (
                                              <Link
                                                href={purchaseOrderUrl(item.entry.po_id, inv.plant_id)}
                                                className="text-sky-600 hover:underline flex items-center gap-0.5"
                                                onClick={e => e.stopPropagation()}
                                              >
                                                <ExternalLink className="h-3 w-3" /> OC
                                              </Link>
                                            )}
                                          </>
                                        )}
                                        <span className="tabular-nums font-medium">{mxn.format(Number(item.amount))}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-x-4 gap-y-0.5 text-xs pt-2 pr-3 text-stone-600">
                                    <span>Subtotal: <b>{mxn.format(inv.subtotal)}</b></span>
                                    {Number(inv.discount_amount ?? 0) > 0 && (
                                      <span className="text-amber-700">−Desc: <b>{mxn.format(Number(inv.discount_amount))}</b></span>
                                    )}
                                    <span>IVA ({Math.round(inv.vat_rate * 100)}%): <b>{mxn.format(inv.tax)}</b></span>
                                    {Number(inv.retention_isr_amount ?? 0) > 0 && (
                                      <span className="text-rose-700">−Ret.ISR ({formatRetentionPct(Number(inv.retention_isr_rate ?? 0))}): <b>{mxn.format(Number(inv.retention_isr_amount))}</b></span>
                                    )}
                                    {Number(inv.retention_iva_amount ?? 0) > 0 && (
                                      <span className="text-rose-700">−Ret.IVA ({formatRetentionPct(Number(inv.retention_iva_rate ?? 0))}): <b>{mxn.format(Number(inv.retention_iva_amount))}</b></span>
                                    )}
                                    <span className="font-semibold text-stone-900">Total a pagar: <b>{mxn.format(inv.total)}</b></span>
                                  </div>
                                </div>
                              )}

                              {/* Payments */}
                              {payments.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-stone-700 mb-2">Pagos registrados</p>
                                  <div className="space-y-1">
                                    {payments.map((p: any) => (
                                      <div key={p.id} className="flex justify-between text-xs py-1.5 px-3 bg-white rounded border border-stone-100">
                                        <span className="text-stone-500">
                                          {format(new Date(p.payment_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                                          {p.reference ? ` · ${p.reference}` : ''}
                                          {p.method ? ` · ${p.method}` : ''}
                                        </span>
                                        <span className="tabular-nums font-medium text-emerald-700">{mxn.format(Number(p.amount))}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Credit notes */}
                              {(() => {
                                const allocs = creditNoteAllocs[inv.id] ?? []
                                const totalCredited = allocs.reduce((s, a) => s + Number(a.allocated_subtotal), 0)
                                return (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-semibold text-stone-700">
                                        Notas de crédito
                                        {totalCredited > 0 && (
                                          <span className="ml-2 text-emerald-700 font-normal">({mxn.format(totalCredited)} acreditado en esta factura)</span>
                                        )}
                                      </p>
                                      {inv.status !== 'void' && inv.status !== 'paid' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                          onClick={e => {
                                            e.stopPropagation()
                                            setCnContext({ groupId: inv.supplier_group_id, plantId: inv.plant_id, preselectedId: inv.id })
                                          }}
                                        >
                                          <Receipt className="h-3 w-3" /> Aplicar NC
                                        </Button>
                                      )}
                                    </div>
                                    {allocs.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">Sin notas de crédito aplicadas.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {allocs.map(alloc => {
                                          const cn = alloc.credit_note
                                          if (!cn) return null
                                          return (
                                            <div key={alloc.id} className="flex justify-between text-xs py-1.5 px-3 bg-emerald-50 rounded border border-emerald-100">
                                              <span className="text-stone-600">
                                                {cn.credit_number ? <span className="font-mono mr-2">{cn.credit_number}</span> : null}
                                                {format(new Date(cn.credit_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                                                {' · '}
                                                {cn.reason === 'price_adjustment' ? 'Ajuste de precio'
                                                  : cn.reason === 'return' ? 'Devolución'
                                                  : cn.reason === 'defect' ? 'Defecto'
                                                  : 'Otro'}
                                                {Number(cn.amount) !== Number(alloc.allocated_subtotal) && (
                                                  <span className="ml-1.5 text-stone-400">(NC total: {mxn.format(Number(cn.amount))})</span>
                                                )}
                                              </span>
                                              <span className="tabular-nums font-medium text-emerald-800">−{mxn.format(Number(alloc.allocated_subtotal))}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Payment modal — uses existing RecordPaymentModal via the linked payable */}
      {paymentInvoice?.payable && (
        <RecordPaymentModal
          payable={paymentInvoice.payable as any}
          onClose={() => setPaymentInvoice(null)}
          onSaved={() => {
            setPaymentInvoice(null)
            setReloadKey(k => k + 1)
          }}
        />
      )}

      {/* Historical invoice drawer */}
      <CreateSupplierInvoiceDrawer
        open={historicalDrawerOpen}
        onOpenChange={setHistoricalDrawerOpen}
        plantId={plantFilter || undefined}
        onSuccess={() => setReloadKey(k => k + 1)}
      />
      <CreateSupplierInvoiceDrawer
        open={orphanFleetDrawerOpen}
        onOpenChange={setOrphanFleetDrawerOpen}
        plantId={plantFilter || undefined}
        fleetOnly
        orphanFleetOnly
        onSuccess={() => setReloadKey(k => k + 1)}
      />

      {/* Edit invoice drawer */}
      <EditSupplierInvoiceDrawer
        open={!!editInvoice}
        onOpenChange={v => { if (!v) setEditInvoice(null) }}
        invoice={editInvoice}
        onSuccess={() => {
          setEditInvoice(null)
          setReloadKey(k => k + 1)
        }}
      />

      {/* Credit note drawer */}
      <ApplyCreditNoteDrawer
        open={!!cnContext}
        onOpenChange={v => { if (!v) setCnContext(null) }}
        supplierGroupId={cnContext?.groupId ?? null}
        plantId={cnContext?.plantId ?? null}
        preselectedInvoiceId={cnContext?.preselectedId}
        onSuccess={() => {
          // Clear cached CN lists so they reload fresh on next expand
          if (cnContext?.preselectedId) {
            setCreditNoteAllocs(prev => { const next = { ...prev }; delete next[cnContext.preselectedId!]; return next })
          } else {
            setCreditNoteAllocs({})
          }
          setCnContext(null)
          setReloadKey(k => k + 1)
        }}
      />
    </div>
  )
}
