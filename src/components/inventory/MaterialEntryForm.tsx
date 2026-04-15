'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Package, 
  Upload, 
  Save, 
  Calculator,
  FileText,
  User,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronDown,
  ClipboardList,
  Calendar,
  Truck,
  RefreshCw,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { usePlantContext } from '@/contexts/PlantContext'
import { toast } from 'sonner'
import { MaterialEntryInput, PendingFile } from '@/types/inventory'
import type { MaterialAlert } from '@/types/alerts'
import MaterialSelect from '@/components/inventory/MaterialSelect'
import SupplierSelect from '@/components/inventory/SupplierSelect'
import SimpleFileUpload from '@/components/inventory/SimpleFileUpload'
import { format, isToday, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { kgToMetricTons, KG_PER_METRIC_TON } from '@/lib/inventory/massUnits'

function scaleKgFromEntryForm(opts: {
  materialPoLine: { is_service?: boolean; uom?: string | null; material?: { density_kg_per_l?: number | null } } | null | undefined
  receivedQtyEntered: number
  formDataQuantityReceived: number
}): number {
  const { materialPoLine, receivedQtyEntered, formDataQuantityReceived } = opts
  if (materialPoLine && !materialPoLine.is_service) {
    if (materialPoLine.uom === 'l') {
      const density = Number(materialPoLine.material?.density_kg_per_l) || 0
      if (!density) return 0
      return (receivedQtyEntered || 0) * density
    }
    if (materialPoLine.uom === 'm3') {
      return receivedQtyEntered || 0
    }
    return receivedQtyEntered > 0 ? receivedQtyEntered : formDataQuantityReceived
  }
  return receivedQtyEntered > 0 ? receivedQtyEntered : formDataQuantityReceived
}

/** Dosificador: vincular recepciones a solicitudes con OC; la OC se surte de forma acumulativa (no “en una sola entrada”). */
const DOSIFICADOR_FULFILLMENT_STATUSES = new Set<MaterialAlert['status']>(['po_linked', 'delivery_scheduled'])

function normalizeAlertLinkedPo(
  a: MaterialAlert
): NonNullable<MaterialAlert['linked_po']> | null {
  const raw = (a as { linked_po?: unknown }).linked_po
  if (!raw) return null
  const row = (Array.isArray(raw) ? raw[0] : raw) as NonNullable<MaterialAlert['linked_po']>
  if (!row?.id) return null
  const sup = row.supplier as unknown
  const supplier = (Array.isArray(sup) ? sup[0] : sup) as NonNullable<
    MaterialAlert['linked_po']
  >['supplier']
  return { ...row, supplier: supplier ?? null }
}

function poRefFromId(id: string | null | undefined): string {
  if (!id) return ''
  return String(id).slice(0, 8).toUpperCase()
}

/** Human-readable OC label: número de OC o ref. corta (sin precios). */
function linkedPoLabel(
  lp: NonNullable<MaterialAlert['linked_po']> | null,
  poId: string | null | undefined
): string {
  const n = lp?.po_number?.trim()
  if (n) return n
  if (poId) return `OC · ${poRefFromId(poId)}`
  return 'Orden de compra'
}

/** PO snapshot for dosificador: no prices (from GET /api/po/[id]/receipt-context). */
type DosificadorReceiptPo = {
  id: string
  po_number?: string | null
  display_ref: string
  status: string
  supplier_id: string | null
  po_date: string | null
  notes: string | null
  supplier: {
    id: string
    name: string
    provider_number?: string | null
    provider_letter?: string | null
    internal_code?: string | null
  } | null
}

type DosificadorReceiptItem = {
  id: string
  material_id: string | null
  material_name: string
  uom: string
  qty_ordered: number
  qty_received: number
  qty_remaining: number
  /** Saldo en kg cuando uom=m3 (OC comercial en m³) */
  remaining_kg?: number
  volumetric_weight_kg_per_m3?: number | null
  status: string
}

const ALERT_STATUS_SHORT: Partial<Record<MaterialAlert['status'], string>> = {
  confirmed: 'Confirmada',
  pending_validation: 'Pendiente validación',
  validated: 'Validada',
  pending_po: 'Requiere OC',
  po_linked: 'OC vinculada',
  delivery_scheduled: 'Entrega programada',
}

function sortAlertsForEntry(alerts: MaterialAlert[]): MaterialAlert[] {
  const today = new Date().toISOString().slice(0, 10)
  return [...alerts].sort((x, y) => {
    const xd = x.scheduled_delivery_date?.slice(0, 10)
    const yd = y.scheduled_delivery_date?.slice(0, 10)
    const xToday = xd === today ? 0 : 1
    const yToday = yd === today ? 0 : 1
    if (xToday !== yToday) return xToday - yToday
    if (xd && yd) return xd.localeCompare(yd)
    if (xd && !yd) return -1
    if (!xd && yd) return 1
    return new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
  })
}

interface MaterialEntryFormProps {
  onSuccess?: () => void
}

export default function MaterialEntryForm({ onSuccess }: MaterialEntryFormProps) {
  const { profile } = useAuthSelectors()
  const { currentPlant } = usePlantContext()
  const searchParams = useSearchParams()
  const urlMaterialApplied = useRef(false)
  const urlAlertLock = useRef(false)
  
  // Check if user is DOSIFICADOR for simplified form
  const isDosificador = profile?.role === 'DOSIFICADOR'
  const [advancedPoOpen, setAdvancedPoOpen] = useState(() => !isDosificador)
  const [fleetSectionOpen, setFleetSectionOpen] = useState(() => !isDosificador)
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    material_id: '',
    quantity_received: 0,
    supplier_id: '',
    supplier_invoice: '',
    fleet_supplier_id: '',
    fleet_invoice: '',
    notes: '',
    entry_date: new Date().toISOString().split('T')[0]
  })
  const [uploading, setUploading] = useState(false)
  const [currentInventory, setCurrentInventory] = useState<number | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [existingDocuments, setExistingDocuments] = useState<any[]>([])
  const [poItems, setPoItems] = useState<any[]>([])
  const [selectedPoItemId, setSelectedPoItemId] = useState<string>('')
  const [receivedUom, setReceivedUom] = useState<'kg' | 'l' | 'm3'>('kg')
  const [receivedQtyEntered, setReceivedQtyEntered] = useState<number>(0)
  const [volumetricWeight, setVolumetricWeight] = useState<number | undefined>(undefined)
  // Track which fields were auto-filled from PO
  const [autoFilledFromPO, setAutoFilledFromPO] = useState<{
    material: boolean
    supplier: boolean
    uom: boolean
    volumetricWeight: boolean
  }>({
    material: false,
    supplier: false,
    uom: false,
    volumetricWeight: false
  })
  
  // Fleet PO state
  const [fleetPoItems, setFleetPoItems] = useState<any[]>([])
  const [selectedFleetPoItemId, setSelectedFleetPoItemId] = useState<string>('')
  const [fleetQtyEntered, setFleetQtyEntered] = useState<number>(0)

  /** Solicitudes activas que pueden cerrarse con esta entrada (solo dosificador). */
  const [fulfillmentAlerts, setFulfillmentAlerts] = useState<MaterialAlert[]>([])
  const [selectedFulfillmentAlertId, setSelectedFulfillmentAlertId] = useState<string>('')
  const [fulfillmentAlertsLoading, setFulfillmentAlertsLoading] = useState(false)
  const [entrySuccessInfo, setEntrySuccessInfo] = useState<{ alertNumber: string } | null>(null)

  const [dosificadorReceiptContext, setDosificadorReceiptContext] = useState<{
    po: DosificadorReceiptPo
    items: DosificadorReceiptItem[]
  } | null>(null)
  const [dosificadorReceiptLoading, setDosificadorReceiptLoading] = useState(false)
  /** Increment to retry GET receipt-context after failure */
  const [dosificadorReceiptRefreshToken, setDosificadorReceiptRefreshToken] = useState(0)
  /** supplier_id last applied from linked PO — ref avoids re-fetch loops in useEffect */
  const supplierAutoFromPoRef = useRef<string | null>(null)
  const [dosificadorSupplierOverride, setDosificadorSupplierOverride] = useState(false)

  const selectedFulfillmentAlert = useMemo(
    () => fulfillmentAlerts.find((a) => a.id === selectedFulfillmentAlertId),
    [fulfillmentAlerts, selectedFulfillmentAlertId]
  )
  const selectedLinkedPo = useMemo(
    () => (selectedFulfillmentAlert ? normalizeAlertLinkedPo(selectedFulfillmentAlert) : null),
    [selectedFulfillmentAlert]
  )
  const selectedAlertExistingPoId = selectedFulfillmentAlert?.existing_po_id ?? null

  const dosificadorPoLineForMaterial = useMemo(() => {
    if (!dosificadorReceiptContext?.items?.length || !formData.material_id) return null
    return (
      dosificadorReceiptContext.items.find((i) => i.material_id === formData.material_id) ??
      dosificadorReceiptContext.items[0] ??
      null
    )
  }, [dosificadorReceiptContext, formData.material_id])

  const materialPoLineForScale = useMemo(
    () => (selectedPoItemId ? poItems.find((it) => it.id === selectedPoItemId) : null),
    [selectedPoItemId, poItems]
  )

  const scaleKgPreview = useMemo(
    () =>
      scaleKgFromEntryForm({
        materialPoLine: materialPoLineForScale,
        receivedQtyEntered,
        formDataQuantityReceived: formData.quantity_received,
      }),
    [materialPoLineForScale, receivedQtyEntered, formData.quantity_received]
  )

  useEffect(() => {
    if (!selectedFleetPoItemId || fleetPoItems.length === 0) return
    const fi = fleetPoItems.find((it) => it.id === selectedFleetPoItemId)
    if (!fi || fi.uom !== 'tons') return
    if (scaleKgPreview > 0) {
      setFleetQtyEntered(kgToMetricTons(scaleKgPreview))
    }
  }, [selectedFleetPoItemId, fleetPoItems, scaleKgPreview])

  const dosificadorSummaryMaterialName = useMemo(() => {
    const fromSel = selectedFulfillmentAlert?.material?.material_name
    if (fromSel) return fromSel
    const a = fulfillmentAlerts.find((x) => x.material_id === formData.material_id)
    return (a?.material as { material_name?: string } | undefined)?.material_name ?? '—'
  }, [selectedFulfillmentAlert, fulfillmentAlerts, formData.material_id])

  const dosificadorSummarySupplierName = useMemo(() => {
    if (dosificadorReceiptContext?.po.supplier?.name) return dosificadorReceiptContext.po.supplier.name
    return selectedLinkedPo?.supplier?.name ?? (formData.supplier_id ? 'Proveedor seleccionado' : '—')
  }, [dosificadorReceiptContext, selectedLinkedPo, formData.supplier_id])

  // Calculate inventory after
  const inventoryAfter = currentInventory !== null ? currentInventory + formData.quantity_received : null

  const dosificadorFleetIncomplete = Boolean(
    isDosificador &&
      (!formData.fleet_supplier_id || !String(formData.fleet_invoice || '').trim())
  )
  const dosificadorFleetUrgentHint = Boolean(
    isDosificador && selectedFulfillmentAlert?.needs_fleet && dosificadorFleetIncomplete
  )

  // Fetch existing documents when entry is created
  const fetchExistingDocuments = async (entryId: string) => {
    try {
      const response = await fetch(`/api/inventory/documents?reference_id=${entryId}&type=entry`);
      if (response.ok) {
        const data = await response.json();
        setExistingDocuments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  // Delete existing document
  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/inventory/documents?id=${documentId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove from local state
        setExistingDocuments(prev => prev.filter(doc => doc.id !== documentId));
        toast.success('Documento eliminado correctamente');
      } else {
        const error = await response.json();
        toast.error(`Error al eliminar documento: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  const handleMaterialChange = async (materialId: string) => {
    // If material is changed manually and it was auto-filled from PO, clear the auto-fill flag
    if (autoFilledFromPO.material && materialId !== formData.material_id) {
      setAutoFilledFromPO(prev => ({ ...prev, material: false }))
      // If PO is still selected but material doesn't match, clear PO selection
      if (selectedPoItemId) {
        const poItem = poItems.find(it => it.id === selectedPoItemId)
        if (poItem && poItem.material_id !== materialId) {
          setSelectedPoItemId('')
          toast.warning('El material seleccionado no coincide con el PO. Se limpió la selección del PO.')
        }
      }
    }
    
    urlAlertLock.current = false
    setFormData((prev) => ({
      ...prev,
      material_id: materialId,
      fleet_supplier_id: '',
      fleet_invoice: '',
    }))
    setSelectedFleetPoItemId('')
    setFleetQtyEntered(0)
    setFulfillmentAlerts([])
    setSelectedFulfillmentAlertId('')
    setEntrySuccessInfo(null)
    supplierAutoFromPoRef.current = null
    setDosificadorReceiptContext(null)
    setDosificadorSupplierOverride(false)

    const plantId = currentPlant?.id || profile?.plant_id;

    if (materialId && plantId) {
      try {
        const response = await fetch(`/api/inventory?material_id=${materialId}&plant_id=${plantId}`)
        if (response.ok) {
          const data = await response.json()
          const inventory = data.inventory.find((inv: any) => inv.material_id === materialId)
          setCurrentInventory(inventory?.current_stock || 0)
        }

        if (isDosificador) {
          setFulfillmentAlertsLoading(true)
          try {
            const ar = await fetch(
              `/api/alerts/material?plant_id=${plantId}&material_id=${materialId}&active=true`
            )
            const json = ar.ok ? await ar.json() : null
            const all = (json?.data || []) as MaterialAlert[]
            const linkable = sortAlertsForEntry(
              all.filter((a) => DOSIFICADOR_FULFILLMENT_STATUSES.has(a.status))
            )
            setFulfillmentAlerts(linkable)
            if (linkable.length === 1) {
              setSelectedFulfillmentAlertId(linkable[0].id)
            }
          } catch {
            setFulfillmentAlerts([])
          } finally {
            setFulfillmentAlertsLoading(false)
          }
        }

        if (!isDosificador) {
          setFulfillmentAlertsLoading(true)
          try {
            const ar = await fetch(
              `/api/alerts/material?plant_id=${plantId}&material_id=${materialId}&status=delivery_scheduled,po_linked,validated,pending_po`
            )
            const json = ar.ok ? await ar.json() : null
            const all = (json?.data || []) as MaterialAlert[]
            const linkable = sortAlertsForEntry(
              all.filter((a) =>
                ['delivery_scheduled', 'po_linked', 'validated', 'pending_po'].includes(a.status)
              )
            )
            setFulfillmentAlerts(linkable)
            setSelectedFulfillmentAlertId('')
          } catch {
            setFulfillmentAlerts([])
          } finally {
            setFulfillmentAlertsLoading(false)
          }

          const params = new URLSearchParams()
          params.set('plant_id', plantId)
          params.set('material_id', materialId)
          if (formData.supplier_id) params.set('supplier_id', formData.supplier_id)
          const resPo = await fetch(`/api/po/items/search?${params.toString()}`)
          if (resPo.ok) {
            const dataPo = await resPo.json()
            setPoItems(dataPo.items || [])
          }
        }
      } catch (error) {
        console.error('Error fetching current inventory:', error)
      }
    } else {
      setCurrentInventory(null)
      setPoItems([])
      setSelectedPoItemId('')
      setFulfillmentAlerts([])
      setSelectedFulfillmentAlertId('')
    }
  }

  useEffect(() => {
    if (profile?.role === 'DOSIFICADOR') {
      setAdvancedPoOpen(false)
    }
  }, [profile?.role])

  useEffect(() => {
    setSelectedFleetPoItemId('')
    setFleetQtyEntered(0)
    if (isDosificador) {
      setFormData((prev) => ({ ...prev, fleet_supplier_id: '', fleet_invoice: '' }))
    }
  }, [selectedFulfillmentAlertId, isDosificador])

  useEffect(() => {
    if (!isDosificador || !selectedFulfillmentAlert?.needs_fleet) return
    setFleetSectionOpen(true)
  }, [isDosificador, selectedFulfillmentAlert?.needs_fleet, selectedFulfillmentAlertId])

  useEffect(() => {
    if (!isDosificador) {
      setDosificadorReceiptContext(null)
      setDosificadorReceiptLoading(false)
      supplierAutoFromPoRef.current = null
      setDosificadorSupplierOverride(false)
      return
    }

    const clearAutoSupplierIfMatches = () => {
      const auto = supplierAutoFromPoRef.current
      if (auto) {
        setFormData((prev) => (prev.supplier_id === auto ? { ...prev, supplier_id: '' } : prev))
        supplierAutoFromPoRef.current = null
      }
    }

    if (!selectedFulfillmentAlertId || !formData.material_id) {
      setDosificadorReceiptContext(null)
      setDosificadorReceiptLoading(false)
      clearAutoSupplierIfMatches()
      return
    }

    if (!selectedAlertExistingPoId) {
      setDosificadorReceiptContext(null)
      setDosificadorReceiptLoading(false)
      clearAutoSupplierIfMatches()
      return
    }

    let cancelled = false
    setDosificadorReceiptContext(null)
    setDosificadorReceiptLoading(true)
    fetch(
      `/api/po/${selectedAlertExistingPoId}/receipt-context?material_id=${encodeURIComponent(formData.material_id)}`
    )
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || 'No se pudo cargar la OC')
        }
        return r.json() as Promise<{ po: DosificadorReceiptPo; items: DosificadorReceiptItem[] }>
      })
      .then((data) => {
        if (cancelled || !data?.po) return
        setDosificadorReceiptContext({ po: data.po, items: data.items || [] })
        const sid = data.po.supplier_id
        if (sid) {
          supplierAutoFromPoRef.current = sid
          setFormData((prev) => ({ ...prev, supplier_id: sid }))
        }
        setDosificadorSupplierOverride(false)
      })
      .catch((e) => {
        if (!cancelled) {
          setDosificadorReceiptContext(null)
          toast.error(e instanceof Error ? e.message : 'Error al cargar contexto de OC')
        }
      })
      .finally(() => {
        if (!cancelled) setDosificadorReceiptLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    isDosificador,
    selectedFulfillmentAlertId,
    selectedAlertExistingPoId,
    formData.material_id,
    dosificadorReceiptRefreshToken,
  ])

  /** Si falla receipt-context pero la alerta trae linked_po, rellenar supplier_id para el POST */
  useEffect(() => {
    if (!isDosificador || !selectedFulfillmentAlert || !selectedAlertExistingPoId) return
    if (dosificadorReceiptLoading) return
    if (dosificadorReceiptContext) return
    if (dosificadorSupplierOverride) return
    const lp = normalizeAlertLinkedPo(selectedFulfillmentAlert)
    const sid = lp?.supplier?.id
    if (!sid) return
    supplierAutoFromPoRef.current = sid
    setFormData((prev) => (prev.supplier_id === sid ? prev : { ...prev, supplier_id: sid }))
  }, [
    isDosificador,
    selectedFulfillmentAlert,
    selectedAlertExistingPoId,
    dosificadorReceiptLoading,
    dosificadorReceiptContext,
    dosificadorSupplierOverride,
  ])

  useEffect(() => {
    const mid = searchParams.get('material_id')
    if (!mid || !currentPlant?.id || urlMaterialApplied.current) return
    urlMaterialApplied.current = true
    void handleMaterialChange(mid)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL prefill
  }, [searchParams, currentPlant?.id])

  useEffect(() => {
    const aid = searchParams.get('alert_id')
    if (!aid || fulfillmentAlertsLoading || urlAlertLock.current) return
    const match = fulfillmentAlerts.find((a) => a.id === aid)
    if (match) {
      setSelectedFulfillmentAlertId(aid)
      urlAlertLock.current = true
    }
  }, [searchParams, fulfillmentAlerts, fulfillmentAlertsLoading])

  // Auto-fill form fields when PO item is selected
  useEffect(() => {
    if (!selectedPoItemId) {
      // Clear auto-fill flags when PO is cleared
      setAutoFilledFromPO({
        material: false,
        supplier: false,
        uom: false,
        volumetricWeight: false
      })
      return
    }

    const poItem = poItems.find(it => it.id === selectedPoItemId)
    if (!poItem || poItem.is_service) return

    const plantId = currentPlant?.id || profile?.plant_id

    // Auto-fill material
    if (poItem.material_id && poItem.material_id !== formData.material_id) {
      setFormData(prev => ({ ...prev, material_id: poItem.material_id }))
      setAutoFilledFromPO(prev => ({ ...prev, material: true }))
      
      // Load inventory for the material (without calling handleMaterialChange to avoid recursion)
      if (plantId) {
        fetch(`/api/inventory?material_id=${poItem.material_id}&plant_id=${plantId}`)
          .then(res => res.json())
          .then(data => {
            const inventory = data.inventory?.find((inv: any) => inv.material_id === poItem.material_id)
            setCurrentInventory(inventory?.current_stock || 0)
          })
          .catch(() => {})
      }
    }

    // Auto-fill supplier
    if (poItem.po?.supplier_id && poItem.po.supplier_id !== formData.supplier_id) {
      setFormData(prev => ({ ...prev, supplier_id: poItem.po.supplier_id }))
      setAutoFilledFromPO(prev => ({ ...prev, supplier: true }))
    }

    // Auto-fill UoM (m³ OC: captura siempre en kg en báscula; el servidor deriva m³)
    if (poItem.uom && ['kg', 'l', 'm3'].includes(poItem.uom)) {
      setReceivedUom(poItem.uom === 'm3' ? 'kg' : (poItem.uom as 'kg' | 'l' | 'm3'))
      setAutoFilledFromPO(prev => ({ ...prev, uom: true }))
    }

    // Auto-fill volumetric weight if m3
    if (poItem.uom === 'm3' && poItem.volumetric_weight_kg_per_m3) {
      setVolumetricWeight(poItem.volumetric_weight_kg_per_m3)
      setAutoFilledFromPO(prev => ({ ...prev, volumetricWeight: true }))
    }

    // Pre-fill quantity: m³ OC → sugerir saldo en kg (báscula); resto en UoM nativa
    const remaining =
      poItem.uom === 'm3'
        ? Number(poItem.remainingKg ?? 0) || 0
        : Number(poItem.qty_remaining_native ?? poItem.remainingKg ?? poItem.qty_remaining ?? 0) || 0
    if (remaining > 0) {
      setReceivedQtyEntered(remaining)
    }
  }, [selectedPoItemId, poItems, formData.material_id, formData.supplier_id, currentPlant?.id, profile?.plant_id])

  // Refresh PO items when supplier changes
  useEffect(() => {
    if (isDosificador) return
    const plantId = currentPlant?.id || profile?.plant_id
    if (!plantId || !formData.material_id) return
    ;(async () => {
      const params = new URLSearchParams()
      params.set('plant_id', plantId)
      params.set('material_id', formData.material_id)
      if (formData.supplier_id) params.set('supplier_id', formData.supplier_id)
      const res = await fetch(`/api/po/items/search?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setPoItems(data.items || [])
      }
    })()
  }, [formData.supplier_id, isDosificador, currentPlant?.id, profile?.plant_id, formData.material_id])
  
  // Fleet PO líneas: material_supplier = proveedor del material; opcional po_supplier = transportista (encabezado OC)
  useEffect(() => {
    if (isDosificador) return
    const plantId = currentPlant?.id || profile?.plant_id
    if (!plantId || !formData.supplier_id) {
      setFleetPoItems([])
      return
    }
    ;(async () => {
      const params = new URLSearchParams()
      params.set('plant_id', plantId)
      params.set('material_supplier_id', formData.supplier_id)
      params.set('is_service', 'true')
      if (formData.fleet_supplier_id) {
        params.set('po_supplier_id', formData.fleet_supplier_id)
      }
      const res = await fetch(`/api/po/items/search?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setFleetPoItems(data.items || [])
      }
    })()
  }, [formData.supplier_id, formData.fleet_supplier_id, currentPlant?.id, profile?.plant_id, isDosificador])

  // Al elegir línea de OC de flota, fijar proveedor de transporte desde el encabezado de la OC
  useEffect(() => {
    if (!selectedFleetPoItemId || fleetPoItems.length === 0) return
    const fleetItem = fleetPoItems.find((it) => it.id === selectedFleetPoItemId)
    const headerSid = fleetItem?.po?.supplier_id as string | undefined
    if (!headerSid) return
    setFormData((prev) =>
      prev.fleet_supplier_id === headerSid ? prev : { ...prev, fleet_supplier_id: headerSid }
    )
  }, [selectedFleetPoItemId, fleetPoItems])

  // Si el listado ya cargó y la línea elegida no está (p. ej. cambió el filtro), limpiar
  useEffect(() => {
    if (!selectedFleetPoItemId || fleetPoItems.length === 0) return
    if (!fleetPoItems.some((it) => it.id === selectedFleetPoItemId)) {
      setSelectedFleetPoItemId('')
      setFleetQtyEntered(0)
    }
  }, [fleetPoItems, selectedFleetPoItemId])

  // Handle file upload
  const handleFileUpload = (files: FileList) => {
    const newFiles = Array.from(files).map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending' as const
    }));
    
    setPendingFiles(prev => [...prev, ...newFiles]);
  };

  // Remove pending file
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload documents after entry creation
  const uploadDocuments = async (entryId: string) => {
    if (pendingFiles.length === 0) return;

    const uploadPromises = pendingFiles.map(async (fileInfo) => {
      try {
        const formData = new FormData();
        formData.append('file', fileInfo.file);
        formData.append('type', 'entry');
        formData.append('reference_id', entryId);

        const response = await fetch('/api/inventory/documents', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          return { ...fileInfo, status: 'uploaded' as const, documentId: result.data.id };
        } else {
          const error = await response.json();
          console.error('Error uploading document:', error);
          return { ...fileInfo, status: 'error' as const, error: error.error };
        }
      } catch (error) {
        console.error('Error uploading document:', error);
        return { ...fileInfo, status: 'error' as const, error: 'Error de conexión' };
      }
    });

    const results = await Promise.all(uploadPromises);
    
    // Update pending files with results
    setPendingFiles(results);
    
    // Clear successfully uploaded files after a delay
    setTimeout(() => {
      setPendingFiles(prev => prev.filter(f => f.status !== 'uploaded'));
    }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Form submission - currentPlant:', currentPlant);
    console.log('Form submission - formData:', formData);
    
    if (!formData.material_id) {
      toast.error('Por favor complete todos los campos requeridos')
      return
    }

    if (isDosificador && !String(formData.supplier_invoice || '').trim()) {
      toast.error('El número de remisión es obligatorio para registrar la recepción')
      return
    }

    if (!currentPlant?.id) {
      toast.error('Debe seleccionar una planta para continuar')
      return
    }

    // Fallback: if currentPlant is not available, try to use profile's plant_id
    const plantId = currentPlant?.id || profile?.plant_id;
    
    if (!plantId) {
      toast.error('No se pudo determinar la planta. Contacte al administrador.')
      return
    }

    if (
      isDosificador &&
      selectedFulfillmentAlert?.needs_fleet &&
      (!formData.fleet_supplier_id || !String(formData.fleet_invoice || '').trim())
    ) {
      const proceed = window.confirm(
        'Esta solicitud indica flete aparte del material. ¿Continuar sin registrar transportista y remisión de flota?'
      )
      if (!proceed) return
    }

    console.log('Submitting with plant_id:', plantId);
    
    setLoading(true)
    try {
      const poLine = selectedPoItemId ? poItems.find(it => it.id === selectedPoItemId) : null
      let scaleKg = formData.quantity_received
      if (poLine && !poLine.is_service) {
        if (poLine.uom === 'l') {
          const density = Number(poLine.material?.density_kg_per_l) || 0
          if (!density) {
            toast.error('Material sin densidad configurada para convertir litros a kg')
            setLoading(false)
            return
          }
          scaleKg = (receivedQtyEntered || 0) * density
        } else if (poLine.uom === 'm3') {
          scaleKg = receivedQtyEntered || 0
        } else {
          scaleKg = receivedQtyEntered > 0 ? receivedQtyEntered : formData.quantity_received
        }
      }

      if (!formData.material_id || scaleKg <= 0) {
        toast.error('Por favor complete todos los campos requeridos')
        setLoading(false)
        return
      }

      const requestBody: Record<string, unknown> = {
        ...formData,
        quantity_received: scaleKg,
        plant_id: plantId,
        inventory_before: currentInventory || 0
      }
      const fleetInv = String(formData.fleet_invoice || '').trim()
      if (fleetInv) requestBody.fleet_invoice = fleetInv
      else delete requestBody.fleet_invoice
      if (selectedPoItemId) {
        const item = poItems.find(it => it.id === selectedPoItemId)
        if (item) {
          // CRITICAL: Validate that supplier matches PO header supplier
          if (formData.supplier_id && item.po?.supplier_id && formData.supplier_id !== item.po.supplier_id) {
            toast.error('El proveedor seleccionado no coincide con el proveedor del PO. Seleccione un PO que corresponda a este proveedor.')
            setLoading(false)
            return
          }
          
          if (scaleKg > (Number(item.remainingKg) || 0) + 1e-6) {
            toast.error('La cantidad excede el saldo disponible del PO')
            setLoading(false)
            return
          }
          // Apply PO linkage; cantidad siempre en kg para inventario (m³ se deriva en servidor)
          requestBody.po_item_id = selectedPoItemId
          requestBody.po_id = item?.po?.id
          if (item.uom === 'm3') {
            requestBody.received_uom = 'kg'
            requestBody.received_qty_entered = scaleKg
          } else {
            requestBody.received_uom = receivedUom
            requestBody.received_qty_entered = receivedQtyEntered || scaleKg
          }
        }
      }
      
      // Handle fleet PO linkage
      if (selectedFulfillmentAlertId) {
        requestBody.alert_id = selectedFulfillmentAlertId
      }

      if (!isDosificador && selectedFleetPoItemId) {
        const fleetItem = fleetPoItems.find(it => it.id === selectedFleetPoItemId)
        if (fleetItem) {
          // Validate that fleet PO's material_supplier_id matches selected material supplier
          if (formData.supplier_id && fleetItem.material_supplier_id && formData.supplier_id !== fleetItem.material_supplier_id) {
            toast.error('El proveedor de material no coincide con el proveedor del PO de flota. Seleccione un PO de flota que corresponda a este proveedor.')
            setLoading(false)
            return
          }

          const fleetIsTons = fleetItem.uom === 'tons'
          let fleetQtyForPayload = fleetQtyEntered

          if (fleetIsTons) {
            const capKg =
              Number(fleetItem.remainingKg ?? 0) ||
              (Number(fleetItem.qty_remaining) || 0) * KG_PER_METRIC_TON
            if (scaleKg > capKg + 1e-6) {
              toast.error(
                `El peso en báscula excede el saldo del flete (${capKg.toLocaleString('es-MX')} kg restantes, OC en toneladas)`
              )
              setLoading(false)
              return
            }
            fleetQtyForPayload = kgToMetricTons(scaleKg)
            if (!(fleetQtyForPayload > 0)) {
              toast.error('Indique el peso en báscula (kg) para registrar las toneladas del flete')
              setLoading(false)
              return
            }
          } else {
            if (!fleetQtyEntered || fleetQtyEntered <= 0) {
              toast.error('Ingrese cantidad del servicio de flota')
              setLoading(false)
              return
            }
            const remaining = Number(fleetItem.qty_remaining) || 0
            if (fleetQtyEntered > remaining + 1e-6) {
              toast.error(`La cantidad excede el saldo disponible del PO de flota (${remaining.toLocaleString('es-MX')} ${fleetItem.uom})`)
              setLoading(false)
              return
            }
          }

          requestBody.fleet_po_id = fleetItem.po?.id
          requestBody.fleet_po_item_id = selectedFleetPoItemId
          requestBody.fleet_qty_entered = fleetQtyForPayload
          requestBody.fleet_uom = fleetItem.uom
        }
      }
      
      const response = await fetch('/api/inventory/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.resolved_alert_number) {
          setEntrySuccessInfo({ alertNumber: data.resolved_alert_number })
          toast.success(`Entrada registrada. Solicitud ${data.resolved_alert_number} cerrada.`)
        } else {
          setEntrySuccessInfo(null)
          toast.success('Entrada registrada correctamente')
        }

        // Upload pending documents
        if (data.entry_id && pendingFiles.length > 0) {
          await uploadDocuments(data.entry_id)
          toast.success(`${pendingFiles.length} archivo(s) subido(s) correctamente`)
          
          // Fetch existing documents to show them
          await fetchExistingDocuments(data.entry_id)
        }
        
        // Reset form
        setFormData({
          material_id: '',
          quantity_received: 0,
          supplier_id: '',
          supplier_invoice: '',
          fleet_supplier_id: '',
          fleet_invoice: '',
          notes: '',
          entry_date: new Date().toISOString().split('T')[0]
        })
        setCurrentInventory(null)
        setPendingFiles([]) // Clear pending files after successful upload
        setSelectedPoItemId('')
        setSelectedFleetPoItemId('')
        setFleetQtyEntered(0)
        setReceivedQtyEntered(0)
        setReceivedUom('kg')
        setVolumetricWeight(undefined)
        setAutoFilledFromPO({
          material: false,
          supplier: false,
          uom: false,
          volumetricWeight: false
        })
        setFulfillmentAlerts([])
        setSelectedFulfillmentAlertId('')
        supplierAutoFromPoRef.current = null
        setDosificadorReceiptContext(null)
        setDosificadorSupplierOverride(false)

        onSuccess?.()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al registrar la entrada')
      }
    } catch (error) {
      console.error('Error creating entry:', error)
      toast.error(error instanceof Error ? error.message : 'Error al registrar la entrada')
    } finally {
      setLoading(false)
    }
  }

  // Show warning if no plant is selected
  if (!currentPlant?.id) {
    return (
      <div className="space-y-4 p-2">
        <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-900 font-medium">Seleccione una planta</p>
            <p className="text-sm text-amber-800 mt-1">
              Use el selector de planta en la barra superior. Si no tiene planta asignada, contacte al administrador.
            </p>
          </div>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-stone-500 font-mono">
            Debug: profile.plant_id={profile?.plant_id ?? 'null'}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6 relative', isDosificador && 'pb-28 md:pb-6')}>
      {entrySuccessInfo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-emerald-950">Entrada registrada</p>
              <p className="text-sm text-emerald-900 mt-0.5">
                Solicitud{' '}
                <span className="font-mono font-semibold">{entrySuccessInfo.alertNumber}</span> cerrada.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-950" asChild>
              <Link href="/production-control/alerts">Ver alertas</Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEntrySuccessInfo(null)}>
              Cerrar aviso
            </Button>
          </div>
        </div>
      )}

      {searchParams.get('alert_id') && selectedFulfillmentAlertId && selectedFulfillmentAlert && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
          Registrando entrada para solicitud{' '}
          <span className="font-mono font-semibold">{selectedFulfillmentAlert.alert_number}</span>
        </div>
      )}

      {isDosificador && selectedFulfillmentAlert?.needs_fleet && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 flex items-start gap-2">
          <Truck className="h-4 w-4 shrink-0 mt-0.5 text-amber-800" />
          <div className="space-y-2">
            <p className="font-medium leading-snug">
              En esta solicitud suele haber <strong>camión o fletera aparte</strong> del proveedor del material.
            </p>
            <p className="text-xs text-amber-900/95 leading-relaxed">
              En báscula: si quien entrega el camión te dio <strong>otra remisión o guía</strong> (no es la misma que la
              mercancía), o la unidad es de una línea de transporte,               captura esos datos en la sección <strong>«Transporte»</strong> más adelante: quién transportó y el folio del
              papel del <strong>viaje</strong>.
            </p>
            {dosificadorFleetIncomplete && (
              <p className="text-xs font-medium text-amber-950 border-t border-amber-200/80 pt-2 mt-1">
                Aún faltan transportista o remisión del flete — revísalo antes de guardar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Material Selection */}
      <Card className="border-stone-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Entrada rápida
          </CardTitle>
          <CardDescription>
            {isDosificador ? (
              <>
                {currentPlant.name} <span className="font-mono text-stone-500">({currentPlant.code})</span> — registre{' '}
                <strong>esta</strong> recepción contra la solicitud correcta; la OC muestra material y proveedor y el
                avance acumulado (varias entradas pueden aplicar).
              </>
            ) : (
              <>
                {currentPlant.name} ({currentPlant.code}) — material y cantidad primero; PO y flota son opcionales.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDosificador && (
            <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
              <Label htmlFor="entry_date" className="text-stone-900">
                Fecha de entrada (recepción física)
              </Label>
              <Input
                id="entry_date"
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, entry_date: e.target.value }))}
                className="bg-white"
              />
              <p className="text-xs text-stone-600">
                Día al que corresponde esta recepción en planta. La hora se registra al guardar (no confundir con la hora
                de subir evidencia).
              </p>
            </div>
          )}
          {!isDosificador ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="material_id">Material *</Label>
                {autoFilledFromPO.material && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Desde PO
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <MaterialSelect
                  value={formData.material_id}
                  onChange={handleMaterialChange}
                  required
                  plantId={currentPlant?.id || profile?.plant_id || undefined}
                  supplierId={formData.supplier_id || undefined}
                />
                <p className="text-xs text-stone-500">
                  {autoFilledFromPO.material
                    ? 'Material seleccionado automáticamente desde el PO'
                    : 'Seleccione un material de la lista disponible para esta planta'}
                </p>
              </div>
            </div>

            {/* Quantity Input - adapts based on PO selection */}
            <div className="space-y-2">
              {selectedPoItemId ? (
                (() => {
                  const it = poItems.find(p => p.id === selectedPoItemId)
                  const isM3 = it && !it.is_service && it.uom === 'm3'
                  const isL = it && !it.is_service && it.uom === 'l'
                  const volW =
                    Number(it?.volumetric_weight_kg_per_m3) ||
                    Number((it?.material as { bulk_density_kg_per_m3?: number } | undefined)?.bulk_density_kg_per_m3) ||
                    0
                  const previewM3 =
                    isM3 && volW > 0 && receivedQtyEntered > 0 ? receivedQtyEntered / volW : null
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <Label>
                          {isM3 ? 'Peso báscula (kg) *' : isL ? 'Volumen (L) *' : 'Cantidad (kg) *'}
                        </Label>
                        {autoFilledFromPO.uom && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {isM3 ? 'OC en m³ · entrada en kg' : 'UoM desde PO'}
                          </Badge>
                        )}
                      </div>
                      {!isM3 && (
                        <div className="flex gap-2">
                          <select
                            className="border border-stone-300 rounded-md bg-white px-3 py-2 text-sm"
                            value={isL ? 'l' : 'kg'}
                            onChange={(e) => {
                              setReceivedUom(e.target.value as 'kg' | 'l' | 'm3')
                              if (autoFilledFromPO.uom) {
                                setAutoFilledFromPO(prev => ({ ...prev, uom: false }))
                              }
                            }}
                          >
                            <option value="kg">kg</option>
                            <option value="l">l</option>
                          </select>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={receivedQtyEntered || ''}
                            onChange={(e) => setReceivedQtyEntered(parseFloat(e.target.value) || 0)}
                            required
                            className={receivedQtyEntered > 0 ? 'bg-stone-50' : ''}
                          />
                        </div>
                      )}
                      {isM3 && (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={receivedQtyEntered || ''}
                            onChange={(e) => setReceivedQtyEntered(parseFloat(e.target.value) || 0)}
                            required
                            className={receivedQtyEntered > 0 ? 'bg-stone-50' : ''}
                          />
                          {volW > 0 && (
                            <p className="text-xs text-stone-600">
                              Densidad acordada en OC:{' '}
                              <span className="font-medium tabular-nums">{volW.toLocaleString('es-MX')} kg/m³</span>
                              {previewM3 != null && (
                                <>
                                  {' '}
                                  → ≈{' '}
                                  <span className="font-medium tabular-nums">
                                    {previewM3.toLocaleString('es-MX', { maximumFractionDigits: 3 })} m³
                                  </span>{' '}
                                  contra la línea (comercial)
                                </>
                              )}
                            </p>
                          )}
                          {volW <= 0 && (
                            <p className="text-xs text-amber-700">
                              La línea de OC no tiene peso volumétrico (kg/m³). Complételo en la OC antes de recepcionar.
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-stone-500">
                        {receivedQtyEntered > 0 &&
                        it &&
                        (isM3
                          ? Number(it.remainingKg) > 0 && receivedQtyEntered <= Number(it.remainingKg)
                          : it.qty_remaining_native !== undefined && receivedQtyEntered <= it.qty_remaining_native)
                          ? `✓ Sugerido desde PO. Saldo: ${isM3 ? `${Number(it.remainingKg).toLocaleString('es-MX')} kg` : `${Number(it.qty_remaining_native).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${isL ? 'L' : 'kg'}`}`
                          : 'Se validará contra el saldo del PO (en kg para líneas m³).'}
                      </p>
                    </>
                  )
                })()
              ) : (
                <>
                  <Label htmlFor="quantity_received" className="text-sm sm:text-base">
                    Cantidad Recibida (kg) *
                  </Label>
                  <Input
                    id="quantity_received"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity_received || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      quantity_received: parseFloat(e.target.value) || 0 
                    }))}
                    className="h-12"
                    required
                  />
                  <p className="text-xs text-stone-500">Cantidad en kilogramos</p>
                </>
              )}
            </div>
          </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="material_id">Material *</Label>
              </div>
              <div className="space-y-1">
                <MaterialSelect
                  value={formData.material_id}
                  onChange={handleMaterialChange}
                  required
                  plantId={currentPlant?.id || profile?.plant_id || undefined}
                  supplierId={formData.supplier_id || undefined}
                />
                <p className="text-xs text-stone-500">
                  Seleccione material y la solicitud que corresponde a esta recepción. La cantidad es la de <strong>esta</strong>{' '}
                  entrega (remisión/báscula); la OC sirve para ver material y proveedor y el avance acumulado, no para
                  “cerrar” la orden en un solo movimiento.
                </p>
              </div>
            </div>
          )}

          {!isDosificador && formData.material_id && (
            <div className="rounded-lg border border-stone-200 bg-[#faf9f7] p-4 space-y-3">
              <Label className="text-sm font-semibold text-stone-900">Vincular a alerta (opcional)</Label>
              <p className="text-xs text-stone-500">
                Si esta recepción cierra una solicitud coordinada, selecciónela para actualizar el flujo.
              </p>
              {fulfillmentAlertsLoading ? (
                <p className="text-xs text-stone-500">Buscando alertas activas…</p>
              ) : fulfillmentAlerts.length > 0 ? (
                <div className="space-y-2">
                  <label
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                      selectedFulfillmentAlertId === ''
                        ? 'border-sky-600 bg-white ring-2 ring-sky-600/25'
                        : 'border-stone-200 bg-white hover:bg-stone-50/80'
                    )}
                  >
                    <input
                      type="radio"
                      name="admin-fulfillment-alert"
                      className="mt-1"
                      checked={selectedFulfillmentAlertId === ''}
                      onChange={() => setSelectedFulfillmentAlertId('')}
                    />
                    <div>
                      <span className="font-medium text-stone-900">Sin vincular a una alerta</span>
                      <p className="text-xs text-stone-500 mt-0.5">Recepción general o reabastecimiento.</p>
                    </div>
                  </label>
                  {fulfillmentAlerts.map((a) => (
                    <label
                      key={a.id}
                      className={cn(
                        'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                        selectedFulfillmentAlertId === a.id
                          ? 'border-sky-600 bg-white ring-2 ring-sky-600/25'
                          : 'border-stone-200 bg-white hover:bg-stone-50/80'
                      )}
                    >
                      <input
                        type="radio"
                        name="admin-fulfillment-alert"
                        className="mt-1"
                        checked={selectedFulfillmentAlertId === a.id}
                        onChange={() => setSelectedFulfillmentAlertId(a.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-stone-600">{a.alert_number}</span>
                          <Badge variant="outline" className="text-[10px] h-5 border-stone-200">
                            {ALERT_STATUS_SHORT[a.status] ?? a.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-stone-800 mt-0.5">
                          {(a.material as { material_name?: string })?.material_name ?? 'Material'}
                        </p>
                        <p className="text-xs text-stone-500 mt-1 tabular-nums">
                          {a.scheduled_delivery_date
                            ? `Entrega programada: ${a.scheduled_delivery_date}`
                            : `Creada ${format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500">No hay alertas elegibles para este material en esta planta.</p>
              )}
            </div>
          )}

          {isDosificador && formData.material_id && (
            <div className="rounded-lg border border-stone-200 bg-[#faf9f7] p-4 space-y-3">
              <Label className="text-sm font-semibold text-stone-900">Esta entrada corresponde a:</Label>
              {fulfillmentAlertsLoading ? (
                <p className="text-xs text-stone-500">Buscando solicitudes activas…</p>
              ) : fulfillmentAlerts.length > 0 ? (
                <div className="space-y-2">
                  <label
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                      selectedFulfillmentAlertId === ''
                        ? 'border-sky-600 bg-white ring-2 ring-sky-600/25'
                        : 'border-stone-200 bg-white hover:bg-stone-50/80'
                    )}
                  >
                    <input
                      type="radio"
                      name="fulfillment-alert"
                      className="mt-1"
                      checked={selectedFulfillmentAlertId === ''}
                      onChange={() => setSelectedFulfillmentAlertId('')}
                    />
                    <div>
                      <span className="font-medium text-stone-900">Sin solicitud previa</span>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Recepción no ligada a una alerta (reabastecimiento u otro motivo).
                      </p>
                    </div>
                  </label>
                  {fulfillmentAlerts.map((a) => {
                    const sched = a.scheduled_delivery_date
                    const lp = normalizeAlertLinkedPo(a)
                    const matName = (a.material as { material_name?: string })?.material_name ?? 'Material'
                    let schedIsToday = false
                    if (sched) {
                      try {
                        const d = parseISO(sched.length > 10 ? sched : `${sched}T12:00:00`)
                        schedIsToday = isToday(d)
                      } catch {
                        schedIsToday = false
                      }
                    }
                    return (
                      <label
                        key={a.id}
                        className={cn(
                          'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                          selectedFulfillmentAlertId === a.id
                            ? 'border-sky-600 bg-white ring-2 ring-sky-600/25'
                            : 'border-stone-200 bg-white hover:bg-stone-50/80',
                          schedIsToday && 'border-emerald-500/80 bg-emerald-50/40'
                        )}
                      >
                        <input
                          type="radio"
                          name="fulfillment-alert"
                          className="mt-1"
                          checked={selectedFulfillmentAlertId === a.id}
                          onChange={() => setSelectedFulfillmentAlertId(a.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-stone-600">{a.alert_number}</span>
                            <Badge variant="outline" className="text-[10px] h-5 border-stone-200">
                              {ALERT_STATUS_SHORT[a.status] ?? a.status.replace(/_/g, ' ')}
                            </Badge>
                            {a.needs_fleet && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-5 gap-0.5 border-amber-300 bg-amber-50/90 text-amber-950"
                              >
                                <Truck className="h-3 w-3" />
                                Flete
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-stone-900 mt-1">{matName}</p>
                          {a.physical_count_kg != null && a.physical_count_kg > 0 && (
                            <p className="text-xs text-stone-700 mt-0.5">
                              Conteo / necesidad reportada:{' '}
                              <span className="font-mono tabular-nums">
                                {Number(a.physical_count_kg).toLocaleString('es-MX', { maximumFractionDigits: 2 })} kg
                              </span>
                            </p>
                          )}
                          {lp ? (
                            <p className="text-xs text-stone-700 mt-1">
                              OC:{' '}
                              <span className="font-mono">
                                {lp.po_number || poRefFromId(lp.id)}
                              </span>
                              {lp.supplier?.name ? (
                                <>
                                  {' '}
                                  · Proveedor: <span className="font-medium">{lp.supplier.name}</span>
                                </>
                              ) : null}
                            </p>
                          ) : a.existing_po_id ? (
                            <p className="text-xs text-stone-700 mt-1">
                              OC vinculada (ref.{' '}
                              <span className="font-mono">{poRefFromId(a.existing_po_id)}</span>
                              ). Proveedor y partidas: al seleccionar esta solicitud o en «Verificar entrega».
                            </p>
                          ) : (
                            <p className="text-xs text-amber-800 mt-1">
                              Sin orden de compra en esta solicitud. Compras debe vincular la OC antes de cerrar con esta
                              entrada, o use «Sin solicitud previa» si la mercancía no corresponde a una solicitud
                              coordinada.
                            </p>
                          )}
                          {sched ? (
                            <div className="text-sm text-stone-800 mt-1 flex items-center gap-1.5 flex-wrap">
                              <Calendar className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                              <span className="font-medium">
                                Entrega programada: {format(parseISO(sched.length > 10 ? sched : `${sched}T12:00:00`), 'dd/MM/yyyy')}
                              </span>
                              {schedIsToday && (
                                <Badge className="text-[10px] h-5 bg-emerald-700 text-white">Hoy</Badge>
                              )}
                            </div>
                          ) : null}
                          <p className="text-xs text-stone-500 mt-1 tabular-nums">
                            Creada {format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}
                            {a.validation_notes
                              ? ` · ${a.validation_notes.slice(0, 96)}${a.validation_notes.length > 96 ? '…' : ''}`
                              : null}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-stone-200 bg-stone-50/80 px-3 py-2 text-sm text-stone-700">
                  <p>No hay solicitudes activas para este material. Esta entrada se registrará sin vincular a una solicitud.</p>
                  <p className="mt-2">
                    <Link href="/production-control/alerts" className="text-sky-800 font-medium underline text-sm">
                      Crear solicitud
                    </Link>
                  </p>
                </div>
              )}
            </div>
          )}

          {isDosificador && formData.material_id && (
            <div className="space-y-4">
              {selectedAlertExistingPoId && dosificadorReceiptLoading && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <ClipboardList className="h-5 w-5 text-sky-800 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-semibold text-stone-900">Orden de compra</p>
                      <p className="text-base font-mono font-semibold text-stone-900">
                        {linkedPoLabel(selectedLinkedPo, selectedAlertExistingPoId)}
                      </p>
                      {selectedLinkedPo?.supplier?.name && (
                        <p className="text-sm text-stone-800">
                          <span className="text-stone-500">Proveedor: </span>
                          <strong>{selectedLinkedPo.supplier.name}</strong>
                        </p>
                      )}
                      {(selectedLinkedPo?.status || selectedLinkedPo?.po_date) && (
                        <p className="text-xs text-stone-600">
                          {selectedLinkedPo?.status ? <>Estado: {selectedLinkedPo.status}</> : null}
                          {selectedLinkedPo?.status && selectedLinkedPo?.po_date ? ' · ' : null}
                          {selectedLinkedPo?.po_date
                            ? `Fecha OC ${selectedLinkedPo.po_date}`
                            : null}
                        </p>
                      )}
                      {selectedLinkedPo?.notes?.trim() && (
                        <p className="text-xs text-stone-600 border-t border-sky-200/80 pt-2 mt-1 line-clamp-3">
                          {selectedLinkedPo.notes.trim().slice(0, 280)}
                          {selectedLinkedPo.notes.trim().length > 280 ? '…' : ''}
                        </p>
                      )}
                      <p className="text-xs text-stone-500 flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-sky-500 animate-pulse shrink-0" />
                        Cargando material, proveedor y avance en la OC (pedido / recibido / por recibir). Sin precios.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!dosificadorReceiptLoading && dosificadorReceiptContext && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <ClipboardList className="h-5 w-5 text-sky-800 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-semibold text-stone-900">Material y proveedor (orden de compra)</p>
                      <p className="text-base sm:text-lg font-mono font-semibold text-stone-900 tracking-tight">
                        {dosificadorReceiptContext.po.po_number?.trim() ||
                          `Ref. ${dosificadorReceiptContext.po.display_ref}`}
                      </p>
                      <p className="text-xs text-stone-600">
                        Ref. sistema {dosificadorReceiptContext.po.display_ref} · Estado:{' '}
                        {dosificadorReceiptContext.po.status}
                        {dosificadorReceiptContext.po.po_date
                          ? ` · Fecha OC ${dosificadorReceiptContext.po.po_date}`
                          : ''}
                      </p>
                      {dosificadorReceiptContext.po.supplier && (
                        <p className="text-sm text-stone-800">
                          <span className="text-stone-500">Proveedor en OC: </span>
                          <strong>{dosificadorReceiptContext.po.supplier.name}</strong>
                          {dosificadorReceiptContext.po.supplier.provider_letter
                            ? ` · Letra ${dosificadorReceiptContext.po.supplier.provider_letter}`
                            : ''}
                          {dosificadorReceiptContext.po.supplier.provider_number != null
                            ? ` · #${dosificadorReceiptContext.po.supplier.provider_number}`
                            : ''}
                        </p>
                      )}
                      {dosificadorReceiptContext.po.notes?.trim() && (
                        <div className="rounded-md border border-stone-200 bg-white/80 px-3 py-2 text-xs text-stone-700">
                          <span className="font-medium text-stone-500">Notas en OC: </span>
                          {dosificadorReceiptContext.po.notes.trim().slice(0, 500)}
                          {dosificadorReceiptContext.po.notes.trim().length > 500 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  {dosificadorReceiptContext.items.length > 0 ? (
                    <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                            <th className="p-2 font-medium">Material</th>
                            <th className="p-2 font-medium">UoM</th>
                            <th className="p-2 font-medium text-right">Pedido</th>
                            <th className="p-2 font-medium text-right">Recibido</th>
                            <th className="p-2 font-medium text-right">Por recibir</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dosificadorReceiptContext.items.map((row) => (
                            <tr key={row.id} className="border-b border-stone-100 last:border-0">
                              <td className="p-2 text-stone-900 max-w-[200px]">{row.material_name}</td>
                              <td className="p-2 font-mono text-stone-700">{row.uom}</td>
                              <td className="p-2 text-right font-mono tabular-nums">
                                {row.qty_ordered.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 text-right font-mono tabular-nums">
                                {row.qty_received.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 text-right font-mono tabular-nums font-medium text-stone-900">
                                {row.qty_remaining.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
                      <AlertCircle className="inline h-3.5 w-3.5 mr-1 align-text-bottom" />
                      No hay partida de este material en la OC. Confirme el material o contacte a compras.
                    </div>
                  )}
                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    La OC se surte con varias recepciones: la tabla muestra avance acumulado. Verifique material y
                    proveedor; la cantidad de <strong>esta</strong> recepción la registra abajo y queda vinculada a la
                    solicitud. Sin precios.
                  </p>
                </div>
              )}

              {selectedAlertExistingPoId &&
                !dosificadorReceiptLoading &&
                !dosificadorReceiptContext && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-sm font-semibold text-amber-950">
                          No se pudieron cargar las partidas de la orden de compra
                        </p>
                        <p className="text-base font-mono font-medium text-stone-900">
                          {linkedPoLabel(selectedLinkedPo, selectedAlertExistingPoId)}
                        </p>
                        {selectedLinkedPo?.supplier?.name && (
                          <p className="text-sm text-stone-800">
                            <span className="text-stone-500">Proveedor: </span>
                            <strong>{selectedLinkedPo.supplier.name}</strong>
                          </p>
                        )}
                        {(selectedLinkedPo?.status || selectedLinkedPo?.po_date) && (
                          <p className="text-xs text-stone-700">
                            {selectedLinkedPo?.status ? <>Estado: {selectedLinkedPo.status}</> : null}
                            {selectedLinkedPo?.status && selectedLinkedPo?.po_date ? ' · ' : null}
                            {selectedLinkedPo?.po_date ? `Fecha OC ${selectedLinkedPo.po_date}` : null}
                          </p>
                        )}
                        {selectedLinkedPo?.notes?.trim() && (
                          <p className="text-xs text-stone-700 border-t border-amber-200/80 pt-2 line-clamp-4">
                            <span className="font-medium">Notas en OC: </span>
                            {selectedLinkedPo.notes.trim().slice(0, 400)}
                            {selectedLinkedPo.notes.trim().length > 400 ? '…' : ''}
                          </p>
                        )}
                        <p className="text-xs text-amber-950/90">
                          Datos tomados de la solicitud. Reintente para ver material, proveedor y avance acumulado en la
                          OC.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-amber-300 text-amber-950"
                          onClick={() => setDosificadorReceiptRefreshToken((n) => n + 1)}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Reintentar carga de la OC
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

              {!!selectedFulfillmentAlertId &&
                !selectedAlertExistingPoId &&
                !dosificadorReceiptLoading && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                    <AlertCircle className="inline h-3.5 w-3.5 mr-1 align-text-bottom" />
                    Esta solicitud aún no tiene OC vinculada. Indique el proveedor según la entrega física o confirme con
                    administración.
                  </div>
                )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="quantity_received_dos" className="text-base font-semibold">
                    Cantidad de esta recepción (kg) *
                  </Label>
                  {dosificadorPoLineForMaterial && dosificadorPoLineForMaterial.uom === 'kg' && (
                    <Badge variant="outline" className="text-[10px] border-sky-300 bg-white text-sky-950">
                      Saldo por recibir en OC:{' '}
                      {dosificadorPoLineForMaterial.qty_remaining.toLocaleString('es-MX', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      kg (referencia)
                    </Badge>
                  )}
                  {dosificadorPoLineForMaterial && dosificadorPoLineForMaterial.uom === 'm3' && (
                    <Badge variant="outline" className="text-[10px] border-sky-300 bg-white text-sky-950">
                      Saldo por recibir (báscula):{' '}
                      {(dosificadorPoLineForMaterial.remaining_kg ?? 0).toLocaleString('es-MX', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      kg · OC{' '}
                      {dosificadorPoLineForMaterial.qty_remaining.toLocaleString('es-MX', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      m³
                      {dosificadorPoLineForMaterial.volumetric_weight_kg_per_m3
                        ? ` · ${Number(dosificadorPoLineForMaterial.volumetric_weight_kg_per_m3).toLocaleString('es-MX')} kg/m³`
                        : ''}
                    </Badge>
                  )}
                  {dosificadorPoLineForMaterial &&
                    dosificadorPoLineForMaterial.uom !== 'kg' &&
                    dosificadorPoLineForMaterial.uom !== 'm3' &&
                    dosificadorPoLineForMaterial.qty_remaining > 0 && (
                      <span className="text-xs text-stone-600">
                        Saldo por recibir en OC:{' '}
                        {dosificadorPoLineForMaterial.qty_remaining.toLocaleString('es-MX', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        {dosificadorPoLineForMaterial.uom} (referencia; convierta a kg)
                      </span>
                    )}
                </div>
                <Input
                  id="quantity_received_dos"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantity_received || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      quantity_received: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="h-16 text-2xl font-semibold text-center"
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-stone-500 text-center">
                  Peso neto de <strong>esta</strong> entrega (kg), según báscula o remisión. La entrada se asocia a la
                  solicitud elegida. Las recepciones suelen ser parciales frente al total de la OC; no comparamos con el
                  saldo de la orden.
                </p>
              </div>
            </div>
          )}

          {!isDosificador && (
          <Collapsible open={advancedPoOpen} onOpenChange={setAdvancedPoOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between border-stone-300 text-stone-800 hover:bg-stone-50"
              >
                <span className="text-sm font-medium">Vincular PO, unidades y detalle del proveedor</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', advancedPoOpen && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Orden de Compra (PO)</Label>
              <select
                className="border border-stone-300 rounded-md bg-white px-3 py-2 text-sm w-full"
                value={selectedPoItemId}
                onChange={(e) => {
                  setSelectedPoItemId(e.target.value)
                  if (!e.target.value) {
                    // Clear auto-fill flags when PO is cleared
                    setAutoFilledFromPO({
                      material: false,
                      supplier: false,
                      uom: false,
                      volumetricWeight: false
                    })
                  }
                }}
              >
                <option value="">Sin PO</option>
                {poItems.length === 0 && formData.material_id && formData.supplier_id ? (
                  <option disabled>No hay POs disponibles para {formData.material_id ? 'este material' : ''} de {formData.supplier_id ? 'este proveedor' : ''}</option>
                ) : (
                  poItems.map((it) => {
                    const supplierName = it.po?.supplier?.name || `#${it.po?.supplier?.provider_number || 'N/A'}`
                    const materialName = it.material?.material_name || 'Material'
                    const uom = it.uom || 'kg'
                    const remaining = it.qty_remaining_native ?? it.remainingKg ?? it.qty_remaining ?? 0
                    const price = Number(it.unit_price || 0).toFixed(2)
                    return (
                      <option key={it.id} value={it.id}>
                        {`PO ${String(it.po?.id || '').slice(0,8)} · ${supplierName} · ${materialName} · ${remaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${uom} · $${price}/${uom}`}
                      </option>
                    )
                  })
                )}
              </select>
              <p className="text-xs text-stone-500">
                {formData.material_id && formData.supplier_id 
                  ? `POs disponibles para ${formData.material_id ? 'este material' : ''} de ${formData.supplier_id ? 'este proveedor' : ''}. Solo se muestran ítems abiertos o parciales con saldo.`
                  : 'Solo se muestran ítems abiertos o parciales con saldo.'}
              </p>
              {formData.material_id && formData.supplier_id && poItems.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No hay POs disponibles para esta combinación material-proveedor. Cree un PO primero.
                </p>
              )}
            </div>

            {selectedPoItemId && (() => {
              const poItem = poItems.find(it => it.id === selectedPoItemId)
              if (!poItem) return null
              
              const supplier = poItem.po?.supplier
              const supplierName = supplier?.name || `Proveedor #${supplier?.provider_number || 'N/A'}`
              const materialName = poItem.material?.material_name || 'Material'
              const uom = poItem.uom || 'kg'
              const remaining = poItem.qty_remaining_native ?? poItem.remainingKg ?? poItem.qty_remaining ?? 0
              const price = Number(poItem.unit_price || 0)
              const poNumber = String(poItem.po?.id || '').slice(0, 8)
              
              return (
                <Card className="bg-gradient-to-br from-stone-50 to-stone-100 border-stone-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4 text-sky-800" />
                        PO #{poNumber}
                      </CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPoItemId('')
                          setAutoFilledFromPO({
                            material: false,
                            supplier: false,
                            uom: false,
                            volumetricWeight: false
                          })
                        }}
                        className="h-7 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cambiar PO
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-stone-600">Proveedor</p>
                        <p className="font-semibold text-stone-900">{supplierName}</p>
                        {supplier?.provider_letter && (
                          <p className="text-xs text-stone-500">Letra: {supplier.provider_letter}</p>
                        )}
                        {formData.supplier_id && formData.supplier_id === poItem.po?.supplier_id ? (
                          <p className="text-xs text-green-600 mt-1">✓ Coincide con proveedor seleccionado</p>
                        ) : formData.supplier_id && formData.supplier_id !== poItem.po?.supplier_id ? (
                          <p className="text-xs text-red-600 mt-1">⚠ No coincide con proveedor seleccionado</p>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs text-stone-600">Material</p>
                        <p className="font-semibold text-stone-900">{materialName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-600">Precio Unitario</p>
                        <p className="font-semibold text-sky-900">
                          ${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{uom}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-600">Cantidad Restante</p>
                        <p className="font-semibold text-green-700">
                          {remaining.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {uom}
                        </p>
                      </div>
                    </div>
                    {poItem.required_by && (
                      <div className="pt-2 border-t border-stone-200">
                        <p className="text-xs text-stone-600">Fecha Requerida</p>
                        <p className="text-sm font-medium text-stone-900">
                          {format(new Date(poItem.required_by), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })()}
          </div>
            </CollapsibleContent>
          </Collapsible>
          )}

          {/* Inventory Calculation - Prominent for DOSIFICADOR */}
          {currentInventory !== null && (
            <div className={cn(
              "p-4 sm:p-6 rounded-lg border-2",
              isDosificador 
                ? "bg-stone-50 border-stone-200" 
                : "bg-stone-50 border-stone-200"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Calculator className={cn("text-sky-800", isDosificador ? "h-5 w-5" : "h-4 w-4")} />
                <span className={cn(
                  "font-medium text-stone-900",
                  isDosificador ? "text-base" : "text-sm"
                )}>
                  Cálculo de Inventario
                </span>
              </div>
              <div className={cn(
                "grid gap-4",
                isDosificador ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-3",
                isDosificador ? "text-base" : "text-sm"
              )}>
                <div className={isDosificador ? "text-center sm:text-left" : ""}>
                  <p className={cn("text-stone-600", isDosificador ? "text-sm mb-1" : "")}>
                    Inventario Actual
                  </p>
                  <p className={cn(
                    "font-semibold text-stone-900",
                    isDosificador ? "text-xl" : ""
                  )}>
                    {currentInventory.toLocaleString('es-MX', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} kg
                  </p>
                </div>
                <div className={isDosificador ? "text-center sm:text-left" : ""}>
                  <p className={cn("text-stone-600", isDosificador ? "text-sm mb-1" : "")}>
                    Cantidad a Agregar
                  </p>
                  <p className={cn(
                    "font-semibold text-green-600",
                    isDosificador ? "text-xl" : ""
                  )}>
                    +{formData.quantity_received.toLocaleString('es-MX', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} kg
                  </p>
                </div>
                <div className={isDosificador ? "text-center sm:text-left" : ""}>
                  <p className={cn("text-stone-600", isDosificador ? "text-sm mb-1" : "")}>
                    Inventario Final
                  </p>
                  <p className={cn(
                    "font-semibold text-stone-900",
                    isDosificador ? "text-xl" : ""
                  )}>
                    {inventoryAfter?.toLocaleString('es-MX', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} kg
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isDosificador && (
            <div className="space-y-2">
              <Label htmlFor="entry_date">Fecha de Entrada</Label>
              <Input
                id="entry_date"
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, entry_date: e.target.value }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Information - Simplified for DOSIFICADOR */}
      {(!isDosificador || formData.material_id) && (
        <Card className="border-stone-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Información del Proveedor
            </CardTitle>
            <CardDescription>
              {isDosificador
                ? 'Remisión del proveedor del material. Si hubo camión de otra línea, también el bloque Transporte más abajo. “Corregir” solo si quien entregó no coincide con la OC.'
                : 'Datos del proveedor y documentación'}
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="supplier_id">Proveedor de Material</Label>
                {autoFilledFromPO.supplier && !isDosificador && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Desde PO
                  </Badge>
                )}
                {isDosificador && selectedAlertExistingPoId && !dosificadorSupplierOverride && (
                  <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-950 border-sky-200">
                    Según OC
                  </Badge>
                )}
              </div>
              {!isDosificador ? (
                <>
                  <SupplierSelect
                    value={formData.supplier_id || ''}
                    onChange={(value: string) => {
                      if (autoFilledFromPO.supplier && value !== formData.supplier_id) {
                        setAutoFilledFromPO((prev) => ({ ...prev, supplier: false }))
                        if (selectedPoItemId) {
                          const poItem = poItems.find((it) => it.id === selectedPoItemId)
                          if (poItem && poItem.po?.supplier_id !== value) {
                            toast.warning(
                              'El proveedor seleccionado no coincide con el PO. Verifique que sea correcto.'
                            )
                          }
                        }
                      }
                      setFormData((prev) => ({ ...prev, supplier_id: value }))
                    }}
                    plantId={currentPlant?.id || profile?.plant_id || undefined}
                  />
                  {autoFilledFromPO.supplier && (
                    <p className="text-xs text-stone-500">Proveedor seleccionado automáticamente desde el PO</p>
                  )}
                </>
              ) : !selectedFulfillmentAlertId || !selectedAlertExistingPoId ? (
                <>
                  <SupplierSelect
                    value={formData.supplier_id || ''}
                    onChange={(value: string) => {
                      if (autoFilledFromPO.supplier && value !== formData.supplier_id) {
                        setAutoFilledFromPO((prev) => ({ ...prev, supplier: false }))
                        if (selectedPoItemId) {
                          const poItem = poItems.find((it) => it.id === selectedPoItemId)
                          if (poItem && poItem.po?.supplier_id !== value) {
                            toast.warning(
                              'El proveedor seleccionado no coincide con el PO. Verifique que sea correcto.'
                            )
                          }
                        }
                      }
                      if (dosificadorReceiptContext) {
                        supplierAutoFromPoRef.current = null
                      }
                      setFormData((prev) => ({ ...prev, supplier_id: value }))
                    }}
                    plantId={currentPlant?.id || profile?.plant_id || undefined}
                  />
                  <p className="text-xs text-stone-500">
                    Solo si la solicitud no tiene OC vinculada. Si hay OC, el proveedor se toma de la orden.
                  </p>
                </>
              ) : dosificadorReceiptLoading ? (
                <p className="text-sm text-stone-600">Cargando proveedor desde la orden de compra…</p>
              ) : dosificadorSupplierOverride ? (
                <div className="space-y-2">
                  <SupplierSelect
                    value={formData.supplier_id || ''}
                    onChange={(value: string) => {
                      if (autoFilledFromPO.supplier && value !== formData.supplier_id) {
                        setAutoFilledFromPO((prev) => ({ ...prev, supplier: false }))
                        if (selectedPoItemId) {
                          const poItem = poItems.find((it) => it.id === selectedPoItemId)
                          if (poItem && poItem.po?.supplier_id !== value) {
                            toast.warning(
                              'El proveedor seleccionado no coincide con el PO. Verifique que sea correcto.'
                            )
                          }
                        }
                      }
                      supplierAutoFromPoRef.current = null
                      setFormData((prev) => ({ ...prev, supplier_id: value }))
                    }}
                    plantId={currentPlant?.id || profile?.plant_id || undefined}
                  />
                  <p className="text-xs text-amber-800">
                    Use solo si la entrega no corresponde al proveedor de la OC; avise a su jefe de planta si hay
                    discrepancia.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto py-1.5 text-xs"
                    onClick={() => {
                      setDosificadorSupplierOverride(false)
                      const fromReceipt = dosificadorReceiptContext?.po.supplier_id
                      const fromLinked = selectedFulfillmentAlert
                        ? normalizeAlertLinkedPo(selectedFulfillmentAlert)?.supplier?.id
                        : null
                      const sid = fromReceipt || fromLinked || null
                      if (sid) {
                        supplierAutoFromPoRef.current = sid
                        setFormData((prev) => ({ ...prev, supplier_id: sid }))
                      }
                    }}
                  >
                    Usar proveedor de la OC
                  </Button>
                </div>
              ) : dosificadorReceiptContext ? (
                <div className="space-y-2">
                  <div className="rounded-md border border-stone-200 bg-stone-50/80 px-3 py-2.5 text-sm text-stone-900">
                    {dosificadorReceiptContext.po.supplier?.name ||
                      (formData.supplier_id ? 'Proveedor cargado' : '—')}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 px-0 text-xs text-sky-800 hover:text-sky-950"
                    onClick={() => setDosificadorSupplierOverride(true)}
                  >
                    El proveedor físico no coincide — corregir
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-md border border-stone-200 bg-stone-50/80 px-3 py-2.5 text-sm text-stone-900">
                    {(selectedFulfillmentAlert
                      ? normalizeAlertLinkedPo(selectedFulfillmentAlert)?.supplier?.name?.trim()
                      : null) || `Proveedor según OC ${poRefFromId(selectedAlertExistingPoId)}`}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 px-0 text-xs text-sky-800 hover:text-sky-950"
                    onClick={() => setDosificadorSupplierOverride(true)}
                  >
                    El proveedor físico no coincide — corregir
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier_invoice">
                Número de remisión{isDosificador ? ' *' : ''}
              </Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                <Input
                  id="supplier_invoice"
                  value={formData.supplier_invoice || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_invoice: e.target.value }))}
                  className="pl-10"
                  placeholder="Ej: REM-2024-001"
                  required={isDosificador}
                  aria-required={isDosificador}
                />
              </div>
              {isDosificador && (
                <p className="text-xs text-stone-600">Obligatorio para vincular la recepción con el documento del proveedor.</p>
              )}
            </div>
          </div>

          {isDosificador && (
            <div className="flex gap-2.5 rounded-lg border border-stone-200 bg-[#f8f7f5] px-3 py-2.5 text-xs text-stone-800">
              <Truck className="h-4 w-4 shrink-0 text-stone-500 mt-0.5" aria-hidden />
              <p className="leading-relaxed">
                <span className="font-semibold text-stone-900">Tip rápido:</span> si el material vino en{' '}
                <strong>camión de una fletera</strong> o te dieron <strong>otra remisión</strong> que no es la del
                proveedor del material, despliega <strong>Transporte</strong> abajo y captura transportista + folio del
                viaje. Si todo vino con el mismo proveedor y un solo papel, no hace falta.
              </p>
            </div>
          )}
          
          <Collapsible open={fleetSectionOpen} onOpenChange={setFleetSectionOpen} className="pt-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  'w-full justify-between px-0 text-stone-700 hover:bg-transparent hover:text-stone-900',
                  dosificadorFleetUrgentHint &&
                    'rounded-md ring-2 ring-amber-300/70 ring-offset-2 ring-offset-[#fafaf9] px-1 -mx-1'
                )}
              >
                <span className="text-sm font-medium flex items-center gap-2 flex-wrap text-left">
                  {isDosificador ? (
                    <>
                      Transporte (camión / fletera)
                      {dosificadorFleetUrgentHint ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 border-amber-400 text-amber-950 bg-amber-50 font-medium"
                        >
                          Falta anotar
                        </Badge>
                      ) : selectedFulfillmentAlert?.needs_fleet ? (
                        <Badge variant="outline" className="text-[10px] h-5 border-stone-300 text-stone-700 bg-white">
                          Suele aplicar
                        </Badge>
                      ) : (
                        <span className="text-stone-500 font-normal text-xs">solo si hubo fletera u otro folio</span>
                      )}
                    </>
                  ) : (
                    <>
                      Servicio de flota / transporte
                      <span className="text-stone-500 font-normal">(opcional)</span>
                    </>
                  )}
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', fleetSectionOpen && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {isDosificador ? (
                <div className="pt-2 border-t border-stone-200 space-y-4">
                  <div className="rounded-md bg-stone-50/90 px-3 py-2.5 text-xs text-stone-700 space-y-2 leading-relaxed">
                    <p>
                      <span className="font-semibold text-stone-900">¿Qué va aquí?</span> Lo que consta en planta: la{' '}
                      <strong>línea o nombre del transportista</strong> que trajo el camión y el{' '}
                      <strong>número de remisión o guía</strong> del <strong>viaje</strong> (el papel del chofer o de la
                      fletera).
                    </p>
                    <p className="text-stone-600">
                      No es la orden de compra de oficina: es lo que ves en la báscula cuando recibes. Si es el mismo
                      proveedor del material y un solo documento, deja esto vacío.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fleet_supplier_id_dos">¿Quién transportó? (transportista / fletera)</Label>
                      <SupplierSelect
                        value={formData.fleet_supplier_id || ''}
                        onChange={(value: string) => {
                          setFormData((prev) => ({ ...prev, fleet_supplier_id: value }))
                        }}
                        plantId={currentPlant?.id || profile?.plant_id || undefined}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="folio_remision_flete">Folio de remisión o guía del viaje</Label>
                      <div className="relative">
                        <Truck className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                        <Input
                          id="folio_remision_flete"
                          value={formData.fleet_invoice || ''}
                          onChange={(e) => setFormData((prev) => ({ ...prev, fleet_invoice: e.target.value }))}
                          className="pl-10"
                          placeholder="Ej. folio que te entregaron en báscula"
                          maxLength={100}
                        />
                      </div>
                      <p className="text-xs text-stone-500">
                        El del <strong>camión / flete</strong>, no el de la remisión del proveedor del material (arriba).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-stone-200">
                  <p className="text-xs text-stone-600 mb-3">
                    Vincule la recepción a una OC de transporte abierta. Puede elegir primero la OC (se rellena el
                    transportista) o filtrar por proveedor de flota.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.supplier_id ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>OC de flota / transporte (línea de servicio)</Label>
                        <select
                          className="border border-stone-300 rounded-md bg-white px-3 py-2 text-sm w-full"
                          value={selectedFleetPoItemId}
                          onChange={(e) => setSelectedFleetPoItemId(e.target.value)}
                        >
                          <option value="">Sin OC de flota</option>
                          {fleetPoItems.length === 0 ? (
                            <option disabled>No hay líneas de servicio abiertas para este material</option>
                          ) : (
                            fleetPoItems.map((it) => {
                              const materialSupplierName = it.material_supplier?.name || 'Proveedor material'
                              const poNum = it.po?.po_number || String(it.po?.id || '').slice(0, 8)
                              const carrier = it.po?.supplier?.name || 'Transportista'
                              return (
                                <option key={it.id} value={it.id}>
                                  {`OC ${poNum} · ${carrier} · ${it.service_description || 'Servicio'} · p. ${materialSupplierName} · Rest. ${(Number(it.qty_remaining) || 0).toLocaleString('es-MX')} ${it.uom}`}
                                </option>
                              )
                            })
                          )}
                        </select>
                        {fleetPoItems.length === 0 && (
                          <p className="text-xs text-amber-700 mt-1">
                            No hay OC de flota con saldo para el proveedor de material seleccionado
                            {formData.fleet_supplier_id ? ' y el transportista indicado' : ''}. Cree una OC de servicio en
                            compras o ajuste el filtro de transportista.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                        Seleccione primero el proveedor de material arriba para listar OC de flota vinculadas a esa compra.
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="fleet_supplier_id">Proveedor de flota (transportista)</Label>
                      <SupplierSelect
                        value={formData.fleet_supplier_id || ''}
                        onChange={(value: string) => {
                          setFormData((prev) => ({ ...prev, fleet_supplier_id: value }))
                          setSelectedFleetPoItemId('')
                          setFleetQtyEntered(0)
                        }}
                        plantId={currentPlant?.id || profile?.plant_id || undefined}
                      />
                      <p className="text-xs text-stone-500">
                        Opcional como filtro: al elegir transportista se acotan las OC de flota. Si elige una OC arriba, este
                        campo se completa solo.
                      </p>
                    </div>

                    {selectedFleetPoItemId && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Cantidad de servicio (flota)</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Cantidad"
                            value={fleetQtyEntered || ''}
                            readOnly={
                              fleetPoItems.find((it) => it.id === selectedFleetPoItemId)?.uom === 'tons'
                            }
                            onChange={(e) => setFleetQtyEntered(parseFloat(e.target.value) || 0)}
                            className="max-w-xs"
                          />
                          <span className="text-sm text-stone-600">
                            {fleetPoItems.find((it) => it.id === selectedFleetPoItemId)?.uom || ''}
                          </span>
                        </div>
                        {fleetPoItems.find((it) => it.id === selectedFleetPoItemId)?.uom === 'tons' ? (
                          <p className="text-xs text-stone-600">
                            OC en toneladas métricas: se toma el peso báscula de la mercancía (kg) y se convierte a t
                            (÷ {KG_PER_METRIC_TON}).{' '}
                            {scaleKgPreview > 0
                              ? `Vista previa: ${scaleKgPreview.toLocaleString('es-MX')} kg → ${kgToMetricTons(scaleKgPreview).toLocaleString('es-MX', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} t.`
                              : 'Capture primero el peso recibido arriba.'}
                          </p>
                        ) : (
                          <p className="text-xs text-stone-500">Ej.: viajes, toneladas, horas según la OC.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      )}

      {/* Notes and Documents - Simplified for DOSIFICADOR */}
      <Card className="border-stone-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notas y Documentos
          </CardTitle>
          <CardDescription>
            Información adicional y documentos de evidencia. Use la cámara para capturar documentos o suba archivos existentes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">{isDosificador ? 'Observaciones de recepción (opcional)' : 'Notas'}</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={isDosificador ? 2 : 3}
              placeholder={
                isDosificador
                  ? 'Ej. sacos dañados, entrega parcial, material húmedo…'
                  : 'Observaciones adicionales sobre la entrada...'
              }
            />
          </div>
          
          <div className="space-y-2">
            <Label>Documentos de Evidencia</Label>
            <div className="text-xs text-stone-600 mb-3">
              <p>• Use la cámara para capturar documentos y convertirlos automáticamente a PDF</p>
              <p>• O suba archivos existentes (imágenes, PDFs)</p>
            </div>
            
            <SimpleFileUpload
              onFileSelect={handleFileUpload}
              acceptedTypes={['image/*', 'application/pdf']}
              multiple
              uploading={uploading}
              disabled={loading}
            />
            
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-stone-600">
                  {pendingFiles.length} archivo(s) en cola
                </p>
                {pendingFiles.map((fileInfo, index) => (
                  <div key={index} className="flex items-center justify-between text-xs p-2 bg-stone-50 rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-stone-500 truncate">{fileInfo.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        fileInfo.status === 'uploaded' ? 'bg-green-100 text-green-700' :
                        fileInfo.status === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {fileInfo.status}
                      </span>
                      {fileInfo.isCameraCapture && (
                        <span className="text-xs px-2 py-1 rounded bg-sky-100 text-sky-900">
                          Cámara
                        </span>
                      )}
                      {fileInfo.error && (
                        <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                          Error: {fileInfo.error}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      className="text-red-500 hover:text-red-700 ml-2"
                      title="Eliminar documento"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Existing Documents */}
            {existingDocuments.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-stone-600">
                  Documentos subidos:
                </p>
                {existingDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-xs p-2 bg-green-50 rounded border border-green-200">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-stone-700 truncate">{doc.original_name}</span>
                      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                        Subido
                      </span>
                      <span className="text-xs text-stone-500">
                        {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-800 hover:text-sky-900 text-xs"
                        >
                          Ver
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Eliminar documento"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isDosificador &&
        formData.material_id &&
        formData.quantity_received > 0 &&
        String(formData.supplier_invoice || '').trim() && (
          <Card className="border-stone-200 bg-[#faf9f7]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen antes de guardar</CardTitle>
              <CardDescription className="text-xs">
                La cantidad corresponde a esta recepción; la solicitud vincula la entrada al flujo. Compruebe remisión
                frente a material y proveedor en la OC.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5 text-stone-800">
              <p>
                <span className="text-stone-500">Material: </span>
                <span className="font-medium">{dosificadorSummaryMaterialName}</span>
              </p>
              {selectedFulfillmentAlertId && selectedFulfillmentAlert ? (
                <p>
                  <span className="text-stone-500">Solicitud (vincula esta entrada): </span>
                  <span className="font-mono font-semibold">{selectedFulfillmentAlert.alert_number}</span>
                </p>
              ) : (
                <p className="text-stone-600 text-xs">Sin solicitud vinculada (reabastecimiento u otro).</p>
              )}
              {selectedAlertExistingPoId && (
                <p>
                  <span className="text-stone-500">OC (material y proveedor): </span>
                  <span className="font-mono font-medium">
                    {dosificadorReceiptContext?.po.po_number?.trim() ||
                      linkedPoLabel(selectedLinkedPo, selectedAlertExistingPoId)}
                  </span>
                </p>
              )}
              <p>
                <span className="text-stone-500">Proveedor: </span>
                {dosificadorSummarySupplierName}
              </p>
              <p>
                <span className="text-stone-500">Cantidad de esta recepción: </span>
                <span className="font-mono tabular-nums font-semibold">
                  {formData.quantity_received.toLocaleString('es-MX', { maximumFractionDigits: 2 })} kg
                </span>
              </p>
              <p>
                <span className="text-stone-500">Remisión: </span>
                <span className="font-mono">{formData.supplier_invoice}</span>
              </p>
              {(formData.fleet_supplier_id || String(formData.fleet_invoice || '').trim()) && (
                <div className="pt-2 mt-2 border-t border-stone-200 space-y-1 text-xs">
                  <p className="font-medium text-stone-700">Flota / transporte</p>
                  {formData.fleet_supplier_id && (
                    <p className="text-stone-600">Transportista seleccionado en el formulario.</p>
                  )}
                  {String(formData.fleet_invoice || '').trim() && (
                    <p>
                      <span className="text-stone-500">Remisión flota: </span>
                      <span className="font-mono">{formData.fleet_invoice}</span>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

      {/* Submit Button */}
      <div className={cn('flex justify-end space-x-3', isDosificador && 'hidden md:flex')}>
        <Button 
          type="button" 
          variant="outline"
          onClick={() => {
            setFormData({
              material_id: '',
              quantity_received: 0,
              supplier_id: '',
              supplier_invoice: '',
              fleet_supplier_id: '',
              fleet_invoice: '',
              notes: '',
              entry_date: new Date().toISOString().split('T')[0]
            })
            setCurrentInventory(null)
            setPendingFiles([]) // Clear pending files on cancel
            setSelectedPoItemId('')
            setSelectedFleetPoItemId('')
            setFleetQtyEntered(0)
            setReceivedQtyEntered(0)
            setReceivedUom('kg')
            setVolumetricWeight(undefined)
            setAutoFilledFromPO({
              material: false,
              supplier: false,
              uom: false,
              volumetricWeight: false
            })
            setFulfillmentAlerts([])
            setSelectedFulfillmentAlertId('')
            setEntrySuccessInfo(null)
            supplierAutoFromPoRef.current = null
            setDosificadorReceiptContext(null)
            setDosificadorSupplierOverride(false)
          }}
        >
          Limpiar
        </Button>
        <Button
          type="submit"
          variant="solid"
          disabled={
            loading ||
            uploading ||
            !formData.material_id ||
            formData.quantity_received <= 0 ||
            (isDosificador && !String(formData.supplier_invoice || '').trim())
          }
          className="min-w-[120px] bg-sky-800 hover:bg-sky-900 text-white shadow-none"
        >
          {loading ? (
            'Guardando...'
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Entrada
            </>
          )}
        </Button>
      </div>

      {/* Warning for missing required fields */}
      {(!formData.material_id ||
        formData.quantity_received <= 0 ||
        (isDosificador && !String(formData.supplier_invoice || '').trim())) && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            {!formData.material_id || formData.quantity_received <= 0
              ? 'Complete el material y la cantidad para continuar'
              : 'Ingrese el número de remisión para continuar'}
          </p>
        </div>
      )}

      {isDosificador && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-[#faf9f7]/95 backdrop-blur-sm p-3 md:hidden flex items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="min-w-0 text-xs text-stone-600">
            {currentInventory !== null && inventoryAfter !== null ? (
              <p className="font-mono tabular-nums">
                <span className="text-stone-500">Final </span>
                <span className="font-semibold text-stone-900">
                  {inventoryAfter.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg
                </span>
              </p>
            ) : (
              <span className="text-stone-500">Entrada</span>
            )}
          </div>
          <Button
            type="submit"
            size="lg"
            variant="solid"
            className="min-w-[140px] shrink-0 bg-sky-800 hover:bg-sky-900 text-white shadow-none"
            disabled={
              loading ||
              uploading ||
              !formData.material_id ||
              formData.quantity_received <= 0 ||
              (isDosificador && !String(formData.supplier_invoice || '').trim())
            }
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}
    </form>
  )
}
