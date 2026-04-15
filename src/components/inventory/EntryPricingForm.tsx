'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { MaterialEntry } from '@/types/inventory'
import { DollarSign, Truck, Save, AlertTriangle, FileText, Plus, ChevronDown, Paperclip, Factory, User, Clock, ExternalLink, CheckCircle2, CalendarClock } from 'lucide-react'
import CreatePOModal, {
  type PrefillFromMaterialEntry,
  type PrefillFleetFromMaterialEntry,
} from '@/components/po/CreatePOModal'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import EntryEvidencePanel from '@/components/inventory/EntryEvidencePanel'
import SupplierSelect from '@/components/inventory/SupplierSelect'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'
import {
  formatReceivedQuantity,
  getReceivedQuantityDisplay,
  formatReceptionAssignedDay,
  formatEntrySavedShortFor,
} from '@/lib/inventory/entryReceivedDisplay'
import SupplierPaymentTermsQuickSheet from '@/components/inventory/SupplierPaymentTermsQuickSheet'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { canCompleteEntryPricingReview } from '@/lib/auth/inventoryRoles'
import {
  PAYMENT_TERMS_LABELS,
  addCalendarDaysToIsoDate,
  formatPaymentTermsLabel,
} from '@/lib/procurement/paymentTermsLabels'
import { KG_PER_METRIC_TON } from '@/lib/inventory/massUnits'

