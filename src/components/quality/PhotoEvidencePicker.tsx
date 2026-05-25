'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, ImagePlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isEnsayoImageFile } from '@/lib/quality/ensayoEvidence'

type PhotoEvidencePickerProps = {
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
  maxSizeBytes?: number
  disabled?: boolean
  className?: string
}

export function PhotoEvidencePicker({
  files,
  onChange,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024,
  disabled = false,
  className,
}: PhotoEvidencePickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviewUrls(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  const addFiles = (incoming: FileList | File[]) => {
    const newErrors: string[] = []
    const valid: File[] = []

    for (const file of Array.from(incoming)) {
      if (!isEnsayoImageFile(file)) {
        newErrors.push(`"${file.name}" no es una imagen válida.`)
        continue
      }
      if (file.size > maxSizeBytes) {
        newErrors.push(
          `"${file.name}" excede ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`
        )
        continue
      }
      valid.push(file)
    }

    const merged = [...files, ...valid]
    if (merged.length > maxFiles) {
      newErrors.push(`Máximo ${maxFiles} fotos por ensayo.`)
      onChange(merged.slice(0, maxFiles))
    } else {
      onChange(merged)
    }

    setErrors(newErrors)
  }

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
    setErrors([])
  }

  const resetInput = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) ref.current.value = ''
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || files.length >= maxFiles}
          className="h-10 touch-manipulation border-stone-300 bg-white text-stone-800 shadow-none hover:bg-stone-50"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-2" />
          Tomar foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || files.length >= maxFiles}
          className="h-10 touch-manipulation border-stone-300 bg-white text-stone-800 shadow-none hover:bg-stone-50"
          onClick={() => galleryInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4 mr-2" />
          Subir fotos
        </Button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files)
          resetInput(cameraInputRef)
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files)
          resetInput(galleryInputRef)
        }}
      />

      <p className="text-xs text-stone-500">
        JPG, PNG o WebP · máximo {Math.round(maxSizeBytes / (1024 * 1024))} MB por foto · hasta{' '}
        {maxFiles} fotos
      </p>

      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map((err) => (
            <li key={err} className="text-sm text-red-600">
              {err}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
            >
              {previewUrls[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrls[index]}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 rounded-full bg-white/90 shadow-sm hover:bg-white"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={`Quitar ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <p className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                {file.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
