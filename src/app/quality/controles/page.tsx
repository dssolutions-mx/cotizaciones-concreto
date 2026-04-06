'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { subMonths, format } from 'date-fns'
import { Beaker, ClipboardCheck, BarChart, Users, FileBarChart2 } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import QualityHubLayout from '@/components/quality/QualityHubLayout'
import type { ActionCard, SummaryItem, UrgencyZone } from '@/components/quality/QualityHubLayout'

type Metrics = {
  resistenciaPromedio: number
  porcentajeCumplimiento: number
  coeficienteVariacion: number
}

export default function ControlesHub() {
  const { currentPlant } = usePlantContext()
  const { profile, session } = useAuthBridge()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!currentPlant?.id || !session?.user) return
    setLoading(true)
    setError(null)
    try {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar métricas de control')
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id, currentPlant?.code, session?.user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const cumplimiento = metrics?.porcentajeCumplimiento ?? null
  const cv = metrics?.coeficienteVariacion ?? null

  // Urgency zones — most critical takes precedence
  let urgencyZone: UrgencyZone | undefined
  if (!loading && cumplimiento !== null && cumplimiento < 80) {
    urgencyZone = {
      message: `Cumplimiento ${cumplimiento.toFixed(1)}% — por debajo del mínimo requerido (80%). Revisar resistencias recientes.`,
      href: '/quality/dashboard',
      level: 'critical',
    }
  } else if (!loading && cv !== null && cv > 15) {
    urgencyZone = {
      message: `CV ${cv.toFixed(1)}% — alta variabilidad detectada. Revisar consistencia del proceso.`,
      href: '/quality/dashboard',
      level: 'warning',
    }
  }

  const summaryItems: SummaryItem[] = [
    {
      label: 'Resistencia prom.',
      value: metrics ? `${metrics.resistenciaPromedio.toFixed(1)} MPa` : '—',
      status: 'neutral',
      hint: 'últimos 30 días',
    },
    {
      label: 'Cumplimiento',
      value: cumplimiento !== null ? `${cumplimiento.toFixed(1)}%` : '—',
      status: loading
        ? 'neutral'
        : cumplimiento === null
          ? 'neutral'
          : cumplimiento >= 90
            ? 'ok'
            : cumplimiento >= 80
              ? 'warning'
              : 'critical',
      hint: '≥ 90% óptimo',
    },
    {
      label: 'Coef. variación',
      value: cv !== null ? `${cv.toFixed(1)}%` : '—',
      status: loading
        ? 'neutral'
        : cv === null
          ? 'neutral'
          : cv <= 12
            ? 'ok'
            : cv <= 15
              ? 'warning'
              : 'critical',
      hint: '≤ 12% óptimo',
    },
  ]

  const isExecutiveOrPM = profile?.role === 'EXECUTIVE' || profile?.role === 'PLANT_MANAGER'

  const primaryActions: ActionCard[] = [
    // Analysis tools — active, shown first for quick access
    ...(isExecutiveOrPM
      ? [{
          title: 'Dashboard Calidad',
          description: 'Métricas avanzadas con filtros, gráficos y análisis de resistencia',
          href: '/quality/dashboard',
          IconComponent: BarChart,
          color: 'violet' as const,
          featured: true,
        }]
      : []),
    {
      title: 'Análisis por Cliente',
      description: 'Rendimiento de calidad desglosado por cliente',
      href: '/quality/clientes',
      IconComponent: Users,
      color: 'sky',
    },
    {
      title: 'Análisis por Receta',
      description: 'Rendimiento de calidad desglosado por receta',
      href: '/quality/recetas-analisis',
      IconComponent: FileBarChart2,
      color: 'emerald',
    },
    // Coming soon controls
    {
      title: 'Mezcla de Referencia',
      description: 'Desarrollo y evaluación de mezcla de referencia mensual',
      href: '/quality/controles/mezcla-referencia',
      IconComponent: Beaker,
      color: 'amber',
      comingSoon: true,
    },
    {
      title: 'Verificación Lab',
      description: 'Inspecciones de laboratorio, incidentes y verificaciones',
      href: '/quality/controles/lab-checking',
      IconComponent: ClipboardCheck,
      color: 'rose',
      comingSoon: true,
    },
  ]

  return (
    <QualityHubLayout
      title="Controles"
      description="Seguimiento de cumplimiento, análisis de resistencia y controles internos de calidad"
      breadcrumb={{ hubName: 'Controles', hubHref: '/quality/controles' }}
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      urgencyZone={urgencyZone}
      error={error}
      onRefresh={fetchData}
      refreshing={loading}
    />
  )
}
