'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Package,
  TrendingDown,
  FileText,
  Upload,
  BarChart3,
  Calendar,
  Clock as ClockIcon,
  ArrowUpDown,
  Inbox,
  Settings,
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Activity,
  Users,
  Building2,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { usePlantContext } from '@/contexts/PlantContext'
import InventoryBreadcrumb from './InventoryBreadcrumb'

export default function DosificadorDashboard() {
  const { profile } = useAuthSelectors()
  const { currentPlant } = usePlantContext()
  const [mounted, setMounted] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [stats, setStats] = useState({
    entries: 0,
    adjustments: 0,
    pumpingServices: 0,
    arkikProcessed: 0
  })
  const [loading, setLoading] = useState(true)

  // Prevent hydration mismatch with date formatting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch real data
  useEffect(() => {
    if (mounted) {
      fetchDashboardData()
    }
  }, [mounted, currentPlant?.id])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch activities
      const query = new URLSearchParams({ limit: '8' })
      if (currentPlant?.id) query.set('plant_id', currentPlant.id)
      const activitiesResponse = await fetch(`/api/production-control/activities?${query.toString()}`)
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json()
        setActivities(activitiesData.activities || [])
        
        // Calculate stats from activities
        const today = new Date().toISOString().split('T')[0]
        const todayActivities = activitiesData.activities?.filter((activity: any) => 
          activity.timestamp.startsWith(today)
        ) || []
        
        setStats({
          entries: todayActivities.filter((a: any) => a.type === 'inventory' && a.action.includes('Entrada')).length,
          adjustments: todayActivities.filter((a: any) => a.type === 'inventory' && a.action.includes('Ajuste')).length,
          pumpingServices: todayActivities.filter((a: any) => a.type === 'pumping').length,
          arkikProcessed: todayActivities.filter((a: any) => a.type === 'arkik').length
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (activity: any) => {
    switch (activity.type) {
      case 'inventory':
        return activity.action.includes('Entrada') ? 
          <Package className="h-4 w-4 text-blue-500" /> : 
          <TrendingDown className="h-4 w-4 text-orange-500" />
      case 'pumping': return <Truck className="h-4 w-4 text-cyan-500" />
      case 'arkik': return <Upload className="h-4 w-4 text-purple-500" />
      case 'order': return <FileText className="h-4 w-4 text-green-500" />
      default: return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const activityTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Hace un momento'
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`
    if (diffInMinutes < 1440) return `Hace ${Math.floor(diffInMinutes / 60)} horas`
    return `Hace ${Math.floor(diffInMinutes / 1440)} días`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-8">
        <InventoryBreadcrumb />
        
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Control de Producción</h1>
              <p className="text-gray-600 mt-1">
                Bienvenido, {profile?.first_name} {profile?.last_name}
              </p>
              {currentPlant && (
                <div className="flex items-center gap-2 mt-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    Planta: {currentPlant.name} ({currentPlant.code})
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {mounted ? new Date().toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'Cargando...'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Entradas Hoy</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {loading ? '...' : stats.entries}
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Ajustes Hoy</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {loading ? '...' : stats.adjustments}
                  </p>
                </div>
                <div className="h-12 w-12 bg-orange-500 rounded-lg flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-cyan-600">Bombeos Hoy</p>
                  <p className="text-2xl font-bold text-cyan-900">
                    {loading ? '...' : stats.pumpingServices}
                  </p>
                </div>
                <div className="h-12 w-12 bg-cyan-500 rounded-lg flex items-center justify-center">
                  <Truck className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Arkik Procesados</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {loading ? '...' : stats.arkikProcessed}
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Upload className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Materiales Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Gestión de Materiales</h2>
            </div>
            
            <div className="space-y-4">
              <Link href="/production-control/entries">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-blue-500 hover:border-l-blue-600">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <Inbox className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              Entradas de Material
                            </h3>
                            <p className="text-sm text-gray-600">
                              Registrar recepción de materiales
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Registra nuevas entradas de cemento, arena, grava y otros materiales
                        </p>
                      </div>
                      <ArrowUpDown className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/production-control/adjustments">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-orange-500 hover:border-l-orange-600">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                            <Settings className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                              Ajustes de Inventario
                            </h3>
                            <p className="text-sm text-gray-600">
                              Realizar ajustes manuales
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Corrige diferencias entre inventario teórico y real
                        </p>
                      </div>
                      <ArrowUpDown className="h-5 w-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/production-control/advanced-dashboard">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-green-500 hover:border-l-green-600">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                            <BarChart3 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                              Reportes de Materiales
                            </h3>
                            <p className="text-sm text-gray-600">
                              Análisis y reportes detallados
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Visualiza estadísticas, variaciones y tendencias de materiales
                        </p>
                      </div>
                      <ArrowUpDown className="h-5 w-5 text-gray-400 group-hover:text-green-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>

          {/* Producción Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Control de Producción</h2>
            </div>
            
            <div className="space-y-4">
              

              <Link href="/production-control/reloj-checador">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-emerald-500 hover:border-l-emerald-600">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                            <ClockIcon className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                              Reloj Checador
                            </h3>
                            <p className="text-sm text-gray-600">
                              Subir archivo de asistencia diario
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Carga archivos CSV/PDF/imagen del reloj checador y visualízalos
                        </p>
                      </div>
                      <ArrowUpDown className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/production-control/pumping-service">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-cyan-500 hover:border-l-cyan-600">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 bg-cyan-100 rounded-lg flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                            <Truck className="h-5 w-5 text-cyan-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors">
                              Servicio de Bombeo
                            </h3>
                            <p className="text-sm text-gray-600">
                              Registrar remisiones de bombeo
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Gestiona servicios de bombeo independientes
                        </p>
                      </div>
                      <ArrowUpDown className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/production-control/arkik-upload">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-purple-500 hover:border-l-purple-600">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                            <Upload className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                              Carga Arkik
                            </h3>
                            <p className="text-sm text-gray-600">
                              Procesar archivos de producción
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Importa y procesa archivos Excel de producción
                        </p>
                      </div>
                      <ArrowUpDown className="h-5 w-5 text-gray-400 group-hover:text-purple-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Actividad Reciente
                </CardTitle>
                <CardDescription>
                  Últimas acciones realizadas en el sistema
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDashboardData}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg">
                    <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-shrink-0">
                      {getActivityIcon(activity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.action}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.details}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay actividad reciente</p>
                <p className="text-sm text-gray-400 mt-1">
                  Las actividades aparecerán aquí cuando se realicen acciones en el sistema
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
