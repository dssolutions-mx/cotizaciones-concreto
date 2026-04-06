'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Package,
  Plus,
  Edit,
  FileText,
  User,
  Clock,
  DollarSign,
  ArrowUpDown,
  Paperclip,
  Eye,
  Trash2,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MaterialEntry, InventoryDocument } from '@/types/inventory'
import Link from 'next/link'
import { toast } from 'sonner'
import MaterialEntryEditSheet from '@/components/inventory/MaterialEntryEditSheet'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

function sortEntriesNewestFirst(list: MaterialEntry[]): MaterialEntry[] {
  return [...list].sort((a, b) => {
    const ka = `${a.entry_date ?? ''}T${a.entry_time ?? '00:00:00'}`
    const kb = `${b.entry_date ?? ''}T${b.entry_time ?? '00:00:00'}`
    return kb.localeCompare(ka)
  })
}

interface MaterialEntriesListProps {
  date?: Date
  dateRange?: { from: Date | undefined; to: Date | undefined }
  poId?: string
  /** Workspace plant (PlantContext); narrows API results for global roles and BU users */
  plantId?: string | null
  /** From URL when opening a specific entry from procurement — row is merged if outside date range, then scrolled into view */
  highlightEntryId?: string
  isEditing: boolean
  onEntriesLoaded?: (entries: MaterialEntry[]) => void
  /** Hide prices and cost info for roles without access (e.g. DOSIFICADOR) */
  hidePrices?: boolean
}

