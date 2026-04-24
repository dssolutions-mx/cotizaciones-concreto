'use client'

import type { ReactNode } from 'react'
import { ExternalLink, FileWarning, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { CertificadoCalibracion } from '@/types/ema'
import { EmaCalibracionCertificadoAttachBlock } from './EmaCalibracionCertificadoAttachBlock'

export type CertificadoCalibracionConPdf = CertificadoCalibracion & { pdf_url: string | null }

function Field({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  if (value == null || value === '') return null
  return (
    <div className={className}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-sm text-stone-900 mt-0.5 break-words">{value}</div>
    </div>
  )
}

export function EmaCalibracionCertificadoSheet({
  open,
  onOpenChange,
  cert,
  instrumentoId,
  canAttachDocument = false,
  onDocumentUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cert: CertificadoCalibracionConPdf | null
  /** Required for “Subir o reemplazar PDF” on an existing record. */
  instrumentoId?: string
  canAttachDocument?: boolean
  onDocumentUpdated?: (c: CertificadoCalibracionConPdf) => void
}) {
  if (!cert) return null

  const hasStorageKey = Boolean(cert.archivo_path?.trim())
  const canOpenPdf = Boolean(cert.pdf_url)
  const C = cert.condiciones_ambientales
  const hasCond = C && (C.temperatura || C.humedad || C.presion || C.lugar)
  const condicionesBloque = hasCond ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200">
      <Field label="Temperatura" value={C!.temperatura} />
      <Field label="Humedad" value={C!.humedad} />
      <Field label="Presión" value={C!.presion} />
      <Field label="Lugar / notas" value={C!.lugar} />
    </div>
  ) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pr-8">
          <SheetTitle className="flex items-center gap-2 text-left">
            <ScrollText className="h-5 w-5 text-sky-600 shrink-0" />
            Certificado de calibración
          </SheetTitle>
          <SheetDescription asChild>
            <div className="text-left text-stone-600 text-sm">
              {cert.is_vigente && (
                <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 mr-2">
                  Vigente
                </span>
              )}
              <span className="font-mono text-xs text-stone-500">{cert.laboratorio_externo}</span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-left">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-stone-700">Identidad</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
              <Field label="Número de certificado" value={cert.numero_certificado} />
              <Field label="Acreditación del laboratorio" value={cert.acreditacion_laboratorio} />
              <Field label="Método / norma de calibración" value={cert.metodo_calibracion} />
              <Field label="Técnico responsable" value={cert.tecnico_responsable} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-stone-700">Fechas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
              <Field label="Emisión" value={cert.fecha_emision} />
              <Field label="Vencimiento" value={cert.fecha_vencimiento} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-stone-700">Metrología (NMX-EC-17025)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
              {cert.incertidumbre_expandida == null && cert.factor_cobertura == null && !cert.rango_medicion?.trim() && (
                <p className="text-xs text-stone-500 sm:col-span-2">Sin datos metrológicos en este registro.</p>
              )}
              <Field
                label="Incertidumbre expandida U"
                value={
                  cert.incertidumbre_expandida != null
                    ? `${cert.incertidumbre_expandida}${cert.incertidumbre_unidad ? ` ${cert.incertidumbre_unidad}` : ''}`
                    : null
                }
              />
              <Field
                label="Factor de cobertura k"
                value={cert.factor_cobertura != null ? String(cert.factor_cobertura) : null}
              />
              <Field label="Rango de medición" value={cert.rango_medicion} className="sm:col-span-2" />
            </div>
          </div>

          {condicionesBloque && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-stone-700">Condiciones ambientales</h3>
              <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-3">{condicionesBloque}</div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-stone-700">Documento</h3>
            <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-3 space-y-2">
              {canAttachDocument && instrumentoId && onDocumentUpdated && (
                <EmaCalibracionCertificadoAttachBlock
                  instrumentoId={instrumentoId}
                  certId={cert.id}
                  onSuccess={(c) => onDocumentUpdated(c)}
                />
              )}
              {cert.archivo_nombre_original && (
                <Field label="Archivo" value={cert.archivo_nombre_original} className="font-mono text-xs" />
              )}
              {!hasStorageKey && (
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-xs text-amber-900',
                  )}
                >
                  <FileWarning className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Este registro no tiene ruta de PDF. Use el botón de arriba para subir uno, si aplica.</span>
                </div>
              )}
              {hasStorageKey && !canOpenPdf && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-xs text-amber-900">
                  <FileWarning className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    No se pudo generar el enlace de descarga. Puede reemplazar el PDF con el botón de arriba, o
                    actualice la lista desde la pestaña Certificados.
                  </span>
                </div>
              )}
            </div>
          </div>

          {cert.observaciones && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-stone-700">Observaciones</h3>
              <p className="text-sm text-stone-800 whitespace-pre-wrap rounded-lg border border-stone-200 bg-white p-3">
                {cert.observaciones}
              </p>
            </div>
          )}

          {canOpenPdf && (
            <div className="pt-2">
              <Button
                className="w-full sm:w-auto bg-sky-700 hover:bg-sky-800 text-white gap-1.5"
                asChild
              >
                <a href={cert.pdf_url!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir PDF en nueva pestaña
                </a>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
