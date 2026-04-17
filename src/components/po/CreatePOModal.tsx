'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  material_supplier_id?: string // For fleet/service items
  service_description?: string
}

export type PrefillFromAlert = {
  alertId: string
  materialId: string
  plantId: string
  /** Suggested order qty (e.g. kg from physical count) */
  suggestedQtyKg: number
}

/** Second-step fleet PO: transport supplier header; material supplier on service line for pricing context */
export type PrefillFleetFromAlert = {
  alertId: string
  plantId: string
  /** Proveedor de material (OC principal) — va en línea de servicio como material_supplier_id */
  materialSupplierId: string
}

/** Revisión de precios: crear OC de servicio (flota/flete) sin alerta — trazabilidad en notas */
export type PrefillFleetFromMaterialEntry = {
  plantId: string
  materialSupplierId: string
  notesHint?: string
}

/** Revisión de precios / entrada sin OC: crear OC material con planta, proveedor y cantidad sugerida */
export type PrefillFromMaterialEntry = {
  plantId: string
  supplierId: string
  materialId: string
  suggestedQty: number
  quantityUom: 'kg' | 'l' | 'm3'
  /** kg/m³ para prellenar líneas en m³ (revisión de precios) */
  volumetricWeightKgPerM3?: number
  /** Notas del encabezado (trazabilidad) */
  notesHint?: string
}

interface CreatePOModalProps {
  open: boolean
  onClose: () => void
  /** Called after successful creation; materialSupplierId when header supplier was chosen (for fleet follow-up). */
  onSuccess: (createdPoId?: string, meta?: { materialSupplierId?: string }) => void
  defaultPlantId?: string
  /** Pre-select material on the ítems step (e.g. from a material alert). */
  defaultMaterialId?: string
  /** Pre-fill first line + auto-link alert after PO creation */
  prefillFromAlert?: PrefillFromAlert | null
  /** Pre-fill service line for fleet PO + link to alert as fleet_po_id */
  prefillFleetFromAlert?: PrefillFleetFromAlert | null
  /** Pre-fill desde revisión de precios (entrada sin línea de OC material) — sin vincular alertas */
  prefillFromMaterialEntry?: PrefillFromMaterialEntry | null
  /** Pre-fill OC de flota desde revisión de precios (misma lógica que alerta, sin link a alerta) */
  prefillFleetFromMaterialEntry?: PrefillFleetFromMaterialEntry | null
}

