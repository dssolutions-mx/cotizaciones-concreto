'use client'

import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const tintMap = {
  sky: {
    bg: 'bg-sky-100',
    border: 'border-sky-200',
    icon: 'text-sky-800',
  },
  emerald: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    icon: 'text-emerald-800',
  },
  violet: {
    bg: 'bg-violet-100',
    border: 'border-violet-200',
    icon: 'text-violet-800',
  },
  amber: {
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    icon: 'text-amber-800',
  },
  stone: {
    bg: 'bg-stone-100',
    border: 'border-stone-200',
    icon: 'text-stone-700',
  },
} as const

export type CommercialNavCardTint = keyof typeof tintMap

export default function CommercialNavCard({
  href,
  title,
  subtitle,
  icon: Icon,
  tint = 'sky',
  className,
}: {
  href: string
  title: string
  subtitle: string
  icon: LucideIcon
  tint?: CommercialNavCardTint
  className?: string
}) {
  const colors = tintMap[tint]

  return (
    <Link
      href={href}
      className={cn(
        'group flex w-full items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 min-h-[4.5rem]',
        'hover:bg-stone-50 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600',
        className
      )}
    >
      <div
        className={cn(
          'h-12 w-12 rounded-lg border flex items-center justify-center shrink-0',
          colors.bg,
          colors.border
        )}
      >
        <Icon className={cn('h-6 w-6', colors.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-stone-900">{title}</p>
        <p className="text-sm text-stone-500 mt-0.5 line-clamp-2">{subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 group-hover:text-stone-600" />
    </Link>
  )
}
