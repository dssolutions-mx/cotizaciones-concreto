'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { AlertTriangle, Package, CreditCard, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActionQueueTask = {
  id: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  title: string
  subtitle?: string
  count: number
  href: string
}

const ICONS: Record<ActionQueueTask['severity'], React.ElementType> = {
  critical: AlertTriangle,
  warning: Package,
  info: Clock,
  success: CheckCircle2,
}

function appendPlant(href: string, plantId: string | undefined) {
  if (!plantId) return href
  const u = href.includes('?') ? `${href}&plant_id=${encodeURIComponent(plantId)}` : `${href}?plant_id=${encodeURIComponent(plantId)}`
  return u
}

export default function ActionCenter({
  plantId,
  onNavigate,
}: {
  plantId?: string
  /** Optional: e.g. switch tab client-side */
  onNavigate?: (href: string) => void
}) {
  const [tasks, setTasks] = useState<ActionQueueTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (plantId) params.set('plant_id', plantId)
      const res = await fetch(`/api/procurement/action-queue?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cargar tareas')
      setTasks(json.success ? json.data?.tasks || [] : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="h-5 w-48 rounded bg-stone-200/80 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-stone-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-800">
        {error}
        <button type="button" className="ml-2 underline" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
        <p className="font-medium text-stone-800">Sin tareas urgentes en la cola</p>
        <p className="text-sm text-stone-500 mt-1">
          Revise las pestañas o el feed de actividad para seguimiento general.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      <div className="border-b border-stone-100 bg-[#faf9f7] px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Qué requiere atención</h2>
          <p className="text-xs text-stone-500 mt-0.5">{tasks.length} ítem{tasks.length === 1 ? '' : 's'} en cola</p>
        </div>
      </div>
      <ul className="divide-y divide-stone-100">
        {tasks.map((t) => {
          const Icon = ICONS[t.severity]
          const href = appendPlant(t.href, plantId)
          return (
            <li key={t.id}>
              <Link
                href={href}
                onClick={(e) => {
                  if (onNavigate) {
                    e.preventDefault()
                    onNavigate(href)
                  }
                }}
                className={cn(
                  'flex items-start gap-3 px-4 py-3.5 hover:bg-stone-50/80 transition-colors group',
                  t.severity === 'critical' && 'bg-red-50/30 hover:bg-red-50/50'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 rounded-lg border p-2 shrink-0',
                    t.severity === 'critical' && 'border-red-200 bg-red-50 text-red-700',
                    t.severity === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
                    t.severity === 'info' && 'border-sky-200 bg-sky-50 text-sky-800',
                    t.severity === 'success' && 'border-green-200 bg-green-50 text-green-800'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900 group-hover:text-sky-900">{t.title}</p>
                  {t.subtitle ? <p className="text-xs text-stone-500 mt-0.5 truncate">{t.subtitle}</p> : null}
                </div>
                <ChevronRight className="h-4 w-4 text-stone-400 shrink-0 mt-1 group-hover:text-stone-600" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
