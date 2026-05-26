'use client'

import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmaVerificacionReportToolbar({
  backHref,
  backLabel = 'Volver',
  title,
  onDownloadPdf,
  onOpenPdf,
  downloading = false,
  disabled = false,
}: {
  backHref: string
  backLabel?: string
  title: string
  onDownloadPdf: () => void | Promise<void>
  onOpenPdf?: () => void | Promise<void>
  downloading?: boolean
  disabled?: boolean
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1.5" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <h1 className="text-sm font-semibold text-stone-800 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onOpenPdf && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-stone-300"
            disabled={disabled || downloading}
            onClick={() => void onOpenPdf()}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir PDF
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          className="gap-1.5 bg-[#1B365D] hover:bg-[#142848] text-white"
          disabled={disabled || downloading}
          onClick={() => void onDownloadPdf()}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? 'Generando…' : 'Descargar PDF'}
        </Button>
      </div>
    </div>
  )
}
