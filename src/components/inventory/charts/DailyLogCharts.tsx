'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts'
import { MaterialEntry, MaterialAdjustment } from '@/types/inventory'
import { Package, TrendingUp, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface DailyLogChartsProps {
  entries: MaterialEntry[]
  adjustments: MaterialAdjustment[]
  date: Date
}

export function DailyEntriesChart({ entries, date, hideCost }: { entries: MaterialEntry[]; date: Date; hideCost?: boolean }) {
  const chartData = useMemo(() => {
    const byMaterial = entries.reduce((acc, entry) => {
      const materialName = entry.material?.material_name || entry.material_id.substring(0, 8)
      if (!acc[materialName]) {
        acc[materialName] = {
          name: materialName.length > 15 ? materialName.substring(0, 15) + '...' : materialName,
          fullName: materialName,
          quantity: 0,
          cost: 0,
          unit: entry.material?.unit_of_measure || 'kg'
        }
      }
      acc[materialName].quantity += entry.quantity_received || 0
      acc[materialName].cost += entry.total_cost || 0
      return acc
    }, {} as Record<string, { name: string; fullName: string; quantity: number; cost: number; unit: string }>)

    return Object.values(byMaterial)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10) // Top 10
  }, [entries])

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Entradas por Material - {format(date, 'dd MMM yyyy', { locale: es })}
        </CardTitle>
        <CardDescription>
          Top 10 materiales por cantidad recibida
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="font-semibold">{data.fullName}</p>
                      <p className="text-sm text-green-600">
                        Cantidad: {data.quantity.toFixed(2)} {data.unit}
                      </p>
                      {!hideCost && data.cost > 0 && (
                        <p className="text-sm text-blue-600">
                          Costo: ${data.cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="quantity" name="Cantidad" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function DailyAdjustmentsChart({ adjustments, date }: { adjustments: MaterialAdjustment[]; date: Date }) {
  const chartData = useMemo(() => {
    const byType = adjustments.reduce((acc, adj) => {
      const type = adj.adjustment_type || 'unknown'
      const typeLabels: Record<string, string> = {
        consumption: 'Consumo',
        waste: 'Desperdicio',
        correction: 'Corrección',
        transfer: 'Transferencia',
        loss: 'Pérdida'
      }
      
      if (!acc[type]) {
        acc[type] = {
          name: typeLabels[type] || type,
          quantity: 0,
          count: 0
        }
      }
      acc[type].quantity += Math.abs(adj.quantity_adjusted || 0)
      acc[type].count++
      return acc
    }, {} as Record<string, { name: string; quantity: number; count: number }>)

    return Object.values(byType).sort((a, b) => b.quantity - a.quantity)
  }, [adjustments])

  if (chartData.length === 0) {
    return null
  }

  const colors = ['#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#6b7280']

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Ajustes por Tipo - {format(date, 'dd MMM yyyy', { locale: es })}
        </CardTitle>
        <CardDescription>
          Distribución de ajustes por tipo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="font-semibold">{data.name}</p>
                      <p className="text-sm text-red-600">
                        Cantidad: {data.quantity.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Ajustes: {data.count}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar dataKey="quantity" name="Cantidad Ajustada">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
