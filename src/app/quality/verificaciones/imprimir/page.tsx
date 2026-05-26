'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { CompletedVerificacionFicha } from '@/components/ema/CompletedVerificacionFicha'
import { EmaVerificacionReportToolbar } from '@/components/ema/EmaVerificacionReportToolbar'
import {
  clearBulkVerificacionPrintSession,
  readBulkVerificacionPrintSession,
} from '@/lib/ema/bulkVerificacionPrint'
import {
  downloadVerificacionInformePdf,
  openVerificacionInformePdfInNewTab,
} from '@/lib/ema/downloadVerificacionInformePdf'
import { verificacionPrintMeta } from '@/lib/ema/verificacionPrintMeta'
import type { CompletedVerificacionDetalle } from '@/types/ema'

export default function BulkVerificacionesImprimirPage() {
  const router = useRouter()
  const { currentPlant } = usePlantContext()
  const [session, setSession] = useState<ReturnType<typeof readBulkVerificacionPrintSession>>(null)
  const [items, setItems] = useState<CompletedVerificacionDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    const s = readBulkVerificacionPrintSession()
    if (!s) {
      setError('No hay verificaciones seleccionadas. Vuelva al listado y seleccione al menos una.')
      setLoading(false)
      return
    }
    setSession(s)

    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/ema/verificaciones/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: s.ids }),
        })
        const j = (await r.json().catch(() => ({}))) as {
          data?: CompletedVerificacionDetalle[]
          error?: string
        }
        if (!r.ok) throw new Error(j.error ?? 'Error cargando verificaciones')
        if (!cancelled) {
          setItems(j.data ?? [])
          setError(null)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error de red')
          setItems([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      clearBulkVerificacionPrintSession()
    }
  }, [])

  const lab = {
    plantName: currentPlant?.name ?? null,
    acreditacionEma: null as string | null,
  }

  const runPdf = useCallback(
    async (mode: 'download' | 'open') => {
      if (!items.length) return
      setPdfBusy(true)
      setPdfError(null)
      try {
        if (mode === 'download') {
          await downloadVerificacionInformePdf(items, { lab, includeCover: true })
        } else {
          await openVerificacionInformePdfInNewTab(items, { lab, includeCover: true })
        }
      } catch (e: unknown) {
        setPdfError(e instanceof Error ? e.message : 'No se pudo generar el PDF')
      } finally {
        setPdfBusy(false)
      }
    },
    [items, lab],
  )

  const title =
    items.length > 0
      ? `Informe de verificaciones (${items.length})`
      : session
        ? `Informe de verificaciones (${session.ids.length})`
        : 'Informe de verificaciones'

  const backHref = session?.backHref ?? '/quality/instrumentos'

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-stone-50">
      <EmaVerificacionReportToolbar
        backHref={backHref}
        backLabel="Volver al listado"
        title={title}
        downloading={pdfBusy}
        disabled={items.length === 0 || loading}
        onDownloadPdf={() => runPdf('download')}
        onOpenPdf={() => runPdf('open')}
      />

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <p className="text-xs text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-2">
          El PDF incluye por cada registro: trazabilidad de patrones, lecturas con criterios de aceptación,
          presupuesto de incertidumbre GUM (tabla CENAM en horizontal), U expandida, TUR y dictamen conforme
          NMX-EC-17025. Use <strong>Descargar PDF</strong> para el expediente ante la entidad de acreditación.
        </p>

        {pdfError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{pdfError}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando fichas…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-3">
            <p>{error}</p>
            <button
              type="button"
              className="text-sm font-medium text-red-900 underline"
              onClick={() => router.push(backHref)}
            >
              Volver al listado
            </button>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-8">
            {items.map((data, index) => (
              <div key={data.id}>
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  Registro {index + 1} de {items.length}
                </p>
                {data.snapshot ? (
                  <CompletedVerificacionFicha
                    snapshot={data.snapshot}
                    measurements={data.measurements ?? []}
                    meta={verificacionPrintMeta(data)}
                  />
                ) : (
                  <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    La verificación {data.id.slice(0, 8)}… no tiene snapshot de plantilla.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
