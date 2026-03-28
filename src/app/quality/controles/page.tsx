'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { subMonths, format } from 'date-fns'
import {
  Beaker,
  ClipboardCheck,
  BarChart,
  Users,
  FileBarChart2,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import QualityHubLayout from '@/components/quality/QualityHubLayout'
import type { ActionCard, SummaryItem } from '@/components/quality/QualityHubLayout'

export default function ControlesHub() {
  const { currentPlant } = usePlantContext()
  const { profile, session } = useAuthBridge()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<{
    resistenciaPromedio: number
    porcentajeCumplimiento: number
    coeficienteVariacion: number
  } | null>(null)

  const fetchData = useCallback(async () => {
    if (!currentPlant?.id || !session?.user) return
    setLoading(true)
    try {
      // Fetch quality metrics for last 30 days using the existing RPC
      const { fetchMetricasCalidad } = await import('@/services/qualityMetricsService')
      const to = new Date()
      const from = subMonths(to, 1)
      const result = await fetchMetricasCalidad(
        format(from, 'yyyy-MM-dd'),
        format(to, 'yyyy-MM-dd'),
        undefined, undefined, undefined,
        currentPlant?.code,
      )
      setMetrics({
        resistenciaPromedio: result.resistenciaPromedio,
        porcentajeCumplimiento: result.porcentajeResistenciaGarantia,
        coeficienteVariacion: result.coeficienteVariacion,
      })
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id, currentPlant?.code, session?.user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summaryItems: SummaryItem[] = [
    { label: 'Resistencia prom.', value: metrics ? `${metrics.resistenciaPromedio.toFixed(1)} MPa` : '—' },
    { label: 'Cumplimiento', value: metrics ? `${metrics.porcentajeCumplimiento.toFixed(1)}%` : '—' },
    { label: 'CV', value: metrics ? `${metrics.coeficienteVariacion.toFixed(1)}%` : '—' },
  ]

  const isExecutiveOrPM = profile?.role === 'EXECUTIVE' || profile?.role === 'PLANT_MANAGER'

  const primaryActions: ActionCard[] = [
    {
      title: 'Mezcla de Referencia',
      description: 'Desarrollo y evaluación de mezcla de referencia mensual',
      href: '/quality/controles/mezcla-referencia',
      IconComponent: Beaker,
      color: 'sky',
      comingSoon: true,
    },
    {
      title: 'Verificación Lab',
      description: 'Inspecciones de laboratorio, incidentes y verificaciones',
      href: '/quality/controles/lab-checking',
      IconComponent: ClipboardCheck,
      color: 'emerald',
      comingSoon: true,
    },
    ...(isExecutiveOrPM
      ? [{
          title: 'Dashboard Calidad',
          description: 'Métricas avanzadas con filtros y gráficos de resistencia',
          href: '/quality/dashboard',
          IconComponent: BarChart,
          color: 'violet' as const,
        }]
      : []),
    {
      title: 'Análisis por Cliente',
      description: 'Rendimiento de calidad desglosado por cliente',
      href: '/quality/clientes',
      IconComponent: Users,
      color: 'amber',
    },
    {
      title: 'Análisis por Receta',
      description: 'Rendimiento de calidad desglosado por receta',
      href: '/quality/recetas-analisis',
      IconComponent: FileBarChart2,
      color: 'rose',
    },
  ]

  return (
    <QualityHubLayout
      title="Controles de Calidad"
      description="Controles internos, mezcla de referencia, verificaciones y análisis"
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      onRefresh={fetchData}
      refreshing={loading}
    />
  )
}
