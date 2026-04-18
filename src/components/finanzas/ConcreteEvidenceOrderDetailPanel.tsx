'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ExternalLink,
  FileText,
  Loader2,
  Download,
  X,
  Truck,
  Package,
  ChevronDown,
  Eye,
  Copy,
  Check,
  Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSignedUrls } from '@/hooks/useSignedUrls'
import { parseJsonResponse } from '@/lib/http/safeJsonResponse'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  compareRemisionSets,
  extractRemisionNumbersFromPdfArrayBuffer,
} from '@/lib/remisiones/remisionPdfTextExtraction'
import {
  isConcreteEvidenceFileZippable,
  sanitizeZipPathSegment,
  uniqueZipPath,
} from '@/lib/finanzas/concreteEvidenceZipUtils'
import { formatPostgresDateEs } from '@/lib/dates/postgresDate'
import { formatRemisionFechaForDisplay } from '@/lib/dates/remisionFechaDisplay'

type EvidenceRow = {
  id: string
  file_path: string
  original_name: string
  file_size: number
  mime_type: string
  uploaded_by: string
  notes: string | null
  created_at: string
  updated_at: string
}

type ConcreteRemRow = {
  id: string
  remision_number: string
  fecha: string
  volumen_fabricado?: number | null
  unidad?: string | null
  conductor?: string | null
}

export type OrderSummary = {
  order_id: string
  order_number: string
  delivery_date: string
  construction_site: string | null
  plant_id: string | null
  plant_code: string | null
  plant_name: string | null
  client_name: string | null
  concrete_remisiones_count: number
  has_evidence: boolean
  evidence_count: number
}

type Props = {
  orderId: string | null
  summary: OrderSummary | null
  onClose: () => void
  className?: string
}

