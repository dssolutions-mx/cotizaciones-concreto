'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { CompletedVerificacionFicha } from '@/components/ema/CompletedVerificacionFicha'
import { EmaFichaPrintToolbar } from '@/components/ema/EmaFichaPrintToolbar'
import { verificacionPrintMeta } from '@/lib/ema/verificacionPrintMeta'
import type { CompletedVerificacionDetalle } from '@/types/ema'

export default function VerificacionImprimirPage() {
  const { id: instrumentoId, verifId } = useParams<{ id: string; verifId: string }>()
  const [data, setData] = useState<CompletedVerificacionDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const title = data?.snapshot?.template.nombre ?? 'Ficha de verificación'

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-white print:m-0">
      <EmaFichaPrintToolbar
        backHref={`/quality/instrumentos/${instrumentoId}/verificaciones/${verifId}`}
        backLabel="Detalle de verificación"
        title={title}
      />

      <div className="mx-auto max-w-4xl px-4 py-6 print:px-0 print:py-0">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando ficha…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {data?.snapshot && !loading && !error && (
          <>
            <CompletedVerificacionFicha
              snapshot={data.snapshot}
              measurements={data.measurements ?? []}
              meta={verificacionPrintMeta(data)}
              className="print:border-stone-600"
            />
            <p className="print:hidden mt-4 text-[11px] text-stone-500 text-center">
              Registro {data.id.slice(0, 8)}… · Use Imprimir o Ctrl+P.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
