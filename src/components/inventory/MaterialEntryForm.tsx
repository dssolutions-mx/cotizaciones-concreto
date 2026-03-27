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
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const FULFILLMENT_LINKABLE_STATUSES = new Set<MaterialAlert['status']>([
  'confirmed',
  'pending_validation',
  'validated',
  'pending_po',
  'po_linked',
  'delivery_scheduled',
])

/** PO snapshot for dosificador: no prices (from GET /api/po/[id]/receipt-context). */
type DosificadorReceiptPo = {
  id: string
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

interface MaterialEntryFormProps {
  onSuccess?: () => void
}

export default function MaterialEntryForm({ onSuccess }: MaterialEntryFormProps) {
  const { profile } = useAuthSelectors()
  const { currentPlant } = usePlantContext()
  const searchParams = useSearchParams()
  const urlMaterialApplied = useRef(false)
  
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
  /** supplier_id last applied from linked PO — ref avoids re-fetch loops in useEffect */
  const supplierAutoFromPoRef = useRef<string | null>(null)
  const [dosificadorSupplierOverride, setDosificadorSupplierOverride] = useState(false)

  const selectedFulfillmentAlert = useMemo(
    () => fulfillmentAlerts.find((a) => a.id === selectedFulfillmentAlertId),
    [fulfillmentAlerts, selectedFulfillmentAlertId]
  )
  const selectedAlertExistingPoId = selectedFulfillmentAlert?.existing_po_id ?? null

  // Calculate inventory after
  const inventoryAfter = currentInventory !== null ? currentInventory + formData.quantity_received : null

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
    
    setFormData(prev => ({ ...prev, material_id: materialId }))
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
            const linkable = all.filter((a) => FULFILLMENT_LINKABLE_STATUSES.has(a.status))
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
            const linkable = all.filter((a) =>
              ['delivery_scheduled', 'po_linked', 'validated', 'pending_po'].includes(a.status)
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
      setFleetSectionOpen(false)
    }
  }, [profile?.role])

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
  }, [isDosificador, selectedFulfillmentAlertId, selectedAlertExistingPoId, formData.material_id])

  useEffect(() => {
    const mid = searchParams.get('material_id')
    if (!mid || !currentPlant?.id || urlMaterialApplied.current) return
    urlMaterialApplied.current = true
    void handleMaterialChange(mid)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL prefill
  }, [searchParams, currentPlant?.id])

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

    // Auto-fill UoM
    if (poItem.uom && ['kg', 'l', 'm3'].includes(poItem.uom)) {
      setReceivedUom(poItem.uom as 'kg' | 'l' | 'm3')
      setAutoFilledFromPO(prev => ({ ...prev, uom: true }))
    }

    // Auto-fill volumetric weight if m3
    if (poItem.uom === 'm3' && poItem.volumetric_weight_kg_per_m3) {
      setVolumetricWeight(poItem.volumetric_weight_kg_per_m3)
      setAutoFilledFromPO(prev => ({ ...prev, volumetricWeight: true }))
    }

    // Pre-fill quantity with remaining quantity (as suggestion)
    const remaining = poItem.qty_remaining_native ?? poItem.remainingKg ?? poItem.qty_remaining ?? 0
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
  
  // Fetch fleet PO items when fleet supplier changes
  // CRITICAL: Filter by material_supplier_id matching the material supplier (formData.supplier_id)
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
      params.set('material_supplier_id', formData.supplier_id) // Filter by material supplier
      params.set('is_service', 'true')
      const res = await fetch(`/api/po/items/search?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setFleetPoItems(data.items || [])
      }
    })()
  }, [formData.supplier_id, currentPlant?.id, profile?.plant_id, isDosificador]) // Changed from fleet_supplier_id to supplier_id

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
    
    if (!formData.material_id || formData.quantity_received <= 0) {
      toast.error('Por favor complete todos los campos requeridos')
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

    console.log('Submitting with plant_id:', plantId);
    
    setLoading(true)
    try {
      const requestBody: any = {
        ...formData,
        plant_id: plantId,
        inventory_before: currentInventory || 0
      };
      if (selectedPoItemId) {
        const item = poItems.find(it => it.id === selectedPoItemId)
        if (item) {
          // CRITICAL: Validate that supplier matches PO header supplier
          if (formData.supplier_id && item.po?.supplier_id && formData.supplier_id !== item.po.supplier_id) {
            toast.error('El proveedor seleccionado no coincide con el proveedor del PO. Seleccione un PO que corresponda a este proveedor.')
            setLoading(false)
            return
          }
          
          // Validate against remaining kg
          let enteredKg = formData.quantity_received
          if (receivedUom === 'l') {
            const density = Number(item?.material?.density_kg_per_l) || 0
            if (!density) {
              toast.error('Material sin densidad configurada para convertir litros a kg')
              setLoading(false)
              return
            }
            enteredKg = (receivedQtyEntered || 0) * density
          } else if (receivedQtyEntered > 0) {
            enteredKg = receivedQtyEntered
          }
          if (enteredKg > (Number(item.remainingKg) || 0) + 1e-6) {
            toast.error('La cantidad excede el saldo disponible del PO')
            setLoading(false)
            return
          }
          // Apply PO linkage and kg quantity
          requestBody.po_item_id = selectedPoItemId
          requestBody.po_id = item?.po?.id
          requestBody.received_uom = receivedUom
          requestBody.received_qty_entered = receivedQtyEntered || formData.quantity_received
          requestBody.quantity_received = enteredKg // store entries in kg
        }
      }
      
      // Handle fleet PO linkage
      if (selectedFulfillmentAlertId) {
        requestBody.alert_id = selectedFulfillmentAlertId
      }

      if (selectedFleetPoItemId) {
        const fleetItem = fleetPoItems.find(it => it.id === selectedFleetPoItemId)
        if (fleetItem) {
          // Validate that fleet PO's material_supplier_id matches selected material supplier
          if (formData.supplier_id && fleetItem.material_supplier_id && formData.supplier_id !== fleetItem.material_supplier_id) {
            toast.error('El proveedor de material no coincide con el proveedor del PO de flota. Seleccione un PO de flota que corresponda a este proveedor.')
            setLoading(false)
            return
          }
          
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
          requestBody.fleet_po_id = fleetItem.po?.id
          requestBody.fleet_po_item_id = selectedFleetPoItemId
          requestBody.fleet_qty_entered = fleetQtyEntered
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
                {currentPlant.name} <span className="font-mono text-stone-500">({currentPlant.code})</span> — recepción
                de material. Si recibió lo solicitado, elija la solicitud correspondiente abajo.
              </>
            ) : (
              <>
                {currentPlant.name} ({currentPlant.code}) — material y cantidad primero; PO y flota son opcionales.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  const effectiveUom: 'kg' | 'l' | 'm3' = isM3 ? 'm3' : (isL ? 'l' : 'kg')
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <Label>Cantidad Ingresada *</Label>
                        {autoFilledFromPO.uom && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            UoM desde PO
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <select
                          className="border border-stone-300 rounded-md bg-white px-3 py-2 text-sm"
                          value={effectiveUom}
                          onChange={(e) => {
                            setReceivedUom(e.target.value as any)
                            if (autoFilledFromPO.uom) {
                              setAutoFilledFromPO(prev => ({ ...prev, uom: false }))
                            }
                          }}
                          disabled={isM3}
                        >
                          <option value="kg">kg</option>
                          <option value="l">l</option>
                          <option value="m3">m3</option>
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
                      {isM3 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-stone-600">Peso volumétrico (kg/m³)</Label>
                            {autoFilledFromPO.volumetricWeight && (
                              <Badge variant="secondary" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Desde PO
                              </Badge>
                            )}
                          </div>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={volumetricWeight || ''}
                            onChange={(e) => {
                              setVolumetricWeight(parseFloat(e.target.value) || undefined)
                              if (autoFilledFromPO.volumetricWeight) {
                                setAutoFilledFromPO(prev => ({ ...prev, volumetricWeight: false }))
                              }
                            }}
                            placeholder="Ej. 1400"
                            className={volumetricWeight ? 'bg-stone-50' : ''}
                          />
                          <p className="text-xs text-stone-500 mt-1">
                            {autoFilledFromPO.volumetricWeight 
                              ? 'Peso volumétrico definido en el PO'
                              : 'Si el PO o un acuerdo de proveedor define el valor, se usará automáticamente. Proporcione uno solo si no está definido.'}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-stone-500">
                        {receivedQtyEntered > 0 && it?.qty_remaining_native !== undefined && receivedQtyEntered <= it.qty_remaining_native
                          ? `✓ Sugerido desde PO. Restante: ${it.qty_remaining_native.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${effectiveUom}`
                          : 'Ingrese en el UoM seleccionado; se validará contra el saldo del PO.'}
                      </p>
                    </>
                  )
                })()
              ) : (
                <>
                  <Label htmlFor="quantity_received" className={cn("text-sm sm:text-base", isDosificador && "text-base font-semibold")}>
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
                    className={cn(
                      "h-12",
                      isDosificador && "h-16 text-2xl font-semibold text-center"
                    )}
                    placeholder={isDosificador ? "0.00" : ""}
                    required
                  />
                  <p className={cn("text-xs text-stone-500", isDosificador && "text-center")}>
                    {isDosificador ? "Ingrese la cantidad en kilogramos" : "Cantidad en kilogramos"}
                  </p>
                </>
              )}
            </div>
          </div>

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
                        </div>
                        <p className="text-xs text-stone-500 mt-1 tabular-nums">
                          Creada {format(new Date(a.created_at), 'dd/MM/yyyy HH:mm')}
                          {a.validation_notes
                            ? ` · ${a.validation_notes.slice(0, 96)}${a.validation_notes.length > 96 ? '…' : ''}`
                            : null}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}
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

          <div className="space-y-2">
            <Label htmlFor="entry_date">Fecha de Entrada</Label>
            <Input
              id="entry_date"
              type="date"
              value={formData.entry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, entry_date: e.target.value }))}
            />
          </div>
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
                ? 'Valide contra la orden de compra ligada a su solicitud (sin precios). La remisión del proveedor sigue siendo obligatoria para trazabilidad.'
                : 'Datos del proveedor y documentación'}
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          {isDosificador && dosificadorReceiptLoading && (
            <p className="text-xs text-stone-500">Cargando datos de la orden de compra…</p>
          )}

          {isDosificador &&
            !!selectedFulfillmentAlertId &&
            !selectedAlertExistingPoId &&
            !dosificadorReceiptLoading && (
              <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                <AlertCircle className="inline h-3.5 w-3.5 mr-1 align-text-bottom" />
                Esta solicitud aún no tiene OC vinculada. Indique el proveedor según la entrega física o confirme con
                administración.
              </div>
            )}

          {isDosificador && dosificadorReceiptContext && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <ClipboardList className="h-5 w-5 text-sky-800 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-900">
                    Orden de compra ligada a la solicitud
                  </p>
                  <p className="text-xs text-stone-600 mt-0.5 font-mono">
                    Ref. OC {dosificadorReceiptContext.po.display_ref} · Estado:{' '}
                    {dosificadorReceiptContext.po.status}
                    {dosificadorReceiptContext.po.po_date
                      ? ` · Fecha OC ${dosificadorReceiptContext.po.po_date}`
                      : ''}
                  </p>
                  {dosificadorReceiptContext.po.supplier && (
                    <p className="text-sm text-stone-800 mt-2">
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
                </div>
              </div>
              {dosificadorReceiptContext.items.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                        <th className="p-2 font-medium">Material</th>
                        <th className="p-2 font-medium">UoM</th>
                        <th className="p-2 font-medium text-right">Pedido</th>
                        <th className="p-2 font-medium text-right">Recibido</th>
                        <th className="p-2 font-medium text-right">Pendiente</th>
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
              )}
              <p className="text-[10px] text-stone-500 leading-relaxed">
                Vista operativa: sin precios ni importes. Compare camión / remisión contra esta OC antes de registrar
                cantidades.
              </p>
            </div>
          )}

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
                {isDosificador && dosificadorReceiptContext?.po.supplier_id && !dosificadorSupplierOverride && (
                  <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-950 border-sky-200">
                    Según OC
                  </Badge>
                )}
              </div>
              {isDosificador && dosificadorReceiptContext && !dosificadorSupplierOverride ? (
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
                    if (isDosificador && dosificadorReceiptContext) {
                      supplierAutoFromPoRef.current = null
                    }
                    setFormData((prev) => ({ ...prev, supplier_id: value }))
                  }}
                  plantId={currentPlant?.id || profile?.plant_id || undefined}
                />
              )}
              {autoFilledFromPO.supplier && !isDosificador && (
                <p className="text-xs text-stone-500">Proveedor seleccionado automáticamente desde el PO</p>
              )}
              {isDosificador && dosificadorSupplierOverride && (
                <p className="text-xs text-amber-800">
                  Use solo si la entrega no corresponde al proveedor de la OC; avise a su jefe de planta si hay
                  discrepancia.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier_invoice">Número de Remisión</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                <Input
                  id="supplier_invoice"
                  value={formData.supplier_invoice || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier_invoice: e.target.value }))}
                  className="pl-10"
                  placeholder="Ej: REM-2024-001"
                />
              </div>
            </div>
          </div>
          
          {!isDosificador && (
          <Collapsible open={fleetSectionOpen} onOpenChange={setFleetSectionOpen} className="pt-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between px-0 text-stone-700 hover:bg-transparent hover:text-stone-900"
              >
                <span className="text-sm font-medium">Servicio de flota / transporte (opcional)</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', fleetSectionOpen && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
          <div className="pt-2 border-t border-stone-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fleet_supplier_id">Proveedor de Flota</Label>
                <SupplierSelect
                  value={formData.fleet_supplier_id || ''}
                  onChange={(value: string) => setFormData(prev => ({ ...prev, fleet_supplier_id: value }))}
                  plantId={currentPlant?.id || profile?.plant_id || undefined}
                />
                <p className="text-xs text-stone-500">Opcional: Seleccione si se usó servicio de transporte</p>
              </div>
              
              {formData.fleet_supplier_id && (
                <>
                  <div className="space-y-2">
                    <Label>PO de Flota</Label>
                    <select
                      className="border border-stone-300 rounded-md bg-white px-3 py-2 text-sm w-full"
                      value={selectedFleetPoItemId}
                      onChange={(e) => setSelectedFleetPoItemId(e.target.value)}
                    >
                      <option value="">Sin PO de flota</option>
                      {fleetPoItems.length === 0 && formData.supplier_id ? (
                        <option disabled>No hay POs de flota disponibles para este proveedor</option>
                      ) : (
                        fleetPoItems.map((it) => {
                          const materialSupplierName = it.material_supplier?.name || 'Proveedor'
                          return (
                            <option key={it.id} value={it.id}>
                              {`PO ${String(it.po?.id || '').slice(0,8)} · ${it.service_description || 'Servicio'} · Para: ${materialSupplierName} · Restante: ${(Number(it.qty_remaining)||0).toLocaleString('es-MX')} ${it.uom}`}
                            </option>
                          )
                        })
                      )}
                    </select>
                    {formData.supplier_id && fleetPoItems.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        No hay POs de flota disponibles para {formData.supplier_id ? 'este proveedor' : 'el proveedor seleccionado'}. Cree un PO de flota primero.
                      </p>
                    )}
                  </div>
                  
                  {selectedFleetPoItemId && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Cantidad de Servicio</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Cantidad"
                          value={fleetQtyEntered || ''}
                          onChange={(e) => setFleetQtyEntered(parseFloat(e.target.value) || 0)}
                          className="max-w-xs"
                        />
                        <span className="text-sm text-stone-600">
                          {fleetPoItems.find(it => it.id === selectedFleetPoItemId)?.uom || ''}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        Ej: 2 viajes, 5 toneladas, etc.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
            </CollapsibleContent>
          </Collapsible>
          )}
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
          {!isDosificador && (
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Observaciones adicionales sobre la entrada..."
              />
            </div>
          )}
          
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
          disabled={loading || uploading || !formData.material_id || formData.quantity_received <= 0}
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
      {(!formData.material_id || formData.quantity_received <= 0) && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            Complete el material y la cantidad para continuar
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
            disabled={loading || uploading || !formData.material_id || formData.quantity_received <= 0}
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}
    </form>
  )
}
