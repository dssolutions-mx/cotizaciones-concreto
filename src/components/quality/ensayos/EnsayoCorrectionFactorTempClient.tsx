'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, subMonths } from 'date-fns'
import {
  AlertTriangle,
  ArrowLeft,
  FlaskConical,
  Loader2,
  RefreshCw,
  Save,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import { usePlantContext } from '@/contexts/PlantContext'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import {
  qualityHubOutlineNeutralClass,
  qualityHubPrimaryButtonClass,
} from '@/components/quality/qualityHubUi'
import { cn, formatDate } from '@/lib/utils'
import {
  approximatePorcentajePreview,
  factorsDiffer,
  resolveDraftFactor,
  roundResistenciaCorregida,
} from '@/lib/quality/ensayoCorrectionPreview'
import { specimenTypeLabel } from './ensayosHelpers'
import type { SpecimenTypeSpec } from '@/types/quality'

const ALLOWED_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN', 'ADMIN_OPERATIONS']
const WRITE_SPEC_ROLES = ['EXECUTIVE', 'ADMIN']
const APPLY_ENSAYO_ROLES = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN']

export type PreviewRow = {
  ensayo_id: string
  fecha_ensayo: string
  plant_code: string | null
  muestra_identificacion: string | null
  tipo_muestra: string | null
  dimension_label: string | null
  resistencia_calculada: number
  factor_aplicado: number
  factor_tabla: number | null
  factor_simulado: number
  resistencia_corregida_actual: number
  resistencia_corregida_simulada: number
  porcentaje_actual: number
  porcentaje_simulado: number | null
  delta_porcentaje: number | null
  mismatch_tabla: boolean
  mismatch_simulacion: boolean
  muestreo_id: string | null
  spec_id_resuelto?: string | null
  spec_id_vinculado?: string | null
}

type PreviewSummary = {
  total: number
  mismatch_tabla: number
  shown: number
}

function defaultDesde() {
  return format(subMonths(new Date(), 6), 'yyyy-MM-dd')
}

function defaultHasta() {
  return format(new Date(), 'yyyy-MM-dd')
}

export default function EnsayoCorrectionFactorTempClient() {
  const { profile } = useAuthBridge()
  const { currentPlant } = usePlantContext()

  const [specs, setSpecs] = useState<SpecimenTypeSpec[]>([])
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [summary, setSummary] = useState<PreviewSummary | null>(null)
  const [draftFactors, setDraftFactors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlyMismatch, setOnlyMismatch] = useState(false)
  const [fechaDesde, setFechaDesde] = useState(defaultDesde)
  const [fechaHasta, setFechaHasta] = useState(defaultHasta)
  const [savingSpecId, setSavingSpecId] = useState<string | null>(null)
  const [recomputingPct, setRecomputingPct] = useState(false)
  const [applyingBulk, setApplyingBulk] = useState(false)

  const canWriteSpecs = profile?.role && WRITE_SPEC_ROLES.includes(profile.role)
  const canApplyEnsayos = profile?.role && APPLY_ENSAYO_ROLES.includes(profile.role)
  const specsById = useMemo(() => new Map(specs.map((s) => [s.id, s])), [specs])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        limit: '250',
      })
      if (onlyMismatch) params.set('only_mismatch', '1')
      if (currentPlant?.id) params.set('plant_id', currentPlant.id)

      const res = await fetch(`/api/quality/ensayos/correction-factor-preview?${params}`, {
        cache: 'no-store',
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al cargar')

      const list = (j.specs || []) as SpecimenTypeSpec[]
      setSpecs(list)
      setRows((j.rows || []) as PreviewRow[])
      setSummary(j.summary as PreviewSummary)

      const drafts: Record<string, string> = {}
      list.forEach((s) => {
        drafts[s.id] = String(s.correction_factor)
      })
      setDraftFactors(drafts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, onlyMismatch, currentPlant?.id])

  useEffect(() => {
    if (profile && ALLOWED_ROLES.includes(profile.role)) {
      void load()
    }
  }, [profile, load])

  const simulatedRows = useMemo(() => {
    return rows.map((row) => {
      const specId = row.spec_id_resuelto ?? row.spec_id_vinculado
      const draftFactor = resolveDraftFactor(specId, specsById, draftFactors)
      const factorSim =
        draftFactor ?? row.factor_tabla ?? row.factor_aplicado
      const resistenciaSim = roundResistenciaCorregida(row.resistencia_calculada, factorSim)
      const pctSim =
        row.porcentaje_simulado ??
        approximatePorcentajePreview(
          row.porcentaje_actual,
          row.resistencia_corregida_actual,
          resistenciaSim
        )
      const deltaPct =
        pctSim != null ? Math.round((pctSim - row.porcentaje_actual) * 100) / 100 : null
      const mismatchSim =
        factorsDiffer(row.factor_aplicado, factorSim) ||
        factorsDiffer(row.resistencia_corregida_actual, resistenciaSim, 0.01)

      return {
        ...row,
        factor_simulado: factorSim,
        resistencia_corregida_simulada: resistenciaSim,
        porcentaje_simulado: pctSim,
        delta_porcentaje: deltaPct,
        mismatch_simulacion: mismatchSim || row.mismatch_tabla,
      }
    })
  }, [rows, draftFactors, specsById])

  const dirtySpecIds = useMemo(() => {
    return specs.filter((s) => {
      const draft = draftFactors[s.id]
      return draft !== undefined && draft !== String(s.correction_factor)
    })
  }, [specs, draftFactors])

  const impactCount = simulatedRows.filter((r) => r.mismatch_simulacion).length
  const tableMismatchCount = summary?.mismatch_tabla ?? rows.filter((r) => r.mismatch_tabla).length

  async function applyBulkCorrections(mode: 'tabla' | 'borrador') {
    const count =
      mode === 'tabla'
        ? tableMismatchCount
        : simulatedRows.filter((r) => r.mismatch_simulacion).length

    if (count <= 0) {
      toast.message(mode === 'tabla' ? 'No hay desvíos vs catálogo' : 'No hay cambios con el borrador')
      return
    }

    const label =
      mode === 'tabla'
        ? `Se actualizarán hasta ${count} ensayo(s) para alinear factor, resistencia corregida y % cumplimiento con el catálogo guardado.`
        : `Se actualizarán hasta ${count} ensayo(s) con los factores del borrador (sin guardar el catálogo).`

    if (!window.confirm(`${label}\n\n¿Continuar?`)) return

    setApplyingBulk(true)
    try {
      const draftMap: Record<string, number> = {}
      if (mode === 'borrador') {
        for (const s of specs) {
          const v = parseFloat(draftFactors[s.id] ?? String(s.correction_factor))
          if (Number.isFinite(v) && v > 0) draftMap[s.id] = v
        }
      }

      const res = await fetch('/api/quality/ensayos/correction-factor-preview/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
          plant_id: currentPlant?.id ?? null,
          limit: 500,
          draft_factors: draftMap,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al aplicar')

      const failed = (j.failed as { ensayo_id: string; reason: string }[])?.length ?? 0
      toast.success(
        `Listo: ${j.updated ?? 0} ensayo(s) corregido(s)${failed > 0 ? `, ${failed} fallido(s)` : ''}`
      )
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al corregir ensayos')
    } finally {
      setApplyingBulk(false)
    }
  }

  async function saveSpec(id: string) {
    const correction_factor = parseFloat(draftFactors[id])
    if (!Number.isFinite(correction_factor) || correction_factor <= 0 || correction_factor > 2) {
      toast.error('Factor inválido (0–2)')
      return
    }
    setSavingSpecId(id)
    try {
      const res = await fetch(`/api/quality/specimen-type-specs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correction_factor }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al guardar')
      toast.success('Factor guardado en catálogo')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingSpecId(null)
    }
  }

  async function recomputeOfficialPct() {
    const draftMap: Record<string, number> = {}
    for (const s of specs) {
      const v = parseFloat(draftFactors[s.id] ?? String(s.correction_factor))
      if (Number.isFinite(v) && v > 0) draftMap[s.id] = v
    }
    setRecomputingPct(true)
    try {
      const res = await fetch('/api/quality/ensayos/correction-factor-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ensayo_ids: rows.map((r) => r.ensayo_id),
          draft_factors: draftMap,
          recompute_pct: true,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error')
      const byId = new Map((j.rows as PreviewRow[]).map((r) => [r.ensayo_id, r]))
      setRows((prev) =>
        prev.map((r) => {
          const updated = byId.get(r.ensayo_id)
          if (!updated) return r
          return {
            ...r,
            porcentaje_simulado: updated.porcentaje_simulado,
            delta_porcentaje: updated.delta_porcentaje,
            resistencia_corregida_simulada: updated.resistencia_corregida_simulada,
            factor_simulado: updated.factor_simulado,
          }
        })
      )
      toast.success('% de cumplimiento recalculados (curva oficial)')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setRecomputingPct(false)
    }
  }

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-8 flex gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-700 shrink-0" />
        <div>
          <h1 className="text-lg font-semibold text-stone-900">Sin acceso</h1>
          <p className="text-sm text-stone-600 mt-1">No tienes permisos para esta vista temporal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <QualityBreadcrumb
        hubName="Ensayos"
        hubHref="/quality/ensayos"
        items={[{ label: 'Vista previa factores' }]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-stone-600 text-sm mb-1">
            <FlaskConical className="h-4 w-4" />
            <span className="uppercase tracking-wide font-medium">Temporal</span>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
            Ensayos — vista previa de factores de corrección
          </h1>
          <p className="text-sm text-stone-600 mt-2 max-w-2xl">
            Ajusta los factores por tipo y dimensión de probeta y revisa el impacto en resistencia
            corregida y cumplimiento antes de guardar el catálogo o reasignar ensayos existentes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" className={qualityHubOutlineNeutralClass} asChild>
            <Link href="/quality/ensayos">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Ensayos
            </Link>
          </Button>
          <Button
            variant="outline"
            className={qualityHubOutlineNeutralClass}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
        El botón «Corregir desvíos vs catálogo» actualiza en bloque factor, resistencia corregida y
        porcentaje de cumplimiento según specimen_type_specs. Si editaste el borrador, guarda el
        catálogo antes o usa «Corregir según borrador».
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-stone-900">Catálogo de factores (borrador)</h2>
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                    Tipo
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                    Dimensión
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                    Factor
                  </th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {specs.map((s) => {
                  const saved = String(s.correction_factor)
                  const draft = draftFactors[s.id] ?? saved
                  const isDirty = draft !== saved
                  return (
                    <tr key={s.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {s.tipo_muestra}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-medium">{s.dimension_label}</td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 w-24 text-center font-mono text-xs"
                          value={draft}
                          disabled={!canWriteSpecs}
                          onChange={(e) =>
                            setDraftFactors((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        {canWriteSpecs && (
                          <Button
                            type="button"
                            size="sm"
                            className={cn(qualityHubPrimaryButtonClass, 'h-8 text-xs')}
                            disabled={!isDirty || savingSpecId === s.id}
                            onClick={() => void saveSpec(s.id)}
                          >
                            {savingSpecId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-3.5 w-3.5 mr-1" />
                                Guardar
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {dirtySpecIds.length > 0 && (
            <p className="text-xs text-stone-600">
              {dirtySpecIds.length} especificación(es) con borrador sin guardar — la simulación abajo
              usa los valores del borrador.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-stone-500 block mb-1">Desde</label>
          <Input
            type="date"
            className="h-9 w-40"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Hasta</label>
          <Input
            type="date"
            className="h-9 w-40"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-700 h-9">
          <input
            type="checkbox"
            checked={onlyMismatch}
            onChange={(e) => setOnlyMismatch(e.target.checked)}
            className="rounded border-stone-300"
          />
          Solo desvíos vs tabla
        </label>
        <Button className={qualityHubPrimaryButtonClass} onClick={() => void load()} disabled={loading}>
          Aplicar filtros
        </Button>
        <Button
          variant="outline"
          className={qualityHubOutlineNeutralClass}
          disabled={recomputingPct || rows.length === 0}
          onClick={() => void recomputeOfficialPct()}
        >
          {recomputingPct ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : null}
          Recalcular % oficial
        </Button>
        {canApplyEnsayos && (
          <>
            <Button
              className={qualityHubPrimaryButtonClass}
              disabled={applyingBulk || loading || tableMismatchCount <= 0}
              onClick={() => void applyBulkCorrections('tabla')}
            >
              {applyingBulk ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Wrench className="h-4 w-4 mr-1.5" />
              )}
              Corregir desvíos vs catálogo ({tableMismatchCount})
            </Button>
            {dirtySpecIds.length > 0 && (
              <Button
                variant="outline"
                className={qualityHubOutlineNeutralClass}
                disabled={applyingBulk || loading || impactCount <= 0}
                onClick={() => void applyBulkCorrections('borrador')}
              >
                Corregir según borrador ({impactCount})
              </Button>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">Ensayos cargados</p>
          <p className="text-xl font-semibold tabular-nums">{summary?.total ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">Desvío factor guardado vs tabla</p>
          <p className="text-xl font-semibold tabular-nums text-amber-800">
            {summary?.mismatch_tabla ?? '—'}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">Cambiarían con borrador</p>
          <p className="text-xl font-semibold tabular-nums text-sky-800">{impactCount}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">Planta</p>
          <p className="text-sm font-medium truncate">{currentPlant?.code ?? 'Todas'}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 border border-stone-200 rounded-lg bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-sky-700" />
          <span className="text-sm text-stone-600">Cargando ensayos…</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200">
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  Fecha
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  Planta
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  Probeta
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  R calc
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  Factor appl.
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  Factor sim.
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  R corr. act.
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  R corr. sim.
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  % act.
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  % sim.
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-stone-600">
                  Δ %
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {simulatedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-stone-500">
                    No hay ensayos en el rango seleccionado.
                  </td>
                </tr>
              ) : (
                simulatedRows.map((r) => (
                  <tr
                    key={r.ensayo_id}
                    className={cn(
                      'border-b border-stone-100 last:border-0',
                      r.mismatch_simulacion && 'bg-amber-50/40'
                    )}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(r.fecha_ensayo)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.plant_code ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{specimenTypeLabel(r.tipo_muestra ?? '')}</span>
                      {r.dimension_label && (
                        <span className="text-stone-500 text-xs block">{r.dimension_label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.resistencia_calculada.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.factor_aplicado.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-sky-800">
                      {r.factor_simulado.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.resistencia_corregida_actual.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-sky-800">
                      {r.resistencia_corregida_simulada.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.porcentaje_actual.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-sky-800">
                      {r.porcentaje_simulado != null ? r.porcentaje_simulado.toFixed(1) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono tabular-nums',
                        r.delta_porcentaje != null &&
                          Math.abs(r.delta_porcentaje) >= 2 &&
                          'text-amber-800 font-semibold'
                      )}
                    >
                      {r.delta_porcentaje != null
                        ? `${r.delta_porcentaje >= 0 ? '+' : ''}${r.delta_porcentaje.toFixed(1)}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/quality/ensayos/${r.ensayo_id}`}
                        className="text-xs text-sky-700 hover:underline whitespace-nowrap"
                      >
                        Ver ensayo
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
