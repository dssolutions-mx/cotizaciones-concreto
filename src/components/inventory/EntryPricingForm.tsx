'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { MaterialEntry } from '@/types/inventory'
import { DollarSign, Truck, Save, AlertTriangle, FileText, Plus } from 'lucide-react'
import CreatePOModal, {
  type PrefillFromMaterialEntry,
  type PrefillFleetFromMaterialEntry,
} from '@/components/po/CreatePOModal'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import EntryEvidencePanel from '@/components/inventory/EntryEvidencePanel'
import SupplierSelect from '@/components/inventory/SupplierSelect'

interface EntryPricingFormProps {
  entry: MaterialEntry
  onSuccess?: (warnings?: string[]) => void
  onCancel?: () => void
  /** Tras crear una OC desde esta pantalla (p. ej. recargar listas en el padre) */
  onAfterCreatePO?: () => void
}

function buildPrefillFromMaterialEntry(
  entry: MaterialEntry,
  supplierIdOverride?: string | null
): PrefillFromMaterialEntry | null {
  const supplierId = supplierIdOverride ?? entry.supplier_id
  if (!entry.plant_id || !supplierId || !entry.material_id) return null
  const rawUom = entry.received_uom
  const quantityUom: 'kg' | 'l' | 'm3' = rawUom === 'l' || rawUom === 'm3' ? rawUom : 'kg'
  let suggestedQty = 1
  if (quantityUom === 'l' || quantityUom === 'm3') {
    const n = Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    suggestedQty = Number.isFinite(n) && n > 0 ? n : 1
  } else {
    const n = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
    suggestedQty = Number.isFinite(n) && n > 0 ? n : 1
  }
  return {
    plantId: entry.plant_id,
    supplierId,
    materialId: entry.material_id,
    suggestedQty,
    quantityUom,
    notesHint: `Creada desde revisión de precios · entrada ${entry.entry_number || entry.id.slice(0, 8)}`,
  }
}

function buildPrefillFleetFromMaterialEntry(
  entry: MaterialEntry,
  materialSupplierId: string | null | undefined
): PrefillFleetFromMaterialEntry | null {
  if (!entry.plant_id || !materialSupplierId) return null
  return {
    plantId: entry.plant_id,
    materialSupplierId,
    notesHint: `OC flota/flete desde revisión de precios · entrada ${entry.entry_number || entry.id.slice(0, 8)}`,
  }
}

interface Supplier {
  id: string
  name: string
}

type PoLineItem = {
  id: string
  uom: string | null
  unit_price: number | null
  qty_ordered: number | null
  qty_received?: number | null
  qty_received_native?: number | null
  is_service: boolean
}

/** Row from GET /api/po/items/search (fleet / service / material lines) */
type FleetPoSearchItem = {
  id: string
  uom: string | null
  unit_price: number | null
  qty_ordered: number | null
  qty_received?: number | null
  qty_received_native?: number | null
  qty_remaining?: number
  service_description?: string | null
  material_supplier?: { id: string; name?: string | null } | null
  material?: { id: string; material_name?: string | null } | null
  po?: {
    id: string
    po_number?: string | null
    supplier_id?: string | null
    supplier?: { id: string; name?: string | null } | null
  } | null
}

function uomLabel(u: string | null | undefined) {
  if (!u) return ''
  const map: Record<string, string> = {
    kg: 'kg',
    l: 'L',
    m3: 'm³',
    trips: 'viajes',
    tons: 'ton',
    hours: 'hrs',
    loads: 'cargas',
    units: 'unidades',
  }
  return map[u] || u
}

