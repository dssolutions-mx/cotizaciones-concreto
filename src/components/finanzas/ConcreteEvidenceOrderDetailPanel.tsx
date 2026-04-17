'use client'

import React, { useCallback, useEffect, useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useSignedUrls } from '@/hooks/useSignedUrls'
import { parseJsonResponse } from '@/lib/http/safeJsonResponse'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
      setEvidence(
        Array.isArray(json.data?.evidence) ? json.data!.evidence : []
      )
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

  if (!orderId || !summary) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-sm border-l border-border/60 bg-muted/20',
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

  return (
    <div
      className={cn(
        'w-full lg:w-[360px] xl:w-[400px] shrink-0 flex flex-col overflow-hidden border-l border-border/60 bg-card max-h-[calc(100vh-8rem)] lg:max-h-[min(85vh,900px)]',
        className
      )}
    >
      <div className="shrink-0 px-4 py-3 border-b border-border/40 bg-stone-50/60">
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
          <Button variant="outline" size="sm" asChild className="h-8">
            <Link href={`/orders/${summary.order_id}`}>
              Ver pedido <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entrega</p>
          <p className="text-stone-800">
            {summary.delivery_date
              ? format(new Date(summary.delivery_date), 'dd/MM/yyyy', { locale: es })
              : '—'}
          </p>
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
            <Collapsible defaultOpen className="rounded-lg border border-border/60 bg-stone-50/40">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-stone-800 hover:bg-stone-100/80 rounded-t-lg [&[data-state=open]_svg:last-child]:rotate-180">
                <span className="inline-flex items-center gap-2">
                  <Truck className="h-4 w-4 text-stone-500" />
                  Remisiones concreto ({remisiones.length})
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
                  {remisiones.length === 0 ? (
                    <li className="text-muted-foreground text-xs">Sin remisiones de concreto</li>
                  ) : (
                    remisiones.map((r) => (
                      <li
                        key={r.id}
                        className="rounded border border-border/50 bg-background px-2 py-1.5 text-xs"
                      >
                        <div className="font-medium text-stone-900">{r.remision_number}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {r.fecha
                            ? format(new Date(r.fecha), 'dd/MM/yyyy HH:mm', { locale: es })
                            : '—'}
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

            <div className="rounded-lg border border-border/60 bg-stone-50/40">
              <div className="px-3 py-2 font-medium text-stone-800 border-b border-border/40 flex items-center gap-2">
                <FileText className="h-4 w-4 text-stone-500" />
                Archivos ({evidence.length})
              </div>
              <ul className="p-2 space-y-2">
                {evidence.length === 0 ? (
                  <li className="text-muted-foreground text-xs px-1 py-2">Sin archivos cargados</li>
                ) : (
                  evidence.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-md border border-border/50 bg-background p-2 space-y-2"
                    >
                      <div className="text-xs font-medium text-stone-900 break-all line-clamp-2">
                        {ev.original_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ev.created_at
                          ? format(new Date(ev.created_at), 'dd/MM/yyyy HH:mm', { locale: es })
                          : '—'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
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
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={urlLoading(ev.file_path)}
                          onClick={() => downloadFile(ev.file_path, ev.original_name)}
                        >
                          <Download className="h-3 w-3 mr-1" /> Descargar
                        </Button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
