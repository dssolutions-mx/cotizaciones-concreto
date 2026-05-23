'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calculator, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UncertaintyComponent } from '@/types/ema-uncertainty'

interface VerificationMetrologia {
  gum_rollup_status: string | null
  gum_rollup_attempted_at: string | null
  gum_rollup_skipped_reason: string | null
  presupuesto_json: UncertaintyComponent[] | { tolerance_band_ref?: number; maestro_ids?: string[] } | null
  tur_min_observado: number | null
}

interface InstrumentoCalSummary {
  u_expandida: number | null
  k_factor: number | null
  unidad: string | null
  fecha_emision: string | null
  numero_certificado: string | null
}

interface RecomputeResponse {
  status: 'ok' | 'skipped'
  u_c?: number
  k?: number
  U?: number
  nu_eff?: number
  components?: UncertaintyComponent[]
  skipped_reason?: string
  unidad?: string
  error?: string
}

/**
 * Card shown on the verification detail page. Surfaces the GUM uncertainty
 * rollup status, the resulting U (if computed), and a manual "Recalcular"
 * button gated by role on the server side. Refreshes its own state after a
 * successful recompute.
 */
export function VerificationUncertaintyCard({
  verificationId,
  instrumentoId,
}: {
  verificationId: string
  instrumentoId: string
}) {
  const [metrologia, setMetrologia] = useState<VerificationMetrologia | null>(null)
  const [instrumentoCal, setInstrumentoCal] = useState<InstrumentoCalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeError, setRecomputeError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const fetchState = useCallback(async () => {
    try {
      const [vmRes, calRes] = await Promise.all([
        fetch(`/api/ema/verificaciones/${verificationId}/metrologia`),
        fetch(`/api/ema/instrumentos/${instrumentoId}/calibraciones?latest=1`),
      ])
      if (vmRes.ok) {
        const vm = await vmRes.json()
        setMetrologia(vm.data ?? vm)
      } else {
        setMetrologia(null)
      }
      if (calRes.ok) {
        const cal = await calRes.json()
        const row = Array.isArray(cal) ? cal[0] : (cal.data?.[0] ?? cal.latest ?? null)
        setInstrumentoCal(row ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [verificationId, instrumentoId])

  useEffect(() => { fetchState() }, [fetchState])

  async function handleRecompute() {
    setRecomputing(true)
    setRecomputeError(null)
    try {
      const res = await fetch(
        `/api/ema/verificaciones/${verificationId}/recompute-uncertainty`,
        { method: 'POST' },
      )
      const body = (await res.json()) as RecomputeResponse
      if (!res.ok) {
        setRecomputeError(body.error ?? 'Error al recalcular')
        await fetchState() // pick up persisted failure status
        return
      }
      if (body.status === 'skipped') {
        setRecomputeError(`Saltado: ${body.skipped_reason ?? 'datos incompletos'}`)
      }
      await fetchState()
    } catch (e) {
      setRecomputeError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setRecomputing(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-32 bg-stone-200 rounded" />
      </div>
    )
  }

  const status = metrologia?.gum_rollup_status ?? null
  const isOk = status === 'ok'
  const isSkipped = status?.startsWith('skipped:') ?? false
  const isFailed = status?.startsWith('failed:') ?? false
  const isPending = !status

  const components = Array.isArray(metrologia?.presupuesto_json)
    ? (metrologia!.presupuesto_json as UncertaintyComponent[])
    : []
  const hasComponents = components.length > 0

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-stone-100">
        <div className="flex items-center gap-2 min-w-0">
          <Calculator className="h-4 w-4 text-stone-500 shrink-0" />
          <h3 className="text-sm font-semibold text-stone-700">Presupuesto de incertidumbre (GUM)</h3>
          <StatusPill status={status} />
        </div>
        <button
          type="button"
          onClick={handleRecompute}
          disabled={recomputing}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
            recomputing
              ? 'border-stone-200 text-stone-400'
              : 'border-stone-300 text-stone-700 hover:bg-stone-50',
          )}
        >
          {recomputing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calculator className="h-3 w-3" />}
          {recomputing ? 'Recalculando…' : 'Recalcular incertidumbre'}
        </button>
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Summary line */}
        {isOk && instrumentoCal?.u_expandida != null ? (
          <div className="flex items-baseline gap-3 text-sm">
            <span className="text-stone-500">U =</span>
            <span className="font-mono text-base font-semibold text-stone-900">
              {instrumentoCal.u_expandida} {instrumentoCal.unidad ?? ''}
            </span>
            <span className="text-xs text-stone-400">
              k = {instrumentoCal.k_factor ?? 2}
            </span>
            {instrumentoCal.numero_certificado && (
              <span className="text-xs text-stone-400">· cert {instrumentoCal.numero_certificado}</span>
            )}
            {metrologia?.tur_min_observado != null && (
              <span className="ml-auto text-xs text-stone-400">
                TUR mín = {metrologia.tur_min_observado.toFixed(1)}
              </span>
            )}
          </div>
        ) : isSkipped ? (
          <div className="flex items-start gap-2 text-xs text-amber-700">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Saltado.</span> {metrologia?.gum_rollup_skipped_reason ?? status?.slice('skipped: '.length)}
            </span>
          </div>
        ) : isFailed ? (
          <div className="flex items-start gap-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Error en el cálculo.</span> {status?.slice('failed: '.length)}
            </span>
          </div>
        ) : isPending ? (
          <div className="text-xs text-stone-500">
            Aún no se ha calculado el presupuesto GUM para esta verificación. Pulsa <em>Recalcular</em>.
          </div>
        ) : null}

        {recomputeError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {recomputeError}
          </div>
        )}

        {/* Components expander */}
        {hasComponents && (
          <div className="pt-1">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-800"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Ver presupuesto ({components.length} contribuyentes)
            </button>
            {expanded && (
              <div className="mt-2 overflow-hidden rounded-md border border-stone-200">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Fuente</th>
                      <th className="px-2 py-1.5 text-center">Tipo</th>
                      <th className="px-2 py-1.5 text-center">Distribución</th>
                      <th className="px-2 py-1.5 text-right">u(xᵢ)</th>
                      <th className="px-2 py-1.5 text-right">uᵢ²(y)</th>
                      <th className="px-2 py-1.5 text-left">Ref.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {components.map((c, i) => (
                      <tr key={i} className="hover:bg-stone-50/50">
                        <td className="px-2 py-1.5 text-stone-700">{c.fuente}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={cn(
                            'rounded px-1 py-0.5 text-[10px] font-semibold',
                            c.tipo === 'A' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700',
                          )}>{c.tipo}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center text-stone-500">{c.distribucion}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-stone-700">{c.u_xi?.toExponential(3)}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-stone-500">{c.ui2_y?.toExponential(3)}</td>
                        <td className="px-2 py-1.5 text-stone-400 text-[10px]">{c.ref_norma}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500">
        🟡 sin calcular
      </span>
    )
  }
  if (status === 'ok') {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 inline-flex items-center gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" /> ok
      </span>
    )
  }
  if (status.startsWith('skipped:')) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        🟡 saltado
      </span>
    )
  }
  return (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
      🔴 error
    </span>
  )
}
