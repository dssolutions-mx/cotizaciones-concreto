'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { EmaVerificacionReportToolbar } from '@/components/ema/EmaVerificacionReportToolbar'
import { UncertaintyInformePdfViewer } from '@/components/ema/UncertaintyInformePdfViewer'
import {
  downloadUncertaintyInformePdf,
  openUncertaintyInformePdfInNewTab,
} from '@/lib/ema/downloadUncertaintyInformePdf'
import type { UncertaintyStudyInformeDetalle } from '@/types/ema-uncertainty'

export default function UncertaintyStudyImprimirPage() {
  const { measurandCode, id: studyId } = useParams<{ measurandCode: string; id: string }>()
  const { currentPlant } = usePlantContext()
  const [informe, setInforme] = useState<UncertaintyStudyInformeDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!studyId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/ema/uncertainty/studies/${studyId}/informe`)
        const j = (await r.json().catch(() => ({}))) as {
          data?: UncertaintyStudyInformeDetalle
          error?: string
        }
        if (!r.ok) throw new Error(j.error ?? 'Error cargando el informe')
        if (!cancelled) {
          setInforme(j.data ?? null)
          setError(null)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error de red')
          setInforme(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studyId])

  const lab = useMemo(
    () => ({
      plantName: currentPlant?.name ?? informe?.lab.plantName ?? null,
      acreditacionEma: informe?.lab.acreditacionEma ?? null,
    }),
    [currentPlant?.name, informe?.lab.plantName, informe?.lab.acreditacionEma],
  )

  const backHref = `/quality/ema/incertidumbre/${measurandCode}/estudios/${studyId}`

  const runPdf = useCallback(
    async (mode: 'download' | 'open') => {
      if (!informe) return
      setPdfBusy(true)
      setPdfError(null)
      try {
        if (mode === 'download') {
          await downloadUncertaintyInformePdf(informe, { lab })
        } else {
          await openUncertaintyInformePdfInNewTab(informe, { lab })
        }
      } catch (e: unknown) {
        setPdfError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
      } finally {
        setPdfBusy(false)
      }
    },
    [informe, lab],
  )

  const title =
    informe?.study.documento_codigo ??
    `Incertidumbre — ${informe?.measurand.nombre ?? measurandCode}`

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-stone-50">
      <EmaVerificacionReportToolbar
        backHref={backHref}
        backLabel="Espacio de trabajo"
        title={title}
        downloading={pdfBusy}
        disabled={!informe || loading}
        onDownloadPdf={() => runPdf('download')}
        onOpenPdf={() => runPdf('open')}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <p className="text-xs text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-2">
          Vista previa del PDF oficial para la entidad de acreditación. Incluye diseño del estudio,
          réplicas, trazabilidad de instrumentos y el presupuesto de incertidumbre completo (GUM).
          Solo disponible para estudios <strong>publicados</strong> con presupuesto congelado.
        </p>

        {pdfError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pdfError}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando informe…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-3">
            <p>{error}</p>
            <Link href={backHref} className="text-sm font-medium text-red-900 underline">
              Volver al estudio
            </Link>
          </div>
        )}

        {informe && !loading && !error && (
          <UncertaintyInformePdfViewer informe={informe} lab={lab} />
        )}
      </div>
    </div>
  )
}
