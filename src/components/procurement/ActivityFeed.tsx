'use client'

import React from 'react'
import Link from 'next/link'
import { Package, CreditCard, AlertTriangle, ShoppingCart, Clock } from 'lucide-react'
export type ActivityFeedItem = {
  id: string
  type: 'entry' | 'payment' | 'alert' | 'po'
  title: string
  subtitle?: string
  at: string
  href?: string
}

const ICONS: Record<ActivityFeedItem['type'], React.ElementType> = {
  entry: Package,
  payment: CreditCard,
  alert: AlertTriangle,
  po: ShoppingCart,
}

export default function ActivityFeed({ items, loading }: { items: ActivityFeedItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-stone-200/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">Sin actividad reciente.</p>
  }

  return (
    <ul className="space-y-0 divide-y divide-stone-100">
      {items.map((ev) => {
        const Icon = ICONS[ev.type] || Clock
        const at = ev.at ? new Date(ev.at) : new Date()
        return (
          <li key={ev.id} className="flex items-start gap-3 py-2.5 first:pt-0">
            <div className="mt-0.5 rounded-md border border-stone-200 bg-white p-1.5 text-stone-600">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {ev.href ? (
                  <Link href={ev.href} className="text-sm font-medium text-sky-800 hover:underline">
                    {ev.title}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-stone-900">{ev.title}</span>
                )}
                <time
                  className="text-[11px] text-stone-400 font-mono tabular-nums shrink-0"
                  dateTime={at.toISOString()}
                >
                  {at.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              {ev.subtitle && <p className="text-xs text-stone-600 mt-0.5">{ev.subtitle}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
