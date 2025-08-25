'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  TrendingDown, 
  ArrowUpDown,
  Calendar,
  FileText
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { DailyInventoryLog } from '@/types/inventory'
import Link from 'next/link'

export default function DailyInventorySummary() {
  const { userProfile } = useAuth()
  const [dailyLog, setDailyLog] = useState<DailyInventoryLog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDailyLog()
  }, [])

  const fetchDailyLog = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/inventory/daily-log?date=${today}`)
      
      if (response.ok) {
        const data = await response.json()
        setDailyLog(data.dailyLog)
      }
    } catch (error) {
      console.error('Error fetching daily log:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Resumen del Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Resumen del Día
            </CardTitle>
            <CardDescription>
              Actividades de inventario - {today}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {dailyLog?.is_closed ? (
              <Badge variant="secondary">Día Cerrado</Badge>
            ) : (
              <Badge variant="default">Activo</Badge>
            )}
            <Link href="/inventory/daily-log">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Ver Bitácora
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Entradas */}
          <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
            <div className="p-3 bg-blue-100 rounded-full">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Entradas</p>
              <p className="text-2xl font-bold text-blue-700">
                {dailyLog?.total_entries || 0}
              </p>
              <p className="text-xs text-blue-600">registros del día</p>
            </div>
          </div>

          {/* Ajustes */}
          <div className="flex items-center space-x-4 p-4 bg-orange-50 rounded-lg">
            <div className="p-3 bg-orange-100 rounded-full">
              <TrendingDown className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-orange-900">Ajustes</p>
              <p className="text-2xl font-bold text-orange-700">
                {dailyLog?.total_adjustments || 0}
              </p>
              <p className="text-xs text-orange-600">movimientos manuales</p>
            </div>
          </div>

          {/* Consumo Total */}
          <div className="flex items-center space-x-4 p-4 bg-red-50 rounded-lg">
            <div className="p-3 bg-red-100 rounded-full">
              <ArrowUpDown className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-900">Consumo Total</p>
              <p className="text-2xl font-bold text-red-700">
                {dailyLog?.total_consumption 
                  ? Number(dailyLog.total_consumption).toLocaleString('es-ES', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })
                  : '0.00'
                }
              </p>
              <p className="text-xs text-red-600">kg de materiales</p>
            </div>
          </div>
        </div>

        {/* Daily Notes */}
        {dailyLog?.daily_notes && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Notas del Día</h4>
            <p className="text-sm text-gray-700">{dailyLog.daily_notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        {!dailyLog?.is_closed && userProfile?.role !== 'DOSIFICADOR' && (
          <div className="mt-6 flex gap-3">
            <Link href="/inventory/entries">
              <Button variant="outline" size="sm">
                <Package className="h-4 w-4 mr-2" />
                Nueva Entrada
              </Button>
            </Link>
            <Link href="/inventory/adjustments">
              <Button variant="outline" size="sm">
                <TrendingDown className="h-4 w-4 mr-2" />
                Nuevo Ajuste
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
