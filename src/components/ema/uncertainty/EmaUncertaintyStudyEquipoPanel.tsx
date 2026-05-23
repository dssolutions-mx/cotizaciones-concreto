'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Users, Wrench } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { EmaUncertaintyInstrumentEstadoBadge } from '@/components/ema/uncertainty/EmaUncertaintyInstrumentEstadoBadge'
import {
  MEASURAND_INSTRUMENT_CATEGORIES,
} from '@/lib/ema/uncertaintyMeasurand'
import {
  operatorRoleLabel,
  parseEquipoPool,
  validateUncertaintyInstrumentSelection,
} from '@/lib/ema/uncertaintyStudyDesign'
import type {
  MeasurandCodigo,
  UncertaintyEquipoPool,
  UncertaintyMeasurand,
  UncertaintyStudy,
} from '@/types/ema-uncertainty'
import { cn } from '@/lib/utils'

type OperatorOption = { id: string; email: string; full_name: string; role: string }
type InstrumentOption = {
  id: string
  codigo: string
  nombre: string
  estado?: string
}

export function EmaUncertaintyStudyEquipoPanel({
  study,
  measurand,
  isLocked,
  onPoolSaved,
}: {
  study: UncertaintyStudy
  measurand: UncertaintyMeasurand
  isLocked: boolean
  onPoolSaved: (pool: UncertaintyEquipoPool) => void
}) {
  const initial = parseEquipoPool(study.equipo_pool_json)
  const [operatorIds, setOperatorIds] = useState<string[]>(initial.operator_ids)
  const [instrumentoIds, setInstrumentoIds] = useState<string[]>(initial.instrumento_ids)
  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proximoWarning, setProximoWarning] = useState<string | null>(null)

  const categories = MEASURAND_INSTRUMENT_CATEGORIES[measurand.codigo as MeasurandCodigo] ?? []
  const dirty =
    JSON.stringify(operatorIds.slice().sort()) !==
      JSON.stringify(initial.operator_ids.slice().sort()) ||
    JSON.stringify(instrumentoIds.slice().sort()) !==
      JSON.stringify(initial.instrumento_ids.slice().sort())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const instFetches =
          categories.length > 0
            ? categories.map((cat) => {
                const params = new URLSearchParams({
                  limit: '100',
                  categoria: cat,
                  estado: 'vigente',
                })
                if (study.plant_id) params.set('plant_id', study.plant_id)
                return fetch(`/api/ema/instrumentos?${params}`)
              })
            : [
                (() => {
                  const params = new URLSearchParams({ limit: '200', estado: 'vigente' })
                  if (study.plant_id) params.set('plant_id', study.plant_id)
                  return fetch(`/api/ema/instrumentos?${params}`)
                })(),
              ]

        const [opRes, ...instRes] = await Promise.all([
          fetch('/api/ema/uncertainty/operators'),
          ...instFetches,
        ])
        if (cancelled) return
        const opJson = await opRes.json()
        setOperators(Array.isArray(opJson.data) ? opJson.data : [])

        const merged = new Map<string, InstrumentOption>()
        for (const res of instRes) {
          const j = await res.json()
          for (const row of j.data ?? []) {
            merged.set(row.id, {
              id: row.id,
              codigo: row.codigo,
              nombre: row.nombre,
              estado: row.estado,
            })
          }
        }
        setInstruments([...merged.values()].sort((a, b) => a.codigo.localeCompare(b.codigo)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [study.plant_id, categories.join('|')])

  const selectedOperators = useMemo(
    () => operators.filter((o) => operatorIds.includes(o.id)),
    [operators, operatorIds],
  )

  function toggleOperator(id: string) {
    setOperatorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleInstrument(id: string) {
    setInstrumentoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function savePool() {
    setError(null)
    setProximoWarning(null)
    // Note: 1 operator is valid — the budget uses Type A repetibilidad (GUM §4.2.3).
    // ANOVA for inter-operator reproducibility activates automatically when ≥2 operators
    // each have ≥2 replicas; it is optional, not required.
    if (instrumentoIds.length === 0) {
      setError('Seleccione al menos un instrumento vigente para el estudio.')
      return
    }

    const validation = await validateUncertaintyInstrumentSelection(instrumentoIds)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    if (validation.proximo_vencer.length > 0) {
      setProximoWarning(
        `Próximos a vencer: ${validation.proximo_vencer.map((x) => x.codigo).join(', ')}. Verifique calibración antes de publicar.`,
      )
    }

    setSaving(true)
    try {
      const pool: UncertaintyEquipoPool = {
        operator_ids: operatorIds,
        instrumento_ids: instrumentoIds,
      }
      const res = await fetch(`/api/ema/uncertainty/studies/${study.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipo_pool_json: pool }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Error guardando equipo')
      }
      onPoolSaved(pool)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (!study.plant_id && !isLocked) {
    return (
      <section className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-6 text-center text-sm text-amber-950">
        <p className="font-medium">Asigne la planta del estudio</p>
        <p className="mt-1 text-xs text-amber-900/90">
          El catálogo de instrumentos vigentes se filtra por planta (NMX-EC-17025-IMNC-2018 §6.4).
        </p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200">
      <header className="border-b border-stone-200 bg-stone-50/70 px-4 py-3">
        <h3 className="text-sm font-semibold text-stone-800">Equipo del estudio</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-600">
          Defina los <strong className="font-medium text-stone-800">participantes</strong> y los{' '}
          <strong className="font-medium text-stone-800">instrumentos</strong> aprobados antes de capturar
          lecturas. Las asignaciones en la pestaña Lecturas quedarán acotadas a este listado (ISO 5725-2 §7;
          GUM §4.2.4).
        </p>
      </header>

      {loading ? (
        <p className="px-4 py-6 text-sm text-stone-500">Cargando catálogo…</p>
      ) : (
        <div className="grid gap-6 p-4 lg:grid-cols-2">
          <div>
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <Users className="h-3.5 w-3.5" />
              Operadores ({operatorIds.length})
            </h4>
            <p className="mt-1 text-[11px] text-stone-500">
              1 operador: presupuesto con repetibilidad simple (GUM §4.2.3). Con ≥2 operadores y ≥2 réplicas cada uno,
              el motor activa ANOVA para estimar reproducibilidad inter-operador (s<sub>L</sub>, ISO 5725-2 §7).
            </p>
            {!isLocked && operators.length > 0 && (
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setOperatorIds(operators.map((o) => o.id))}
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setOperatorIds([])}
                >
                  Ninguno
                </Button>
              </div>
            )}
            <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-md border border-stone-100 bg-white p-2">
              {operators.length === 0 ? (
                <li className="text-xs text-stone-400">Sin operadores de laboratorio/calidad activos.</li>
              ) : (
                operators.map((op) => (
                  <li key={op.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50',
                        isLocked && 'pointer-events-none opacity-60',
                      )}
                    >
                      <Checkbox
                        checked={operatorIds.includes(op.id)}
                        disabled={isLocked}
                        onCheckedChange={() => toggleOperator(op.id)}
                      />
                      <span className="min-w-0">
                        <span className="font-medium text-stone-800">{op.full_name}</span>
                        <span className="mt-0.5 block text-[11px] text-stone-500">
                          {operatorRoleLabel(op.role)} · {op.email}
                        </span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <Wrench className="h-3.5 w-3.5" />
              Instrumentos ({instrumentoIds.length})
            </h4>
            <p className="mt-1 text-[11px] text-stone-500">
              Categorías: {categories.join(', ') || 'todas vigentes'} · u de calibración entra al Type B.
            </p>
            {!isLocked && instruments.length > 0 && (
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setInstrumentoIds(instruments.map((i) => i.id))}
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setInstrumentoIds([])}
                >
                  Ninguno
                </Button>
              </div>
            )}
            <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto rounded-md border border-stone-100 bg-white p-2">
              {instruments.length === 0 ? (
                <li className="text-xs text-stone-400">
                  No hay instrumentos vigentes.
                  <Link href="/quality/instrumentos" className="ml-1 text-sky-800 hover:underline">
                    Ir a instrumentos
                  </Link>
                </li>
              ) : (
                instruments.map((inst) => (
                  <li key={inst.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50',
                        isLocked && 'pointer-events-none opacity-60',
                      )}
                    >
                      <Checkbox
                        checked={instrumentoIds.includes(inst.id)}
                        disabled={isLocked}
                        onCheckedChange={() => toggleInstrument(inst.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-xs text-stone-500">{inst.codigo}</span>
                        <span className="ml-1 text-stone-800">{inst.nombre}</span>
                        <span className="mt-1 block">
                          <EmaUncertaintyInstrumentEstadoBadge estado={inst.estado} />
                        </span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {!isLocked && (
        <footer className="flex flex-wrap items-center gap-3 border-t border-stone-100 bg-stone-50/50 px-4 py-3">
          <Button type="button" size="sm" disabled={saving || !dirty} onClick={savePool}>
            {saving ? 'Guardando…' : 'Confirmar equipo del estudio'}
          </Button>
          {selectedOperators.length >= 1 && instrumentoIds.length > 0 && !dirty && (
            <span className="text-xs text-emerald-800">Equipo confirmado</span>
          )}
        </footer>
      )}

      {error && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-800">{error}</p>
      )}
      {proximoWarning && !error && (
        <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {proximoWarning}
        </p>
      )}
    </section>
  )
}