export default function EntryPricingForm({ entry, onSuccess, onCancel, onAfterCreatePO }: EntryPricingFormProps) {
  const [loading, setLoading] = useState(false)
  const [apiWarnings, setApiWarnings] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [materialPoItem, setMaterialPoItem] = useState<PoLineItem | null>(null)
  const [materialPoLoading, setMaterialPoLoading] = useState(false)
  const [fleetPoItem, setFleetPoItem] = useState<PoLineItem | null>(null)
  const [fleetPoHeaderSupplierId, setFleetPoHeaderSupplierId] = useState<string | null>(null)
  const [fleetPoLoading, setFleetPoLoading] = useState(false)

  /** Link fleet OC when entry was created without fleet_po_id (pricing review) */
  const [fleetPoSearchItems, setFleetPoSearchItems] = useState<FleetPoSearchItem[]>([])
  const [fleetPoSearchLoading, setFleetPoSearchLoading] = useState(false)
  const [selectedFleetSearchItemId, setSelectedFleetSearchItemId] = useState('')
  const [fleetQtyEnteredLink, setFleetQtyEnteredLink] = useState(0)
  const [fleetSearchHeaderSupplierId, setFleetSearchHeaderSupplierId] = useState<string | null>(null)

  /** Link material OC when entry was created without po_item_id (pricing review) */
  const [materialPoSearchItems, setMaterialPoSearchItems] = useState<FleetPoSearchItem[]>([])
  const [materialPoSearchLoading, setMaterialPoSearchLoading] = useState(false)
  const [selectedMaterialSearchItemId, setSelectedMaterialSearchItemId] = useState('')
  const [createPOOpen, setCreatePOOpen] = useState(false)
  const [poPrefill, setPoPrefill] = useState<PrefillFromMaterialEntry | null>(null)
  const [fleetPoPrefillFromEntry, setFleetPoPrefillFromEntry] = useState<PrefillFleetFromMaterialEntry | null>(null)
  const [materialPoSearchRefreshKey, setMaterialPoSearchRefreshKey] = useState(0)
  const [fleetPoSearchRefreshKey, setFleetPoSearchRefreshKey] = useState(0)

  /** Entradas sin proveedor en planta: el admin lo elige aquí para desbloquear búsqueda de OC */
  const [selectedSupplierId, setSelectedSupplierId] = useState('')

  const [formData, setFormData] = useState({
    unit_price: entry.unit_price?.toString() || '',
    total_cost: entry.total_cost?.toString() || '',
    fleet_supplier_id: entry.fleet_supplier_id || '',
    fleet_cost: entry.fleet_cost?.toString() || '',
    supplier_invoice: entry.supplier_invoice || '',
    ap_due_date_material: entry.ap_due_date_material || '',
    fleet_invoice: entry.fleet_invoice || '',
    ap_due_date_fleet: entry.ap_due_date_fleet || '',
  })

  const hasMaterialPoLink = Boolean(entry.po_id && entry.po_item_id)
  const hasFleetPoLink = Boolean(entry.fleet_po_id && entry.fleet_po_item_id)

  const effectiveSupplierId = useMemo(
    () => entry.supplier_id || selectedSupplierId || '',
    [entry.supplier_id, selectedSupplierId]
  )

  const selectedFleetSearchItem = useMemo(
    () => fleetPoSearchItems.find((it) => it.id === selectedFleetSearchItemId) || null,
    [fleetPoSearchItems, selectedFleetSearchItemId]
  )

  const selectedMaterialSearchItem = useMemo(
    () => materialPoSearchItems.find((it) => it.id === selectedMaterialSearchItemId) || null,
    [materialPoSearchItems, selectedMaterialSearchItemId]
  )

  /** OC línea material: guardada o selección en búsqueda (revisión de precios) */
  const resolvedMaterialLineForCalc: PoLineItem | null = hasMaterialPoLink
    ? materialPoItem
    : selectedMaterialSearchItem
      ? {
          id: selectedMaterialSearchItem.id,
          uom: selectedMaterialSearchItem.uom,
          unit_price: selectedMaterialSearchItem.unit_price,
          qty_ordered: selectedMaterialSearchItem.qty_ordered,
          qty_received: selectedMaterialSearchItem.qty_received,
          qty_received_native: selectedMaterialSearchItem.qty_received_native,
          is_service: false,
        }
      : null

  /** Resolved fleet line for agreed total / diff alerts (saved OC link or search selection) */
  const resolvedFleetLineForCalc: PoLineItem | null = hasFleetPoLink
    ? fleetPoItem
    : selectedFleetSearchItem
      ? {
          id: selectedFleetSearchItem.id,
          uom: selectedFleetSearchItem.uom,
          unit_price: selectedFleetSearchItem.unit_price,
          qty_ordered: selectedFleetSearchItem.qty_ordered,
          qty_received: selectedFleetSearchItem.qty_received,
          qty_received_native: selectedFleetSearchItem.qty_received_native,
          is_service: true,
        }
      : null

  const resolvedFleetQty =
    hasFleetPoLink ? Number(entry.fleet_qty_entered ?? 0) : Number(fleetQtyEnteredLink || 0)

  const qtyForMaterialCost = useMemo(() => {
    const uom = resolvedMaterialLineForCalc?.uom
    if (uom === 'm3' || uom === 'l') {
      return Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    }
    return Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
  }, [entry, resolvedMaterialLineForCalc])

  const agreedMaterialUnit =
    resolvedMaterialLineForCalc?.unit_price != null ? Number(resolvedMaterialLineForCalc.unit_price) : null
  const agreedFleetTotal =
    resolvedFleetLineForCalc?.unit_price != null && resolvedFleetQty > 0
      ? Number(resolvedFleetLineForCalc.unit_price) * resolvedFleetQty
      : null

  const priceDiffersFromPo =
    agreedMaterialUnit != null &&
    formData.unit_price !== '' &&
    Math.abs(parseFloat(formData.unit_price) - agreedMaterialUnit) > 1e-6

  const fleetCostDiffersFromPo =
    agreedFleetTotal != null &&
    formData.fleet_cost !== '' &&
    parseFloat(formData.fleet_cost) > 0 &&
    Math.abs(parseFloat(formData.fleet_cost) - agreedFleetTotal) > 1e-2

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    if (!entry.po_id || !entry.po_item_id) {
      setMaterialPoItem(null)
      return
    }
    let cancelled = false
    setMaterialPoLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/po/${entry.po_id}/items`)
        if (!res.ok) {
          setMaterialPoItem(null)
          return
        }
        const data = await res.json()
        const items: PoLineItem[] = data.items || []
        const line = items.find((i) => i.id === entry.po_item_id) || null
        if (!cancelled) setMaterialPoItem(line)
      } catch {
        if (!cancelled) setMaterialPoItem(null)
      } finally {
        if (!cancelled) setMaterialPoLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entry.po_id, entry.po_item_id])

  useEffect(() => {
    if (!entry.fleet_po_id || !entry.fleet_po_item_id) {
      setFleetPoItem(null)
      setFleetPoHeaderSupplierId(null)
      return
    }
    let cancelled = false
    setFleetPoLoading(true)
    ;(async () => {
      try {
        const [itemsRes, poRes] = await Promise.all([
          fetch(`/api/po/${entry.fleet_po_id}/items`),
          fetch(`/api/po/${entry.fleet_po_id}`),
        ])
        if (poRes.ok) {
          const poData = await poRes.json()
          const sid = poData.purchase_order?.supplier_id ?? null
          if (!cancelled) setFleetPoHeaderSupplierId(sid)
        } else if (!cancelled) setFleetPoHeaderSupplierId(null)

        if (!itemsRes.ok) {
          if (!cancelled) setFleetPoItem(null)
          return
        }
        const data = await itemsRes.json()
        const items: PoLineItem[] = data.items || []
        const line = items.find((i) => i.id === entry.fleet_po_item_id) || null
        if (!cancelled) setFleetPoItem(line)
      } catch {
        if (!cancelled) {
          setFleetPoItem(null)
          setFleetPoHeaderSupplierId(null)
        }
      } finally {
        if (!cancelled) setFleetPoLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entry.fleet_po_id, entry.fleet_po_item_id])

  // Pre-fill material unit price from PO line when empty (guardada o línea elegida en búsqueda)
  useEffect(() => {
    if (!resolvedMaterialLineForCalc || resolvedMaterialLineForCalc.is_service || agreedMaterialUnit == null) return
    if (entry.unit_price != null && entry.unit_price !== undefined) return
    setFormData((prev) => {
      if (prev.unit_price !== '') return prev
      return { ...prev, unit_price: String(agreedMaterialUnit) }
    })
  }, [resolvedMaterialLineForCalc, agreedMaterialUnit, entry.unit_price])

  // Pre-fill fleet cost from OC line × qty when empty (saved fleet OC or newly selected search line)
  useEffect(() => {
    if (!resolvedFleetLineForCalc || agreedFleetTotal == null) return
    if (entry.fleet_cost != null && entry.fleet_cost !== undefined) return
    setFormData((prev) => {
      if (prev.fleet_cost !== '') return prev
      return { ...prev, fleet_cost: agreedFleetTotal.toFixed(2) }
    })
  }, [resolvedFleetLineForCalc, agreedFleetTotal, entry.fleet_cost])

  // Ensure fleet supplier matches OC header when entry is linked to fleet PO
  useEffect(() => {
    if (!hasFleetPoLink || !fleetPoHeaderSupplierId) return
    setFormData((prev) => {
      if (prev.fleet_supplier_id) return prev
      return { ...prev, fleet_supplier_id: fleetPoHeaderSupplierId }
    })
  }, [hasFleetPoLink, fleetPoHeaderSupplierId])

  // When picking a fleet OC from search, sync header transport supplier
  useEffect(() => {
    if (hasFleetPoLink || !selectedFleetSearchItem) {
      setFleetSearchHeaderSupplierId(null)
      return
    }
    const sid =
      selectedFleetSearchItem.po?.supplier_id ||
      (selectedFleetSearchItem.po?.supplier as { id?: string } | undefined)?.id ||
      null
    setFleetSearchHeaderSupplierId(sid)
    if (sid) {
      setFormData((prev) => ({ ...prev, fleet_supplier_id: sid }))
    }
  }, [hasFleetPoLink, selectedFleetSearchItem])

  // Load open fleet PO lines for this material supplier + plant (optional transport filter)
  useEffect(() => {
    if (hasFleetPoLink || !effectiveSupplierId || !entry.plant_id) {
      setFleetPoSearchItems([])
      return
    }
    let cancelled = false
    setFleetPoSearchLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('plant_id', entry.plant_id)
        params.set('material_supplier_id', effectiveSupplierId)
        params.set('is_service', 'true')
        if (formData.fleet_supplier_id) {
          params.set('po_supplier_id', formData.fleet_supplier_id)
        }
        const res = await fetch(`/api/po/items/search?${params.toString()}`)
        if (!res.ok) {
          if (!cancelled) setFleetPoSearchItems([])
          return
        }
        const data = await res.json()
        if (!cancelled) setFleetPoSearchItems(data.items || [])
      } catch {
        if (!cancelled) setFleetPoSearchItems([])
      } finally {
        if (!cancelled) setFleetPoSearchLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasFleetPoLink, effectiveSupplierId, entry.plant_id, formData.fleet_supplier_id, fleetPoSearchRefreshKey])

  // Open material PO lines (mismo proveedor de encabezado + material + planta)
  useEffect(() => {
    if (hasMaterialPoLink || !effectiveSupplierId || !entry.plant_id || !entry.material_id) {
      setMaterialPoSearchItems([])
      return
    }
    let cancelled = false
    setMaterialPoSearchLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('plant_id', entry.plant_id)
        params.set('supplier_id', effectiveSupplierId)
        params.set('material_id', entry.material_id)
        params.set('is_service', 'false')
        params.set('active_po_header', 'true')
        const res = await fetch(`/api/po/items/search?${params.toString()}`)
        if (!res.ok) {
          if (!cancelled) setMaterialPoSearchItems([])
          return
        }
        const data = await res.json()
        if (!cancelled) setMaterialPoSearchItems(data.items || [])
      } catch {
        if (!cancelled) setMaterialPoSearchItems([])
      } finally {
        if (!cancelled) setMaterialPoSearchLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasMaterialPoLink, effectiveSupplierId, entry.plant_id, entry.material_id, materialPoSearchRefreshKey])

  // Clear invalid selection when list refreshes
  useEffect(() => {
    if (!selectedMaterialSearchItemId || materialPoSearchItems.length === 0) return
    if (!materialPoSearchItems.some((it) => it.id === selectedMaterialSearchItemId)) {
      setSelectedMaterialSearchItemId('')
    }
  }, [materialPoSearchItems, selectedMaterialSearchItemId])

  // Clear invalid selection when list refreshes
  useEffect(() => {
    if (!selectedFleetSearchItemId || fleetPoSearchItems.length === 0) return
    if (!fleetPoSearchItems.some((it) => it.id === selectedFleetSearchItemId)) {
      setSelectedFleetSearchItemId('')
      setFleetQtyEnteredLink(0)
    }
  }, [fleetPoSearchItems, selectedFleetSearchItemId])

  // Auto-calculate total_cost when unit_price changes
  useEffect(() => {
    if (formData.unit_price && qtyForMaterialCost) {
      const calculated = parseFloat(formData.unit_price) * qtyForMaterialCost
      if (!Number.isNaN(calculated)) {
        setFormData((prev) => ({
          ...prev,
          total_cost: calculated.toFixed(2),
        }))
      }
    }
  }, [formData.unit_price, qtyForMaterialCost])

  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  )

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value || '0') : value
    if (Number.isNaN(num)) return ''
    return currencyFormatter.format(num)
  }

  const fleetSupplierDisplayName = useMemo(() => {
    const id = fleetPoHeaderSupplierId || fleetSearchHeaderSupplierId || entry.fleet_supplier_id
    if (!id) return null
    return (
      suppliers.find((s) => s.id === id)?.name ||
      selectedFleetSearchItem?.po?.supplier?.name ||
      null
    )
  }, [
    fleetPoHeaderSupplierId,
    fleetSearchHeaderSupplierId,
    entry.fleet_supplier_id,
    suppliers,
    selectedFleetSearchItem,
  ])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch(`/api/suppliers?plant_id=${entry.plant_id}`)
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.unit_price) {
      toast.error('El precio unitario es requerido')
      return
    }

    if (formData.supplier_invoice && !formData.ap_due_date_material) {
      toast.error('Fecha de vencimiento (material) es requerida cuando hay remisión/factura del proveedor')
      return
    }

    const linkingFleetFromSearch =
      !hasFleetPoLink &&
      Boolean(selectedFleetSearchItemId && selectedFleetSearchItem && fleetQtyEnteredLink > 0)

    const linkingMaterialFromSearch =
      !hasMaterialPoLink && Boolean(selectedMaterialSearchItemId && selectedMaterialSearchItem)

    if (selectedFleetSearchItemId && (!selectedFleetSearchItem || fleetQtyEnteredLink <= 0)) {
      toast.error('Indique la cantidad de servicio (flota) mayor a cero para la OC seleccionada')
      return
    }

    const effectiveFleetSupplierId =
      formData.fleet_supplier_id ||
      fleetPoHeaderSupplierId ||
      fleetSearchHeaderSupplierId ||
      entry.fleet_supplier_id ||
      ''
    const hasFleet =
      !!effectiveFleetSupplierId && !!formData.fleet_cost && parseFloat(formData.fleet_cost) > 0
    if (hasFleet) {
      if (!formData.fleet_invoice) {
        toast.error('Factura de flota es requerida cuando se registra costo de flota')
        return
      }
      if (!formData.ap_due_date_fleet) {
        toast.error('Fecha de vencimiento (flota) es requerida cuando se registra costo de flota')
        return
      }
    }

    setLoading(true)
    try {
      const mapFleetUom = (u: string | null | undefined): 'trips' | 'tons' | 'hours' | 'loads' | 'units' => {
        const x = String(u || '').toLowerCase()
        if (x === 'trips' || x === 'tons' || x === 'hours' || x === 'loads' || x === 'units') return x
        return 'trips'
      }

      const updatePayload: Record<string, unknown> = {
        id: entry.id,
        unit_price: parseFloat(formData.unit_price),
        total_cost: parseFloat(formData.total_cost),
        ...(!entry.supplier_id && effectiveSupplierId && { supplier_id: effectiveSupplierId }),
        ...(effectiveFleetSupplierId && { fleet_supplier_id: effectiveFleetSupplierId }),
        ...(formData.fleet_cost && { fleet_cost: parseFloat(formData.fleet_cost) }),
        ...(formData.supplier_invoice && { supplier_invoice: formData.supplier_invoice }),
        ...(formData.ap_due_date_material && { ap_due_date_material: formData.ap_due_date_material }),
        ...(formData.fleet_invoice && { fleet_invoice: formData.fleet_invoice }),
        ...(formData.ap_due_date_fleet && { ap_due_date_fleet: formData.ap_due_date_fleet }),
      }

      if (linkingFleetFromSearch && selectedFleetSearchItem?.po?.id) {
        updatePayload.fleet_po_id = selectedFleetSearchItem.po.id
        updatePayload.fleet_po_item_id = selectedFleetSearchItem.id
        updatePayload.fleet_qty_entered = fleetQtyEnteredLink
        updatePayload.fleet_uom = mapFleetUom(selectedFleetSearchItem.uom)
      }

      if (linkingMaterialFromSearch && selectedMaterialSearchItem) {
        updatePayload.po_item_id = selectedMaterialSearchItem.id
      }

      const response = await fetch('/api/inventory/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (response.ok) {
        const data = await response.json()
        const warnings = Array.isArray(data.warnings) ? data.warnings : []
        toast.success('Precios actualizados exitosamente')
        if (warnings.length > 0) {
          setApiWarnings(warnings)
          toast.warning(
            <div className="space-y-2">
              <p className="font-medium">Advertencias de conciliación 3 vías:</p>
              <ul className="list-disc list-inside text-sm">
                {warnings.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>,
            { duration: 10000 }
          )
        }
        onSuccess?.(warnings)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al actualizar precios')
      }
    } catch (error) {
      console.error('Error updating pricing:', error)
      toast.error('Error al actualizar precios')
    } finally {
      setLoading(false)
    }
  }

  const materialUom = resolvedMaterialLineForCalc?.uom || 'kg'

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg border">
      {apiWarnings.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Advertencias de conciliación 3 vías</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
              {apiWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Revisión de Precios</h3>
        <div className="text-sm text-gray-500">
          Entrada: <span className="font-mono">{entry.entry_number}</span>
        </div>
      </div>

      {/* Entry Summary */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Material:</span>
          <span className="font-medium">{entry.material?.material_name || entry.material_id}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Cantidad:</span>
          <span className="font-medium">
            {entry.quantity_received.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
            {entry.material?.unit_of_measure || 'kg'}
          </span>
        </div>
      </div>

      {!entry.supplier_id && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 space-y-3">
          <Alert className="border-amber-400 bg-white/80 text-amber-950 [&>svg]:text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Proveedor de material</AlertTitle>
            <AlertDescription className="text-sm">
              Esta entrada no tiene proveedor asignado. Elija el proveedor de la planta para poder buscar y vincular órdenes de compra de material y
              flota. El valor se guardará al confirmar precios.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label>Proveedor *</Label>
            <SupplierSelect
              value={selectedSupplierId}
              onChange={setSelectedSupplierId}
              plantId={entry.plant_id || undefined}
              required
            />
            {!effectiveSupplierId && (
              <p className="text-xs text-amber-900">
                Sin proveedor no se pueden listar OC de material ni de flota para esta entrada.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-stone-700">Revise la evidencia antes de validar precios</p>
        <EntryEvidencePanel
          entryId={entry.id}
          pricingStatus={entry.pricing_status}
          warnWhenPendingAndEmpty
        />
      </div>

      {!hasMaterialPoLink && effectiveSupplierId && (
        <Alert className="border-amber-200 bg-amber-50/90 text-amber-950 [&>svg]:text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sin orden de compra (material) vinculada</AlertTitle>
          <AlertDescription className="text-sm">
            Para conciliar inventario y recepciones contra la OC, seleccione una línea abierta del proveedor. Si la entrada quedó sin OC al
            capturarla, vincúlela aquí (revisión de precios).
          </AlertDescription>
        </Alert>
      )}

      {!hasMaterialPoLink && effectiveSupplierId && (
        <div className="rounded-lg border border-stone-300 bg-stone-50/80 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
            <FileText className="h-4 w-4" />
            Vincular OC de material
          </div>
          <p className="text-xs text-stone-700">
            Busque una línea de material abierta (mismo proveedor de OC, planta y material). Al guardar, la entrada queda ligada a la OC para el
            avance de recepciones.
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => {
                const p = buildPrefillFromMaterialEntry(entry, effectiveSupplierId)
                if (!p) {
                  toast.error('Faltan planta, proveedor o material en la entrada para crear la OC')
                  return
                }
                setFleetPoPrefillFromEntry(null)
                setPoPrefill(p)
                setCreatePOOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear nueva OC de material
            </Button>
            <span className="text-xs text-stone-600">
              Abre el asistente de compras con planta, proveedor y cantidad sugerida; al terminar, elija la línea nueva arriba.
            </span>
          </div>
          {materialPoSearchLoading ? (
            <p className="text-xs text-stone-600">Cargando líneas de OC…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="material_oc_search">OC de material (línea)</Label>
                <select
                  id="material_oc_search"
                  className="border border-stone-300 rounded-md bg-white px-3 py-2 text-sm w-full"
                  value={selectedMaterialSearchItemId}
                  onChange={(e) => setSelectedMaterialSearchItemId(e.target.value)}
                >
                  <option value="">Sin vincular aún (solo precios)</option>
                  {materialPoSearchItems.length === 0 ? (
                    <option disabled>No hay líneas abiertas para este proveedor y material</option>
                  ) : (
                    materialPoSearchItems.map((it) => {
                      const poNum = it.po?.po_number || String(it.po?.id || '').slice(0, 8)
                      const rem = Number(it.qty_remaining ?? 0) || 0
                      return (
                        <option key={it.id} value={it.id}>
                          {`OC ${poNum} · Rest. ${rem.toLocaleString('es-MX')} ${uomLabel(it.uom)} · ${formatCurrency(it.unit_price ?? 0)}/${uomLabel(it.uom)}`}
                        </option>
                      )
                    })
                  )}
                </select>
                {materialPoSearchItems.length === 0 && !materialPoSearchLoading && (
                  <p className="text-xs text-amber-800">
                    No hay OC con saldo para este proveedor, material y planta. Cree o ajuste la OC en compras, o verifique que el proveedor de la
                    entrada coincida con el de la OC.
                  </p>
                )}
              </div>
              {selectedMaterialSearchItem && (
                <>
                  <div className="text-sm text-stone-800">
                    Precio acordado en OC:{' '}
                    <span className="font-semibold">
                      {formatCurrency(selectedMaterialSearchItem.unit_price ?? 0)} / {uomLabel(selectedMaterialSearchItem.uom)}
                    </span>
                  </div>
                  {priceDiffersFromPo && agreedMaterialUnit != null && (
                    <Alert className="border-amber-200 bg-amber-50/90 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-700" />
                      <AlertDescription className="text-xs text-amber-900">
                        El precio ingresado ({formatCurrency(formData.unit_price)}) no coincide con el acordado en OC (
                        {formatCurrency(agreedMaterialUnit)} / {uomLabel(selectedMaterialSearchItem.uom)}). El sistema puede forzar el precio de
                        la OC al guardar salvo permisos ejecutivos.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Material PO context */}
      {hasMaterialPoLink && (
        <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
            <FileText className="h-4 w-4" />
            Orden de compra (material)
          </div>
          {materialPoLoading ? (
            <p className="text-xs text-stone-500">Cargando línea de OC…</p>
          ) : (
            <>
              <div className="text-sm">
                <span className="text-stone-600">OC: </span>
                <span className="font-mono font-medium">{entry.po?.po_number || entry.po_id?.slice(0, 8)}</span>
                {entry.supplier?.name && (
                  <span className="text-stone-600">
                    {' '}
                    · Proveedor: <span className="font-medium text-stone-800">{entry.supplier.name}</span>
                  </span>
                )}
              </div>
              {materialPoItem && !materialPoItem.is_service && (
                <>
                  <div className="text-sm text-stone-700">
                    Precio acordado en OC:{' '}
                    <span className="font-semibold">
                      {formatCurrency(materialPoItem.unit_price ?? 0)} / {uomLabel(materialPoItem.uom)}
                    </span>
                  </div>
                  <div className="text-xs text-stone-600">
                    Pedido: {Number(materialPoItem.qty_ordered ?? 0).toLocaleString('es-MX')} {uomLabel(materialPoItem.uom)} ·
                    Recibido en línea:{' '}
                    {Number(materialPoItem.qty_received ?? materialPoItem.qty_received_native ?? 0).toLocaleString('es-MX')}{' '}
                    {uomLabel(materialPoItem.uom)}
                  </div>
                </>
              )}
            </>
          )}
          {priceDiffersFromPo && agreedMaterialUnit != null && (
            <Alert className="border-amber-200 bg-amber-50/90 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-xs text-amber-900">
                El precio ingresado ({formatCurrency(formData.unit_price)}) no coincide con el acordado en OC (
                {formatCurrency(agreedMaterialUnit)} / {uomLabel(materialPoItem?.uom)}). El sistema puede forzar el
                precio de la OC al guardar salvo permisos ejecutivos.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Material Pricing */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Costo del Material
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="unit_price">
              Precio unitario ({uomLabel(materialUom)}) *
            </Label>
            <Input
              id="unit_price"
              type="number"
              step="0.00001"
              min="0"
              value={formData.unit_price}
              onChange={(e) => setFormData((prev) => ({ ...prev, unit_price: e.target.value }))}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.00"
              required
            />
            {formData.unit_price && (
              <div className="text-xs text-gray-500 mt-1">
                {formatCurrency(formData.unit_price)} por {uomLabel(materialUom)} · Base costo:{' '}
                {qtyForMaterialCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                {uomLabel(materialUom)}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="total_cost">Costo Total (auto-calculado)</Label>
            <Input
              id="total_cost"
              type="text"
              value={formatCurrency(formData.total_cost || '0')}
              readOnly
              className="bg-gray-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supplier_invoice">Remisión/Factura del Proveedor</Label>
            <Input
              id="supplier_invoice"
              type="text"
              value={formData.supplier_invoice}
              onChange={(e) => setFormData((prev) => ({ ...prev, supplier_invoice: e.target.value }))}
              placeholder="Ej. FAC-12345"
            />
          </div>
          <div>
            <Label htmlFor="ap_due_date_material">Fecha de Vencimiento (Material)</Label>
            <Input
              id="ap_due_date_material"
              type="date"
              value={formData.ap_due_date_material}
              onChange={(e) => setFormData((prev) => ({ ...prev, ap_due_date_material: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Vincular OC de flota en revisión (entrada sin fleet_po al crear) */}
      {!hasFleetPoLink && effectiveSupplierId && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-900">
            <Truck className="h-4 w-4" />
            Vincular OC de flota / transporte (opcional)
          </div>
          <p className="text-xs text-sky-800">
            Busque una línea de servicio abierta para este proveedor de material. Si elige una OC, se rellenan el
            transportista y el costo según la OC.
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => {
                const p = buildPrefillFleetFromMaterialEntry(entry, effectiveSupplierId)
                if (!p) {
                  toast.error('Faltan planta o proveedor de material para crear la OC de flota')
                  return
                }
                setPoPrefill(null)
                setFleetPoPrefillFromEntry(p)
                setCreatePOOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear nueva OC de flota / transporte
            </Button>
            <span className="text-xs text-sky-900/90">
              Asistente de compras: encabezado = transportista; la línea de servicio lleva el proveedor de material para
              conciliar contra esta entrada. Luego elija la línea nueva arriba.
            </span>
          </div>
          {fleetPoSearchLoading ? (
            <p className="text-xs text-sky-700">Cargando líneas de OC de flota…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="fleet_oc_search">OC de flota / transporte (línea de servicio)</Label>
                <select
                  id="fleet_oc_search"
                  className="border border-stone-300 rounded-md bg-white px-3 py-2 text-sm w-full"
                  value={selectedFleetSearchItemId}
                  onChange={(e) => {
                    const v = e.target.value
                    setSelectedFleetSearchItemId(v)
                    if (!v) setFleetQtyEnteredLink(0)
                    else if (fleetQtyEnteredLink <= 0) setFleetQtyEnteredLink(1)
                  }}
                >
                  <option value="">Sin OC de flota (solo costo manual abajo)</option>
                  {fleetPoSearchItems.length === 0 ? (
                    <option disabled>No hay líneas de servicio abiertas para este proveedor de material</option>
                  ) : (
                    fleetPoSearchItems.map((it) => {
                      const materialSupplierName = it.material_supplier?.name || 'Proveedor material'
                      const poNum = it.po?.po_number || String(it.po?.id || '').slice(0, 8)
                      const carrier = (it.po?.supplier as { name?: string } | undefined)?.name || 'Transportista'
                      return (
                        <option key={it.id} value={it.id}>
                          {`OC ${poNum} · ${carrier} · ${it.service_description || 'Servicio'} · p. ${materialSupplierName} · Rest. ${(Number(it.qty_remaining) || 0).toLocaleString('es-MX')} ${it.uom || ''}`}
                        </option>
                      )
                    })
                  )}
                </select>
                {fleetPoSearchItems.length === 0 && !fleetPoSearchLoading && (
                  <p className="text-xs text-amber-800">
                    No hay OC de flota con saldo para este proveedor de material
                    {formData.fleet_supplier_id ? ' y el transportista del filtro' : ''}. Ajuste el filtro de transportista
                    o cree una OC de servicio en compras.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fleet_supplier_filter">Proveedor de flota (filtro opcional)</Label>
                  <Select
                    value={formData.fleet_supplier_id}
                    disabled={!!selectedFleetSearchItemId}
                    onValueChange={(value) => {
                      setSelectedFleetSearchItemId('')
                      setFleetQtyEnteredLink(0)
                      setFormData((prev) => ({ ...prev, fleet_supplier_id: value === 'none' ? '' : value }))
                    }}
                  >
                    <SelectTrigger id="fleet_supplier_filter">
                      <SelectValue placeholder="Todos los transportistas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todos</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-stone-500 mt-1">
                    Al elegir una OC arriba, el transportista se fija según la OC.
                  </p>
                </div>
                {selectedFleetSearchItemId && (
                  <div>
                    <Label htmlFor="fleet_qty_link">Cantidad de servicio (flota)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="fleet_qty_link"
                        type="number"
                        step="0.01"
                        min="0"
                        className="max-w-[200px]"
                        value={fleetQtyEnteredLink || ''}
                        onChange={(e) => setFleetQtyEnteredLink(parseFloat(e.target.value) || 0)}
                        onWheel={(ev) => ev.currentTarget.blur()}
                      />
                      <span className="text-sm text-stone-600">
                        {selectedFleetSearchItem?.uom || ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {selectedFleetSearchItem && (
                <>
                  <div className="text-sm text-sky-900">
                    Precio acordado en OC:{' '}
                    <span className="font-semibold">
                      {formatCurrency(selectedFleetSearchItem.unit_price ?? 0)} / {uomLabel(selectedFleetSearchItem.uom)}
                    </span>
                  </div>
                  {fleetCostDiffersFromPo && agreedFleetTotal != null && (
                    <Alert className="border-amber-200 bg-amber-50/90 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-700" />
                      <AlertDescription className="text-xs text-amber-900">
                        El costo de flota ingresado ({formatCurrency(formData.fleet_cost)}) difiere del total derivado de la
                        OC ({formatCurrency(agreedFleetTotal)}).
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Fleet PO context */}
      {hasFleetPoLink && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-900">
            <Truck className="h-4 w-4" />
            Orden de compra (flota / flete)
          </div>
          {fleetPoLoading ? (
            <p className="text-xs text-sky-700">Cargando línea de OC flota…</p>
          ) : (
            <>
              <div className="text-sm">
                <span className="text-sky-800">OC flota: </span>
                <span className="font-mono font-medium">{entry.fleet_po?.po_number || entry.fleet_po_id?.slice(0, 8)}</span>
              </div>
              {fleetSupplierDisplayName && (
                <div className="text-sm text-sky-900">
                  Proveedor (OC): <span className="font-medium">{fleetSupplierDisplayName}</span>
                </div>
              )}
              {fleetPoItem && (
                <>
                  <div className="text-sm text-sky-900">
                    Precio acordado en OC:{' '}
                    <span className="font-semibold">
                      {formatCurrency(fleetPoItem.unit_price ?? 0)} / {uomLabel(fleetPoItem.uom)}
                    </span>
                  </div>
                  <div className="text-xs text-sky-800">
                    Cantidad en entrada: {Number(entry.fleet_qty_entered ?? 0).toLocaleString('es-MX')}{' '}
                    {entry.fleet_uom ? uomLabel(entry.fleet_uom) : uomLabel(fleetPoItem.uom)} · Pedido línea:{' '}
                    {Number(fleetPoItem.qty_ordered ?? 0).toLocaleString('es-MX')} · Recibido en línea:{' '}
                    {Number(fleetPoItem.qty_received ?? fleetPoItem.qty_received_native ?? 0).toLocaleString('es-MX')}
                  </div>
                  {agreedFleetTotal != null && (
                    <div className="text-sm text-sky-900">
                      Total esperado (precio OC × cantidad):{' '}
                      <span className="font-semibold">{formatCurrency(agreedFleetTotal)}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {fleetCostDiffersFromPo && agreedFleetTotal != null && (
            <Alert className="border-amber-200 bg-amber-50/90 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-xs text-amber-900">
                El costo de flota ingresado ({formatCurrency(formData.fleet_cost)}) difiere del total derivado de la OC (
                {formatCurrency(agreedFleetTotal)}).
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Fleet Pricing */}
      <div className="space-y-4 pt-4 border-t">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Truck className="h-4 w-4" />
          {hasFleetPoLink || selectedFleetSearchItemId
            ? 'Costo de Flota (vinculado a OC)'
            : 'Costo de Flota (Opcional)'}
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fleet_supplier">Proveedor de Flota</Label>
            {hasFleetPoLink || selectedFleetSearchItemId ? (
              <div
                id="fleet_supplier"
                className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground"
              >
                {fleetSupplierDisplayName ||
                  (entry.fleet_supplier_id ? `ID: ${entry.fleet_supplier_id.slice(0, 8)}…` : '—')}
              </div>
            ) : (
              <Select
                value={formData.fleet_supplier_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, fleet_supplier_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger id="fleet_supplier">
                  <SelectValue placeholder="Seleccione proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proveedor</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="fleet_cost">Costo de Flota</Label>
            <Input
              id="fleet_cost"
              type="number"
              step="0.01"
              min="0"
              value={formData.fleet_cost}
              onChange={(e) => setFormData((prev) => ({ ...prev, fleet_cost: e.target.value }))}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.00"
            />
            {formData.fleet_cost && (
              <div className="text-xs text-gray-500 mt-1">{formatCurrency(formData.fleet_cost)}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fleet_invoice">Factura de Flota</Label>
            <Input
              id="fleet_invoice"
              type="text"
              value={formData.fleet_invoice}
              onChange={(e) => setFormData((prev) => ({ ...prev, fleet_invoice: e.target.value }))}
              placeholder="Ej. FL-9988"
            />
          </div>
          <div>
            <Label htmlFor="ap_due_date_fleet">Fecha de Vencimiento (Flota)</Label>
            <Input
              id="ap_due_date_fleet"
              type="date"
              value={formData.ap_due_date_fleet}
              onChange={(e) => setFormData((prev) => ({ ...prev, ap_due_date_fleet: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {formData.total_cost && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-900">Costo Total de la Entrada:</span>
            <span className="text-lg font-bold text-blue-900">
              {formatCurrency(parseFloat(formData.total_cost) + parseFloat(formData.fleet_cost || '0'))}
            </span>
          </div>
          {formData.fleet_cost && parseFloat(formData.fleet_cost) > 0 && (
            <div className="text-xs text-blue-700 mt-1">
              Material: {formatCurrency(parseFloat(formData.total_cost))} + Flota:{' '}
              {formatCurrency(parseFloat(formData.fleet_cost))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Guardando...' : 'Guardar Precios'}
        </Button>
      </div>
    </form>
    <CreatePOModal
      open={createPOOpen}
      onClose={() => {
        setCreatePOOpen(false)
        setPoPrefill(null)
        setFleetPoPrefillFromEntry(null)
      }}
      defaultPlantId={entry.plant_id}
      defaultMaterialId={entry.material_id}
      prefillFromMaterialEntry={fleetPoPrefillFromEntry ? null : poPrefill}
      prefillFleetFromMaterialEntry={fleetPoPrefillFromEntry}
      onSuccess={() => {
        const wasFleet = Boolean(fleetPoPrefillFromEntry)
        setCreatePOOpen(false)
        setPoPrefill(null)
        setFleetPoPrefillFromEntry(null)
        if (wasFleet) {
          setFleetPoSearchRefreshKey((k) => k + 1)
          toast.success('OC de flota creada. Elija la nueva línea en la lista para vincularla a esta entrada.')
        } else {
          setMaterialPoSearchRefreshKey((k) => k + 1)
          toast.success('OC creada. Elija la nueva línea en la lista para vincularla a esta entrada.')
        }
        onAfterCreatePO?.()
      }}
    />
    </>
  )
}
