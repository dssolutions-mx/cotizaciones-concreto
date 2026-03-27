'use client'

import { useCallback, useState } from 'react'
import { Upload, X, FileText, Image as ImageIcon, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { uploadDocument } from '@/lib/utils/upload'

interface EmaFileUploadProps {
  value: string
  onChange: (path: string) => void
  bucket?: string
  folder?: string
  accept?: string[]
  maxSize?: number
  label?: string
}

function getFilename(url: string): string {
  try {
    const decoded = decodeURIComponent(url)
    return decoded.split('/').pop() ?? url
  } catch {
    return url.split('/').pop() ?? url
  }
}

function getFileTypeBadge(url: string) {
  const name = getFilename(url).toLowerCase()
  if (name.endsWith('.pdf')) {
    return (
      <Badge variant="outline" className="text-xs border-stone-300 text-stone-600 gap-1">
        <FileText className="h-3 w-3" />
        PDF
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-xs border-stone-300 text-stone-600 gap-1">
      <ImageIcon className="h-3 w-3" />
      IMG
    </Badge>
  )
}

export function EmaFileUpload({
  value,
  onChange,
  folder,
  accept = ['application/pdf', 'image/*'],
  maxSize = 10,
  label,
}: EmaFileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(
    (file: File): string | null => {
      const matchesType = accept.some((type) => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', '/'))
        }
        return file.type === type
      })
      if (!matchesType) return `Tipo de archivo no permitido. Acepta: ${accept.join(', ')}`
      if (file.size > maxSize * 1024 * 1024) return `El archivo supera el límite de ${maxSize} MB`
      return null
    },
    [accept, maxSize]
  )

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      const validationError = validate(file)
      if (validationError) {
        setError(validationError)
        return
      }
      setLoading(true)
      try {
        const url = await uploadDocument(file, 'ema', { folder, maxSize, allowedTypes: accept })
        onChange(url)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al subir el archivo')
      } finally {
        setLoading(false)
      }
    },
    [validate, folder, maxSize, accept, onChange]
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
        <CheckCircle className="h-4 w-4 text-stone-400 shrink-0" />
        <span className="flex-1 truncate text-sm text-stone-700" title={getFilename(value)}>
          {getFilename(value)}
        </span>
        {getFileTypeBadge(value)}
        <button
          type="button"
          onClick={() => onChange('')}
          className="ml-1 rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
          aria-label="Quitar archivo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 transition-colors',
          dragging
            ? 'border-stone-400 bg-stone-100'
            : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          className="sr-only"
          accept={accept.join(',')}
          onChange={onInputChange}
          disabled={loading}
        />
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        ) : (
          <Upload className="h-5 w-5 text-stone-400" />
        )}
        <span className="text-sm text-stone-500">
          {loading ? 'Subiendo…' : (label ?? 'Arrastra o selecciona archivo')}
        </span>
        {!loading && (
          <span className="text-xs text-stone-400">
            {accept.map((t) => t.split('/').pop()?.toUpperCase()).join(', ')} · máx. {maxSize} MB
          </span>
        )}
      </label>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
