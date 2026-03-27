'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle } from 'lucide-react'
import type { DashboardMaterialSummary } from '@/types/inventoryDashboard'

type PlantCard = {
  plantId: string
  name: string
  code?: string
  belowReorder: number
  critical: number
  totalMaterials: number
}

export default function CrossPlantInventorySummary({
  plantIds,
  plantLabel,
}: {
  /** Empty = all plants in list */
  plantIds: Array<{ id: string; name: string; code?: string }>
  plantLabel: string
}) {
  const [cards, setCards] = useState<PlantCard[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!plantIds.length) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    const results = await Promise.allSettled(
      plantIds.map(async (pl) => {
        const res = await fetch(`/api/inventory/dashboard-summary?plant_id=${encodeURIComponent(pl.id)}`)
        const json = (await res.json()) as {
          success?: boolean
          materials?: DashboardMaterialSummary[]
          data?: { materials?: DashboardMaterialSummary[] }
          error?: string
        }
        // API returns { success, materials, summary } — not json.data.materials
        const materials: DashboardMaterialSummary[] = Array.isArray(json.materials)
          ? json.materials
          : Array.isArray(json.data?.materials)
            ? json.data.materials
            : []

        if (!res.ok || !json.success) {
          return {
            plantId: pl.id,
            name: pl.name,
            code: pl.code,
            belowReorder: 0,
            critical: 0,
            totalMaterials: 0,
          }
        }
        const totalMaterials = materials.length
        const critical = materials.filter((m) => m.health === 'critical').length
        const warning = materials.filter((m) => m.health === 'warning').length
        return {
          plantId: pl.id,
          name: pl.name,
          code: pl.code,
          belowReorder: critical + warning,
          critical,
          totalMaterials,
        }
      })
    )
    const next: PlantCard[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') next.push(r.value)
      else {
        const pl = plantIds[i]
        next.push({
          plantId: pl.id,
          name: pl.name,
          code: pl.code,
          belowReorder: 0,
          critical: 0,
          totalMaterials: 0,
        })
      }
    })
    setCards(next)
    setLoading(false)
  }, [plantIds])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-600 mb-2">
        Inventario — {plantLabel}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
        {cards.map((c) => (
          <div
            key={c.plantId}
            className="snap-start shrink-0 w-[200px] rounded-lg border border-stone-200 bg-white p-3"
          >
            <div className="text-sm font-semibold text-stone-900 truncate">{c.name}</div>
            {c.code && <div className="text-[11px] text-stone-500 font-mono">{c.code}</div>}
            <div className="mt-2 space-y-1 text-xs text-stone-600">
              <div>
                Materiales: <span className="font-mono font-semibold text-stone-900">{c.totalMaterials}</span>
              </div>
              <div className="flex items-center gap-1 text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Bajo reorden / alerta:{' '}
                <span className="font-mono font-semibold">{c.belowReorder}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
