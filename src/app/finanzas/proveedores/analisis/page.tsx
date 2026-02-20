'use client'

import React, { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePlantContext } from '@/contexts/PlantContext'
import Link from 'next/link'
import { BarChart3, ExternalLink, TrendingUp, Package, Truck, DollarSign, Download } from 'lucide-react'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

export default function SupplierAnalysisPage() {
  const { availablePlants } = usePlantContext()
  const [loading, setLoading] = useState(true)
  const [plant, setPlant] = useState<string>('')
  const [month, setMonth] = useState<string>('')
  const [data, setData] = useState<{
    summary: { period: string; total_purchases: number; total_discounts: number; suppliers_count: number }
    by_supplier: Array<{
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
    }>
    monthly_trend: Array<{ month: string; total: number; material: number; fleet: number }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const exportExcel = async () => {
    if (!data) return
    const XLSX = await import('xlsx')
    const rows = data.by_supplier.map(s => ({
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
    rows.push({
      Proveedor: 'TOTAL',
      Material: rows.reduce((sum, r) => sum + r.Material, 0),
      Flota: rows.reduce((sum, r) => sum + r.Flota, 0),
      Total: rows.reduce((sum, r) => sum + r.Total, 0),
      Entregas: rows.reduce((sum, r) => sum + r.Entregas, 0),
      Fletes: rows.reduce((sum, r) => sum + r.Fletes, 0),
      Descuentos: rows.reduce((sum, r) => sum + r.Descuentos, 0),
      CXP_Pendiente: rows.reduce((sum, r) => sum + r.CXP_Pendiente, 0),
      Pagado_Periodo: rows.reduce((sum, r) => sum + r.Pagado_Periodo, 0),
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `analisis_proveedores_${data.summary.period.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const months = useMemo(() => {
    const arr: string[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
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
    if (month) params.set('month', month)
    fetch(`/api/finanzas/supplier-analysis?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar')
        return res.json()
      })
      .then(setData)
      .catch(e => {
        setError(e.message || 'Error al cargar análisis')
      })
      .finally(() => setLoading(false))
  }, [plant, month])

  const chartOptions = useMemo(() => {
    if (!data?.monthly_trend?.length) return null
    return {
      chart: { type: 'bar' as const },
      xaxis: {
        categories: data.monthly_trend.map(t => {
          const [y, m] = t.month.split('-')
          const d = new Date(parseInt(y), parseInt(m) - 1)
          return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
        }),
      },
      plotOptions: {
        bar: { horizontal: false, columnWidth: '60%' },
      },
      dataLabels: { enabled: false },
      legend: { position: 'top' as const },
      colors: ['#10b981', '#3b82f6'],
    }
  }, [data?.monthly_trend])

  const chartSeries = useMemo(() => {
    if (!data?.monthly_trend?.length) return []
    return [
      { name: 'Material', data: data.monthly_trend.map(t => Math.round(t.material * 100) / 100) },
      { name: 'Flota', data: data.monthly_trend.map(t => Math.round(t.fleet * 100) / 100) },
    ]
  }, [data?.monthly_trend])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Análisis de Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compras por proveedor: materiales, flota, descuentos y facturas pendientes
          </p>
        </div>
        {data && (
          <Button variant="outline" onClick={exportExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Planta y período a analizar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500">Planta</label>
              <Select value={plant || '_all'} onValueChange={(v) => setPlant(v === '_all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas las plantas</SelectItem>
                  {availablePlants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Mes</label>
              <Select value={month || '_range'} onValueChange={(v) => setMonth(v === '_range' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Últimos 12 meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_range">Últimos 12 meses</SelectItem>
                  {months.map((m) => {
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
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <div className="animate-pulse h-24 bg-gray-200 rounded-lg" />
          <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Compras
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
                  <TrendingUp className="h-4 w-4" />
                  Descuentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">-{mxn.format(data.summary.total_discounts)}</div>
                <p className="text-xs text-muted-foreground mt-1">{data.summary.suppliers_count} proveedores</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Proveedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.suppliers_count}</div>
              </CardContent>
            </Card>
          </div>

          {data.monthly_trend?.length > 0 && chartOptions && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Tendencia mensual
                </CardTitle>
                <CardDescription>Compras material vs flota</CardDescription>
              </CardHeader>
              <CardContent>
                <Chart options={chartOptions} series={chartSeries} type="bar" height={300} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Por proveedor</CardTitle>
              <CardDescription>Ordenado por total de compras</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4 font-medium">Proveedor</th>
                      <th className="py-2 pr-4 text-right font-medium">Material</th>
                      <th className="py-2 pr-4 text-right font-medium">Flota</th>
                      <th className="py-2 pr-4 text-right font-medium">Total</th>
                      <th className="py-2 pr-4 text-right font-medium">Entregas</th>
                      <th className="py-2 pr-4 text-right font-medium">Fletes</th>
                      <th className="py-2 pr-4 text-right font-medium">Descuentos</th>
                      <th className="py-2 pr-4 text-right font-medium">CXP pend.</th>
                      <th className="py-2 pr-4 text-right font-medium">Pagado</th>
                      <th className="py-2 pl-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_supplier.map((s) => (
                      <tr key={s.supplier_id} className="border-b hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium">{s.supplier_name}</td>
                        <td className="py-2 pr-4 text-right">{mxn.format(s.material_purchases)}</td>
                        <td className="py-2 pr-4 text-right">{mxn.format(s.fleet_purchases)}</td>
                        <td className="py-2 pr-4 text-right font-semibold">{mxn.format(s.total_purchases)}</td>
                        <td className="py-2 pr-4 text-right">{s.deliveries_count}</td>
                        <td className="py-2 pr-4 text-right">{s.fleet_trips.toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                        <td className="py-2 pr-4 text-right text-orange-600">-{mxn.format(s.discounts)}</td>
                        <td className="py-2 pr-4 text-right">{mxn.format(s.invoices_pending)}</td>
                        <td className="py-2 pr-4 text-right text-green-600">{mxn.format(s.paid_in_period)}</td>
                        <td className="py-2 pl-4">
                          <Link
                            href={`/finanzas/po?supplier_id=${s.supplier_id}`}
                            className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver POs
                          </Link>
                          <span className="mx-1">·</span>
                          <Link
                            href={`/finanzas/cxp?supplier_id=${s.supplier_id}`}
                            className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                          >
                            Ver CXP
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.by_supplier.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  No hay datos para los filtros seleccionados
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
