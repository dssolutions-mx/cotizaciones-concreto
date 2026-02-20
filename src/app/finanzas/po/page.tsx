'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePlantContext } from '@/contexts/PlantContext'
import { Package, Truck, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'
import CreatePOModal from '@/components/po/CreatePOModal'
import EditPOModal from '@/components/po/EditPOModal'

export default function PurchaseOrdersPage() {
  const { currentPlant, availablePlants } = usePlantContext()
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState<any[]>([])
  const [plant, setPlant] = useState<string>('')
  const [supplier, setSupplier] = useState<string>('')
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [status, setStatus] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [expandedPo, setExpandedPo] = useState<string | null>(null)
  const [poItems, setPoItems] = useState<Record<string, any[]>>({})
  const [poSummaries, setPoSummaries] = useState<Record<string, { total_ordered_value: number; total_received_value: number; total_credits: number; net_total: number }>>({})

  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

  const fetchPOs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (plant) params.set('plant_id', plant)
      if (supplier) params.set('supplier_id', supplier)
      if (status && status !== 'all') params.set('status', status)
      const res = await fetch(`/api/po?${params.toString()}`)
      const data = await res.json()
      setPos(data.purchase_orders || [])
    } finally {
      setLoading(false)
    }
  }

  const fetchPOItems = async (poId: string) => {
    if (poItems[poId]) return // Already fetched
    try {
      const res = await fetch(`/api/po/${poId}/items`)
      const data = await res.json()
      setPoItems(prev => ({ ...prev, [poId]: data.items || [] }))
    } catch (err) {
      console.error('Error fetching PO items:', err)
    }
  }

  const fetchPOSummary = async (poId: string) => {
    if (poSummaries[poId]) return
    try {
      const res = await fetch(`/api/po/${poId}/summary`)
      const data = await res.json()
      if (data.po_id) {
        setPoSummaries(prev => ({ ...prev, [poId]: data }))
      }
    } catch { /* ignore */ }
  }

  const toggleExpanded = (poId: string) => {
    if (expandedPo === poId) {
      setExpandedPo(null)
    } else {
      setExpandedPo(poId)
      fetchPOItems(poId)
      fetchPOSummary(poId)
    }
  }

  useEffect(() => { fetchPOs() }, [plant, supplier, status])

  // Fetch suppliers for filter (optionally by plant)
  useEffect(() => {
    const url = plant ? `/api/suppliers?plant_id=${plant}` : '/api/suppliers'
    fetch(url).then(res => res.ok ? res.json() : { suppliers: [] })
      .then(data => setSuppliers(data.suppliers || []))
      .catch(() => setSuppliers([]))
    if (!plant) setSupplier('')
  }, [plant])

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    partial: 'bg-yellow-100 text-yellow-800',
    fulfilled: 'bg-green-100 text-green-800',
    closed: 'bg-green-100 text-green-800', // DB uses closed for completed POs
    cancelled: 'bg-gray-100 text-gray-800'
  }

  const statusLabels: Record<string, string> = {
    open: 'Abierta',
    partial: 'Parcial',
    fulfilled: 'Completada',
    closed: 'Completada', // DB uses closed for completed POs
    cancelled: 'Cancelada'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de Compra</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestione pedidos a proveedores, materiales y servicios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPOs}>Actualizar</Button>
          <Button onClick={() => setCreateOpen(true)}>Nueva Orden de Compra</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtra por planta, proveedor y estado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500">Planta</label>
              <Select value={plant || '_all'} onValueChange={(v) => setPlant(v === '_all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las plantas" />
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
              <label className="text-xs text-gray-500">Proveedor</label>
              <Select value={supplier || '_all'} onValueChange={(v) => setSupplier(v === '_all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={plant ? "Seleccionar proveedor" : "Seleccione planta primero"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos los proveedores</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Estado</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="fulfilled">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PO List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Listado de Órdenes</CardTitle>
            {!loading && pos.length > 0 && (
              <div className="text-sm text-gray-500">
                {pos.length} {pos.length === 1 ? 'orden encontrada' : 'órdenes encontradas'}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando órdenes...</div>
          ) : pos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No hay órdenes de compra</p>
              <p className="text-sm mt-1">Cree una nueva orden para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pos.map(po => {
                const items = poItems[po.id] || []
                const isExpanded = expandedPo === po.id
                const totalItems = items.length
                const materialItems = items.filter((it: any) => !it.is_service)
                const serviceItems = items.filter((it: any) => it.is_service)

                return (
                  <div key={po.id} className="border rounded-lg overflow-hidden">
                    <div className="p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="font-semibold text-lg">{po.po_number || `PO #${po.id.slice(0,8)}`}</div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[po.status] || 'bg-gray-100'}`}>
                              {statusLabels[po.status] || po.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>Proveedor: <span className="font-medium">{po.supplier?.name ?? po.supplier_id?.slice(0,8) ?? '-'}</span></div>
                            <div>Planta: <span className="font-medium">{po.plant?.name ?? po.plant?.code ?? (po.plant_id?.slice(0,8) ?? '-')}</span></div>
                            <div>Creado: {format(new Date(po.created_at), 'dd MMM yyyy HH:mm', { locale: es })}</div>
                            {po.notes && <div className="text-xs italic">"{po.notes}"</div>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(po.id)}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Ocultar
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Ver Detalles
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPoId(po.id)
                              setEditOpen(true)
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-4">
                        {items.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>Sin ítems agregados</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3 flex-wrap">
                              <div>Total: {totalItems} {totalItems === 1 ? 'ítem' : 'ítems'}</div>
                              <div className="font-semibold">
                                Total PO: {mxn.format(items.reduce((sum: number, it: any) => sum + (Number(it.qty_ordered || 0) * Number(it.unit_price || 0)), 0))}
                              </div>
                              {poSummaries[po.id] && (
                                <>
                                  <div>Recibido: {mxn.format(poSummaries[po.id].total_received_value)}</div>
                                  {poSummaries[po.id].total_credits > 0 && (
                                    <div className="text-orange-600">Créditos: -{mxn.format(poSummaries[po.id].total_credits)}</div>
                                  )}
                                  <div className="font-semibold text-green-700">Neto: {mxn.format(poSummaries[po.id].net_total)}</div>
                                </>
                              )}
                              {materialItems.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Package className="h-4 w-4" />
                                  {materialItems.length} material{materialItems.length > 1 ? 'es' : ''}
                                </div>
                              )}
                              {serviceItems.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Truck className="h-4 w-4" />
                                  {serviceItems.length} servicio{serviceItems.length > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>

                            {items.map((item: any) => {
                              const orderedQty = Number(item.qty_ordered) || 0
                              const receivedQty = Number(item.qty_received ?? item.qty_received_kg ?? item.qty_received_native ?? 0) || 0
                              const progress = orderedQty > 0 ? (receivedQty / orderedQty) * 100 : 0

                              return (
                                <div key={item.id} className="bg-white border rounded p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        {item.is_service ? (
                                          <Truck className="h-4 w-4 text-blue-600" />
                                        ) : (
                                          <Package className="h-4 w-4 text-green-600" />
                                        )}
                                        <div className="font-medium">{item.is_service ? (item.service_description || 'Servicio de Flota') : (item.material?.material_name || item.material?.material_code || item.material_id?.slice(0,8) || 'Material')}</div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status] || 'bg-gray-100'}`}>
                                          {statusLabels[item.status] || item.status}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                          <div className="text-xs text-gray-500">Ordenado</div>
                                          <div className="font-semibold">{(item.qty_ordered ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {item.uom || 'unidad'}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500">Recibido</div>
                                          <div className="font-semibold">{receivedQty.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {item.uom || 'unidad'}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500">Precio Unit.</div>
                                          <div className="font-semibold">{mxn.format(item.unit_price)}</div>
                                        </div>
                                        {item.required_by && (
                                          <div>
                                            <div className="text-xs text-gray-500">Requiere antes</div>
                                            <div className="font-semibold">{format(new Date(item.required_by + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}</div>
                                          </div>
                                        )}
                                      </div>
                                      {!item.is_service && (
                                        <div className="mt-2">
                                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                            <span>Progreso</span>
                                            <span>{progress.toFixed(1)}%</span>
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div 
                                              className={`h-2 rounded-full ${progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-yellow-500' : 'bg-gray-300'}`}
                                              style={{ width: `${Math.min(progress, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right ml-4">
                                      <div className="text-xs text-gray-500">Total</div>
                                      <div className="text-lg font-bold">{mxn.format((Number(item.qty_ordered || 0) * Number(item.unit_price || 0)))}</div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePOModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          fetchPOs()
          setCreateOpen(false)
        }}
        defaultPlantId={currentPlant?.id}
      />

      <EditPOModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        poId={selectedPoId || ''}
        plantId={pos.find(p => p.id === selectedPoId)?.plant_id || ''}
        onSuccess={() => {
          fetchPOs()
          setEditOpen(false)
        }}
      />
    </div>
  )
}
