'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatCard from './ui/StatCard'
import { MaterialEntry } from '@/types/inventory'
import { Package, DollarSign, TrendingUp, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface EntriesStatisticsProps {
  entries: MaterialEntry[]
  dateRange?: { from: Date | undefined; to: Date | undefined }
}

export default function EntriesStatistics({ entries, dateRange }: EntriesStatisticsProps) {
  const stats = useMemo(() => {
    const totalEntries = entries.length
    const totalQuantity = entries.reduce((sum, e) => sum + (e.quantity_received || 0), 0)
    const totalCost = entries.reduce((sum, e) => sum + (e.total_cost || 0), 0)
    const uniqueMaterials = new Set(entries.map(e => e.material_id)).size
    const uniqueSuppliers = new Set(entries.filter(e => e.supplier_id).map(e => e.supplier_id)).size

    // Group by date
    const entriesByDate = entries.reduce((acc, entry) => {
      const date = format(new Date(entry.entry_date), 'yyyy-MM-dd')
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(entry)
      return acc
    }, {} as Record<string, MaterialEntry[]>)

    const dates = Object.keys(entriesByDate).sort()
    const avgEntriesPerDay = dates.length > 0 ? totalEntries / dates.length : 0

    return {
      totalEntries,
      totalQuantity,
      totalCost,
      uniqueMaterials,
      uniqueSuppliers,
      avgEntriesPerDay,
      dateRange: dateRange ? {
        from: dateRange.from ? format(dateRange.from, 'dd MMM yyyy', { locale: es }) : '',
        to: dateRange.to ? format(dateRange.to, 'dd MMM yyyy', { locale: es }) : ''
      } : null
    }
  }, [entries, dateRange])

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <StatCard
        title="Total Entradas"
        value={stats.totalEntries}
        icon={Package}
        iconColor="text-blue-600"
      />
      <StatCard
        title="Cantidad Total"
        value={stats.totalQuantity.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
        icon={TrendingUp}
        iconColor="text-green-600"
        subtitle="Unidades recibidas"
      />
      <StatCard
        title="Costo Total"
        value={`$${stats.totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={DollarSign}
        iconColor="text-purple-600"
      />
      <StatCard
        title="Materiales Únicos"
        value={stats.uniqueMaterials}
        icon={Package}
        iconColor="text-orange-600"
      />
      <StatCard
        title="Proveedores"
        value={stats.uniqueSuppliers}
        icon={Package}
        iconColor="text-indigo-600"
      />
    </div>
  )
}
