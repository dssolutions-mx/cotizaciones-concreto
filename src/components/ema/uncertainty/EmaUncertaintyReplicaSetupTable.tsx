'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { computeReplicaMeasurand } from '@/lib/ema/uncertaintyMeasurand'
import { assessAnovaReadiness, listUniqueOperatorIds } from '@/lib/ema/uncertaintyStudyDesign'
import { EmaUncertaintyAnovaReadinessBanner } from '@/components/ema/uncertainty/EmaUncertaintyAnovaReadinessBanner'
import type { UncertaintyMeasurand, UncertaintyStudy, UncertaintyStudyReplica } from '@/types/ema-uncertainty'
import { cn } from '@/lib/utils'

function replicaRow(
  orden: number,
  replicas: UncertaintyStudyReplica[],
): UncertaintyStudyReplica | undefined {
  return replicas.find((r) => r.orden === orden)
}

function readingsProgress(
  measurand: UncertaintyMeasurand,
  replica: UncertaintyStudyReplica | undefined,
): { filled: number; total: number; complete: boolean } {
  const measured = (measurand.inputs ?? []).filter((i) => i.kind === 'measured')
  if (!replica || measured.length === 0) {
    return { filled: 0, total: measured.length, complete: measured.length === 0 }
  }
  const filled = measured.filter((inp) => {
    const v = replica.raw_values_json[inp.simbolo]
    return v !== null && v !== undefined && !Number.isNaN(Number(v))
  }).length
  return { filled, total: measured.length, complete: filled === measured.length && filled > 0 }
}

function StatusPill({
  ok,
  label,
  warn = false,
}: {
  ok: boolean
  label: string
  warn?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        ok && 'bg-emerald-50 text-emerald-800',
        !ok && !warn && 'bg-stone-100 text-stone-600',
        !ok && warn && 'bg-amber-50 text-amber-900',
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      {label}
    </span>
  )
}

export function EmaUncertaintyReplicaSetupTable({
  study,
  measurand,
  replicas,
  isLocked,
  onGoToLecturas,
}: {
  study: UncertaintyStudy
  measurand: UncertaintyMeasurand
  replicas: UncertaintyStudyReplica[]
  isLocked: boolean
  onGoToLecturas?: () => void
}) {
  const rows = Array.from({ length: study.n_replicas }, (_, i) => i + 1)

  const distinctOperators = listUniqueOperatorIds(replicas).length
  const assignedInstruments = rows.filter((orden) => replicaRow(orden, replicas)?.instrumento_id).length
  const completeReadings = rows.filter((orden) =>
    readingsProgress(measurand, replicaRow(orden, replicas)).complete,
  ).length
  const anova = assessAnovaReadiness(replicas)

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200">
      <header className="border-b border-stone-200 bg-stone-50/70 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Equipo por réplica</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-stone-600">
              Operadores e instrumentos se asignan en la pestaña{' '}
              <strong className="font-medium text-stone-800">Lecturas</strong>, una fila por réplica.
              Cada fila debe tener operador, instrumento vigente y valores medidos antes de calcular el
              presupuesto.
            </p>
          </div>
          {!isLocked && onGoToLecturas && (
            <Button type="button" size="sm" className="shrink-0" onClick={onGoToLecturas}>
              Ir a Lecturas
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <dl className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">
          <div>
            <dt className="text-stone-500">Operadores distintos</dt>
            <dd className="font-medium text-stone-800">
              {distinctOperators}
              <span className="font-normal text-stone-500"> (mín. 2 para s<sub>L</sub>)</span>
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Instrumentos</dt>
            <dd className="font-medium text-stone-800">
              {assignedInstruments} / {study.n_replicas}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Lecturas completas</dt>
            <dd className="font-medium text-stone-800">
              {completeReadings} / {study.n_replicas}
            </dd>
          </div>
        </dl>
      </header>

      {!isLocked && anova.needsMoreOperators && (
        <div className="border-b border-stone-100 px-4 py-2">
          <EmaUncertaintyAnovaReadinessBanner replicas={replicas} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-white text-[11px] font-medium uppercase tracking-wide text-stone-500">
              <th className="w-12 px-4 py-2.5 text-left">#</th>
              <th className="min-w-[140px] px-3 py-2.5 text-left">Operador</th>
              <th className="min-w-[160px] px-3 py-2.5 text-left">Instrumento</th>
              <th className="min-w-[100px] px-3 py-2.5 text-left">Lecturas</th>
              <th className="min-w-[88px] px-4 py-2.5 text-right">{measurand.unidad}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((orden) => {
              const replica = replicaRow(orden, replicas)
              const opName =
                replica?.operator?.full_name ??
                replica?.operator?.email ??
                (replica?.operator_id ? 'Operador asignado' : null)
              const inst = replica?.instrumento
              const progress = readingsProgress(measurand, replica)
              const computed =
                replica?.computed_value ??
                (replica ? computeReplicaMeasurand(measurand, replica.raw_values_json) : null)

              return (
                <tr key={orden} className="text-stone-800">
                  <td className="px-4 py-2.5 font-medium text-stone-500">{orden}</td>
                  <td className="px-3 py-2.5">
                    {opName ? (
                      <span className="text-sm">{opName}</span>
                    ) : (
                      <StatusPill ok={false} label="Sin operador" warn />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {inst ? (
                      <Link
                        href={`/quality/instrumentos/${inst.id}`}
                        className="inline-flex items-center gap-1 text-sm text-sky-800 hover:underline"
                      >
                        <span className="font-mono text-xs">{inst.codigo}</span>
                        <span className="truncate max-w-[120px]">{inst.nombre}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </Link>
                    ) : (
                      <StatusPill ok={false} label="Sin instrumento" warn />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {progress.total === 0 ? (
                      <span className="text-xs text-stone-400">—</span>
                    ) : (
                      <StatusPill
                        ok={progress.complete}
                        label={`${progress.filled}/${progress.total}`}
                        warn={!progress.complete && progress.filled > 0}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-stone-700">
                    {computed !== null ? computed.toFixed(4) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-stone-100 bg-stone-50/50 px-4 py-2.5 text-[11px] text-stone-500">
        u de calibración de cada instrumento entra al presupuesto Type B (NMX-EC-17025 §6.5).
      </footer>
    </section>
  )
}
