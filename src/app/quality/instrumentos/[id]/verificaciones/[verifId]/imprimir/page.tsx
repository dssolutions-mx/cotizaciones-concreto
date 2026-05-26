'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { EmaVerificacionReportToolbar } from '@/components/ema/EmaVerificacionReportToolbar'
import { VerificacionInformePdfViewer } from '@/components/ema/VerificacionInformePdfViewer'
import {
  downloadVerificacionInformePdf,
  openVerificacionInformePdfInNewTab,
} from '@/lib/ema/downloadVerificacionInformePdf'
import type { CompletedVerificacionDetalle } from '@/types/ema'

export default function VerificacionImprimirPage() {
  const { id: instrumentoId, verifId } = useParams<{ id: string; verifId: string }>()
  const { currentPlant } = usePlantContext()
  const [data, setData] = useState<CompletedVerificacionDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!verifId) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/ema/verificaciones/${verifId}`)
        const j = (await r.json().catch(() => ({}))) as {
          data?: CompletedVerificacionDetalle
          error?: string
        }
        if (!r.ok) throw new Error(j.error ?? 'Error cargando la verificación')
        if (!cancelled) {
          setData(j.data ?? null)
          setError(null)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error de red')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [verifId])

  const lab = {
    plantName: currentPlant?.name ?? null,
    acreditacionEma: null as string | null,
  }

  const items = data ? [data] : []

  const runPdf = useCallback(
    async (mode: 'download' | 'open') => {
      if (!data) return
      setPdfBusy(true)
      setPdfError(null)
      try {
        if (mode === 'download') {
          await downloadVerificacionInformePdf(items, { lab, includeCover: false })
        } else {
          await openVerificacionInformePdfInNewTab(items, { lab, includeCover: false })
        }
      } catch (e: unknown) {
        setPdfError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
      } finally {
        setPdfBusy(false)
      }
    },
    [data, items, lab],
  )

  const title = data?.snapshot?.template.nombre ?? 'Registro de verificación'

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-stone-50">
      <EmaVerificacionReportToolbar
        backHref={`/quality/instrumentos/${instrumentoId}/verificaciones/${verifId}`}
        backLabel="Detalle de verificación"
        title={title}
        downloading={pdfBusy}
        disabled={!data?.snapshot || loading}
        onDownloadPdf={() => runPdf('download')}
        onOpenPdf={() => runPdf('open')}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <p className="text-xs text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-2">
          Vista previa del PDF oficial (mismo documento que se descarga). Incluye presupuesto GUM,
          trazabilidad de patrones, U/k, TUR y secciones numeradas para revisión por la entidad de
          acreditación.
        </p>

        {pdfError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pdfError}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando registro…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {data?.snapshot && !loading && !error && (
          <VerificacionInformePdfViewer items={items} lab={lab} includeCover={false} />
        )}
      </div>
    </div>
  )
}
