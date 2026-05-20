import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type MaxWidth = '6xl' | '1600'

const maxWidthClass: Record<MaxWidth, string> = {
  '6xl': 'max-w-6xl',
  '1600': 'max-w-[min(1600px,100%)]',
}

export default function CommercialHubShell({
  children,
  maxWidth = '6xl',
  className,
}: {
  children: ReactNode
  maxWidth?: MaxWidth
  className?: string
}) {
  return (
    <div
      className={cn(
        '-m-4 md:-m-6 min-h-[calc(100vh-2rem)] w-full min-w-0 bg-[#f5f3f0] text-stone-900 antialiased',
        className
      )}
    >
      <div
        className={cn(
          'container mx-auto min-w-0 w-full p-4 md:p-6',
          maxWidthClass[maxWidth]
        )}
      >
        {children}
      </div>
    </div>
  )
}
