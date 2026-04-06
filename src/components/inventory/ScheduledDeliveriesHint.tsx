'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Calendar, Package } from 'lucide-react'
import { format, parseISO, isToday, isTomorrow, addDays, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { MaterialAlert } from '@/types/alerts'
import { productionNewEntryUrl } from '@/lib/procurement/navigation'
import { cn } from '@/lib/utils'

/**
 * Banner: upcoming scheduled material deliveries for the plant (alerts in delivery_scheduled).
 */
export default function ScheduledDeliveriesHint({ plantId }: { plantId: string | undefined }) {
  const [alerts, setAlerts] = useState<MaterialAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!plantId) {
      setAlerts([])
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/alerts/material?plant_id=${encodeURIComponent(plantId)}&status=delivery_scheduled`
        )
        const json = res.ok ? await res.json() : null
        const rows = (json?.data || []) as MaterialAlert[]
        if (!cancelled) setAlerts(rows)
      } catch {
        if (!cancelled) setAlerts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [plantId])

  const grouped = useMemo(() => {
    const today = startOfDay(new Date())
    const buckets: {
      key: 'today' | 'tomorrow' | 'week' | 'later'
      label: string
      items: MaterialAlert[]
    }[] = [
      { key: 'today', label: 'Hoy', items: [] },
      { key: 'tomorrow', label: 'Mañana', items: [] },
      { key: 'week', label: 'Esta semana', items: [] },
      { key: 'later', label: 'Próximas', items: [] },
    ]
    const endOfWeek = addDays(today, 7)

    for (const a of alerts) {
      const raw = a.scheduled_delivery_date
      if (!raw) continue
      let d: Date
      try {
        d = parseISO(raw.length > 10 ? raw : `${raw}T12:00:00`)
      } catch {
        continue
      }
      const day = startOfDay(d)
      if (isToday(day)) buckets[0].items.push(a)
      else if (isTomorrow(day)) buckets[1].items.push(a)
      else if (day > today && day <= endOfWeek) buckets[2].items.push(a)
      else if (day > today) buckets[3].items.push(a)
    }
    return buckets.filter((b) => b.items.length > 0)
  }, [alerts])

  if (!plantId || loading) return null
  if (grouped.length === 0) return null

  const total = alerts.filter((a) => a.scheduled_delivery_date).length

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/60 px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
        <Calendar className="h-4 w-4 shrink-0" />
        Entregas programadas
        <span className="text-xs font-normal text-teal-800">
          ({total} {total === 1 ? 'entrega' : 'entregas'})
        </span>
      </div>
      <div className="space-y-3">
        {grouped.map((bucket) => (
          <div key={bucket.key}>
            <p className="text-xs font-medium uppercase tracking-wide text-teal-800 mb-1.5">{bucket.label}</p>
            <ul className="space-y-1.5">
              {bucket.items.map((a) => {
                const mat = (a.material as { material_name?: string })?.material_name ?? 'Material'
                const dateLabel = a.scheduled_delivery_date
                  ? format(parseISO(a.scheduled_delivery_date.length > 10 ? a.scheduled_delivery_date : `${a.scheduled_delivery_date}T12:00:00`), 'dd MMM', { locale: es })
                  : ''
                return (
                  <li key={a.id}>
                    <Link
                      href={productionNewEntryUrl({
                        plantId,
                        materialId: a.material_id,
                        alertId: a.id,
                      })}
                      className={cn(
                        'flex flex-wrap items-center gap-2 rounded-md border border-teal-200/80 bg-white px-3 py-2 text-sm',
                        'hover:bg-teal-50/80 transition-colors'
                      )}
                    >
                      <Package className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                      <span className="font-mono text-xs text-stone-600">{a.alert_number}</span>
                      <span className="text-stone-900 font-medium">{mat}</span>
                      {dateLabel && (
                        <span className="text-xs text-stone-500 ml-auto tabular-nums">{dateLabel}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
