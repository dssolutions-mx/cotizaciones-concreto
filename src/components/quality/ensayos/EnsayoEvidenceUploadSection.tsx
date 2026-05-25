'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PhotoEvidencePicker } from '@/components/quality/PhotoEvidencePicker'
import { uploadEnsayoEvidencias } from '@/services/qualityEnsayoService'
import type { EnsayoEvidenceUploadResult } from '@/lib/quality/ensayoEvidence'
import { qualityHubPrimaryButtonClass, qualityHubOutlineNeutralClass } from '@/components/quality/qualityHubUi'
import { cn } from '@/lib/utils'

type Props = {
  ensayoId: string
  onUploaded?: () => void
  maxPhotos?: number
  className?: string
}

export function EnsayoEvidenceUploadSection({
  ensayoId,
  onUploaded,
  maxPhotos = 5,
  className,
}: Props) {
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<EnsayoEvidenceUploadResult | null>(null)

  async function handleUpload() {
    if (photoFiles.length === 0) return
    setUploading(true)
    setError(null)
    setLastResult(null)
    try {
      const result = await uploadEnsayoEvidencias(ensayoId, { photos: photoFiles })
      setLastResult(result)
      if (result.uploaded > 0) {
        setPhotoFiles([])
        onUploaded?.()
      }
      if (result.failed.length > 0 && result.uploaded === 0) {
        setError(
          result.failed.map((f) => `${f.name}: ${f.error}`).join(' · ')
        )
      } else if (result.failed.length > 0) {
        setError(
          `Se subieron ${result.uploaded} foto(s). Falló: ${result.failed.map((f) => f.name).join(', ')}`
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir fotos')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn('rounded-lg border border-dashed border-stone-300 bg-stone-50/60 p-4 space-y-3', className)}>
      <div>
        <p className="text-sm font-semibold text-stone-900">Agregar fotos</p>
        <p className="text-xs text-stone-500 mt-0.5">
          Las fotos se guardan en el ensayo y aparecen en la galería de evidencias.
        </p>
      </div>
      <PhotoEvidencePicker files={photoFiles} onChange={setPhotoFiles} maxFiles={maxPhotos} disabled={uploading} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className={cn(qualityHubPrimaryButtonClass, 'h-9')}
          disabled={uploading || photoFiles.length === 0}
          onClick={() => void handleUpload()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Subir fotos'}
        </Button>
        {photoFiles.length > 0 && !uploading && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(qualityHubOutlineNeutralClass, 'h-9')}
            onClick={() => {
              setPhotoFiles([])
              setError(null)
            }}
          >
            Cancelar
          </Button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {lastResult && lastResult.uploaded > 0 && lastResult.failed.length === 0 && (
        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {lastResult.uploaded} foto{lastResult.uploaded === 1 ? '' : 's'} guardada
          {lastResult.uploaded === 1 ? '' : 's'} correctamente.
        </p>
      )}
    </div>
  )
}
