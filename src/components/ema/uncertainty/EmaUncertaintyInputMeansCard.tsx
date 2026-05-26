'use client'

import React, { useMemo } from 'react'
import type { UncertaintyMeasurandInput, UncertaintyStudyReplica } from '@/types/ema-uncertainty'

/**
 * Shows the per-input arithmetic mean across replicas with a computed_value.
 * Only rendered when the measurand has ≥ 2 measured inputs (e.g. FC, FC_CUBO, VIGAS).
 * Placed above the n/x̄/s/u_A summary row in EmaUncertaintyReplicaTable.
 */
export function EmaUncertaintyInputMeansCard({
  inputs,
  replicas,
}: {
  inputs: UncertaintyMeasurandInput[]
  replicas: UncertaintyStudyReplica[]
}) {
  const measuredInputs = useMemo(
    () => inputs.filter((i) => i.kind === 'measured'),
    [inputs],
  )

  const validReplicas = useMemo(
    () => replicas.filter((r) => r.computed_value !== null),
    [replicas],
  )

  const means = useMemo(() => {
    return measuredInputs.map((inp) => {
      const vals = validReplicas
        .map((r) => r.raw_values_json[inp.simbolo])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v))
      const mean = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
      return { inp, mean, n: vals.length }
    })
  }, [measuredInputs, validReplicas])

  if (measuredInputs.length < 2 || validReplicas.length === 0) return null

  return (
    <div className="flex flex-wrap gap-4 rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-400 self-center">
        Medias de entradas
      </span>
      {means.map(({ inp, mean }) => (
        <div key={inp.simbolo}>
          <span className="text-stone-500">
            x̄<sub className="text-[9px]">{inp.simbolo}</sub> ={' '}
          </span>
          <span className="font-mono font-semibold text-stone-800">
            {mean !== null ? mean.toFixed(4) : '—'}
          </span>
          {inp.unidad && (
            <span className="ml-1 text-xs text-stone-400">{inp.unidad}</span>
          )}
        </div>
      ))}
    </div>
  )
}
