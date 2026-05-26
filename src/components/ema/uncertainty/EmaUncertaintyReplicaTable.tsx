'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Info, RefreshCw, Users } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { EmaNormReferenceChip } from '@/components/ema/uncertainty/EmaNormReferenceChip'
import { EmaUncertaintyAnovaReadinessBanner } from '@/components/ema/uncertainty/EmaUncertaintyAnovaReadinessBanner'
import { EmaUncertaintyInputMeansCard } from '@/components/ema/uncertainty/EmaUncertaintyInputMeansCard'
import { EmaUncertaintyInstrumentEstadoBadge } from '@/components/ema/uncertainty/EmaUncertaintyInstrumentEstadoBadge'
import {
  MEASURAND_INSTRUMENT_CATEGORIES,
  MEASURAND_INSTRUMENT_ROLES,
  computeReplicaMeasurand,
} from '@/lib/ema/uncertaintyMeasurand'
import { operatorRoleLabel } from '@/lib/ema/uncertaintyStudyDesign'
import type {
  MeasurandCodigo,
  UncertaintyEquipoPool,
  UncertaintyStudy,
  UncertaintyStudyReplica,
} from '@/types/ema-uncertainty'
import { cn } from '@/lib/utils'

type OperatorOption = { id: string; email: string; full_name: string; role: string }
type InstrumentOption = {
  id: string
  codigo: string
  nombre: string
  estado?: string
  /** Categories this instrument belongs to (from the fetch query). Used for
   *  category-based role filtering when no explicit pool role assignments exist. */
  categorias?: string[]
}

function InstrumentSelectLabel({
  inst,
}: {
  inst: Pick<InstrumentOption, 'codigo' | 'nombre'>
}) {
  return (
    <>
      <span className="font-mono text-xs">{inst.codigo}</span>
      {' · '}
      {inst.nombre}
    </>
  )
}

