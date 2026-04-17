'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import SimpleFileUpload from '@/components/inventory/SimpleFileUpload'
import SupplierSelect from '@/components/inventory/SupplierSelect'
import { cn } from '@/lib/utils'
import { MaterialEntry, InventoryDocument } from '@/types/inventory'
import { toast } from 'sonner'
import { formatReceptionAssignedDay, formatEntrySavedShortFor } from '@/lib/inventory/entryReceivedDisplay'
import { uploadInventoryEntryDocumentFromClient } from '@/lib/inventory/uploadInventoryEntryDocumentFromClient'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  Package,
  Paperclip,
  RefreshCw,
  Save,
  Trash2,
  Truck,
  X,
} from 'lucide-react'

function qtyLabel(entry: MaterialEntry): string {
  if (entry.received_uom === 'm3') return 'Peso en báscula (kg)'
  if (entry.received_uom === 'l')
    return `Cantidad recibida (${entry.material?.unit_of_measure || 'L'})`
  return `Cantidad recibida (${entry.material?.unit_of_measure || 'kg'})`
}

function initialQtyInput(entry: MaterialEntry): string {
  if (entry.received_uom === 'm3') {
    return String(entry.received_qty_kg ?? entry.quantity_received ?? '')
  }
  if (entry.received_uom === 'l') {
    return String(entry.received_qty_entered ?? entry.quantity_received ?? '')
  }
  return String(entry.quantity_received ?? '')
}

function normalizeEntryTime(t: string): string | undefined {
  const x = t.trim()
  if (!x) return undefined
  if (/^\d{2}:\d{2}$/.test(x)) return `${x}:00`
  return x
}

function parseDecimal(s: string): number | null {
  const n = parseFloat(s.replace(',', '.').trim())
  return Number.isFinite(n) ? n : null
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

type UploadItemStatus = 'uploading' | 'success' | 'error'

interface UploadItem {
  id: string
  file: File
  status: UploadItemStatus
  error?: string
}

const UPLOAD_MAX_ATTEMPTS = 4
const UPLOAD_RETRY_DELAY_MS = [0, 900, 2200, 4500] as const

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function isTransientNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && /failed to fetch/i.test(e.message)) return true
  return false
}

const NETWORK_FAILURE_HINT =
  'No se pudo conectar con el servidor (señal inestable o conexión interrumpida). Espere unos segundos y pulse Reintentar; si sigue igual, pruebe con Wi‑Fi o otra red.'

function formatUploadNetworkMessage(e: unknown): string {
  if (e instanceof TypeError) {
    return NETWORK_FAILURE_HINT
  }
  if (e instanceof Error && /failed to fetch/i.test(e.message)) {
    return NETWORK_FAILURE_HINT
  }
  if (e instanceof Error) {
    return `Error de red: ${e.message}`
  }
  return 'Error de red al subir el archivo'
}

interface MaterialEntryEditSheetProps {
  entry: MaterialEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export default function MaterialEntryEditSheet({
  entry,
  open,
  onOpenChange,
  onSaved,
}: MaterialEntryEditSheetProps) {
  const [notes, setNotes] = useState('')
  const [supplierInvoice, setSupplierInvoice] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [entryTime, setEntryTime] = useState('')
  const [qtyInput, setQtyInput] = useState('')
  const [fleetSupplierId, setFleetSupplierId] = useState('')
  const [fleetInvoice, setFleetInvoice] = useState('')
  const [fleetCost, setFleetCost] = useState('')
  const [fleetQtyEntered, setFleetQtyEntered] = useState('')
  const [fleetUom, setFleetUom] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [documents, setDocuments] = useState<InventoryDocument[]>([])
  const [docLoading, setDocLoading] = useState(false)
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([])

  const fetchDocuments = useCallback(async (entryId: string) => {
    setDocLoading(true)
    try {
      const response = await fetch(
        `/api/inventory/documents?reference_id=${encodeURIComponent(entryId)}&type=entry`
      )
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.data || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setDocLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !entry) return
    setNotes(entry.notes ?? '')
    setSupplierInvoice(entry.supplier_invoice ?? '')
    setSupplierId(entry.supplier_id ?? '')
    setEntryDate(entry.entry_date?.slice(0, 10) ?? '')
    setEntryTime(entry.entry_time?.slice(0, 5) ?? '')
    setQtyInput(initialQtyInput(entry))
    setFleetSupplierId(entry.fleet_supplier_id ?? '')
    setFleetInvoice(entry.fleet_invoice ?? '')
    setFleetCost(entry.fleet_cost != null ? String(entry.fleet_cost) : '')
    setFleetQtyEntered(
      entry.fleet_qty_entered != null ? String(entry.fleet_qty_entered) : ''
    )
    setFleetUom(entry.fleet_uom ?? '')
    setUploadItems([])
    void fetchDocuments(entry.id)
  }, [open, entry, fetchDocuments])

  const uploadSingle = async (item: UploadItem, entryId: string): Promise<UploadItem> => {
    let lastError = 'No se pudo subir el archivo'

    for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
      await sleep(UPLOAD_RETRY_DELAY_MS[attempt] ?? 0)
      try {
        await uploadInventoryEntryDocumentFromClient(item.file, entryId)
        return { ...item, status: 'success', error: undefined }
      } catch (e) {
        console.error('[EntryEdit] upload threw', {
          entryId,
          fileName: item.file.name,
          attempt: attempt + 1,
          error: e,
        })
        if (
          isTransientNetworkFailure(e) &&
          attempt < UPLOAD_MAX_ATTEMPTS - 1
        ) {
          continue
        }
        lastError = isTransientNetworkFailure(e)
          ? formatUploadNetworkMessage(e)
          : e instanceof Error
            ? e.message
            : 'No se pudo subir el archivo'
        return { ...item, status: 'error', error: lastError }
      }
    }

    return { ...item, status: 'error', error: lastError }
  }

