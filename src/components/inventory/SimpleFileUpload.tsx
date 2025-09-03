'use client'

import React, { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  File, 
  Image as ImageIcon, 
  FileText, 
  X,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SimpleFileUploadProps {
  onFileSelect: (files: FileList) => void
  acceptedTypes?: string[]
  multiple?: boolean
  maxFiles?: number
  maxSize?: number // in MB
  uploading?: boolean
  disabled?: boolean
  className?: string
}

interface UploadedFile {
  name: string
  size: number
  type: string
  url?: string
}

export default function SimpleFileUpload({
  onFileSelect,
  acceptedTypes = ['image/*', 'application/pdf'],
  multiple = true,
  maxFiles = 5,
  maxSize = 10,
  uploading = false,
  disabled = false,
  className
}: SimpleFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon
    if (type === 'application/pdf') return FileText
    return File
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const validateFiles = (files: FileList): { valid: File[], errors: string[] } => {
    const valid: File[] = []
    const newErrors: string[] = []

    if (files.length > maxFiles) {
      newErrors.push(`Máximo ${maxFiles} archivo(s) permitido(s)`)
      return { valid, errors: newErrors }
    }

    Array.from(files).forEach((file) => {
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        newErrors.push(`${file.name}: Tamaño máximo ${maxSize}MB`)
        return
      }

      // Check file type
      const isValidType = acceptedTypes.some(type => {
        if (type.includes('*')) {
          const baseType = type.split('/')[0]
          return file.type.startsWith(baseType + '/')
        }
        return file.type === type
      })

      if (!isValidType) {
        newErrors.push(`${file.name}: Tipo de archivo no permitido`)
        return
      }

      valid.push(file)
    })

    return { valid, errors: newErrors }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (disabled || uploading) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelection(files)
    }
  }

  const handleFileSelection = (files: FileList) => {
    const { valid, errors } = validateFiles(files)
    setErrors(errors)

    if (valid.length > 0) {
      const newFiles: UploadedFile[] = valid.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
      setUploadedFiles(prev => [...prev, ...newFiles])
      
      const dataTransfer = new DataTransfer()
      valid.forEach(file => dataTransfer.items.add(file))
      onFileSelect(dataTransfer.files)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files)
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearErrors = () => {
    setErrors([])
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Area */}
      <Card 
        className={cn(
          'border-dashed border-2 transition-colors cursor-pointer',
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
          disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400',
          errors.length > 0 ? 'border-red-300 bg-red-50' : ''
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-8">
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <p className="text-sm text-gray-600">Subiendo archivos...</p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 text-center mb-2">
                <span className="font-medium">Haga clic para subir</span> o arrastre archivos aquí
              </p>
              <p className="text-xs text-gray-500 text-center">
                {acceptedTypes.includes('image/*') && 'Imágenes, '}
                {acceptedTypes.includes('application/pdf') && 'PDF, '}
                máximo {maxSize}MB por archivo
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearErrors}
                type="button"
                className="ml-auto h-auto p-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Archivos seleccionados ({uploadedFiles.length})
          </h4>
          {uploadedFiles.map((file, index) => {
            const Icon = getFileIcon(file.type)
            return (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Icon className="h-5 w-5 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {file.type.split('/')[1]?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                {file.url ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    type="button"
                    className="h-auto p-1"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Instructions */}
      <div className="text-xs text-gray-500">
        <p>• Formatos permitidos: {acceptedTypes.join(', ')}</p>
        <p>• Tamaño máximo por archivo: {maxSize}MB</p>
        <p>• Máximo {maxFiles} archivo(s) por entrada</p>
      </div>
    </div>
  )
}