export function EmaUncertaintyReplicaTable({
  study,
  replicas,
  equipoPool,
  onReplicaChange,
  onBulkAssign,
  onSave,
  pendingSave,
  saving,
  onPreview,
  previewLoading,
  isLocked,
}: {
  study: UncertaintyStudy
  replicas: UncertaintyStudyReplica[]
  equipoPool: UncertaintyEquipoPool
  onReplicaChange: (
    orden: number,
    field: string,
    value: number | string | null,
    joins?: {
      operator?: UncertaintyStudyReplica['operator'] | null
      instrumento?: UncertaintyStudyReplica['instrumento'] | null
    },
  ) => void
  onBulkAssign: (
    patch: {
      operatorRoundRobin?: boolean
      sameOperatorId?: string | null
      sameInstrumentoId?: string | null
      /** Bulk-set a raw_values_json key to a string value (for secondary instrument UUIDs) */
      rawValueField?: string
      rawValueData?: string | null
    },
    helpers?: {
      resolveOperator?: (id: string) => UncertaintyStudyReplica['operator']
      resolveInstrumento?: (id: string) => UncertaintyStudyReplica['instrumento']
    },
  ) => void
  onSave: () => void
  pendingSave: boolean
  saving: boolean
  onPreview: () => void
  previewLoading: boolean
  isLocked: boolean
}) {
  const measurand = study.measurand!
  // L (support span) for VIGAS is a study-level constant (env_overrides.L_span),
  // not a per-specimen measurement — hide it from the réplica grid.
  const excludedSimbolos = new Set(study.excluded_input_simbolos ?? [])
  const inputs = (measurand.inputs ?? [])
    .filter((i) => i.kind === 'measured')
    .filter((i) => !(measurand.codigo === 'VIGAS' && i.simbolo === 'L'))
    .filter((i) => !excludedSimbolos.has(i.simbolo))
    .sort((a, b) => a.orden - b.orden)

  // Role context for multi-input measurands
  const rolesDef = MEASURAND_INSTRUMENT_ROLES[measurand.codigo as MeasurandCodigo] ?? null
  const primaryRole = rolesDef?.[0] ?? null
  // Show per-role instrument columns whenever the measurand defines ≥2 instrument roles
  // (e.g. FC/FC_CUBO/VIGAS/MU). No pool role-assignment required — the columns appear
  // immediately and use category-based filtering to pre-populate each dropdown correctly.
  const instrRolesFromPool = equipoPool.instrumento_roles ?? {}
  const showRoleColumns = !!(rolesDef && rolesDef.length > 1)

  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [instruments, setInstruments] = useState<InstrumentOption[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  const categories = MEASURAND_INSTRUMENT_CATEGORIES[measurand.codigo as MeasurandCodigo] ?? []

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingCatalog(true)
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
        for (let ci = 0; ci < instRes.length; ci++) {
          const fetchedCat = categories[ci] ?? null
          const j = await instRes[ci].json()
          for (const row of j.data ?? []) {
            const existing = merged.get(row.id)
            if (existing) {
              // Accumulate all categories this instrument satisfies
              if (fetchedCat && !existing.categorias?.includes(fetchedCat)) {
                existing.categorias = [...(existing.categorias ?? []), fetchedCat]
              }
            } else {
              merged.set(row.id, {
                id: row.id,
                codigo: row.codigo,
                nombre: row.nombre,
                estado: row.estado,
                categorias: fetchedCat ? [fetchedCat] : [],
              })
            }
          }
        }
        setInstruments([...merged.values()].sort((a, b) => a.codigo.localeCompare(b.codigo)))
      } finally {
        if (!cancelled) setLoadingCatalog(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [study.plant_id, categories.join('|')])

  const computed = replicas.map((r) => r.computed_value).filter((v): v is number => v !== null)
  const n = computed.length
  const mean = n > 0 ? computed.reduce((s, v) => s + v, 0) / n : null
  const s =
    n >= 2
      ? Math.sqrt(computed.reduce((acc, v) => acc + (v - mean!) ** 2, 0) / (n - 1))
      : null
  const u_A = s !== null ? s / Math.sqrt(n) : null

  const instrumentById = useMemo(
    () => new Map(instruments.map((i) => [i.id, i])),
    [instruments],
  )

  // Per-replica, per-symbol instrument hint (#9)
  const symbolInstrHintsByOrden = useMemo(() => {
    const map = new Map<number, Record<string, string | null>>()
    if (!rolesDef) return map
    for (const r of replicas) {
      const out: Record<string, string | null> = {}
      rolesDef.forEach((role, ri) => {
        const instrId = ri === 0
          ? (r.instrumento_id ?? null)
          : ((r.raw_values_json[`_instr_${role.key}`] as string | undefined) ?? null)
        const instr = instrId ? instrumentById.get(instrId) : null
        for (const sym of role.symbols) {
          out[sym] = instr?.codigo ?? null
        }
      })
      map.set(r.orden, out)
    }
    return map
  }, [rolesDef, replicas, instrumentById])

  const poolActive =
    equipoPool.operator_ids.length > 0 || equipoPool.instrumento_ids.length > 0

  const filteredOperators = useMemo(() => {
    if (equipoPool.operator_ids.length === 0) return operators
    return operators.filter((o) => equipoPool.operator_ids.includes(o.id))
  }, [operators, equipoPool.operator_ids])

  const filteredInstruments = useMemo(() => {
    let list = instruments
    if (equipoPool.instrumento_ids.length > 0) {
      list = list.filter((i) => equipoPool.instrumento_ids.includes(i.id))
    }
    for (const r of replicas) {
      if (r.instrumento_id && !list.some((i) => i.id === r.instrumento_id)) {
        const fromReplica = r.instrumento
        if (fromReplica) {
          list = [
            ...list,
            {
              id: r.instrumento_id,
              codigo: fromReplica.codigo,
              nombre: fromReplica.nombre,
              estado: 'vigente',
            },
          ]
        }
      }
    }
    return list.sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [instruments, equipoPool.instrumento_ids, replicas])

  // Per-role instrument lists for multi-instrument measurands (FC, FC_CUBO, VIGAS, MU).
  //
  // Priority order:
  //   1. Explicit pool role assignments (instrumento_roles map) — user has deliberately
  //      classified each instrument; highest fidelity.
  //   2. Category-based filtering — instruments whose `categorias` array overlaps the
  //      role's `categories` definition. Works without any user configuration.
  //   3. Full `filteredInstruments` list — last resort when neither assignment nor
  //      category data is available.
  const instrumentsByRoleKey = useMemo(() => {
    if (!rolesDef) return {} as Record<string, InstrumentOption[]>
    const map: Record<string, InstrumentOption[]> = {}
    for (const role of rolesDef) {
      // 1. Explicit pool assignments
      const assignedIds = new Set(
        Object.entries(instrRolesFromPool)
          .filter(([, rk]) => rk === role.key)
          .map(([id]) => id),
      )
      const byAssignment = filteredInstruments.filter((i) => assignedIds.has(i.id))
      if (byAssignment.length > 0) {
        map[role.key] = byAssignment
        continue
      }
      // 2. Category-based filtering (works without explicit assignments)
      const byCategory = filteredInstruments.filter(
        (i) => i.categorias?.some((c) => role.categories.includes(c)),
      )
      map[role.key] = byCategory.length > 0 ? byCategory : filteredInstruments
    }
    return map
  }, [rolesDef, instrRolesFromPool, filteredInstruments])

  const [bulkOperatorId, setBulkOperatorId] = useState<string>('')
  const [bulkInstrumentId, setBulkInstrumentId] = useState<string>('')
  // Bulk secondary instrument: keyed by roleKey → selected instrumento_id
  const [bulkSecondaryId, setBulkSecondaryId] = useState<Record<string, string>>({})

  const bulkAssignHelpers = useMemo(
    () => ({
      resolveOperator: (id: string) => {
        const op = filteredOperators.find((o) => o.id === id)
        return op ? { id: op.id, email: op.email, full_name: op.full_name } : undefined
      },
      resolveInstrumento: (id: string) => {
        const inst = filteredInstruments.find((i) => i.id === id) ?? instrumentById.get(id)
        return inst
          ? { id: inst.id, codigo: inst.codigo, nombre: inst.nombre, estado: inst.estado }
          : undefined
      },
    }),
    [filteredOperators, filteredInstruments, instrumentById],
  )

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">
        <p className="font-medium">Configurar lecturas</p>
        {showRoleColumns && rolesDef ? (
          <p className="mt-1 text-xs leading-relaxed text-sky-900/90">
            Por cada réplica elija <strong>operador</strong> y{' '}
            <strong>un instrumento por función</strong>:{' '}
            {rolesDef.map((r, i) => (
              <span key={r.key}>
                {i > 0 && ', '}
                <strong>{r.label}</strong>
              </span>
            ))}
            . Capture los valores medidos y guarde.
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-sky-900/90">
            Por cada réplica elija <strong>operador</strong> e{' '}
            <strong>{primaryRole ? primaryRole.label : 'instrumento vigente'}</strong>,
            capture los valores medidos y guarde. Luego calcule el presupuesto de incertidumbre.
          </p>
        )}
        {showRoleColumns && rolesDef && Object.keys(instrRolesFromPool).length === 0 && !isLocked && (
          <p className="mt-1 text-xs text-sky-900/70">
            <Info className="mr-1 inline h-3 w-3" />
            Para que la calibración de cada instrumento use el coeficiente de sensibilidad correcto,
            asigna un <strong>rol</strong> a cada instrumento en{' '}
            <strong>Configuración → Equipo del estudio</strong>.
            Las columnas ya están activas — la asignación mejora el presupuesto GUM.
          </p>
        )}
        {!poolActive && !isLocked && (
          <p className="mt-2 text-xs text-amber-900">
            Confirme el equipo del estudio en <strong>Configuración</strong> para acotar operadores e
            instrumentos (ISO 5725-2 §7).
          </p>
        )}
      </div>

      <EmaUncertaintyAnovaReadinessBanner replicas={replicas} />

      {!isLocked && (
        <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
          <p className="text-xs font-medium text-stone-700">Asignación masiva</p>
          {!poolActive && (
            <p className="text-[11px] text-amber-900">
              En <strong>Configuración → Equipo del estudio</strong> marque operadores e instrumentos
              (multiselección, como patrones en verificación) y confirme.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                Operador → todas las filas
              </label>
              <Select
                value={bulkOperatorId}
                onValueChange={setBulkOperatorId}
                disabled={filteredOperators.length === 0}
              >
                <SelectTrigger className="h-8 bg-white text-xs">
                  <SelectValue placeholder="Elegir operador" />
                </SelectTrigger>
                <SelectContent>
                  {filteredOperators.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.full_name} · {operatorRoleLabel(op.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!bulkOperatorId}
              onClick={() =>
                onBulkAssign({ sameOperatorId: bulkOperatorId }, bulkAssignHelpers)
              }
            >
              Aplicar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={equipoPool.operator_ids.length < 2}
              onClick={() =>
                onBulkAssign({ operatorRoundRobin: true }, bulkAssignHelpers)
              }
            >
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Repartir operadores
            </Button>
          </div>
          {/* Primary instrument bulk assign */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                {primaryRole ? primaryRole.label : 'Instrumento'} → todas las filas
              </label>
              <Select
                value={bulkInstrumentId}
                onValueChange={setBulkInstrumentId}
                disabled={
                  (showRoleColumns
                    ? (instrumentsByRoleKey[primaryRole?.key ?? ''] ?? filteredInstruments)
                    : filteredInstruments
                  ).length === 0
                }
              >
                <SelectTrigger className="h-8 bg-white text-xs">
                  <SelectValue placeholder="Elegir instrumento" />
                </SelectTrigger>
                <SelectContent>
                  {(showRoleColumns && primaryRole
                    ? (instrumentsByRoleKey[primaryRole.key] ?? filteredInstruments)
                    : filteredInstruments
                  ).map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <span className="font-mono text-xs">{inst.codigo}</span> · {inst.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!bulkInstrumentId}
              onClick={() =>
                onBulkAssign({ sameInstrumentoId: bulkInstrumentId }, bulkAssignHelpers)
              }
            >
              Aplicar
            </Button>
          </div>
          {/* Secondary instrument bulk assigns (one per non-primary role) */}
          {showRoleColumns &&
            rolesDef &&
            rolesDef.slice(1).map((role) => {
              const roleInstrs = instrumentsByRoleKey[role.key] ?? []
              const fieldKey = `_instr_${role.key}`
              const currentBulk = bulkSecondaryId[role.key] ?? ''
              return (
                <div key={role.key} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                      {role.label} → todas las filas
                    </label>
                    <Select
                      value={currentBulk}
                      onValueChange={(v) =>
                        setBulkSecondaryId((prev) => ({ ...prev, [role.key]: v }))
                      }
                      disabled={roleInstrs.length === 0}
                    >
                      <SelectTrigger className="h-8 bg-white text-xs">
                        <SelectValue placeholder={`Elegir ${role.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {roleInstrs.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>
                            <span className="font-mono text-xs">{inst.codigo}</span> · {inst.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={!currentBulk}
                    onClick={() =>
                      onBulkAssign(
                        { rawValueField: fieldKey, rawValueData: currentBulk },
                        bulkAssignHelpers,
                      )
                    }
                  >
                    Aplicar
                  </Button>
                </div>
              )
            })}
        </div>
      )}

      <EmaUncertaintyInputMeansCard inputs={measurand.inputs ?? []} replicas={replicas} />

      {n >= 2 && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm">
          <div>
            <span className="text-stone-500">n =</span>{' '}
            <span className="font-semibold text-stone-800">{n}</span>
          </div>
          <div>
            <span className="text-stone-500">x̄ =</span>{' '}
            <span className="font-mono font-semibold text-stone-800">
              {mean?.toFixed(4)} {measurand.unidad}
            </span>
          </div>
          <div>
            <span className="text-stone-500">s =</span>{' '}
            <span className="font-mono font-semibold text-stone-800">{s?.toExponential(4)}</span>
            <button
              type="button"
              title="s = √(Σ(xᵢ−x̄)²/(n−1)) — GUM §4.2.2"
              className="ml-1 text-stone-400 hover:text-stone-600"
            >
              <Info className="inline h-3.5 w-3.5" />
            </button>
          </div>
          {u_A !== null && (
            <div>
              <span className="text-stone-500">u_A = s/√n =</span>{' '}
              <span className="font-mono font-semibold text-stone-800">{u_A.toExponential(4)}</span>
              <EmaNormReferenceChip
                ref_norma="GUM §4.2.3"
                formula_display={`u_A = s/√n = ${s!.toExponential(4)}/√${n} = ${u_A.toExponential(4)}`}
                className="ml-1"
              />
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left min-w-[140px]">Operador</th>
              {/* Per-role instrument columns (VIGAS, FC, FC_CUBO, MU) vs. single column */}
              {showRoleColumns && rolesDef
                ? rolesDef.map((role) => (
                    <th key={role.key} className="px-3 py-2 text-left min-w-[160px]">
                      {role.label}
                    </th>
                  ))
                : (
                    <th className="px-3 py-2 text-left min-w-[160px]">
                      {primaryRole ? primaryRole.label : 'Instrumento'}
                    </th>
                  )}
              {inputs.map((inp) => (
                <th key={inp.simbolo} className="px-3 py-2 text-right">
                  {inp.nombre_display}
                  <span className="block font-normal normal-case text-[10px] text-stone-400">
                    {inp.unidad}
                  </span>
                </th>
              ))}
              {/* Fracture-zone column — VIGAS only (NMX-C-191 §6.5.2.2) */}
              {measurand.codigo === 'VIGAS' && (
                <th className="px-3 py-2 text-left min-w-[130px]">
                  Zona de fractura
                  <span className="block font-normal normal-case text-[10px] text-stone-400">
                    NMX-C-191 §6.5.2.2
                  </span>
                </th>
              )}
              <th className="px-3 py-2 text-right text-stone-700">
                {measurand.nombre}
                <span className="block font-normal normal-case text-[10px] text-stone-400">
                  {measurand.unidad}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {Array.from({ length: study.n_replicas }, (_, i) => i + 1).map((orden) => {
              const replica = replicas.find((r) => r.orden === orden)!
              const liveComputed =
                replica.computed_value ??
                computeReplicaMeasurand(measurand, replica.raw_values_json)

              // Primary instrument (always stored in instrumento_id)
              const primaryInstr = replica.instrumento_id
                ? instrumentById.get(replica.instrumento_id) ?? replica.instrumento
                : null

              // Map each input symbol to the codigo of the instrument that measures it (#9)
              const symbolInstrHint = symbolInstrHintsByOrden.get(orden) ?? {}

              return (
                <tr key={orden} className="hover:bg-stone-50/80">
                  <td className="px-3 py-2 text-stone-500">{orden}</td>
                  {/* Operator select */}
                  <td className="px-2 py-1.5">
                    <Select
                      disabled={isLocked || loadingCatalog}
                      value={replica.operator_id ?? ''}
                      onValueChange={(v) => {
                        const op = v ? filteredOperators.find((o) => o.id === v) : null
                        onReplicaChange(orden, 'operator_id', v || null, {
                          operator: op
                            ? { id: op.id, email: op.email, full_name: op.full_name }
                            : null,
                        })
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Operador" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredOperators.map((op) => (
                          <SelectItem key={op.id} value={op.id}>
                            <span className="block font-medium">{op.full_name}</span>
                            <span className="block text-[10px] text-stone-500">
                              {operatorRoleLabel(op.role)} · {op.email}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Instrument column(s) */}
                  {showRoleColumns && rolesDef
                    ? rolesDef.map((role, roleIdx) => {
                        const isPrimary = roleIdx === 0
                        const fieldKey = isPrimary ? 'instrumento_id' : `_instr_${role.key}`
                        const currentId = isPrimary
                          ? (replica.instrumento_id ?? '')
                          : ((replica.raw_values_json[fieldKey] as string | undefined) ?? '')
                        const currentInstr = isPrimary
                          ? primaryInstr
                          : (currentId ? instrumentById.get(currentId) : null)
                        const roleInstrs = instrumentsByRoleKey[role.key] ?? filteredInstruments

                        return (
                          <td key={role.key} className="px-2 py-1.5">
                            <Select
                              disabled={isLocked || loadingCatalog}
                              value={currentId}
                              onValueChange={(v) => {
                                if (isPrimary) {
                                  const inst = v
                                    ? filteredInstruments.find((i) => i.id === v) ??
                                      instrumentById.get(v)
                                    : null
                                  onReplicaChange(orden, 'instrumento_id', v || null, {
                                    instrumento: inst
                                      ? {
                                          id: inst.id,
                                          codigo: inst.codigo,
                                          nombre: inst.nombre,
                                          estado: inst.estado,
                                        }
                                      : null,
                                  })
                                } else {
                                  onReplicaChange(orden, fieldKey, v || null)
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                {currentInstr ? (
                                  <span className="truncate">
                                    <InstrumentSelectLabel inst={currentInstr} />
                                  </span>
                                ) : (
                                  <SelectValue placeholder={role.label} />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {roleInstrs.map((inst) => (
                                  <SelectItem key={inst.id} value={inst.id}>
                                    <span className="flex flex-wrap items-center gap-1.5">
                                      <InstrumentSelectLabel inst={inst} />
                                      <EmaUncertaintyInstrumentEstadoBadge estado={inst.estado} />
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {currentInstr && isPrimary && (
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <EmaUncertaintyInstrumentEstadoBadge estado={currentInstr.estado} />
                                <Link
                                  href={`/quality/instrumentos/${currentId}`}
                                  className="text-[10px] text-sky-700 hover:underline"
                                >
                                  Ver ficha
                                </Link>
                              </div>
                            )}
                            {currentInstr && !isPrimary && (
                              <div className="mt-0.5">
                                <EmaUncertaintyInstrumentEstadoBadge estado={currentInstr.estado} />
                              </div>
                            )}
                          </td>
                        )
                      })
                    : (
                        // Single instrument column (TEMP, REV, AIRE or no roles configured)
                        <td className="px-2 py-1.5">
                          <Select
                            disabled={isLocked || loadingCatalog}
                            value={replica.instrumento_id ?? ''}
                            onValueChange={(v) => {
                              const inst = v
                                ? filteredInstruments.find((i) => i.id === v) ??
                                  instrumentById.get(v)
                                : null
                              onReplicaChange(orden, 'instrumento_id', v || null, {
                                instrumento: inst
                                  ? {
                                      id: inst.id,
                                      codigo: inst.codigo,
                                      nombre: inst.nombre,
                                      estado: inst.estado,
                                    }
                                  : null,
                              })
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              {primaryInstr ? (
                                <span className="truncate">
                                  <InstrumentSelectLabel inst={primaryInstr} />
                                </span>
                              ) : (
                                <SelectValue placeholder="Instrumento" />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {filteredInstruments.map((inst) => (
                                <SelectItem key={inst.id} value={inst.id}>
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    <InstrumentSelectLabel inst={inst} />
                                    <EmaUncertaintyInstrumentEstadoBadge estado={inst.estado} />
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {primaryInstr && (
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <EmaUncertaintyInstrumentEstadoBadge estado={primaryInstr.estado} />
                              <Link
                                href={`/quality/instrumentos/${replica.instrumento_id}`}
                                className="text-[10px] text-sky-700 hover:underline"
                              >
                                Ver ficha
                              </Link>
                            </div>
                          )}
                        </td>
                      )}
                  {/* Numeric input fields */}
                  {inputs.map((inp) => {
                    const instrCodigo = showRoleColumns ? (symbolInstrHint[inp.simbolo] ?? null) : null
                    return (
                      <td key={inp.simbolo} className="px-3 py-1.5">
                        <input
                          type="number"
                          step="any"
                          disabled={isLocked}
                          value={
                            typeof replica.raw_values_json[inp.simbolo] === 'number'
                              ? (replica.raw_values_json[inp.simbolo] as number)
                              : ''
                          }
                          onChange={(e) =>
                            onReplicaChange(
                              orden,
                              inp.simbolo,
                              e.target.value === '' ? null : Number(e.target.value),
                            )
                          }
                          className="w-20 rounded border border-stone-200 px-2 py-0.5 text-right text-xs font-mono focus:border-stone-400 focus:outline-none disabled:bg-stone-50"
                        />
                        {instrCodigo && (
                          <div className="mt-0.5 text-[10px] text-stone-400">
                            medido con: <span className="font-mono">{instrCodigo}</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                  {/* Fracture-zone select — VIGAS only */}
                  {measurand.codigo === 'VIGAS' && (() => {
                    const fz = (replica.raw_values_json['_fracture_zone'] as string | undefined) ?? ''
                    return (
                      <td className="px-2 py-1.5">
                        <Select
                          disabled={isLocked}
                          value={fz}
                          onValueChange={(v) => onReplicaChange(orden, '_fracture_zone', v || null)}
                        >
                          <SelectTrigger className={cn(
                            'h-8 text-xs',
                            fz === 'fuera_mas_5' && 'border-red-300 bg-red-50 text-red-800',
                            fz === 'fuera_5' && 'border-amber-300 bg-amber-50 text-amber-800',
                          )}>
                            <SelectValue placeholder="Seleccionar…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tercio_medio" className="text-xs">Tercio central ✓</SelectItem>
                            <SelectItem value="fuera_5" className="text-xs text-amber-700">Fuera ≤ 5% ⚠</SelectItem>
                            <SelectItem value="fuera_mas_5" className="text-xs text-red-700">Fuera &gt; 5% ✗</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )
                  })()}
                  <td
                    className="px-3 py-1.5 text-right font-mono text-sm text-stone-700"
                    title={measurand.formula_expr ?? undefined}
                  >
                    {liveComputed !== null ? liveComputed.toFixed(4) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-400">
        Modelo: <span className="font-mono">{measurand.formula_expr ?? measurand.nombre}</span>
        {measurand.formula_descr && ` — ${measurand.formula_descr}`}
      </p>

      {!isLocked && (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onSave}
            disabled={!pendingSave || saving}
          >
            {saving ? 'Guardando…' : pendingSave ? 'Guardar lecturas *' : 'Guardar lecturas'}
          </Button>
          <Button
            type="button"
            onClick={onPreview}
            disabled={previewLoading}
            className="bg-stone-900 hover:bg-stone-800"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', previewLoading && 'animate-spin')} />
            Calcular presupuesto
          </Button>
        </div>
      )}
    </div>
  )
}

