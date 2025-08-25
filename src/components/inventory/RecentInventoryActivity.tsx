'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, 
  Package, 
  TrendingDown,
  Clock,
  User,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ActivityItem {
  activity_type: 'ENTRY' | 'ADJUSTMENT'
  activity_date: string
  activity_time: string
  plant_name: string
  material_name: string
  quantity: number
  inventory_before: number
  inventory_after: number
  performed_by: string
  notes?: string
}

export default function RecentInventoryActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchRecentActivity()
  }, [])

  const fetchRecentActivity = async () => {
    try {
      const response = await fetch('/api/inventory/activity?limit=5')
      
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchRecentActivity()
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ENTRY':
        return Package
      case 'ADJUSTMENT':
        return TrendingDown
      default:
        return Activity
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'ENTRY':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'ADJUSTMENT':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'ENTRY':
        return 'Entrada'
      case 'ADJUSTMENT':
        return 'Ajuste'
      default:
        return 'Actividad'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
            <CardDescription>
              Últimos movimientos de inventario
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Link href="/inventory/daily-log">
              <Button variant="outline" size="sm">
                Ver Todo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay actividad reciente</p>
            <p className="text-sm text-gray-400">Los movimientos aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.activity_type)
              const activityDateTime = new Date(`${activity.activity_date}T${activity.activity_time}`)
              
              return (
                <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className={`p-2 rounded-full ${getActivityColor(activity.activity_type)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {getActivityLabel(activity.activity_type)}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">
                        {activity.material_name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {activity.quantity.toLocaleString('es-ES', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        })} kg
                      </span>
                      <span>
                        Inventario: {activity.inventory_before.toLocaleString('es-ES')} → {activity.inventory_after.toLocaleString('es-ES')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {activity.performed_by}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(activityDateTime, { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                    </div>
                    
                    {activity.notes && (
                      <p className="text-xs text-gray-600 mt-2 italic">
                        "{activity.notes}"
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
