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
  const inputs = (measurand.inputs ?? [])
    .filter((i) => i.kind === 'measured')
    .sort((a, b) => a.orden - b.orden)

  // Role context for multi-input measurands — helps label the instrument column
  const rolesDef = MEASURAND_INSTRUMENT_ROLES[measurand.codigo as MeasurandCodigo] ?? null
  // Primary role = first role in the list (load-measuring instrument like Prensa)
  // This is the instrument the technician assigns per replica.
  const primaryRole = rolesDef?.[0] ?? null
  // Secondary role = other roles (dimensional instrument, assigned once at pool level)
  const secondaryRoles = rolesDef?.slice(1) ?? []

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

  const [bulkOperatorId, setBulkOperatorId] = useState<string>('')
  const [bulkInstrumentId, setBulkInstrumentId] = useState<string>('')

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
        <p className="mt-1 text-xs leading-relaxed text-sky-900/90">
          Por cada réplica elija <strong>operador</strong> e{' '}
          <strong>{primaryRole ? primaryRole.label : 'instrumento vigente'}</strong>,
          capture los valores medidos y guarde. Luego calcule el presupuesto de incertidumbre.
        </p>
        {secondaryRoles.length > 0 && (
          <p className="mt-1 text-xs text-sky-800/80">
            <Info className="mr-1 inline h-3 w-3" />
            {secondaryRoles.map((r) => r.label).join(' y ')} se asigna en{' '}
            <strong>Configuración → Equipo del estudio</strong> (rol de instrumento) y su calibración
            entra automáticamente al presupuesto sin necesidad de asignarlo por réplica.
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                Instrumento → todas las filas
              </label>
              <Select
                value={bulkInstrumentId}
                onValueChange={setBulkInstrumentId}
                disabled={filteredInstruments.length === 0}
              >
                <SelectTrigger className="h-8 bg-white text-xs">
                  <SelectValue placeholder="Elegir instrumento" />
                </SelectTrigger>
                <SelectContent>
                  {filteredInstruments.map((inst) => (
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
        </div>
      )}

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
              <th className="px-3 py-2 text-left min-w-[160px]">
                {primaryRole ? primaryRole.label : 'Instrumento'}
              </th>
              {inputs.map((inp) => (
                <th key={inp.simbolo} className="px-3 py-2 text-right">
                  {inp.nombre_display}
                  <span className="block font-normal normal-case text-[10px] text-stone-400">
                    {inp.unidad}
                  </span>
                </th>
              ))}
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
              const instr = replica.instrumento_id
                ? instrumentById.get(replica.instrumento_id) ?? replica.instrumento
                : null

              return (
                <tr key={orden} className="hover:bg-stone-50/80">
                  <td className="px-3 py-2 text-stone-500">{orden}</td>
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
                  <td className="px-2 py-1.5">
                    <Select
                      disabled={isLocked || loadingCatalog}
                      value={replica.instrumento_id ?? ''}
                      onValueChange={(v) => {
                        const inst = v
                          ? filteredInstruments.find((i) => i.id === v) ?? instrumentById.get(v)
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
                        {instr ? (
                          <span className="truncate">
                            <InstrumentSelectLabel inst={instr} />
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
                    {instr && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <EmaUncertaintyInstrumentEstadoBadge estado={instr.estado} />
                        <Link
                          href={`/quality/instrumentos/${replica.instrumento_id}`}
                          className="text-[10px] text-sky-700 hover:underline"
                        >
                          Ver ficha
                        </Link>
                      </div>
                    )}
                  </td>
                  {inputs.map((inp) => (
                    <td key={inp.simbolo} className="px-3 py-1.5">
                      <input
                        type="number"
                        step="any"
                        disabled={isLocked}
                        value={replica.raw_values_json[inp.simbolo] ?? ''}
                        onChange={(e) =>
                          onReplicaChange(
                            orden,
                            inp.simbolo,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
                        className="w-20 rounded border border-stone-200 px-2 py-0.5 text-right text-xs font-mono focus:border-stone-400 focus:outline-none disabled:bg-stone-50"
                      />
                    </td>
                  ))}
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

