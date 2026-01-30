'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Plus, Trash2, Edit2, Save, Package, Truck } from 'lucide-react'
import { toast } from 'sonner'
import SupplierSelect from '@/components/inventory/SupplierSelect'
import MaterialSelect from '@/components/inventory/MaterialSelect'
import { Plant } from '@/types/plant'

interface POItem {
  tempId: string
  is_service: boolean
  material_id?: string
  material_name?: string
  uom?: 'kg' | 'l' | 'trips' | 'tons' | 'hours' | 'loads' | 'units' | 'm3'
  qty_ordered: number
  unit_price: number
  required_by?: string
  total: number
  volumetric_weight_kg_per_m3?: number
}

interface CreatePOModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  defaultPlantId?: string
}

export default function CreatePOModal({ open, onClose, onSuccess, defaultPlantId }: CreatePOModalProps) {
  const [step, setStep] = useState<'header' | 'items'>('header')
  const [loading, setLoading] = useState(false)
  
  // Header data
  const [plantId, setPlantId] = useState(defaultPlantId || '')
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  
  // Items
  const [items, setItems] = useState<POItem[]>([])
  const [editingItem, setEditingItem] = useState<POItem | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  
  // Item form
  const [itemForm, setItemForm] = useState<POItem>({
    tempId: '',
    is_service: false,
    material_id: '',
    material_name: '',
    uom: 'kg',
    qty_ordered: 0,
    unit_price: 0,
    required_by: '',
    total: 0
  })
  
  const [serviceDescription, setServiceDescription] = useState('')

  const [materials, setMaterials] = useState<any[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [loadingPlants, setLoadingPlants] = useState(false)

  useEffect(() => {
    if (defaultPlantId) setPlantId(defaultPlantId)
  }, [defaultPlantId])

  // Fetch plants when modal opens
  useEffect(() => {
    if (open) {
      setLoadingPlants(true)
      fetch('/api/plants')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setPlants(data.data)
            // Ensure defaultPlantId is selected if provided
            if (defaultPlantId) {
              setPlantId(defaultPlantId)
            }
          }
        })
        .catch(err => {
          console.error('Error fetching plants:', err)
          toast.error('Error al cargar las plantas')
        })
        .finally(() => {
          setLoadingPlants(false)
        })
    }
  }, [open, defaultPlantId])

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep('header')
      setPlantId(defaultPlantId || '')
      setSupplierId('')
      setNotes('')
      setItems([])
      setEditingItem(null)
      setIsEditing(false)
      resetItemForm()
    }
  }, [open, defaultPlantId])

  // Fetch materials for display names
  useEffect(() => {
    if (plantId) {
      fetch(`/api/materials?plant_id=${plantId}`)
        .then(res => res.json())
        .then(data => setMaterials(data.data || []))
        .catch(() => {})
    }
  }, [plantId])

  const resetItemForm = () => {
    setItemForm({
      tempId: '',
      is_service: false,
      material_id: '',
      material_name: '',
      uom: 'kg',
      qty_ordered: 0,
      unit_price: 0,
      required_by: '',
      total: 0
    })
    setServiceDescription('')
  }

  const handleAddItem = () => {
    if (!itemForm.is_service && !itemForm.material_id) {
      toast.error('Seleccione un material')
      return
    }
    if (itemForm.is_service && !serviceDescription.trim()) {
      toast.error('Ingrese descripción del servicio')
      return
    }
    if (itemForm.qty_ordered <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }
    if (itemForm.unit_price < 0) {
      toast.error('El precio no puede ser negativo')
      return
    }

    const materialName = itemForm.is_service 
      ? serviceDescription 
      : materials.find(m => m.id === itemForm.material_id)?.material_name || 'Material'

    const newItem: POItem = {
      ...itemForm,
      tempId: `temp-${Date.now()}`,
      material_name: materialName,
      total: itemForm.qty_ordered * itemForm.unit_price
    }

    setItems([...items, newItem])
    resetItemForm()
    toast.success('Ítem agregado')
  }

  const handleUpdateItem = () => {
    if (!editingItem) return
    
    if (!itemForm.is_service && !itemForm.material_id) {
      toast.error('Seleccione un material')
      return
    }
    if (itemForm.qty_ordered <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }

    const materialName = itemForm.is_service 
      ? 'Servicio de Flota' 
      : materials.find(m => m.id === itemForm.material_id)?.material_name || 'Material'

    const updatedItem: POItem = {
      ...itemForm,
      tempId: editingItem.tempId,
      material_name: materialName,
      total: itemForm.qty_ordered * itemForm.unit_price
    }

    setItems(items.map(it => it.tempId === editingItem.tempId ? updatedItem : it))
    setEditingItem(null)
    setIsEditing(false)
    resetItemForm()
    toast.success('Ítem actualizado')
  }

  const handleEditItem = (item: POItem) => {
    setEditingItem(item)
    setItemForm({ ...item })
    setIsEditing(true)
  }

  const handleDeleteItem = (tempId: string) => {
    setItems(items.filter(it => it.tempId !== tempId))
    toast.success('Ítem eliminado')
  }

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Agregue al menos un ítem al PO')
      return
    }

    setLoading(true)
    try {
      // Create PO header
      const resHeader = await fetch('/api/po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: plantId,
          supplier_id: supplierId,
          currency: 'MXN',
          notes: notes || undefined
        })
      })

      if (!resHeader.ok) {
        const err = await resHeader.json()
        throw new Error(err.error || 'Error al crear PO')
      }

      const { purchase_order } = await resHeader.json()
      const poId = purchase_order.id

      // Create items
      const itemPromises = items.map(item => {
        const payload: any = {
          is_service: item.is_service,
          qty_ordered: item.qty_ordered,
          unit_price: item.unit_price,
          uom: item.uom,
        }

        // Add service or material fields
        if (item.is_service) {
          payload.service_description = item.service_description
        } else {
          payload.material_id = item.material_id
        }

        // Optional fields
        if (item.required_by) {
          payload.required_by = item.required_by
        }

        return fetch(`/api/po/${poId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      })

      const itemResults = await Promise.all(itemPromises)
      const failures = itemResults.filter(r => !r.ok)
      
      if (failures.length > 0) {
        toast.warning(`PO creado, pero ${failures.length} ítem(s) fallaron`)
      } else {
        toast.success(`PO #${poId.slice(0,8)} creado con ${items.length} ítem(s)`)
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating PO:', error)
      toast.error(error instanceof Error ? error.message : 'Error al crear PO')
    } finally {
      setLoading(false)
    }
  }

  const subtotal = items.reduce((sum, it) => sum + it.total, 0)
  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">Crear Orden de Compra</h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'header' ? 'Paso 1: Información General' : `Paso 2: Ítems del PO (${items.length} agregados)`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'header' && (
            <Card>
              <CardHeader>
                <CardTitle>Información del Proveedor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Planta</Label>
                    <div className="mt-1.5">
                      <Select 
                        value={plantId} 
                        onValueChange={setPlantId}
                        disabled={loadingPlants}
                      >
                        <SelectTrigger className="text-base">
                          <SelectValue placeholder={loadingPlants ? "Cargando plantas..." : "Seleccionar planta"} />
                        </SelectTrigger>
                        <SelectContent>
                          {plants.map((plant) => (
                            <SelectItem key={plant.id} value={plant.id}>
                              {plant.name} ({plant.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-gray-500">
                        {defaultPlantId ? 'Predeterminado a la planta actual' : 'Seleccione una planta'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Proveedor</Label>
                    <div className="mt-1.5">
                      <SupplierSelect 
                        value={supplierId} 
                        onChange={setSupplierId}
                        plantId={plantId || undefined}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Notas Internas</Label>
                  <div className="mt-1.5">
                    <Textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Notas adicionales sobre esta orden de compra..."
                      className="text-base resize-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'items' && (
            <div className="space-y-6">
              {/* Items List */}
              <Card>
                <CardHeader>
                  <CardTitle>Ítems del Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>No hay ítems agregados</p>
                      <p className="text-sm">Agregue materiales o servicios abajo</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={item.tempId} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex-shrink-0 w-8 text-center font-semibold text-gray-500">
                            {idx + 1}
                          </div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                            <div className="md:col-span-2">
                              <div className="flex items-center gap-2">
                                {item.is_service ? (
                                  <Truck className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <Package className="h-4 w-4 text-green-600" />
                                )}
                                <div>
                                  <div className="font-medium text-sm">{item.material_name}</div>
                                  <div className="text-xs text-gray-500">
                                    {item.is_service ? 'Servicio' : `Material · ${item.uom?.toUpperCase()}`}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="text-gray-500 text-xs">Cantidad</div>
                              <div className="font-semibold">{item.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {item.uom || 'unidad'}</div>
                            </div>
                            <div className="text-sm">
                              <div className="text-gray-500 text-xs">Precio Unit.</div>
                              <div className="font-semibold">{mxn.format(item.unit_price)}</div>
                            </div>
                            <div className="text-sm">
                              <div className="text-gray-500 text-xs">Total</div>
                              <div className="font-bold">{mxn.format(item.total)}</div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteItem(item.tempId)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end pt-4 border-t mt-4">
                        <div className="text-right">
                          <div className="text-sm text-gray-500">Subtotal del PO</div>
                          <div className="text-2xl font-bold">{mxn.format(subtotal)}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add/Edit Item Form */}
              <Card>
                <CardHeader>
                  <CardTitle>{isEditing ? 'Editar Ítem' : 'Agregar Ítem'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Tipo de Ítem</Label>
                      <div className="mt-1.5">
                        <Select 
                          value={itemForm.is_service ? 'service' : 'material'}
                          onValueChange={(v) => {
                            const isService = v === 'service'
                            setItemForm(f => ({ 
                              ...f, 
                              is_service: isService, 
                              material_id: '', 
                              uom: isService ? 'trips' : 'kg' 
                            }))
                            if (!isService) setServiceDescription('')
                          }}
                        >
                          <SelectTrigger className="text-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="service">Servicio (Flota/Transporte)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {itemForm.is_service ? (
                      <>
                        <div className="md:col-span-2">
                          <Label className="text-sm font-medium text-gray-700">Descripción del Servicio</Label>
                          <div className="mt-1.5">
                            <Input
                              value={serviceDescription}
                              onChange={(e) => setServiceDescription(e.target.value)}
                              placeholder="Ej: Transporte de cemento, Flete viaje sencillo, etc."
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
                                const val = e.target.value
                                if (val === '') {
                                  setItemForm(f => ({ ...f, qty_ordered: 0 }))
                                  return
                                }
                                const num = parseFloat(val)
                                if (!isNaN(num) && num >= 0) {
                                  setItemForm(f => ({ ...f, qty_ordered: num }))
                                }
                              }}
                              placeholder="0"
                              className="text-base"
                            />
                            {itemForm.qty_ordered > 0 && (
                              <p className="mt-1 text-xs text-gray-500">
                                {itemForm.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {itemForm.uom || 'viajes'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-700">Precio Unitario (MXN)</Label>
                          <div className="mt-1.5">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={itemForm.unit_price || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === '') {
                                  setItemForm(f => ({ ...f, unit_price: 0 }))
                                  return
                                }
                                const num = parseFloat(val)
                                if (!isNaN(num) && num >= 0) {
                                  setItemForm(f => ({ ...f, unit_price: num }))
                                }
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
                          <Label className="text-sm font-medium text-gray-700">Fecha Límite de Entrega (Opcional)</Label>
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
                    ) : (
                      <>
                        <div className="md:col-span-2">
                          <Label className="text-sm font-medium text-gray-700">Material</Label>
                          <div className="mt-1.5">
                            <MaterialSelect
                              value={itemForm.material_id || ''}
                              onChange={(v: string) => setItemForm(f => ({ ...f, material_id: v }))}
                              plantId={plantId || undefined}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Unidad de Medida</Label>
                          <div className="mt-1.5">
                            <Select 
                              value={itemForm.uom}
                              onValueChange={(v) => setItemForm(f => ({ ...f, uom: v as 'kg' | 'l' | 'm3' }))}
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
                                const val = e.target.value
                                if (val === '') {
                                  setItemForm(f => ({ ...f, qty_ordered: 0 }))
                                  return
                                }
                                const num = parseFloat(val)
                                if (!isNaN(num) && num >= 0) {
                                  setItemForm(f => ({ ...f, qty_ordered: num }))
                                }
                              }}
                              placeholder="0"
                              className="text-base"
                            />
                            {itemForm.qty_ordered > 0 && (
                              <p className="mt-1 text-xs text-gray-500">
                                {itemForm.qty_ordered.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {itemForm.uom || 'kg'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-700">Precio Unitario (MXN)</Label>
                          <div className="mt-1.5">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={itemForm.unit_price || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === '') {
                                  setItemForm(f => ({ ...f, unit_price: 0 }))
                                  return
                                }
                                const num = parseFloat(val)
                                if (!isNaN(num) && num >= 0) {
                                  setItemForm(f => ({ ...f, unit_price: num }))
                                }
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
                          <Label className="text-sm font-medium text-gray-700">Fecha Límite de Entrega (Opcional)</Label>
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

                    <div className="md:col-span-3">
                      <div className="mt-4 p-5 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-baseline justify-between">
                          <div className="text-sm font-medium text-gray-600">Total del Ítem</div>
                          <div className="text-3xl font-semibold text-gray-900 tabular-nums">
                            {mxn.format((itemForm.qty_ordered || 0) * (itemForm.unit_price || 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    {isEditing && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false)
                          setEditingItem(null)
                          resetItemForm()
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button
                      onClick={isEditing ? handleUpdateItem : handleAddItem}
                    >
                      {isEditing ? (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Actualizar Ítem
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Ítem
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 flex-shrink-0">
          <div>
            {step === 'items' && (
              <Button
                variant="outline"
                onClick={() => setStep('header')}
              >
                Anterior
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {step === 'header' ? (
              <Button
                onClick={() => {
                  if (!plantId || !supplierId) {
                    toast.error('Complete planta y proveedor')
                    return
                  }
                  setStep('items')
                }}
              >
                Continuar a Ítems
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || items.length === 0}
              >
                {loading ? 'Creando...' : `Crear PO (${items.length} ${items.length === 1 ? 'ítem' : 'ítems'})`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

