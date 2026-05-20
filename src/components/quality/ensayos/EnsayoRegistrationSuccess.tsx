'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, FileSpreadsheet } from 'lucide-react'
import type { EnsayoEvidenceUploadResult } from '@/lib/quality/ensayoEvidence'

type EnsayoRegistrationSuccessProps = {
  resistencia: number
  porcentaje: number
  photoFiles: File[]
  sr3Count: number
  ensayoId: string
  muestreoId?: string
  evidenceUpload?: EnsayoEvidenceUploadResult
}

export function EnsayoRegistrationSuccess({
  resistencia,
  porcentaje,
  photoFiles,
  sr3Count,
  ensayoId,
  muestreoId,
  evidenceUpload,
}: EnsayoRegistrationSuccessProps) {
  const [thumbUrls, setThumbUrls] = useState<string[]>([])

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f))
    setThumbUrls(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [photoFiles])

  const uploadWarning =
    evidenceUpload &&
    evidenceUpload.failed.length > 0 &&
    `Se guardó el ensayo, pero ${evidenceUpload.failed.length} archivo(s) no se subieron.`

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50/95 to-white p-5 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-100 p-2 shrink-0">
          <CheckCircle2 className="h-6 w-6 text-emerald-700" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-emerald-950">Ensayo registrado</p>
          <p className="text-sm text-emerald-900/90 mt-0.5 font-mono tabular-nums">
            {resistencia.toFixed(3)} kg/cm² · {porcentaje.toFixed(2)}% cumplimiento
          </p>
        </div>
      </div>

      {(photoFiles.length > 0 || sr3Count > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Evidencia capturada
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {thumbUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={photoFiles[i]?.name ?? `Foto ${i + 1}`}
                className="h-14 w-14 rounded-lg border border-stone-200 object-cover shadow-sm"
              />
            ))}
            {sr3Count > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700">
                <FileSpreadsheet className="h-4 w-4 text-sky-700" />
                {sr3Count} archivo .sr3
              </span>
            )}
          </div>
        </div>
      )}

      {uploadWarning && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {uploadWarning}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Button
          className="h-11 flex-1 bg-sky-700 hover:bg-sky-800 text-white shadow-none touch-manipulation"
          asChild
        >
          <Link href={`/quality/ensayos/${ensayoId}#evidencias`}>Ver ensayo completo</Link>
        </Button>
        {muestreoId && (
          <Button
            variant="outline"
            className="h-11 flex-1 border-stone-300 bg-white shadow-none touch-manipulation"
            asChild
          >
            <Link href={`/quality/muestreos/${muestreoId}`}>Volver al muestreo</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
