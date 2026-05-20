'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  finanzasHubStickyHeaderClass,
  finanzasHubSubtitleClass,
  finanzasHubTitleClass,
} from '@/components/finanzas/finanzasHubUi'

type FinanzasWorkspaceHeaderProps = {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  actions?: ReactNode
  tabs?: ReactNode
  className?: string
}

export default function FinanzasWorkspaceHeader({
  title,
  subtitle,
  backHref = '/finanzas',
  backLabel = '← Finanzas',
  actions,
  tabs,
  className,
}: FinanzasWorkspaceHeaderProps) {
  return (
    <header
      className={cn(
        finanzasHubStickyHeaderClass,
        '-mx-4 md:-mx-6 px-4 md:px-6 pt-3 md:pt-4 pb-2 mb-3 sm:mb-4',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className={finanzasHubTitleClass}>{title}</h1>
          {subtitle ? <p className={finanzasHubSubtitleClass}>{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
          {backHref ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 sm:h-8 min-h-[2.25rem] border-stone-300 bg-white"
              asChild
            >
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {tabs ? (
        <div className="mt-3 -mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [-webkit-overflow-scrolling:touch]">
          {tabs}
        </div>
      ) : null}
    </header>
  )
}
