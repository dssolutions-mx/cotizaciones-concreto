'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Beaker, FlaskConical, ClipboardCheck, Clipboard, Activity, Clock } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import QualityHubLayout from '@/components/quality/QualityHubLayout'
import type { ActionCard, SummaryItem, UrgencyZone } from '@/components/quality/QualityHubLayout'

type HubData = {
  muestreosHoy: number
  ensayosPendientes: number
  ensayosRecientes: number
  actividadReciente: Array<{
    id: string
    fecha_muestreo: string
    created_at: string
    remision_id: string | null
  }>
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

export default function OperacionesHub() {
  const { currentPlant } = usePlantContext()
  const { session } = useAuthBridge()
  const [data, setData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentPlant?.id || !session?.user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/quality/hub-summary?plant_id=${currentPlant.id}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data.operaciones)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id, session?.user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const overdueCount = data?.ensayosPendientes ?? 0

  const urgencyZone: UrgencyZone | undefined =
    !loading && overdueCount > 0
      ? {
          message: `${overdueCount} ${overdueCount === 1 ? 'ensayo atrasado' : 'ensayos atrasados'} — programados y sin resultado`,
          href: '/quality/ensayos',
          level: 'critical',
        }
      : undefined

  const summaryItems: SummaryItem[] = [
    {
      label: 'Muestreos hoy',
      value: data?.muestreosHoy ?? '—',
      status: loading ? 'neutral' : (data?.muestreosHoy ?? 0) > 0 ? 'ok' : 'neutral',
      hint: currentPlant?.name,
    },
    {
      label: 'Ensayos atrasados',
      value: data?.ensayosPendientes ?? '—',
      status: loading ? 'neutral' : overdueCount > 0 ? 'critical' : 'ok',
      hint: 'programados sin resultado',
    },
    {
      label: 'Ensayos (7 días)',
      value: data?.ensayosRecientes ?? '—',
      status: 'neutral',
      hint: 'resultados registrados',
    },
  ]

  const primaryActions: ActionCard[] = [
    {
      title: 'Muestreos',
      description: 'Registrar y consultar muestreos de concreto en campo',
      href: '/quality/muestreos',
      IconComponent: Beaker,
      color: 'sky',
      featured: true,
    },
    {
      title: 'Ensayos',
      description: 'Registrar resultados de ensayos programados',
      href: '/quality/ensayos',
      IconComponent: FlaskConical,
      color: 'emerald',
    },
    {
      title: 'Control en obra',
      description: 'Verificaciones de calidad en campo',
      href: '/quality/site-checks/new',
      IconComponent: ClipboardCheck,
      color: 'violet',
    },
    {
      title: 'Reportes',
      description: 'Reportes de resistencia, eficiencia y distribución',
      href: '/quality/reportes',
      IconComponent: Clipboard,
      color: 'amber',
    },
  ]

  const activities = data?.actividadReciente || []

  return (
    <QualityHubLayout
      title="Operaciones"
      description="Registro diario de muestreos, ensayos y verificaciones en campo"
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      urgencyZone={urgencyZone}
      onRefresh={fetchData}
      refreshing={loading}
    >
      {/* Activity stream */}
      {activities.length > 0 && (
        <section className="border border-stone-200 rounded-lg bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
            <Activity className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-semibold text-stone-900">Actividad reciente</h2>
          </div>
          <ul className="divide-y divide-stone-100">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                  <Beaker className="h-4 w-4 text-sky-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 font-medium">
                    {a.remision_id ? 'Muestreo en obra' : 'Muestreo interno'}
                  </p>
                  <p className="text-xs text-stone-500">
                    Fecha de muestreo:{' '}
                    {new Date(a.fecha_muestreo).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-stone-400 shrink-0">
                  <Clock className="h-3 w-3" />
                  <span>{relativeTime(a.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </QualityHubLayout>
  )
}
