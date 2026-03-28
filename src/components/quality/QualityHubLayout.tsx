'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// --- Types ---

export type SummaryItem = {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
}

export type ActionCard = {
  title: string
  description: string
  href: string
  IconComponent: React.ElementType
  color: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'stone'
  comingSoon?: boolean
}

export type SecondaryLink = {
  href: string
  label: string
  IconComponent: React.ElementType
  comingSoon?: boolean
}

// --- Color maps ---

const colorMap = {
  sky: {
    bg: 'bg-sky-100',
    border: 'border-sky-200',
    icon: 'text-sky-800',
    hover: 'group-hover:text-sky-900',
    chevron: 'group-hover:text-sky-700',
  },
  emerald: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    icon: 'text-emerald-800',
    hover: 'group-hover:text-emerald-900',
    chevron: 'group-hover:text-emerald-700',
  },
  violet: {
    bg: 'bg-violet-100',
    border: 'border-violet-200',
    icon: 'text-violet-800',
    hover: 'group-hover:text-violet-900',
    chevron: 'group-hover:text-violet-700',
  },
  amber: {
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    icon: 'text-amber-800',
    hover: 'group-hover:text-amber-900',
    chevron: 'group-hover:text-amber-700',
  },
  rose: {
    bg: 'bg-rose-100',
    border: 'border-rose-200',
    icon: 'text-rose-800',
    hover: 'group-hover:text-rose-900',
    chevron: 'group-hover:text-rose-700',
  },
  stone: {
    bg: 'bg-stone-100',
    border: 'border-stone-200',
    icon: 'text-stone-600',
    hover: 'group-hover:text-stone-900',
    chevron: 'group-hover:text-stone-700',
  },
}

// --- Component ---

export default function QualityHubLayout({
  title,
  description,
  summaryItems,
  summaryLoading,
  primaryActions,
  secondaryActions,
  onRefresh,
  refreshing,
  children,
}: {
  title: string
  description: string
  summaryItems?: SummaryItem[]
  summaryLoading?: boolean
  primaryActions: ActionCard[]
  secondaryActions?: SecondaryLink[]
  onRefresh?: () => void
  refreshing?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{title}</h1>
          <p className="text-sm text-stone-600 mt-1">{description}</p>
        </div>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        )}
      </div>

      {/* Summary strip */}
      {summaryItems && summaryItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-stone-200 bg-white px-4 py-3"
            >
              <div className="text-xs text-stone-500 uppercase tracking-wide">{item.label}</div>
              {summaryLoading ? (
                <div className="h-7 w-16 bg-stone-100 rounded animate-pulse mt-1" />
              ) : (
                <div className="text-2xl font-semibold text-stone-900 mt-0.5 font-mono tabular-nums">
                  {item.value}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Primary action cards */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 mb-3">
          Acciones principales
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {primaryActions.map((action) => {
            const colors = colorMap[action.color]
            const Icon = action.IconComponent

            if (action.comingSoon) {
              return (
                <div
                  key={action.title}
                  className="flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 min-h-[4.5rem] opacity-50 cursor-not-allowed"
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
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-900 flex items-center gap-2">
                      {action.title}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Pronto
                      </Badge>
                    </div>
                    <div className="text-xs text-stone-600">{action.description}</div>
                  </div>
                </div>
              )
            }

            return (
              <Link
                key={action.title}
                href={action.href}
                className="group flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 min-h-[4.5rem] hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
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
                <div className="flex-1 min-w-0">
                  <div className={cn('font-semibold text-stone-900', colors.hover)}>
                    {action.title}
                  </div>
                  <div className="text-xs text-stone-600">{action.description}</div>
                </div>
                <ChevronRight
                  className={cn('h-5 w-5 text-stone-400 shrink-0', colors.chevron)}
                />
              </Link>
            )
          })}
        </div>
      </section>

      {/* Secondary tools */}
      {secondaryActions && secondaryActions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 mb-3">
            Más herramientas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {secondaryActions.map(({ href, label, IconComponent: Icon, comingSoon }) =>
              comingSoon ? (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-400 cursor-not-allowed"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
                    Pronto
                  </Badge>
                </div>
              ) : (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-3 rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                >
                  <Icon className="h-4 w-4 text-stone-500 shrink-0" />
                  {label}
                </Link>
              )
            )}
          </div>
        </section>
      )}

      {/* Custom content (activity feeds, charts, etc.) */}
      {children}
    </div>
  )
}
