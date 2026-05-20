'use client'

import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export default function CommercialFilterBar({
  desktopFilters,
  mobileFilters,
  mobileTitle = 'Filtros',
  onApply,
  onClear,
  hasActiveFilters,
  className,
  sheetOnly = false,
}: {
  desktopFilters: ReactNode | null
  mobileFilters: ReactNode
  mobileTitle?: string
  onApply?: () => void
  onClear?: () => void
  hasActiveFilters?: boolean
  className?: string
  sheetOnly?: boolean
}) {
  const filterSheet = (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="hubOutline"
          className={cn(
            'min-h-10 shrink-0 gap-2',
            sheetOnly ? 'w-full sm:w-auto' : 'w-full justify-center'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {mobileTitle}
          {hasActiveFilters ? (
            <span className="ml-0.5 h-2 w-2 rounded-full bg-sky-600" aria-hidden />
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-xl bg-[#f5f3f0]">
        <SheetHeader>
          <SheetTitle className="text-stone-900">{mobileTitle}</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-4 overflow-y-auto">{mobileFilters}</div>
        <SheetFooter className="flex-col gap-2 sm:flex-col">
          {onClear ? (
            <Button type="button" variant="hubOutline" className="min-h-11 w-full" onClick={onClear}>
              Limpiar filtros
            </Button>
          ) : null}
          {onApply ? (
            <Button type="button" variant="hub" className="min-h-11 w-full" onClick={onApply}>
              Aplicar
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )

  if (sheetOnly) {
    return <div className={className}>{filterSheet}</div>
  }

  return (
    <>
      <div className={cn('hidden md:block', className)}>{desktopFilters}</div>
      <div className={cn('md:hidden', className)}>{filterSheet}</div>
    </>
  )
}
