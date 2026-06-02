'use client'

import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  ArrowUpRight,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  evidenciaFallbackUrl,
  evidenciaPublicUrl,
  type NormalizedEvidencia,
} from '@/lib/quality/ensayoEvidence'
import { SrFileViewer } from '@/components/quality/SrFileViewer'

type EnsayoEvidenceGalleryProps = {
  evidencias: NormalizedEvidencia[]
  className?: string
  id?: string
  uploadSlot?: React.ReactNode
  canDelete?: boolean
  onDelete?: (evidenciaId: string) => Promise<void>
}

export function EnsayoEvidenceGallery({
  evidencias,
  className,
  id = 'evidencias',
  uploadSlot,
  canDelete = false,
  onDelete,
}: EnsayoEvidenceGalleryProps) {
  const photos = useMemo(() => evidencias.filter((e) => e.isImage), [evidencias])
  const machineFiles = useMemo(
    () => evidencias.filter((e) => e.isSr3 || (!e.isImage && !e.isSr3)),
    [evidencias]
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightbox, setLightbox] = useState<NormalizedEvidencia | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [sr3Preview, setSr3Preview] = useState<NormalizedEvidencia | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NormalizedEvidencia | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const showDelete = canDelete && !!onDelete
  const deleteBusy = deletingId !== null

  const hero = photos[activeIndex]
  const heroUrl = hero ? evidenciaPublicUrl(hero._path) : null
  const photoCount = photos.length
  const hasMultiplePhotos = photoCount > 1

  const goToPhoto = React.useCallback(
    (index: number) => {
      if (photoCount === 0) return
      const next = ((index % photoCount) + photoCount) % photoCount
      setActiveIndex(next)
    },
    [photoCount]
  )

  const openLightbox = React.useCallback(
    (ev: NormalizedEvidencia) => {
      setLightbox(ev)
      setLightboxSrc(evidenciaPublicUrl(ev._path))
    },
    []
  )

  React.useEffect(() => {
    if (activeIndex >= photos.length && photos.length > 0) {
      setActiveIndex(photos.length - 1)
    }
  }, [activeIndex, photos.length])

  async function confirmDelete() {
    if (!deleteTarget || !onDelete) return
    setDeletingId(deleteTarget.id)
    setDeleteError(null)
    try {
      await onDelete(deleteTarget.id)
      setDeleteTarget(null)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  function DeleteEvidenceButton({
    ev,
    className: btnClassName,
    variant = 'outline' as const,
    compact = false,
  }: {
    ev: NormalizedEvidencia
    className?: string
    variant?: 'outline' | 'ghost'
    compact?: boolean
  }) {
    if (!showDelete) return null
    const busy = deletingId === ev.id
    return (
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={cn(
          'h-8 gap-1.5 text-xs',
          variant === 'outline' &&
            'border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800',
          variant === 'ghost' && 'text-red-700 hover:bg-red-50 hover:text-red-800',
          btnClassName
        )}
        disabled={deleteBusy}
        aria-label={`Eliminar ${ev.nombre_archivo}`}
        onClick={(e) => {
          e.stopPropagation()
          setDeleteError(null)
          setDeleteTarget(ev)
        }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {!compact && <span className="hidden sm:inline">Eliminar</span>}
      </Button>
    )
  }

  function PhotoNavButton({
    direction,
    onClick,
  }: {
    direction: 'prev' | 'next'
    onClick: () => void
  }) {
    const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
    return (
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn(
          'absolute top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full border border-stone-200/80 bg-white/95 shadow-md hover:bg-white',
          direction === 'prev' ? 'left-2' : 'right-2'
        )}
        disabled={deleteBusy}
        aria-label={direction === 'prev' ? 'Foto anterior' : 'Foto siguiente'}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <Icon className="h-5 w-5 text-stone-700" />
      </Button>
    )
  }

  return (
    <>
      <Card id={id} className={cn('border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]', className)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileImage className="h-5 w-5 text-stone-600" />
            Evidencias del ensayo
          </CardTitle>
          <CardDescription>Fotografías y archivos técnicos adjuntos al registro</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {uploadSlot}
          {evidencias.length === 0 ? (
            <div className="border border-dashed border-stone-200 bg-stone-50/50 rounded-lg py-10 px-4 text-center">
              <FileImage className="h-12 w-12 text-stone-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-stone-900 mb-1">Sin evidencias</p>
              <p className="text-sm text-stone-500">
                {uploadSlot
                  ? 'Use el formulario de arriba para agregar fotos a este ensayo.'
                  : 'No se adjuntaron fotos ni archivos al registrar este ensayo.'}
              </p>
            </div>
          ) : (
            <>
              {photos.length > 0 && hero && (
                <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50/60 shadow-inner">
                  <div className="flex flex-wrap items-center gap-2 border-b border-stone-200/80 bg-white px-3 py-2.5">
                    <p className="min-w-0 flex-1 text-sm font-medium text-stone-800 truncate">
                      {hero.nombre_archivo}
                    </p>
                    {hasMultiplePhotos && (
                      <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-600">
                        {activeIndex + 1} / {photoCount}
                      </span>
                    )}
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={deleteBusy}
                        onClick={() => openLightbox(hero)}
                      >
                        <Maximize2 className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">Ampliar</span>
                      </Button>
                      <DeleteEvidenceButton ev={hero} variant="outline" />
                    </div>
                  </div>

                  <div className="relative bg-[linear-gradient(45deg,#e7e5e4_25%,transparent_25%),linear-gradient(-45deg,#e7e5e4_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e7e5e4_75%),linear-gradient(-45deg,transparent_75%,#e7e5e4_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px] bg-stone-100">
                    <div className="relative mx-auto flex min-h-[min(52vw,320px)] max-h-[min(70vh,560px)] w-full items-center justify-center p-3 sm:min-h-[360px] sm:p-6">
                      {hasMultiplePhotos && (
                        <PhotoNavButton direction="prev" onClick={() => goToPhoto(activeIndex - 1)} />
                      )}
                      <button
                        type="button"
                        className="relative flex h-full w-full max-w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-100 rounded-lg"
                        onClick={() => openLightbox(hero)}
                        aria-label="Ver foto en pantalla completa"
                      >
                        {heroUrl && (
                          <Image
                            src={heroUrl}
                            alt={hero.nombre_archivo}
                            width={1600}
                            height={1200}
                            className="max-h-[min(68vh,520px)] w-auto max-w-full object-contain drop-shadow-sm"
                            unoptimized
                            priority
                          />
                        )}
                      </button>
                      {hasMultiplePhotos && (
                        <PhotoNavButton direction="next" onClick={() => goToPhoto(activeIndex + 1)} />
                      )}
                    </div>
                    <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] text-white/90 sm:hidden">
                      Toca para ampliar
                    </p>
                  </div>

                  {hasMultiplePhotos && (
                    <div className="border-t border-stone-200/80 bg-white px-3 py-3">
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-500">
                        Todas las fotos
                      </p>
                      <div className="flex gap-2.5 overflow-x-auto pb-0.5 snap-x snap-mandatory">
                        {photos.map((ev, idx) => {
                          const thumb = evidenciaPublicUrl(ev._path)
                          const selected = idx === activeIndex
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => setActiveIndex(idx)}
                              className={cn(
                                'group relative h-[4.5rem] w-[4.5rem] shrink-0 snap-start overflow-hidden rounded-lg border-2 transition-all sm:h-24 sm:w-24',
                                selected
                                  ? 'border-sky-600 ring-2 ring-sky-600/25 shadow-md scale-[1.02]'
                                  : 'border-stone-200 opacity-75 hover:opacity-100 hover:border-stone-300'
                              )}
                              aria-label={`Ver foto ${idx + 1}: ${ev.nombre_archivo}`}
                              aria-current={selected ? 'true' : undefined}
                            >
                              <Image
                                src={thumb}
                                alt={ev.nombre_archivo}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                              <span
                                className={cn(
                                  'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-1 text-[9px] font-medium text-white truncate opacity-0 transition-opacity',
                                  selected && 'opacity-100',
                                  'group-hover:opacity-100'
                                )}
                              >
                                {idx + 1}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {machineFiles.length > 0 && (
                <div className="space-y-2 border-t border-stone-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Archivos técnicos
                  </p>
                  <ul className="space-y-2">
                    {machineFiles.map((ev) => {
                      const href = evidenciaPublicUrl(ev._path)
                      return (
                        <li
                          key={ev.id}
                          className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2.5"
                        >
                          {ev.isSr3 ? (
                            <FileSpreadsheet className="h-5 w-5 text-sky-700 shrink-0" />
                          ) : (
                            <FileText className="h-5 w-5 text-stone-500 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-stone-800 truncate">
                              {ev.nombre_archivo}
                            </p>
                            <p className="text-xs text-stone-500">{Math.round(ev.tamano_kb)} KB</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {ev.isSr3 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={deleteBusy}
                                onClick={() => setSr3Preview(ev)}
                              >
                                Ver curva
                              </Button>
                            )}
                            {href && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={deleteBusy}
                                asChild
                              >
                                <a href={href} target="_blank" rel="noopener noreferrer">
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            <DeleteEvidenceButton ev={ev} variant="ghost" compact />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!lightbox}
        onOpenChange={(o) => {
          if (!o) {
            setLightbox(null)
            setLightboxSrc(null)
          }
        }}
      >
        <DialogContent className="max-w-[min(96vw,1100px)] p-0 gap-0 overflow-hidden bg-stone-950 border-stone-800">
          <DialogHeader className="flex flex-row items-center gap-2 border-b border-stone-800 p-3 sm:p-4">
            <DialogTitle className="min-w-0 flex-1 text-stone-100 text-base truncate">
              {lightbox?.nombre_archivo}
            </DialogTitle>
            {lightbox && hasMultiplePhotos && (
              <span className="shrink-0 text-xs tabular-nums text-stone-400">
                {photos.findIndex((p) => p.id === lightbox.id) + 1} / {photoCount}
              </span>
            )}
          </DialogHeader>
          <div className="relative flex min-h-[50vh] max-h-[85vh] w-full items-center justify-center bg-black px-10 sm:px-14">
            {lightbox && lightboxSrc && (
              <Image
                src={lightboxSrc}
                alt={lightbox.nombre_archivo}
                width={1600}
                height={1200}
                className="max-h-[85vh] w-auto h-auto max-w-full object-contain"
                unoptimized
                onError={() => {
                  const fb = evidenciaFallbackUrl(lightbox._path)
                  if (fb && fb !== lightboxSrc) setLightboxSrc(fb)
                }}
              />
            )}
            {lightbox && hasMultiplePhotos && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full text-stone-200 hover:bg-white/10 hover:text-white"
                  aria-label="Foto anterior"
                  onClick={() => {
                    const idx = photos.findIndex((p) => p.id === lightbox.id)
                    const prev = photos[(idx - 1 + photoCount) % photoCount]
                    goToPhoto(idx - 1)
                    openLightbox(prev)
                  }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full text-stone-200 hover:bg-white/10 hover:text-white"
                  aria-label="Foto siguiente"
                  onClick={() => {
                    const idx = photos.findIndex((p) => p.id === lightbox.id)
                    const next = photos[(idx + 1) % photoCount]
                    goToPhoto(idx + 1)
                    openLightbox(next)
                  }}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sr3Preview} onOpenChange={(o) => !o && setSr3Preview(null)}>
        <DialogContent className="max-w-[min(96vw,960px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{sr3Preview?.nombre_archivo}</DialogTitle>
          </DialogHeader>
          {sr3Preview && (
            <Sr3FileFromUrl path={sr3Preview._path} fileName={sr3Preview.nombre_archivo} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent className="border-stone-200">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta evidencia?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="text-sm text-stone-600">
                Se eliminará{' '}
                <span className="font-medium text-stone-900">{deleteTarget?.nombre_archivo}</span>.
                Esta acción no se puede deshacer.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              className="bg-red-700 hover:bg-red-800 focus:ring-red-700"
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleteBusy ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Sr3FileFromUrl({ path, fileName }: { path: string; fileName: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const url = evidenciaPublicUrl(path)
    void fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar el archivo')
        return r.blob()
      })
      .then((blob) => {
        if (cancelled) return
        setFile(new File([blob], fileName, { type: blob.type || 'application/octet-stream' }))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar')
      })
    return () => {
      cancelled = true
    }
  }, [path, fileName])

  if (error) {
    return <p className="text-sm text-red-600 py-4">{error}</p>
  }
  if (!file) {
    return <p className="text-sm text-stone-500 py-8 text-center">Cargando curva…</p>
  }
  return <SrFileViewer file={file} />
}
