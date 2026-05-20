import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { finanzasHubCanvasClass } from '@/components/finanzas/finanzasHubUi'

type FinanzasHubShellProps = {
  children: ReactNode
  /** `default` = max-w-6xl; `wide` = dense tables (procurement / producción) */
  width?: 'default' | 'wide' | 'full'
  /** Bleed into app chrome like quality/production layouts */
  inset?: boolean
  className?: string
}

const widthClass = {
  default: 'max-w-6xl',
  wide: 'max-w-[min(1600px,100%)]',
  full: 'max-w-none',
} as const

export default function FinanzasHubShell({
  children,
  width = 'default',
  inset = true,
  className,
}: FinanzasHubShellProps) {
  return (
    <div
      className={cn(
        finanzasHubCanvasClass,
        inset && '-m-4 md:-m-6 min-h-[calc(100vh-2rem)] w-full min-w-0',
        className
      )}
    >
      <div
        className={cn(
          'container mx-auto min-w-0 w-full p-4 md:p-6',
          widthClass[width]
        )}
      >
        {children}
      </div>
    </div>
  )
}
