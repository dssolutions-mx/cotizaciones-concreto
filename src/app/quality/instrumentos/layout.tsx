import type { ReactNode } from 'react'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import { cn } from '@/lib/utils'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const jetMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-jet-mono' })

export default function EmaInstrumentosLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        dmSans.className,
        jetMono.variable,
        '-m-4 md:-m-6 min-h-[calc(100vh-2rem)] bg-[#f5f3f0] text-stone-900 antialiased'
      )}
    >
      <div className="container mx-auto max-w-6xl p-4 md:p-6">{children}</div>
    </div>
  )
}
