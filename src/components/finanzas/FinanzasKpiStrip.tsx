'use client'

import { cn } from '@/lib/utils'
import {
  finanzasHubKpiGridClass,
  finanzasHubSummaryStatusMap,
  type FinanzasHubSummaryStatus,
} from '@/components/finanzas/finanzasHubUi'

export type FinanzasKpiItem = {
  label: string
  value: string | number
  status?: FinanzasHubSummaryStatus
  hint?: string
}

type FinanzasKpiStripProps = {
  items: FinanzasKpiItem[]
  className?: string
}

export default function FinanzasKpiStrip({ items, className }: FinanzasKpiStripProps) {
  if (!items.length) return null

  return (
    <div className={cn(finanzasHubKpiGridClass, className)}>
      {items.map((item) => {
        const statusStyles = finanzasHubSummaryStatusMap[item.status ?? 'neutral']
        return (
          <div
            key={item.label}
            className={cn('rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 min-h-[4.5rem]', statusStyles.card)}
          >
            <p className={cn('text-xs font-medium', statusStyles.label)}>{item.label}</p>
            <p
              className={cn(
                'mt-1 text-lg sm:text-xl font-semibold font-mono tabular-nums leading-tight',
                statusStyles.value
              )}
            >
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">{item.hint}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
