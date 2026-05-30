'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import MaterialAdjustmentForm from './MaterialAdjustmentForm'
import AdjustmentRowCard from './AdjustmentRowCard'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import {
  Plus,
  History,
  TrendingDown,
  Minus,
  AlertTriangle,
  RotateCcw,
  ArrowUpDown,
  Clock,
  RefreshCw,
  Calendar as CalendarIcon,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { canDeleteInventoryClosure } from '@/lib/auth/inventoryClosureRoles'
import { MaterialAdjustment } from '@/types/inventory'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  adjustmentBadgeClass,
  adjustmentTypeLabelEs,
  adjustmentSourceLabelEs,
  classifyAdjustmentSource,
  formatSignedKg,
  matchesAdjustmentSourceFilter,
  MATERIAL_ADJUSTMENT_TYPES_ORDERED,
  signedQuantityForStockEffect,
  stockDirectionForType,
  type AdjustmentSourceCategory,
} from '@/lib/inventory/adjustmentModel'
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

type SourceFilter = AdjustmentSourceCategory | 'all'

export default function MaterialAdjustmentsPage({}: MaterialAdjustmentsPageProps) {
  const { currentPlant } = usePlantContext()
  const { profile } = useAuthSelectors()
  const [showForm, setShowForm] = useState(false)
  const [adjustments, setAdjustments] = useState<MaterialAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const canDelete = canDeleteInventoryClosure(profile?.role)
  const defaultDateRange = {
    from: subDays(new Date(), 29),
    to: new Date(),
  }
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(defaultDateRange)
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last30days')
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0
  })

  useEffect(() => {
    fetchAdjustments()
  }, [dateRange, currentPlant?.id])

  const sourceCounts = useMemo(() => {
    const counts: Record<SourceFilter, number> = {
      all: adjustments.length,
      closure: 0,
      opening: 0,
      manual: 0,
      other: 0,
    }
    for (const adj of adjustments) {
      const cat =
        adj.adjustment_source ??
        classifyAdjustmentSource(adj.reference_type, adj.reference_notes)
      counts[cat]++
    }
    return counts
  }, [adjustments])

  const visibleAdjustments = useMemo(
    () =>
      adjustments.filter((adj) =>
        matchesAdjustmentSourceFilter(
          adj.reference_type,
          adj.reference_notes,
          sourceFilter,
          adj.adjustment_source,
        ),
      ),
    [adjustments, sourceFilter],
  )

  const fetchAdjustments = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      let url = '/api/inventory/adjustments?limit=200&offset=0'
      if (dateRange?.from && dateRange?.to) {
        const fromStr = format(dateRange.from, 'yyyy-MM-dd')
        const toStr = format(dateRange.to, 'yyyy-MM-dd')
        url += `&date_from=${fromStr}&date_to=${toStr}`
      }
      if (currentPlant?.id) {
        url += `&plant_id=${currentPlant.id}`
      }
      const response = await fetch(url)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error ?? `Error al cargar ajustes (${response.status})`)
      }

      setAdjustments(data.adjustments || [])
      setHasMore(!!data.pagination?.hasMore)

      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const todayCount = data.adjustments?.filter((adj: MaterialAdjustment) =>
        new Date(adj.adjustment_date) >= today,
      ).length || 0

      const weekCount = data.adjustments?.filter((adj: MaterialAdjustment) =>
        new Date(adj.adjustment_date) >= weekStart,
      ).length || 0

      const monthCount = data.adjustments?.filter((adj: MaterialAdjustment) =>
        new Date(adj.adjustment_date) >= monthStart,
      ).length || 0

      setStats({
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
      })
    } catch (error) {
      console.error('Error fetching adjustments:', error)
      const msg = (error as Error).message
      setFetchError(msg)
      setAdjustments([])
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteAdjustment(adjustment: MaterialAdjustment) {
    const label = adjustment.adjustment_number
    const isClosureAdj =
      (adjustment.adjustment_source ??
        classifyAdjustmentSource(adjustment.reference_type, adjustment.reference_notes)) ===
      'closure'
    const extra = isClosureAdj
      ? '\n\nEste ajuste proviene de un cierre de inventario. Se restaurará el stock al valor anterior al ajuste.'
      : ''
    if (
      !window.confirm(
        `¿Eliminar el ajuste ${label}?${extra}\n\nEsta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    setDeletingId(adjustment.id)
    try {
      const res = await fetch(`/api/inventory/adjustments/${adjustment.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar')
      toast.success('Ajuste eliminado')
      await fetchAdjustments()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDeletingId(null)
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
          
          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as SourceFilter)}
          >
            <SelectTrigger className="w-full sm:w-[200px] order-2 sm:order-2">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Todos los orígenes ({sourceCounts.all})
              </SelectItem>
              <SelectItem value="closure">
                Cierre de inventario ({sourceCounts.closure})
              </SelectItem>
              <SelectItem value="opening">
                Apertura / cutover ({sourceCounts.opening})
              </SelectItem>
              <SelectItem value="manual">
                Manuales ({sourceCounts.manual})
              </SelectItem>
              <SelectItem value="other">
                Otro ({sourceCounts.other})
              </SelectItem>
            </SelectContent>
          </Select>

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

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {!currentPlant?.id && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seleccione una planta en el menú superior para ver los ajustes de esa planta.
        </div>
      )}

      {/* Detailed Statistics */}
      <AdjustmentsStatistics adjustments={visibleAdjustments} allAdjustments={adjustments} />

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
                <p className="text-sm text-gray-600">
                  {loading
                    ? 'Cargando...'
                    : sourceFilter === 'all'
                      ? `${adjustments.length} ajuste${adjustments.length !== 1 ? 's' : ''} en el rango`
                      : `${visibleAdjustments.length} de ${adjustments.length} — ${adjustmentSourceLabelEs(sourceFilter)}`}
                  {hasMore ? ' (hay más; acote fechas)' : ''}
                </p>
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
                ) : visibleAdjustments.length === 0 ? (
                  <EmptyState
                    icon={TrendingDown}
                    title={
                      adjustments.length === 0
                        ? 'No hay ajustes registrados'
                        : 'Ningún ajuste con este origen'
                    }
                    description={
                      adjustments.length === 0
                        ? 'Los ajustes aparecerán aquí una vez que registre el primero. Use el botón de abajo para crear un nuevo ajuste.'
                        : `Hay ${adjustments.length} ajuste(s) en el rango, pero ninguno coincide con «${adjustmentSourceLabelEs(sourceFilter)}». Pruebe «Todos los orígenes».`
                    }
                    actionLabel="Nuevo Ajuste"
                    onAction={() => setShowForm(true)}
                  />
                ) : (
                  <div className="space-y-4">
                    {visibleAdjustments.map((adjustment) => (
                      <AdjustmentRowCard
                        key={adjustment.id}
                        adjustment={adjustment}
                        canDelete={canDelete}
                        deleting={deletingId === adjustment.id}
                        onDelete={handleDeleteAdjustment}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-type">
            <Card>
              <CardHeader>
                <CardTitle>Ajustes por Tipo</CardTitle>
                <p className="text-sm text-gray-600">
                  Resumen por tipo de movimiento (corrección, merma, etc.) — respeta el filtro de origen
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Adjustment Type Categories */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MATERIAL_ADJUSTMENT_TYPES_ORDERED.map((type) => {
                      const label = adjustmentTypeLabelEs(type)
                      const IconComponent =
                        type === 'initial_count' || type === 'physical_count' || type === 'positive_correction'
                          ? Plus
                          : type === 'consumption'
                            ? TrendingDown
                            : type === 'waste'
                              ? AlertTriangle
                              : type === 'correction'
                                ? RotateCcw
                                : type === 'transfer'
                                  ? ArrowUpDown
                                  : Minus
                      const color =
                        type === 'initial_count' || type === 'physical_count' || type === 'positive_correction'
                          ? 'border-emerald-200'
                          : type === 'consumption'
                            ? 'border-red-200'
                            : type === 'waste'
                              ? 'border-orange-200'
                              : type === 'correction'
                                ? 'border-blue-200'
                                : type === 'transfer'
                                  ? 'border-violet-200'
                                  : 'border-stone-200'
                      const count = visibleAdjustments.filter((adj) => adj.adjustment_type === type).length
                      const totalSigned = visibleAdjustments
                        .filter((adj) => adj.adjustment_type === type)
                        .reduce(
                          (sum, adj) => sum + signedQuantityForStockEffect(adj.adjustment_type, adj.quantity_adjusted),
                          0
                        )

                      return (
                        <Card key={type} className={color}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3 min-w-0">
                                <IconComponent className="h-8 w-8 text-gray-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{label}</p>
                                  <p className="text-sm text-gray-500">{count} ajustes</p>
                                  <p className="text-xs text-gray-400 font-mono tabular-nums">
                                    {formatSignedKg(totalSigned)} kg neto
                                  </p>
                                </div>
                              </div>
                              <Badge variant="outline" className={cn(adjustmentBadgeClass(type), 'shrink-0 text-[10px]')}>
                                {stockDirectionForType(type) === 'increase' ? 'Entrada' : 'Salida'}
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
                ) : visibleAdjustments.length === 0 ? (
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
                      visibleAdjustments.reduce((acc, adj) => {
                        const materialName = adj.materials?.material_name || 'Material desconocido'
                        if (!acc[materialName]) {
                          acc[materialName] = []
                        }
                        acc[materialName].push(adj)
                        return acc
                      }, {} as Record<string, typeof adjustments>)
                    ).map(([materialName, materialAdjustments]) => {
                      const totalSigned = materialAdjustments.reduce(
                        (sum, adj) => sum + signedQuantityForStockEffect(adj.adjustment_type, adj.quantity_adjusted),
                        0
                      )
                      const adjustmentCount = materialAdjustments.length
                      const latestAdjustment = materialAdjustments.sort((a, b) =>
                        new Date(b.adjustment_date).getTime() - new Date(a.adjustment_date).getTime()
                      )[0]
                      const absAvg = adjustmentCount ? materialAdjustments.reduce((s, a) => s + a.quantity_adjusted, 0) / adjustmentCount : 0

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
                                    {adjustmentCount} ajuste{adjustmentCount !== 1 ? 's' : ''} • {formatSignedKg(totalSigned)} kg neto
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    Último ajuste: {format(new Date(latestAdjustment.adjustment_date), 'dd/MM/yyyy', { locale: es })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className={cn(
                                    'text-lg font-semibold font-mono',
                                    totalSigned >= 0 ? 'text-emerald-700' : 'text-red-600'
                                  )}
                                >
                                  {formatSignedKg(totalSigned)} kg
                                </p>
                                <p className="text-sm text-gray-500">
                                  Promedio |q|: {absAvg.toFixed(1)} kg/ajuste
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
                                        {adjustmentTypeLabelEs(adj.adjustment_type)}
                                      </Badge>
                                      <span>{format(new Date(adj.adjustment_date), 'dd/MM', { locale: es })}</span>
                                    </div>
                                    <span
                                      className={cn(
                                        'font-mono font-medium',
                                        stockDirectionForType(adj.adjustment_type) === 'increase'
                                          ? 'text-emerald-700'
                                          : 'text-red-600'
                                      )}
                                    >
                                      {formatSignedKg(
                                        signedQuantityForStockEffect(adj.adjustment_type, adj.quantity_adjusted)
                                      )}{' '}
                                      kg
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
