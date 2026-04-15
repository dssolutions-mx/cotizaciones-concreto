'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Download, ExternalLink, Eye, FileText, Loader2, Paperclip } from 'lucide-react'
import { InventoryDocument } from '@/types/inventory'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export type EntryEvidencePanelProps = {
  entryId: string
  /** When pending and no files, show a stronger nudge (procurement audit). */
  pricingStatus?: 'pending' | 'reviewed'
  /** Highlight missing evidence while price is still pending. */
  warnWhenPendingAndEmpty?: boolean
  className?: string
  /** Optional key to refetch (e.g. after upload elsewhere). */
  refreshKey?: number
  onDocumentCountChange?: (count: number) => void
}

function guessKind(doc: InventoryDocument): 'image' | 'pdf' | 'csv' | 'other' {
  const mime = doc.mime_type?.toLowerCase() || ''
  const name = (doc.original_name || doc.file_name || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (mime === 'text/csv' || name.endsWith('.csv')) return 'csv'
  if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'image'
  return 'other'
}

function CsvInlinePreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setText(null)
    setFailed(false)
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.text()
      })
      .then((t) => {
        if (!cancelled) setText(t)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (failed) {
    return (
      <p className="text-sm text-stone-600 text-center py-8">
        No se pudo mostrar el CSV aquí. Use &quot;Abrir en pestaña nueva&quot; abajo.
      </p>
    )
  }
  if (text === null) {
    return (
      <div className="flex items-center justify-center py-16 text-stone-500">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Cargando vista previa" />
      </div>
    )
  }
  return (
    <pre className="text-xs font-mono leading-relaxed overflow-auto max-h-[min(70vh,560px)] p-4 bg-white rounded-md border border-stone-200 text-stone-800 whitespace-pre-wrap break-words">
      {text}
    </pre>
  )
}

export default function EntryEvidencePanel({
  entryId,
  pricingStatus,
  warnWhenPendingAndEmpty = true,
  className,
  refreshKey = 0,
  onDocumentCountChange,
}: EntryEvidencePanelProps) {
  const [documents, setDocuments] = useState<InventoryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<InventoryDocument | null>(null)

  const fetchDocuments = useCallback(async () => {
    if (!entryId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/inventory/documents?reference_id=${encodeURIComponent(entryId)}&type=entry`
      )
      if (!response.ok) {
        const j = await response.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudieron cargar los documentos')
      }
      const data = await response.json()
      const list: InventoryDocument[] = data.data || []
      setDocuments(list)
      onDocumentCountChange?.(list.length)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Error al cargar evidencia')
      onDocumentCountChange?.(0)
    } finally {
      setLoading(false)
    }
  }, [entryId, onDocumentCountChange])

  useEffect(() => {
    void fetchDocuments()
  }, [fetchDocuments, refreshKey])

  const pending = pricingStatus === 'pending'
  const showMissingWarning =
    warnWhenPendingAndEmpty && pending && !loading && documents.length === 0

  const previewKind = useMemo(
    () => (previewDoc ? guessKind(previewDoc) : 'other'),
    [previewDoc]
  )

  return (
    <div
      className={cn(
        'rounded-lg border border-stone-200 bg-gradient-to-br from-stone-50 to-amber-50/40 p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-md bg-stone-900/90 p-1.5 text-white">
          <Paperclip className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-stone-900 tracking-tight">Evidencia adjunta</h4>
          <p className="text-[11px] text-stone-600 font-mono">Entrada · {entryId.slice(0, 8)}…</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-stone-500 ml-auto" aria-label="Cargando" />}
      </div>

      {error && (
        <p className="text-sm text-red-700 mb-2" role="alert">
          {error}
        </p>
      )}

      {showMissingWarning && (
        <Alert className="mb-3 border-amber-300 bg-amber-50/95 text-amber-950 [&>svg]:text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">Sin archivos en esta entrada</AlertTitle>
          <AlertDescription className="text-xs">
            Idealmente la planta adjunta remisión o foto del ticket antes de revisar precios. Si faltan, coordine con
            planta o use Control de producción para cargar evidencia.
          </AlertDescription>
        </Alert>
      )}

      {!loading && documents.length === 0 && !showMissingWarning && (
        <p className="text-sm text-stone-600 flex items-center gap-2">
          <FileText className="h-4 w-4 text-stone-400 shrink-0" />
          No hay documentos adjuntos a esta entrada.
        </p>
      )}

      {documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border border-stone-200/80 bg-white/90 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-stone-900 truncate">{doc.original_name || doc.file_name}</div>
                <div className="text-[11px] text-stone-500 font-mono" title="Momento en que se subió el archivo">
                  Subido: {format(new Date(doc.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                </div>
              </div>
              {doc.url ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="inline-flex items-center gap-1 rounded-md bg-sky-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-900"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver
                  </button>
                  <a
                    href={doc.url}
                    download={doc.original_name || doc.file_name || 'documento'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </a>
                </div>
              ) : (
                <span className="text-xs text-stone-400">Sin enlace</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-stone-500">
        Solo lectura aquí. La carga de archivos se gestiona en Control de producción en la ficha de la entrada.
      </p>

      <Dialog
        open={!!previewDoc}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null)
        }}
      >
        <DialogContent
          className={cn(
            'max-w-[min(100vw-1rem,56rem)] w-[95vw] p-0 gap-0 flex flex-col max-h-[90vh]',
            'translate-y-[-48%] sm:translate-y-[-50%]'
          )}
        >
          <DialogHeader className="px-4 py-3 border-b border-stone-200 shrink-0 space-y-1">
            <DialogTitle className="text-sm font-semibold leading-snug pr-4 line-clamp-2">
              {previewDoc?.original_name || previewDoc?.file_name || 'Documento'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Vista previa del documento adjunto a la entrada. Use Cerrar o la tecla Escape para volver.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto bg-stone-100/90 p-3 flex flex-col items-center justify-center">
            {previewDoc?.url && previewKind === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element -- signed URLs from storage; dynamic user content
              <img
                src={previewDoc.url}
                alt={previewDoc.original_name || previewDoc.file_name}
                className="max-h-[min(70vh,640px)] w-auto max-w-full object-contain rounded shadow-sm"
              />
            )}
            {previewDoc?.url && previewKind === 'pdf' && (
              <iframe
                title={previewDoc.original_name || previewDoc.file_name || 'PDF'}
                src={previewDoc.url}
                className="w-full min-h-[min(70vh,640px)] flex-1 rounded border border-stone-200 bg-white"
              />
            )}
            {previewDoc?.url && previewKind === 'csv' && <CsvInlinePreview url={previewDoc.url} />}
            {previewDoc?.url && previewKind === 'other' && (
              <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 text-center">
                <p className="text-sm text-stone-600">
                  Vista previa no disponible para este tipo de archivo. Puede abrirlo en otra pestaña.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href={previewDoc.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir en pestaña nueva
                  </a>
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row flex-wrap justify-between gap-2 border-t border-stone-200 px-4 py-3 sm:justify-end shrink-0">
            {previewDoc?.url && previewKind !== 'other' && (
              <Button variant="ghost" size="sm" className="text-stone-600" asChild>
                <a href={previewDoc.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Nueva pestaña
                </a>
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={() => setPreviewDoc(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