export default function CreatePOModal({
  open,
  onClose,
  onSuccess,
  defaultPlantId,
  defaultMaterialId,
  prefillFromAlert,
  prefillFleetFromAlert,
  prefillFromMaterialEntry,
  prefillFleetFromMaterialEntry,
}: CreatePOModalProps) {
  const [step, setStep] = useState<'header' | 'items'>('header')
  const [loading, setLoading] = useState(false)
  
  // Header data
  const [plantId, setPlantId] = useState(defaultPlantId || '')
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentTermsDays, setPaymentTermsDays] = useState(30)
  
  // Items
  const [items, setItems] = useState<POItem[]>([])
  const [editingItem, setEditingItem] = useState<POItem | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  
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
  const [materialSupplierId, setMaterialSupplierId] = useState('')

  const [materials, setMaterials] = useState<any[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [plants, setPlants] = useState<Plant[]>([])
  const [loadingPlants, setLoadingPlants] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const mixedPoToastShownRef = useRef(false)
  const [fleetLineMix, setFleetLineMix] = useState<{
    has_fleet_lines: boolean
    has_material_lines: boolean
    fleet_only: boolean
    material_only: boolean
  } | null>(null)
  /** Controlled strings so users can type decimals like 0.85 without the field clearing on "0." */
  const [unitPriceInput, setUnitPriceInput] = useState('')
  const [qtyInput, setQtyInput] = useState('')

  useEffect(() => {
    if (defaultPlantId) setPlantId(defaultPlantId)
  }, [defaultPlantId])

  useEffect(() => {
    if (open && defaultMaterialId) {
      setItemForm((prev) => ({ ...prev, material_id: defaultMaterialId }))
    }
  }, [open, defaultMaterialId])

  useEffect(() => {
    if (!open || !prefillFromAlert || prefillFleetFromAlert || prefillFleetFromMaterialEntry) return
    setPlantId(prefillFromAlert.plantId)
    const qty = Math.max(Number(prefillFromAlert.suggestedQtyKg) || 0, 1)
    setItems([
      {
        tempId: `alert-${prefillFromAlert.alertId.slice(0, 8)}`,
        is_service: false,
        material_id: prefillFromAlert.materialId,
        material_name: '',
        uom: 'kg',
        qty_ordered: qty,
        unit_price: 0,
        total: 0,
      },
    ])
    setStep('header')
  }, [open, prefillFromAlert, prefillFleetFromAlert, prefillFleetFromMaterialEntry])

  useEffect(() => {
    if (!open || !prefillFromMaterialEntry || prefillFromAlert || prefillFleetFromAlert || prefillFleetFromMaterialEntry)
      return
    setPlantId(prefillFromMaterialEntry.plantId)
    setSupplierId(prefillFromMaterialEntry.supplierId)
    if (prefillFromMaterialEntry.notesHint) {
      setNotes(prefillFromMaterialEntry.notesHint)
    }
    const qty = Math.max(Number(prefillFromMaterialEntry.suggestedQty) || 0, 1)
    const uom = prefillFromMaterialEntry.quantityUom
    setItems([
      {
        tempId: `pricing-${Date.now()}`,
        is_service: false,
        material_id: prefillFromMaterialEntry.materialId,
        material_name: '',
        uom,
        qty_ordered: qty,
        unit_price: 0,
        total: 0,
        ...(uom === 'm3' && prefillFromMaterialEntry.volumetricWeightKgPerM3
          ? { volumetric_weight_kg_per_m3: prefillFromMaterialEntry.volumetricWeightKgPerM3 }
          : {}),
      },
    ])
    setStep('header')
  }, [open, prefillFromMaterialEntry, prefillFromAlert, prefillFleetFromAlert, prefillFleetFromMaterialEntry])

  useEffect(() => {
    if (!open || !prefillFleetFromAlert) return
    setPlantId(prefillFleetFromAlert.plantId)
    setMaterialSupplierId(prefillFleetFromAlert.materialSupplierId)
    const desc = 'Transporte / flete'
    setServiceDescription(desc)
    setItems([
      {
        tempId: `fleet-${prefillFleetFromAlert.alertId.slice(0, 8)}`,
        is_service: true,
        material_name: desc,
        service_description: desc,
        uom: 'trips',
        qty_ordered: 1,
        unit_price: 0,
        total: 0,
        material_supplier_id: prefillFleetFromAlert.materialSupplierId,
      },
    ])
    setStep('header')
  }, [open, prefillFleetFromAlert])

  useEffect(() => {
    if (!open || !prefillFleetFromMaterialEntry || prefillFleetFromAlert) return
    setPlantId(prefillFleetFromMaterialEntry.plantId)
    setMaterialSupplierId(prefillFleetFromMaterialEntry.materialSupplierId)
    if (prefillFleetFromMaterialEntry.notesHint) {
      setNotes(prefillFleetFromMaterialEntry.notesHint)
    }
    const desc = 'Transporte / flete'
    setServiceDescription(desc)
    setItems([
      {
        tempId: `fleet-pricing-${Date.now()}`,
        is_service: true,
        material_name: desc,
        service_description: desc,
        uom: 'trips',
        qty_ordered: 1,
        unit_price: 0,
        total: 0,
        material_supplier_id: prefillFleetFromMaterialEntry.materialSupplierId,
      },
    ])
    setStep('header')
  }, [open, prefillFleetFromMaterialEntry, prefillFleetFromAlert])

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
      setPoDate(new Date().toISOString().slice(0, 10))
      setPaymentTermsDays(30)
      setItems([])
      setEditingItem(null)
      setIsEditing(false)
      setShowAddForm(false)
      setDiscardConfirmOpen(false)
      mixedPoToastShownRef.current = false
      setFleetLineMix(null)
      resetItemForm()
    }
  }, [open, defaultPlantId])

  // Mirror catalog for empty-state + resolving names (MaterialSelect also loads; avoid stale races with AbortSignal)
  useEffect(() => {
    if (!plantId) {
      setMaterials([])
      setMaterialsLoading(false)
      return
    }
    const ac = new AbortController()
    setMaterialsLoading(true)
    const qs = new URLSearchParams({ plant_id: plantId })
    if (supplierId) qs.set('supplier_id', supplierId)
    fetch(`/api/materials?${qs.toString()}`, { signal: ac.signal })
      .then((res) => res.json())
      .then((data) => setMaterials(data.data || []))
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setMaterials([])
      })
      .finally(() => {
        if (!ac.signal.aborted) setMaterialsLoading(false)
      })
    return () => ac.abort()
  }, [plantId, supplierId])

  /** Backfill material_name on the line form when parent catalog arrives after selection (from MaterialSelect meta). */
  useEffect(() => {
    if (itemForm.is_service || !itemForm.material_id || itemForm.material_name) return
    const m = materials.find((x) => x.id === itemForm.material_id)
    if (m) setItemForm((f) => ({ ...f, material_name: m.material_name }))
  }, [materials, itemForm.material_id, itemForm.material_name, itemForm.is_service])

  /** Prefill rows: resolve display name once catalog loads */
  useEffect(() => {
    if (!open || !plantId || materials.length === 0) return
    setItems((prev) => {
      let changed = false
      const next = prev.map((it) => {
        if (it.is_service || !it.material_id || it.material_name) return it
        const m = materials.find((x) => x.id === it.material_id)
        if (!m) return it
        changed = true
        return { ...it, material_name: m.material_name }
      })
      return changed ? next : prev
    })
  }, [materials, open, plantId])

  // Fetch suppliers for material supplier selection (fleet POs)
  useEffect(() => {
    if (plantId) {
      fetch(`/api/suppliers?plant_id=${plantId}`)
        .then(res => res.json())
        .then(data => {
          if (data.suppliers) {
            setSuppliers(data.suppliers || [])
          }
        })
        .catch(() => {})
    }
  }, [plantId])

  // Supplier PO line history hint when adding a service line
  useEffect(() => {
    if (!open || !itemForm.is_service || !supplierId || !plantId) {
      setFleetLineMix(null)
      return
    }
    let cancelled = false
    fetch(`/api/suppliers/${supplierId}/po-line-mix?plant_id=${encodeURIComponent(plantId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || j.error) return
        if (typeof j.has_fleet_lines === 'boolean') setFleetLineMix(j)
      })
      .catch(() => setFleetLineMix(null))
    return () => {
      cancelled = true
    }
  }, [open, itemForm.is_service, supplierId, plantId])

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
      total: 0,
    })
    setServiceDescription('')
    setMaterialSupplierId('')
    setUnitPriceInput('')
    setQtyInput('')
  }

  const parseQtyFromInput = () => {
    const t = qtyInput.trim().replace(',', '.')
    if (t === '') return NaN
    const n = parseFloat(t)
    return Number.isNaN(n) ? NaN : n
  }

  const parsePriceFromInput = () => {
    const t = unitPriceInput.trim().replace(',', '.')
    if (t === '') return NaN
    const n = parseFloat(t)
    return Number.isNaN(n) ? NaN : n
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
    const qty = parseQtyFromInput()
    const unitPrice = parsePriceFromInput()
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      toast.error('El precio no puede ser negativo')
      return
    }

    if (!itemForm.is_service) {
      if (items.some((it) => !it.is_service && it.material_id === itemForm.material_id)) {
        toast.error('Este material ya está en la lista')
        return
      }
    } else {
      const sd = serviceDescription.trim().toLowerCase()
      if (items.some((it) => it.is_service && (it.service_description || '').trim().toLowerCase() === sd)) {
        toast.error('Ya agregó un servicio con la misma descripción')
        return
      }
    }

    if (!mixedPoToastShownRef.current) {
      const willAddMaterial = !itemForm.is_service
      const hasService = items.some((i) => i.is_service)
      const hasMaterial = items.some((i) => !i.is_service)
      if ((willAddMaterial && hasService) || (!willAddMaterial && hasMaterial)) {
        toast.info(
          'Esta OC tendrá materiales y servicios. Si prefiere separarlas, cree dos órdenes distintas.'
        )
        mixedPoToastShownRef.current = true
      }
    }

    const materialName = itemForm.is_service
      ? serviceDescription.trim()
      : itemForm.material_name?.trim() ||
        materials.find((m) => m.id === itemForm.material_id)?.material_name ||
        'Material'

    const newItem: POItem = {
      ...itemForm,
      tempId: `temp-${Date.now()}`,
      qty_ordered: qty,
      unit_price: unitPrice,
      material_name: materialName,
      service_description: itemForm.is_service ? serviceDescription.trim() : undefined,
      material_supplier_id: itemForm.is_service ? materialSupplierId : undefined,
      total: qty * unitPrice
    }

    setItems([...items, newItem])
    resetItemForm()
    setShowAddForm(false)
    toast.success('Ítem agregado')
  }

  const handleUpdateItem = () => {
    if (!editingItem) return
    
    if (!itemForm.is_service && !itemForm.material_id) {
      toast.error('Seleccione un material')
      return
    }
    if (itemForm.is_service && !serviceDescription.trim()) {
      toast.error('Ingrese descripción del servicio')
      return
    }
    const qty = parseQtyFromInput()
    const unitPrice = parsePriceFromInput()
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      toast.error('El precio no puede ser negativo')
      return
    }

    if (!itemForm.is_service) {
      if (
        items.some(
          (it) =>
            it.tempId !== editingItem.tempId &&
            !it.is_service &&
            it.material_id === itemForm.material_id
        )
      ) {
        toast.error('Este material ya está en la lista')
        return
      }
    } else {
      const sd = serviceDescription.trim().toLowerCase()
      if (
        items.some(
          (it) =>
            it.tempId !== editingItem.tempId &&
            it.is_service &&
            (it.service_description || '').trim().toLowerCase() === sd
        )
      ) {
        toast.error('Ya agregó un servicio con la misma descripción')
        return
      }
    }

    const materialName = itemForm.is_service
      ? serviceDescription.trim()
      : itemForm.material_name?.trim() ||
        materials.find((m) => m.id === itemForm.material_id)?.material_name ||
        'Material'

    const updatedItem: POItem = {
      ...itemForm,
      tempId: editingItem.tempId,
      qty_ordered: qty,
      unit_price: unitPrice,
      material_name: materialName,
      service_description: itemForm.is_service ? serviceDescription.trim() : undefined,
      material_supplier_id: itemForm.is_service ? materialSupplierId : undefined,
      total: qty * unitPrice
    }

    setItems(items.map(it => it.tempId === editingItem.tempId ? updatedItem : it))
    setEditingItem(null)
    setIsEditing(false)
    setShowAddForm(false)
    resetItemForm()
    toast.success('Ítem actualizado')
  }

  const handleEditItem = (item: POItem) => {
    setEditingItem(item)
    setItemForm({ ...item })
    setServiceDescription(item.service_description || '')
    setMaterialSupplierId(item.material_supplier_id || '')
    setUnitPriceInput(item.unit_price === 0 ? '' : String(item.unit_price))
    setQtyInput(item.qty_ordered === 0 ? '' : String(item.qty_ordered))
    setIsEditing(true)
    setShowAddForm(true)
  }

  const handleDeleteItem = (tempId: string) => {
    setItems(items.filter(it => it.tempId !== tempId))
    toast.success('Ítem eliminado')
  }

  /** Inline-edit staged rows: mutate qty / unit_price / required_by, recompute total. */
  const updateItem = (tempId: string, patch: Partial<POItem>) => {
    setItems(prev => prev.map(it => {
      if (it.tempId !== tempId) return it
      const next = { ...it, ...patch }
      next.total = (Number(next.qty_ordered) || 0) * (Number(next.unit_price) || 0)
      return next
    }))
  }

  const hasDirty = () => {
    if (items.length > 0) return true
    if (step === 'items' && supplierId) return true
    return false
  }

  const tryClose = () => {
    if (hasDirty()) {
      setDiscardConfirmOpen(true)
    } else {
      onClose()
    }
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
          notes: notes || undefined,
          po_date: poDate || undefined,
          payment_terms_days: paymentTermsDays,
        })
      })

      if (!resHeader.ok) {
        const err = await resHeader.json()
        throw new Error(err.error || 'Error al crear PO')
      }

      const { purchase_order } = await resHeader.json()
      const poId = purchase_order.id
      const poNumber = purchase_order.po_number as string | undefined

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
          const sd = (item.service_description ?? '').trim()
          payload.service_description = sd
          if (item.material_supplier_id) {
            payload.material_supplier_id = item.material_supplier_id
          }
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
        const firstErr = await failures[0].json().catch(() => ({}))
        toast.warning(
          `OC creada, pero ${failures.length} ítem(s) fallaron${firstErr?.error ? `: ${firstErr.error}` : ''}`
        )
      } else {
        const label = poNumber || `OC ${poId.slice(0, 8)}`
        toast.success(`${label} creada con ${items.length} ítem(s)`)
      }

      if (prefillFleetFromAlert?.alertId) {
        try {
          const linkRes = await fetch(`/api/alerts/material/${prefillFleetFromAlert.alertId}/link-fleet-po`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ po_id: poId }),
          })
          if (!linkRes.ok) {
            const j = await linkRes.json().catch(() => ({}))
            toast.warning(j.error || 'OC creada; no se pudo vincular la OC de flete a la alerta')
          } else {
            toast.success('OC de flete vinculada a la alerta')
          }
        } catch {
          toast.warning('OC creada; vincule la OC de flete a la alerta manualmente si aplica')
        }
        onSuccess(poId)
        onClose()
        return
      }

      if (prefillFromAlert?.alertId) {
        try {
          const linkRes = await fetch(`/api/alerts/material/${prefillFromAlert.alertId}/link-po`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ po_id: poId }),
          })
          if (!linkRes.ok) {
            const j = await linkRes.json().catch(() => ({}))
            toast.warning(j.error || 'OC creada; no se pudo vincular la alerta automáticamente')
          } else {
            toast.success('Alerta vinculada a la nueva OC')
          }
        } catch {
          toast.warning('OC creada; vincule la alerta manualmente si aplica')
        }
      }

      // prefillFromMaterialEntry: solo trazabilidad en notas; vincular línea a la entrada en revisión de precios (UI)

      onSuccess(poId, { materialSupplierId: supplierId })
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
  const plantName = plants.find((p) => p.id === plantId)?.name
  const linePreviewTotal = (() => {
    const q = parseQtyFromInput()
    const p = parsePriceFromInput()
    const qq = Number.isNaN(q) ? 0 : q
    const pp = Number.isNaN(p) ? 0 : p
    return qq * pp
  })()
  if (!open) return null

  const addFormOpen = showAddForm || (step === 'items' && items.length === 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 overflow-hidden">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">Crear Orden de Compra</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              {step === 'header' ? 'Paso 1: Información General' : `Paso 2: Ítems del PO (${items.length} agregados)`}
            </p>
          </div>
          <button onClick={tryClose} className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-stone-600">
            <X className="h-5 w-5" />
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
                    <Label className="text-sm font-medium text-stone-700">Planta</Label>
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
                      <p className="mt-1 text-xs text-stone-500">
                        {defaultPlantId ? 'Predeterminado a la planta actual' : 'Seleccione una planta'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-stone-700">Proveedor</Label>
                    <div className="mt-1.5">
                      <SupplierSelect 
                        value={supplierId} 
                        onChange={setSupplierId}
                        plantId={plantId || undefined}
                        plantName={plantName}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-stone-700">Fecha de Orden</Label>
                    <div className="mt-1.5">
                      <Input
                        type="date"
                        value={poDate}
                        onChange={(e) => setPoDate(e.target.value)}
                        className="text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-stone-700">Días de Pago</Label>
                    <div className="mt-1.5">
                      <Select value={String(paymentTermsDays)} onValueChange={(v) => setPaymentTermsDays(parseInt(v, 10))}>
                        <SelectTrigger className="text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Contado</SelectItem>
                          <SelectItem value="15">15 días</SelectItem>
                          <SelectItem value="30">30 días</SelectItem>
                          <SelectItem value="45">45 días</SelectItem>
                          <SelectItem value="60">60 días</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-stone-700">Notas Internas</Label>
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
            <div className="space-y-4">
              <div className="rounded-md border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-xs text-amber-950 space-y-2">
                <p className="font-semibold">Precio en OC vs listas de precio</p>
                <p>
                  El <strong>precio unitario</strong> que capture aquí es el acuerdo con el proveedor en esta orden.
                  Las listas de precio del catálogo sirven de referencia al cotizar; <strong>no reemplazan</strong> el precio negociado en la OC.
                </p>
                <p>
                  <strong>Material</strong> consume inventario al recibir. <strong>Servicio (flota)</strong> cubre transporte u otros servicios sin material (por ejemplo viajes, toneladas).
                </p>
              </div>

              {/* Items List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                    Ítems del pedido {items.length > 0 && <span className="text-stone-500 font-normal">({items.length})</span>}
                  </h3>
                  {items.length > 0 && !addFormOpen && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setIsEditing(false); setEditingItem(null); resetItemForm(); setShowAddForm(true) }}
                      className="border-stone-300 text-stone-700 hover:bg-stone-100"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Agregar ítem
                    </Button>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-8 text-stone-500 max-w-md mx-auto border border-dashed border-stone-300 rounded-md bg-stone-50">
                    <Package className="h-10 w-10 mx-auto mb-2 text-stone-400" />
                    <p className="font-medium text-stone-700 mb-2">Aún no hay ítems</p>
                    <ol className="text-xs text-left list-decimal pl-5 space-y-1 text-stone-600 px-6">
                      <li>Seleccione tipo: <strong>Material</strong> o <strong>Servicio</strong> (flota/transporte).</li>
                      <li>Elija un material del catálogo o escriba la descripción del servicio.</li>
                      <li>Indique cantidad, unidad de medida y precio unitario acordado.</li>
                    </ol>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const qtyInvalid = item.qty_ordered <= 0
                      const priceInvalid = item.unit_price < 0
                      return (
                        <div
                          key={item.tempId}
                          className="border border-stone-200 bg-stone-50 rounded-md p-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Row header */}
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {item.is_service ? (
                                  <>
                                    <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                                    <span className="font-semibold text-sm text-stone-800">{item.material_name}</span>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">SERVICIO</span>
                                  </>
                                ) : (
                                  <>
                                    <Package className="h-4 w-4 text-green-600 shrink-0" />
                                    <span className="font-semibold text-sm text-stone-800">{item.material_name}</span>
                                    <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">MATERIAL</span>
                                  </>
                                )}
                              </div>

                              {item.is_service && item.material_supplier_id && (
                                <p className="text-xs text-blue-600 mb-2">
                                  Para: {suppliers.find(s => s.id === item.material_supplier_id)?.name || 'Proveedor'}
                                </p>
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
                                      updateItem(item.tempId, { qty_ordered: val })
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
                                      updateItem(item.tempId, { unit_price: val })
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
                                    onChange={(e) => updateItem(item.tempId, { required_by: e.target.value })}
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
                              <button
                                onClick={() => handleEditItem(item)}
                                className="p-2 hover:bg-white rounded text-stone-500 hover:text-stone-800"
                                title="Editar material / UoM / tipo"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.tempId)}
                                className="p-2 hover:bg-white rounded text-red-500"
                                title="Eliminar ítem"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-stone-200 text-sm">
                      <span className="text-stone-500">
                        Subtotal · {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                      </span>
                      <span className="text-lg font-semibold text-stone-900 tabular-nums">{mxn.format(subtotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Add/Edit Item Form */}
              {addFormOpen && (
              <Card className="border-stone-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
                    {isEditing ? 'Editar material / tipo' : 'Agregar ítem'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label className="text-sm font-medium text-stone-700">Tipo de Ítem</Label>
                      <div className="mt-1.5">
                        <Select 
                          value={itemForm.is_service ? 'service' : 'material'}
                          onValueChange={(v) => {
                            const isService = v === 'service'
                            setItemForm(f => ({
                              ...f,
                              is_service: isService,
                              material_id: '',
                              material_name: '',
                              uom: isService ? 'trips' : 'kg',
                            }))
                            if (!isService) setServiceDescription('')
                            setUnitPriceInput('')
                            setQtyInput('')
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
                          <Label className="text-sm font-medium text-stone-700">Descripción del Servicio</Label>
                          <div className="mt-1.5">
                            <Input
                              value={serviceDescription}
                              onChange={(e) => setServiceDescription(e.target.value)}
                              placeholder="Ej: Transporte de cemento, Flete viaje sencillo, etc."
                              className="text-base"
                            />
                            {fleetLineMix?.fleet_only && (
                              <p className="mt-2 text-xs text-sky-900 bg-sky-50 border border-sky-100 rounded px-2 py-1.5">
                                Este proveedor se usa habitualmente para flota en esta planta.
                              </p>
                            )}
                            {fleetLineMix?.material_only && (
                              <p className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                                Este proveedor no tiene historial de servicios de flota con esta planta; confirme que el servicio corresponda.
                              </p>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-stone-700">Unidad de Medida</Label>
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
                          <Label className="text-sm font-medium text-stone-700">
                            Cantidad Ordenada ({itemForm.uom || 'viajes'})
                          </Label>
                          <div className="mt-1.5">
                            <Input
                              inputMode="decimal"
                              value={qtyInput}
                              onChange={(e) => setQtyInput(e.target.value)}
                              placeholder="0"
                              className="text-base"
                            />
                            {!Number.isNaN(parseQtyFromInput()) && parseQtyFromInput() > 0 && (
                              <p className="mt-1 text-xs text-stone-500">
                                {parseQtyFromInput().toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}{' '}
                                {itemForm.uom || 'viajes'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-stone-700">Precio Unitario (MXN)</Label>
                          <div className="mt-1.5">
                            <Input
                              inputMode="decimal"
                              value={unitPriceInput}
                              onChange={(e) => setUnitPriceInput(e.target.value)}
                              placeholder="0.00"
                              className="text-base"
                            />
                            {!Number.isNaN(parsePriceFromInput()) && parsePriceFromInput() >= 0 && unitPriceInput.trim() !== '' && (
                              <p className="mt-1 text-xs text-stone-500">{mxn.format(parsePriceFromInput())}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-stone-700">Fecha Límite de Entrega (Opcional)</Label>
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
                          <Label className="text-sm font-medium text-stone-700">Proveedor de Material</Label>
                          <div className="mt-1.5">
                            <SupplierSelect
                              value={materialSupplierId}
                              onChange={setMaterialSupplierId}
                              plantId={plantId || undefined}
                              plantName={plantName}
                            />
                            <p className="mt-1 text-xs text-stone-500">
                              Seleccione el proveedor de material para el cual este servicio de flota aplica
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
                              value={itemForm.material_id || ''}
                              onChange={(v: string, meta) =>
                                setItemForm((f) => ({
                                  ...f,
                                  material_id: v,
                                  material_name: meta?.material_name ?? (v ? f.material_name : ''),
                                }))
                              }
                              plantId={plantId || undefined}
                              supplierId={supplierId || undefined}
                            />
                            {supplierId && (
                              <p className="mt-1 text-xs text-stone-500">
                                Catálogo completo de la planta. Arriba aparecen <strong>sugeridos</strong> según OCs previas,
                                acuerdos o recepciones con este proveedor; puede elegir cualquier material.
                              </p>
                            )}
                            {!materialsLoading && materials.length === 0 && plantId && (
                              <p className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                                No hay materiales activos en el catálogo de esta planta.
                              </p>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-stone-700">Unidad de Medida</Label>
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
                            <Label className="text-sm font-medium text-stone-700">Peso volumétrico (kg/m³)</Label>
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
                              <p className="mt-1 text-xs text-stone-500">Si se define aquí, las entradas usarán este valor por defecto para convertir m³→kg. Litros no requieren conversión.</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <Label className="text-sm font-medium text-stone-700">
                            Cantidad Ordenada ({itemForm.uom || 'kg'})
                          </Label>
                          <div className="mt-1.5">
                            <Input
                              inputMode="decimal"
                              value={qtyInput}
                              onChange={(e) => setQtyInput(e.target.value)}
                              placeholder="0"
                              className="text-base"
                            />
                            {!Number.isNaN(parseQtyFromInput()) && parseQtyFromInput() > 0 && (
                              <p className="mt-1 text-xs text-stone-500">
                                {parseQtyFromInput().toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}{' '}
                                {itemForm.uom || 'kg'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-stone-700">Precio Unitario (MXN)</Label>
                          <div className="mt-1.5">
                            <Input
                              inputMode="decimal"
                              value={unitPriceInput}
                              onChange={(e) => setUnitPriceInput(e.target.value)}
                              placeholder="0.00"
                              className="text-base"
                            />
                            {!Number.isNaN(parsePriceFromInput()) && parsePriceFromInput() >= 0 && unitPriceInput.trim() !== '' && (
                              <p className="mt-1 text-xs text-stone-500">{mxn.format(parsePriceFromInput())}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-stone-700">Fecha Límite de Entrega (Opcional)</Label>
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

                    <div className="md:col-span-3 flex items-center justify-end gap-2 text-sm">
                      <span className="text-stone-500">Total del ítem:</span>
                      <span className="font-semibold text-stone-900 tabular-nums text-base">{mxn.format(linePreviewTotal)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        setEditingItem(null)
                        resetItemForm()
                        if (items.length > 0) setShowAddForm(false)
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={isEditing ? handleUpdateItem : handleAddItem}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isEditing ? (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Actualizar material
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar al pedido
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-stone-200 bg-stone-50 flex-shrink-0">
          <div>
            {step === 'items' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep('header')}
                  className="mr-3"
                >
                  Anterior
                </Button>
                <span className="text-xs text-stone-500">
                  Subtotal: <span className="font-semibold text-stone-800 tabular-nums">{mxn.format(subtotal)}</span>
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={tryClose}>
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continuar a Ítems
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || items.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? 'Creando...' : `Crear PO (${items.length} ${items.length === 1 ? 'ítem' : 'ítems'})`}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Discard-changes confirmation */}
      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Descartar la orden en curso?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            Tiene información sin guardar ({items.length > 0 ? `${items.length} ítem${items.length !== 1 ? 's' : ''}` : 'encabezado capturado'}). Si cierra ahora se perderá.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDiscardConfirmOpen(false)}>
              Seguir editando
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setDiscardConfirmOpen(false); onClose() }}
            >
              Descartar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

