'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { CompletedVerificacionFicha } from '@/components/ema/CompletedVerificacionFicha'
import { EmaFichaPrintToolbar } from '@/components/ema/EmaFichaPrintToolbar'
import {
  clearBulkVerificacionPrintSession,
  readBulkVerificacionPrintSession,
} from '@/lib/ema/bulkVerificacionPrint'
import { verificacionPrintMeta, VERIFICACION_RESULTADO_LABEL } from '@/lib/ema/verificacionPrintMeta'
import type { CompletedVerificacionDetalle } from '@/types/ema'

export default function BulkVerificacionesImprimirPage() {
  const router = useRouter()
  const { currentPlant } = usePlantContext()
  const [session, setSession] = useState<ReturnType<typeof readBulkVerificacionPrintSession>>(null)
  const [items, setItems] = useState<CompletedVerificacionDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const title =
    items.length > 0
      ? `Informe de verificaciones (${items.length})`
      : session
        ? `Informe de verificaciones (${session.ids.length})`
        : 'Informe de verificaciones'

  const backHref = session?.backHref ?? '/quality/instrumentos'

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-white print:m-0">
      <EmaFichaPrintToolbar backHref={backHref} backLabel="Volver al listado" title={title} />

      <div className="mx-auto max-w-4xl px-4 py-6 print:px-0 print:py-0">
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
          <>
            <div className="ema-bulk-verificacion-cover mb-8 print:mb-0 rounded-lg border border-stone-300 overflow-hidden text-sm">
              <div className="bg-slate-800 text-white px-4 py-3 text-center font-semibold">
                Informe de verificaciones internas
              </div>
              <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 text-xs text-stone-700 space-y-1">
                {currentPlant?.name && (
                  <p>
                    <span className="font-semibold">Planta: </span>
                    {currentPlant.name}
                  </p>
                )}
                <p>
                  <span className="font-semibold">Registros incluidos: </span>
                  {items.length}
                </p>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-700 text-white">
                    <th className="border border-stone-400 px-2 py-1 text-left">#</th>
                    <th className="border border-stone-400 px-2 py-1 text-left">Instrumento</th>
                    <th className="border border-stone-400 px-2 py-1 text-left">Fecha</th>
                    <th className="border border-stone-400 px-2 py-1 text-left">Resultado</th>
                    <th className="border border-stone-400 px-2 py-1 text-left">Plantilla</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((v, i) => (
                    <tr key={v.id} className="bg-white">
                      <td className="border border-stone-300 px-2 py-1">{i + 1}</td>
                      <td className="border border-stone-300 px-2 py-1 font-mono">
                        {v.instrumento?.codigo ?? '—'} — {v.instrumento?.nombre ?? '—'}
                      </td>
                      <td className="border border-stone-300 px-2 py-1 font-mono">{v.fecha_verificacion}</td>
                      <td className="border border-stone-300 px-2 py-1">
                        {VERIFICACION_RESULTADO_LABEL[v.resultado] ?? v.resultado}
                      </td>
                      <td className="border border-stone-300 px-2 py-1 font-mono text-[10px]">
                        {v.snapshot?.template?.codigo ?? '—'}
                        {v.template_version_number != null && ` v${v.template_version_number}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {items.map((data, index) => (
              <div
                key={data.id}
                className={
                  index < items.length - 1
                    ? 'ema-verificacion-print-page mb-8 print:mb-0'
                    : 'ema-verificacion-print-page-last mb-8 print:mb-0'
                }
              >
                {data.snapshot ? (
                  <CompletedVerificacionFicha
                    snapshot={data.snapshot}
                    measurements={data.measurements ?? []}
                    meta={verificacionPrintMeta(data)}
                    className="print:border-stone-600"
                  />
                ) : (
                  <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    La verificación {data.id.slice(0, 8)}… no tiene snapshot de plantilla.
                  </div>
                )}
              </div>
            ))}

            <p className="print:hidden mt-4 text-[11px] text-stone-500 text-center">
              {items.length} ficha{items.length !== 1 ? 's' : ''} · Use Imprimir o Ctrl+P para guardar como PDF.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
