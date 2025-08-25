'use client'

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  File, 
  Image as ImageIcon, 
  FileText, 
  Eye, 
  Download, 
  X,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentPreviewProps {
  url: string
  name?: string
  type?: string
  size?: number
  onRemove?: () => void
  className?: string
}

export default function DocumentPreview({
  url,
  name,
  type,
  size,
  onRemove,
  className
}: DocumentPreviewProps) {
  const [imageError, setImageError] = useState(false)

  // Extract file info from URL if not provided
  const fileName = name || url.split('/').pop() || 'Documento'
  const fileType = type || getFileTypeFromUrl(url)
  const isImage = fileType?.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  const isPdf = fileType === 'application/pdf' || url.match(/\.pdf$/i)

  function getFileTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'pdf': return 'application/pdf'
      case 'jpg':
      case 'jpeg': return 'image/jpeg'
      case 'png': return 'image/png'
      case 'gif': return 'image/gif'
      case 'webp': return 'image/webp'
      default: return 'application/octet-stream'
    }
  }

  const getFileIcon = () => {
    if (isImage) return ImageIcon
    if (isPdf) return FileText
    return File
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Error downloading file:', error)
    }
  }

  const handleView = () => {
    window.open(url, '_blank')
  }

  const Icon = getFileIcon()

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* File Preview */}
          <div className="flex-shrink-0">
            {isImage && !imageError ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={url}
                  alt={fileName}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                <Icon className="h-8 w-8 text-gray-500" />
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {fileName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {size && (
                    <span className="text-xs text-gray-500">
                      {formatFileSize(size)}
                    </span>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {isPdf ? 'PDF' : isImage ? 'IMG' : 'FILE'}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleView}
                  className="h-8 w-8 p-0"
                  title="Ver documento"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 w-8 p-0"
                  title="Descargar"
                >
                  <Download className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(url, '_blank')}
                  className="h-8 w-8 p-0"
                  title="Abrir en nueva pestaña"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>

                {onRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRemove}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    title="Remover"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* URL for reference (truncated) */}
            <p className="text-xs text-gray-400 mt-2 truncate">
              {url}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
