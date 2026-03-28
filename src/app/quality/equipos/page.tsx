'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Award,
  FileText,
  ShieldAlert,
  Users,
  Gauge,
  BookOpen,
  Package,
  CalendarClock,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import QualityHubLayout from '@/components/quality/QualityHubLayout'
import type { ActionCard, SummaryItem, SecondaryLink } from '@/components/quality/QualityHubLayout'

type EquiposData = {
  certificados: number
  fichasTecnicas: number
  hojasSeguridad: number
  proveedores: number
}

export default function EquiposHub() {
  const { currentPlant } = usePlantContext()
  const { session } = useAuthBridge()
  const [data, setData] = useState<EquiposData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentPlant?.id || !session?.user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/quality/hub-summary?plant_id=${currentPlant.id}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data.equipos)
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
    { label: 'Certificados', value: data?.certificados ?? '—' },
    { label: 'Fichas técnicas', value: data?.fichasTecnicas ?? '—' },
    { label: 'Hojas seguridad', value: data?.hojasSeguridad ?? '—' },
    { label: 'Proveedores', value: data?.proveedores ?? '—' },
  ]

  const primaryActions: ActionCard[] = [
    {
      title: 'Certificados',
      description: 'Certificados de calibración y acreditación',
      href: '/quality/estudios/certificados',
      IconComponent: Award,
      color: 'sky',
    },
    {
      title: 'Fichas Técnicas',
      description: 'Documentación técnica de materiales',
      href: '/quality/estudios/fichas-tecnicas',
      IconComponent: FileText,
      color: 'emerald',
    },
    {
      title: 'Hojas de Seguridad',
      description: 'Hojas de datos de seguridad de materiales',
      href: '/quality/estudios/hojas-seguridad',
      IconComponent: ShieldAlert,
      color: 'amber',
    },
    {
      title: 'Proveedores',
      description: 'Gestión de proveedores de materiales',
      href: '/quality/suppliers',
      IconComponent: Users,
      color: 'violet',
    },
  ]

  const secondaryActions: SecondaryLink[] = [
    { href: '/quality/instrumentos', label: 'Centro EMA', IconComponent: Gauge },
    { href: '/quality/modelos', label: 'Modelos', IconComponent: BookOpen },
    { href: '/quality/paquetes', label: 'Paquetes', IconComponent: Package },
    { href: '/quality/instrumentos/programa', label: 'Programa', IconComponent: CalendarClock },
  ]

  return (
    <QualityHubLayout
      title="Equipos y Laboratorio"
      description="Gestión de instrumentos, certificaciones y activos del equipo de calidad"
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      secondaryActions={secondaryActions}
      onRefresh={fetchData}
      refreshing={loading}
    />
  )
}
