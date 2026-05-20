'use client'

import type { ReactNode } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type CommercialTabItem = {
  id: string
  label: string
  icon?: ReactNode
}

export default function CommercialTabRail({
  tabs,
  className,
}: {
  tabs: CommercialTabItem[]
  className?: string
}) {
  return (
    <div className={cn('-mx-1 overflow-x-auto px-1 snap-x snap-mandatory', className)}>
      <TabsList
        className={cn(
          'inline-flex h-auto min-h-10 w-max max-w-full gap-1',
          'bg-stone-200/60 p-1 rounded-lg'
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'snap-start shrink-0 min-h-10 px-3 sm:px-4 text-sm font-medium rounded-md',
              'data-[state=active]:bg-stone-900 data-[state=active]:text-white',
              'data-[state=inactive]:text-stone-700'
            )}
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {tab.icon}
              {tab.label}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  )
}
