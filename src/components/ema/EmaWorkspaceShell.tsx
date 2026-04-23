'use client'

import * as React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

function useMediaQueryMdUp() {
  const [matches, setMatches] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return matches
}

export interface EmaWorkspaceShellProps {
  toolbar: React.ReactNode
  /** Shown when selection > 0; include aria-live for selection count */
  batchBar: React.ReactNode | null
  table: React.ReactNode
  /** Desktop right column */
  sidePanel: React.ReactNode
  /** Same panel body inside Sheet on small screens */
  mobileSheetOpen: boolean
  onMobileSheetOpenChange: (open: boolean) => void
  mobileSheetTitle?: string
  sheetContentClassName?: string
}

/**
 * Master–detail workspace: scrollable table + sticky aside (md+), Sheet (mobile).
 * Outer width should be set by route layout (wide container).
 */
export function EmaWorkspaceShell({
  toolbar,
  batchBar,
  table,
  sidePanel,
  mobileSheetOpen,
  onMobileSheetOpenChange,
  mobileSheetTitle = 'Detalle',
  sheetContentClassName,
}: EmaWorkspaceShellProps) {
  const isMdUp = useMediaQueryMdUp()

  return (
    <div className="flex flex-col gap-3 min-h-0 min-w-0 flex-1">
      {toolbar}

      {batchBar}

      <div className="flex flex-1 min-h-0 min-w-0 gap-0 border border-stone-200/80 rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 min-h-0">{table}</div>

        {isMdUp && (
          <aside
            className={cn(
              'hidden md:flex flex-col shrink-0 border-l border-stone-200/80 bg-stone-50/40 min-h-0',
              'max-h-[calc(100vh-5rem)] sticky top-0 self-start w-[min(440px,36vw)] lg:w-[min(480px,34vw)]',
            )}
            aria-label="Panel de detalle"
          >
            {sidePanel}
          </aside>
        )}
      </div>

      {!isMdUp && (
        <Sheet open={mobileSheetOpen} onOpenChange={onMobileSheetOpenChange}>
          <SheetContent
            side="right"
            className={cn('w-[min(100vw-1rem,28rem)] p-0 flex flex-col gap-0', sheetContentClassName)}
            aria-describedby={undefined}
          >
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-stone-100 shrink-0 text-left">
              <SheetTitle className="text-base">{mobileSheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-y-auto">{sidePanel}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
