'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EmaNormReferenceChip } from '@/components/ema/uncertainty/EmaNormReferenceChip'
import { EmaUncertaintyMeasurandPanel } from '@/components/ema/uncertainty/EmaUncertaintyMeasurandPanel'
import { EmaUncertaintyReplicaSetupTable } from '@/components/ema/uncertainty/EmaUncertaintyReplicaSetupTable'
import { EmaUncertaintyStudyEquipoPanel } from '@/components/ema/uncertainty/EmaUncertaintyStudyEquipoPanel'
import type {
  UncertaintyEquipoPool,
  UncertaintyMeasurandInput,
  UncertaintyStudy,
  UncertaintyStudyReplica,
} from '@/types/ema-uncertainty'

const KIND_LABEL: Record<string, string> = {
  environmental: 'Ambiental',
  method: 'Método',
  systematic: 'Sistemático',
}

const KIND_CLASS: Record<string, string> = {
  environmental: 'bg-emerald-100 text-emerald-700',
  method: 'bg-amber-100 text-amber-700',
  systematic: 'bg-orange-100 text-orange-700',
}

function AutoContributorRow({ inp }: { inp: UncertaintyMeasurandInput }) {
  return (
    <tr className="hover:bg-stone-50">
      <td className="px-3 py-1.5 font-mono text-xs text-stone-700">{inp.simbolo}</td>
      <td className="px-3 py-1.5 text-sm text-stone-700">{inp.nombre_display}</td>
      <td className="px-3 py-1.5 text-center">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_CLASS[inp.kind] ?? 'bg-stone-100 text-stone-600'}`}>
          {KIND_LABEL[inp.kind] ?? inp.kind}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right font-mono text-xs text-stone-600">
        {inp.default_semiamplitud != null
          ? `±${inp.default_semiamplitud} ${inp.unidad}`
          : <span className="text-stone-400">del certif.</span>}
      </td>
      <td className="px-3 py-1.5 text-center">
        <EmaNormReferenceChip ref_norma={inp.norma_ref ?? 'GUM §4.3.6'} formula_display={inp.descripcion ?? undefined} />
      </td>
    </tr>
  )
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-stone-900">{value}</dd>
    </div>
  )
}

export function EmaUncertaintyStudyConfig({
  study,
  replicas,
  isLocked,
  onNotesSaved,
  onGoToLecturas,
  onEquipoPoolSaved,
}: {
  study: UncertaintyStudy
  replicas: UncertaintyStudyReplica[]
  isLocked: boolean
  onNotesSaved: (notas: string) => void
  onGoToLecturas?: () => void
  onEquipoPoolSaved: (pool: UncertaintyEquipoPool) => void
}) {
  const measurand = study.measurand!
  const gumRefs = measurand.gum_references_json ?? []
  const autoContributors = (measurand.inputs ?? []).filter(
    (i) => i.kind === 'environmental' || i.kind === 'method' || i.kind === 'systematic',
  )
  const [notas, setNotas] = useState(study.notas ?? '')
  const [saving, setSaving] = useState(false)

  async function saveNotes() {
    setSaving(true)
    try {
      const res = await fetch(`/api/ema/uncertainty/studies/${study.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas: notas || null }),
      })
      if (!res.ok) throw new Error('Error guardando notas')
      onNotesSaved(notas)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-stone-200 bg-stone-50/40 px-4 py-3 sm:grid-cols-3">
        <MetaItem label="Fecha" value={study.fecha_estudio} />
        <MetaItem label="Estado" value={<span className="capitalize">{study.estado}</span>} />
        <MetaItem label="Réplicas" value={`n = ${study.n_replicas}`} />
        <MetaItem label="Unidad" value={measurand.unidad} />
      </dl>

      <EmaUncertaintyMeasurandPanel measurand={measurand} />

      <EmaUncertaintyStudyEquipoPanel
        study={study}
        measurand={measurand}
        isLocked={isLocked}
        onPoolSaved={onEquipoPoolSaved}
      />

      {gumRefs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-stone-800">Referencias GUM</h3>
          <div className="mt-2 overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-medium uppercase tracking-wide text-stone-500">
                  <th className="w-16 px-3 py-2">Paso</th>
                  <th className="px-3 py-2">Fórmula</th>
                  <th className="w-28 px-3 py-2">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {gumRefs.map((g) => (
                  <tr key={g.step}>
                    <td className="px-3 py-2 font-mono text-xs font-medium text-stone-700">{g.step}</td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-800">
                      {g.formula_display ?? g.formula}
                    </td>
                    <td className="px-3 py-2">
                      <EmaNormReferenceChip
                        ref_norma={g.ref}
                        formula_display={g.formula_display ?? g.formula}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {autoContributors.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-stone-800">
            Contribuyentes automáticos (Tipo B)
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Incluidos automáticamente en el presupuesto por la norma. Las semi-amplitudes por defecto
            provienen del catálogo; el laboratorio puede justificar un valor alternativo en el campo
            de notas.
          </p>
          <div className="mt-2 overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-medium uppercase tracking-wide text-stone-500">
                  <th className="w-20 px-3 py-2">Símbolo</th>
                  <th className="px-3 py-2">Fuente</th>
                  <th className="w-28 px-3 py-2 text-center">Categoría</th>
                  <th className="w-32 px-3 py-2 text-right">Semi-amplitud</th>
                  <th className="w-24 px-3 py-2 text-center">Norma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {autoContributors.map((inp) => (
                  <AutoContributorRow key={inp.id} inp={inp} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <EmaUncertaintyReplicaSetupTable
        study={study}
        measurand={measurand}
        replicas={replicas}
        isLocked={isLocked}
        onGoToLecturas={onGoToLecturas}
      />

      <section className="rounded-lg border border-stone-200 p-4">
        <Label htmlFor="study-notas">Notas del estudio</Label>
        <Textarea
          id="study-notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          disabled={isLocked}
          rows={3}
          className="mt-1"
          placeholder="Condiciones ambientales, lote de referencia, observaciones del ensayo…"
        />
        {!isLocked && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={saving}
            onClick={saveNotes}
          >
            {saving ? 'Guardando…' : 'Guardar notas'}
          </Button>
        )}
      </section>
    </div>
  )
}
