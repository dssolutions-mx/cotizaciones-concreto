'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { MaterialEntry } from '@/types/inventory'
import { DollarSign, Truck, Save, AlertTriangle, FileText } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface EntryPricingFormProps {
  entry: MaterialEntry
  onSuccess?: (warnings?: string[]) => void
  onCancel?: () => void
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

/** Row from GET /api/po/items/search (fleet / service lines) */
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

export default function EntryPricingForm({ entry, onSuccess, onCancel }: EntryPricingFormProps) {
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

  const selectedFleetSearchItem = useMemo(
    () => fleetPoSearchItems.find((it) => it.id === selectedFleetSearchItemId) || null,
    [fleetPoSearchItems, selectedFleetSearchItemId]
  )

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
    if (materialPoItem?.uom === 'm3' || materialPoItem?.uom === 'l') {
      return Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    }
    return Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
  }, [entry, materialPoItem])

  const agreedMaterialUnit = materialPoItem?.unit_price != null ? Number(materialPoItem.unit_price) : null
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

  // Pre-fill material unit price from PO line when empty
  useEffect(() => {
    if (!materialPoItem || materialPoItem.is_service || agreedMaterialUnit == null) return
    if (entry.unit_price != null && entry.unit_price !== undefined) return
    setFormData((prev) => {
      if (prev.unit_price !== '') return prev
      return { ...prev, unit_price: String(agreedMaterialUnit) }
    })
  }, [materialPoItem, agreedMaterialUnit, entry.unit_price])

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
    if (hasFleetPoLink || !entry.supplier_id || !entry.plant_id) {
      setFleetPoSearchItems([])
      return
    }
    let cancelled = false
    setFleetPoSearchLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('plant_id', entry.plant_id)
        params.set('material_supplier_id', entry.supplier_id)
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
  }, [hasFleetPoLink, entry.supplier_id, entry.plant_id, formData.fleet_supplier_id])

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

  const materialUom = materialPoItem?.uom || 'kg'

  return (
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
      {!hasFleetPoLink && entry.supplier_id && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-900">
            <Truck className="h-4 w-4" />
            Vincular OC de flota / transporte (opcional)
          </div>
          <p className="text-xs text-sky-800">
            Busque una línea de servicio abierta para este proveedor de material. Si elige una OC, se rellenan el
            transportista y el costo según la OC.
          </p>
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

      {!hasFleetPoLink && !entry.supplier_id && (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          Esta entrada no tiene proveedor de material registrado; no se puede buscar una OC de flota vinculada. Use costo
          de flota manual o corrija la entrada en Control de producción.
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
  )
}
