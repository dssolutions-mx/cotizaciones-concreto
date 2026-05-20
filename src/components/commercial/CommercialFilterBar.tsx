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
import { commercialHubOutlineNeutralClass, commercialHubPrimaryButtonClass } from '@/components/commercial/commercialHubUi'
import { cn } from '@/lib/utils'

export default function CommercialFilterBar({
  desktopFilters,
  mobileFilters,
  mobileTitle = 'Filtros',
  onApply,
  onClear,
  hasActiveFilters,
  className,
}: {
  desktopFilters: ReactNode
  mobileFilters: ReactNode
  mobileTitle?: string
  onApply?: () => void
  onClear?: () => void
  hasActiveFilters?: boolean
  className?: string
}) {
  return (
    <>
      <div className={cn('hidden md:block', className)}>{desktopFilters}</div>
      <div className={cn('md:hidden', className)}>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('min-h-11 w-full justify-center gap-2', commercialHubOutlineNeutralClass)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {mobileTitle}
              {hasActiveFilters ? (
                <span className="ml-1 h-2 w-2 rounded-full bg-sky-600" aria-hidden />
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
                <Button
                  type="button"
                  variant="outline"
                  className={cn('min-h-11 w-full', commercialHubOutlineNeutralClass)}
                  onClick={onClear}
                >
                  Limpiar filtros
                </Button>
              ) : null}
              {onApply ? (
                <Button
                  type="button"
                  className={cn('min-h-11 w-full', commercialHubPrimaryButtonClass)}
                  onClick={onApply}
                >
                  Aplicar
                </Button>
              ) : null}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
