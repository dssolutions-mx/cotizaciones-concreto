'use client'

import Link from 'next/link'
import { ArrowLeft, FlaskConical } from 'lucide-react'

const STEP_LABELS = ['Configuración', 'Lecturas', 'Presupuesto', 'Publicar'] as const

export type UncertaintyWorkflowStep = 'configuracion' | 'lecturas' | 'presupuesto' | 'publicar'

const STEP_INDEX: Record<UncertaintyWorkflowStep, number> = {
  configuracion: 0,
  lecturas: 1,
  presupuesto: 2,
  publicar: 3,
}

export function EmaUncertaintyWorkflowHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  activeStep,
}: {
  backHref: string
  backLabel: string
  title: string
  subtitle?: string
  activeStep: UncertaintyWorkflowStep
  lockedSteps?: UncertaintyWorkflowStep[]
}) {
  const current = STEP_INDEX[activeStep]
  const total = STEP_LABELS.length
  const progress = Math.round(((current + 1) / total) * 100)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          aria-label={backLabel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
            <FlaskConical className="h-4 w-4 shrink-0 text-sky-600" />
            <span className="truncate">{title}</span>
          </h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-stone-500">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>
            Paso {current + 1} de {total} — {STEP_LABELS[current]}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-sky-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