// Documents Section Component
function DocumentsSection({
  entryId,
  allowDocumentMutations,
  refreshKey = 0,
}: {
  entryId: string
  allowDocumentMutations: boolean
  refreshKey?: number
}) {
  const [documents, setDocuments] = useState<InventoryDocument[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [entryId, refreshKey])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/inventory/documents?reference_id=${entryId}&type=entry`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/inventory/documents?id=${documentId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId))
        toast.success('Documento eliminado correctamente')
      } else {
        const error = await response.json()
        toast.error(`Error al eliminar documento: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Error al eliminar documento')
    }
  }

  if (loading) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    )
  }

  if (documents.length === 0) {
    return null
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <h5 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Documentos ({documents.length})
      </h5>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between text-xs p-2 bg-white rounded border">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-gray-700 truncate">{doc.original_name}</span>
              <span className="text-xs text-gray-500">
                {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                  title="Ver documento"
                >
                  <Eye className="h-3 w-3" />
                </a>
              )}
              {allowDocumentMutations && (
                <button
                  type="button"
                  onClick={() => deleteDocument(doc.id)}
                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  title="Eliminar documento"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MaterialEntriesList({
  date,
  dateRange,
  poId,
  plantId,
  highlightEntryId,
  isEditing,
  onEntriesLoaded,
  hidePrices,
}: MaterialEntriesListProps) {
  const [entries, setEntries] = useState<MaterialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editingEntry, setEditingEntry] = useState<MaterialEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MaterialEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0)

  const fetchEntries = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true)
      try {
        const params = new URLSearchParams()
        if (dateRange?.from && dateRange?.to) {
          params.set('date_from', format(dateRange.from, 'yyyy-MM-dd'))
          params.set('date_to', format(dateRange.to, 'yyyy-MM-dd'))
        } else if (date) {
          params.set('date', format(date, 'yyyy-MM-dd'))
        } else {
          params.set('date', format(new Date(), 'yyyy-MM-dd'))
        }
        if (poId) params.set('po_id', poId)
        if (plantId) params.set('plant_id', plantId)
        const response = await fetch(`/api/inventory/entries?${params.toString()}`)

        if (response.ok) {
          const data = await response.json()
          let entriesData: MaterialEntry[] = data.entries || []

          if (
            highlightEntryId &&
            !entriesData.some((e) => e.id === highlightEntryId)
          ) {
            const entryParams = new URLSearchParams()
            entryParams.set('entry_id', highlightEntryId)
            if (plantId) entryParams.set('plant_id', plantId)
            const r2 = await fetch(`/api/inventory/entries?${entryParams.toString()}`)
            if (r2.ok) {
              const data2 = await r2.json()
              const extra: MaterialEntry[] = data2.entries || []
              const merged = [...extra, ...entriesData]
              const seen = new Set<string>()
              entriesData = merged.filter((e) => {
                if (seen.has(e.id)) return false
                seen.add(e.id)
                return true
              })
              entriesData = sortEntriesNewestFirst(entriesData)
            }
          }

          setEntries(entriesData)
          onEntriesLoaded?.(entriesData)
        }
      } catch (error) {
        console.error('Error fetching entries:', error)
        toast.error('Error al cargar las entradas')
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [date, dateRange, poId, plantId, highlightEntryId, onEntriesLoaded]
  )

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  useEffect(() => {
    if (loading || !highlightEntryId) return
    const id = `entry-card-${highlightEntryId}`
    const t = window.setTimeout(() => {
      const el = document.getElementById(id)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => window.clearTimeout(t)
  }, [loading, highlightEntryId, entries])

  const handleEntrySaved = useCallback(() => {
    setDocumentsRefreshKey((k) => k + 1)
    void fetchEntries({ silent: true })
  }, [fetchEntries])

  const confirmDeleteEntry = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(
        `/api/inventory/entries?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'No se pudo eliminar la entrada')
        return
      }
      toast.success(
        typeof data.message === 'string' ? data.message : 'Entrada eliminada'
      )
      if (Array.isArray(data.warnings)) {
        for (const w of data.warnings) {
          if (typeof w === 'string') toast.warning(w)
        }
      }
      setEditingEntry((prev) => (prev?.id === deleteTarget.id ? null : prev))
      setDeleteTarget(null)
      handleEntrySaved()
    } catch {
      toast.error('Error al eliminar la entrada')
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteTarget, handleEntrySaved])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 px-4">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <Package className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2 text-center">
            No hay entradas registradas
          </h3>
          <p className="text-gray-500 text-center mb-6 max-w-md">
            No se han registrado entradas de materiales para este período. Use el botón de abajo para registrar una nueva entrada.
          </p>
          {isEditing && (
            <Link href="/production-control/entries">
              <Button size="lg" className="min-w-[200px]">
                <Plus className="h-4 w-4 mr-2" />
                Registrar Nueva Entrada
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <MaterialEntryEditSheet
        entry={editingEntry}
        open={!!editingEntry}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null)
        }}
        onSaved={handleEntrySaved}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="bg-[#fafaf9] border-stone-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-stone-900">¿Eliminar esta entrada?</AlertDialogTitle>
            <AlertDialogDescription className="text-stone-600 space-y-2">
              <span className="block">
                Se eliminará la entrada{' '}
                <span className="font-mono font-medium text-stone-800">
                  {deleteTarget?.entry_number}
                </span>{' '}
                y el inventario se ajustará automáticamente (se resta la cantidad recibida).
              </span>
              <span className="block text-amber-900/90">
                No se puede eliminar si el material ya fue consumido en remisiones o si la entrada fue
                revisada por administración.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading} className="border-stone-300">
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={deleteLoading}
              onClick={() => void confirmDeleteEntry()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
              ) : null}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Action Button */}
      {isEditing && (
        <div className="flex justify-end">
          <Link href="/production-control/entries">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Entrada
            </Button>
          </Link>
        </div>
      )}

      {/* Entries List */}
      {entries.map((entry) => {
        const canEditRow = isEditing && entry.pricing_status !== 'reviewed'
        return (
        <Card
          key={entry.id}
          id={`entry-card-${entry.id}`}
          className={`hover:shadow-md transition-shadow scroll-mt-24 ${
            highlightEntryId === entry.id
              ? 'ring-2 ring-sky-500 ring-offset-2 shadow-md'
              : ''
          }`}
        >
          <CardHeader className="pb-3 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg truncate">{entry.entry_number}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {format(new Date(`${entry.entry_date}T${entry.entry_time}`), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-xs">Entrada</Badge>
                {!hidePrices && (
                  entry.pricing_status === 'reviewed' ? (
                    <Badge variant="default" className="bg-green-600 text-xs">Revisado</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-500 text-white text-xs">Pendiente</Badge>
                  )
                )}
                {isEditing &&
                  (canEditRow ? (
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0"
                        onClick={() => setEditingEntry(entry)}
                        title="Editar entrada"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTarget(entry)}
                        title="Eliminar entrada"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 w-10 p-0"
                            disabled
                            aria-label="Entrada revisada, no editable"
                          >
                            <Edit className="h-4 w-4 opacity-40" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 w-10 p-0"
                            disabled
                            aria-label="Entrada revisada, no se puede eliminar"
                          >
                            <Trash2 className="h-4 w-4 opacity-40" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[260px]">
                        Entrada revisada por administración; no se puede editar ni eliminar.
                      </TooltipContent>
                    </Tooltip>
                  ))}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 p-4 sm:p-6">
            {/* Material Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Material</h4>
                {entry.material ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{entry.material.material_name}</p>
                    <p className="text-xs text-gray-500">{entry.material.category}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">ID: {entry.material_id}</p>
                )}
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Cantidad Recibida</h4>
                <p className="text-lg font-semibold text-green-600">
                  {entry.quantity_received.toLocaleString('es-MX', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2 
                  })} {entry.material?.unit_of_measure || 'kg'}
                </p>
              </div>
            </div>

            {/* Cost Information - hidden for roles without access (e.g. dosificador) */}
            {!hidePrices && (entry.unit_price || entry.total_cost || entry.fleet_cost) && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Información de Costos</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {entry.unit_price && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Precio/kg</p>
                        <p className="text-sm font-medium text-gray-900">
                          ${entry.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}
                  {entry.total_cost && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Costo Material</p>
                        <p className="text-sm font-medium text-gray-900">
                          ${entry.total_cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}
                  {entry.fleet_cost && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-xs text-gray-500">Costo Flota</p>
                        <p className="text-sm font-medium text-gray-900">
                          ${entry.fleet_cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Inventory Changes */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <ArrowUpDown className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                Inventario: {entry.inventory_before.toLocaleString('es-MX')} → {entry.inventory_after.toLocaleString('es-MX')} kg
              </span>
            </div>

            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {entry.supplier_invoice && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Remisión: {entry.supplier_invoice}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {entry.notes && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <h5 className="text-sm font-medium text-yellow-900 mb-1">Notas</h5>
                <p className="text-sm text-yellow-800">{entry.notes}</p>
              </div>
            )}

            {/* Documents */}
            <DocumentsSection
              entryId={entry.id}
              allowDocumentMutations={canEditRow}
              refreshKey={documentsRefreshKey}
            />

            {/* Footer Info */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Registrado por: {entry.entered_by_user ? `${entry.entered_by_user.first_name} ${entry.entered_by_user.last_name}` : entry.entered_by}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
              </span>
            </div>
          </CardContent>
        </Card>
        )
      })}
    </div>
  )
}
