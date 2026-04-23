'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import type { RefObject } from 'react'

/** Fixed row height for EMA workspace tables (matches compact cell padding). */
export const EMA_VIRTUAL_ROW_HEIGHT = 48

export function useEmaTableVirtualizer(
  count: number,
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  return useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => EMA_VIRTUAL_ROW_HEIGHT,
    overscan: 12,
  })
}