  const runUploads = async (items: UploadItem[]) => {
    if (!entry || items.length === 0) return
    const entryId = entry.id
    setUploading(true)
    let okCount = 0
    let failCount = 0
    try {
      for (const item of items) {
        const result = await uploadSingle(item, entryId)
        if (result.status === 'success') okCount += 1
        else if (result.status === 'error') failCount += 1
        setUploadItems((prev) =>
          prev.map((p) => (p.id === item.id ? result : p))
        )
      }
    } finally {
      try {
        await fetchDocuments(entryId)
      } catch (e) {
        console.error('[EntryEdit] fetchDocuments after upload failed', e)
      }
      setUploading(false)
      if (okCount > 0) {
        toast.success(
          okCount === 1
            ? 'Evidencia subida correctamente'
            : `${okCount} evidencias subidas correctamente`
        )
        onSaved?.()
      }
      if (failCount > 0) {
        toast.error(
          failCount === 1
            ? 'Un archivo no se pudo subir. Revise la lista y reintente.'
            : `${failCount} archivos no se pudieron subir. Revise la lista y reintente.`
        )
      }
    }
  }

  const handleFiles = async (files: FileList) => {
    if (!entry) return
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      status: 'uploading',
    }))
    setUploadItems((prev) => [...prev, ...newItems])
    await runUploads(newItems)
  }

  const retryUpload = async (itemId: string) => {
    if (!entry) return
    const target = uploadItems.find((i) => i.id === itemId)
    if (!target) return
    const retryItem: UploadItem = { ...target, status: 'uploading', error: undefined }
    setUploadItems((prev) => prev.map((p) => (p.id === itemId ? retryItem : p)))
    await runUploads([retryItem])
  }

  const retryAllFailed = async () => {
    const failed = uploadItems.filter((i) => i.status === 'error')
    if (failed.length === 0) return
    const retried = failed.map((i) => ({ ...i, status: 'uploading' as const, error: undefined }))
    setUploadItems((prev) => {
      const map = new Map(retried.map((r) => [r.id, r]))
      return prev.map((p) => map.get(p.id) ?? p)
    })
    await runUploads(retried)
  }

  const dismissUploadItem = (itemId: string) => {
    setUploadItems((prev) => prev.filter((p) => p.id !== itemId))
  }

  const deleteDocument = async (documentId: string) => {
    if (!entry) return
    try {
      const response = await fetch(`/api/inventory/documents?id=${documentId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== documentId))
        toast.success('Documento eliminado')
        onSaved?.()
      } else {
        const error = await response.json().catch(() => ({}))
        toast.error(error.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar documento')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry) return
    const q = parseDecimal(qtyInput)
    if (q == null || q <= 0) {
      toast.error('Indique una cantidad recibida válida mayor a cero')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        id: entry.id,
        notes: notes.trim() || undefined,
        supplier_invoice: supplierInvoice.trim() || undefined,
        entry_date: entryDate.trim() || undefined,
        entry_time: normalizeEntryTime(entryTime),
      }
      if (supplierId) {
        payload.supplier_id = supplierId
      }
      if (entry.received_uom === 'm3') {
        payload.received_qty_kg = q
        payload.quantity_received = q
      } else if (entry.received_uom === 'l') {
        payload.received_qty_entered = q
        payload.quantity_received = q
      } else {
        payload.quantity_received = q
      }
      if (fleetSupplierId) {
        payload.fleet_supplier_id = fleetSupplierId
      }
      const fi = fleetInvoice.trim()
      if (fi) {
        payload.fleet_invoice = fi
      }
      const fc = parseDecimal(fleetCost)
      if (fc !== null && fc >= 0) {
        payload.fleet_cost = fc
      }
      if (!entry.fleet_po_item_id) {
        const fq = parseDecimal(fleetQtyEntered)
        if (fq !== null && fq > 0) {
          payload.fleet_qty_entered = fq
          if (fleetUom) {
            payload.fleet_uom = fleetUom
          }
        }
      }

      const res = await fetch('/api/inventory/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al guardar')
        return
      }
      toast.success('Entrada actualizada')
      onSaved?.()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Prevent closing while an upload is in progress to avoid losing the
        // in-flight request context on mobile (camera picker / backgrounded tab).
        if (!next && uploading) {
          toast.message('Espere a que termine de subir la evidencia...')
          return
        }
        onOpenChange(next)
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto bg-[#fafaf9]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-stone-900">Editar entrada</SheetTitle>
          {entry && (
            <SheetDescription className="text-stone-600 space-y-0.5">
              <span className="font-mono text-stone-800 block">{entry.entry_number}</span>
              <span className="block text-sm">
                Día recepción: {formatReceptionAssignedDay(entry)}
              </span>
              <span className="block text-xs text-stone-500">
                Registro guardado: {formatEntrySavedShortFor(entry)}
              </span>
            </SheetDescription>
          )}
        </SheetHeader>

        {entry ? (
          <form onSubmit={handleSave} className="mt-6 space-y-6">
            <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-1">
              <div className="flex items-center gap-2 text-stone-600 text-xs font-medium">
                <Package className="h-3.5 w-3.5" />
                Material
              </div>
              <p className="text-sm font-medium text-stone-900">
                {entry.material?.material_name ?? '—'}
              </p>
              {entry.po?.po_number ? (
                <p className="text-xs text-stone-500">
                  OC material: {entry.po.po_number}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Fecha y hora de recepción</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="bg-white border-stone-200"
                />
                <Input
                  type="time"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className="bg-white border-stone-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Proveedor de material</Label>
              {entry.po_item_id ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                  El proveedor está ligado a la orden de compra; no se puede cambiar aquí.
                </p>
              ) : null}
              <SupplierSelect
                value={supplierId}
                onChange={setSupplierId}
                plantId={entry.plant_id}
                disabled={Boolean(entry.po_item_id)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-qty">{qtyLabel(entry)}</Label>
              <Input
                id="edit-qty"
                type="text"
                inputMode="decimal"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                className="bg-white border-stone-200"
              />
              {entry.received_uom === 'm3' && entry.received_qty_entered != null ? (
                <p className="text-xs text-stone-500">
                  m³ registrados:{' '}
                  {Number(entry.received_qty_entered).toLocaleString('es-MX', {
                    maximumFractionDigits: 4,
                  })}
                </p>
              ) : null}
            </div>

            <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
              <div className="flex items-center gap-2 text-stone-800 text-sm font-medium">
                <Truck className="h-4 w-4" />
                Flota / flete
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Proveedor de flota</Label>
                <SupplierSelect
                  value={fleetSupplierId}
                  onChange={setFleetSupplierId}
                  plantId={entry.plant_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fleet-invoice" className="text-xs">
                  Factura / remisión flota
                </Label>
                <Input
                  id="edit-fleet-invoice"
                  value={fleetInvoice}
                  onChange={(e) => setFleetInvoice(e.target.value)}
                  maxLength={100}
                  className="bg-white border-stone-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fleet-cost" className="text-xs">
                  Costo de flota (opcional)
                </Label>
                <Input
                  id="edit-fleet-cost"
                  type="text"
                  inputMode="decimal"
                  value={fleetCost}
                  onChange={(e) => setFleetCost(e.target.value)}
                  placeholder="0.00"
                  className="bg-white border-stone-200"
                />
              </div>
              {entry.fleet_po_item_id ? (
                <p className="text-xs text-stone-500">
                  Hay OC de flota vinculada; la cantidad de servicio de flota no se edita aquí.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-fleet-qty" className="text-xs">
                      Cantidad servicio flota
                    </Label>
                    <Input
                      id="edit-fleet-qty"
                      type="text"
                      inputMode="decimal"
                      value={fleetQtyEntered}
                      onChange={(e) => setFleetQtyEntered(e.target.value)}
                      className="bg-white border-stone-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Unidad</Label>
                    <Select
                      value={fleetUom || '__none__'}
                      onValueChange={(v) => setFleetUom(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="bg-white border-stone-200">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        <SelectItem value="trips">Viajes</SelectItem>
                        <SelectItem value="tons">Toneladas</SelectItem>
                        <SelectItem value="hours">Horas</SelectItem>
                        <SelectItem value="loads">Cargas</SelectItem>
                        <SelectItem value="units">Unidades</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-supplier-invoice">Número de remisión</Label>
              <Input
                id="edit-supplier-invoice"
                value={supplierInvoice}
                onChange={(e) => setSupplierInvoice(e.target.value)}
                maxLength={100}
                placeholder="Opcional"
                className="bg-white border-stone-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notas</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Observaciones sobre la recepción"
                className="bg-white border-stone-200 resize-y min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Evidencias (cualquier archivo)
              </Label>
              <SimpleFileUpload
                onFileSelect={(list) => void handleFiles(list)}
                uploading={uploading}
                disabled={uploading}
                acceptAnyFileType
                hideInternalList
                className="bg-white"
              />
              {uploading && (
                <p className="text-xs text-sky-700 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Subiendo evidencia... no cierre esta ventana.
                </p>
              )}

              {uploadItems.length > 0 && (
                <div className="space-y-1.5">
                  {uploadItems.some((i) => i.status === 'error') && (
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-red-200 bg-red-50">
                      <p className="text-xs text-red-800">
                        Algunos archivos no se subieron. Revise el motivo y reintente.
                      </p>
                      <button
                        type="button"
                        onClick={() => void retryAllFailed()}
                        disabled={uploading}
                        className="text-xs font-medium text-red-800 hover:text-red-900 disabled:opacity-50 flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reintentar todos
                      </button>
                    </div>
                  )}
                  <ul className="space-y-1">
                    {uploadItems.map((item) => (
                      <li
                        key={item.id}
                        className={cn(
                          'flex items-start gap-2 text-xs p-2 rounded border',
                          item.status === 'error'
                            ? 'bg-red-50 border-red-200'
                            : item.status === 'success'
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-sky-50 border-sky-200'
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.status === 'uploading' && (
                            <Loader2 className="h-3.5 w-3.5 text-sky-600 animate-spin" />
                          )}
                          {item.status === 'success' && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                          {item.status === 'error' && (
                            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium text-stone-800">
                            {item.file.name}
                          </p>
                          <p className="text-stone-500">
                            {formatBytes(item.file.size)}
                            {item.status === 'uploading' && ' · Subiendo…'}
                            {item.status === 'success' && ' · Subido'}
                          </p>
                          {item.status === 'error' && item.error && (
                            <p className="text-red-700 mt-0.5 break-words">
                              {item.error}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.status === 'error' && (
                            <button
                              type="button"
                              onClick={() => void retryUpload(item.id)}
                              disabled={uploading}
                              className="p-1 text-red-700 hover:bg-red-100 rounded disabled:opacity-50"
                              title="Reintentar"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {item.status !== 'uploading' && (
                            <button
                              type="button"
                              onClick={() => dismissUploadItem(item.id)}
                              className="p-1 text-stone-500 hover:bg-stone-100 rounded"
                              title="Quitar de la lista"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {docLoading ? (
              <div className="flex items-center gap-2 text-sm text-stone-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando documentos…
              </div>
            ) : documents.length > 0 ? (
              <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
                <p className="text-sm font-medium text-stone-900">
                  Documentos ({documents.length})
                </p>
                <ul className="space-y-2">
                  {documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-2 text-xs p-2 bg-stone-50 rounded border border-stone-100"
                    >
                      <span className="truncate text-stone-700">{doc.original_name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-sky-700 hover:bg-sky-50 rounded"
                            title="Ver"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void deleteDocument(doc.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-stone-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || uploading}
                className="border-stone-300"
              >
                Cerrar
              </Button>
              <Button
                type="submit"
                disabled={saving || uploading}
                className="bg-stone-900 hover:bg-stone-800 text-white"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Guardar cambios
              </Button>
            </div>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
