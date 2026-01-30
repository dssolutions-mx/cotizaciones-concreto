'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine
} from 'recharts'
import { MaterialFlowSummary } from '@/types/inventory'
import { TrendingUp, TrendingDown, AlertTriangle, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface InventoryChartsProps {
  materialFlows: MaterialFlowSummary[]
}

export function InventoryVarianceChart({ materialFlows }: InventoryChartsProps) {
  const chartData = useMemo(() => {
    return materialFlows
      .filter(m => Math.abs(m.variance_percentage) > 0.1) // Filter out near-zero variances
      .sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))
      .slice(0, 15) // Top 15 materials
      .map(m => ({
        name: m.material_name.length > 20 ? m.material_name.substring(0, 20) + '...' : m.material_name,
        fullName: m.material_name,
        variance: m.variance,
        variancePercentage: m.variance_percentage,
        theoretical: m.theoretical_final_stock,
        actual: m.actual_current_stock,
        unit: m.unit
      }))
  }, [materialFlows])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Varianzas de Inventario
          </CardTitle>
          <CardDescription>No se detectaron varianzas significativas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Todos los materiales están dentro del rango esperado</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Varianzas de Inventario (Top 15)
        </CardTitle>
        <CardDescription>
          Comparación entre stock teórico y stock real actual
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={90} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="font-semibold">{data.fullName}</p>
                      <p className="text-sm text-gray-600">
                        Teórico: {data.theoretical.toFixed(2)} {data.unit}
                      </p>
                      <p className="text-sm text-gray-600">
                        Real: {data.actual.toFixed(2)} {data.unit}
                      </p>
                      <p className={cn(
                        "text-sm font-semibold mt-1",
                        data.variancePercentage > 0 ? "text-red-600" : "text-green-600"
                      )}>
                        Varianza: {data.variancePercentage > 0 ? '+' : ''}{data.variancePercentage.toFixed(2)}%
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <ReferenceLine x={0} stroke="#666" strokeDasharray="2 2" />
            <Bar dataKey="variancePercentage" name="Varianza %">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.variancePercentage > 0 ? '#ef4444' : '#22c55e'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function InventoryFlowChart({ materialFlows }: InventoryChartsProps) {
  const chartData = useMemo(() => {
    return materialFlows
      .slice(0, 10) // Top 10 materials by consumption
      .sort((a, b) => b.total_remisiones_consumption - a.total_remisiones_consumption)
      .map(m => ({
        name: m.material_name.length > 15 ? m.material_name.substring(0, 15) + '...' : m.material_name,
        fullName: m.material_name,
        entries: m.total_entries,
        consumption: m.total_remisiones_consumption,
        adjustments: m.total_manual_additions + m.total_manual_withdrawals,
        waste: m.total_waste,
        unit: m.unit
      }))
  }, [materialFlows])

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Flujo de Materiales (Top 10 por Consumo)
        </CardTitle>
        <CardDescription>
          Entradas vs Consumo vs Ajustes durante el período
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
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
                        Entradas: {data.entries.toFixed(2)} {data.unit}
                      </p>
                      <p className="text-sm text-red-600">
                        Consumo: {data.consumption.toFixed(2)} {data.unit}
                      </p>
                      <p className="text-sm text-blue-600">
                        Ajustes: {data.adjustments.toFixed(2)} {data.unit}
                      </p>
                      {data.waste > 0 && (
                        <p className="text-sm text-orange-600">
                          Desperdicio: {data.waste.toFixed(2)} {data.unit}
                        </p>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Bar dataKey="entries" name="Entradas" fill="#22c55e" />
            <Bar dataKey="consumption" name="Consumo" fill="#ef4444" />
            <Bar dataKey="adjustments" name="Ajustes" fill="#3b82f6" />
            {chartData.some(d => d.waste > 0) && (
              <Bar dataKey="waste" name="Desperdicio" fill="#f97316" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function InventoryStockLevelsChart({ materialFlows }: InventoryChartsProps) {
  const chartData = useMemo(() => {
    return materialFlows
      .filter(m => m.actual_current_stock > 0 || m.theoretical_final_stock > 0)
      .sort((a, b) => b.actual_current_stock - a.actual_current_stock)
      .slice(0, 12) // Top 12 materials by stock
      .map(m => ({
        name: m.material_name.length > 15 ? m.material_name.substring(0, 15) + '...' : m.material_name,
        fullName: m.material_name,
        theoretical: m.theoretical_final_stock,
        actual: m.actual_current_stock,
        unit: m.unit
      }))
  }, [materialFlows])

  if (chartData.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Niveles de Stock (Top 12)
        </CardTitle>
        <CardDescription>
          Comparación de stock teórico vs real
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
            />
            <YAxis />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  const diff = data.actual - data.theoretical
                  const diffPercent = data.theoretical !== 0 
                    ? ((diff / data.theoretical) * 100).toFixed(2)
                    : '0.00'
                  
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="font-semibold">{data.fullName}</p>
                      <p className="text-sm text-blue-600">
                        Teórico: {data.theoretical.toFixed(2)} {data.unit}
                      </p>
                      <p className="text-sm text-green-600">
                        Real: {data.actual.toFixed(2)} {data.unit}
                      </p>
                      <p className={cn(
                        "text-sm font-semibold mt-1",
                        diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-600"
                      )}>
                        Diferencia: {diff > 0 ? '+' : ''}{diff.toFixed(2)} {data.unit} ({diffPercent}%)
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="theoretical"
              name="Stock Teórico"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Stock Real"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function InventorySummaryCards({ materialFlows }: InventoryChartsProps) {
  const summary = useMemo(() => {
    const totalEntries = materialFlows.reduce((sum, m) => sum + m.total_entries, 0)
    const totalConsumption = materialFlows.reduce((sum, m) => sum + m.total_remisiones_consumption, 0)
    const totalAdjustments = materialFlows.reduce((sum, m) => sum + m.total_manual_additions + m.total_manual_withdrawals, 0)
    const totalWaste = materialFlows.reduce((sum, m) => sum + m.total_waste, 0)
    const netFlow = totalEntries + materialFlows.reduce((sum, m) => sum + m.total_manual_additions, 0) 
      - totalConsumption - materialFlows.reduce((sum, m) => sum + m.total_manual_withdrawals, 0) - totalWaste

    return {
      totalEntries,
      totalConsumption,
      totalAdjustments,
      totalWaste,
      netFlow
    }
  }, [materialFlows])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Total Entradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {summary.totalEntries.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Total Consumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {summary.totalConsumption.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Total Ajustes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {summary.totalAdjustments.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Total Desperdicio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {summary.totalWaste.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Flujo Neto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-bold flex items-center gap-2",
            summary.netFlow > 0 ? "text-green-600" : summary.netFlow < 0 ? "text-red-600" : "text-gray-600"
          )}>
            {summary.netFlow > 0 ? <TrendingUp className="h-5 w-5" /> : summary.netFlow < 0 ? <TrendingDown className="h-5 w-5" /> : null}
            {summary.netFlow.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
