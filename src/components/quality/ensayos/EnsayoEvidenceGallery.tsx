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
import { FileImage, FileSpreadsheet, FileText, ArrowUpRight, Loader2, Trash2 } from 'lucide-react'
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
    size = 'sm' as const,
  }: {
    ev: NormalizedEvidencia
    className?: string
    size?: 'sm' | 'icon'
  }) {
    if (!showDelete) return null
    const busy = deletingId === ev.id
    return (
      <Button
        type="button"
        variant="outline"
        size={size === 'icon' ? 'icon' : 'sm'}
        className={cn(
          size === 'icon' ? 'h-8 w-8' : 'h-8 text-xs',
          'border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800',
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
              {photos.length > 0 && (
                <div className="space-y-3">
                  <div className="relative">
                    <button
                      type="button"
                      className="relative w-full aspect-[16/10] overflow-hidden rounded-xl border border-stone-200 bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                      onClick={() => {
                        if (!hero) return
                        setLightbox(hero)
                        setLightboxSrc(evidenciaPublicUrl(hero._path))
                      }}
                    >
                      {heroUrl && (
                        <Image
                          src={heroUrl}
                          alt={hero?.nombre_archivo ?? 'Evidencia'}
                          fill
                          className="object-cover"
                          unoptimized
                          priority
                        />
                      )}
                    </button>
                    {hero && showDelete && (
                      <div className="absolute top-2 right-2">
                        <DeleteEvidenceButton ev={hero} size="icon" />
                      </div>
                    )}
                  </div>
                  {photos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                      {photos.map((ev, idx) => {
                        const thumb = evidenciaPublicUrl(ev._path)
                        return (
                          <div key={ev.id} className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() => setActiveIndex(idx)}
                              className={cn(
                                'relative h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors',
                                idx === activeIndex
                                  ? 'border-sky-600 ring-2 ring-sky-600/20'
                                  : 'border-stone-200 opacity-80 hover:opacity-100'
                              )}
                            >
                              <Image
                                src={thumb}
                                alt={ev.nombre_archivo}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </button>
                            {showDelete && (
                              <div className="absolute -top-1 -right-1">
                                <DeleteEvidenceButton ev={ev} size="icon" className="h-7 w-7" />
                              </div>
                            )}
                          </div>
                        )
                      })}
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
                            <DeleteEvidenceButton ev={ev} />
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
        <DialogContent className="max-w-[min(96vw,900px)] p-0 gap-0 overflow-hidden bg-stone-950 border-stone-800">
          <DialogHeader className="p-4 border-b border-stone-800">
            <DialogTitle className="text-stone-100 text-base truncate pr-8">
              {lightbox?.nombre_archivo}
            </DialogTitle>
          </DialogHeader>
          <div className="relative w-full min-h-[50vh] max-h-[80vh] flex items-center justify-center bg-black">
            {lightbox && lightboxSrc && (
              <Image
                src={lightboxSrc}
                alt={lightbox.nombre_archivo}
                width={1200}
                height={900}
                className="max-h-[80vh] w-auto h-auto object-contain"
                unoptimized
                onError={() => {
                  const fb = evidenciaFallbackUrl(lightbox._path)
                  if (fb && fb !== lightboxSrc) setLightboxSrc(fb)
                }}
              />
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
