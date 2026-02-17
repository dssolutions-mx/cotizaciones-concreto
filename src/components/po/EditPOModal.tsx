'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Plus, Trash2, Edit2, Save, Package, Truck, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import MaterialSelect from '@/components/inventory/MaterialSelect'
import SupplierSelect from '@/components/inventory/SupplierSelect'
import ApplyPOCreditModal from './ApplyPOCreditModal'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import { PurchaseOrderItem } from '@/types/po'

interface POItem {
  id?: string // Database ID when editing existing
  tempId?: string // Temp ID for new items
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
  volumetric_weight_kg_per_m3?: number // Added for m3 UoM
  material_supplier_id?: string | null // For fleet/service items
  // Credit fields
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [creditModalOpen, setCreditModalOpen] = useState(false)
  const [selectedItemForCredit, setSelectedItemForCredit] = useState<PurchaseOrderItem | null>(null)

  // Item form
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
  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

  // Check if user can apply credits
  const canApplyCredit = profile?.role === 'EXECUTIVE' || 
                         profile?.role === 'ADMIN_OPERATIONS' || 
                         profile?.role === 'ADMINISTRATIVE'

  // Load existing items and PO info
  useEffect(() => {
    if (open && poId) {
      fetchItems()
      fetchPOInfo()
      fetchSuppliers()
    }
  }, [open, poId, plantId])

