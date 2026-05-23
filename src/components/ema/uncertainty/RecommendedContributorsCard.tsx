'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, Plus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  RecommendedContributor,
  StudyCustomInput,
  UncertaintyMeasurand,
  UncertaintyStudy,
  UncertaintyStudyReplica,
} from '@/types/ema-uncertainty'

/**
 * "Contribuyentes según norma + GUM" card.
 *
 * Renders the per-measurand recommended contributors (loaded from
 * `measurand.recommended_contributors_json`) and reports each one's status
 * given the study's current state: which instruments are equipped, whether
 * those instruments have a current cert/verification, whether the user has
 * already added a manual entry for the same role, and whether the engine
 * will auto-include it (repetibilidad, ANOVA reproducibilidad).
 *
 * The contract:
 *   - `auto-replicas` → always 🟢 (the study replicas drive it).
 *   - `auto-from-instrument` → 🟢 when ≥1 equipped instrument has a cal/verif
 *     visible to `resolveInstrumentCalibration`; 🔴 otherwise with a deep-link
 *     to the instrument's verification recompute button.
 *   - `stopgap-only-when-no-cert` → ⚪ "ya incluida en Calibración" when a cert
 *     is present (with explanatory tooltip about double-counting); 🟡 with an
 *     "Agregar como solución temporal" button when no cert exists.
 *   - `auto-anova` → 🟢 when ≥2 operators × ≥2 replicas; hidden otherwise.
 */
export function RecommendedContributorsCard({
  study,
  measurand,
  replicas,
  customInputs,
  isLocked,
  onAddCustomInput,
}: {
  study: UncertaintyStudy
  measurand: UncertaintyMeasurand
  replicas: UncertaintyStudyReplica[]
  customInputs: StudyCustomInput[]
  isLocked: boolean
  onAddCustomInput: (body: { simbolo: string; nombre_display: string; tipo_ab: 'B'; b_subtipo: 'resolucion'; div_min: number; unidad: string; descripcion: string }) => Promise<void>
}) {
  const recommended = measurand.recommended_contributors_json ?? []
  const equipo = study.equipo_pool_json
  const instrumentoIds = useMemo<string[]>(
    () => (equipo?.instrumento_ids ?? []),
    [equipo],
  )

  // Per-instrument calibration status
  const [calByInstr, setCalByInstr] = useState<Record<string, {
    u_expandida: number | null
    k_factor: number | null
    unidad: string | null
    numero_certificado: string | null
    nombre?: string
  } | null>>({})
  const [loadingCals, setLoadingCals] = useState(true)

  const fetchCals = useCallback(async () => {
    if (instrumentoIds.length === 0) { setLoadingCals(false); return }
    const results = await Promise.all(
      instrumentoIds.map(async (id) => {
        try {
          const res = await fetch(`/api/ema/instrumentos/${id}/calibraciones?latest=1`)
          if (!res.ok) return [id, null] as const
          const json = await res.json()
          const row = Array.isArray(json.data) ? json.data[0] : null
          return [id, row ?? null] as const
        } catch {
          return [id, null] as const
        }
      }),
    )
    const map: Record<string, {
      u_expandida: number | null
      k_factor: number | null
      unidad: string | null
      numero_certificado: string | null
      nombre?: string
    } | null> = {}
    for (const [id, row] of results) map[id] = row
    setCalByInstr(map)
    setLoadingCals(false)
  }, [instrumentoIds])

  useEffect(() => { fetchCals() }, [fetchCals])

  // Operator pool from replicas (only count operators with ≥2 replicas)
  const operatorCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of replicas) {
      if (!r.operator_id) continue
      m.set(r.operator_id, (m.get(r.operator_id) ?? 0) + 1)
    }
    return m
  }, [replicas])
  const operatorsWithEnoughReplicas = Array.from(operatorCounts.values()).filter((n) => n >= 2).length

  const certPresent = Object.values(calByInstr).some((c) => c?.u_expandida != null && c.u_expandida > 0)

  function renderRow(rec: RecommendedContributor) {
    if (rec.mode === 'auto-replicas') {
      return (
        <RecRow
          key={rec.key}
          status="ok"
          title={rec.nombre_display}
          chipLabel={`Tipo ${rec.tipo_ab}`}
          detail="Incluida automáticamente desde las réplicas del estudio (s/√n)."
          normaRef={rec.norma_ref}
        />
      )
    }

    if (rec.mode === 'auto-from-instrument') {
      if (loadingCals) {
        return <RecRow key={rec.key} status="pending" title={rec.nombre_display} chipLabel={`Tipo ${rec.tipo_ab}`} detail="Cargando…" normaRef={rec.norma_ref} />
      }
      if (instrumentoIds.length === 0) {
        return (
          <RecRow
            key={rec.key}
            status="error"
            title={rec.nombre_display}
            chipLabel={`Tipo ${rec.tipo_ab}`}
            detail="No hay instrumentos asignados al estudio (Pool de equipos). Agrega al menos uno para que su U declarada se incluya."
            normaRef={rec.norma_ref}
          />
        )
      }
      const cals = instrumentoIds.map((id) => ({ id, cal: calByInstr[id] }))
      const withCal = cals.filter((x) => x.cal?.u_expandida != null && x.cal.u_expandida > 0)
      if (withCal.length === 0) {
        return (
          <RecRow
            key={rec.key}
            status="error"
            title={rec.nombre_display}
            chipLabel={`Tipo ${rec.tipo_ab}`}
            detail="Ninguno de los instrumentos asignados tiene certificado externo ni verificación interna con U declarada. El presupuesto no es trazable hasta que se calcule."
            normaRef={rec.norma_ref}
            actions={cals.map(({ id }) => (
              <Link
                key={id}
                href={`/quality/instrumentos/${id}`}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
              >
                <ArrowRight className="h-3 w-3" />
                Ir al instrumento {id.slice(0, 8)}…
              </Link>
            ))}
          />
        )
      }
      return (
        <RecRow
          key={rec.key}
          status="ok"
          title={rec.nombre_display}
          chipLabel={`Tipo ${rec.tipo_ab}`}
          detail={withCal.map((x) => `U=${x.cal!.u_expandida} ${x.cal!.unidad ?? ''} (k=${x.cal!.k_factor ?? 2}, ${x.cal!.numero_certificado ?? 'sin núm.'})`).join(' · ')}
          normaRef={rec.norma_ref}
        />
      )
    }

    if (rec.mode === 'stopgap-only-when-no-cert') {
      // When a cert is present, this row is redundant — the instrument's resolution
      // is already inside the calibration U. Render as informational only.
      if (certPresent) {
        return (
          <RecRow
            key={rec.key}
            status="muted"
            title={rec.nombre_display}
            chipLabel="No requerida"
            detail="Ya está incluida dentro de la U del instrumento (Calibración / Verificación). Añadirla por separado duplicaría la contribución de resolución."
            normaRef={rec.norma_ref}
          />
        )
      }
      // No cert: this is the only way to get an instrument-related Type B in the budget.
      const alreadyAdded = customInputs.some((c) =>
        c.b_subtipo === 'resolucion' && c.simbolo.toLowerCase().startsWith('r')
      )
      if (alreadyAdded) {
        return (
          <RecRow
            key={rec.key}
            status="ok"
            title={rec.nombre_display}
            chipLabel={`Tipo ${rec.tipo_ab}`}
            detail="Añadida como Variable personalizada. El presupuesto sigue sin ser trazable hasta que el instrumento tenga una verificación con U declarada."
            normaRef={rec.norma_ref}
          />
        )
      }
      const divMin = rec.defaults?.div_min ?? 0.1
      const unidad = rec.defaults?.unidad ?? measurand.unidad
      return (
        <RecRow
          key={rec.key}
          status="warning"
          title={rec.nombre_display}
          chipLabel={`Tipo ${rec.tipo_ab}`}
          detail={`u = divMin / (2√3). Sin verificación del instrumento, esta es la única traza de incertidumbre instrumental disponible. ${rec.descripcion ?? ''}`}
          normaRef={rec.norma_ref}
          actions={
            !isLocked && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onAddCustomInput({
                  simbolo: 'R',
                  nombre_display: rec.nombre_display,
                  tipo_ab: 'B',
                  b_subtipo: 'resolucion',
                  div_min: divMin,
                  unidad,
                  descripcion: 'Solución temporal: el instrumento no tiene verificación con U declarada.',
                })}
              >
                <Plus className="mr-1 h-3 w-3" />
                Agregar como solución temporal
              </Button>
            )
          }
          warningBanner="El presupuesto no es metrológicamente trazable mientras el instrumento no tenga una verificación / certificado con U declarada."
        />
      )
    }

    if (rec.mode === 'auto-anova') {
      if (operatorsWithEnoughReplicas >= 2) {
        return (
          <RecRow
            key={rec.key}
            status="ok"
            title={rec.nombre_display}
            chipLabel={`Tipo ${rec.tipo_ab}`}
            detail={`Incluida automáticamente (ANOVA con ${operatorsWithEnoughReplicas} operadores con ≥2 réplicas).`}
            normaRef={rec.norma_ref}
          />
        )
      }
      // Hidden when not active
      return null
    }

    return null
  }

  if (recommended.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">
            Contribuyentes según norma + GUM
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Cobertura mínima del presupuesto para {measurand.nombre} ({measurand.metodo_norma}).
            Las contribuciones marcadas como 🟢 ya están incluidas; las 🔴 / 🟡 requieren acción.
          </p>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {recommended.map(renderRow)}
      </div>
    </section>
  )
}

