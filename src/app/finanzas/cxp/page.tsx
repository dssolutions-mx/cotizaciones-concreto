'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { format, isAfter, isBefore, addDays, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  DollarSign, AlertTriangle, FileText, Clock, Truck, Package,
  ExternalLink, Download, X, TrendingUp, LayoutGrid, List, Trash2,
} from 'lucide-react'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Payable, PayableStatus } from '@/types/finance'
import RecordPaymentModal from '@/components/finanzas/RecordPaymentModal'
import { usePlantContext } from '@/contexts/PlantContext'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type PayableWithSupplier = Payable & {
  supplier_name?: string
  amount_paid?: number
  payment_history?: Array<{ payment_date: string; amount: number; method?: string; reference?: string }>
}

const STATUS_COLORS: Record<PayableStatus, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  partially_paid: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  void: 'bg-gray-100 text-gray-700',
}

const STATUS_LABELS: Record<PayableStatus, string> = {
  open: 'Abierto',
  partially_paid: 'Parcialmente Pagado',
  paid: 'Pagado',
  void: 'Anulado',
}

function AgingCard({ payables, mxn }: { payables: PayableWithSupplier[]; mxn: Intl.NumberFormat }) {
  const aging = useMemo(() => {
    const today = new Date()
    const open = payables.filter(p => p.status === 'open' || p.status === 'partially_paid')
    const buckets = { current: 0, d30: 0, d60: 0, d90plus: 0 }
    const counts = { current: 0, d30: 0, d60: 0, d90plus: 0 }

    for (const p of open) {
      if (!p.due_date) { buckets.current += p.total; counts.current++; continue }
      const daysOverdue = differenceInDays(today, new Date(p.due_date + 'T00:00:00'))
      if (daysOverdue <= 0) { buckets.current += p.total; counts.current++ }
      else if (daysOverdue <= 30) { buckets.d30 += p.total; counts.d30++ }
      else if (daysOverdue <= 60) { buckets.d60 += p.total; counts.d60++ }
      else { buckets.d90plus += p.total; counts.d90plus++ }
    }
    return { buckets, counts }
  }, [payables])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Antigüedad de Saldo</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {[
            { label: 'Al día', amount: aging.buckets.current, count: aging.counts.current, color: 'text-green-600' },
            { label: '1–30 días vencida', amount: aging.buckets.d30, count: aging.counts.d30, color: 'text-yellow-600' },
            { label: '31–60 días', amount: aging.buckets.d60, count: aging.counts.d60, color: 'text-orange-600' },
            { label: '60+ días', amount: aging.buckets.d90plus, count: aging.counts.d90plus, color: 'text-red-600' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className={`text-xs ${row.color}`}>{row.label}</span>
              <span className={`text-xs font-semibold ${row.color}`}>
                {mxn.format(row.amount)}
                {row.count > 0 && <span className="font-normal text-muted-foreground ml-1">({row.count})</span>}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function CxpPage() {
  const searchParams = useSearchParams()
  const poIdFromUrl = searchParams.get('po_id') || undefined
  const supplierIdFromUrl = searchParams.get('supplier_id') || undefined
  const payableIdFromUrl = searchParams.get('payable_id') || undefined
  const { availablePlants } = usePlantContext()
  const { profile } = useAuthSelectors()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payables, setPayables] = useState<PayableWithSupplier[]>([])
  const [status, setStatus] = useState<PayableStatus | 'all'>('all')
  const [plant, setPlant] = useState<string>('')
  const [supplierFilter, setSupplierFilter] = useState<string>(supplierIdFromUrl || '')
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [dueFrom, setDueFrom] = useState<string>('')
  const [dueTo, setDueTo] = useState<string>('')
  const [invoice, setInvoice] = useState<string>('')
  const [selected, setSelected] = useState<PayableWithSupplier | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped')
  const [sortFlat, setSortFlat] = useState<'due_date' | 'total' | 'supplier' | 'invoice_date'>('due_date')
  const [flatPage, setFlatPage] = useState(0)
  const [flatPageSize, setFlatPageSize] = useState(25)
  const [payableItemDelete, setPayableItemDelete] = useState<{
    itemId: string
    invoiceLabel: string
  } | null>(null)
  const [payableItemDeleteLoading, setPayableItemDeleteLoading] = useState(false)

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const canDeleteOrphanPayableItems =
    profile?.role === 'EXECUTIVE' ||
    profile?.role === 'ADMIN_OPERATIONS' ||
    profile?.role === 'PLANT_MANAGER'

  const hasActiveFilters = plant || supplierFilter || (status !== 'all') || dueFrom || dueTo || invoice || poIdFromUrl

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date()
    const in7Days = addDays(today, 7)
    const in30Days = addDays(today, 30)

    const openPayables = payables.filter(p => p.status === 'open' || p.status === 'partially_paid')
    const overdue = openPayables.filter(p => p.due_date && isBefore(new Date(p.due_date + 'T00:00:00'), today))
    const dueSoon7 = openPayables.filter(p => {
      if (!p.due_date) return false
      const d = new Date(p.due_date + 'T00:00:00')
      return isAfter(d, today) && isBefore(d, in7Days)
    })
    const dueSoon30 = openPayables.filter(p => {
      if (!p.due_date) return false
      const d = new Date(p.due_date + 'T00:00:00')
      return isAfter(d, today) && isBefore(d, in30Days)
    })

    return {
      totalOpen: openPayables.reduce((s, p) => s + p.total, 0),
      openCount: openPayables.length,
      totalOverdue: overdue.reduce((s, p) => s + p.total, 0),
      overdueCount: overdue.length,
      totalDueSoon7: dueSoon7.reduce((s, p) => s + p.total, 0),
      dueSoon7Count: dueSoon7.length,
      totalDueSoon30: dueSoon30.reduce((s, p) => s + p.total, 0),
      dueSoon30Count: dueSoon30.length,
    }
  }, [payables])

  const monthlyAp = useMemo(() => {
    const now = new Date()
    const thisM = now.getMonth()
    const thisY = now.getFullYear()
    const prevM = thisM === 0 ? 11 : thisM - 1
    const prevY = thisM === 0 ? thisY - 1 : thisY
    let invoicedThis = 0
    let invoicedPrev = 0
    for (const p of payables) {
      if (!p.invoice_date) continue
      const d = new Date(p.invoice_date + 'T00:00:00')
      if (d.getMonth() === thisM && d.getFullYear() === thisY) invoicedThis += p.total
      if (d.getMonth() === prevM && d.getFullYear() === prevY) invoicedPrev += p.total
    }
    return { invoicedThis, invoicedPrev }
  }, [payables])

  const supplierAgingMatrix = useMemo(() => {
    const today = new Date()
    const rows: Array<{
      supplier: string
      current: number
      d1_30: number
      d31_60: number
      d61_90: number
      d90plus: number
    }> = []
    const bySup = new Map<string, { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number }>()
    for (const p of payables) {
      if (p.status !== 'open' && p.status !== 'partially_paid') continue
      const name = p.supplier_name || p.supplier_id || '—'
      const pending = p.total - (p.amount_paid || 0)
      if (pending <= 0) continue
      if (!bySup.has(name)) {
        bySup.set(name, { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 })
      }
      const b = bySup.get(name)!
      if (!p.due_date) {
        b.current += pending
        continue
      }
      const daysOverdue = differenceInDays(today, new Date(p.due_date + 'T00:00:00'))
      if (daysOverdue <= 0) b.current += pending
      else if (daysOverdue <= 30) b.d1_30 += pending
      else if (daysOverdue <= 60) b.d31_60 += pending
      else if (daysOverdue <= 90) b.d61_90 += pending
      else b.d90plus += pending
    }
    for (const [supplier, v] of bySup.entries()) {
      rows.push({ supplier, ...v })
    }
    rows.sort((a, b) => (b.d90plus + b.d61_90 + b.d31_60 + b.d1_30) - (a.d90plus + a.d61_90 + a.d31_60 + a.d1_30))
    return rows
  }, [payables])

  const flatSorted = useMemo(() => {
    const list = [...payables]
    list.sort((a, b) => {
      if (sortFlat === 'total') return b.total - a.total
      if (sortFlat === 'supplier') {
        const sa = a.supplier_name || a.supplier_id || ''
        const sb = b.supplier_name || b.supplier_id || ''
        return sa.localeCompare(sb)
      }
      if (sortFlat === 'invoice_date') {
        const da = a.invoice_date ? new Date(a.invoice_date).getTime() : 0
        const db = b.invoice_date ? new Date(b.invoice_date).getTime() : 0
        return db - da
      }
      const da = a.due_date ? new Date(a.due_date).getTime() : 0
      const db = b.due_date ? new Date(b.due_date).getTime() : 0
      return da - db
    })
    return list
  }, [payables, sortFlat])

  const flatPageSlice = useMemo(() => {
    const start = flatPage * flatPageSize
    return flatSorted.slice(start, start + flatPageSize)
  }, [flatSorted, flatPage, flatPageSize])

  const flatTotalPages = Math.max(1, Math.ceil(flatSorted.length / flatPageSize))

  useEffect(() => {
    setFlatPage(0)
  }, [payables, sortFlat])

  useEffect(() => {
    if (poIdFromUrl) setPlant('')
  }, [poIdFromUrl])

  useEffect(() => {
    if (supplierIdFromUrl) setSupplierFilter(supplierIdFromUrl)
  }, [supplierIdFromUrl])

  useEffect(() => {
    fetch('/api/suppliers')
      .then(res => res.ok ? res.json() : { suppliers: [] })
      .then(data => setSuppliers(data.suppliers || []))
      .catch(() => setSuppliers([]))
  }, [])

  useEffect(() => {
    fetchPayables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, plant, supplierFilter, dueFrom, dueTo, invoice, poIdFromUrl, refreshKey])

  useEffect(() => {
    if (!payableIdFromUrl || payables.length === 0) return
    const p = payables.find((x) => x.id === payableIdFromUrl)
    if (p) setSelected(p)
  }, [payableIdFromUrl, payables])

  const fetchPayables = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status && status !== 'all') params.set('status', status)
      if (plant) params.set('plant_id', plant)
      if (dueFrom) params.set('due_from', dueFrom)
      if (dueTo) params.set('due_to', dueTo)
      if (invoice) params.set('invoice_number', invoice)
      if (poIdFromUrl) params.set('po_id', poIdFromUrl)
      if (supplierFilter) params.set('supplier_id', supplierFilter)
      params.set('include', 'items,payments')
      params.set('limit', '5000')
      params.set('offset', '0')

      const res = await fetch(`/api/ap/payables?${params.toString()}`)
      if (!res.ok) throw new Error('Error al cargar CXP')
      const data = await res.json()
      setPayables(data.payables || [])
    } catch {
      setError('No se pudieron cargar las cuentas por pagar')
      toast.error('No se pudieron cargar las cuentas por pagar')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setStatus('all')
    setPlant('')
    setSupplierFilter('')
    setDueFrom('')
    setDueTo('')
    setInvoice('')
  }

  const runPayableItemDelete = async () => {
    if (!payableItemDelete) return
    setPayableItemDeleteLoading(true)
    try {
      const res = await fetch(`/api/ap/payable-items/${payableItemDelete.itemId}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'No se pudo eliminar la partida')
        return
      }
      toast.success(
        body.payable_deleted
          ? 'Partida eliminada. La factura ya no tenía más líneas y se eliminó el registro de CXP.'
          : 'Partida eliminada. Los totales de la factura se recalcularon.'
      )
      setPayableItemDelete(null)
      setRefreshKey((k) => k + 1)
    } finally {
      setPayableItemDeleteLoading(false)
    }
  }

  const exportExcel = async () => {
    if (payables.length === 0) return
    const XLSX = await import('xlsx')
    const rows = payables.map(p => ({
      Factura: p.invoice_number,
      Proveedor: p.supplier_name || p.supplier_id,
      Estado: STATUS_LABELS[p.status] || p.status,
      Fecha_Factura: p.invoice_date || '',
      Vencimiento: p.due_date || '',
      Subtotal: p.subtotal,
      IVA: p.tax,
      Total: p.total,
      Pagado: (p as PayableWithSupplier).amount_paid || 0,
      Pendiente: p.total - ((p as PayableWithSupplier).amount_paid || 0),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'CXP')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cxp_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const statusBadge = (s: PayableStatus) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
      {STATUS_LABELS[s] ?? s}
    </span>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de cuentas por pagar de materiales y flota</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Las cuentas aparecen al registrar entradas con factura y fecha de vencimiento.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={payables.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button size="sm" onClick={() => setRefreshKey(k => k + 1)}>Actualizar</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total por Pagar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{mxn.format(kpis.totalOpen)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis.openCount} {kpis.openCount === 1 ? 'cuenta abierta' : 'cuentas abiertas'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold text-red-600">{mxn.format(kpis.totalOverdue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis.overdueCount} {kpis.overdueCount === 1 ? 'cuenta' : 'cuentas'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Vencer (30 días)</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold text-yellow-600">{mxn.format(kpis.totalDueSoon30)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis.dueSoon30Count} {kpis.dueSoon30Count === 1 ? 'cuenta' : 'cuentas'}
                  {kpis.dueSoon7Count > 0 && (
                    <span className="text-red-500 ml-1">({kpis.dueSoon7Count} en 7 días)</span>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <Card><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ) : (
          <AgingCard payables={payables} mxn={mxn} />
        )}
      </div>

      {/* Monthly AP summary + supplier aging matrix */}
      {!loading && payables.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Facturación (mes)</CardTitle>
              <CardDescription>Comparativo facturado vs mes anterior (por fecha de factura)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs text-muted-foreground">Este mes</div>
                <div className="text-xl font-bold tabular-nums">{mxn.format(monthlyAp.invoicedThis)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Mes anterior</div>
                <div className="text-xl font-bold tabular-nums text-muted-foreground">{mxn.format(monthlyAp.invoicedPrev)}</div>
              </div>
              <div className="text-xs text-muted-foreground self-end">
                {monthlyAp.invoicedPrev > 0 && (
                  <span className={monthlyAp.invoicedThis >= monthlyAp.invoicedPrev ? 'text-emerald-600' : 'text-amber-700'}>
                    {monthlyAp.invoicedThis >= monthlyAp.invoicedPrev ? '↑' : '↓'}{' '}
                    {Math.abs(
                      ((monthlyAp.invoicedThis - monthlyAp.invoicedPrev) / monthlyAp.invoicedPrev) * 100
                    ).toFixed(1)}
                    % vs anterior
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Antigüedad por proveedor</CardTitle>
              <CardDescription>Saldo pendiente por bucket (proveedores con saldo abierto)</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto max-h-56">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Proveedor</TableHead>
                    <TableHead className="text-xs text-right">Al día</TableHead>
                    <TableHead className="text-xs text-right">1–30</TableHead>
                    <TableHead className="text-xs text-right">31–60</TableHead>
                    <TableHead className="text-xs text-right">61–90</TableHead>
                    <TableHead className="text-xs text-right">90+</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierAgingMatrix.slice(0, 12).map(row => (
                    <TableRow key={row.supplier}>
                      <TableCell className="text-xs font-medium max-w-[140px] truncate">{row.supplier}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{mxn.format(row.current)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{mxn.format(row.d1_30)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{mxn.format(row.d31_60)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{mxn.format(row.d61_90)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums text-red-700">{mxn.format(row.d90plus)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {supplierAgingMatrix.length > 12 && (
                <p className="text-[11px] text-muted-foreground mt-2">Mostrando 12 de {supplierAgingMatrix.length} proveedores</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Filtros</CardTitle>
              <CardDescription>Planta, proveedor, estado, vencimiento y número de factura</CardDescription>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground h-8">
                <X className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-gray-500">Planta</label>
              <Select value={plant || '_all'} onValueChange={v => setPlant(v === '_all' ? '' : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas las plantas</SelectItem>
                  {availablePlants.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Proveedor</label>
              <Select value={supplierFilter || '_all'} onValueChange={v => setSupplierFilter(v === '_all' ? '' : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos los proveedores</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Estatus</label>
              <Select value={status} onValueChange={v => setStatus(v as PayableStatus | 'all')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="partially_paid">Parcial</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="void">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-gray-500">Vence desde</label>
              <Input type="date" value={dueFrom} onChange={e => setDueFrom(e.target.value)} className="mt-1" />
            </div>

            <div>
              <label className="text-xs text-gray-500">Vence hasta</label>
              <Input type="date" value={dueTo} onChange={e => setDueTo(e.target.value)} className="mt-1" />
            </div>

            <div>
              <label className="text-xs text-gray-500">Número de factura</label>
              <Input placeholder="Buscar factura..." value={invoice} onChange={e => setInvoice(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Quick filter chips */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            <span className="text-xs text-gray-500 self-center">Acceso rápido:</span>
            <button
              onClick={() => setStatus('open')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                status === 'open' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-background border-border hover:bg-muted'
              }`}
            >
              Abiertas
            </button>
            <button
              onClick={() => {
                const today = new Date()
                setDueTo(format(today, 'yyyy-MM-dd'))
                setStatus('open')
              }}
              className="px-3 py-1 rounded-full text-xs font-medium border bg-background border-border hover:bg-muted transition-colors"
            >
              Vencidas hoy
            </button>
            <button
              onClick={() => {
                const today = new Date()
                setDueTo(format(addDays(today, 7), 'yyyy-MM-dd'))
                setDueFrom(format(today, 'yyyy-MM-dd'))
                setStatus('open')
              }}
              className="px-3 py-1 rounded-full text-xs font-medium border bg-background border-border hover:bg-muted transition-colors"
            >
              Próximos 7 días
            </button>
            <button
              onClick={() => {
                const today = new Date()
                setDueTo(format(addDays(today, 30), 'yyyy-MM-dd'))
                setDueFrom(format(today, 'yyyy-MM-dd'))
                setStatus('open')
              }}
              className="px-3 py-1 rounded-full text-xs font-medium border bg-background border-border hover:bg-muted transition-colors"
            >
              Próximos 30 días
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Payables list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Listado de Cuentas</CardTitle>
              <CardDescription>
                {!loading && payables.length > 0 && `${payables.length} ${payables.length === 1 ? 'cuenta encontrada' : 'cuentas encontradas'}`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border overflow-hidden">
                <Button
                  type="button"
                  variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none gap-1"
                  onClick={() => setViewMode('grouped')}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Por proveedor
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'flat' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none gap-1"
                  onClick={() => setViewMode('flat')}
                >
                  <List className="h-3.5 w-3.5" />
                  Tabla
                </Button>
              </div>
              {viewMode === 'flat' && (
                <Select value={sortFlat} onValueChange={v => setSortFlat(v as typeof sortFlat)}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due_date">Vencimiento</SelectItem>
                    <SelectItem value="total">Monto total</SelectItem>
                    <SelectItem value="supplier">Proveedor</SelectItem>
                    <SelectItem value="invoice_date">Fecha factura</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                <div className="text-sm font-medium text-gray-900">{error}</div>
                <Button variant="outline" size="sm" className="mt-3" onClick={fetchPayables}>Reintentar</Button>
              </div>
            </div>
          ) : payables.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <div className="text-sm font-medium text-gray-900">No hay cuentas por pagar</div>
                <div className="text-xs text-gray-500 mt-1">
                  {hasActiveFilters
                    ? 'No hay resultados con los filtros aplicados.'
                    : 'Registra entradas de material con factura para generar cuentas.'}
                </div>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Limpiar filtros</Button>
                )}
              </div>
            </div>
          ) : viewMode === 'grouped' ? (
            <div className="space-y-6">
              {Object.entries(
                payables.reduce((acc: Record<string, PayableWithSupplier[]>, p) => {
                  const key = p.supplier_name || p.supplier_id
                  if (!acc[key]) acc[key] = []
                  acc[key].push(p)
                  return acc
                }, {})
              )
                .sort(([, a], [, b]) => {
                  // Sort supplier groups by outstanding open amount descending
                  const aOpen = a.filter(p => p.status === 'open' || p.status === 'partially_paid').reduce((s, p) => s + p.total, 0)
                  const bOpen = b.filter(p => p.status === 'open' || p.status === 'partially_paid').reduce((s, p) => s + p.total, 0)
                  return bOpen - aOpen
                })
                .map(([supplier, items]) => {
                  const supplierOpen = items
                    .filter(p => p.status === 'open' || p.status === 'partially_paid')
                    .reduce((sum, p) => sum + p.total, 0)
                  const overdueItems = items.filter(p =>
                    (p.status === 'open' || p.status === 'partially_paid') &&
                    p.due_date && isBefore(new Date(p.due_date + 'T00:00:00'), new Date())
                  )

                  return (
                    <div key={supplier} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-base font-semibold text-gray-900">{supplier}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                            <span>{items.length} {items.length === 1 ? 'factura' : 'facturas'}</span>
                            {overdueItems.length > 0 && (
                              <span className="text-red-600 font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {overdueItems.length} vencida{overdueItems.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Pendiente</div>
                          <div className="text-lg font-bold">{mxn.format(supplierOpen)}</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {items
                          .sort((a, b) => {
                            // Sort: overdue first, then by due date
                            const today = new Date()
                            const aOverdue = a.due_date && isBefore(new Date(a.due_date + 'T00:00:00'), today) ? 1 : 0
                            const bOverdue = b.due_date && isBefore(new Date(b.due_date + 'T00:00:00'), today) ? 1 : 0
                            if (aOverdue !== bOverdue) return bOverdue - aOverdue
                            if (!a.due_date) return 1
                            if (!b.due_date) return -1
                            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                          })
                          .map(p => {
                            const pItems = (p as any).items || []
                            const isFleet = pItems.length > 0 && pItems.some((it: any) => it.cost_category === 'fleet')
                            const isMaterial = pItems.length > 0 && pItems.some((it: any) => it.cost_category === 'material')
                            const isOverdue = p.due_date && isBefore(new Date(p.due_date + 'T00:00:00'), new Date())
                            const daysOverdue = p.due_date ? differenceInDays(new Date(), new Date(p.due_date + 'T00:00:00')) : 0
                            const isPending = p.status === 'open' || p.status === 'partially_paid'

                            return (
                              <div key={p.id} className="border rounded-md p-4 bg-white shadow-sm">
                                {/* Type & status badges */}
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  {isFleet && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                      <Truck className="h-3 w-3" />FLOTA
                                    </span>
                                  )}
                                  {isMaterial && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                                      <Package className="h-3 w-3" />MATERIAL
                                    </span>
                                  )}
                                  {pItems.length === 0 && (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">SIN PARTIDAS</span>
                                  )}
                                  {isOverdue && isPending && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium">
                                      <AlertTriangle className="h-3 w-3" />
                                      VENCIDA {daysOverdue > 0 ? `${daysOverdue}d` : ''}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                      <span className="font-mono text-base font-semibold">{p.invoice_number}</span>
                                      {statusBadge(p.status)}
                                    </div>
                                    <div className="text-xs text-gray-600 space-y-0.5">
                                      <div>
                                        Vencimiento:{' '}
                                        <span className={isOverdue && isPending ? 'font-semibold text-red-600' : 'font-medium'}>
                                          {p.due_date
                                            ? format(new Date(p.due_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })
                                            : '—'}
                                        </span>
                                      </div>
                                      {p.invoice_date && (
                                        <div>Fecha factura: {format(new Date(p.invoice_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0 min-w-[120px]">
                                    <div className="text-xs text-gray-500">Subtotal</div>
                                    <div className="text-sm font-medium">{mxn.format(p.subtotal)}</div>
                                    <div className="text-xs text-gray-500 mt-1">IVA ({Math.round(p.vat_rate * 100)}%)</div>
                                    <div className="text-xs">{mxn.format(p.tax)}</div>
                                    <div className="text-xs text-gray-500 mt-1 pt-1 border-t">Total</div>
                                    <div className="text-base font-bold">{mxn.format(p.total)}</div>
                                    {(p.status === 'partially_paid' || p.status === 'paid') && p.amount_paid != null && (
                                      <>
                                        <div className="text-xs text-gray-500 mt-1">Pagado</div>
                                        <div className="text-sm font-medium text-green-600">{mxn.format(p.amount_paid)}</div>
                                        {p.status === 'partially_paid' && (
                                          <>
                                            <div className="text-xs text-gray-500 mt-0.5">Pendiente</div>
                                            <div className="text-sm font-medium">{mxn.format(p.total - (p.amount_paid ?? 0))}</div>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {p.status === 'open' && (
                                      <>
                                        <div className="text-xs text-gray-500 mt-0.5">Pendiente</div>
                                        <div className="text-sm font-medium">{mxn.format(p.total)}</div>
                                      </>
                                    )}
                                  </div>

                                  <div className="shrink-0">
                                    {isPending && (
                                      <Button
                                        size="sm"
                                        onClick={() => setSelected(p)}
                                        className={isOverdue ? 'bg-red-600 hover:bg-red-700' : ''}
                                      >
                                        Registrar Pago
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {p.payment_history && p.payment_history.length > 0 && (
                                  <div className="mt-3 rounded-md bg-muted/50 p-2.5 text-xs border border-border/60">
                                    <div className="font-semibold text-gray-700 mb-1.5">Historial de pagos</div>
                                    <ul className="space-y-1">
                                      {p.payment_history.slice(0, 10).map((ph, idx) => (
                                        <li key={idx} className="flex justify-between gap-2">
                                          <span className="text-muted-foreground">
                                            {format(new Date(ph.payment_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                                            {ph.reference ? ` · ${ph.reference}` : ''}
                                          </span>
                                          <span className="font-mono font-medium tabular-nums">{mxn.format(ph.amount)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Payable items */}
                                {pItems.length > 0 ? (
                                  <div className="mt-4 pt-3 border-t">
                                    <div className="text-xs font-semibold text-gray-700 mb-2">Desglose de Partidas</div>
                                    <div className="space-y-1.5">
                                      {pItems.map((it: any) => {
                                        const fleet = it.cost_category === 'fleet'
                                        const isOrphanLine = it.entry == null
                                        const canDeleteThisLine =
                                          canDeleteOrphanPayableItems &&
                                          isOrphanLine &&
                                          p.status === 'open' &&
                                          (p.amount_paid ?? 0) < 0.005 &&
                                          (!p.payment_history || p.payment_history.length === 0)
                                        return (
                                          <div key={it.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded">
                                            <div className="flex items-center gap-3 flex-wrap">
                                              <span className={`text-xs font-medium ${fleet ? 'text-blue-700' : 'text-green-700'}`}>
                                                {fleet ? 'Flota' : 'Material'}
                                              </span>
                                              {isOrphanLine && (
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                                                  Sin entrada
                                                </span>
                                              )}
                                              {it.entry?.entry_number && (
                                                <span className="font-mono text-sm">{it.entry.entry_number}</span>
                                              )}
                                              {!fleet && it.entry?.po_id && (
                                                <Link
                                                  href={`/finanzas/procurement?tab=po&po_id=${it.entry.po_id}`}
                                                  className="inline-flex items-center gap-1 text-xs text-primary bg-green-50 px-2 py-0.5 rounded border border-green-200 hover:underline"
                                                >
                                                  <ExternalLink className="h-3 w-3" />Ver PO
                                                </Link>
                                              )}
                                              {fleet && it.entry?.fleet_po_id && (
                                                <Link
                                                  href={`/finanzas/procurement?tab=po&po_id=${it.entry.fleet_po_id}`}
                                                  className="inline-flex items-center gap-1 text-xs text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:underline"
                                                >
                                                  <ExternalLink className="h-3 w-3" />Ver PO Flota
                                                </Link>
                                              )}
                                              {!fleet && it.entry?.entry_date && (
                                                <span className="text-xs text-gray-500">
                                                  {format(new Date(it.entry.entry_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                              {!fleet && it.entry?.quantity_received !== undefined && (
                                                <span className="text-xs">
                                                  Cant: <b>{Number(it.entry.received_qty_entered ?? it.entry.quantity_received).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</b> {it.entry.received_uom || 'kg'}
                                                </span>
                                              )}
                                              {!fleet && it.entry?.unit_price !== undefined && (
                                                <span className="text-xs">
                                                  P.U.: <b>{mxn.format(Number(it.entry.unit_price))}</b>
                                                </span>
                                              )}
                                              <div className="text-right flex items-center gap-2 justify-end">
                                                <div>
                                                  <span className="text-sm font-semibold">{mxn.format(Number(it.amount))}</span>
                                                  {it.entry?.po_item && !fleet && (
                                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                                      Avance PO: {Number(it.entry.po_item.qty_received_native ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} / {Number(it.entry.po_item.qty_ordered || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {it.entry.po_item.uom || ''}
                                                    </div>
                                                  )}
                                                </div>
                                                {canDeleteThisLine && (
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                                                    title="Quitar partida huérfana"
                                                    onClick={() =>
                                                      setPayableItemDelete({
                                                        itemId: it.id,
                                                        invoiceLabel: p.invoice_number || p.id.slice(0, 8),
                                                      })
                                                    }
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                    Sin partidas vinculadas. Esta cuenta fue creada antes de la migración o no tiene entradas asociadas.
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Factura</TableHead>
                      <TableHead className="text-xs">Proveedor</TableHead>
                      <TableHead className="text-xs">Vence</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs text-right">Pendiente</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                      <TableHead className="text-xs text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flatPageSlice.map(p => {
                      const pend = p.total - (p.amount_paid ?? 0)
                      const isPending = p.status === 'open' || p.status === 'partially_paid'
                      const isOverdue = !!(p.due_date && isBefore(new Date(p.due_date + 'T00:00:00'), new Date()) && isPending)
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.invoice_number}</TableCell>
                          <TableCell className="text-xs max-w-[180px] truncate">{p.supplier_name || p.supplier_id}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {p.due_date ? format(new Date(p.due_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es }) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{mxn.format(p.total)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{mxn.format(isPending ? pend : 0)}</TableCell>
                          <TableCell className="text-xs">{statusBadge(p.status)}</TableCell>
                          <TableCell className="text-right">
                            {isPending && (
                              <Button
                                size="sm"
                                className="h-8"
                                variant={isOverdue ? 'destructive' : 'default'}
                                onClick={() => setSelected(p)}
                              >
                                Pago
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground text-xs">
                  {flatSorted.length === 0
                    ? 'Sin filas'
                    : `Mostrando ${flatPage * flatPageSize + 1}–${Math.min(flatPage * flatPageSize + flatPageSlice.length, flatSorted.length)} de ${flatSorted.length}`}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={String(flatPageSize)} onValueChange={v => { setFlatPageSize(Number(v)); setFlatPage(0) }}>
                    <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / página</SelectItem>
                      <SelectItem value="25">25 / página</SelectItem>
                      <SelectItem value="50">50 / página</SelectItem>
                      <SelectItem value="100">100 / página</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" disabled={flatPage <= 0} onClick={() => setFlatPage(0)}>Primera</Button>
                  <Button variant="outline" size="sm" disabled={flatPage <= 0} onClick={() => setFlatPage(pp => Math.max(0, pp - 1))}>Anterior</Button>
                  <span className="text-xs text-muted-foreground tabular-nums px-1">{flatPage + 1} / {flatTotalPages}</span>
                  <Button variant="outline" size="sm" disabled={flatPage >= flatTotalPages - 1} onClick={() => setFlatPage(pp => Math.min(flatTotalPages - 1, pp + 1))}>Siguiente</Button>
                  <Button variant="outline" size="sm" disabled={flatPage >= flatTotalPages - 1} onClick={() => setFlatPage(flatTotalPages - 1)}>Última</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!payableItemDelete}
        onOpenChange={(open) => !open && !payableItemDeleteLoading && setPayableItemDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar partida sin entrada?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Se quitará la línea de la factura <span className="font-mono font-medium text-foreground">{payableItemDelete?.invoiceLabel}</span>.
                Solo aplica a partidas que no tienen una entrada de inventario vinculada (o la entrada ya no existe), con factura en estado{' '}
                <strong>Abierto</strong> y sin pagos registrados. Si era la única línea, se eliminará también el registro de CXP.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={payableItemDeleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={payableItemDeleteLoading}
              onClick={(e) => {
                e.preventDefault()
                void runPayableItemDelete()
              }}
            >
              {payableItemDeleteLoading ? 'Eliminando…' : 'Eliminar partida'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selected && (
        <RecordPaymentModal
          payable={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); setRefreshKey(k => k + 1) }}
        />
      )}
    </div>
  )
}
