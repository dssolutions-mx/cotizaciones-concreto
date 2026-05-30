'use client'

import React, { useMemo } from 'react'
import StatCard from './ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MaterialAdjustment } from '@/types/inventory'
import { TrendingDown, Package, Layers } from 'lucide-react'
import {
  adjustmentSourceLabelEs,
  adjustmentTypeLabelEs,
  classifyAdjustmentSource,
  MATERIAL_ADJUSTMENT_TYPES_ORDERED,
  type AdjustmentSourceCategory,
} from '@/lib/inventory/adjustmentModel'

const SOURCE_CATEGORIES: AdjustmentSourceCategory[] = [
  'closure',
  'opening',
  'manual',
  'other',
]

interface AdjustmentsStatisticsProps {
  /** Rows after origen filter (for cards and por tipo). */
  adjustments: MaterialAdjustment[]
  /** Full fetch in date range (for por origen breakdown). */
  allAdjustments?: MaterialAdjustment[]
}

export default function AdjustmentsStatistics({
  adjustments,
  allAdjustments,
}: AdjustmentsStatisticsProps) {
  const originRows = allAdjustments ?? adjustments

  const stats = useMemo(() => {
    const totalAdjustments = adjustments.length
    const totalAbsKg = adjustments.reduce((sum, adj) => sum + Math.abs(adj.quantity_adjusted || 0), 0)

    const byType = adjustments.reduce((acc, adj) => {
      const type = adj.adjustment_type || 'unknown'
      if (!acc[type]) acc[type] = 0
      acc[type]++
      return acc
    }, {} as Record<string, number>)

    const bySource = originRows.reduce((acc, adj) => {
      const cat =
        adj.adjustment_source ??
        classifyAdjustmentSource(adj.reference_type, adj.reference_notes)
      acc[cat] = (acc[cat] ?? 0) + 1
      return acc
    }, {} as Record<AdjustmentSourceCategory, number>)

    const uniqueMaterials = new Set(adjustments.map((a) => a.material_id)).size

    return {
      totalAdjustments,
      totalAbsKg,
      byType,
      bySource,
      uniqueMaterials,
    }
  }, [adjustments, originRows])

  if (originRows.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total ajustes"
          value={stats.totalAdjustments}
          icon={Package}
          iconColor="text-sky-700"
          subtitle={allAdjustments && allAdjustments.length !== adjustments.length ? 'con filtro de origen' : undefined}
        />
        <StatCard
          title="Magnitud total (|kg|)"
          value={stats.totalAbsKg.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          icon={Layers}
          iconColor="text-stone-600"
          subtitle="Suma de valores absolutos en el rango"
        />
        <StatCard
          title="Materiales distintos"
          value={stats.uniqueMaterials}
          icon={TrendingDown}
          iconColor="text-emerald-700"
        />
      </div>

      <Card className="border-stone-200">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium text-stone-700">Registros por origen</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-sm">
            {SOURCE_CATEGORIES.map((cat) => (
              <div key={cat} className="flex justify-between gap-2 border-b border-stone-100 pb-1">
                <span className="text-stone-600 truncate" title={adjustmentSourceLabelEs(cat)}>
                  {adjustmentSourceLabelEs(cat)}
                </span>
                <span className="font-mono tabular-nums font-medium text-stone-900">
                  {stats.bySource[cat] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-stone-200">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium text-stone-700">
            Registros por tipo de movimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2 text-sm">
            {MATERIAL_ADJUSTMENT_TYPES_ORDERED.map((t) => (
              <div key={t} className="flex justify-between gap-2 border-b border-stone-100 pb-1">
                <span className="text-stone-600 truncate" title={adjustmentTypeLabelEs(t)}>
                  {adjustmentTypeLabelEs(t)}
                </span>
                <span className="font-mono tabular-nums font-medium text-stone-900">
                  {stats.byType[t] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
