'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi'

// --- Types ---

export type SummaryItem = {
  label: string
  value: string | number
  status?: 'ok' | 'warning' | 'critical' | 'neutral'
  hint?: string
}

export type ActionCard = {
  title: string
  description: string
  href: string
  IconComponent: React.ElementType
  color: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'stone'
  comingSoon?: boolean
  featured?: boolean
  badge?: string | number
}

export type SecondaryLink = {
  href: string
  label: string
  IconComponent: React.ElementType
  comingSoon?: boolean
}

export type UrgencyZone = {
  message: string
  href?: string
  level: 'warning' | 'critical'
}

// --- Color maps ---

const colorMap = {
  sky: {
    bg: 'bg-sky-100',
    border: 'border-sky-200',
    icon: 'text-sky-800',
    hover: 'group-hover:text-sky-900',
    chevron: 'group-hover:text-sky-700',
    featuredBorder: 'border-sky-300',
    featuredBg: 'bg-sky-50',
  },
  emerald: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    icon: 'text-emerald-800',
    hover: 'group-hover:text-emerald-900',
    chevron: 'group-hover:text-emerald-700',
    featuredBorder: 'border-emerald-300',
    featuredBg: 'bg-emerald-50',
  },
  violet: {
    bg: 'bg-violet-100',
    border: 'border-violet-200',
    icon: 'text-violet-800',
    hover: 'group-hover:text-violet-900',
    chevron: 'group-hover:text-violet-700',
    featuredBorder: 'border-violet-300',
    featuredBg: 'bg-violet-50',
  },
  amber: {
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    icon: 'text-amber-800',
    hover: 'group-hover:text-amber-900',
    chevron: 'group-hover:text-amber-700',
    featuredBorder: 'border-amber-300',
    featuredBg: 'bg-amber-50',
  },
  rose: {
    bg: 'bg-rose-100',
    border: 'border-rose-200',
    icon: 'text-rose-800',
    hover: 'group-hover:text-rose-900',
    chevron: 'group-hover:text-rose-700',
    featuredBorder: 'border-rose-300',
    featuredBg: 'bg-rose-50',
  },
  stone: {
    bg: 'bg-stone-100',
    border: 'border-stone-200',
    icon: 'text-stone-600',
    hover: 'group-hover:text-stone-900',
    chevron: 'group-hover:text-stone-700',
    featuredBorder: 'border-stone-300',
    featuredBg: 'bg-stone-50',
  },
}

const summaryStatusMap = {
  ok: {
    card: 'bg-emerald-50 border-emerald-200',
    value: 'text-emerald-800',
    label: 'text-emerald-600',
  },
  warning: {
    card: 'bg-amber-50 border-amber-200',
    value: 'text-amber-800',
    label: 'text-amber-600',
  },
  critical: {
    card: 'bg-red-50 border-red-200',
    value: 'text-red-800',
    label: 'text-red-600',
  },
  neutral: {
    card: 'bg-white border-stone-200',
    value: 'text-stone-900',
    label: 'text-stone-500',
  },
}

// --- Sub-components ---

