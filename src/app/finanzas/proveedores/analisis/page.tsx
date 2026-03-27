'use client'

import React, { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlantContext } from '@/contexts/PlantContext'
import Link from 'next/link'
import { BarChart3, ExternalLink, TrendingUp, Package, Truck, DollarSign, Download, Search, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

type SupplierRow = {
  supplier_id: string
  supplier_name: string
  material_purchases: number
  fleet_purchases: number
  total_purchases: number
  deliveries_count: number
  fleet_trips: number
  discounts: number
  invoices_pending: number
  paid_in_period: number
}

type SortKey = keyof Omit<SupplierRow, 'supplier_id' | 'supplier_name'>
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50 ml-1 inline" />
  return sortDir === 'desc'
    ? <ChevronDown className="h-3 w-3 text-primary ml-1 inline" />
    : <ChevronUp className="h-3 w-3 text-primary ml-1 inline" />
}

export default function SupplierAnalysisPage() {
  const { availablePlants } = usePlantContext()
  const [loading, setLoading] = useState(true)
  const [plant, setPlant] = useState<string>('')
  const [period, setPeriod] = useState<string>('') // '' = last 12 months, 'YYYY-MM' = specific month, 'last_24' = 24 months
  const [data, setData] = useState<{
    summary: { period: string; total_purchases: number; total_discounts: number; suppliers_count: number }
    by_supplier: SupplierRow[]
    monthly_trend: Array<{ month: string; total: number; material: number; fleet: number }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string>('')
  const [sortKey, setSortKey] = useState<SortKey>('total_purchases')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [typeFilter, setTypeFilter] = useState<'all' | 'material' | 'fleet'>('all')
  const [detailSupplier, setDetailSupplier] = useState<SupplierRow | null>(null)

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const months = useMemo(() => {
    const arr: string[] = []
    const now = new Date()
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return arr
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (plant) params.set('plant_id', plant)
    if (period && period !== 'last_12' && period !== 'last_24') params.set('month', period)
    if (period === 'last_24') params.set('months_range', '24')

    fetch(`/api/finanzas/supplier-analysis?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar')
        return res.json()
      })
      .then(setData)
      .catch(e => setError(e.message || 'Error al cargar análisis'))
      .finally(() => setLoading(false))
  }, [plant, period])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filteredAndSorted = useMemo(() => {
    if (!data?.by_supplier) return []
    const q = search.toLowerCase().trim()
    let filtered = q
      ? data.by_supplier.filter(s => s.supplier_name.toLowerCase().includes(q))
      : [...data.by_supplier]
    if (typeFilter === 'material') filtered = filtered.filter(s => s.material_purchases > 0)
    if (typeFilter === 'fleet') filtered = filtered.filter(s => s.fleet_purchases > 0)
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [data?.by_supplier, search, sortKey, sortDir, typeFilter])

  const concentration = useMemo(() => {
    if (!filteredAndSorted.length) return null
    const sorted = [...filteredAndSorted].sort((a, b) => b.total_purchases - a.total_purchases)
    const total = sorted.reduce((sum, s) => sum + s.total_purchases, 0)
    if (total <= 0) return null
    const top3Sum = sorted.slice(0, 3).reduce((sum, s) => sum + s.total_purchases, 0)
    const top3Suppliers = sorted.slice(0, 3).map(s => ({ name: s.supplier_name, amount: s.total_purchases }))
    return { pct: (top3Sum / total) * 100, top3Sum, total, top3Suppliers }
  }, [filteredAndSorted])

  const totals = useMemo(() => {
    if (!filteredAndSorted.length) return null
    return filteredAndSorted.reduce(
      (acc, s) => ({
        material_purchases: acc.material_purchases + s.material_purchases,
        fleet_purchases: acc.fleet_purchases + s.fleet_purchases,
        total_purchases: acc.total_purchases + s.total_purchases,
        deliveries_count: acc.deliveries_count + s.deliveries_count,
        fleet_trips: acc.fleet_trips + s.fleet_trips,
        discounts: acc.discounts + s.discounts,
        invoices_pending: acc.invoices_pending + s.invoices_pending,
        paid_in_period: acc.paid_in_period + s.paid_in_period,
      }),
      { material_purchases: 0, fleet_purchases: 0, total_purchases: 0, deliveries_count: 0, fleet_trips: 0, discounts: 0, invoices_pending: 0, paid_in_period: 0 }
    )
  }, [filteredAndSorted])

  const exportExcel = async () => {
    if (!filteredAndSorted.length) return
    const XLSX = await import('xlsx')
    const rows = filteredAndSorted.map(s => ({
      Proveedor: s.supplier_name,
      Material: s.material_purchases,
      Flota: s.fleet_purchases,
      Total: s.total_purchases,
      Entregas: s.deliveries_count,
      Fletes: s.fleet_trips,
      Descuentos: s.discounts,
      CXP_Pendiente: s.invoices_pending,
      Pagado_Periodo: s.paid_in_period,
    }))
    if (totals) {
      rows.push({
        Proveedor: 'TOTAL',
        Material: totals.material_purchases,
        Flota: totals.fleet_purchases,
        Total: totals.total_purchases,
        Entregas: totals.deliveries_count,
        Fletes: totals.fleet_trips,
        Descuentos: totals.discounts,
        CXP_Pendiente: totals.invoices_pending,
        Pagado_Periodo: totals.paid_in_period,
      })
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `analisis_proveedores_${data?.summary.period.replace(/\s/g, '_') || 'export'}_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const chartOptions = useMemo(() => {
    if (!data?.monthly_trend?.length) return null
    return {
      chart: { type: 'bar' as const, toolbar: { show: false } },
      xaxis: {
        categories: data.monthly_trend.map(t => {
          const [y, m] = t.month.split('-')
          return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
        }),
      },
      plotOptions: { bar: { horizontal: false, columnWidth: '60%' } },
      dataLabels: { enabled: false },
      legend: { position: 'top' as const },
      colors: ['#10b981', '#3b82f6'],
      tooltip: { y: { formatter: (v: number) => mxn.format(v) } },
    }
  }, [data?.monthly_trend, mxn])

  const chartSeries = useMemo(() => {
    if (!data?.monthly_trend?.length) return []
    return [
      { name: 'Material', data: data.monthly_trend.map(t => Math.round(t.material * 100) / 100) },
      { name: 'Flota', data: data.monthly_trend.map(t => Math.round(t.fleet * 100) / 100) },
    ]
  }, [data?.monthly_trend])

  const SortTh = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="py-2 pr-4 text-right font-medium cursor-pointer select-none hover:text-primary whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      {label}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </th>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Análisis de Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compras por proveedor: materiales, flota, descuentos y facturas pendientes
          </p>
        </div>
        {data && (
          <Button variant="outline" onClick={exportExcel} className="gap-2" disabled={filteredAndSorted.length === 0}>
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Planta y período a analizar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Planta</label>
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
              <label className="text-xs text-muted-foreground">Período</label>
              <Select value={period || 'last_12'} onValueChange={v => setPeriod(v === 'last_12' ? '' : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Últimos 12 meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_12">Últimos 12 meses</SelectItem>
                  <SelectItem value="last_24">Últimos 24 meses</SelectItem>
                  {months.map(m => {
                    const [y, mo] = m.split('-')
                    const d = new Date(parseInt(y), parseInt(mo) - 1)
                    return (
                      <SelectItem key={m} value={m}>
                        {d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo de compra</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  { id: 'all' as const, label: 'Todos' },
                  { id: 'material' as const, label: 'Solo material' },
                  { id: 'fleet' as const, label: 'Solo flota' },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTypeFilter(opt.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      typeFilter === opt.id
                        ? 'border-stone-800 bg-stone-900 text-white'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-600">{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => setLoading(true)}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />Total Compras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mxn.format(data.summary.total_purchases)}</div>
                <p className="text-xs text-muted-foreground mt-1">{data.summary.period}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-green-600" />Material
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {mxn.format(data.by_supplier.reduce((s, r) => s + r.material_purchases, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.summary.total_purchases > 0
                    ? `${(data.by_supplier.reduce((s, r) => s + r.material_purchases, 0) / data.summary.total_purchases * 100).toFixed(1)}% del total`
                    : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" />Flota
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {mxn.format(data.by_supplier.reduce((s, r) => s + r.fleet_purchases, 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.summary.total_purchases > 0
                    ? `${(data.by_supplier.reduce((s, r) => s + r.fleet_purchases, 0) / data.summary.total_purchases * 100).toFixed(1)}% del total`
                    : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />Descuentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">-{mxn.format(data.summary.total_discounts)}</div>
                <p className="text-xs text-muted-foreground mt-1">{data.summary.suppliers_count} proveedores activos</p>
              </CardContent>
            </Card>
          </div>

          {concentration && (
            <Card className={concentration.pct >= 55 ? 'border-amber-300 bg-amber-50/50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {concentration.pct >= 55 && <AlertTriangle className="h-4 w-4 text-amber-700" />}
                  Riesgo de concentración
                </CardTitle>
                <CardDescription>
                  Participación de las 3 principales empresas en el total de compras del listado actual
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-baseline gap-4">
                <div className="text-3xl font-bold tabular-nums">{concentration.pct.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">
                  Top 3: {concentration.top3Suppliers.map(t => t.name).join(' · ')} ·{' '}
                  <span className="font-medium text-foreground">{mxn.format(concentration.top3Sum)}</span> de{' '}
                  <span className="font-medium">{mxn.format(concentration.total)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trend chart */}
          {data.monthly_trend?.length > 0 && chartOptions && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Tendencia Mensual de Compras
                </CardTitle>
                <CardDescription>Material vs. Flota · {data.summary.period}</CardDescription>
              </CardHeader>
              <CardContent>
                <Chart options={chartOptions} series={chartSeries} type="bar" height={300} />
              </CardContent>
            </Card>
          )}

          {/* Supplier table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle>Por Proveedor</CardTitle>
                  <CardDescription>
                    {filteredAndSorted.length} de {data.by_supplier.length} proveedores
                    {search && ` · filtrado por "${search}"`}
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar proveedor..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b bg-muted/20">
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <SortTh label="Material" col="material_purchases" />
                      <SortTh label="Flota" col="fleet_purchases" />
                      <SortTh label="Total" col="total_purchases" />
                      <SortTh label="Entregas" col="deliveries_count" />
                      <SortTh label="Fletes" col="fleet_trips" />
                      <SortTh label="Descuentos" col="discounts" />
                      <SortTh label="CXP Pend." col="invoices_pending" />
                      <SortTh label="Pagado" col="paid_in_period" />
                      <th className="py-2 pl-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.map(s => (
                      <tr
                        key={s.supplier_id}
                        role="button"
                        tabIndex={0}
                        className="border-b hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => setDetailSupplier(s)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setDetailSupplier(s)
                          }
                        }}
                      >
                        <td className="py-2.5 pr-4 font-medium">{s.supplier_name}</td>
                        <td className="py-2.5 pr-4 text-right text-green-700 tabular-num">{mxn.format(s.material_purchases)}</td>
                        <td className="py-2.5 pr-4 text-right text-blue-700 tabular-num">{mxn.format(s.fleet_purchases)}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold tabular-num">{mxn.format(s.total_purchases)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-num">{s.deliveries_count}</td>
                        <td className="py-2.5 pr-4 text-right tabular-num">{s.fleet_trips.toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                        <td className="py-2.5 pr-4 text-right text-orange-600 tabular-num">
                          {s.discounts > 0 ? `-${mxn.format(s.discounts)}` : '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-num">
                          <span className={s.invoices_pending > 0 ? 'text-amber-700 font-medium' : 'text-muted-foreground/50'}>
                            {s.invoices_pending > 0 ? mxn.format(s.invoices_pending) : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-green-600 tabular-num">{mxn.format(s.paid_in_period)}</td>
                        <td className="py-2.5 pl-2">
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Link
                              href={`/finanzas/po?supplier_id=${s.supplier_id}`}
                              className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                            >
                              <ExternalLink className="h-3 w-3" />POs
                            </Link>
                            <span className="text-border">·</span>
                            <Link
                              href={`/finanzas/cxp?supplier_id=${s.supplier_id}`}
                              className="text-primary hover:underline text-xs"
                            >
                              CXP
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    {totals && filteredAndSorted.length > 1 && (
                      <tr className="border-t-2 bg-muted/30 font-semibold">
                        <td className="py-2.5 pr-4">TOTAL ({filteredAndSorted.length})</td>
                        <td className="py-2.5 pr-4 text-right text-green-700 tabular-num">{mxn.format(totals.material_purchases)}</td>
                        <td className="py-2.5 pr-4 text-right text-blue-700 tabular-num">{mxn.format(totals.fleet_purchases)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-num">{mxn.format(totals.total_purchases)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-num">{totals.deliveries_count}</td>
                        <td className="py-2.5 pr-4 text-right tabular-num">{totals.fleet_trips.toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                        <td className="py-2.5 pr-4 text-right text-orange-600 tabular-num">-{mxn.format(totals.discounts)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-num">{mxn.format(totals.invoices_pending)}</td>
                        <td className="py-2.5 pr-4 text-right text-green-600 tabular-num">{mxn.format(totals.paid_in_period)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredAndSorted.length === 0 && (
                <div className="flex items-center gap-3 px-1 py-5">
                  <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    {search
                      ? `Sin resultados para "${search}"`
                      : 'Sin datos para los filtros seleccionados'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Sheet open={!!detailSupplier} onOpenChange={open => { if (!open) setDetailSupplier(null) }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {detailSupplier && (
            <>
              <SheetHeader>
                <SheetTitle>{detailSupplier.supplier_name}</SheetTitle>
                <SheetDescription>
                  Resumen en {data?.summary.period ?? 'el período seleccionado'} · Clic en la fila para abrir
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Material</div>
                    <div className="font-semibold text-green-700 tabular-nums">{mxn.format(detailSupplier.material_purchases)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Flota</div>
                    <div className="font-semibold text-blue-700 tabular-nums">{mxn.format(detailSupplier.fleet_purchases)}</div>
                  </div>
                  <div className="rounded-lg border p-3 col-span-2">
                    <div className="text-xs text-muted-foreground">Total compras</div>
                    <div className="text-lg font-bold tabular-nums">{mxn.format(detailSupplier.total_purchases)}</div>
                  </div>
                </div>
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between"><span className="text-muted-foreground">Entregas (material)</span><span className="tabular-nums font-medium">{detailSupplier.deliveries_count}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Viajes / fletes</span><span className="tabular-nums font-medium">{detailSupplier.fleet_trips.toLocaleString('es-MX', { maximumFractionDigits: 1 })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Descuentos</span><span className="tabular-nums font-medium text-orange-600">{detailSupplier.discounts > 0 ? `-${mxn.format(detailSupplier.discounts)}` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CXP pendiente</span><span className="tabular-nums font-medium">{detailSupplier.invoices_pending > 0 ? mxn.format(detailSupplier.invoices_pending) : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pagado en período</span><span className="tabular-nums font-medium text-green-600">{mxn.format(detailSupplier.paid_in_period)}</span></div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild variant="default" size="sm" className="gap-1">
                    <Link href={`/finanzas/po?supplier_id=${detailSupplier.supplier_id}`}>
                      <ExternalLink className="h-3.5 w-3.5" /> Órdenes de compra
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/finanzas/cxp?supplier_id=${detailSupplier.supplier_id}`}>Cuentas por pagar</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
