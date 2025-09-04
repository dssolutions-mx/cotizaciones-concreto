'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  TrendingDown, 
  FileText, 
  Calendar,
  ArrowUpDown
} from 'lucide-react'
import Link from 'next/link'

interface DailyLog {
  id: string
  plant_id: string
  log_date: string
  total_entries: number
  total_adjustments: number
  total_consumption: number
  is_closed: boolean
  daily_notes: string | null
  created_at: string
  updated_at: string
}

export default function DailyInventorySummary() {
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
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
        setDailyLog(data.data)
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
            <Link href="/production-control/daily-log">
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
          <Card className="h-full border-s-4 border-s-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Entradas</CardTitle>
              <Package className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 mb-1">
                {dailyLog?.total_entries || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                registros del día
              </p>
            </CardContent>
          </Card>

          {/* Ajustes */}
          <Card className="h-full border-s-4 border-s-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Ajustes</CardTitle>
              <TrendingDown className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700 mb-1">
                {dailyLog?.total_adjustments || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                movimientos manuales
              </p>
            </CardContent>
          </Card>

          {/* Consumo Total */}
          <Card className="h-full border-s-4 border-s-red-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Consumo Total</CardTitle>
              <ArrowUpDown className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700 mb-1">
                {dailyLog?.total_consumption 
                  ? Number(dailyLog.total_consumption).toLocaleString('es-ES', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })
                  : '0.00'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                kg de materiales
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Notes */}
        {dailyLog?.daily_notes && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Notas del Día</h4>
            <p className="text-sm text-gray-700">{dailyLog.daily_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
