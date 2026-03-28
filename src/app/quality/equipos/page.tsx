'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Award,
  FileText,
  ShieldAlert,
  Users,
  Gauge,
  BookOpen,
  Package,
  CalendarClock,
  ChevronRight,
  FlaskConical,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import QualityHubLayout from '@/components/quality/QualityHubLayout'
import type { ActionCard, SummaryItem } from '@/components/quality/QualityHubLayout'

type EquiposData = {
  certificados: number
  fichasTecnicas: number
  hojasSeguridad: number
  proveedores: number
}

const emaLinks = [
  { href: '/quality/instrumentos', label: 'Centro EMA', Icon: Gauge },
  { href: '/quality/modelos', label: 'Modelos', Icon: BookOpen },
  { href: '/quality/paquetes', label: 'Paquetes', Icon: Package },
  { href: '/quality/instrumentos/programa', label: 'Programa', Icon: CalendarClock },
]

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
    { label: 'Certificados', value: data?.certificados ?? '—', status: 'neutral' },
    { label: 'Fichas técnicas', value: data?.fichasTecnicas ?? '—', status: 'neutral' },
    { label: 'Hojas seguridad', value: data?.hojasSeguridad ?? '—', status: 'neutral' },
    { label: 'Proveedores', value: data?.proveedores ?? '—', status: 'neutral' },
  ]

  const primaryActions: ActionCard[] = [
    {
      title: 'Certificados',
      description: 'Certificados de calibración y acreditación de instrumentos',
      href: '/quality/estudios/certificados',
      IconComponent: Award,
      color: 'sky',
    },
    {
      title: 'Fichas Técnicas',
      description: 'Documentación técnica de materiales y productos',
      href: '/quality/estudios/fichas-tecnicas',
      IconComponent: FileText,
      color: 'emerald',
    },
    {
      title: 'Hojas de Seguridad',
      description: 'Hojas de datos de seguridad (SDS) de materiales',
      href: '/quality/estudios/hojas-seguridad',
      IconComponent: ShieldAlert,
      color: 'amber',
    },
    {
      title: 'Proveedores',
      description: 'Gestión y evaluación de proveedores de materiales',
      href: '/quality/suppliers',
      IconComponent: Users,
      color: 'violet',
    },
  ]

  return (
    <QualityHubLayout
      title="Equipos y Laboratorio"
      description="Documentación técnica, proveedores y acreditación del laboratorio de calidad"
      summaryItems={summaryItems}
      summaryLoading={loading}
      primaryActions={primaryActions}
      onRefresh={fetchData}
      refreshing={loading}
    >
      {/* EMA Instruments section */}
      <section className="border border-stone-200 rounded-lg bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
          <FlaskConical className="h-4 w-4 text-stone-500" />
          <h2 className="text-sm font-semibold text-stone-700">Centro EMA</h2>
          <span className="text-xs text-stone-400 ml-1">— instrumentos y acreditación</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
          {emaLinks.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors"
            >
              <Icon className="h-4 w-4 text-stone-400 group-hover:text-stone-600 shrink-0" />
              <span className="text-sm text-stone-700 group-hover:text-stone-900">{label}</span>
              <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-500 ml-auto shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </QualityHubLayout>
  )
}
