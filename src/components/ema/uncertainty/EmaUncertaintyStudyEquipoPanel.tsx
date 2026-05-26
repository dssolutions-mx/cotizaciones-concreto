'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Info, Users, Wrench } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmaUncertaintyInstrumentEstadoBadge } from '@/components/ema/uncertainty/EmaUncertaintyInstrumentEstadoBadge'
import {
  MEASURAND_INSTRUMENT_CATEGORIES,
  MEASURAND_INSTRUMENT_ROLES,
  type MeasurandInstrumentRole,
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

/**
 * Chip shown under each instrument indicating which measurement role it has been assigned.
 * For single-input measurands (TEMP, REV, AIRE) this chip is never shown.
 */
function RoleChip({
  roleKey,
  roles,
  instrId,
  isLocked,
  onRoleChange,
}: {
  roleKey: string | undefined
  roles: MeasurandInstrumentRole[]
  instrId: string
  isLocked: boolean
  onRoleChange: (instrId: string, roleKey: string | null) => void
}) {
  const assigned = roleKey ? roles.find((r) => r.key === roleKey) : null
  return (
    <div className="mt-1">
      {isLocked ? (
        assigned ? (
          <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
            {assigned.label}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            Sin rol
          </span>
        )
      ) : (
        <Select
          value={roleKey ?? ''}
          onValueChange={(v) => onRoleChange(instrId, v || null)}
        >
          <SelectTrigger className="h-6 w-full max-w-[220px] rounded border border-stone-200 bg-white px-2 text-[10px] text-stone-700 shadow-none focus:ring-1 focus:ring-sky-400">
            <SelectValue placeholder="Asignar rol de instrumento" />
            <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-stone-400" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-xs text-stone-400">Sin rol asignado</SelectItem>
            {roles.map((ro) => (
              <SelectItem key={ro.key} value={ro.key} className="text-xs">
                <span className="font-medium text-stone-800">{ro.label}</span>
                <span className="ml-1 text-stone-400">({ro.symbols.join(', ')})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
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
  // instrumento_roles: maps instrumento_id → role key
  const [instrRoles, setInstrRoles] = useState<Record<string, string>>(initial.instrumento_roles ?? {})
  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proximoWarning, setProximoWarning] = useState<string | null>(null)

  const categories = MEASURAND_INSTRUMENT_CATEGORIES[measurand.codigo as MeasurandCodigo] ?? []
  // Multi-input measurands have role definitions; single-input measurands don't need role UI.
  const rolesDef = MEASURAND_INSTRUMENT_ROLES[measurand.codigo as MeasurandCodigo] ?? null

  const dirty = useMemo(() => {
    const sortedOps = [...operatorIds].sort()
    const sortedInstr = [...instrumentoIds].sort()
    const initialSortedOps = [...initial.operator_ids].sort()
    const initialSortedInstr = [...initial.instrumento_ids].sort()
    const rolesChanged = JSON.stringify(instrRoles) !== JSON.stringify(initial.instrumento_roles ?? {})
    return (
      JSON.stringify(sortedOps) !== JSON.stringify(initialSortedOps) ||
      JSON.stringify(sortedInstr) !== JSON.stringify(initialSortedInstr) ||
      rolesChanged
    )
  }, [operatorIds, instrumentoIds, instrRoles, initial])

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
    setInstrumentoIds((prev) => {
      if (prev.includes(id)) {
        // Also clear the role when deselecting
        setInstrRoles((r) => {
          const next = { ...r }
          delete next[id]
          return next
        })
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  function handleRoleChange(instrId: string, roleKey: string | null) {
    setInstrRoles((prev) => {
      const next = { ...prev }
      if (roleKey) next[instrId] = roleKey
      else delete next[instrId]
      return next
    })
  }

  async function savePool() {
    setError(null)
    setProximoWarning(null)
    if (instrumentoIds.length === 0) {
      setError('Seleccione al menos un instrumento vigente para el estudio.')
      return
    }

    // Role validation for multi-input measurands
    if (rolesDef) {
      const selectedWithRoles = instrumentoIds.filter((id) => instrRoles[id])
      const missingRoles = instrumentoIds.filter((id) => !instrRoles[id])
      if (missingRoles.length === instrumentoIds.length) {
        // None have roles — warn but don't block (backward compat for single-role measurands)
        setError(
          `Para ${measurand.codigo} seleccione el rol de cada instrumento (qué mide: ${rolesDef.map((r) => r.label).join(' / ')}). ` +
          'Sin rol, la calibración usará ci=1 en lugar del coeficiente de sensibilidad correcto.',
        )
        return
      }
      if (missingRoles.length > 0 && selectedWithRoles.length > 0) {
        // Partial — allow but warn
        setProximoWarning(
          `${missingRoles.length} instrumento(s) sin rol asignado. Asignar roles mejora la exactitud del presupuesto (ci correcto por símbolo).`,
        )
      }
    }

    const validation = await validateUncertaintyInstrumentSelection(instrumentoIds)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    if (validation.proximo_vencer.length > 0) {
      setProximoWarning(
        (proximoWarning ? proximoWarning + ' · ' : '') +
        `Próximos a vencer: ${validation.proximo_vencer.map((x) => x.codigo).join(', ')}. Verifique calibración antes de publicar.`,
      )
    }

    setSaving(true)
    try {
      const pool: UncertaintyEquipoPool = {
        operator_ids: operatorIds,
        instrumento_ids: instrumentoIds,
        ...(Object.keys(instrRoles).length > 0 ? { instrumento_roles: instrRoles } : {}),
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
        {rolesDef && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {rolesDef.map((role) => (
              <span key={role.key} className="flex items-center gap-1 text-[11px] text-stone-500">
                <Info className="h-3 w-3 text-sky-500" />
                <span className="font-medium text-stone-700">{role.label}</span>
                <span className="text-stone-400">→ símbolos: {role.symbols.join(', ')} · categorías: {role.categories.join(', ')}</span>
              </span>
            ))}
          </div>
        )}
      </header>

      {loading ? (
        <p className="px-4 py-6 text-sm text-stone-500">Cargando catálogo…</p>
      ) : (
        <div className="grid gap-6 p-4 lg:grid-cols-2">
          {/* ── Operators ── */}
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

          {/* ── Instruments ── */}
          <div>
            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              <Wrench className="h-3.5 w-3.5" />
              Instrumentos ({instrumentoIds.length})
            </h4>
            <p className="mt-1 text-[11px] text-stone-500">
              Categorías: {categories.join(', ') || 'todas vigentes'} · u de calibración entra al Type B.
              {rolesDef && (
                <> Asigne el rol de cada instrumento para que el motor aplique el coeficiente de sensibilidad correcto (GUM §5.1.3).</>
              )}
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
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-md border border-stone-100 bg-white p-2">
              {instruments.length === 0 ? (
                <li className="text-xs text-stone-400">
                  No hay instrumentos vigentes.
                  <Link href="/quality/instrumentos" className="ml-1 text-sky-800 hover:underline">
                    Ir a instrumentos
                  </Link>
                </li>
              ) : (
                instruments.map((inst) => {
                  const isSelected = instrumentoIds.includes(inst.id)
                  return (
                    <li key={inst.id} className={cn(
                      'rounded-md border border-transparent',
                      isSelected && rolesDef && 'border-stone-100 bg-stone-50/70 p-1',
                    )}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50',
                          isLocked && 'pointer-events-none opacity-60',
                          isSelected && rolesDef && 'hover:bg-transparent',
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={isLocked}
                          onCheckedChange={() => toggleInstrument(inst.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-mono text-xs text-stone-500">{inst.codigo}</span>
                          <span className="ml-1 text-stone-800">{inst.nombre}</span>
                          <span className="mt-1 block">
                            <EmaUncertaintyInstrumentEstadoBadge estado={inst.estado} />
                          </span>
                          {/* Role assignment dropdown — only for multi-input measurands when selected */}
                          {isSelected && rolesDef && (
                            <RoleChip
                              roleKey={instrRoles[inst.id]}
                              roles={rolesDef}
                              instrId={inst.id}
                              isLocked={isLocked}
                              onRoleChange={handleRoleChange}
                            />
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })
              )}
            </ul>

            {/* Role coverage summary for multi-input measurands */}
            {rolesDef && instrumentoIds.length > 0 && (
              <div className="mt-2 space-y-1">
                {rolesDef.map((role) => {
                  const covered = instrumentoIds.filter((id) => instrRoles[id] === role.key)
                  return (
                    <div key={role.key} className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        covered.length > 0 ? 'bg-emerald-500' : 'bg-amber-400',
                      )} />
                      <span className="font-medium text-stone-700">{role.label}</span>
                      {covered.length > 0 ? (
                        <span className="text-emerald-700">
                          {covered.length === 1 ? '1 instrumento' : `${covered.length} instrumentos`}
                        </span>
                      ) : (
                        <span className="text-amber-700">sin instrumento asignado</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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
