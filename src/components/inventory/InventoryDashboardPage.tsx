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
import { format, addDays, subDays, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { useInventoryDashboard } from '@/hooks/useInventoryDashboard'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { usePlantContext } from '@/contexts/PlantContext'
import TheoreticalInventoryTable from './TheoreticalInventoryTable'
import InventoryMovementsTable from './InventoryMovementsTable'
import RemisionConsumptionTable from './RemisionConsumptionTable'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import {
  InventoryVarianceChart,
  InventoryFlowChart,
  InventoryStockLevelsChart,
  InventorySummaryCards
} from './charts/InventoryCharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState, useEffect } from 'react'
import DateRangePresets, { getDateRangeForPreset, type DateRangePreset } from './ui/DateRangePresets'
import StatCard from './ui/StatCard'
import MaterialCategoryFilter, { type MaterialCategory } from './ui/MaterialCategoryFilter'

function InventoryDashboardPage() {
  const { profile } = useAuthSelectors()
  const { 
    currentPlant, 
    availablePlants, 
    switchPlant, 
    isGlobalAdmin,
    isLoading: plantContextLoading 
  } = usePlantContext()
  // Default to last 7 days for dashboard
  const defaultDateRange = {
    from: subDays(new Date(), 6),
    to: new Date()
  }
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(defaultDateRange)
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7days')
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>('all')

  const {
    data,
    loading,
    error,
    filters,
    setDateRange: setDashboardDateRange,
    setPlantId,
    setCategory: setDashboardCategory,
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

  // Sync dateRange state with actual data dates to ensure consistency
  useEffect(() => {
    if (data?.summary?.date_range) {
      const { start_date, end_date } = data.summary.date_range
      // Parse dates as local dates to avoid timezone issues
      const startDate = parse(start_date, 'yyyy-MM-dd', new Date())
      const endDate = parse(end_date, 'yyyy-MM-dd', new Date())
      
      // Only update if dates are different to avoid unnecessary re-renders
      if (
        !dateRange.from ||
        !dateRange.to ||
        format(dateRange.from, 'yyyy-MM-dd') !== start_date ||
        format(dateRange.to, 'yyyy-MM-dd') !== end_date
      ) {
        setDateRange({ from: startDate, to: endDate })
      }
    }
  }, [data?.summary?.date_range?.start_date, data?.summary?.date_range?.end_date])

  const handlePresetSelect = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setSelectedPreset(preset)
    setDateRange(range)
    const startDate = format(range.from, 'yyyy-MM-dd')
    const endDate = format(range.to, 'yyyy-MM-dd')
    setDashboardDateRange(startDate, endDate)
  }

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range)
    
    if (range.from && range.to) {
      const startDate = format(range.from, 'yyyy-MM-dd')
      const endDate = format(range.to, 'yyyy-MM-dd')
      setDashboardDateRange(startDate, endDate)
      
      // Detect if range matches a preset
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

  const handlePlantChange = (plantId: string) => {
    const selectedPlant = availablePlants.find(p => p.id === plantId)
    if (selectedPlant) {
      switchPlant(selectedPlant)
    }
  }

  if (loading || plantContextLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <InventoryBreadcrumb />
        {/* Header skeleton */}
        <div className="animate-pulse">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="space-y-2">
              <div className="h-9 bg-gray-200 rounded w-64"></div>
              <div className="h-5 bg-gray-200 rounded w-96"></div>
            </div>
            <div className="flex gap-3">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-40"></div>
              <div className="h-10 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
          
          {/* Summary cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Flow summary cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-12 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main content skeleton */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded w-full"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
                <div className="h-96 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
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
      <InventoryBreadcrumb />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Inventario</h1>
          <p className="text-gray-600">
            {data ? `${data.summary.plant_info.name} - Análisis integral de inventario` : 'Control integral de inventario'}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-col gap-4">
          {/* Date Range Presets */}
          <div className="w-full">
            <DateRangePresets
              selectedPreset={selectedPreset}
              onPresetSelect={handlePresetSelect}
            />
          </div>

          {/* Material Category Filter */}
          <div className="w-full">
            <MaterialCategoryFilter
              selectedCategory={selectedCategory}
              onCategoryChange={(category) => {
                setSelectedCategory(category)
                setDashboardCategory(category === 'all' ? undefined : category)
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Plant Selector for global admin users */}
            {isGlobalAdmin && (
              <Select value={currentPlant?.id || ''} onValueChange={handlePlantChange}>
                <SelectTrigger className="w-full sm:w-[200px] h-10">
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
                  size="sm"
                  className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal h-10",
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

            <Button variant="outline" size="sm" onClick={refreshData} disabled={loading} className="h-10 min-w-[48px] sm:min-w-[100px]">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin", "sm:mr-2")} />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>

            <Button variant="outline" size="sm" onClick={exportData} disabled={!data} className="h-10 min-w-[48px] sm:min-w-[100px]">
              <Download className={cn("h-4 w-4", "sm:mr-2")} />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Materiales Monitoreados"
              value={totalMaterials}
              icon={Package}
              iconColor="text-blue-600"
            />
            <StatCard
              title="Con Varianza"
              value={materialsWithVariance}
              icon={TrendingUp}
              iconColor="text-yellow-600"
              subtitle="≥1% varianza"
            />
            <StatCard
              title="En Riesgo"
              value={materialsAtRisk}
              icon={AlertTriangle}
              iconColor="text-red-600"
              subtitle="≥5% varianza"
            />
            <StatCard
              title="Varianza Promedio"
              value={`${averageVariancePercentage.toFixed(1)}%`}
              icon={Target}
              iconColor="text-green-600"
            />
          </div>

          {/* Flow Summary Cards */}
          <InventorySummaryCards materialFlows={data.summary.material_flows} />

          {/* Date Range Info */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Período de Análisis: {format(parse(data.summary.date_range.start_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM", { locale: es })} - {format(parse(data.summary.date_range.end_date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: es })}
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
                  <TabsContent value="summary" className="mt-0 space-y-6">
                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <InventoryVarianceChart materialFlows={data.summary.material_flows} />
                      <InventoryStockLevelsChart materialFlows={data.summary.material_flows} />
                    </div>
                    <InventoryFlowChart materialFlows={data.summary.material_flows} />
                    
                    {/* Table Section */}
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
