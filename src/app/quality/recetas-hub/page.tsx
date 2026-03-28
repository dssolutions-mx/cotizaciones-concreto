'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  FileUp,
  Layers,
  DollarSign,
  GitBranch,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import QualityHubLayout from '@/components/quality/QualityHubLayout'
import type { ActionCard, SummaryItem, SecondaryLink } from '@/components/quality/QualityHubLayout'

type RecetasData = {
  recetasActivas: number
  solicitudesArkikPendientes: number
}

export default function RecetasHub() {
  const { currentPlant } = usePlantContext()
  const { session } = useAuthBridge()
  const [data, setData] = useState<RecetasData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentPlant?.id || !session?.user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/quality/hub-summary?plant_id=${currentPlant.id}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data.recetas)
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
    { label: 'Recetas activas', value: data?.recetasActivas ?? '—' },
    { label: 'Solicitudes Arkik', value: data?.solicitudesArkikPendientes ?? '—' },
  ]

  const primaryActions: ActionCard[] = [
    {
      title: 'Recetas',
      description: 'Ver y gestionar recetas de concreto actuales',
      href: '/quality/recipes',
      IconComponent: FileText,
      color: 'sky',
    },
    {
      title: 'Solicitudes Arkik',
      description: 'Importación y validación de recetas desde Arkik',
      href: '/quality/arkik-requests',
      IconComponent: FileUp,
      color: 'emerald',
    },
    {
      title: 'Maestros',
      description: 'Recetas maestras y configuración base',
      href: '/masters/recipes',
      IconComponent: Layers,
      color: 'violet',
    },
  ]

  const secondaryActions: SecondaryLink[] = [
    { href: '/masters/grouping', label: 'Agrupación', IconComponent: Layers },
    { href: '/masters/pricing', label: 'Consolidación Precios', IconComponent: DollarSign },
    { href: '/quality/recipe-governance', label: 'Gobernanza de Versiones', IconComponent: GitBranch },
  ]

  return (
    <QualityHubLayout
      title="Recetas"
      description="Gestión de recetas, maestros, precios y gobernanza de versiones"
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      secondaryActions={secondaryActions}
      onRefresh={fetchData}
      refreshing={loading}
    />
  )
}
