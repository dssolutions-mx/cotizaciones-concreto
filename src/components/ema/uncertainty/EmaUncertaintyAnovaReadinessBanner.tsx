'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { assessAnovaReadiness } from '@/lib/ema/uncertaintyStudyDesign'
import type { UncertaintyStudyReplica } from '@/types/ema-uncertainty'
import { cn } from '@/lib/utils'

export function EmaUncertaintyAnovaReadinessBanner({
  replicas,
  className,
}: {
  replicas: UncertaintyStudyReplica[]
  className?: string
}) {
  const readiness = assessAnovaReadiness(replicas)

  if (!readiness.needsMoreOperators && readiness.canUseAnova) {
    return (
      <div
        className={cn(
          'rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950',
          className,
        )}
      >
        <p className="flex items-start gap-2 font-medium">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {readiness.summary}
        </p>
        <p className="mt-1 pl-6 text-xs text-emerald-900/90">
          El presupuesto separará repetibilidad (s<sub>r</sub>) y reproducibilidad inter-operador (s<sub>L</sub>)
          según ISO 5725-2 §7 y GUM §4.2.4.
        </p>
      </div>
    )
  }

  if (!readiness.needsMoreOperators) return null

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950',
        className,
      )}
    >
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Diseño para reproducibilidad inter-operador
      </p>
      <p className="mt-1 pl-6 text-xs leading-relaxed text-amber-900/95">{readiness.summary}</p>
      <p className="mt-2 pl-6 text-[11px] text-amber-800/90">
        Sin ≥2 operadores con ≥2 réplicas cada uno, el presupuesto usará repetibilidad agrupada (GUM §4.2.3) y no
        estimará s<sub>L</sub>.
      </p>
    </div>
  )
}
