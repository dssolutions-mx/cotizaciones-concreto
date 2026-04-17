'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Plus, Trash2, Package, Truck, DollarSign, ChevronDown, ChevronUp, History } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import MaterialSelect from '@/components/inventory/MaterialSelect'
import SupplierSelect from '@/components/inventory/SupplierSelect'
import ApplyPOCreditModal from './ApplyPOCreditModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import { PurchaseOrderItem } from '@/types/po'

interface POItem {
  id?: string
  tempId?: string
  is_service: boolean
  material_id?: string | null
  material_name?: string
  service_description?: string
  uom?: 'kg' | 'l' | 'trips' | 'tons' | 'hours' | 'loads' | 'units' | 'm3' | null
  qty_ordered: number
  qty_received?: number
  unit_price: number
  required_by?: string
  total: number
  volumetric_weight_kg_per_m3?: number
  material_supplier_id?: string | null
  credit_amount?: number | null
  credit_applied_at?: string | null
  credit_applied_by?: string | null
  credit_notes?: string | null
  original_unit_price?: number | null
}

interface EditPOModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  poId: string
  plantId: string
}

const generateTempId = () => `temp-${Date.now()}-${Math.random()}`

export default function EditPOModal({ open, onClose, onSuccess, poId, plantId }: EditPOModalProps) {
  const { profile } = useAuthBridge()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<POItem[]>([])
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [creditModalOpen, setCreditModalOpen] = useState(false)
  const [selectedItemForCredit, setSelectedItemForCredit] = useState<PurchaseOrderItem | null>(null)
  const [creditHistoryExpanded, setCreditHistoryExpanded] = useState<string | null>(null)
  const [creditHistoryData, setCreditHistoryData] = useState<Record<string, { history: any[]; creditInfo: any }>>({})

  // Add-item form state
  const [itemForm, setItemForm] = useState<POItem>({
    tempId: '',
    is_service: false,
    qty_ordered: 0,
    unit_price: 0,
    total: 0,
  })
  const [serviceDescription, setServiceDescription] = useState('')
  const [materialSupplierId, setMaterialSupplierId] = useState('')

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [poSupplierId, setPoSupplierId] = useState<string>('')
  const [poInfo, setPoInfo] = useState<{ po_number?: string; status?: string } | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 6 })

  const changeCount = dirtyIds.size + items.filter(it => it.tempId?.startsWith('temp-')).length
  const addFormOpen = showAddForm || items.length === 0

  const canCancelPO = (profile?.role === 'EXECUTIVE' || profile?.role === 'ADMIN_OPERATIONS') &&
    poInfo?.status !== 'cancelled' && !items.some(it => Number(it.qty_received || 0) > 0)

  const canApplyCredit =
    profile?.role === 'EXECUTIVE' || profile?.role === 'ADMIN_OPERATIONS'

  useEffect(() => {
    if (open && poId) {
      fetchItems()
      fetchPOInfo()
      fetchSuppliers()
      setDirtyIds(new Set())
      setShowAddForm(false)
    }
  }, [open, poId, plantId])

  const fetchPOInfo = async () => {
    try {
      const res = await fetch(`/api/po/${poId}`)
      const data = await res.json()
      if (data.purchase_order) {
        setPoSupplierId(data.purchase_order.supplier_id || '')
        setPoInfo({ po_number: data.purchase_order.po_number, status: data.purchase_order.status })
      }
    } catch (err) {
      console.error('Error fetching PO info:', err)
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/po/${poId}/items`)
      const data = await res.json()
      const coerced = (data.items || []).map((it: any) => ({
        ...it,
        qty_ordered: Number(it.qty_ordered),
        unit_price: Number(it.unit_price),
        qty_received: it.qty_received != null ? Number(it.qty_received) : undefined,
        total: Number(it.qty_ordered) * Number(it.unit_price),
      }))
      setItems(coerced)
    } catch (err) {
      console.error('Error fetching items:', err)
      toast.error('Error al cargar los ítems')
    }
  }

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`/api/suppliers?plant_id=${plantId}`)
      const data = await res.json()
      if (data.suppliers) setSuppliers(data.suppliers || [])
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }

  const fetchCreditHistory = async (itemId: string) => {
    if (creditHistoryData[itemId]) return
    try {
      const res = await fetch(`/api/po/items/${itemId}/credit`)
      const data = await res.json()
      if (data.success) {
        setCreditHistoryData(prev => ({ ...prev, [itemId]: { history: data.history || [], creditInfo: data.creditInfo || {} } }))
      }
    } catch { /* ignore */ }
  }

  const toggleCreditHistory = (itemId: string) => {
    if (creditHistoryExpanded === itemId) {
      setCreditHistoryExpanded(null)
    } else {
      setCreditHistoryExpanded(itemId)
      fetchCreditHistory(itemId)
    }
  }

  // Update an existing or staged item inline; marks existing items dirty
  const updateItem = (key: string, patch: Partial<POItem>) => {
    setItems(prev => prev.map(it => {
      if ((it.id ?? it.tempId) !== key) return it
      const next = { ...it, ...patch }
      next.total = next.qty_ordered * next.unit_price
      return next
    }))
    if (!key.startsWith('temp-')) {
      setDirtyIds(prev => { const s = new Set(prev); s.add(key); return s })
    }
  }

  const tryClose = () => {
    if (changeCount > 0) {
      setDiscardConfirmOpen(true)
    } else {
      onClose()
    }
  }

  const resetAddForm = () => {
    setItemForm({ tempId: '', is_service: false, qty_ordered: 0, unit_price: 0, total: 0 })
    setServiceDescription('')
    setMaterialSupplierId('')
  }

  const handleAddItem = () => {
    if (!itemForm.is_service && !itemForm.material_id) {
      toast.error('Seleccione un material')
      return
    }
    if (itemForm.is_service && !serviceDescription) {
      toast.error('Ingrese descripción del servicio')
      return
    }
    if (!itemForm.uom) {
      toast.error('Seleccione unidad de medida')
      return
    }
    if (itemForm.qty_ordered <= 0) {
      toast.error('Cantidad debe ser mayor a 0')
      return
    }
    if (itemForm.unit_price < 0) {
      toast.error('Precio no puede ser negativo')
      return
    }
    if (!itemForm.is_service && itemForm.uom === 'm3') {
      const v = itemForm.volumetric_weight_kg_per_m3
      if (v == null || !(v > 0)) {
        toast.error('Ingrese peso volumétrico acordado (kg/m³) para líneas en m³')
        return
      }
    }

    setItems(prev => [
      ...prev,
      {
        ...itemForm,
        tempId: generateTempId(),
        service_description: itemForm.is_service ? serviceDescription : undefined,
        material_supplier_id: itemForm.is_service ? materialSupplierId : undefined,
        total: itemForm.qty_ordered * itemForm.unit_price,
      },
    ])

    resetAddForm()
    setShowAddForm(false)
    toast.success('Ítem agregado')
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este ítem?')) return

    if (itemId.startsWith('temp-')) {
      setItems(items.filter(it => it.tempId !== itemId))
      toast.success('Ítem eliminado')
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/po/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Error al eliminar ítem')
        return
      }
      setItems(items.filter(it => it.id !== itemId))
      setDirtyIds(prev => { const s = new Set(prev); s.delete(itemId); return s })
      toast.success('Ítem eliminado')
    } catch (err) {
      console.error('Error deleting item:', err)
      toast.error('Error al eliminar ítem')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveItems = async () => {
    if (items.length === 0) {
      toast.error('Agregue al menos un ítem')
      return
    }

    const dirtyExisting = items.filter(it => it.id && dirtyIds.has(it.id))
    const newItems = items.filter(it => it.tempId?.startsWith('temp-'))

    // Validate before sending
    for (const it of [...dirtyExisting, ...newItems]) {
      if (it.qty_ordered <= 0) {
        toast.error(`Cantidad inválida en "${it.material_name || it.service_description || 'ítem'}"`)
        return
      }
      if (it.unit_price < 0) {
        toast.error(`Precio inválido en "${it.material_name || it.service_description || 'ítem'}"`)
        return
      }
    }

    try {
      setLoading(true)

      // PUT only dirty existing items
      for (const item of dirtyExisting) {
        const payload = {
          qty_ordered: item.qty_ordered,
          unit_price: item.unit_price,
          required_by: item.required_by || null,
        }
        const res = await fetch(`/api/po/items/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(typeof errorData.error === 'string' ? errorData.error : 'Failed to update item')
        }
      }

      // POST new items
      for (const item of newItems) {
        const payload: any = {
          is_service: item.is_service,
          qty_ordered: item.qty_ordered,
          unit_price: item.unit_price,
          uom: item.uom,
        }
        if (item.is_service) {
          payload.service_description = item.service_description
          if (item.material_supplier_id) payload.material_supplier_id = item.material_supplier_id
        } else {
          payload.material_id = item.material_id
        }
        if (item.required_by) payload.required_by = item.required_by
        if (!item.is_service && item.uom === 'm3' && item.volumetric_weight_kg_per_m3 != null) {
          payload.volumetric_weight_kg_per_m3 = item.volumetric_weight_kg_per_m3
        }

        const res = await fetch(`/api/po/${poId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({} as { error?: string; details?: unknown }))
          let msg = typeof errorData.error === 'string' ? errorData.error : 'Failed to create item'
          const flat = errorData.details as { formErrors?: string[]; fieldErrors?: Record<string, string[]> } | undefined
          const hint = flat?.formErrors?.[0] || (flat?.fieldErrors && Object.values(flat.fieldErrors).flat().filter(Boolean)[0])
          if (hint) msg = `${msg}: ${hint}`
          throw new Error(msg)
        }
      }

      toast.success('Cambios guardados')
      setDirtyIds(new Set())
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving items:', err)
      toast.error(err instanceof Error ? err.message : 'Error al guardar cambios')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelPO = async () => {
    if (!cancelReason.trim()) {
      toast.error('Ingrese la razón de cancelación')
      return
    }
    try {
      setLoading(true)
      const res = await fetch(`/api/po/${poId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poId, status: 'cancelled', cancellation_reason: cancelReason.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al cancelar')
      }
      toast.success('Orden de compra cancelada')
      setCancelModalOpen(false)
      setCancelReason('')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Error al cancelar')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const totalValue = items.reduce((sum, it) => sum + it.total, 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
          <div>
            <h2 className="text-lg font-semibold">Editar Orden de Compra</h2>
            <p className="text-sm text-stone-500 mt-0.5">{poInfo?.po_number || `PO #${poId.slice(0, 8)}`}</p>
          </div>
          <button onClick={tryClose} className="p-1 hover:bg-stone-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Items List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-medium">Ítems de la Orden</h3>
              {items.length > 0 && (
                <button
                  onClick={() => {
                    if (showAddForm) { resetAddForm(); setShowAddForm(false) }
                    else setShowAddForm(true)
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showAddForm
                    ? <><X className="h-3.5 w-3.5" /> Cancelar</>
                    : <><Plus className="h-3.5 w-3.5" /> Agregar ítem</>
                  }
                </button>
              )}
            </div>

            {canApplyCredit && (
              <p className="text-xs text-stone-600 mb-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <span className="font-semibold text-stone-800">Créditos: </span>
                Aplíquelos después de recepción o cuando el proveedor confirme un ajuste.
                Use <strong className="text-stone-800">Ver historial</strong> en la línea para el detalle.
              </p>
            )}

            <div className="space-y-2">
              {items.map((item) => {
                const key = item.id ?? item.tempId ?? ''
                const isDirty = item.id ? dirtyIds.has(item.id) : Boolean(item.tempId?.startsWith('temp-'))
                const qtyInvalid = isDirty && item.qty_ordered <= 0
                const priceInvalid = isDirty && item.unit_price < 0

                return (
                  <div
                    key={key}
                    className={`border rounded-md p-3 ${isDirty
                      ? 'bg-amber-50 border-amber-300 border-l-[3px] border-l-amber-400'
                      : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Row header */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {item.is_service ? (
                            <>
                              <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                              <span className="font-semibold text-sm">{item.service_description}</span>
                              <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">SERVICIO</span>
                            </>
                          ) : (
                            <>
                              <Package className="h-4 w-4 text-green-600 shrink-0" />
                              <span className="font-semibold text-sm">{item.material_name}</span>
                              <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">MATERIAL</span>
                            </>
                          )}
                          {isDirty && (
                            <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                              ● Modificado
                            </span>
                          )}
                        </div>

                        {/* Supplier */}
                        {item.is_service && item.material_supplier_id && (
                          <p className="text-xs text-blue-600 mb-2">
                            Para: {suppliers.find(s => s.id === item.material_supplier_id)?.name || 'Proveedor'}
                          </p>
                        )}
                        {!item.is_service && poSupplierId && (
                          <p className="text-xs text-stone-500 mb-2">
                            Proveedor: {suppliers.find(s => s.id === poSupplierId)?.name || 'N/A'}
                          </p>
                        )}

                        {/* Credit info */}
                        {item.credit_amount && item.id && (
                          <div className="mb-3 p-2 bg-orange-50 rounded border border-orange-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 text-xs">
                                  <DollarSign className="h-3 w-3 text-orange-600" />
                                  <span className="text-orange-800 font-medium">
                                    Crédito aplicado: {mxn.format(item.credit_amount)}
                                  </span>
                                </div>
                                {item.original_unit_price && (
                                  <div className="text-xs text-orange-700 mt-1">
                                    Precio original: {mxn.format(item.original_unit_price)} → Actual: {mxn.format(item.unit_price)}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleCreditHistory(item.id!)}
                                className="text-xs text-orange-700 hover:underline flex items-center gap-1"
                              >
                                <History className="h-3 w-3" />
                                {creditHistoryExpanded === item.id ? 'Ocultar historial' : 'Ver historial'}
                                {creditHistoryExpanded === item.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            </div>
                            {creditHistoryExpanded === item.id && creditHistoryData[item.id] && (
                              <div className="mt-2 pt-2 border-t border-orange-200">
                                <div className="text-xs font-semibold text-orange-800 mb-1">Historial de créditos</div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-orange-700">
                                        <th className="py-1 pr-2">Fecha</th>
                                        <th className="py-1 pr-2">Monto</th>
                                        <th className="py-1 pr-2">P.U. antes</th>
                                        <th className="py-1 pr-2">P.U. después</th>
                                        <th className="py-1 pr-2">Acumulado</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {creditHistoryData[item.id].history.map((h: any) => (
                                        <tr key={h.id} className="border-t border-orange-100">
                                          <td className="py-1 pr-2">{h.applied_at ? format(new Date(h.applied_at), 'dd MMM yyyy HH:mm', { locale: es }) : '-'}</td>
                                          <td className="py-1 pr-2 font-medium">{mxn.format(h.applied_amount || 0)}</td>
                                          <td className="py-1 pr-2">{mxn.format(h.unit_price_before || 0)}</td>
                                          <td className="py-1 pr-2">{mxn.format(h.unit_price_after || 0)}</td>
                                          <td className="py-1 pr-2">{mxn.format(h.cumulative_amount_after || 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Inline edit fields */}
                        <div className="grid grid-cols-3 gap-3 mt-2">
                          <div>
                            <Label className="text-xs text-stone-500 font-normal">Cantidad ({item.uom})</Label>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={item.qty_ordered || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                updateItem(key, { qty_ordered: val })
                              }}
                              className={`text-sm mt-0.5 h-8 ${qtyInvalid ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                            />
                            {qtyInvalid && <p className="text-xs text-red-600 mt-0.5">Debe ser &gt; 0</p>}
                          </div>
                          <div>
                            <Label className="text-xs text-stone-500 font-normal">Precio unitario (MXN)</Label>
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={item.unit_price || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                updateItem(key, { unit_price: val })
                              }}
                              className={`text-sm mt-0.5 h-8 ${priceInvalid ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
                            />
                            {priceInvalid && <p className="text-xs text-red-600 mt-0.5">No puede ser negativo</p>}
                          </div>
                          <div>
                            <Label className="text-xs text-stone-500 font-normal">Requerido (opcional)</Label>
                            <Input
                              type="date"
                              value={item.required_by || ''}
                              onChange={(e) => updateItem(key, { required_by: e.target.value })}
                              className="text-sm mt-0.5 h-8"
                            />
                          </div>
                        </div>

                        {/* Live total */}
                        <div className="mt-2 text-right text-sm">
                          <span className="text-stone-500">Total: </span>
                          <span className="font-semibold text-green-700">{mxn.format(item.total)}</span>
                        </div>
                      </div>

                      {/* Row actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        {canApplyCredit && !item.is_service && item.id && (
                          <button
                            onClick={() => {
                              const poItem: PurchaseOrderItem = {
                                id: item.id!,
                                po_id: poId,
                                is_service: item.is_service,
                                material_id: item.material_id || null,
                                uom: item.uom || null,
                                qty_ordered: item.qty_ordered,
                                unit_price: item.unit_price,
                                status: 'open',
                                created_at: '',
                                credit_amount: item.credit_amount || null,
                                credit_applied_at: item.credit_applied_at || null,
                                credit_applied_by: item.credit_applied_by || null,
                                credit_notes: item.credit_notes || null,
                                original_unit_price: item.original_unit_price || null,
                              }
                              setSelectedItemForCredit(poItem)
                              setCreditModalOpen(true)
                            }}
                            className="p-2 hover:bg-white rounded text-green-600"
                            title="Aplicar Crédito"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.id || item.tempId || '')}
                          className="p-2 hover:bg-white rounded text-red-500"
                          disabled={loading}
                          title="Eliminar ítem"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {items.length === 0 && !addFormOpen && (
                <p className="text-sm text-stone-500 text-center py-4">Sin ítems. Agregue uno abajo.</p>
              )}
            </div>
          </div>

          {/* Add-item form (add only) */}
          {addFormOpen && (
            <div className="border-t border-stone-200 pt-4">
              <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-4">Agregar ítem</h3>

              {/* Item Type */}
              <div className="mb-4">
                <Label className="text-sm font-medium text-stone-700">Tipo de Ítem</Label>
                <div className="mt-1.5 flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!itemForm.is_service}
                      onChange={() => setItemForm(f => ({ ...f, is_service: false }))}
                    />
                    <span className="text-sm">Material</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={itemForm.is_service}
                      onChange={() => setItemForm(f => ({ ...f, is_service: true }))}
                    />
                    <span className="text-sm">Servicio</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {itemForm.is_service ? (
                  <>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-stone-700">Descripción del Servicio</Label>
                      <div className="mt-1.5">
                        <Input
                          value={serviceDescription}
                          onChange={(e) => setServiceDescription(e.target.value)}
                          placeholder="Ej: Transporte, Flete, etc."
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-stone-700">Unidad de Medida</Label>
                      <div className="mt-1.5">
                        <Select
                          value={itemForm.uom || 'trips'}
                          onValueChange={(v) => setItemForm(f => ({ ...f, uom: v as any }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trips">Viajes</SelectItem>
                            <SelectItem value="tons">Toneladas</SelectItem>
                            <SelectItem value="loads">Cargas</SelectItem>
                            <SelectItem value="hours">Horas</SelectItem>
                            <SelectItem value="units">Unidades</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-stone-700">Cantidad Ordenada</Label>
                      <div className="mt-1.5">
                        <Input
                          type="number" step="any" min="0"
                          value={itemForm.qty_ordered || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setItemForm(f => ({ ...f, qty_ordered: val, total: val * f.unit_price }))
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-stone-700">Precio Unitario</Label>
                      <div className="mt-1.5">
                        <Input
                          type="number" step="any" min="0"
                          value={itemForm.unit_price || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setItemForm(f => ({ ...f, unit_price: val, total: f.qty_ordered * val }))
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-stone-700">Fecha Límite (Opcional)</Label>
                      <div className="mt-1.5">
                        <Input
                          type="date"
                          value={itemForm.required_by || ''}
                          onChange={(e) => setItemForm(f => ({ ...f, required_by: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-stone-700">Proveedor de Material</Label>
                      <div className="mt-1.5">
                        <SupplierSelect
                          value={materialSupplierId}
                          onChange={setMaterialSupplierId}
                          plantId={plantId}
                        />
                        <p className="mt-1 text-xs text-stone-500">
                          Proveedor de material para el cual aplica este servicio de flota
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-stone-700">Material</Label>
                      <div className="mt-1.5">
                        <MaterialSelect
                          value={itemForm.material_id ?? ''}
                          onChange={(id, meta) =>
                            setItemForm((f) => ({
                              ...f,
                              material_id: id,
                              material_name: meta?.material_name ?? (id ? f.material_name : ''),
                            }))
                          }
                          plantId={plantId}
                          supplierId={poSupplierId || undefined}
                        />
                        {poSupplierId && (
                          <p className="mt-1 text-xs text-stone-500">
                            Los <strong>sugeridos</strong> (OCs previas, acuerdos o recepciones con{' '}
                            {suppliers.find(s => s.id === poSupplierId)?.name || 'este proveedor'}) aparecen arriba.
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-stone-700">Unidad de Medida</Label>
                      <div className="mt-1.5">
                        <Select
                          value={itemForm.uom || 'kg'}
                          onValueChange={(v) =>
                            setItemForm((f) => ({
                              ...f,
                              uom: v as POItem['uom'],
                              volumetric_weight_kg_per_m3: v === 'm3' ? f.volumetric_weight_kg_per_m3 : undefined,
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                            <SelectItem value="l">Litros (l)</SelectItem>
                            <SelectItem value="m3">Metros cúbicos (m³)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {itemForm.uom === 'm3' && (
                      <div className="md:col-span-3">
                        <Label className="text-sm font-medium text-stone-700">Peso volumétrico (kg/m³)</Label>
                        <div className="mt-1.5">
                          <Input
                            type="number" step="any" min="0"
                            value={(itemForm as any).volumetric_weight_kg_per_m3 || ''}
                            onChange={(e) => {
                              const num = parseFloat(e.target.value)
                              setItemForm(f => ({ ...(f as any), volumetric_weight_kg_per_m3: isNaN(num) ? undefined : num }))
                            }}
                            placeholder="Ej. 1400"
                          />
                          <p className="mt-1 text-xs text-stone-500">
                            Densidad acordada (kg/m³). La báscula registra kg; el sistema convierte a m³ para la OC.
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-sm font-medium text-stone-700">Cantidad Ordenada ({itemForm.uom || 'kg'})</Label>
                      <div className="mt-1.5">
                        <Input
                          type="number" step="any" min="0"
                          value={itemForm.qty_ordered || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setItemForm(f => ({ ...f, qty_ordered: val, total: val * f.unit_price }))
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-stone-700">Precio Unitario</Label>
                      <div className="mt-1.5">
                        <Input
                          type="number" step="any" min="0"
                          value={itemForm.unit_price || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setItemForm(f => ({ ...f, unit_price: val, total: f.qty_ordered * val }))
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-stone-700">Fecha Límite (Opcional)</Label>
                      <div className="mt-1.5">
                        <Input
                          type="date"
                          value={itemForm.required_by || ''}
                          onChange={(e) => setItemForm(f => ({ ...f, required_by: e.target.value }))}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Total preview */}
                <div className="md:col-span-3 flex items-center justify-end gap-2 text-sm">
                  <span className="text-stone-500">Total del ítem:</span>
                  <span className="font-semibold text-stone-900 tabular-nums text-base">{mxn.format(itemForm.total)}</span>
                </div>
              </div>

              <div className="mt-4">
                <Button
                  onClick={handleAddItem}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar al pedido
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-200 bg-stone-50 flex-shrink-0">
          <div>
            <p className="text-sm text-stone-500">Total de la orden</p>
            <p className="text-xl font-semibold text-stone-900">{mxn.format(totalValue)}</p>
          </div>
          <div className="flex gap-2">
            {canCancelPO && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setCancelModalOpen(true)}
                disabled={loading}
              >
                Cancelar OC
              </Button>
            )}
            <Button onClick={tryClose} variant="outline" disabled={loading}>
              Cerrar
            </Button>
            <Button
              onClick={handleSaveItems}
              disabled={loading || items.length === 0 || changeCount === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading
                ? 'Guardando...'
                : changeCount === 0
                  ? 'Sin cambios'
                  : `Guardar ${changeCount} cambio${changeCount !== 1 ? 's' : ''}`
              }
            </Button>
          </div>
        </div>
      </div>

      {/* Credit Modal */}
      <ApplyPOCreditModal
        open={creditModalOpen}
        onClose={() => { setCreditModalOpen(false); setSelectedItemForCredit(null) }}
        onSuccess={() => { fetchItems() }}
        poItem={selectedItemForCredit}
      />

      {/* Discard-changes confirmation */}
      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Descartar cambios?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            Tiene {changeCount} cambio{changeCount !== 1 ? 's' : ''} sin guardar. Si cierra ahora se perderán.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDiscardConfirmOpen(false)}>
              Seguir editando
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setDiscardConfirmOpen(false); setDirtyIds(new Set()); onClose() }}
            >
              Descartar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel PO dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Orden de Compra</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">Esta acción no se puede deshacer. Debe indicar la razón de cancelación.</p>
          <Label>Razón de cancelación *</Label>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ej: Pedido duplicado, cambio de proveedor..."
            rows={3}
            maxLength={1000}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Volver</Button>
            <Button variant="destructive" onClick={handleCancelPO} disabled={!cancelReason.trim() || loading}>
              Confirmar cancelación
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
