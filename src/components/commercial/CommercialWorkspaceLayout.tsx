'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { commercialSectionTitleClass } from '@/components/commercial/commercialHubUi'

export default function CommercialWorkspaceLayout({
  title,
  subtitle,
  breadcrumb,
  headerActions,
  stickyHeaderExtra,
  children,
  maxWidth = '1600',
}: {
  title: string
  subtitle?: string
  breadcrumb?: ReactNode
  headerActions?: ReactNode
  stickyHeaderExtra?: ReactNode
  children: ReactNode
  maxWidth?: '6xl' | '1600'
}) {
  const containerMax =
    maxWidth === '1600' ? 'max-w-[min(1600px,100%)]' : 'max-w-6xl'

  return (
    <div className={cn('mx-auto w-full min-w-0 space-y-5', containerMax)}>
      {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}

      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 pt-1 pb-3 bg-[#f5f3f0]/95 backdrop-blur-sm border-b border-stone-200/70">
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
        {stickyHeaderExtra ? <div className="mt-3">{stickyHeaderExtra}</div> : null}
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  )
}

export { commercialSectionTitleClass }
