'use client'

import React, { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle,
  Download,
  RefreshCw,
  Filter,
  BarChart3,
  Target
} from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useInventoryDashboard } from '@/hooks/useInventoryDashboard'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { usePlantContext } from '@/contexts/PlantContext'
import TheoreticalInventoryTable from './TheoreticalInventoryTable'
import InventoryMovementsTable from './InventoryMovementsTable'
import RemisionConsumptionTable from './RemisionConsumptionTable'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState, useEffect } from 'react'

function InventoryDashboardPage() {
  const { profile } = useAuthSelectors()
  const { 
    currentPlant, 
    availablePlants, 
    switchPlant, 
    isGlobalAdmin,
    isLoading: plantContextLoading 
  } = usePlantContext()
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  })

  const {
    data,
    loading,
    error,
    filters,
    setDateRange: setDashboardDateRange,
    setPlantId,
    refreshData,
    exportData,
    resetFilters,
    totalMaterials,
    materialsWithVariance,
    materialsAtRisk,
    averageVariancePercentage
  } = useInventoryDashboard()

  // Update dashboard plant when plant context changes
  useEffect(() => {
    if (currentPlant && setPlantId) {
      setPlantId(currentPlant.id)
    }
  }, [currentPlant, setPlantId])

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range)
    
    if (range.from && range.to) {
      const startDate = format(range.from, 'yyyy-MM-dd')
      const endDate = format(range.to, 'yyyy-MM-dd')
      setDashboardDateRange(startDate, endDate)
    }
  }

  const handlePlantChange = (plantId: string) => {
    const selectedPlant = availablePlants.find(p => p.id === plantId)
    if (selectedPlant) {
      switchPlant(selectedPlant)
    }
  }

  if (loading || plantContextLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  // Show plant selection message for global admin users
  if (isGlobalAdmin && !currentPlant) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center py-12">
          <Target className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Seleccione una Planta</h2>
          <p className="text-gray-600 mb-4">
            Como administrador global, debe seleccionar una planta para ver el dashboard de inventario.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar el dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={refreshData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Inventario</h1>
          <p className="text-gray-600">
            {data ? `${data.summary.plant_info.name} - Análisis integral de inventario` : 'Control integral de inventario'}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Plant Selector for global admin users */}
          {isGlobalAdmin && (
            <Select value={currentPlant?.id || ''} onValueChange={handlePlantChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleccionar planta" />
              </SelectTrigger>
              <SelectContent>
                {availablePlants.map((plant) => (
                  <SelectItem key={plant.id} value={plant.id}>
                    {plant.name} ({plant.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
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
                  <span>Seleccionar rango de fechas</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
                locale={es}
                disabled={(date) => date > new Date() || date < addDays(new Date(), -365)}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Actualizar
          </Button>

          <Button variant="outline" size="sm" onClick={exportData} disabled={!data}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Materials */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-full mr-4">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Materiales Monitoreados</p>
                    <p className="text-2xl font-bold text-gray-900">{totalMaterials}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Materials with Variance */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-full mr-4">
                    <TrendingUp className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Con Varianza</p>
                    <p className="text-2xl font-bold text-gray-900">{materialsWithVariance}</p>
                    <p className="text-xs text-gray-500">≥1% varianza</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Materials at Risk */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-full mr-4">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">En Riesgo</p>
                    <p className="text-2xl font-bold text-gray-900">{materialsAtRisk}</p>
                    <p className="text-xs text-gray-500">≥5% varianza</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average Variance */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-full mr-4">
                    <Target className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Varianza Promedio</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {averageVariancePercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Date Range Info */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Período de Análisis: {format(new Date(data.summary.date_range.start_date), "dd 'de' MMMM", { locale: es })} - {format(new Date(data.summary.date_range.end_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </CardTitle>
                  <CardDescription>
                    {data.summary.total_remisiones} remisiones • {data.summary.total_entries} entradas • {data.summary.total_adjustments} ajustes
                  </CardDescription>
                </div>
                <Badge variant={materialsAtRisk > 0 ? "destructive" : materialsWithVariance > 0 ? "secondary" : "default"}>
                  {materialsAtRisk > 0 ? "Requiere Atención" : materialsWithVariance > 0 ? "Varianza Detectada" : "Control Normal"}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Main Content Tabs */}
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="summary" className="w-full">
                <div className="border-b px-6 pt-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="summary">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Resumen por Material
                    </TabsTrigger>
                    <TabsTrigger value="movements">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Movimientos
                    </TabsTrigger>
                    <TabsTrigger value="consumption">
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Consumo Remisiones
                    </TabsTrigger>
                    <TabsTrigger value="analysis">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Análisis
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <div className="p-6">
                  <TabsContent value="summary" className="mt-0">
                    <TheoreticalInventoryTable 
                      materialFlows={data.summary.material_flows} 
                      dateRange={data.summary.date_range}
                    />
                  </TabsContent>
                  
                  <TabsContent value="movements" className="mt-0">
                    <InventoryMovementsTable movements={data.movements} />
                  </TabsContent>
                  
                  <TabsContent value="consumption" className="mt-0">
                    <RemisionConsumptionTable consumptionDetails={data.consumption_details} />
                  </TabsContent>
                  
                  <TabsContent value="analysis" className="mt-0">
                    <div className="space-y-6">
                      {/* Variance Analysis */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Análisis de Varianzas</h3>
                        <div className="space-y-3">
                          {data.summary.material_flows
                            .filter(m => Math.abs(m.variance_percentage) > 1)
                            .sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))
                            .map(material => (
                              <div key={material.material_id} className="p-4 border rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-medium">{material.material_name}</h4>
                                    <p className="text-sm text-gray-600">
                                      Teórico: {material.theoretical_final_stock.toFixed(2)} {material.unit} • 
                                      Real: {material.actual_current_stock.toFixed(2)} {material.unit}
                                    </p>
                                  </div>
                                  <Badge variant={Math.abs(material.variance_percentage) > 5 ? "destructive" : "secondary"}>
                                    {material.variance_percentage > 0 ? "+" : ""}{material.variance_percentage.toFixed(1)}%
                                  </Badge>
                                </div>
                              </div>
                            ))
                          }
                          {data.summary.material_flows.filter(m => Math.abs(m.variance_percentage) > 1).length === 0 && (
                            <p className="text-gray-500 text-center py-8">
                              No se detectaron varianzas significativas (≥1%)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// PERFORMANCE: Memoized export to prevent unnecessary re-renders
export default memo(InventoryDashboardPage)
