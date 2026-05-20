'use client'

import React, { useState } from 'react'
import { FileSpreadsheet, ImageIcon, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileUploader } from '@/components/ui/file-uploader'
import { PhotoEvidencePicker } from '@/components/quality/PhotoEvidencePicker'
import { SrFileViewer } from '@/components/quality/SrFileViewer'
import { cn } from '@/lib/utils'

export type EnsayoEvidencePanelProps = {
  photoFiles: File[]
  onPhotoFilesChange: (files: File[]) => void
  sr3Files: File[]
  onSr3FilesChange: (files: File[]) => void
  onSr3Selected?: (files: File[]) => void | Promise<void>
  sr3Parsing?: boolean
  disabled?: boolean
  maxPhotos?: number
  className?: string
}

export function EnsayoEvidencePanel({
  photoFiles,
  onPhotoFilesChange,
  sr3Files,
  onSr3FilesChange,
  onSr3Selected,
  sr3Parsing = false,
  disabled = false,
  maxPhotos = 5,
  className,
}: EnsayoEvidencePanelProps) {
  const [tab, setTab] = useState<'photos' | 'machine'>('photos')
  const attachmentCount = photoFiles.length + sr3Files.length

  return (
    <div className={cn('rounded-lg border border-dashed border-stone-300 bg-stone-50/50 p-4', className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Prueba del ensayo</h3>
          <p className="text-xs text-stone-500 mt-0.5 leading-snug">
            Fotos del espécimen o pantalla de prensa. El archivo .sr3 es opcional y puede llenar la
            carga automáticamente.
          </p>
        </div>
        {attachmentCount > 0 && (
          <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 tabular-nums">
            {attachmentCount} adjunto{attachmentCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'photos' | 'machine')}>
        <TabsList className="grid w-full grid-cols-2 h-9 bg-stone-100/80 p-0.5">
          <TabsTrigger
            value="photos"
            className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <ImageIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            Fotos
            {photoFiles.length > 0 && (
              <span className="ml-1.5 text-[10px] font-mono text-stone-500">
                {photoFiles.length}/{maxPhotos}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="machine"
            className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            Máquina (.sr3)
            {sr3Files.length > 0 && (
              <span className="ml-1.5 text-[10px] font-mono text-stone-500">1</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-4 space-y-0">
          <PhotoEvidencePicker
            files={photoFiles}
            onChange={onPhotoFilesChange}
            maxFiles={maxPhotos}
            disabled={disabled}
          />
        </TabsContent>

        <TabsContent value="machine" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-800">Archivo de máquina</span>
            {sr3Parsing && (
              <Loader2 className="h-4 w-4 animate-spin text-sky-700 ml-auto" />
            )}
          </div>
          <FileUploader
            accept=".sr3"
            maxFiles={1}
            maxSize={10 * 1024 * 1024}
            onFilesSelected={(files) => {
              onSr3FilesChange(files)
              void onSr3Selected?.(files)
            }}
          />
          {sr3Files.length > 0 && sr3Files[0].name.toLowerCase().endsWith('.sr3') && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-stone-500">Vista previa de curva</p>
              <SrFileViewer file={sr3Files[0]} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
