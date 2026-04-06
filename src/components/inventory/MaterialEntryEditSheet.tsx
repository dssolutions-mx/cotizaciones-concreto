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
import SimpleFileUpload from '@/components/inventory/SimpleFileUpload'
import { MaterialEntry, InventoryDocument } from '@/types/inventory'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Eye, Loader2, Paperclip, Save, Trash2 } from 'lucide-react'

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
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [documents, setDocuments] = useState<InventoryDocument[]>([])
  const [docLoading, setDocLoading] = useState(false)

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
    void fetchDocuments(entry.id)
  }, [open, entry, fetchDocuments])

  const handleFiles = async (files: FileList) => {
    if (!entry) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', 'entry')
        fd.append('reference_id', entry.id)
        const res = await fetch('/api/inventory/documents', { method: 'POST', body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error || `Error al subir ${file.name}`)
          continue
        }
        toast.success(`${file.name} subido`)
      }
      await fetchDocuments(entry.id)
      onSaved?.()
    } finally {
      setUploading(false)
    }
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
    setSaving(true)
    try {
      const res = await fetch('/api/inventory/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          notes: notes.trim(),
          supplier_invoice: supplierInvoice.trim() || undefined,
        }),
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto bg-[#fafaf9]">
        <SheetHeader className="text-left">
          <SheetTitle className="text-stone-900">Editar entrada</SheetTitle>
          {entry && (
            <SheetDescription className="text-stone-600">
              <span className="font-mono text-stone-800">{entry.entry_number}</span>
              {' · '}
              {format(
                new Date(`${entry.entry_date}T${entry.entry_time || '12:00:00'}`),
                "dd MMM yyyy HH:mm",
                { locale: es }
              )}
            </SheetDescription>
          )}
        </SheetHeader>

        {entry ? (
          <form onSubmit={handleSave} className="mt-6 space-y-6">
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
                Evidencias (PDF, imagen, CSV)
              </Label>
              <SimpleFileUpload
                onFileSelect={(list) => void handleFiles(list)}
                uploading={uploading}
                disabled={uploading}
                acceptedTypes={['image/*', 'application/pdf', 'text/csv']}
                className="bg-white"
              />
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
                disabled={saving}
                className="border-stone-300"
              >
                Cerrar
              </Button>
              <Button
                type="submit"
                disabled={saving}
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
