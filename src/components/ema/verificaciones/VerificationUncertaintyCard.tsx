'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Calculator, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tStudent95 } from '@/lib/ema/studentT'
import { EmaUncertaintyBudgetTable } from '@/components/ema/uncertainty/EmaUncertaintyBudgetTable'
import type { BudgetResult, UncertaintyComponent } from '@/types/ema-uncertainty'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerificationMetrologia {
  gum_rollup_status: string | null
  gum_rollup_attempted_at: string | null
  gum_rollup_skipped_reason: string | null
  presupuesto_json:
    | UncertaintyComponent[]
    | { tolerance_band_ref?: number; maestro_ids?: string[] }
    | null
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reconstruct a full `BudgetResult` from stored `UncertaintyComponent[]` and
 * the calibration summary row. All math is client-side (pure GUM formulas):
 *   u_c  = √(Σ uᵢ²(y))                          GUM §5.1.2
 *   νeff = u_c⁴ / Σ(uᵢ²(y)² / νᵢ)               GUM Annex G.4
 *   k    = t₉₅.₄₅%(νeff)                         GUM §6.3
 *   U    = k · u_c                                GUM §6.2
 */
function rebuildBudgetResult(
  components: UncertaintyComponent[],
  u_expandida: number | null,
  k_factor: number | null,
): BudgetResult {
  const u_c = Math.sqrt(components.reduce((s, c) => s + c.ui2_y, 0))

  // Welch–Satterthwaite
  const denom = components.reduce((s, c) => {
    if (!isFinite(c.nu) || c.nu === 0) return s
    return s + c.ui2_y ** 2 / c.nu
  }, 0)
  const nu_eff = denom > 0 ? u_c ** 4 / denom : Infinity

  const k = k_factor ?? tStudent95(nu_eff)
  const U = u_expandida ?? u_c * k

  // mean_value: the Type A repeatability valor_xi is the mean instrument error —
  // the closest analogue to the study's "media x̄" for a verification budget.
  const typeAComp = components.find((c) => c.tipo === 'A')
  const mean_value = typeAComp?.valor_xi ?? 0

  return {
    components,
    mean_value,
    u_c,
    nu_eff,
    k,
    U,
    U_rel_pct: null,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Card shown on the verification detail page.
 *
 * Surfaces the GUM uncertainty rollup status, the "Recalcular" button, and —
 * when the rollup is `ok` — the full CENAM-style presupuesto de incertidumbre
 * rendered via `EmaUncertaintyBudgetTable`, the same component used in study
 * workspaces, so the layout is visually identical across both flows.
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

  useEffect(() => {
    fetchState()
  }, [fetchState])

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
        await fetchState()
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
        <div className="h-4 w-48 bg-stone-200 rounded" />
        <div className="mt-3 h-32 bg-stone-100 rounded" />
      </div>
    )
  }

  const status = metrologia?.gum_rollup_status ?? null
  const isOk = status === 'ok'
  const isSkipped = status?.startsWith('skipped:') ?? false
  const isFailed = status?.startsWith('failed:') ?? false

  // Reconstruct BudgetResult from stored components when rollup is ok
  const rawComponents = Array.isArray(metrologia?.presupuesto_json)
    ? (metrologia!.presupuesto_json as UncertaintyComponent[])
    : []
  const budget: BudgetResult | null =
    isOk && rawComponents.length > 0
      ? rebuildBudgetResult(
          rawComponents,
          instrumentoCal?.u_expandida ?? null,
          instrumentoCal?.k_factor ?? null,
        )
      : null

  const unit = instrumentoCal?.unidad ?? ''

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-stone-100">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Calculator className="h-4 w-4 text-stone-500 shrink-0" />
          <h3 className="text-sm font-semibold text-stone-700">
            Presupuesto de incertidumbre (GUM)
          </h3>
          <StatusPill status={status} />
          {isOk && instrumentoCal?.u_expandida != null && (
            <span className="text-sm font-mono font-semibold text-stone-800 ml-1">
              U = {instrumentoCal.u_expandida} {unit}
              <span className="ml-2 text-xs font-normal text-stone-400">
                k = {instrumentoCal.k_factor ?? 2}
              </span>
            </span>
          )}
          {metrologia?.tur_min_observado != null && (
            <span className="text-xs text-stone-400 ml-auto">
              TUR mín = {metrologia.tur_min_observado.toFixed(1)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRecompute}
          disabled={recomputing}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
            recomputing
              ? 'border-stone-200 text-stone-400'
              : 'border-stone-300 text-stone-700 hover:bg-stone-50',
          )}
        >
          {recomputing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Calculator className="h-3 w-3" />
          )}
          {recomputing ? 'Recalculando…' : 'Recalcular incertidumbre'}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-3">
        {/* Error / skipped / pending states */}
        {isSkipped && (
          <div className="flex items-start gap-2 text-xs text-amber-700 rounded-md bg-amber-50 px-3 py-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Saltado. </span>
              {metrologia?.gum_rollup_skipped_reason ?? status?.slice('skipped:'.length)}
            </span>
          </div>
        )}
        {isFailed && (
          <div className="flex items-start gap-2 text-xs text-red-700 rounded-md bg-red-50 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Error en el cálculo. </span>
              {status?.slice('failed:'.length)}
            </span>
          </div>
        )}
        {!status && (
          <div className="text-xs text-stone-500 rounded-md bg-stone-50 px-3 py-2">
            Aún no se ha calculado el presupuesto GUM para esta verificación.
            Pulsa <em>Recalcular incertidumbre</em> para generarlo.
          </div>
        )}
        {recomputeError && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {recomputeError}
          </div>
        )}

        {/* ── Full CENAM-style budget table (same as study workspace) ── */}
        {budget && (
          <EmaUncertaintyBudgetTable
            budget={budget}
            unit={unit}
            meanLabel="Error medio ē"
            className="mt-1"
          />
        )}

        {/* Cert reference footer */}
        {isOk && instrumentoCal?.numero_certificado && (
          <p className="text-[10px] text-stone-400">
            Certificado / verificación: <span className="font-mono">{instrumentoCal.numero_certificado}</span>
            {instrumentoCal.fecha_emision && (
              <> · emitido {new Date(instrumentoCal.fecha_emision + 'T00:00:00').toLocaleDateString('es-MX')}</>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        sin calcular
      </span>
    )
  }
  if (status === 'ok') {
    return (
      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 inline-flex items-center gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" />
        ok
      </span>
    )
  }
  if (status.startsWith('skipped:')) {
    return (
      <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        saltado
      </span>
    )
  }
  return (
    <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700">
      error
    </span>
  )
}
