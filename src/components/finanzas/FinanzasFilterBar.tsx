'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  finanzasHubFilterLabelClass,
  finanzasHubFilterRowClass,
  finanzasHubPanelClass,
} from '@/components/finanzas/finanzasHubUi'

type FinanzasFilterBarProps = {
  children: ReactNode
  /** Sticks below workspace header on scroll */
  sticky?: boolean
  className?: string
}

export default function FinanzasFilterBar({
  children,
  sticky = false,
  className,
}: FinanzasFilterBarProps) {
  return (
    <div
      className={cn(
        finanzasHubPanelClass,
        'px-3 py-3 sm:px-4 sm:py-3',
        sticky && 'sticky top-[var(--finanzas-sticky-offset,3.5rem)] z-10 shadow-sm',
        className
      )}
    >
      <div className={finanzasHubFilterRowClass}>{children}</div>
    </div>
  )
}

type FinanzasFilterFieldProps = {
  label: string
  children: ReactNode
  className?: string
}

/** Single filter group — label + control, min width for mobile stacking */
export function FinanzasFilterField({ label, children, className }: FinanzasFilterFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-[8.5rem] flex-1 sm:flex-initial sm:min-w-0', className)}>
      <span className={finanzasHubFilterLabelClass}>{label}</span>
      {children}
    </div>
  )
}
