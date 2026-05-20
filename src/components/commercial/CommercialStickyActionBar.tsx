'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { commercialHubPrimaryButtonClass, commercialHubOutlineNeutralClass } from '@/components/commercial/commercialHubUi'

export default function CommercialStickyActionBar({
  children,
  summary,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  className,
}: {
  children?: ReactNode
  summary?: ReactNode
  primaryLabel: string
  onPrimary: () => void
  primaryDisabled?: boolean
  primaryLoading?: boolean
  secondaryLabel?: string
  onSecondary?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3',
        'bg-[#f5f3f0]/95 backdrop-blur-sm border-t border-stone-200/80',
        className
      )}
    >
      {children}
      <div className="max-w-6xl mx-auto w-full space-y-3">
        {summary ? <div className="text-sm text-stone-600">{summary}</div> : null}
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          {secondaryLabel && onSecondary ? (
            <Button
              type="button"
              variant="outline"
              className={cn('min-h-11 w-full sm:w-auto', commercialHubOutlineNeutralClass)}
              onClick={onSecondary}
              disabled={primaryLoading}
            >
              {secondaryLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            className={cn('min-h-11 w-full sm:min-w-[10rem]', commercialHubPrimaryButtonClass)}
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
          >
            {primaryLoading ? 'Procesando…' : primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
