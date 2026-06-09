'use client'

import React from 'react'
import {
  BarChart3,
  ScanLine,
  GitCompare,
  MessageSquareWarning,
  Stamp,
  Download,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClosureStatus } from '@/types/inventoryClosure'

export type ClosureStep =
  | 'theoretical'
  | 'physical_count'
  | 'reconciliation'
  | 'justification'
  | 'seal'
  | 'export'

const STEPS: { id: ClosureStep; label: string; Icon: React.ElementType }[] = [
  { id: 'theoretical',    label: 'Revisión teórica', Icon: BarChart3 },
  { id: 'physical_count', label: 'Conteo físico',    Icon: ScanLine },
  { id: 'reconciliation', label: 'Reconciliación',   Icon: GitCompare },
  { id: 'justification',  label: 'Justificación',    Icon: MessageSquareWarning },
  { id: 'seal',           label: 'Sellado',           Icon: Stamp },
  { id: 'export',         label: 'Exportar',          Icon: Download },
]

const ORDER: ClosureStep[] = STEPS.map((s) => s.id)

const STEP_LABEL_BY_ID = Object.fromEntries(STEPS.map((s) => [s.id, s.label])) as Record<
  ClosureStep,
  string
>

export function getClosureStepLabel(step: ClosureStep): string {
  return STEP_LABEL_BY_ID[step] ?? step
}

/** Map DB status → active step on load */
export function statusToStep(status: ClosureStatus): ClosureStep {
  switch (status) {
    case 'draft':          return 'theoretical'
    case 'physical_count': return 'physical_count'
    case 'reconciled':     return 'reconciliation'
    case 'justified':      return 'seal'
    case 'sealed':         return 'theoretical'
    default:               return 'theoretical'
  }
}

/** Furthest step unlocked by closure progress (for stepper navigation) */
export function statusToReachableStep(status: ClosureStatus): ClosureStep {
  switch (status) {
    case 'draft':          return 'theoretical'
    case 'physical_count': return 'physical_count'
    case 'reconciled':     return 'justification'
    case 'justified':      return 'seal'
    case 'sealed':         return 'export'
    default:               return 'theoretical'
  }
}

interface Props {
  currentStep: ClosureStep
  reachableStep?: ClosureStep
  onStepClick?: (step: ClosureStep) => void
  sealed?: boolean
  compact?: boolean
  className?: string
}

export default function ClosureStepper({
  currentStep,
  reachableStep = currentStep,
  onStepClick,
  sealed,
  compact,
  className,
}: Props) {
  const currentIdx = ORDER.indexOf(currentStep)
  const reachableIdx = ORDER.indexOf(reachableStep)
  const navigable = !!onStepClick

  return (
    <nav
      aria-label="Pasos del cierre de inventario"
      className={cn('flex flex-wrap items-center gap-1 sm:gap-2', compact ? 'text-xs' : 'text-sm', className)}
    >
      {STEPS.map((step, idx) => {
        const done = sealed ? step.id !== currentStep : idx < currentIdx
        const active = step.id === currentStep
        const clickable = navigable && (sealed || idx <= reachableIdx)
        const Icon = step.Icon

        const chipClass = cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1 border transition-colors',
          active && 'bg-[#1B2A4A] border-[#1B2A4A] text-white font-medium',
          done && !active && 'bg-emerald-50 border-emerald-200 text-emerald-800',
          !active && !done && 'bg-white border-stone-200 text-stone-500',
          clickable && !active && 'hover:border-stone-400 hover:bg-stone-50 cursor-pointer',
        )

        const content = (
          <>
            {done && !active ? (
              <Check className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            ) : (
              <Icon className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            )}
            <span>{step.label}</span>
          </>
        )

        return (
          <React.Fragment key={step.id}>
            {idx > 0 && <span className="text-stone-300 hidden sm:inline">→</span>}
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                className={chipClass}
                aria-current={active ? 'step' : undefined}
              >
                {content}
              </button>
            ) : (
              <div className={chipClass} aria-current={active ? 'step' : undefined}>
                {content}
              </div>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