interface EntryPricingFormProps {
  entry: MaterialEntry
  onSuccess?: (warnings?: string[]) => void
  onCancel?: () => void
  onAfterCreatePO?: () => void
  /** Render in master-detail pane (compact header, sticky footer) */
  embedded?: boolean
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
  if (quantityUom === 'l') {
    const n = Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    suggestedQty = Number.isFinite(n) && n > 0 ? n : 1
  } else if (quantityUom === 'm3') {
    const m3Direct = Number(entry.received_qty_entered ?? 0)
    if (entry.received_uom === 'm3' && Number.isFinite(m3Direct) && m3Direct > 0) {
      suggestedQty = m3Direct
    } else {
      const kg = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
      const vol = Number(entry.volumetric_weight_kg_per_m3 ?? 0)
      suggestedQty = vol > 0 && kg > 0 ? kg / vol : 1
    }
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
    volumetricWeightKgPerM3:
      quantityUom === 'm3'
        ? Number(entry.volumetric_weight_kg_per_m3) > 0
          ? Number(entry.volumetric_weight_kg_per_m3)
          : (() => {
              const bulk = Number(entry.material?.bulk_density_kg_per_m3) || Number(entry.material?.density) || 0
              const u = (entry.material?.unit_of_measure || '').toLowerCase().replace(/³/g, '3')
              return bulk > 0 && u.includes('kg/m') ? bulk : undefined
            })()
        : undefined,
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
  default_payment_terms_days?: number | null
}

type PoLineItem = {
  id: string
  uom: string | null
  unit_price: number | null
  qty_ordered: number | null
  qty_received?: number | null
  qty_received_native?: number | null
  volumetric_weight_kg_per_m3?: number | null
  is_service: boolean
}

type FleetPoSearchItem = {
  id: string
  po_id: string
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

const PO_STATUS_LABELS: Record<string, string> = {
  open: 'Abierta', partial: 'Parcial', fulfilled: 'Completada', closed: 'Completada', cancelled: 'Cancelada',
}
const PO_STATUS_COLORS: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700 border-sky-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  fulfilled: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-stone-100 text-stone-500 border-stone-200',
}
function fmtPoDate(d: string | null | undefined) {
  if (!d) return null
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function uomLabel(u: string | null | undefined) {
  if (!u) return ''
  const map: Record<string, string> = {
    kg: 'kg', l: 'L', m3: 'm³', trips: 'viajes', tons: 'ton', hours: 'hrs', loads: 'cargas', units: 'unidades',
  }
  return map[u] || u
}

export default function EntryPricingForm({ entry, onSuccess, onCancel, onAfterCreatePO, embedded = false }: EntryPricingFormProps) {
  const { profile } = useAuthSelectors()
  const canEditSupplierPaymentTerms = canCompleteEntryPricingReview(profile?.role)
  const [supplierTermsSheetOpen, setSupplierTermsSheetOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiWarnings, setApiWarnings] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [materialPoItem, setMaterialPoItem] = useState<PoLineItem | null>(null)
  const [materialPoHeader, setMaterialPoHeader] = useState<any>(null)
  const [materialPoLoading, setMaterialPoLoading] = useState(false)
  const [fleetPoItem, setFleetPoItem] = useState<PoLineItem | null>(null)
  const [fleetPoHeader, setFleetPoHeader] = useState<any>(null)
  const [fleetPoHeaderSupplierId, setFleetPoHeaderSupplierId] = useState<string | null>(null)
  const [fleetPoLoading, setFleetPoLoading] = useState(false)

  const [fleetPoSearchItems, setFleetPoSearchItems] = useState<FleetPoSearchItem[]>([])
  const [fleetPoSearchLoading, setFleetPoSearchLoading] = useState(false)
  const [selectedFleetSearchItemId, setSelectedFleetSearchItemId] = useState('')
  const [fleetQtyEnteredLink, setFleetQtyEnteredLink] = useState(0)
  const [fleetSearchHeaderSupplierId, setFleetSearchHeaderSupplierId] = useState<string | null>(null)

  const [materialPoSearchItems, setMaterialPoSearchItems] = useState<FleetPoSearchItem[]>([])
  const [materialPoSearchLoading, setMaterialPoSearchLoading] = useState(false)
  const [selectedMaterialSearchItemId, setSelectedMaterialSearchItemId] = useState('')
  const [createPOOpen, setCreatePOOpen] = useState(false)
  const [poPrefill, setPoPrefill] = useState<PrefillFromMaterialEntry | null>(null)
  const [fleetPoPrefillFromEntry, setFleetPoPrefillFromEntry] = useState<PrefillFleetFromMaterialEntry | null>(null)
  const [materialPoSearchRefreshKey, setMaterialPoSearchRefreshKey] = useState(0)
  const [fleetPoSearchRefreshKey, setFleetPoSearchRefreshKey] = useState(0)
  /** After creating a PO from the modal, auto-select its first line once search refreshes */
  const [pendingAutoSelectFleetPoId, setPendingAutoSelectFleetPoId] = useState<string | null>(null)
  const [pendingAutoSelectMaterialPoId, setPendingAutoSelectMaterialPoId] = useState<string | null>(null)
  /** Only for `/api/po/items/search?po_supplier_id=` — do not tie to formData.fleet_supplier_id or selecting a line refetches and clears the OC pick */
  const [fleetCarrierFilterForSearch, setFleetCarrierFilterForSearch] = useState('')

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

  const fetchSuppliers = useCallback(async () => {
    if (!entry.plant_id) return
    try {
      const response = await fetch(`/api/suppliers?plant_id=${entry.plant_id}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }, [entry.plant_id])

  const hasMaterialPoLink = Boolean(entry.po_id && entry.po_item_id)
  const hasFleetPoLink = Boolean(entry.fleet_po_id && entry.fleet_po_item_id)

  const effectiveSupplierId = useMemo(
    () => entry.supplier_id || selectedSupplierId || '',
    [entry.supplier_id, selectedSupplierId]
  )

  const { availablePlants } = usePlantContext()

  const plantDisplayName = useMemo(() => {
    const p = availablePlants.find((x) => x.id === entry.plant_id)
    if (p?.name) return p.name
    return entry.plant_id ? `…${entry.plant_id.slice(0, 8)}` : '—'
  }, [entry.plant_id, availablePlants])

  const creatorDisplayName = useMemo(() => {
    const u = entry.entered_by_user
    if (!u) return '—'
    const n = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
    return n || u.email || '—'
  }, [entry.entered_by_user])

  /** Día asignado en planta (`entry_date`). La hora del registro viene de `created_at` (al guardar). */
  const receptionDayDisplay = useMemo(() => formatReceptionAssignedDay(entry), [entry.entry_date])
  const entrySavedDisplay = useMemo(
    () => formatEntrySavedShortFor(entry),
    [entry.entry_date, entry.created_at]
  )

  /** Resumen en una línea (día recepción + registro); alias estable para tooltips / código que aún referencie el nombre. */
  const receptionDisplay = useMemo(() => {
    const day = formatReceptionAssignedDay(entry)
    const reg = formatEntrySavedShortFor(entry)
    if (day === '—' && reg === '—') return '—'
    if (day === '—') return `Reg. ${reg}`
    if (reg === '—') return day
    return `${day} · Reg. ${reg}`
  }, [entry.entry_date, entry.created_at])

  const receivedQtyDisplay = useMemo(() => getReceivedQuantityDisplay(entry), [entry])

  const selectedFleetSearchItem = useMemo(
    () => fleetPoSearchItems.find((it) => it.id === selectedFleetSearchItemId) || null,
    [fleetPoSearchItems, selectedFleetSearchItemId]
  )

  const selectedMaterialSearchItem = useMemo(
    () => materialPoSearchItems.find((it) => it.id === selectedMaterialSearchItemId) || null,
    [materialPoSearchItems, selectedMaterialSearchItemId]
  )

  const resolvedMaterialLineForCalc: PoLineItem | null = hasMaterialPoLink
    ? materialPoItem
    : selectedMaterialSearchItem
      ? {
          id: selectedMaterialSearchItem.id, uom: selectedMaterialSearchItem.uom,
          unit_price: selectedMaterialSearchItem.unit_price, qty_ordered: selectedMaterialSearchItem.qty_ordered,
          qty_received: selectedMaterialSearchItem.qty_received, qty_received_native: selectedMaterialSearchItem.qty_received_native,
          volumetric_weight_kg_per_m3: (selectedMaterialSearchItem as { volumetric_weight_kg_per_m3?: number | null }).volumetric_weight_kg_per_m3,
          is_service: false,
        }
      : null

  const resolvedFleetLineForCalc: PoLineItem | null = hasFleetPoLink
    ? fleetPoItem
    : selectedFleetSearchItem
      ? {
          id: selectedFleetSearchItem.id, uom: selectedFleetSearchItem.uom,
          unit_price: selectedFleetSearchItem.unit_price, qty_ordered: selectedFleetSearchItem.qty_ordered,
          qty_received: selectedFleetSearchItem.qty_received, qty_received_native: selectedFleetSearchItem.qty_received_native,
          is_service: true,
        }
      : null

  const resolvedFleetQty = useMemo(() => {
    const lineUom = resolvedFleetLineForCalc?.uom
    if (lineUom === 'tons') {
      const kg = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
      if (kg > 0) return kg / KG_PER_METRIC_TON
    }
    return hasFleetPoLink ? Number(entry.fleet_qty_entered ?? 0) : Number(fleetQtyEnteredLink || 0)
  }, [
    resolvedFleetLineForCalc?.uom,
    entry.received_qty_kg,
    entry.quantity_received,
    entry.fleet_qty_entered,
    fleetQtyEnteredLink,
    hasFleetPoLink,
  ])

  const qtyForMaterialCost = useMemo(() => {
    const uom = resolvedMaterialLineForCalc?.uom
    if (uom === 'l') {
      return Number(entry.received_qty_entered ?? entry.quantity_received ?? 0)
    }
    if (uom === 'm3') {
      const m3Stored = Number(entry.received_qty_entered ?? 0)
      if (entry.received_uom === 'm3' && Number.isFinite(m3Stored) && m3Stored > 0) {
        return m3Stored
      }
      const kg = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
      const vol =
        Number(resolvedMaterialLineForCalc?.volumetric_weight_kg_per_m3) ||
        Number(entry.volumetric_weight_kg_per_m3 ?? 0)
      if (vol > 0 && kg > 0) return kg / vol
      return Number.isFinite(m3Stored) && m3Stored > 0 ? m3Stored : 0
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

  /** Lista `/api/suppliers` es la fuente de verdad tras editar plazos; `entry.supplier` puede estar desactualizado. */
  const materialTermsDays = useMemo(() => {
    const sid = effectiveSupplierId
    if (!sid) return null
    const row = suppliers.find((s) => s.id === sid)
    if (row) {
      if (row.default_payment_terms_days !== undefined) {
        return row.default_payment_terms_days ?? null
      }
    }
    if (entry.supplier?.id === sid && entry.supplier.default_payment_terms_days != null) {
      return entry.supplier.default_payment_terms_days
    }
    return null
  }, [effectiveSupplierId, suppliers, entry.supplier])

  const fleetSupplierIdForTerms = useMemo(
    () =>
      formData.fleet_supplier_id ||
      fleetPoHeaderSupplierId ||
      fleetSearchHeaderSupplierId ||
      entry.fleet_supplier_id ||
      '',
    [formData.fleet_supplier_id, fleetPoHeaderSupplierId, fleetSearchHeaderSupplierId, entry.fleet_supplier_id]
  )

  const fleetTermsDays = useMemo(() => {
    const sid = fleetSupplierIdForTerms
    if (!sid) return null
    const row = suppliers.find((s) => s.id === sid)
    if (row && row.default_payment_terms_days !== undefined) {
      return row.default_payment_terms_days ?? null
    }
    return null
  }, [fleetSupplierIdForTerms, suppliers])

  const materialDueAutoHint = useMemo(() => {
    if (!entry.entry_date || materialTermsDays == null) return false
    if (!formData.ap_due_date_material) return false
    const expected = addCalendarDaysToIsoDate(entry.entry_date, materialTermsDays)
    return expected !== '' && formData.ap_due_date_material === expected
  }, [entry.entry_date, materialTermsDays, formData.ap_due_date_material])

  const fleetDueAutoHint = useMemo(() => {
    if (!entry.entry_date || fleetTermsDays == null) return false
    if (!formData.ap_due_date_fleet) return false
    const expected = addCalendarDaysToIsoDate(entry.entry_date, fleetTermsDays)
    return expected !== '' && formData.ap_due_date_fleet === expected
  }, [entry.entry_date, fleetTermsDays, formData.ap_due_date_fleet])

  const lastAppliedMaterialTermsRef = useRef<number | null>(null)
  const lastAppliedFleetTermsRef = useRef<number | null>(null)

  useEffect(() => {
    lastAppliedMaterialTermsRef.current = null
    lastAppliedFleetTermsRef.current = null
  }, [entry.id])

  useEffect(() => {
    if (!entry.entry_date || materialTermsDays == null) return
    const due = addCalendarDaysToIsoDate(entry.entry_date, materialTermsDays)
    if (!due) return
    const prevTermsSnapshot = lastAppliedMaterialTermsRef.current
    setFormData((prev) => {
      if (!prev.ap_due_date_material) {
        return { ...prev, ap_due_date_material: due }
      }
      if (prevTermsSnapshot != null) {
        const prevDue = addCalendarDaysToIsoDate(entry.entry_date, prevTermsSnapshot)
        if (prevDue && prev.ap_due_date_material === prevDue) {
          return { ...prev, ap_due_date_material: due }
        }
        return prev
      }
      if (prev.ap_due_date_material === due) {
        return prev
      }
      return prev
    })
    lastAppliedMaterialTermsRef.current = materialTermsDays
  }, [entry.entry_date, materialTermsDays])

  useEffect(() => {
    if (!entry.entry_date || fleetTermsDays == null) return
    const due = addCalendarDaysToIsoDate(entry.entry_date, fleetTermsDays)
    if (!due) return
    const prevTermsSnapshot = lastAppliedFleetTermsRef.current
    setFormData((prev) => {
      if (!prev.ap_due_date_fleet) {
        return { ...prev, ap_due_date_fleet: due }
      }
      if (prevTermsSnapshot != null) {
        const prevDue = addCalendarDaysToIsoDate(entry.entry_date, prevTermsSnapshot)
        if (prevDue && prev.ap_due_date_fleet === prevDue) {
          return { ...prev, ap_due_date_fleet: due }
        }
        return prev
      }
      if (prev.ap_due_date_fleet === due) {
        return prev
      }
      return prev
    })
    lastAppliedFleetTermsRef.current = fleetTermsDays
  }, [entry.entry_date, fleetTermsDays])

  const applySuggestedMaterialDue = useCallback(() => {
    if (!entry.entry_date || materialTermsDays == null) return
    const due = addCalendarDaysToIsoDate(entry.entry_date, materialTermsDays)
    if (!due) return
    setFormData((prev) => ({ ...prev, ap_due_date_material: due }))
    lastAppliedMaterialTermsRef.current = materialTermsDays
  }, [entry.entry_date, materialTermsDays])

  const applySuggestedFleetDue = useCallback(() => {
    if (!entry.entry_date || fleetTermsDays == null) return
    const due = addCalendarDaysToIsoDate(entry.entry_date, fleetTermsDays)
    if (!due) return
    setFormData((prev) => ({ ...prev, ap_due_date_fleet: due }))
    lastAppliedFleetTermsRef.current = fleetTermsDays
  }, [entry.entry_date, fleetTermsDays])

  useEffect(() => {
    void fetchSuppliers()
  }, [fetchSuppliers])

  // ── Load material PO header + line ──
  useEffect(() => {
    if (!entry.po_id || !entry.po_item_id) { setMaterialPoItem(null); setMaterialPoHeader(null); return }
    let cancelled = false
    setMaterialPoLoading(true)
    ;(async () => {
      try {
        const [itemsRes, headerRes] = await Promise.all([
          fetch(`/api/po/${entry.po_id}/items`),
          fetch(`/api/po/${entry.po_id}`),
        ])
        if (headerRes.ok) {
          const hd = await headerRes.json()
          if (!cancelled) setMaterialPoHeader(hd.purchase_order ?? null)
        } else if (!cancelled) setMaterialPoHeader(null)
        if (!itemsRes.ok) { if (!cancelled) setMaterialPoItem(null); return }
        const data = await itemsRes.json()
        const items: PoLineItem[] = data.items || []
        const line = (items.find((i) => i.id === entry.po_item_id) || null) as PoLineItem | null
        if (!cancelled) setMaterialPoItem(line)
      } catch { if (!cancelled) { setMaterialPoItem(null); setMaterialPoHeader(null) } }
      finally { if (!cancelled) setMaterialPoLoading(false) }
    })()
    return () => { cancelled = true }
  }, [entry.po_id, entry.po_item_id])

  // ── Load fleet PO line ──
  useEffect(() => {
    if (!entry.fleet_po_id || !entry.fleet_po_item_id) { setFleetPoItem(null); setFleetPoHeaderSupplierId(null); setFleetPoHeader(null); return }
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
          const hdr = poData.purchase_order ?? null
          if (!cancelled) { setFleetPoHeaderSupplierId(hdr?.supplier_id ?? null); setFleetPoHeader(hdr) }
        } else if (!cancelled) { setFleetPoHeaderSupplierId(null); setFleetPoHeader(null) }
        if (!itemsRes.ok) { if (!cancelled) setFleetPoItem(null); return }
        const data = await itemsRes.json()
        const items: PoLineItem[] = data.items || []
        if (!cancelled) setFleetPoItem(items.find((i) => i.id === entry.fleet_po_item_id) || null)
      } catch { if (!cancelled) { setFleetPoItem(null); setFleetPoHeaderSupplierId(null) } }
      finally { if (!cancelled) setFleetPoLoading(false) }
    })()
    return () => { cancelled = true }
  }, [entry.fleet_po_id, entry.fleet_po_item_id])

  // Pre-fill material unit price from PO line
  useEffect(() => {
    if (!resolvedMaterialLineForCalc || resolvedMaterialLineForCalc.is_service || agreedMaterialUnit == null) return
    if (entry.unit_price != null && entry.unit_price !== undefined) return
    setFormData((prev) => prev.unit_price !== '' ? prev : { ...prev, unit_price: String(agreedMaterialUnit) })
  }, [resolvedMaterialLineForCalc, agreedMaterialUnit, entry.unit_price])

  // Pre-fill fleet cost
  useEffect(() => {
    if (!resolvedFleetLineForCalc || agreedFleetTotal == null) return
    if (entry.fleet_cost != null && entry.fleet_cost !== undefined) return
    setFormData((prev) => prev.fleet_cost !== '' ? prev : { ...prev, fleet_cost: agreedFleetTotal.toFixed(2) })
  }, [resolvedFleetLineForCalc, agreedFleetTotal, entry.fleet_cost])

  useEffect(() => {
    if (!hasFleetPoLink || !fleetPoHeaderSupplierId) return
    setFormData((prev) => prev.fleet_supplier_id ? prev : { ...prev, fleet_supplier_id: fleetPoHeaderSupplierId })
  }, [hasFleetPoLink, fleetPoHeaderSupplierId])

  useEffect(() => {
    if (hasFleetPoLink || !selectedFleetSearchItem) { setFleetSearchHeaderSupplierId(null); return }
    const sid = selectedFleetSearchItem.po?.supplier_id || (selectedFleetSearchItem.po?.supplier as { id?: string } | undefined)?.id || null
    setFleetSearchHeaderSupplierId(sid)
    if (sid) setFormData((prev) => ({ ...prev, fleet_supplier_id: sid }))
  }, [hasFleetPoLink, selectedFleetSearchItem])

  // Load fleet PO search items
  useEffect(() => {
    if (hasFleetPoLink || !effectiveSupplierId || !entry.plant_id) { setFleetPoSearchItems([]); return }
    let cancelled = false
    setFleetPoSearchLoading(true)
    ;(async () => {
      try {
        const params = new URLSearchParams()
        params.set('plant_id', entry.plant_id)
        params.set('material_supplier_id', effectiveSupplierId)
        params.set('is_service', 'true')
        if (fleetCarrierFilterForSearch) params.set('po_supplier_id', fleetCarrierFilterForSearch)
        const res = await fetch(`/api/po/items/search?${params.toString()}`)
        if (!res.ok) { if (!cancelled) setFleetPoSearchItems([]); return }
        const data = await res.json()
        const fetched = data.items || []
        if (!cancelled) setFleetPoSearchItems(fetched)
      } catch (err) { console.error('[FleetSearch] error:', err); if (!cancelled) setFleetPoSearchItems([]) }
      finally { if (!cancelled) setFleetPoSearchLoading(false) }
    })()
    return () => { cancelled = true }
  }, [hasFleetPoLink, effectiveSupplierId, entry.plant_id, fleetCarrierFilterForSearch, fleetPoSearchRefreshKey])

  // Load material PO search items
  useEffect(() => {
    if (hasMaterialPoLink || !effectiveSupplierId || !entry.plant_id || !entry.material_id) { setMaterialPoSearchItems([]); return }
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
        if (!res.ok) { if (!cancelled) setMaterialPoSearchItems([]); return }
        const data = await res.json()
        if (!cancelled) setMaterialPoSearchItems(data.items || [])
      } catch { if (!cancelled) setMaterialPoSearchItems([]) }
      finally { if (!cancelled) setMaterialPoSearchLoading(false) }
    })()
    return () => { cancelled = true }
  }, [hasMaterialPoLink, effectiveSupplierId, entry.plant_id, entry.material_id, materialPoSearchRefreshKey])

  useEffect(() => {
    if (!selectedMaterialSearchItemId || materialPoSearchItems.length === 0) return
    if (!materialPoSearchItems.some((it) => it.id === selectedMaterialSearchItemId)) setSelectedMaterialSearchItemId('')
  }, [materialPoSearchItems, selectedMaterialSearchItemId])

  useEffect(() => {
    if (!selectedFleetSearchItemId || fleetPoSearchItems.length === 0) return
    if (!fleetPoSearchItems.some((it) => it.id === selectedFleetSearchItemId)) {
      setSelectedFleetSearchItemId(''); setFleetQtyEnteredLink(0)
    }
  }, [fleetPoSearchItems, selectedFleetSearchItemId])

  // After "Crear nueva OC de flota", select the new PO line once search results include it
  useEffect(() => {
    if (!pendingAutoSelectFleetPoId || fleetPoSearchItems.length === 0) return
    const match = fleetPoSearchItems.find((item) => item.po?.id === pendingAutoSelectFleetPoId || item.po_id === pendingAutoSelectFleetPoId)
    if (match) {
      setSelectedFleetSearchItemId(match.id)
      setFleetQtyEnteredLink((q) => (q <= 0 ? 1 : q))
      setPendingAutoSelectFleetPoId(null)
    }
  }, [fleetPoSearchItems, pendingAutoSelectFleetPoId])

  useEffect(() => {
    if (hasFleetPoLink || !selectedFleetSearchItem || selectedFleetSearchItem.uom !== 'tons') return
    const kg = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
    if (kg > 0) setFleetQtyEnteredLink(kg / KG_PER_METRIC_TON)
  }, [hasFleetPoLink, selectedFleetSearchItem, entry.received_qty_kg, entry.quantity_received])

  // After "Crear nueva OC" (material), select the new PO line once search results include it
  useEffect(() => {
    if (!pendingAutoSelectMaterialPoId || materialPoSearchItems.length === 0) return
    const match = materialPoSearchItems.find((item) => item.po?.id === pendingAutoSelectMaterialPoId)
    if (match) {
      setSelectedMaterialSearchItemId(match.id)
      setPendingAutoSelectMaterialPoId(null)
    }
  }, [materialPoSearchItems, pendingAutoSelectMaterialPoId])

  // Auto-calculate total_cost
  useEffect(() => {
    if (formData.unit_price && qtyForMaterialCost) {
      const calculated = parseFloat(formData.unit_price) * qtyForMaterialCost
      if (!Number.isNaN(calculated)) {
        setFormData((prev) => ({ ...prev, total_cost: calculated.toFixed(2) }))
      }
    }
  }, [formData.unit_price, qtyForMaterialCost])

  const currencyFormatter = React.useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
    return suppliers.find((s) => s.id === id)?.name || selectedFleetSearchItem?.po?.supplier?.name || null
  }, [fleetPoHeaderSupplierId, fleetSearchHeaderSupplierId, entry.fleet_supplier_id, suppliers, selectedFleetSearchItem])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.unit_price) { toast.error('El precio unitario es requerido'); return }
    if (formData.supplier_invoice && !formData.ap_due_date_material) {
      toast.error('Fecha de vencimiento (material) es requerida cuando hay remisión/factura'); return
    }

    const fleetTonsFromEntryKg =
      selectedFleetSearchItem?.uom === 'tons' &&
      Number(entry.received_qty_kg ?? entry.quantity_received ?? 0) > 0
    const linkingFleetFromSearch = !hasFleetPoLink && Boolean(
      selectedFleetSearchItemId && selectedFleetSearchItem && (fleetQtyEnteredLink > 0 || fleetTonsFromEntryKg)
    )
    const linkingMaterialFromSearch = !hasMaterialPoLink && Boolean(selectedMaterialSearchItemId && selectedMaterialSearchItem)

    if (selectedFleetSearchItemId && !selectedFleetSearchItem) {
      toast.error('Seleccione una línea de flota válida')
      return
    }
    if (
      selectedFleetSearchItemId &&
      selectedFleetSearchItem &&
      !fleetTonsFromEntryKg &&
      fleetQtyEnteredLink <= 0
    ) {
      toast.error('Indique la cantidad de servicio (flota) mayor a cero')
      return
    }

    const effectiveFleetSupplierId = formData.fleet_supplier_id || fleetPoHeaderSupplierId || fleetSearchHeaderSupplierId || entry.fleet_supplier_id || ''
    const hasFleet = !!effectiveFleetSupplierId && !!formData.fleet_cost && parseFloat(formData.fleet_cost) > 0
    if (hasFleet) {
      if (!formData.fleet_invoice) { toast.error('Factura de flota es requerida con costo de flota'); return }
      if (!formData.ap_due_date_fleet) { toast.error('Fecha de vencimiento (flota) es requerida con costo de flota'); return }
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

      if (linkingFleetFromSearch) {
        const fleetPoId = selectedFleetSearchItem?.po?.id || selectedFleetSearchItem?.po_id
        if (!fleetPoId) {
          toast.error('Error: la línea de flota seleccionada no tiene OC asociada')
          setLoading(false)
          return
        }
        updatePayload.fleet_po_id = fleetPoId
        updatePayload.fleet_po_item_id = selectedFleetSearchItem!.id
        const uomRaw = selectedFleetSearchItem!.uom
        updatePayload.fleet_qty_entered =
          uomRaw === 'tons'
            ? Number(entry.received_qty_kg ?? entry.quantity_received ?? 0) / KG_PER_METRIC_TON
            : fleetQtyEnteredLink
        updatePayload.fleet_uom = mapFleetUom(uomRaw)
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
        toast.success('Precios actualizados')
        if (warnings.length > 0) {
          setApiWarnings(warnings)
          toast.warning(<div className="space-y-1"><p className="font-medium">Advertencias:</p><ul className="list-disc list-inside text-sm">{warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul></div>, { duration: 10000 })
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
  const totalMaterial = parseFloat(formData.total_cost || '0')
  const totalFleet = parseFloat(formData.fleet_cost || '0')
  const grandTotal = totalMaterial + totalFleet

  return (
    <>
    <form onSubmit={handleSubmit} className={embedded ? 'flex flex-col h-full' : 'space-y-5 bg-white p-6 rounded-lg border'}>
      {/* ─── Header ─── */}
      {embedded ? (
        <div className="px-5 py-3 border-b border-stone-200 bg-stone-50/60 sticky top-0 z-10 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="font-mono text-sm font-medium text-stone-900">{entry.entry_number || entry.id.slice(0, 8)}</span>
              <span className="text-sm text-stone-600 ml-2 truncate block sm:inline">
                {entry.material?.material_name}
              </span>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-semibold tabular-nums text-stone-900 leading-tight">
                {receivedQtyDisplay.value.toLocaleString('es-MX', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: receivedQtyDisplay.unit === 'kg' ? 0 : 2,
                })}
                <span className="text-sm font-medium text-stone-600 ml-1">{receivedQtyDisplay.unit}</span>
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-x-3 gap-y-1 text-xs text-stone-500 min-w-0 flex-wrap"
            title={receptionDisplay}
          >
            <span className="inline-flex items-center gap-1 min-w-0 max-w-[min(100%,14rem)]">
              <Factory className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
              <span className="truncate" title={plantDisplayName}>
                Planta · {plantDisplayName}
              </span>
            </span>
            <span className="text-stone-300 hidden sm:inline" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1 min-w-0 max-w-[min(100%,14rem)]">
              <User className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
              <span className="truncate" title={creatorDisplayName}>
                Registró · {creatorDisplayName}
              </span>
            </span>
            <span className="text-stone-300 hidden sm:inline" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1 min-w-0 max-w-[min(100%,14rem)]">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
              <span className="truncate" title="Día al que se asignó la recepción (fecha de entrada)">
                Día recepción · {receptionDayDisplay}
              </span>
            </span>
            <span className="text-stone-300 hidden sm:inline" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1 min-w-0 max-w-[min(100%,14rem)]">
              <Clock className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
              <span className="truncate" title="Momento en que se guardó el registro (no es hora de recepción en planta)">
                Registro · {entrySavedDisplay}
              </span>
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Revisión de Precios</h3>
            <div className="text-sm text-gray-500">Entrada: <span className="font-mono">{entry.entry_number}</span></div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Material:</span>
              <span className="font-medium">{entry.material?.material_name || entry.material_id}</span>
            </div>
            <div className="flex justify-between text-sm gap-2">
              <span className="text-gray-600 shrink-0">Cantidad:</span>
              <span className="font-medium text-right">{formatReceivedQuantity(entry)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 gap-2 pt-0.5 border-t border-gray-200/80">
              <span>Planta · {plantDisplayName}</span>
              <span className="text-right truncate max-w-[60%]" title={creatorDisplayName}>
                Registró · {creatorDisplayName}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs text-gray-600 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                <span title="Día al que se asignó la recepción">Día recepción · {receptionDayDisplay}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 pl-0 sm:pl-5">
                <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                <span title="Momento en que se guardó el registro">Registro guardado · {entrySavedDisplay}</span>
              </span>
            </div>
          </div>
        </>
      )}

      {/* ─── Scrollable content ─── */}
      <div className={embedded ? 'flex-1 overflow-y-auto px-5 py-4 space-y-4' : 'space-y-5'}>
        {/* API warnings */}
        {apiWarnings.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-800 [&>svg]:text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Advertencias de conciliación</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-sm">
                {apiWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {(resolvedMaterialLineForCalc?.uom === 'm3' || entry.received_uom === 'm3') &&
          (() => {
            const kg = Number(entry.received_qty_kg ?? entry.quantity_received ?? 0)
            const volW =
              Number(entry.volumetric_weight_kg_per_m3) ||
              Number(resolvedMaterialLineForCalc?.volumetric_weight_kg_per_m3) ||
              null
            const m3 =
              entry.received_uom === 'm3' && Number(entry.received_qty_entered ?? 0) > 0
                ? Number(entry.received_qty_entered)
                : volW && kg > 0
                  ? kg / volW
                  : null
            if (!kg || !volW || m3 == null || !Number.isFinite(m3)) return null
            return (
              <Alert className="border-sky-200 bg-sky-50/80 text-sky-950 [&>svg]:text-sky-700">
                <FileText className="h-4 w-4" />
                <AlertTitle>Recepción m³ (OC comercial)</AlertTitle>
                <AlertDescription className="text-sm mt-1">
                  <span className="tabular-nums font-medium">{kg.toLocaleString('es-MX')} kg</span> en báscula ÷{' '}
                  <span className="tabular-nums font-medium">{volW.toLocaleString('es-MX')} kg/m³</span> (acordado) ≈{' '}
                  <span className="tabular-nums font-medium">
                    {m3.toLocaleString('es-MX', { maximumFractionDigits: 3 })} m³
                  </span>{' '}
                  para totalizar a precio / m³.
                </AlertDescription>
              </Alert>
            )
          })()}

        {/* ─── 1. Supplier (only if missing) ─── */}
        {!entry.supplier_id && (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Sin proveedor — seleccione uno para vincular OC
            </div>
            <SupplierSelect
              value={selectedSupplierId}
              onChange={setSelectedSupplierId}
              plantId={entry.plant_id || undefined}
              required
            />
          </div>
        )}

        {/* ─── 2. Material Pricing (always visible — core task) ─── */}
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2 text-stone-800">
              <DollarSign className="h-4 w-4" />
              Costo del Material
            </h4>
            {entry.plant_id && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
                onClick={() => setSupplierTermsSheetOpen(true)}
              >
                <CalendarClock className="h-3.5 w-3.5 mr-1.5 text-stone-600" />
                Plazos por proveedor
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="unit_price">Precio unitario ({uomLabel(materialUom)}) *</Label>
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
              {agreedMaterialUnit != null && (
                <div className={`text-xs mt-1 ${priceDiffersFromPo ? 'text-amber-700 font-medium' : 'text-emerald-700'}`}>
                  {priceDiffersFromPo ? '⚠ ' : '✓ '}
                  Precio OC: {formatCurrency(agreedMaterialUnit)}/{uomLabel(materialUom)}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="total_cost">Total (auto)</Label>
              <Input
                id="total_cost"
                type="text"
                value={formatCurrency(formData.total_cost || '0')}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="supplier_invoice">Remisión / Factura</Label>
              <Input
                id="supplier_invoice"
                type="text"
                value={formData.supplier_invoice}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplier_invoice: e.target.value }))}
                placeholder="Ej. FAC-12345"
              />
            </div>
            <div>
              <Label htmlFor="ap_due_date_material">Vencimiento (Material)</Label>
              <Input
                id="ap_due_date_material"
                type="date"
                value={formData.ap_due_date_material}
                onChange={(e) => setFormData((prev) => ({ ...prev, ap_due_date_material: e.target.value }))}
              />
              {materialTermsDays != null && (
                <div className="text-xs mt-1 space-y-0.5">
                  {materialDueAutoHint ? (
                    <p className="text-emerald-700">
                      Sugerido: {formatPaymentTermsLabel(materialTermsDays)} desde fecha de entrada
                    </p>
                  ) : (
                    <div className="text-stone-600 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
                      <span>
                        Plazo del proveedor:{' '}
                        <span className="font-medium text-stone-800">
                          {formatPaymentTermsLabel(materialTermsDays)}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs text-sky-800"
                        onClick={applySuggestedMaterialDue}
                      >
                        Aplicar a vencimiento
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── 3. OC de material (collapsible) ─── */}
        {effectiveSupplierId && (
          <Collapsible defaultOpen={!hasMaterialPoLink}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-stone-700 hover:text-stone-900 border-t border-stone-100 pt-3">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                OC de material
                {hasMaterialPoLink ? (
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-0">
                    {entry.po?.po_number || 'Vinculada'} ✓
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 text-[10px] border-0">Sin vincular</Badge>
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-stone-400 transition-transform [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {hasMaterialPoLink ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50/50 overflow-hidden text-sm">
                  {/* PO header row */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-stone-100/60 border-b border-stone-200/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                      <span className="font-mono font-semibold text-stone-800 truncate">
                        {materialPoHeader?.po_number ?? entry.po?.po_number ?? entry.po_id?.slice(0, 8)}
                      </span>
                      {materialPoHeader?.status && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${PO_STATUS_COLORS[materialPoHeader.status] ?? 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                          {PO_STATUS_LABELS[materialPoHeader.status] ?? materialPoHeader.status}
                        </span>
                      )}
                    </div>
                    <a
                      href={`/finanzas/po?po_id=${entry.po_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-400 hover:text-stone-700 shrink-0"
                      title="Ver OC"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="px-3 py-2.5 space-y-2.5">
                    {/* Supplier + date + payment terms */}
                    <div className="flex items-center justify-between gap-2 text-xs text-stone-600">
                      <span className="font-medium truncate">{entry.supplier?.name ?? '—'}</span>
                      <div className="flex items-center gap-2 shrink-0 text-stone-400">
                        {materialPoHeader?.payment_terms_days != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {PAYMENT_TERMS_LABELS[materialPoHeader.payment_terms_days] ?? `Net ${materialPoHeader.payment_terms_days}`}
                          </span>
                        )}
                        {fmtPoDate(materialPoHeader?.po_date) && (
                          <span>{fmtPoDate(materialPoHeader.po_date)}</span>
                        )}
                      </div>
                    </div>
                    {/* Agreed price indicator */}
                    {agreedMaterialUnit != null && (
                      <div className={cn(
                        'flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1.5',
                        priceDiffersFromPo
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      )}>
                        {priceDiffersFromPo
                          ? <AlertTriangle className="h-3 w-3 shrink-0" />
                          : <CheckCircle2 className="h-3 w-3 shrink-0" />}
                        <span>
                          Precio OC: <span className="font-mono">{formatCurrency(agreedMaterialUnit)}/{uomLabel(materialUom)}</span>
                          {priceDiffersFromPo && formData.unit_price && (
                            <span className="ml-1.5 font-normal opacity-75">
                              · ingresado: {formatCurrency(parseFloat(formData.unit_price))}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {/* Line fulfillment progress */}
                    {materialPoLoading ? (
                      <p className="text-xs text-stone-400">Cargando línea…</p>
                    ) : materialPoItem && !materialPoItem.is_service && (() => {
                      const ordQty = Number(materialPoItem.qty_ordered ?? 0)
                      const recQty = Number(materialPoItem.qty_received ?? materialPoItem.qty_received_native ?? 0)
                      const pct = ordQty > 1e-6 ? Math.min(100, Math.round((recQty / ordQty) * 1000) / 10) : 0
                      return (
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                            <span>
                              {recQty.toLocaleString('es-MX')} / {ordQty.toLocaleString('es-MX')} {uomLabel(materialPoItem.uom)} recibido
                            </span>
                            <span className="font-semibold tabular-nums">{pct}%</span>
                          </div>
                          <div className="w-full bg-stone-200/70 rounded-full h-1.5">
                            <div
                              className={cn('h-1.5 rounded-full transition-all', pct >= 99.9 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-stone-300')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  {materialPoHeader?.notes && (
                    <div className="px-3 py-2 border-t border-stone-200/60 bg-amber-50/40 text-[11px] text-amber-800 italic">
                      {materialPoHeader.notes}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {materialPoSearchLoading ? (
                    <p className="text-xs text-stone-600">Cargando líneas…</p>
                  ) : (
                    <div className="space-y-2">
                      <select
                        className="border border-stone-300 rounded-md bg-white px-3 py-2 text-sm w-full"
                        value={selectedMaterialSearchItemId}
                        onChange={(e) => setSelectedMaterialSearchItemId(e.target.value)}
                      >
                        <option value="">Sin vincular (solo precios)</option>
                        {materialPoSearchItems.length === 0 ? (
                          <option disabled>No hay líneas abiertas</option>
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
                        <p className="text-xs text-amber-800">No hay OC con saldo para este proveedor y material.</p>
                      )}
                      {selectedMaterialSearchItem && (
                        <div className="rounded-md border border-stone-200 bg-stone-50/60 px-3 py-2 space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-stone-700 truncate">
                              {(selectedMaterialSearchItem.po?.supplier as { name?: string } | undefined)?.name ?? '—'}
                            </span>
                            <span className="font-mono text-stone-500 shrink-0">
                              {selectedMaterialSearchItem.po?.po_number ?? selectedMaterialSearchItem.po?.id?.slice(0, 8)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                            <span className="truncate">{selectedMaterialSearchItem.material?.material_name ?? entry.material?.material_name ?? '—'}</span>
                            <span className="shrink-0 tabular-nums">
                              Rest. {Number(selectedMaterialSearchItem.qty_remaining ?? 0).toLocaleString('es-MX')} {uomLabel(selectedMaterialSearchItem.uom)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                      const p = buildPrefillFromMaterialEntry(entry, effectiveSupplierId)
                      if (!p) { toast.error('Faltan datos para crear la OC'); return }
                      setFleetPoPrefillFromEntry(null)
                      setPoPrefill(p)
                      setCreatePOOpen(true)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Crear nueva OC
                  </Button>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ─── 4. Evidence (collapsible; open when files exist to reduce clicks) ─── */}
        <Collapsible defaultOpen={(entry.document_count ?? 0) > 0}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-stone-700 hover:text-stone-900 border-t border-stone-100 pt-3">
            <span className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Evidencia
              <Badge variant="secondary" className="text-[10px] font-normal">
                {entry.document_count ?? '?'} archivo{(entry.document_count ?? 0) !== 1 ? 's' : ''}
              </Badge>
              {(entry.document_count ?? 0) === 0 && (
                <span className="text-amber-700 text-[10px]">⚠</span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 text-stone-400 transition-transform [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <EntryEvidencePanel
              entryId={entry.id}
              pricingStatus={entry.pricing_status}
              warnWhenPendingAndEmpty
            />
          </CollapsibleContent>
        </Collapsible>

        {/* ─── 5. Fleet (collapsible, closed by default) ─── */}
        <Collapsible defaultOpen={hasFleetPoLink || (entry.fleet_cost != null && Number(entry.fleet_cost) > 0)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-stone-700 hover:text-stone-900 border-t border-stone-100 pt-3">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Flota / Transporte
              {!hasFleetPoLink && !entry.fleet_cost && (
                <span className="text-[10px] text-stone-400 font-normal">(opcional)</span>
              )}
              {hasFleetPoLink && (
                <Badge className="bg-sky-100 text-sky-800 text-[10px] border-0">
                  {entry.fleet_po?.po_number || 'Vinculada'} ✓
                </Badge>
              )}
            </span>
            <ChevronDown className="h-4 w-4 text-stone-400 transition-transform [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            {/* Fleet PO linking */}
            {!hasFleetPoLink && effectiveSupplierId && (
              <div className="space-y-2">
                {fleetPoSearchLoading ? (
                  <p className="text-xs text-stone-600">Cargando líneas de flota…</p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="fleet_carrier_filter" className="text-stone-600 font-normal text-xs">
                        Filtrar por transportista <span className="text-stone-400">(opcional)</span>
                      </Label>
                      <Select
                        value={fleetCarrierFilterForSearch || 'none'}
                        onValueChange={(value) => {
                          setSelectedFleetSearchItemId('')
                          setFleetQtyEnteredLink(0)
                          const id = value === 'none' ? '' : value
                          setFleetCarrierFilterForSearch(id)
                          setFormData((prev) => ({ ...prev, fleet_supplier_id: id }))
                        }}
                      >
                        <SelectTrigger id="fleet_carrier_filter" className="w-full max-w-md h-9 text-sm">
                          <SelectValue placeholder="Todos los transportistas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Todos los transportistas</SelectItem>
                          {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-stone-500 leading-snug">
                        Elija primero la línea de servicio abajo; el transportista queda definido por la OC. Use el filtro solo para acotar la lista.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fleet_oc_search">OC de flota (línea de servicio)</Label>
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
                        <option value="">Sin OC de flota (costo manual)</option>
                        {fleetPoSearchItems.length === 0 ? (
                          <option disabled>No hay líneas de servicio abiertas</option>
                        ) : (
                          fleetPoSearchItems.map((it) => {
                            const poNum = it.po?.po_number || String(it.po?.id || '').slice(0, 8)
                            const carrier = (it.po?.supplier as { name?: string } | undefined)?.name || 'Transportista'
                            return (
                              <option key={it.id} value={it.id}>
                                {`OC ${poNum} · ${carrier} · Rest. ${(Number(it.qty_remaining) || 0).toLocaleString('es-MX')} ${it.uom || ''}`}
                              </option>
                            )
                          })
                        )}
                      </select>
                    </div>
                    {selectedFleetSearchItemId && selectedFleetSearchItem && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        OC de flota seleccionada — {selectedFleetSearchItem.po?.po_number || selectedFleetSearchItem.po_id?.slice(0, 8) || '?'}
                        {' · '}Precio: {formatCurrency(selectedFleetSearchItem.unit_price ?? 0)} / {uomLabel(selectedFleetSearchItem.uom)}
                      </div>
                    )}
                    {selectedFleetSearchItemId && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-md border border-stone-200 bg-stone-50/80 px-3 py-2">
                          <p className="text-[11px] text-stone-500 mb-0.5">Transportista (según OC)</p>
                          <p className="text-sm font-medium text-stone-900">
                            {(selectedFleetSearchItem?.po?.supplier as { name?: string } | undefined)?.name ?? '—'}
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="fleet_qty_link">Cantidad servicio</Label>
                          <div className="flex gap-2 items-center">
                            <Input
                              id="fleet_qty_link"
                              type="number"
                              step="0.01"
                              min="0"
                              value={fleetQtyEnteredLink || ''}
                              onChange={(e) => setFleetQtyEnteredLink(parseFloat(e.target.value) || 0)}
                              onWheel={(ev) => ev.currentTarget.blur()}
                            />
                            <span className="text-sm text-stone-600 shrink-0">{selectedFleetSearchItem?.uom || ''}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedFleetSearchItem && (
                      <div className="text-xs text-stone-700">
                        Precio OC: <span className="font-medium">{formatCurrency(selectedFleetSearchItem.unit_price ?? 0)} / {uomLabel(selectedFleetSearchItem.uom)}</span>
                        {fleetCostDiffersFromPo && agreedFleetTotal != null && (
                          <span className="text-amber-700 ml-2">⚠ Difiere del total OC ({formatCurrency(agreedFleetTotal)})</span>
                        )}
                      </div>
                    )}
                  </>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  onClick={() => {
                    const p = buildPrefillFleetFromMaterialEntry(entry, effectiveSupplierId)
                    if (!p) { toast.error('Faltan datos para crear OC de flota'); return }
                    setPoPrefill(null)
                    setFleetPoPrefillFromEntry(p)
                    setCreatePOOpen(true)
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Crear nueva OC de flota
                </Button>
              </div>
            )}

            {/* Fleet PO info (when linked) */}
            {hasFleetPoLink && (
              <div className="rounded-lg border border-sky-200/70 bg-sky-50/30 overflow-hidden text-sm">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-sky-50/80 border-b border-sky-200/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Truck className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    <span className="font-mono font-semibold text-sky-800 truncate">
                      {fleetPoHeader?.po_number ?? entry.fleet_po?.po_number ?? entry.fleet_po_id?.slice(0, 8)}
                    </span>
                    {fleetPoHeader?.status && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${PO_STATUS_COLORS[fleetPoHeader.status] ?? 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                        {PO_STATUS_LABELS[fleetPoHeader.status] ?? fleetPoHeader.status}
                      </span>
                    )}
                  </div>
                  <a
                    href={`/finanzas/po?po_id=${entry.fleet_po_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-700 shrink-0"
                    title="Ver OC de flota"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="px-3 py-2.5 space-y-2">
                  {/* Carrier + payment terms + date */}
                  <div className="flex items-center justify-between gap-2 text-xs text-sky-700">
                    <span className="font-medium truncate">{fleetSupplierDisplayName ?? '—'}</span>
                    <div className="flex items-center gap-2 shrink-0 text-sky-400">
                      {fleetPoHeader?.payment_terms_days != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {PAYMENT_TERMS_LABELS[fleetPoHeader.payment_terms_days] ?? `Net ${fleetPoHeader.payment_terms_days}`}
                        </span>
                      )}
                      {fmtPoDate(fleetPoHeader?.po_date) && (
                        <span>{fmtPoDate(fleetPoHeader.po_date)}</span>
                      )}
                    </div>
                  </div>
                  {/* Fleet line detail */}
                  {fleetPoLoading ? (
                    <p className="text-xs text-sky-400">Cargando línea…</p>
                  ) : fleetPoItem && (
                    <div className={cn(
                      'flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1.5',
                      fleetCostDiffersFromPo
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-sky-50 text-sky-700 border border-sky-200'
                    )}>
                      {fleetCostDiffersFromPo
                        ? <AlertTriangle className="h-3 w-3 shrink-0" />
                        : <CheckCircle2 className="h-3 w-3 shrink-0" />}
                      <span>
                        <span className="font-mono">{formatCurrency(fleetPoItem.unit_price ?? 0)}/{uomLabel(fleetPoItem.uom)}</span>
                        <span className="mx-1.5 opacity-50">·</span>
                        {Number(entry.fleet_qty_entered ?? 0).toLocaleString('es-MX')} {uomLabel(fleetPoItem.uom)}
                        {fleetCostDiffersFromPo && agreedFleetTotal != null && (
                          <span className="ml-1.5 font-normal opacity-75">· total OC: {formatCurrency(agreedFleetTotal)}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                {fleetPoHeader?.notes && (
                  <div className="px-3 py-2 border-t border-sky-200/50 bg-amber-50/40 text-[11px] text-amber-800 italic">
                    {fleetPoHeader.notes}
                  </div>
                )}
              </div>
            )}

            {/* Fleet pricing fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fleet_supplier">Proveedor de Flota</Label>
                {hasFleetPoLink || selectedFleetSearchItemId ? (
                  <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                    {fleetSupplierDisplayName || '—'}
                  </div>
                ) : (
                  <Select
                    value={formData.fleet_supplier_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, fleet_supplier_id: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccione…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor</SelectItem>
                      {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="ap_due_date_fleet">Vencimiento (Flota)</Label>
                <Input
                  id="ap_due_date_fleet"
                  type="date"
                  value={formData.ap_due_date_fleet}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ap_due_date_fleet: e.target.value }))}
                />
                {fleetTermsDays != null && (
                  <div className="text-xs mt-1 space-y-0.5">
                    {fleetDueAutoHint ? (
                      <p className="text-emerald-700">
                        Sugerido: {formatPaymentTermsLabel(fleetTermsDays)} desde fecha de entrada
                      </p>
                    ) : (
                      <div className="text-stone-600 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
                        <span>
                          Plazo del transportista:{' '}
                          <span className="font-medium text-stone-800">
                            {formatPaymentTermsLabel(fleetTermsDays)}
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs text-sky-800"
                          onClick={applySuggestedFleetDue}
                        >
                          Aplicar a vencimiento
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ─── Sticky footer ─── */}
      <div className={
        embedded
          ? 'sticky bottom-0 border-t border-stone-200 bg-white px-5 py-3 flex items-center justify-between'
          : 'flex items-center justify-between pt-4 border-t'
      }>
        <div>
          <span className="text-sm text-stone-600">Total:</span>
          <span className="text-lg font-bold text-stone-900 ml-2">{formatCurrency(grandTotal)}</span>
          {totalFleet > 0 && (
            <span className="text-xs text-stone-500 ml-2">
              (Mat. {formatCurrency(totalMaterial)} + Flota {formatCurrency(totalFleet)})
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className={cn('bg-sky-800 text-white hover:bg-sky-900 shadow-sm')}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </form>

    <SupplierPaymentTermsQuickSheet
      open={supplierTermsSheetOpen}
      onOpenChange={setSupplierTermsSheetOpen}
      plantId={entry.plant_id ?? null}
      canEdit={canEditSupplierPaymentTerms}
      onTermsUpdated={() => void fetchSuppliers()}
    />

    <CreatePOModal
      open={createPOOpen}
      onClose={() => { setCreatePOOpen(false); setPoPrefill(null); setFleetPoPrefillFromEntry(null) }}
      defaultPlantId={entry.plant_id}
      defaultMaterialId={entry.material_id}
      prefillFromMaterialEntry={fleetPoPrefillFromEntry ? null : poPrefill}
      prefillFleetFromMaterialEntry={fleetPoPrefillFromEntry}
      onSuccess={(createdPoId) => {
        const wasFleet = Boolean(fleetPoPrefillFromEntry)
        setCreatePOOpen(false)
        setPoPrefill(null)
        setFleetPoPrefillFromEntry(null)
        if (wasFleet) {
          if (createdPoId) setPendingAutoSelectFleetPoId(createdPoId)
          setFleetPoSearchRefreshKey((k) => k + 1)
          toast.success('OC de flota creada. Vinculando línea automáticamente…')
        } else {
          if (createdPoId) setPendingAutoSelectMaterialPoId(createdPoId)
          setMaterialPoSearchRefreshKey((k) => k + 1)
          toast.success('OC creada. Vinculando línea automáticamente…')
        }
        onAfterCreatePO?.()
      }}
    />
    </>
  )
}