type RowStatus = 'ok' | 'warning' | 'error' | 'muted' | 'pending'

function RecRow({
  status,
  title,
  chipLabel,
  detail,
  normaRef,
  actions,
  warningBanner,
}: {
  status: RowStatus
  title: string
  chipLabel: string
  detail: string
  normaRef?: string
  actions?: React.ReactNode
  warningBanner?: string
}) {
  const meta = {
    ok:      { icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />, border: 'border-emerald-200 bg-emerald-50/40' },
    warning: { icon: <AlertCircle  className="h-4 w-4 text-amber-600" />,   border: 'border-amber-200 bg-amber-50/50' },
    error:   { icon: <AlertCircle  className="h-4 w-4 text-red-600" />,     border: 'border-red-200 bg-red-50/40' },
    muted:   { icon: <Info         className="h-4 w-4 text-stone-400" />,   border: 'border-stone-200 bg-stone-50/50' },
    pending: { icon: <Info         className="h-4 w-4 text-stone-400" />,   border: 'border-stone-200 bg-stone-50/30' },
  }[status]

  return (
    <div className={cn('rounded-lg border px-3 py-2.5', meta.border)}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-stone-800">{title}</span>
            <span className="rounded bg-stone-200/60 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
              {chipLabel}
            </span>
            {normaRef && (
              <span className="text-[10px] text-stone-400">{normaRef}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-stone-600">{detail}</p>
          {actions && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">{actions}</div>
          )}
          {warningBanner && (
            <p className="mt-1.5 rounded bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
              ⚠ {warningBanner}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
