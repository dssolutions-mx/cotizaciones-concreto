'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { commercialPanelClass } from '@/components/commercial/commercialHubUi'

export default function CommercialResponsiveTable<TRow>({
  rows,
  renderMobileCard,
  desktopTable,
  emptyMessage = 'No hay registros',
  className,
}: {
  rows: TRow[]
  renderMobileCard: (row: TRow, index: number) => ReactNode
  desktopTable: ReactNode
  emptyMessage?: string
  className?: string
}) {
  if (rows.length === 0) {
    return (
      <div className={cn(commercialPanelClass, 'text-center text-stone-500 py-12', className)}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="md:hidden space-y-3">{rows.map((row, i) => renderMobileCard(row, i))}</div>
      <div className={cn('hidden md:block', commercialPanelClass, 'overflow-x-auto p-0')}>
        {desktopTable}
      </div>
    </div>
  )
}
