'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CertificadoCalibracion } from '@/types/ema'

type CertificadoCalibracionConPdf = CertificadoCalibracion & { pdf_url: string | null }
import { cn } from '@/lib/utils'

type UploadResponse = { data?: { archivo_path?: string; original_name?: string | null } }
type PatchResponse = { data?: CertificadoCalibracionConPdf; error?: string }

export function EmaCalibracionCertificadoAttachBlock({
  instrumentoId,
  certId,
  onSuccess,
  compact = false,
  className,
}: {
  instrumentoId: string
  certId: string
  onSuccess: (c: CertificadoCalibracionConPdf) => void
  /** Smaller copy for list rows (single-line intent). */
  compact?: boolean
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const run = async (file: File) => {
    setBusy(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch(`/api/ema/instrumentos/${instrumentoId}/certificados/upload`, { method: 'POST', body: fd })
      const uj: UploadResponse & { error?: string } = await up.json().catch(() => ({}))
      if (!up.ok) throw new Error(uj.error ?? 'Error al subir el PDF')
      const path = uj.data?.archivo_path
      const originalName = uj.data?.original_name ?? file.name
      if (!path) throw new Error('Respuesta inválida del servidor')

      const patch = await fetch(`/api/ema/instrumentos/${instrumentoId}/certificados/${certId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivo_path: path, archivo_nombre_original: originalName || null }),
      })
      const pj: PatchResponse = await patch.json().catch(() => ({}))
      if (!patch.ok) throw new Error(pj.error ?? 'Error al vincular el PDF al certificado')
      if (!pj.data) throw new Error('Respuesta inválida del servidor')
      onSuccess(pj.data)
      setMessage({ ok: true, text: 'PDF vinculado a este registro.' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Error' })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('space-y-1', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void run(f)
        }}
      />
      <div className={cn('flex gap-2', compact ? 'items-center flex-wrap' : 'flex-col sm:flex-row sm:items-center')}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('border-sky-300 text-sky-900 gap-1.5', compact ? 'h-7 text-xs px-2' : 'h-8')}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? 'Subiendo…' : compact ? 'Subir / reemplazar PDF' : 'Subir o reemplazar PDF'}
        </Button>
        {!compact && (
          <span className="text-[11px] text-stone-500">
            El PDF se guarda en este mismo registro del historial (no crea un certificado nuevo).
          </span>
        )}
      </div>
      {message && (
        <p className={message.ok ? 'text-xs text-emerald-700' : 'text-xs text-red-700'}>{message.text}</p>
      )}
    </div>
  )
}
