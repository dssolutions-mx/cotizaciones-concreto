'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { commercialSectionTitleClass } from '@/components/commercial/commercialHubUi'

export default function CommercialWorkspaceLayout({
  title,
  subtitle,
  breadcrumb,
  headerActions,
  toolbar,
  children,
  maxWidth = '1600',
  /** @deprecated Prefer `toolbar` — scrolls with content instead of sticky chrome. */
  stickyHeaderExtra,
}: {
  title: string
  subtitle?: string
  breadcrumb?: ReactNode
  headerActions?: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  maxWidth?: '6xl' | '1600'
  stickyHeaderExtra?: ReactNode
}) {
  const containerMax =
    maxWidth === '1600' ? 'max-w-[min(1600px,100%)]' : 'max-w-6xl'

  const toolbarNode = toolbar ?? stickyHeaderExtra

  return (
    <div className={cn('mx-auto w-full min-w-0', containerMax)}>
      <header className="space-y-3 pb-1">
        {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-stone-500 mt-1">{subtitle}</p>
            ) : null}
          </div>
          {headerActions ? (
            <div className="flex flex-wrap items-center gap-2 shrink-0">{headerActions}</div>
          ) : null}
        </div>
      </header>

      {toolbarNode ? <div className="mb-3 min-w-0">{toolbarNode}</div> : null}

      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  )
}

export { commercialSectionTitleClass }
