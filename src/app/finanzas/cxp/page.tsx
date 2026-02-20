'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { format, isAfter, isBefore, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle, Clock, Truck, Package } from 'lucide-react'
import type { Payable, PayableStatus } from '@/types/finance'
import RecordPaymentModal from '@/components/finanzas/RecordPaymentModal'

type PayableWithSupplier = Payable & {
  supplier_name?: string
  amount_paid?: number
}

export default function CxpPage() {
  const [loading, setLoading] = useState(true)
  const [payables, setPayables] = useState<PayableWithSupplier[]>([])
  const [status, setStatus] = useState<PayableStatus | 'all'>('all')
  const [dueFrom, setDueFrom] = useState<string>('')
  const [dueTo, setDueTo] = useState<string>('')
  const [invoice, setInvoice] = useState<string>('')
  const [selected, setSelected] = useState<PayableWithSupplier | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  // Calculate KPIs
  const kpis = useMemo(() => {
    const today = new Date()
    const in7Days = addDays(today, 7)
    
    const openPayables = payables.filter(p => p.status === 'open' || p.status === 'partially_paid')
    const overdue = openPayables.filter(p => p.due_date && isBefore(new Date(p.due_date + 'T00:00:00'), today))
    const dueSoon = openPayables.filter(p => {
      if (!p.due_date) return false
      const dueDate = new Date(p.due_date + 'T00:00:00')
      return isAfter(dueDate, today) && isBefore(dueDate, in7Days)
    })
    
    const totalOpen = openPayables.reduce((sum, p) => sum + p.total, 0)
    const totalOverdue = overdue.reduce((sum, p) => sum + p.total, 0)
    const totalDueSoon = dueSoon.reduce((sum, p) => sum + p.total, 0)
    
    // Material vs Fleet breakdown
    const materialPayables = payables.filter(p => {
      const items = (p as any).items || []
      return items.some((it: any) => it.cost_category === 'material')
    })
    const fleetPayables = payables.filter(p => {
      const items = (p as any).items || []
      return items.some((it: any) => it.cost_category === 'fleet')
    })
    
    const totalMaterial = materialPayables.reduce((sum, p) => sum + (p.status !== 'paid' && p.status !== 'void' ? p.total : 0), 0)
    const totalFleet = fleetPayables.reduce((sum, p) => sum + (p.status !== 'paid' && p.status !== 'void' ? p.total : 0), 0)
    
    return {
      totalOpen,
      totalOverdue,
      totalDueSoon,
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      openCount: openPayables.length,
      totalMaterial,
      totalFleet,
      materialCount: materialPayables.filter(p => p.status === 'open' || p.status === 'partially_paid').length,
      fleetCount: fleetPayables.filter(p => p.status === 'open' || p.status === 'partially_paid').length,
    }
  }, [payables])

  useEffect(() => {
    fetchPayables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dueFrom, dueTo, invoice, refreshKey])

  const fetchPayables = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status && status !== 'all') params.set('status', status)
      if (dueFrom) params.set('due_from', dueFrom)
      if (dueTo) params.set('due_to', dueTo)
      if (invoice) params.set('invoice_number', invoice)

      params.set('include', 'items')
      const res = await fetch(`/api/ap/payables?${params.toString()}`)
      if (!res.ok) throw new Error('Error al cargar CXP')
      const data = await res.json()
      setPayables(data.payables || [])
    } catch (e) {
      console.error(e)
      toast.error('No se pudieron cargar las cuentas por pagar')
    } finally {
      setLoading(false)
    }
  }

  const onPaymentSaved = () => {
    setSelected(null)
    setRefreshKey(k => k + 1)
  }

  const statusBadge = (s: PayableStatus) => {
    const colors: Record<PayableStatus, string> = {
      open: 'bg-yellow-100 text-yellow-800',
      partially_paid: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      void: 'bg-gray-100 text-gray-700',
    }
    const labels: Record<PayableStatus, string> = {
      open: 'Abierto',
      partially_paid: 'Parcialmente Pagado',
      paid: 'Pagado',
      void: 'Anulado',
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[s]}`}>{labels[s] ?? s}</span>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de cuentas por pagar de materiales y flota</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Las cuentas aparecen cuando se registran entradas de material con factura del proveedor y fecha de vencimiento. No todas las órdenes de compra generan CXP hasta que se reciba el material y se capture la factura.
          </p>
        </div>
        <Button onClick={() => setRefreshKey(k => k + 1)}>Actualizar</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total por Pagar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mxn.format(kpis.totalOpen)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.openCount} {kpis.openCount === 1 ? 'cuenta abierta' : 'cuentas abiertas'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{mxn.format(kpis.totalOverdue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.overdueCount} {kpis.overdueCount === 1 ? 'cuenta vencida' : 'cuentas vencidas'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Vencer (7 días)</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{mxn.format(kpis.totalDueSoon)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.dueSoonCount} {kpis.dueSoonCount === 1 ? 'cuenta' : 'cuentas'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desglose por Tipo</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-3 w-3 text-green-600" />
                  <span className="text-xs">Materiales</span>
                </div>
                <span className="text-sm font-semibold">{mxn.format(kpis.totalMaterial)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-3 w-3 text-blue-600" />
                  <span className="text-xs">Flota</span>
                </div>
                <span className="text-sm font-semibold">{mxn.format(kpis.totalFleet)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtra las cuentas por pagar por estado, fecha de vencimiento o número de factura</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500">Estatus</label>
              <Select value={status} onValueChange={(v) => setStatus(v as PayableStatus | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
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
              <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Vence hasta</label>
              <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Factura</label>
              <Input placeholder="Buscar por factura" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Listado de Cuentas</CardTitle>
              <CardDescription>
                {!loading && payables.length > 0 && `${payables.length} ${payables.length === 1 ? 'cuenta encontrada' : 'cuentas encontradas'}`}
              </CardDescription>
            </div>
            {!loading && payables.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStatus('open')}>
                  Ver Abiertas
                </Button>
                <Button variant="outline" size="sm" onClick={() => setStatus('all')}>
                  Ver Todas
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-sm text-gray-500">Cargando cuentas por pagar...</div>
              </div>
            </div>
          ) : payables.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <div className="text-sm font-medium text-gray-900">No hay cuentas por pagar</div>
                <div className="text-xs text-gray-500 mt-1">Intenta ajustar los filtros o agregar nuevas entradas</div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(
                payables.reduce((acc: Record<string, PayableWithSupplier[]>, p) => {
                  const key = p.supplier_name || p.supplier_id
                  if (!acc[key]) acc[key] = []
                  acc[key].push(p)
                  return acc
                }, {})
              ).map(([supplier, items]) => {
                const supplierTotal = items.reduce((sum, p) => sum + p.total, 0)
                const supplierOpen = items.filter(p => p.status === 'open' || p.status === 'partially_paid').reduce((sum, p) => sum + p.total, 0)
                
                return (
                <div key={supplier} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-base font-semibold text-gray-900">{supplier}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {items.length} {items.length === 1 ? 'factura' : 'facturas'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Total pendiente</div>
                      <div className="text-lg font-bold">{mxn.format(supplierOpen)}</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {items.map(p => {
                      const pItems = (p as any).items || []
                      const isFleetPayable = pItems.length > 0 && pItems.some((it: any) => it.cost_category === 'fleet')
                      const isMaterialPayable = pItems.length > 0 && pItems.some((it: any) => it.cost_category === 'material')
                      const isOverdue = p.due_date && isBefore(new Date(p.due_date + 'T00:00:00'), new Date())
                      
                      return (
                      <div key={p.id} className="border rounded-md p-4 bg-white shadow-sm">
                        {/* Header with badges */}
                        <div className="flex items-center gap-2 mb-3">
                          {isFleetPayable && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">FLOTA</span>
                          )}
                          {isMaterialPayable && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">MATERIAL</span>
                          )}
                          {pItems.length === 0 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">SIN PARTIDAS</span>
                          )}
                          {isOverdue && (p.status === 'open' || p.status === 'partially_paid') && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-medium">VENCIDA</span>
                          )}
                        </div>
                        
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-base font-semibold">{p.invoice_number}</span>
                              {statusBadge(p.status)}
                            </div>
                            <div className="text-xs text-gray-600 space-y-0.5">
                              <div>Vencimiento: <span className={isOverdue && (p.status === 'open' || p.status === 'partially_paid') ? 'font-semibold text-red-600' : 'font-medium'}>
                                {p.due_date ? format(new Date(p.due_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es }) : '-'}
                              </span></div>
                              {p.invoice_date && (
                                <div>Fecha factura: {format(new Date(p.invoice_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right mr-4">
                            <div className="text-xs text-gray-500">Subtotal</div>
                            <div className="text-sm font-medium">{mxn.format(p.subtotal)}</div>
                            <div className="text-xs text-gray-500 mt-1">IVA ({Math.round(p.vat_rate * 100)}%)</div>
                            <div className="text-xs font-medium">{mxn.format(p.tax)}</div>
                            <div className="text-xs text-gray-500 mt-1 pt-1 border-t">Total</div>
                            <div className="text-base font-bold">{mxn.format(p.total)}</div>
                            {(p.status === 'partially_paid' || p.status === 'paid') && (p as PayableWithSupplier).amount_paid != null && (
                              <>
                                <div className="text-xs text-gray-500 mt-1">Pagado</div>
                                <div className="text-sm font-medium text-green-600">{mxn.format((p as PayableWithSupplier).amount_paid!)}</div>
                                {p.status === 'partially_paid' && (
                                  <>
                                    <div className="text-xs text-gray-500 mt-0.5">Pendiente</div>
                                    <div className="text-sm font-medium">{mxn.format(p.total - ((p as PayableWithSupplier).amount_paid ?? 0))}</div>
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
                          <div>
                            {(p.status === 'open' || p.status === 'partially_paid') && (
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
                        
                        {/* Items list */}
                        {pItems.length > 0 ? (
                          <div className="mt-4 pt-3 border-t">
                            <div className="text-xs font-semibold text-gray-700 mb-2">Desglose de Partidas</div>
                            <div className="space-y-1.5">
                              {pItems.map((it: any) => {
                                const isFleet = it.cost_category === 'fleet'
                                return (
                                  <div key={it.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded">
                                    <div className="flex items-center gap-3">
                                      <span className={`text-xs font-medium ${isFleet ? 'text-blue-700' : 'text-green-700'}`}>
                                        {isFleet ? 'Flota' : 'Material'}
                                      </span>
                                      {it.entry?.entry_number && (
                                        <span className="font-mono text-sm">{it.entry.entry_number}</span>
                                      )}
                                      {/* Material PO reference */}
                                      {!isFleet && it.entry?.po_id && it.entry?.po_item && (
                                        <span className="ml-2 text-xs text-gray-500 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                          PO-M: {String(it.entry.po_item.po?.id || '').slice(0,8)}
                                        </span>
                                      )}
                                      {/* Fleet PO reference */}
                                      {isFleet && it.entry?.fleet_po_id && it.entry?.fleet_po_item && (
                                        <span className="ml-2 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                          PO-F: {String(it.entry.fleet_po_item.po?.id || '').slice(0,8)}
                                        </span>
                                      )}
                                      {!isFleet && it.entry?.entry_date && (
                                        <span className="text-xs text-gray-500">
                                          {format(new Date(it.entry.entry_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                      {!isFleet && it.entry?.quantity_received !== undefined && (
                                        <span className="text-xs">
                                          Cantidad: <b>{Number(it.entry.received_qty_entered ?? it.entry.quantity_received).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</b> {it.entry.received_uom || 'kg'}
                                        </span>
                                      )}
                                      {!isFleet && it.entry?.volumetric_weight_kg_per_m3 && it.entry?.received_uom === 'm3' && (
                                        <span className="text-[10px] text-gray-500"> · {Number(it.entry.volumetric_weight_kg_per_m3).toLocaleString('es-MX')} kg/m³</span>
                                      )}
                                      {!isFleet && it.entry?.unit_price !== undefined && (
                                        <span className="text-xs">
                                          P.U.: <b>{mxn.format(Number(it.entry.unit_price))}</b>
                                        </span>
                                      )}
                                      <div className="text-right">
                                        <span className="text-sm font-semibold">
                                          {mxn.format(Number(it.amount))}
                                        </span>
                                        {/* Material PO progress */}
                                        {it.entry?.po_item && !isFleet && (
                                          <div className="text-[10px] text-gray-500 mt-0.5">
                                            Avance PO: {Number(it.entry.po_item.qty_received_native ?? it.entry.po_item.qty_received ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} / {Number(it.entry.po_item.qty_ordered || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {it.entry.po_item.uom || ''}
                                          </div>
                                        )}
                                        {/* Fleet PO progress */}
                                        {it.entry?.fleet_po_item && isFleet && (
                                          <div className="text-[10px] text-blue-700 mt-0.5">
                                            Avance: {Number(it.entry.fleet_po_item.qty_received || 0).toLocaleString('es-MX')} / {Number(it.entry.fleet_po_item.qty_ordered || 0).toLocaleString('es-MX')} {it.entry.fleet_po_item.uom || ''}
                                          </div>
                                        )}
                                        {/* Fleet quantity entered */}
                                        {isFleet && it.entry?.fleet_qty_entered && (
                                          <div className="text-[10px] text-gray-600 mt-0.5">
                                            Esta entrada: {Number(it.entry.fleet_qty_entered).toLocaleString('es-MX')} {it.entry.fleet_uom || ''}
                                          </div>
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
              )})}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <RecordPaymentModal
          payable={selected}
          onClose={() => setSelected(null)}
          onSaved={onPaymentSaved}
        />
      )}
    </div>
  )
}


