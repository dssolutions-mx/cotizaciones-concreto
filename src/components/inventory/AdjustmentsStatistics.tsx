'use client'

import React, { useMemo } from 'react'
import StatCard from './ui/StatCard'
import { MaterialAdjustment } from '@/types/inventory'
import { TrendingDown, AlertTriangle, RotateCcw, ArrowUpDown, Package } from 'lucide-react'

interface AdjustmentsStatisticsProps {
  adjustments: MaterialAdjustment[]
}

export default function AdjustmentsStatistics({ adjustments }: AdjustmentsStatisticsProps) {
  const stats = useMemo(() => {
    const totalAdjustments = adjustments.length
    const totalQuantity = adjustments.reduce((sum, adj) => sum + Math.abs(adj.quantity_adjusted || 0), 0)
    
    const byType = adjustments.reduce((acc, adj) => {
      const type = adj.adjustment_type || 'unknown'
      if (!acc[type]) {
        acc[type] = 0
      }
      acc[type]++
      return acc
    }, {} as Record<string, number>)

    const consumption = byType.consumption || 0
    const waste = byType.waste || 0
    const correction = byType.correction || 0
    const transfer = byType.transfer || 0
    const loss = byType.loss || 0

    const uniqueMaterials = new Set(adjustments.map(a => a.material_id)).size

    return {
      totalAdjustments,
      totalQuantity,
      consumption,
      waste,
      correction,
      transfer,
      loss,
      uniqueMaterials
    }
  }, [adjustments])

  if (adjustments.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <StatCard
        title="Total Ajustes"
        value={stats.totalAdjustments}
        icon={Package}
        iconColor="text-blue-600"
      />
      <StatCard
        title="Cantidad Total"
        value={stats.totalQuantity.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
        icon={TrendingDown}
        iconColor="text-red-600"
        subtitle="Unidades ajustadas"
      />
      <StatCard
        title="Consumos"
        value={stats.consumption}
        icon={TrendingDown}
        iconColor="text-blue-600"
      />
      <StatCard
        title="Desperdicios"
        value={stats.waste}
        icon={AlertTriangle}
        iconColor="text-red-600"
      />
      <StatCard
        title="Correcciones"
        value={stats.correction}
        icon={RotateCcw}
        iconColor="text-yellow-600"
      />
    </div>
  )
}