function ActionCardItem({ action }: { action: ActionCard }) {
  const colors = colorMap[action.color]
  const Icon = action.IconComponent

  if (action.comingSoon) {
    return (
      <div
        className={cn(
          'flex items-center gap-4 rounded-lg border bg-white p-4 opacity-50 cursor-not-allowed',
          action.featured ? 'min-h-[5.5rem] col-span-full' : 'min-h-[4.5rem]',
          colors.border
        )}
      >
        <div
          className={cn(
            'rounded-lg border flex items-center justify-center shrink-0',
            action.featured ? 'h-14 w-14' : 'h-12 w-12',
            colors.bg,
            colors.border
          )}
        >
          <Icon className={cn(action.featured ? 'h-7 w-7' : 'h-6 w-6', colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-stone-900 flex items-center gap-2 flex-wrap">
            {action.title}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Pronto
            </Badge>
            {action.badge !== undefined && action.badge !== null && (
              <Badge className="text-[10px] px-1.5 py-0 bg-stone-200 text-stone-600 border-0">
                {action.badge}
              </Badge>
            )}
          </div>
          <div className={cn('text-stone-600', action.featured ? 'text-sm mt-0.5' : 'text-xs')}>
            {action.description}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={action.href}
      className={cn(
        'group flex items-center gap-4 rounded-lg border bg-white p-4 hover:bg-stone-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600',
        action.featured
          ? cn('min-h-[5.5rem] col-span-full', colors.featuredBg, colors.featuredBorder)
          : cn('min-h-[4.5rem]', 'border-stone-200')
      )}
    >
      <div
        className={cn(
          'rounded-lg border flex items-center justify-center shrink-0',
          action.featured ? 'h-14 w-14' : 'h-12 w-12',
          colors.bg,
          colors.border
        )}
      >
        <Icon className={cn(action.featured ? 'h-7 w-7' : 'h-6 w-6', colors.icon)} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'font-semibold text-stone-900 flex items-center gap-2 flex-wrap',
            colors.hover,
            action.featured && 'text-base'
          )}
        >
          {action.title}
          {action.badge !== undefined && action.badge !== null && (
            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border border-amber-200">
              {action.badge}
            </Badge>
          )}
        </div>
        <div className={cn('text-stone-600', action.featured ? 'text-sm mt-0.5' : 'text-xs')}>
          {action.description}
        </div>
      </div>
      <ChevronRight
        className={cn(
          'shrink-0 text-stone-400',
          colors.chevron,
          action.featured ? 'h-6 w-6' : 'h-5 w-5'
        )}
      />
    </Link>
  )
}

// --- Main Component ---

export default function QualityHubLayout({
  title,
  description,
  summaryItems,
  summaryLoading,
  primaryActions,
  secondaryActions,
  urgencyZone,
  error,
  breadcrumb,
  primaryCta,
  onRefresh,
  refreshing,
  children,
}: {
  title: string
  description: string
  summaryItems?: SummaryItem[]
  summaryLoading?: boolean
  primaryActions?: ActionCard[]
  secondaryActions?: SecondaryLink[]
  urgencyZone?: UrgencyZone
  error?: string | null
  breadcrumb?: { hubName: string; hubHref: string; items?: { label: string; href?: string }[] }
  /** Primary action in the header row (e.g. quick link to create a record). */
  primaryCta?: { label: string; href: string }
  onRefresh?: () => void
  refreshing?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      {breadcrumb && (
        <QualityBreadcrumb
          hubName={breadcrumb.hubName}
          hubHref={breadcrumb.hubHref}
          items={breadcrumb.items}
        />
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-700 shrink-0" />
          <p className="text-sm text-red-900 flex-1">{error}</p>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-red-300 text-red-700 hover:bg-red-100"
              onClick={onRefresh}
            >
              Reintentar
            </Button>
          )}
        </div>
      )}

      {/* Urgency zone */}
      {urgencyZone && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-3',
            urgencyZone.level === 'critical'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          )}
        >
          {urgencyZone.level === 'critical' ? (
            <AlertCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          <span className="text-sm font-medium flex-1">{urgencyZone.message}</span>
          {urgencyZone.href && (
            <Link
              href={urgencyZone.href}
              className={cn(
                'text-sm font-semibold underline underline-offset-2 shrink-0',
                urgencyZone.level === 'critical' ? 'text-red-700' : 'text-amber-700'
              )}
            >
              Ver →
            </Link>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
          <p className="text-sm text-stone-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {primaryCta && (
            <Button variant="primary" size="sm" className={qualityHubPrimaryButtonClass} asChild>
              <Link href={primaryCta.href}>{primaryCta.label}</Link>
            </Button>
          )}
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {summaryItems && summaryItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryItems.map((item) => {
            const statusStyles = summaryStatusMap[item.status ?? 'neutral']
            return (
              <div
                key={item.label}
                className={cn('rounded-lg border px-4 py-3', statusStyles.card)}
              >
                <div className={cn('text-xs uppercase tracking-wide', statusStyles.label)}>
                  {item.label}
                </div>
                {summaryLoading ? (
                  <div className="h-7 w-16 bg-stone-100 rounded animate-pulse mt-1" />
                ) : (
                  <>
                    <div
                      className={cn(
                        'text-2xl font-semibold mt-0.5 font-mono tabular-nums',
                        statusStyles.value
                      )}
                    >
                      {item.value}
                    </div>
                    {item.hint && (
                      <div className="text-[11px] text-stone-400 mt-0.5 truncate">{item.hint}</div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Summary skeleton (when no items provided yet but loading) */}
      {summaryLoading && (!summaryItems || summaryItems.length === 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
              <div className="h-3 w-16 bg-stone-100 rounded animate-pulse" />
              <div className="h-7 w-20 bg-stone-100 rounded animate-pulse mt-2" />
              <div className="h-2.5 w-24 bg-stone-100 rounded animate-pulse mt-1.5" />
            </div>
          ))}
        </div>
      )}

      {/* Primary action cards */}
      {primaryActions && primaryActions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 mb-3">
            Acciones principales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {primaryActions.map((action) => (
              <ActionCardItem key={action.title} action={action} />
            ))}
          </div>
        </section>
      )}

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

      {/* Custom content (activity feeds, area blocks, charts, etc.) */}
      {children}
    </div>
  )
}
