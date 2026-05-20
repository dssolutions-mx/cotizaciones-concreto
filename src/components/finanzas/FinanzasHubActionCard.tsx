import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { finanzasHubCardClass } from '@/components/finanzas/finanzasHubUi'

type FinanzasHubActionCardProps = {
  href: string
  title: string
  description: string
  icon: ReactNode
  accent?: 'sky' | 'emerald' | 'violet' | 'amber' | 'stone'
  className?: string
}

const accentMap = {
  sky: 'bg-sky-100 text-sky-800 border-sky-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  stone: 'bg-stone-100 text-stone-800 border-stone-200',
} as const

export default function FinanzasHubActionCard({
  href,
  title,
  description,
  icon,
  accent = 'stone',
  className,
}: FinanzasHubActionCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        finanzasHubCardClass,
        'group flex items-start gap-3 sm:gap-4 p-4 sm:p-5 min-h-[5.5rem]',
        'hover:border-stone-300 hover:shadow-md transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700/40 focus-visible:ring-offset-2',
        className
      )}
    >
      <div
        className={cn(
          'rounded-lg border p-2 shrink-0',
          accentMap[accent]
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm sm:text-base font-semibold text-stone-900 group-hover:text-stone-950">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-stone-500 mt-0.5 line-clamp-2">{description}</p>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-stone-400 group-hover:text-stone-600 mt-0.5"
        aria-hidden
      />
    </Link>
  )
}
