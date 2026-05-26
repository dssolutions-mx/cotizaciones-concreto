'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { EmaFichaPrintToolbar } from '@/components/ema/EmaFichaPrintToolbar'
import { TemplateFicha } from '@/components/ema/TemplateFicha'
import type { InstrumentoDetalle, VerificacionTemplateSnapshot } from '@/types/ema'

type PlantillaCandidate = {
  id: string
  codigo: string
  nombre: string
  active_version_id: string
  active_version_number?: number | null
}

async function loadSnapshotForTemplate(
  candidate: PlantillaCandidate,
): Promise<VerificacionTemplateSnapshot> {
  const verRes = await fetch(`/api/ema/template-versions/${candidate.active_version_id}`)
  const verJ = await verRes.json()
  if (!verRes.ok) throw new Error(verJ.error ?? 'Error al cargar versión publicada')
  const snap = verJ.data?.snapshot as VerificacionTemplateSnapshot | undefined
  if (!snap?.template) throw new Error('La versión publicada no tiene snapshot de plantilla.')
  return snap
}

export default function InstrumentoFichaVerificacionPrintPage() {
  const { id: instrumentoId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const templateQueryId = searchParams.get('template')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [instrumento, setInstrumento] = useState<InstrumentoDetalle | null>(null)
  const [snapshot, setSnapshot] = useState<VerificacionTemplateSnapshot | null>(null)
  const [candidates, setCandidates] = useState<PlantillaCandidate[]>([])
  const [activeCandidate, setActiveCandidate] = useState<PlantillaCandidate | null>(null)

  const loadTemplate = useCallback(async (candidate: PlantillaCandidate) => {
    setLoading(true)
    setError(null)
    try {
      const snap = await loadSnapshotForTemplate(candidate)
      setActiveCandidate(candidate)
      setSnapshot(snap)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar la ficha')
      setSnapshot(null)
      setActiveCandidate(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setSnapshot(null)
      setActiveCandidate(null)
      try {
        const instRes = await fetch(`/api/ema/instrumentos/${instrumentoId}`)
        const instJ = await instRes.json()
        if (!instRes.ok) throw new Error(instJ.error ?? 'Instrumento no encontrado')
        const inst: InstrumentoDetalle = instJ.data ?? instJ
        if (!cancelled) setInstrumento(inst)

        const cid = inst.conjunto_id
        if (!cid) throw new Error('El instrumento no pertenece a un conjunto con plantilla de verificación.')

        const tmplRes = await fetch(`/api/ema/conjuntos/${cid}/templates`)
        const tmplJ = await tmplRes.json()
        if (!tmplRes.ok) throw new Error(tmplJ.error ?? 'Error al cargar plantillas')

        const list: unknown[] = Array.isArray(tmplJ.data) ? tmplJ.data : tmplJ.data != null ? [tmplJ.data] : []
        const publicadas = (list as Record<string, unknown>[]).filter(
          (t) => t.estado === 'publicado' && typeof t.active_version_id === 'string' && t.active_version_id,
        ).map((t) => ({
          id: t.id as string,
          codigo: t.codigo as string,
          nombre: t.nombre as string,
          active_version_id: t.active_version_id as string,
          active_version_number:
            (t.active_version as { version_number?: number } | undefined)?.version_number ?? null,
        }))

        if (publicadas.length === 0) {
          throw new Error('No hay plantilla de verificación publicada para este conjunto.')
        }

        if (!cancelled) setCandidates(publicadas)

        const pick =
          (templateQueryId && publicadas.find((p) => p.id === templateQueryId)) ??
          (publicadas.length === 1 ? publicadas[0] : null)

        if (!pick) {
          if (!cancelled) setLoading(false)
          return
        }

        const snap = await loadSnapshotForTemplate(pick)
        if (!cancelled) {
          setActiveCandidate(pick)
          setSnapshot(snap)
          setLoading(false)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar la ficha')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [instrumentoId, templateQueryId])

  const title = snapshot?.template.nombre ?? 'Ficha de verificación'

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-white print:m-0">
      <EmaFichaPrintToolbar
        backHref={`/quality/instrumentos/${instrumentoId}?tab=verificaciones`}
        backLabel="Ficha del instrumento"
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

        {!loading && !error && candidates.length > 1 && !snapshot && (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Seleccione la plantilla publicada a imprimir:</p>
            <div className="grid gap-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void loadTemplate(c)}
                  className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                >
                  <span className="font-mono text-xs text-stone-500">{c.codigo}</span>
                  <p className="text-sm font-medium text-stone-900">{c.nombre}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {snapshot && instrumento && (
          <div className="space-y-4 print:space-y-2">
            <div className="grid grid-cols-2 gap-px rounded-lg border border-stone-300 overflow-hidden text-xs print:text-[10px]">
              {[
                { label: 'Código', value: instrumento.codigo },
                { label: 'Instrumento', value: instrumento.nombre },
                { label: 'Planta', value: instrumento.plant?.name ?? '—' },
                { label: 'Tipo', value: instrumento.tipo },
              ].map((row) => (
                <div key={row.label} className="flex bg-white">
                  <div className="bg-emerald-700 text-white font-semibold uppercase px-2 py-1.5 w-28 shrink-0 text-[10px]">
                    {row.label}
                  </div>
                  <div className="px-2 py-1.5 flex-1 text-stone-800">{row.value}</div>
                </div>
              ))}
            </div>

            <TemplateFicha
              template={snapshot.template}
              sections={snapshot.sections}
              header_fields={snapshot.header_fields}
              className="print:border-stone-600"
            />

            <p className="print:hidden text-[11px] text-stone-500 text-center">
              Hoja en blanco · versión publicada
              {activeCandidate?.active_version_number != null && ` v${activeCandidate.active_version_number}`}
              . Use Imprimir o Ctrl+P.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
