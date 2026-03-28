'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Lightbulb,
  FlaskConical,
  Package,
  TrendingUp,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import QualityHubLayout from '@/components/quality/QualityHubLayout'
import type { ActionCard, SummaryItem } from '@/components/quality/QualityHubLayout'

type ValidacionesData = {
  caracterizacionesActivas: number
  materiales: number
}

export default function ValidacionesHub() {
  const { currentPlant } = usePlantContext()
  const { session } = useAuthBridge()
  const [data, setData] = useState<ValidacionesData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentPlant?.id || !session?.user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/quality/hub-summary?plant_id=${currentPlant.id}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data.validaciones)
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
    { label: 'Caracterizaciones', value: data?.caracterizacionesActivas ?? '—' },
    { label: 'Materiales', value: data?.materiales ?? '—' },
  ]

  const primaryActions: ActionCard[] = [
    {
      title: 'Investigación (I+D)',
      description: 'Desarrollo de nuevas recetas y mejoras al departamento de calidad',
      href: '/quality/validaciones/investigacion',
      IconComponent: Lightbulb,
      color: 'amber',
      comingSoon: true,
    },
    {
      title: 'Caracterizaciones',
      description: 'Estudios de granulometría, absorción, densidad y más',
      href: '/quality/caracterizacion-materiales',
      IconComponent: FlaskConical,
      color: 'emerald',
    },
    {
      title: 'Materiales',
      description: 'Evaluación y registro de nuevos materiales',
      href: '/quality/materials',
      IconComponent: Package,
      color: 'sky',
    },
    {
      title: 'Curvas de Abrams',
      description: 'Análisis de relación agua/cemento y evaluación de mezclas',
      href: '/quality/curvas-abrams',
      IconComponent: TrendingUp,
      color: 'violet',
    },
  ]

  return (
    <QualityHubLayout
      title="Validaciones"
      description="Investigación, desarrollo y evaluación de nuevos materiales y mezclas"
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      onRefresh={fetchData}
      refreshing={loading}
    />
  )
}