  const fetchPOInfo = async () => {
    try {
      const res = await fetch(`/api/po/${poId}`)
      const data = await res.json()
      if (data.purchase_order) {
        setPoSupplierId(data.purchase_order.supplier_id || '')
      }
    } catch (err) {
      console.error('Error fetching PO info:', err)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`/api/suppliers?plant_id=${plantId}`)
      const data = await res.json()
      if (data.success && data.data) {
        setSuppliers(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/po/${poId}/items`)
      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      console.error('Error fetching items:', err)
      toast.error('Error al cargar los ítems')
    }
  }

  const resetItemForm = () => {
    setItemForm({
      tempId: '',
      is_service: false,
      qty_ordered: 0,
      unit_price: 0,
      total: 0,
    })
    setServiceDescription('')
    setMaterialSupplierId('')
    setEditingItemId(null)
  }

  const startEditItem = (item: POItem) => {
    setItemForm(item)
    setEditingItemId(item.id || item.tempId || '')
    if (item.is_service && item.service_description) {
      setServiceDescription(item.service_description)
    }
    if (item.is_service && item.material_supplier_id) {
      setMaterialSupplierId(item.material_supplier_id)
    } else {
      setMaterialSupplierId('')
    }
  }

  const handleAddOrUpdateItem = () => {
    // Validation
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

    if (editingItemId) {
      // Update existing
      const updatedItems = items.map(it =>
        (it.id === editingItemId || it.tempId === editingItemId)
          ? {
            ...itemForm,
            service_description: itemForm.is_service ? serviceDescription : undefined,
            material_supplier_id: itemForm.is_service ? materialSupplierId : undefined,
            total: itemForm.qty_ordered * itemForm.unit_price,
          }
          : it
      )
      setItems(updatedItems)
    } else {
      // Add new
      setItems([
        ...items,
        {
          ...itemForm,
          tempId: generateTempId(),
          service_description: itemForm.is_service ? serviceDescription : undefined,
          material_supplier_id: itemForm.is_service ? materialSupplierId : undefined,
          total: itemForm.qty_ordered * itemForm.unit_price,
        },
      ])
    }

    resetItemForm()
    toast.success(editingItemId ? 'Ítem actualizado' : 'Ítem agregado')
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este ítem?')) return

    // If it's a new item (has tempId), just remove it from list
    if (itemId.startsWith('temp-')) {
      setItems(items.filter(it => it.tempId !== itemId))
      toast.success('Ítem eliminado')
      return
    }

    // Delete from database
    try {
      setLoading(true)
      const res = await fetch(`/api/po/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Error al eliminar ítem')
        return
      }
      setItems(items.filter(it => it.id !== itemId))
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

    try {
      setLoading(true)

      // Separate new and existing items
      const newItems = items.filter(it => it.tempId && it.tempId.startsWith('temp-'))
      const existingItems = items.filter(it => it.id && !it.tempId?.startsWith('temp-'))

      // Create new items
      for (const item of newItems) {
        const payload: any = {
          is_service: item.is_service,
          qty_ordered: item.qty_ordered,
          unit_price: item.unit_price,
          uom: item.uom,
        }

        // Add service or material fields
        if (item.is_service) {
          payload.service_description = item.service_description
          if (item.material_supplier_id) {
            payload.material_supplier_id = item.material_supplier_id
          }
        } else {
          payload.material_id = item.material_id
        }

        // Optional fields - only add if provided
        if (item.required_by) {
          payload.required_by = item.required_by
        }

        const res = await fetch(`/api/po/${poId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to create item')
        }
      }

      // Update existing items
      for (const item of existingItems) {
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
          throw new Error('Failed to update item')
        }
      }

      toast.success('Cambios guardados')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving items:', err)
      toast.error('Error al guardar cambios')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const totalValue = items.reduce((sum, it) => sum + it.total, 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Editar Orden de Compra</h2>
            <p className="text-sm text-gray-500 mt-1">PO #{poId.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Items List */}
          <div>
            <h3 className="text-lg font-medium mb-4">Ítems de la Orden</h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id || item.tempId} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {item.is_service ? (
                          <>
                            <Truck className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold">{item.service_description}</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">SERVICIO</span>
                          </>
                        ) : (
                          <>
                            <Package className="h-4 w-4 text-green-600" />
                            <span className="font-semibold">{item.material_name}</span>
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">MATERIAL</span>
                          </>
                        )}
                      {item.is_service && item.material_supplier_id && (
                        <div className="text-xs text-blue-600 mt-1">
                          Para: {suppliers.find(s => s.id === item.material_supplier_id)?.name || 'Proveedor'}
                        </div>
                      )}
                      {!item.is_service && poSupplierId && (
                        <div className="text-xs text-gray-500 mt-1">
                          Proveedor: {suppliers.find(s => s.id === poSupplierId)?.name || 'N/A'}
                        </div>
                        )}
                      </div>
                      {/* Credit Info */}
                      {item.credit_amount && (
                        <div className="mt-2 p-2 bg-orange-50 rounded border border-orange-200">
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
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                        <div>
                          <p className="text-gray-600">Cantidad</p>
                          <p className="font-semibold">{item.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {item.uom}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Precio Unitario</p>
                          <p className="font-semibold">{mxn.format(item.unit_price)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Total</p>
                          <p className="font-semibold text-green-700">{mxn.format(item.total)}</p>
                        </div>
                        {item.required_by && (
                          <div>
                            <p className="text-gray-600">Requerido</p>
                            <p className="font-semibold">{new Date(item.required_by).toLocaleDateString('es-MX')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      {canApplyCredit && !item.is_service && item.id && (
                        <button
                          onClick={() => {
                            // Convert POItem to PurchaseOrderItem for credit modal
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
                        onClick={() => startEditItem(item)}
                        className="p-2 hover:bg-white rounded text-blue-600"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id || item.tempId || '')}
                        className="p-2 hover:bg-white rounded text-red-600"
                        disabled={loading}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Item Form */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">
              {editingItemId ? 'Editar Ítem' : 'Agregar Ítem'}
            </h3>

            {/* Item Type Toggle */}
            <div className="mb-6">
              <Label className="text-sm font-medium text-gray-700">Tipo de Ítem</Label>
              <div className="mt-1.5 flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!itemForm.is_service}
                    onChange={() => setItemForm(f => ({ ...f, is_service: false }))}
                  />
                  <span>Material</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={itemForm.is_service}
                    onChange={() => setItemForm(f => ({ ...f, is_service: true }))}
                  />
                  <span>Servicio</span>
                </label>
              </div>
            </div>

            {/* Item Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {itemForm.is_service ? (
                <>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Descripción del Servicio</Label>
                    <div className="mt-1.5">
                      <Input
                        value={serviceDescription}
                        onChange={(e) => setServiceDescription(e.target.value)}
                        placeholder="Ej: Transporte, Flete, etc."
                        className="text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Unidad de Medida</Label>
                    <div className="mt-1.5">
                      <Select
                        value={itemForm.uom || 'trips'}
                        onValueChange={(v) => setItemForm(f => ({ ...f, uom: v as any }))}
                      >
                        <SelectTrigger className="text-base">
                          <SelectValue />
                        </SelectTrigger>
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
                    <Label className="text-sm font-medium text-gray-700">
                      Cantidad Ordenada ({itemForm.uom || 'viajes'})
                    </Label>
                    <div className="mt-1.5">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={itemForm.qty_ordered || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setItemForm(f => ({ ...f, qty_ordered: val, total: val * f.unit_price }))
                        }}
                        placeholder="0"
                        className="text-base"
                      />
                      {itemForm.qty_ordered > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          {itemForm.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Precio Unitario</Label>
                    <div className="mt-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemForm.unit_price || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setItemForm(f => ({ ...f, unit_price: val, total: f.qty_ordered * val }))
                        }}
                        placeholder="0.00"
                        className="text-base"
                      />
                      {itemForm.unit_price > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          {mxn.format(itemForm.unit_price)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Fecha Límite (Opcional)</Label>
                    <div className="mt-1.5">
                      <Input
                        type="date"
                        value={itemForm.required_by || ''}
                        onChange={(e) => setItemForm(f => ({ ...f, required_by: e.target.value }))}
                        className="text-base"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Proveedor de Material</Label>
                    <div className="mt-1.5">
                      <SupplierSelect
                        value={materialSupplierId}
                        onChange={setMaterialSupplierId}
                        plantId={plantId}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Seleccione el proveedor de material para el cual este servicio de flota aplica
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-gray-700">Material</Label>
                    <div className="mt-1.5">
                      <MaterialSelect
                        value={itemForm.material_id}
                        onChange={(id) => {
                          const selected = id
                          setItemForm(f => ({ ...f, material_id: id }))
                        }}
                        plantId={plantId}
                      />
                      {poSupplierId && (
                        <p className="mt-1 text-xs text-gray-500">
                          Este PO es para {suppliers.find(s => s.id === poSupplierId)?.name || 'el proveedor seleccionado'}. 
                          Si el material viene de otro proveedor, considere crear un PO separado.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Unidad de Medida</Label>
                    <div className="mt-1.5">
                      <Select
                        value={itemForm.uom || 'kg'}
                        onValueChange={(v) => setItemForm(f => ({ ...f, uom: v as any }))}
                      >
                        <SelectTrigger className="text-base">
                          <SelectValue />
                        </SelectTrigger>
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
                      <Label className="text-sm font-medium text-gray-700">Peso volumétrico (kg/m³)</Label>
                      <div className="mt-1.5">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={(itemForm as any).volumetric_weight_kg_per_m3 || ''}
                          onChange={(e) => {
                            const num = parseFloat(e.target.value)
                            setItemForm(f => ({ ...(f as any), volumetric_weight_kg_per_m3: isNaN(num) ? undefined : num }))
                          }}
                          placeholder="Ej. 1400"
                          className="text-base"
                        />
                        <p className="mt-1 text-xs text-gray-500">Si se define aquí, las entradas usarán este valor por defecto para convertir m³→kg. Litros no requieren conversión.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Cantidad Ordenada ({itemForm.uom || 'kg'})
                    </Label>
                    <div className="mt-1.5">
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        value={itemForm.qty_ordered || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setItemForm(f => ({ ...f, qty_ordered: val, total: val * f.unit_price }))
                        }}
                        placeholder="0"
                        className="text-base"
                      />
                      {itemForm.qty_ordered > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          {itemForm.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Precio Unitario</Label>
                    <div className="mt-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemForm.unit_price || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setItemForm(f => ({ ...f, unit_price: val, total: f.qty_ordered * val }))
                        }}
                        placeholder="0.00"
                        className="text-base"
                      />
                      {itemForm.unit_price > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          {mxn.format(itemForm.unit_price)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Fecha Límite (Opcional)</Label>
                    <div className="mt-1.5">
                      <Input
                        type="date"
                        value={itemForm.required_by || ''}
                        onChange={(e) => setItemForm(f => ({ ...f, required_by: e.target.value }))}
                        className="text-base"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Total Item Cost - Spans full width */}
              <div className="md:col-span-3 mt-2 p-5 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-600 text-sm mb-1">Total del Ítem</p>
                <p className="text-3xl font-semibold text-gray-900 tabular-nums">
                  {mxn.format(itemForm.total)}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleAddOrUpdateItem}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingItemId ? 'Actualizar Ítem' : 'Agregar Ítem'}
              </Button>
              {editingItemId && (
                <Button
                  onClick={resetItemForm}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 flex-shrink-0">
          <div>
            <p className="text-sm text-gray-600">Total de la orden</p>
            <p className="text-2xl font-semibold text-gray-900">
              {mxn.format(totalValue)}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveItems}
              disabled={loading || items.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </div>
      </div>

      {/* Credit Modal */}
      <ApplyPOCreditModal
        open={creditModalOpen}
        onClose={() => {
          setCreditModalOpen(false)
          setSelectedItemForCredit(null)
        }}
        onSuccess={() => {
          fetchItems() // Refresh items to show updated credit info
        }}
        poItem={selectedItemForCredit}
      />
    </div>
  )
}
