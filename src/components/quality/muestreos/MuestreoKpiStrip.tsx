'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { computeMuestreoKpis } from '@/components/quality/muestreos/muestreosListHelpers'
import type { MuestreoWithRelations } from '@/types/quality'

const summaryStatusMap = {
  ok: {
    card: 'bg-emerald-50 border-emerald-200',
    value: 'text-emerald-800',
    label: 'text-emerald-600',
  },
  warning: {
    card: 'bg-amber-50 border-amber-200',
    value: 'text-amber-800',
    label: 'text-amber-600',
  },
  critical: {
    card: 'bg-red-50 border-red-200',
    value: 'text-red-800',
    label: 'text-red-600',
  },
  neutral: {
    card: 'bg-white border-stone-200',
    value: 'text-stone-900',
    label: 'text-stone-500',
  },
} as const

type Props = {
  muestreos: MuestreoWithRelations[]
  loading?: boolean
}

export default function MuestreoKpiStrip({ muestreos, loading }: Props) {
  const kpis = computeMuestreoKpis(muestreos)

  const items: {
    label: string
    value: string
    status: keyof typeof summaryStatusMap
    hint?: string
  }[] = [
    {
      label: 'Total (vista)',
      value: String(kpis.total),
      status: 'neutral',
    },
    {
      label: 'Pendientes de ensayo',
      value: String(kpis.pendientesEnsayo),
      status: kpis.pendientesEnsayo > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Tasa cumplimiento',
      value: kpis.tasaCumplimiento != null ? `${kpis.tasaCumplimiento}%` : '—',
      status:
        kpis.tasaCumplimiento == null
          ? 'neutral'
          : kpis.tasaCumplimiento >= 85
            ? 'ok'
            : kpis.tasaCumplimiento >= 70
              ? 'warning'
              : 'critical',
      hint: 'Muestreos con R ≥ f′c',
    },
    {
      label: 'Resistencia prom.',
      value: kpis.resistenciaPromedio != null ? `${kpis.resistenciaPromedio}` : '—',
      status: 'neutral',
      hint: kpis.resistenciaPromedio != null ? 'kg/cm²' : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => {
        const styles = summaryStatusMap[item.status]
        return (
          <div key={item.label} className={cn('rounded-lg border px-4 py-3', styles.card)}>
            <div className={cn('text-xs uppercase tracking-wide', styles.label)}>{item.label}</div>
            {loading ? (
              <div className="h-7 w-16 bg-stone-100 rounded animate-pulse mt-1" />
            ) : (
              <>
                <div
                  className={cn(
                    'text-2xl font-semibold mt-0.5 font-mono tabular-nums',
                    styles.value
                  )}
                >
                  {item.value}
                </div>
                {item.hint && (
                  <div className="text-[11px] text-stone-400 mt-0.5 truncate">{item.hint}</div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
