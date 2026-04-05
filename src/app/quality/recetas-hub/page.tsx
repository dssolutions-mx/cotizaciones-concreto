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
import type { ActionCard, SummaryItem, SecondaryLink, UrgencyZone } from '@/components/quality/QualityHubLayout'

type RecetasData = {
  recetasActivas: number
  solicitudesArkikPendientes: number
}

export default function RecetasHub() {
  const { currentPlant } = usePlantContext()
  const { session } = useAuthBridge()
  const [data, setData] = useState<RecetasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!currentPlant?.id || !session?.user) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/quality/hub-summary?plant_id=${currentPlant.id}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data.recetas)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos de recetas')
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id, session?.user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const pendingArkik = data?.solicitudesArkikPendientes ?? 0

  const urgencyZone: UrgencyZone | undefined =
    !loading && pendingArkik > 0
      ? {
          message: `${pendingArkik} ${pendingArkik === 1 ? 'solicitud Arkik pendiente' : 'solicitudes Arkik pendientes'} — esperando revisión y validación`,
          href: '/quality/arkik-requests',
          level: 'warning',
        }
      : undefined

  const summaryItems: SummaryItem[] = [
    {
      label: 'Recetas activas',
      value: data?.recetasActivas ?? '—',
      status: 'neutral',
      hint: currentPlant?.name,
    },
    {
      label: 'Solicitudes Arkik',
      value: data?.solicitudesArkikPendientes ?? '—',
      status: loading ? 'neutral' : pendingArkik > 0 ? 'warning' : 'ok',
      hint: pendingArkik > 0 ? 'en espera de validación' : 'sin pendientes',
    },
  ]

  const primaryActions: ActionCard[] = [
    {
      title: 'Solicitudes Arkik',
      description: 'Importar y validar recetas desde Arkik — revisar pendientes',
      href: '/quality/arkik-requests',
      IconComponent: FileUp,
      color: 'emerald',
      featured: pendingArkik > 0,
      badge: pendingArkik > 0 ? pendingArkik : undefined,
    },
    {
      title: 'Recetas',
      description: 'Ver y gestionar recetas de concreto activas',
      href: '/quality/recipes',
      IconComponent: FileText,
      color: 'sky',
      featured: pendingArkik === 0,
    },
    {
      title: 'Maestros',
      description: 'Recetas maestras y configuración base de mezclas',
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
      description="Gestión del ciclo de vida de recetas: importación, validación, versiones y precios"
      breadcrumb={{ hubName: 'Recetas', hubHref: '/quality/recetas-hub' }}
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      secondaryActions={secondaryActions}
      urgencyZone={urgencyZone}
      error={error}
      onRefresh={fetchData}
      refreshing={loading}
    />
  )
}
