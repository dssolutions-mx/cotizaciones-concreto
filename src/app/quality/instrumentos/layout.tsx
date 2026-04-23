import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export default function EmaInstrumentosLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        '-m-4 md:-m-6 min-h-[calc(100vh-2rem)] w-full min-w-0 bg-[#f5f3f0] text-stone-900 antialiased'
      )}
    >
      <div className="container mx-auto max-w-6xl min-w-0 w-full p-4 md:p-6">{children}</div>
    </div>
  )
}
