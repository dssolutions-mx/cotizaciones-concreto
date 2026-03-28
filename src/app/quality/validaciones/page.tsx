'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Lightbulb, FlaskConical, Package, TrendingUp, ChevronRight, RefreshCw } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type HubData = {
  caracterizacionesActivas: number
  materiales: number
}

type AreaAction = {
  title: string
  description: string
  href: string
  comingSoon?: boolean
}

function AreaBlock({
  color,
  IconComponent,
  title,
  description,
  actions,
  count,
  countLabel,
}: {
  color: 'amber' | 'emerald' | 'violet'
  IconComponent: React.ElementType
  title: string
  description: string
  actions: AreaAction[]
  count?: number | string
  countLabel?: string
}) {
  const colorMap = {
    amber: {
      bar: 'bg-amber-500',
      iconBg: 'bg-amber-100',
      iconText: 'text-amber-800',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      activeHover: 'hover:bg-amber-50',
      chevron: 'group-hover:text-amber-600',
    },
    emerald: {
      bar: 'bg-emerald-500',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-800',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      activeHover: 'hover:bg-emerald-50',
      chevron: 'group-hover:text-emerald-600',
    },
    violet: {
      bar: 'bg-violet-500',
      iconBg: 'bg-violet-100',
      iconText: 'text-violet-800',
      badge: 'bg-violet-50 text-violet-700 border-violet-200',
      activeHover: 'hover:bg-violet-50',
      chevron: 'group-hover:text-violet-600',
    },
  }
  const c = colorMap[color]
  const Icon = IconComponent

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className={cn('h-1', c.bar)} />
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', c.iconBg)}>
            <Icon className={cn('h-5 w-5', c.iconText)} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
            <p className="text-xs text-stone-500 mt-0.5">{description}</p>
          </div>
        </div>
        {count !== undefined && (
          <Badge variant="outline" className={cn('text-xs shrink-0', c.badge)}>
            {count} {countLabel}
          </Badge>
        )}
      </div>
      <div className="divide-y divide-stone-100">
        {actions.map((action) =>
          action.comingSoon ? (
            <div
              key={action.title}
              className="flex items-center gap-3 px-4 py-3 opacity-50 cursor-not-allowed"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 flex items-center gap-2">
                  {action.title}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Pronto
                  </Badge>
                </div>
                <p className="text-xs text-stone-500">{action.description}</p>
              </div>
            </div>
          ) : (
            <Link
              key={action.title}
              href={action.href}
              className={cn('group flex items-center gap-3 px-4 py-3 transition-colors', c.activeHover)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900">{action.title}</div>
                <p className="text-xs text-stone-500">{action.description}</p>
              </div>
              <ChevronRight className={cn('h-4 w-4 text-stone-400 shrink-0', c.chevron)} />
            </Link>
          )
        )}
      </div>
    </div>
  )
}

export default function ValidacionesHub() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Validaciones</h1>
          <p className="text-sm text-stone-600 mt-1">
            Investigación, caracterización de materiales y evaluación de mezclas
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <AreaBlock
        color="amber"
        IconComponent={Lightbulb}
        title="Investigación y Desarrollo"
        description="Proyectos de I+D, nuevas formulaciones y mejoras al proceso"
        actions={[
          {
            title: 'Investigación',
            description: 'Proyectos activos de investigación y desarrollo de mezclas',
            href: '/quality/validaciones/investigacion',
            comingSoon: true,
          },
        ]}
      />

      <AreaBlock
        color="emerald"
        IconComponent={FlaskConical}
        title="Nuevos Materiales"
        description="Caracterización y evaluación de materiales para uso en mezclas"
        count={loading ? '—' : (data?.caracterizacionesActivas ?? '—')}
        countLabel="caracterizaciones"
        actions={[
          {
            title: 'Caracterizaciones',
            description: 'Estudios de granulometría, absorción, densidad y propiedades físicas',
            href: '/quality/caracterizacion-materiales',
          },
          {
            title: 'Materiales',
            description: 'Catálogo de materiales aprobados y sus propiedades técnicas',
            href: '/quality/materials',
          },
        ]}
      />

      <AreaBlock
        color="violet"
        IconComponent={TrendingUp}
        title="Evaluar Mezcla"
        description="Desarrollo y verificación de curvas de resistencia agua/cemento"
        count={loading ? '—' : (data?.materiales ?? '—')}
        countLabel="materiales"
        actions={[
          {
            title: 'Curvas de Abrams',
            description: 'Análisis de relación agua/cemento y evaluación del comportamiento de mezclas',
            href: '/quality/curvas-abrams',
          },
        ]}
      />
    </div>
  )
}
