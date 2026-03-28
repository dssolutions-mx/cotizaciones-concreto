'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Beaker,
  FlaskConical,
  ClipboardCheck,
  Clipboard,
  Activity,
  CheckCircle,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import QualityHubLayout from '@/components/quality/QualityHubLayout'
import type { ActionCard, SummaryItem } from '@/components/quality/QualityHubLayout'
import { cn } from '@/lib/utils'

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

  const summaryItems: SummaryItem[] = [
    { label: 'Muestreos hoy', value: data?.muestreosHoy ?? '—' },
    { label: 'Ensayos pendientes', value: data?.ensayosPendientes ?? '—' },
    { label: 'Ensayos (7 días)', value: data?.ensayosRecientes ?? '—' },
  ]

  const primaryActions: ActionCard[] = [
    {
      title: 'Muestreos',
      description: 'Registrar nuevos muestreos de concreto',
      href: '/quality/muestreos',
      IconComponent: Beaker,
      color: 'sky',
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
      title="Operaciones de Calidad"
      description="Gestión diaria de muestreos, ensayos y controles de producción"
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      onRefresh={fetchData}
      refreshing={loading}
    >
      {/* Activity feed */}
      {activities.length > 0 && (
        <section className="border border-stone-200 rounded-lg bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200">
            <Activity className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-semibold text-stone-900">Actividad reciente</h2>
          </div>
          <ul className="divide-y divide-stone-100">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 truncate">
                    Muestreo {a.remision_id ? 'operativo' : 'interno'}
                  </p>
                  <p className="text-xs text-stone-500 font-mono">
                    {new Date(a.created_at).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </QualityHubLayout>
  )
}
