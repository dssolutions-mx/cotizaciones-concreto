'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import MaterialAdjustmentForm from './MaterialAdjustmentForm'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import { Plus, History, TrendingDown, Minus, AlertTriangle, RotateCcw, ArrowUpDown, Clock, RefreshCw, Calendar as CalendarIcon } from 'lucide-react'
import { MaterialAdjustment } from '@/types/inventory'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import StatCard from './ui/StatCard'
import EmptyState from './ui/EmptyState'
import DateRangePresets, { getDateRangeForPreset, type DateRangePreset } from './ui/DateRangePresets'
import FloatingActionButton from './ui/FloatingActionButton'
import AdjustmentsStatistics from './AdjustmentsStatistics'

interface MaterialAdjustmentsPageProps {
  // Future props for filtering, etc.
}

export default function MaterialAdjustmentsPage({}: MaterialAdjustmentsPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [adjustments, setAdjustments] = useState<MaterialAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  // Default to last 7 days as recommended in plan
  const defaultDateRange = {
    from: subDays(new Date(), 6),
    to: new Date()
  }
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(defaultDateRange)
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7days')
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0
  })

  useEffect(() => {
    fetchAdjustments()
  }, [dateRange])

  const fetchAdjustments = async () => {
    setLoading(true)
    try {
      console.log('=== FETCHING ADJUSTMENTS FROM MAIN PAGE ===')
      
      let url = '/api/inventory/adjustments?limit=50'
      if (dateRange?.from && dateRange?.to) {
        const fromStr = format(dateRange.from, 'yyyy-MM-dd')
        const toStr = format(dateRange.to, 'yyyy-MM-dd')
        url += `&date_from=${fromStr}&date_to=${toStr}`
      }
      
      const response = await fetch(url)

      if (response.ok) {
        const data = await response.json()
        console.log('Main page adjustments response:', data)
        setAdjustments(data.adjustments || [])

        // Calculate stats
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const todayCount = data.adjustments?.filter((adj: MaterialAdjustment) =>
          new Date(adj.adjustment_date) >= today
        ).length || 0

        const weekCount = data.adjustments?.filter((adj: MaterialAdjustment) =>
          new Date(adj.adjustment_date) >= weekStart
        ).length || 0

        const monthCount = data.adjustments?.filter((adj: MaterialAdjustment) =>
          new Date(adj.adjustment_date) >= monthStart
        ).length || 0

        setStats({
          today: todayCount,
          thisWeek: weekCount,
          thisMonth: monthCount
        })
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustmentSuccess = (adjustment: any) => {
    setShowForm(false)
    // Refresh the adjustments list
    fetchAdjustments()
  }

  const handlePresetSelect = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setSelectedPreset(preset)
    setDateRange(range)
  }

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range)
    // Detect if range matches a preset
    if (range.from && range.to) {
      const presets: DateRangePreset[] = ['today', 'yesterday', 'last7days', 'last30days', 'thisWeek', 'thisMonth']
      for (const preset of presets) {
        const presetRange = getDateRangeForPreset(preset)
        if (
          format(range.from, 'yyyy-MM-dd') === format(presetRange.from, 'yyyy-MM-dd') &&
          format(range.to, 'yyyy-MM-dd') === format(presetRange.to, 'yyyy-MM-dd')
        ) {
          setSelectedPreset(preset)
          return
        }
      }
      setSelectedPreset('custom')
    }
  }

  return (
    <div className="space-y-6">
      <InventoryBreadcrumb />
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ajustes de Inventario
          </h1>
          <p className="text-gray-600 mt-1">
            Registre salidas manuales, correcciones y transferencias de materiales
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Date Range Presets */}
          <div className="w-full sm:w-auto order-2 sm:order-1">
            <DateRangePresets
              selectedPreset={selectedPreset}
              onPresetSelect={handlePresetSelect}
            />
          </div>

          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full sm:w-[200px] justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd MMM", { locale: es })} -{" "}
                      {format(dateRange.to, "dd MMM yyyy", { locale: es })}
                    </>
                  ) : (
                    format(dateRange.from, "dd MMM yyyy", { locale: es })
                  )
                ) : (
                  <span>Seleccionar fechas</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAdjustments}
            disabled={loading}
            className="order-3"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          
          {/* Desktop button - FAB handles mobile */}
          <FloatingActionButton
            icon={Plus}
            label="Nuevo Ajuste"
            onClick={() => setShowForm(true)}
            className="order-1 sm:order-4"
          />
        </div>
      </div>

      {/* Quick Stats with Trend Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <StatCard
          title="Ajustes Hoy"
          value={stats.today}
          icon={Clock}
          iconColor="text-red-600"
          subtitle="registros del día"
        />
        <StatCard
          title="Esta Semana"
          value={stats.thisWeek}
          icon={History}
          iconColor="text-blue-600"
          subtitle="registros semanales"
        />
        <StatCard
          title="Total Mes"
          value={stats.thisMonth}
          icon={TrendingDown}
          iconColor="text-orange-600"
          subtitle="registros mensuales"
        />
      </div>

      {/* Detailed Statistics */}
      <AdjustmentsStatistics adjustments={adjustments} />

      {/* Main Content */}
      {showForm ? (
        <MaterialAdjustmentForm
          onSuccess={handleAdjustmentSuccess}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recent">Ajustes Recientes</TabsTrigger>
            <TabsTrigger value="by-type">Por Tipo</TabsTrigger>
            <TabsTrigger value="by-material">Por Material</TabsTrigger>
          </TabsList>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Ajustes Recientes</CardTitle>
                <p className="text-sm text-gray-600">Últimos ajustes registrados en el sistema</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : adjustments.length === 0 ? (
                  <EmptyState
                    icon={TrendingDown}
                    title="No hay ajustes registrados"
                    description="Los ajustes aparecerán aquí una vez que registre el primero. Use el botón de abajo para crear un nuevo ajuste."
                    actionLabel="Nuevo Ajuste"
                    onAction={() => setShowForm(true)}
                  />
                ) : (
                  <div className="space-y-4">
                    {adjustments.slice(0, 10).map((adjustment) => {
                      const getAdjustmentIcon = (type: string) => {
                        switch (type) {
                          case 'consumption': return TrendingDown
                          case 'waste': return AlertTriangle
                          case 'correction': return RotateCcw
                          case 'transfer': return ArrowUpDown
                          case 'loss': return Minus
                          default: return TrendingDown
                        }
                      }

                      const getAdjustmentColor = (type: string) => {
                        switch (type) {
                          case 'consumption': return 'bg-red-50 text-red-700 border-red-200'
                          case 'waste': return 'bg-orange-50 text-orange-700 border-orange-200'
                          case 'correction': return 'bg-blue-50 text-blue-700 border-blue-200'
                          case 'transfer': return 'bg-purple-50 text-purple-700 border-purple-200'
                          case 'loss': return 'bg-gray-50 text-gray-700 border-gray-200'
                          default: return 'bg-gray-50 text-gray-700 border-gray-200'
                        }
                      }

                      const getAdjustmentTypeLabel = (type: string) => {
                        switch (type) {
                          case 'consumption': return 'Consumo'
                          case 'waste': return 'Mal Estado'
                          case 'correction': return 'Corrección'
                          case 'transfer': return 'Transferencia'
                          case 'loss': return 'Pérdida'
                          default: return type
                        }
                      }

                      const Icon = getAdjustmentIcon(adjustment.adjustment_type)

                      return (
                        <Card key={adjustment.id} className="border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
                          <CardContent className="p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div className="flex items-start space-x-3 flex-1 min-w-0">
                                <div className="flex-shrink-0">
                                  <Icon className="h-8 w-8 text-red-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <p className="text-sm sm:text-base font-medium text-gray-900 truncate">
                                      {adjustment.adjustment_number}
                                    </p>
                                    <Badge variant="outline" className={cn("text-xs", getAdjustmentColor(adjustment.adjustment_type))}>
                                      {getAdjustmentTypeLabel(adjustment.adjustment_type)}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-500 line-clamp-2 mb-1">
                                    {adjustment.reference_notes}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {format(new Date(adjustment.adjustment_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-left sm:text-right flex-shrink-0">
                                <p className="text-lg sm:text-xl font-semibold text-red-600">
                                  -{adjustment.quantity_adjusted.toLocaleString('es-MX', { 
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2 
                                  })} kg
                                </p>
                                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                  Inventario: {adjustment.inventory_before.toLocaleString('es-MX')} → {adjustment.inventory_after.toLocaleString('es-MX')}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-type">
            <Card>
              <CardHeader>
                <CardTitle>Ajustes por Tipo</CardTitle>
                <p className="text-sm text-gray-600">Resumen de ajustes agrupados por tipo</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Adjustment Type Categories */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { type: 'consumption', label: 'Consumo', icon: TrendingDown, color: 'border-red-200' },
                      { type: 'waste', label: 'Material en Mal Estado', icon: AlertTriangle, color: 'border-orange-200' },
                      { type: 'correction', label: 'Correcciones', icon: RotateCcw, color: 'border-blue-200' },
                      { type: 'transfer', label: 'Transferencias', icon: ArrowUpDown, color: 'border-purple-200' },
                      { type: 'loss', label: 'Pérdidas', icon: Minus, color: 'border-gray-200' }
                    ].map(({ type, label, icon: IconComponent, color }) => {
                      const count = adjustments.filter(adj => adj.adjustment_type === type).length
                      const totalQuantity = adjustments
                        .filter(adj => adj.adjustment_type === type)
                        .reduce((sum, adj) => sum + adj.quantity_adjusted, 0)

                      return (
                        <Card key={type} className={color}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <IconComponent className="h-8 w-8 text-gray-600" />
                                <div>
                                  <p className="font-medium text-gray-900">{label}</p>
                                  <p className="text-sm text-gray-500">{count} ajustes</p>
                                  <p className="text-xs text-gray-400">{totalQuantity} kg total</p>
                                </div>
                              </div>
                              <Badge variant="outline" className={`${color} text-gray-700`}>
                                {type === 'consumption' ? 'Salida' :
                                 type === 'waste' ? 'Desecho' :
                                 type === 'correction' ? 'Corrección' :
                                 type === 'transfer' ? 'Transfer' :
                                 'Pérdida'}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-material">
            <Card>
              <CardHeader>
                <CardTitle>Ajustes por Material</CardTitle>
                <p className="text-sm text-gray-600">Resumen de ajustes agrupados por material</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : adjustments.length === 0 ? (
                  <EmptyState
                    icon={TrendingDown}
                    title="No hay ajustes por material"
                    description="Los ajustes aparecerán agrupados por material una vez que registre algunos."
                    actionLabel="Nuevo Ajuste"
                    onAction={() => setShowForm(true)}
                  />
                ) : (
                  <div className="space-y-4">
                    {/* Group adjustments by material */}
                    {Object.entries(
                      adjustments.reduce((acc, adj) => {
                        const materialName = adj.materials?.material_name || 'Material desconocido'
                        if (!acc[materialName]) {
                          acc[materialName] = []
                        }
                        acc[materialName].push(adj)
                        return acc
                      }, {} as Record<string, typeof adjustments>)
                    ).map(([materialName, materialAdjustments]) => {
                      const totalQuantity = materialAdjustments.reduce((sum, adj) => sum + adj.quantity_adjusted, 0)
                      const adjustmentCount = materialAdjustments.length
                      const latestAdjustment = materialAdjustments.sort((a, b) =>
                        new Date(b.adjustment_date).getTime() - new Date(a.adjustment_date).getTime()
                      )[0]

                      return (
                        <Card key={materialName} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <TrendingDown className="h-8 w-8 text-blue-500" />
                                </div>
                                <div>
                                  <p className="text-lg font-medium text-gray-900">{materialName}</p>
                                  <p className="text-sm text-gray-500">
                                    {adjustmentCount} ajuste{adjustmentCount !== 1 ? 's' : ''} • {totalQuantity} kg total
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    Último ajuste: {format(new Date(latestAdjustment.adjustment_date), 'dd/MM/yyyy', { locale: es })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-red-600">
                                  -{totalQuantity} kg
                                </p>
                                <p className="text-sm text-gray-500">
                                  Promedio: {Math.round(totalQuantity / adjustmentCount)} kg/ajuste
                                </p>
                              </div>
                            </div>

                            {/* Show recent adjustments for this material */}
                            <div className="mt-4 space-y-2">
                              <p className="text-sm font-medium text-gray-700">Últimos ajustes:</p>
                              <div className="space-y-1">
                                {materialAdjustments.slice(0, 3).map((adj) => (
                                  <div key={adj.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        {adj.adjustment_type === 'consumption' ? 'Consumo' :
                                         adj.adjustment_type === 'waste' ? 'Mal Estado' :
                                         adj.adjustment_type === 'correction' ? 'Corrección' :
                                         adj.adjustment_type === 'transfer' ? 'Transferencia' :
                                         'Pérdida'}
                                      </Badge>
                                      <span>{format(new Date(adj.adjustment_date), 'dd/MM', { locale: es })}</span>
                                    </div>
                                    <span className="text-red-600 font-medium">
                                      -{adj.quantity_adjusted} kg
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