function formatBytes(n: number): string {
  if (n <= 0) return '0 B'
  const k = 1024
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${parseFloat((n / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0))} ${['B', 'KB', 'MB', 'GB'][i]}`
}

function isEvidencePdf(ev: EvidenceRow): boolean {
  return ev.mime_type === 'application/pdf' || /\.pdf$/i.test(ev.original_name || '')
}

export default function ConcreteEvidenceOrderDetailPanel({
  orderId,
  summary,
  onClose,
  className,
}: Props) {
  const { getSignedUrl, isLoading: urlLoading } = useSignedUrls('remision-documents', 3600)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<EvidenceRow[]>([])
  const [remisiones, setRemisiones] = useState<ConcreteRemRow[]>([])

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<EvidenceRow | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [pdfAnalyzeLoading, setPdfAnalyzeLoading] = useState(false)
  const [pdfMatchError, setPdfMatchError] = useState<string | null>(null)
  const [pdfMatch, setPdfMatch] = useState<{
    matched: string[]
    inPdfNotDb: string[]
    inDbNotPdf: string[]
    hadText: boolean
    textLength: number
  } | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedZipIds, setSelectedZipIds] = useState<Set<string>>(() => new Set())
  const [zipBusy, setZipBusy] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) {
      setEvidence([])
      setRemisiones([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/concrete-evidence`)
      const json = await parseJsonResponse<{
        data?: { evidence: EvidenceRow[]; concrete_remisiones_ordered: ConcreteRemRow[] }
        error?: string
      }>(res)
      if (!res.ok) throw new Error(json.error || 'Error al cargar detalle')
      setEvidence(Array.isArray(json.data?.evidence) ? json.data!.evidence : [])
      setRemisiones(
        Array.isArray(json.data?.concrete_remisiones_ordered)
          ? json.data!.concrete_remisiones_ordered
          : []
      )
    } catch (e) {
      console.error(e)
      const msg = e instanceof Error ? e.message : 'Error al cargar'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setSelectedZipIds(new Set())
  }, [orderId])

  const zippableEvidenceList = useMemo(
    () => evidence.filter((e) => isConcreteEvidenceFileZippable(e.mime_type, e.original_name)),
    [evidence]
  )
  const selectedZipCount = useMemo(
    () => zippableEvidenceList.filter((e) => selectedZipIds.has(e.id)).length,
    [zippableEvidenceList, selectedZipIds]
  )

  const remisionesKey = useMemo(
    () => remisiones.map((r) => r.remision_number).join('|'),
    [remisiones]
  )

  const openFile = async (filePath: string) => {
    const url = await getSignedUrl(filePath)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else toast.error('No se pudo abrir el archivo')
  }

  const downloadFile = async (filePath: string, originalName: string) => {
    const url = await getSignedUrl(filePath)
    if (!url) {
      toast.error('No se pudo generar el enlace de descarga')
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = originalName || 'evidencia'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const closePreview = () => {
    setPreviewOpen(false)
    setPreviewFile(null)
    setPreviewUrl(null)
    setPdfMatch(null)
    setPdfMatchError(null)
    setPdfAnalyzeLoading(false)
  }

  useEffect(() => {
    setPreviewOpen(false)
    setPreviewFile(null)
    setPreviewUrl(null)
    setPdfMatch(null)
    setPdfMatchError(null)
    setPdfAnalyzeLoading(false)
  }, [orderId])

  const runPdfMatch = useCallback(
    async (file: EvidenceRow, signedUrl: string, remRows: ConcreteRemRow[]) => {
      const isPdf =
        file.mime_type === 'application/pdf' ||
        (file.original_name || '').toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        setPdfMatch(null)
        setPdfMatchError(null)
        return
      }
      setPdfAnalyzeLoading(true)
      setPdfMatchError(null)
      setPdfMatch(null)
      try {
        const res = await fetch(signedUrl)
        if (!res.ok) throw new Error('No se pudo descargar el PDF para análisis')
        const buf = await res.arrayBuffer()
        const { numbers, hadText, textLength } = await extractRemisionNumbersFromPdfArrayBuffer(buf)
        const dbNums = remRows.map((r) => r.remision_number).filter(Boolean)
        const cmp = compareRemisionSets(dbNums, numbers)
        setPdfMatch({
          ...cmp,
          hadText,
          textLength,
        })
        if (hadText && numbers.length === 0) {
          setPdfMatchError(
            'No se detectaron números de remisión con el formato esperado (FECHA : número …). Revise visualmente o use PDF escaneado sin texto.'
          )
        } else if (!hadText) {
          setPdfMatchError(
            'Este PDF no tiene texto seleccionable (posible escaneo). Compare visualmente con la lista de remisiones.'
          )
        }
      } catch (e) {
        console.error(e)
        const msg =
          e instanceof Error
            ? e.message
            : 'No se pudo analizar el PDF (CORS o formato). Use vista previa manual.'
        setPdfMatchError(msg)
        setPdfMatch(null)
      } finally {
        setPdfAnalyzeLoading(false)
      }
    },
    []
  )

  const openPreview = async (file: EvidenceRow) => {
    setPreviewFile(file)
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPdfMatch(null)
    setPdfMatchError(null)
    setPreviewUrl(null)
    try {
      const url = await getSignedUrl(file.file_path)
      if (!url) {
        toast.error('No se pudo obtener vista previa')
        setPreviewLoading(false)
        closePreview()
        return
      }
      setPreviewUrl(url)
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    if (!previewOpen || !previewFile || !previewUrl) return
    const isPdf =
      previewFile.mime_type === 'application/pdf' ||
      (previewFile.original_name || '').toLowerCase().endsWith('.pdf')
    if (!isPdf) return
    void runPdfMatch(previewFile, previewUrl, remisiones)
  }, [remisionesKey, previewOpen, previewFile, previewUrl, runPdfMatch])

  const copyList = async (key: string, label: string, items: string[]) => {
    const text = items.join(', ')
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      toast.success(`${label} copiado`)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const toggleZipSelected = (id: string) => {
    setSelectedZipIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllZippable = () => {
    setSelectedZipIds(new Set(zippableEvidenceList.map((e) => e.id)))
  }

  const clearZipSelection = () => setSelectedZipIds(new Set())

  const downloadSelectedZip = async () => {
    if (!summary) return
    const selected = zippableEvidenceList.filter((e) => selectedZipIds.has(e.id))
    if (selected.length === 0) {
      toast.error('Seleccione al menos un PDF o imagen')
      return
    }
    setZipBusy(true)
    let added = 0
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const usedPaths = new Set<string>()

      for (const ev of selected) {
        const url = await getSignedUrl(ev.file_path)
        if (!url) {
          toast.error(`Sin enlace firmado: ${ev.original_name}`)
          continue
        }
        const res = await fetch(url)
        if (!res.ok) {
          toast.error(`No se pudo descargar: ${ev.original_name}`)
          continue
        }
        const buf = await res.arrayBuffer()
        const entry = uniqueZipPath(
          sanitizeZipPathSegment(ev.original_name, 'archivo'),
          usedPaths
        )
        zip.file(entry, buf)
        added += 1
      }

      if (added === 0) {
        toast.error('No se agregó ningún archivo al ZIP')
        return
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const stamp = format(new Date(), 'yyyyMMdd-HHmm')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `evidencia-${summary.order_number}-${stamp}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
      if (added < selected.length) {
        toast.success(`ZIP generado con ${added} de ${selected.length} archivo(s)`)
      } else {
        toast.success(`ZIP con ${added} archivo(s)`)
      }
    } catch (e) {
      console.error(e)
      toast.error('No se pudo crear el ZIP')
    } finally {
      setZipBusy(false)
    }
  }

  if (!orderId || !summary) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-sm bg-[#faf9f7] min-h-[280px] lg:min-h-[calc(100vh-5rem)] w-full',
          className
        )}
      >
        <Package className="h-10 w-10 mb-2 opacity-40" />
        <p>Seleccione un pedido en la tabla para inspeccionar remisiones y archivos.</p>
      </div>
    )
  }

  const plantLabel =
    summary.plant_code || summary.plant_name
      ? [summary.plant_code, summary.plant_name].filter(Boolean).join(' · ')
      : null

  const previewIsPdf =
    previewFile &&
    (previewFile.mime_type === 'application/pdf' ||
      (previewFile.original_name || '').toLowerCase().endsWith('.pdf'))
  const previewIsImage =
    previewFile &&
    ((previewFile.mime_type || '').startsWith('image/') ||
      /\.(png|jpe?g|gif|webp)$/i.test(previewFile.original_name || ''))

  return (
    <>
      <div
        className={cn(
          'w-full flex flex-col overflow-hidden bg-card',
          className
        )}
      >
        <div className="shrink-0 px-4 py-3 border-b border-stone-200/60 bg-stone-50/80">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-stone-900 truncate">
                  Pedido {summary.order_number}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs shrink-0',
                    summary.has_evidence
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : summary.concrete_remisiones_count > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {summary.has_evidence
                    ? 'Con evidencia'
                    : summary.concrete_remisiones_count > 0
                      ? 'Falta evidencia'
                      : 'Sin remisiones'}
                </Badge>
              </div>
              {plantLabel && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{plantLabel}</p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="h-8 border-stone-300">
              <Link href={`/orders/${summary.order_id}`}>
                Ver pedido <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entrega</p>
            <p className="text-stone-800">{formatPostgresDateEs(summary.delivery_date)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</p>
            <p className="text-stone-800 break-words">{summary.client_name || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Obra</p>
            <p className="text-stone-800 break-words">{summary.construction_site || '—'}</p>
          </div>

          {loading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <>
              <Collapsible defaultOpen className="rounded-lg border border-stone-200/80 bg-stone-50/50">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-stone-800 hover:bg-stone-100/80 rounded-t-lg [&[data-state=open]_svg:last-child]:rotate-180">
                  <span className="inline-flex items-center gap-2">
                    <Truck className="h-4 w-4 text-stone-500" />
                    Remisiones concreto ({remisiones.length})
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="px-3 pb-3 space-y-2 max-h-56 overflow-y-auto">
                    {remisiones.length === 0 ? (
                      <li className="text-muted-foreground text-xs">Sin remisiones de concreto</li>
                    ) : (
                      remisiones.map((r) => (
                        <li
                          key={r.id}
                          className="rounded border border-stone-200/60 bg-background px-2 py-1.5 text-xs"
                        >
                          <div className="font-medium text-stone-900">{r.remision_number}</div>
                          <div className="text-muted-foreground text-[11px]">
                            {formatRemisionFechaForDisplay(r.fecha)}
                            {r.volumen_fabricado != null && r.volumen_fabricado !== undefined && (
                              <span className="ml-2">
                                {r.volumen_fabricado} {r.unidad || ''}
                              </span>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </CollapsibleContent>
              </Collapsible>

              <div className="rounded-lg border border-stone-200/80 bg-stone-50/50">
                <div className="px-3 py-2 font-medium text-stone-800 border-b border-stone-200/60 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-stone-500" />
                  Archivos ({evidence.length})
                </div>
                {zippableEvidenceList.length > 0 && (
                  <div className="px-3 py-2 border-b border-stone-200/60 bg-stone-100/40 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Paquete ZIP: marque PDFs o imágenes (PNG, JPG, GIF, WebP). Otros tipos: descarga
                      individual.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-stone-300 bg-white"
                        disabled={zippableEvidenceList.length === 0}
                        onClick={selectAllZippable}
                      >
                        Todos (PDF / imagen)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-stone-300 bg-white"
                        disabled={selectedZipCount === 0}
                        onClick={clearZipSelection}
                      >
                        Quitar selección
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 border-stone-300 bg-white"
                        disabled={selectedZipCount === 0 || zipBusy}
                        onClick={() => void downloadSelectedZip()}
                      >
                        {zipBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                        ZIP ({selectedZipCount})
                      </Button>
                    </div>
                  </div>
                )}
                <ul className="p-2 space-y-2">
                  {evidence.length === 0 ? (
                    <li className="text-muted-foreground text-xs px-1 py-2">Sin archivos cargados</li>
                  ) : (
                    evidence.map((ev) => {
                      const zippable = isConcreteEvidenceFileZippable(ev.mime_type, ev.original_name)
                      return (
                        <li
                          key={ev.id}
                          className="rounded-md border border-stone-200/60 bg-background p-2 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            {zippable ? (
                              <Checkbox
                                id={`ev-zip-${ev.id}`}
                                checked={selectedZipIds.has(ev.id)}
                                onCheckedChange={() => toggleZipSelected(ev.id)}
                                className="mt-0.5 border-stone-400 data-[state=checked]:bg-stone-800 data-[state=checked]:border-stone-800"
                                aria-label={`Incluir ${ev.original_name} en ZIP`}
                              />
                            ) : (
                              <span className="w-4 shrink-0" aria-hidden />
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <label
                                htmlFor={zippable ? `ev-zip-${ev.id}` : undefined}
                                className={cn(
                                  'text-xs font-medium text-stone-900 break-all line-clamp-2',
                                  zippable && 'cursor-pointer'
                                )}
                              >
                                {ev.original_name}
                              </label>
                              <div className="text-[11px] text-muted-foreground space-y-0.5">
                                <div>
                                  {ev.created_at
                                    ? format(new Date(ev.created_at), 'dd/MM/yyyy HH:mm', { locale: es })
                                    : '—'}
                                </div>
                                <div>
                                  {ev.mime_type || '—'} · {formatBytes(ev.file_size || 0)}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-6">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-stone-300 bg-white"
                              disabled={urlLoading(ev.file_path)}
                              onClick={() => openPreview(ev)}
                            >
                              {urlLoading(ev.file_path) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 mr-1" /> Vista previa
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-stone-300 bg-white"
                              disabled={urlLoading(ev.file_path)}
                              onClick={() => openFile(ev.file_path)}
                            >
                              {urlLoading(ev.file_path) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-stone-300 bg-white"
                              disabled={urlLoading(ev.file_path)}
                              onClick={() => downloadFile(ev.file_path, ev.original_name)}
                            >
                              <Download className="h-3 w-3 mr-1" /> Descargar
                            </Button>
                          </div>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          if (!open) closePreview()
        }}
      >
        <DialogContent className="max-w-[min(96vw,900px)] h-[min(90vh,800px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-base truncate pr-8">
              {previewFile?.original_name || 'Vista previa'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            <div className="flex-1 min-h-[240px] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-stone-200 bg-stone-950/5">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full min-h-[200px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : previewUrl && previewIsPdf ? (
                <iframe
                  title="Vista previa PDF"
                  src={previewUrl}
                  className="w-full h-full min-h-[320px] lg:min-h-0 border-0"
                />
              ) : previewUrl && previewIsImage ? (
                <ScrollArea className="h-full max-h-[50vh] lg:max-h-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={previewFile?.original_name || ''}
                    className="max-w-full h-auto mx-auto block"
                  />
                </ScrollArea>
              ) : previewUrl ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Vista previa no disponible para este tipo de archivo. Use Abrir o Descargar.
                </div>
              ) : null}
            </div>
            {previewIsPdf && (
              <div className="w-full lg:w-[300px] shrink-0 flex flex-col max-h-[40vh] lg:max-h-none border-t lg:border-t-0 border-stone-200 bg-stone-50/80">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-600 border-b border-stone-200/80">
                  Texto vs sistema
                </div>
                <ScrollArea className="flex-1 p-3">
                  {pdfAnalyzeLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analizando PDF…
                    </div>
                  )}
                  {pdfMatchError && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 mb-2">
                      {pdfMatchError}
                    </p>
                  )}
                  {pdfMatch && !pdfAnalyzeLoading && (
                    <div className="space-y-3 text-xs">
                      <p className="text-muted-foreground">
                        Detectados en PDF (patrón FECHA): {pdfMatch.matched.length + pdfMatch.inPdfNotDb.length}{' '}
                        · Caracteres de texto: {pdfMatch.textLength}
                      </p>
                      <MatchBlock
                        title="Coinciden"
                        items={pdfMatch.matched}
                        tone="emerald"
                        onCopy={() => copyList('m', 'Coincidencias', pdfMatch.matched)}
                        copied={copiedKey === 'm'}
                      />
                      <MatchBlock
                        title="En PDF, no en sistema"
                        items={pdfMatch.inPdfNotDb}
                        tone="amber"
                        onCopy={() => copyList('p', 'En PDF no en sistema', pdfMatch.inPdfNotDb)}
                        copied={copiedKey === 'p'}
                      />
                      <MatchBlock
                        title="En sistema, no en PDF"
                        items={pdfMatch.inDbNotPdf}
                        tone="rose"
                        onCopy={() => copyList('d', 'En sistema no en PDF', pdfMatch.inDbNotPdf)}
                        copied={copiedKey === 'd'}
                      />
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t shrink-0 flex-row justify-end gap-2">
            {previewFile && previewUrl && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile(previewFile.file_path, previewFile.original_name)}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Descargar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => openFile(previewFile.file_path)}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Nueva pestaña
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={closePreview}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MatchBlock({
  title,
  items,
  tone,
  onCopy,
  copied,
}: {
  title: string
  items: string[]
  tone: 'emerald' | 'amber' | 'rose'
  onCopy: () => void
  copied: boolean
}) {
  const border =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/50'
        : 'border-rose-200 bg-rose-50/50'
  return (
    <div className={cn('rounded-md border p-2', border)}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-medium text-stone-800">{title}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={items.length === 0}
          onClick={onCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Ninguno</p>
      ) : (
        <p className="font-mono text-[11px] break-all">{items.join(', ')}</p>
      )}
    </div>
  )
}
