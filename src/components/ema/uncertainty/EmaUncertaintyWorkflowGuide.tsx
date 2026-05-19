'use client'

import { cn } from '@/lib/utils'

export type UncertaintyGuideStepId =
  | 'crear'
  | 'configuracion'
  | 'lecturas'
  | 'presupuesto'
  | 'publicar'

const STEPS: { id: UncertaintyGuideStepId; label: string; hint: string }[] = [
  { id: 'crear', label: 'Crear', hint: 'Fecha y planta' },
  { id: 'configuracion', label: 'Modelo', hint: 'Mensurando y variables' },
  { id: 'lecturas', label: 'Lecturas', hint: 'Operador, instrumento, valores' },
  { id: 'presupuesto', label: 'Presupuesto', hint: 'u combinada y U' },
  { id: 'publicar', label: 'Publicar', hint: 'Declarar U vigente' },
]

export function EmaUncertaintyWorkflowGuide({
  activeStep,
  completedThrough,
}: {
  activeStep: UncertaintyGuideStepId
  /** Steps at or before this index are marked done (inclusive). */
  completedThrough?: UncertaintyGuideStepId
}) {
  const activeIdx = STEPS.findIndex((s) => s.id === activeStep)
  const doneIdx =
    completedThrough != null
      ? STEPS.findIndex((s) => s.id === completedThrough)
      : activeIdx - 1

  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {STEPS.map((step, i) => {
        const isActive = step.id === activeStep
        const isDone = i <= doneIdx
        return (
          <li
            key={step.id}
            className={cn(
              'rounded-lg border px-3 py-2.5',
              isActive && 'border-sky-200 bg-sky-50/80',
              isDone && !isActive && 'border-stone-200 bg-stone-50/50',
              !isActive && !isDone && 'border-stone-100 bg-white',
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  isActive && 'bg-sky-600 text-white',
                  isDone && !isActive && 'bg-stone-400 text-white',
                  !isActive && !isDone && 'bg-stone-200 text-stone-600',
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'text-xs font-semibold',
                  isActive && 'text-sky-900',
                  isDone && !isActive && 'text-stone-700',
                  !isActive && !isDone && 'text-stone-500',
                )}
              >
                {step.label}
              </span>
            </div>
            <p className="mt-1 pl-7 text-[10px] leading-snug text-stone-500">{step.hint}</p>
          </li>
        )
      })}
    </ol>
  )
}
