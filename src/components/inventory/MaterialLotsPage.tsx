'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Package,
  RefreshCw,
  Layers,
  TrendingDown,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Minus,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import StatCard from './ui/StatCard'
import MaterialSelect from './MaterialSelect'
import type { MaterialLot, MaterialLotDetail, LotCostBreakdown } from '@/types/lots'

const QUALITY_CONFIG = {
  pending:  { label: 'Pendiente',  color: 'bg-amber-100 text-amber-800',  icon: Clock },
  approved: { label: 'Aprobado',   color: 'bg-green-100 text-green-800',  icon: CheckCircle },
  rejected: { label: 'Rechazado',  color: 'bg-red-100 text-red-800',      icon: XCircle },
  na:       { label: 'N/A',        color: 'bg-stone-100 text-stone-600',    icon: Minus },
} as const

const PAGE_SIZE = 20

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${fmt(n, 4)}`
}

// ---------- Lot Detail Modal ----------
function LotDetailModal({
  lot,
  onClose,
  canEdit,
}: {
  lot: MaterialLot
  onClose: () => void
  canEdit: boolean
}) {
  const [detail, setDetail] = useState<MaterialLotDetail | null>(null)
  const [breakdown, setBreakdown] = useState<LotCostBreakdown | null>(null)
  const [tab, setTab] = useState<'info' | 'cost' | 'edit'>('info')
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState({
    quality_status: lot.quality_status,
    quality_certificate_url: lot.quality_certificate_url || '',
    expiry_date: lot.expiry_date || '',
    notes: lot.notes || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [detailRes, breakdownRes] = await Promise.all([
          fetch(`/api/inventory/lots/${lot.id}`),
          fetch(`/api/inventory/lots/${lot.id}?view=breakdown`),
        ])
        const d = await detailRes.json()
        const b = await breakdownRes.json()
        if (d.success) setDetail(d.data)
        if (b.success) setBreakdown(b.data)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [lot.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/lots/${lot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if ((await res.json()).success) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{lot.lot_number}</DialogTitle>
          <DialogDescription>
            {(lot.material as { material_name?: string })?.material_name || 'Material'} —{' '}
            {(lot.entry as { entry_date?: string })?.entry_date || ''}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b mb-4">
          {(['info', 'cost', ...(canEdit ? ['edit'] : [])] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-sky-600 text-sky-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {t === 'info' ? 'Informacion' : t === 'cost' ? 'Costos' : 'Editar'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-stone-500">Cargando...</div>
        ) : tab === 'info' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-stone-500">Lote</span><p className="font-mono font-semibold">{lot.lot_number}</p></div>
              <div><span className="text-stone-500">Entrada</span><p className="font-mono">{(lot.entry as { entry_number?: string })?.entry_number || '—'}</p></div>
              <div><span className="text-stone-500">Proveedor</span><p>{(lot.supplier as { name?: string })?.name || '—'}</p></div>
              <div><span className="text-stone-500">Calidad</span>
                <div className="mt-0.5">
                  <Badge className={QUALITY_CONFIG[lot.quality_status]?.color || ''}>
                    {QUALITY_CONFIG[lot.quality_status]?.label || lot.quality_status}
                  </Badge>
                </div>
              </div>
              <div><span className="text-stone-500">Cantidad Recibida</span><p className="font-semibold">{fmt(lot.received_qty_kg)} kg</p></div>
              <div><span className="text-stone-500">Cantidad Restante</span><p className="font-semibold">{fmt(lot.remaining_quantity_kg)} kg</p></div>
              <div><span className="text-stone-500">Vencimiento</span><p>{lot.expiry_date || '—'}</p></div>
              <div><span className="text-stone-500">Fecha Entrada</span><p>{(lot.entry as { entry_date?: string })?.entry_date || '—'}</p></div>
            </div>
            {lot.notes && (
              <div className="bg-stone-50 rounded-md p-3 text-sm">
                <p className="text-stone-500 text-xs mb-1">Notas</p>
                <p className="text-stone-800">{lot.notes}</p>
              </div>
            )}
            {/* Allocations */}
            {detail?.allocations && detail.allocations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-stone-700 mb-2">Consumos FIFO</h4>
                <div className="space-y-1">
                  {detail.allocations.map(a => (
                    <div key={a.id} className="flex justify-between text-xs bg-stone-50 rounded px-3 py-1.5">
                      <span className="text-stone-600">{a.remision_number || a.remision_id.slice(0, 8)}</span>
                      <span>{fmt(a.quantity_consumed_kg)} kg</span>
                      <span className="text-stone-500">${fmt(a.total_cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : tab === 'cost' ? (
          <div className="space-y-4">
            {breakdown ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-sky-50/90 border border-sky-100 rounded-lg p-4">
                    <p className="text-xs text-sky-800 font-medium">Precio unitario material</p>
                    <p className="text-xl font-bold text-stone-900">{fmtCurrency(breakdown.material_unit_price)}/kg</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-xs text-orange-600 font-medium">Costo Flete por kg</p>
                    <p className="text-xl font-bold text-orange-900">{fmtCurrency(breakdown.fleet_unit_cost)}/kg</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 col-span-2">
                    <p className="text-xs text-green-600 font-medium">Precio Aterrizado (FIFO)</p>
                    <p className="text-2xl font-bold text-green-900">{fmtCurrency(breakdown.landed_unit_price)}/kg</p>
                  </div>
                </div>
                <div className="border rounded-lg divide-y text-sm">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-stone-600">Costo Total Material</span>
                    <span className="font-medium">${fmt(breakdown.total_material_value)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-stone-600">Costo Total Flete</span>
                    <span className="font-medium">${fmt(breakdown.total_fleet_value)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 font-semibold">
                    <span>Valor Total Aterrizado</span>
                    <span>${fmt(breakdown.total_landed_value)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-stone-500">
                    <span>Consumido</span>
                    <span>{fmt(breakdown.consumed_qty_kg)} kg / ${fmt(breakdown.consumed_value)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-stone-600">Restante</span>
                    <span>{fmt(breakdown.remaining_quantity_kg)} kg</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-stone-500 py-8">Sin datos de costo</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Estado de Calidad</label>
              <Select value={editForm.quality_status} onValueChange={v => setEditForm(prev => ({ ...prev, quality_status: v as typeof editForm.quality_status }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                  <SelectItem value="na">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">URL Certificado de Calidad</label>
              <Input
                className="mt-1"
                placeholder="https://..."
                value={editForm.quality_certificate_url}
                onChange={e => setEditForm(prev => ({ ...prev, quality_certificate_url: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fecha de Vencimiento</label>
              <Input
                type="date"
                className="mt-1"
                value={editForm.expiry_date}
                onChange={e => setEditForm(prev => ({ ...prev, expiry_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notas</label>
              <Textarea
                className="mt-1"
                placeholder="Observaciones adicionales..."
                value={editForm.notes}
                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {tab === 'edit' && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Main Page ----------
export default function MaterialLotsPage() {
  const { currentPlant } = usePlantContext()
  const { profile } = useAuthSelectors()
  const searchParams = useSearchParams()
  const urlMaterialSynced = useRef(false)
  const [lots, setLots] = useState<MaterialLot[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [selectedLot, setSelectedLot] = useState<MaterialLot | null>(null)

  // Filters
  const [filters, setFilters] = useState({
    material_id: '',
    quality_status: '',
    has_remaining: '',
    date_from: '',
    date_to: '',
  })

  useEffect(() => {
    const mid = searchParams.get('material_id')
    if (!mid || urlMaterialSynced.current) return
    urlMaterialSynced.current = true
    setFilters((f) => ({ ...f, material_id: mid, has_remaining: 'true' }))
  }, [searchParams])

  const canEdit = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'].includes(profile?.role || '')

  const fetchLots = useCallback(async () => {
    if (!currentPlant?.id) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        plant_id: currentPlant.id,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      })
      if (filters.material_id) params.set('material_id', filters.material_id)
      if (filters.quality_status) params.set('quality_status', filters.quality_status)
      if (filters.has_remaining) params.set('has_remaining', filters.has_remaining)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)

      const res = await fetch(`/api/inventory/lots?${params}`)
      const json = await res.json()
      if (json.success) {
        setLots(json.data || [])
        setTotal(json.total || 0)
      }
    } catch (err) {
      console.error('Failed to fetch lots:', err)
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id, page, filters])

  useEffect(() => { fetchLots() }, [fetchLots])
  useEffect(() => { setPage(0) }, [filters, currentPlant?.id])

  // Derived stats
  const lotsWithRemaining = lots.filter(l => (l.remaining_quantity_kg ?? 0) > 0)
  const totalRemainingKg = lots.reduce((sum, l) => sum + (l.remaining_quantity_kg ?? 0), 0)
  const avgLandedPrice = lots.length > 0
    ? lots.reduce((sum, l) => sum + l.landed_unit_price, 0) / lots.length
    : 0

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6 w-full">
      <InventoryBreadcrumb />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Lotes de Material</h1>
          <p className="text-sm text-stone-500 mt-1">
            Trazabilidad de costos por lote — precio aterrizado (material + flete)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLots} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Lotes"
          value={total}
          icon={Layers}
          iconColor="text-sky-700"
        />
        <StatCard
          title="Kg Restantes en Almacen"
          value={`${fmt(totalRemainingKg)} kg`}
          icon={Package}
          iconColor="text-green-600"
        />
        <StatCard
          title="Precio Aterrizado Prom."
          value={`$${fmt(avgLandedPrice, 4)}/kg`}
          icon={DollarSign}
          iconColor="text-purple-600"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="sm:col-span-2 md:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-stone-600 mb-1 block">Material</label>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <MaterialSelect
                    value={filters.material_id}
                    onChange={(id) => setFilters((f) => ({ ...f, material_id: id }))}
                    plantId={currentPlant?.id}
                  />
                </div>
                {filters.material_id ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setFilters((f) => ({ ...f, material_id: '' }))}
                  >
                    Quitar filtro
                  </Button>
                ) : null}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Estado Calidad</label>
              <Select
                value={filters.quality_status || 'all'}
                onValueChange={v => setFilters(prev => ({ ...prev, quality_status: v === 'all' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="rejected">Rechazado</SelectItem>
                  <SelectItem value="na">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Inventario</label>
              <Select
                value={filters.has_remaining || 'all'}
                onValueChange={v => setFilters(prev => ({ ...prev, has_remaining: v === 'all' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los lotes</SelectItem>
                  <SelectItem value="true">Con inventario restante</SelectItem>
                  <SelectItem value="false">Agotados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Desde</label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">Hasta</label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lot List */}
      {loading ? (
        <div className="text-center py-12 text-stone-500">Cargando lotes...</div>
      ) : lots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-stone-500">
            <Layers className="h-12 w-12 mx-auto mb-3 text-stone-300" />
            <p className="font-medium">Sin lotes registrados</p>
            <p className="text-sm mt-1">Los lotes se crean automaticamente al registrar entradas de material</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {lots.map(lot => {
              const qConfig = QUALITY_CONFIG[lot.quality_status] || QUALITY_CONFIG.pending
              const QIcon = qConfig.icon
              const remainingPct = lot.received_qty_kg > 0
                ? ((lot.remaining_quantity_kg ?? 0) / lot.received_qty_kg) * 100
                : 0
              const hasFleet = lot.fleet_cost > 0

              return (
                <Card
                  key={lot.id}
                  className="cursor-pointer hover:bg-stone-50/80 transition-colors overflow-hidden"
                  onClick={() => setSelectedLot(lot)}
                >
                  <div className="flex items-stretch">
                    {/* Left color bar based on remaining */}
                    <div className={`w-1.5 ${remainingPct > 25 ? 'bg-green-400' : remainingPct > 0 ? 'bg-amber-400' : 'bg-stone-200'}`} />

                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-stone-700">{lot.lot_number}</span>
                            <Badge className={qConfig.color}>
                              <QIcon className="h-3 w-3 mr-1" />
                              {qConfig.label}
                            </Badge>
                            {hasFleet && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                                <Truck className="h-3 w-3 mr-1" />
                                Flete incluido
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-semibold text-stone-900 truncate">
                            {(lot.material as { material_name?: string })?.material_name || 'Material'}
                          </h3>

                          <div className="flex flex-wrap gap-4 mt-1 text-sm text-stone-600">
                            <span className="flex items-center gap-1">
                              <Package className="h-3.5 w-3.5" />
                              {fmt(lot.received_qty_kg)} kg recibido
                            </span>
                            {lot.remaining_quantity_kg != null && (
                              <span className={`flex items-center gap-1 ${remainingPct === 0 ? 'text-stone-400' : remainingPct < 25 ? 'text-amber-600' : 'text-green-600'}`}>
                                <TrendingDown className="h-3.5 w-3.5" />
                                {fmt(lot.remaining_quantity_kg)} kg restante
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Cost summary */}
                        <div className="text-right ml-4 flex-shrink-0">
                          <p className="text-xs text-stone-500">Precio aterrizado</p>
                          <p className="text-lg font-bold text-stone-900">{fmtCurrency(lot.landed_unit_price)}/kg</p>
                          {hasFleet && (
                            <p className="text-xs text-orange-600">
                              Mat: {fmtCurrency(lot.material_unit_price)} + Flete: {fmtCurrency(lot.fleet_unit_cost)}
                            </p>
                          )}
                          {(lot.entry as { entry_date?: string })?.entry_date && (
                            <p className="text-xs text-stone-400 mt-0.5">{(lot.entry as { entry_date?: string }).entry_date}</p>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-stone-400 ml-3 self-center flex-shrink-0" />
                      </div>

                      {/* Progress bar */}
                      {lot.received_qty_kg > 0 && (
                        <div className="mt-3">
                          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${remainingPct > 25 ? 'bg-green-400' : remainingPct > 0 ? 'bg-amber-400' : 'bg-stone-200'}`}
                              style={{ width: `${Math.min(remainingPct, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-stone-400 mt-0.5">{fmt(remainingPct, 1)}% restante</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-stone-500">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total} lotes
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedLot && (
        <LotDetailModal
          lot={selectedLot}
          onClose={() => { setSelectedLot(null); fetchLots() }}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
