'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  Clock,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { addDays, isSameDay, startOfWeek, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import { usePlantContext } from '@/contexts/PlantContext'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import { qualityHubPrimaryButtonClass } from '@/components/quality/qualityHubUi'
import { fetchMuestrasPendientes } from '@/services/qualityMuestraService'
import type { FiltrosCalidad, MuestraWithRelations } from '@/types/quality'
import type { Plant } from '@/types/plant'
import { cn, formatDate } from '@/lib/utils'
import { ageInHoursAtTest, getScheduledDateTime } from './ensayosHelpers'
import EnsayosCalendar from './EnsayosCalendar'
import EnsayosDaySheet from './EnsayosDaySheet'
import EnsayosDayView from './EnsayosDayView'
import EnsayosListView from './EnsayosListView'
import EnsayosWeekView from './EnsayosWeekView'

const WEEK_STARTS_ON = 0 as const

function defaultProgramDateRange(): DateRange {
  const today = new Date()
  return { from: subDays(today, 7), to: addDays(today, 60) }
}

function isDefaultProgramDateRange(dr: DateRange | undefined): boolean {
  if (!dr?.from || !dr?.to) return false
  const def = defaultProgramDateRange()
  return isSameDay(dr.from, def.from!) && isSameDay(dr.to, def.to!)
}

/** Active plants the user may filter by (matches PlantProvider: skip DIACE). */
function plantsForMuestreoFilter(
  availablePlants: Plant[],
  isGlobalAdmin: boolean,
  profile: { plant_id?: string | null; business_unit_id?: string | null } | null,
  currentPlant: Plant | null
): Plant[] {
  const base = availablePlants
    .filter((p) => p.code !== 'DIACE')
    .sort((a, b) => a.code.localeCompare(b.code))
  if (isGlobalAdmin) return base
  if (profile?.business_unit_id) {
    return base.filter((p) => p.business_unit_id === profile.business_unit_id)
  }
  if (profile?.plant_id) {
    const one = base.find((p) => p.id === profile.plant_id)
    return one ? [one] : base
  }
  return currentPlant ? [currentPlant] : base
}

function plantScopeForFetch(
  plantaSelect: string,
  filterPlants: Plant[],
  currentPlant: Plant | null
): Pick<FiltrosCalidad, 'plant_id' | 'plant_ids'> {
  if (plantaSelect !== 'todas') {
    const p = filterPlants.find((x) => x.code === plantaSelect)
    if (p) return { plant_id: p.id }
    return currentPlant?.id ? { plant_id: currentPlant.id } : {}
  }
  const ids = filterPlants.map((p) => p.id)
  if (ids.length === 0) return currentPlant?.id ? { plant_id: currentPlant.id } : {}
  if (ids.length === 1) return { plant_id: ids[0]! }
  return { plant_ids: ids }
}

const filterSelectClass =
  'h-9 min-h-9 text-sm border-stone-300 bg-white text-stone-900 shadow-none'

export type EnsayosSortOption =
  | 'fecha_asc'
  | 'fecha_desc'
  | 'hora_asc'
  | 'hora_desc'
  | 'edad_asc'
  | 'edad_desc'

export type EnsayosViewMode = 'week' | 'month' | 'day' | 'list'

function applySort(muestras: MuestraWithRelations[], sort: EnsayosSortOption): MuestraWithRelations[] {
  const arr = [...muestras]
  arr.sort((a, b) => {
    const ta = getScheduledDateTime(a)?.getTime() ?? 0
    const tb = getScheduledDateTime(b)?.getTime() ?? 0
    const ea = ageInHoursAtTest(a)
    const eb = ageInHoursAtTest(b)
    switch (sort) {
      case 'fecha_asc':
      case 'hora_asc':
        return ta - tb
      case 'fecha_desc':
      case 'hora_desc':
        return tb - ta
      case 'edad_asc':
        return ea - eb
      case 'edad_desc':
        return eb - ea
      default:
        return ta - tb
    }
  })
  return arr
}

export default function EnsayosListClient() {
  const { profile } = useAuthBridge()
  const { currentPlant, availablePlants, isGlobalAdmin } = usePlantContext()

  const filterPlants = useMemo(
    () => plantsForMuestreoFilter(availablePlants, isGlobalAdmin, profile, currentPlant),
    [availablePlants, isGlobalAdmin, profile, currentPlant]
  )

  const [muestras, setMuestras] = useState<MuestraWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const [viewMode, setViewMode] = useState<EnsayosViewMode>('week')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => new Date())
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: WEEK_STARTS_ON })
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => defaultProgramDateRange())
  const [planta, setPlanta] = useState<string>('todas')
  const [sortOption, setSortOption] = useState<EnsayosSortOption>('fecha_asc')

  const plantScope = useMemo(
    () => plantScopeForFetch(planta, filterPlants, currentPlant),
    [planta, filterPlants, currentPlant]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!plantScope.plant_id && !plantScope.plant_ids?.length) {
        setMuestras([])
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setError(null)
        const filters: FiltrosCalidad = {
          ...plantScope,
          fechaDesde: dateRange?.from,
          fechaHasta: dateRange?.to,
        }
        const data = await fetchMuestrasPendientes(filters)
        if (!cancelled) setMuestras(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setError('Error al cargar los ensayos pendientes')
          setMuestras([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [plantScope, dateRange?.from, dateRange?.to])

  const handleRefresh = async () => {
    if (!plantScope.plant_id && !plantScope.plant_ids?.length) return
    setRefreshing(true)
    setError(null)
    try {
      const filters: FiltrosCalidad = {
        ...plantScope,
        fechaDesde: dateRange?.from,
        fechaHasta: dateRange?.to,
      }
      const data = await fetchMuestrasPendientes(filters)
      setMuestras(data)
    } catch (e) {
      console.error(e)
      setError('Error al cargar los ensayos pendientes')
      setMuestras([])
    } finally {
      setRefreshing(false)
    }
  }

  const handleArchiveStale = async () => {
    setArchiving(true)
    try {
      const res = await fetch('/api/quality/muestras/archive-stale', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { archived?: number; error?: string }
      if (!res.ok) {
        toast.error(body.error || 'No se pudo archivar')
        return
      }
      toast.success(
        body.archived != null
          ? `Archivadas ${body.archived} muestra(s) vencidas (no realizadas).`
          : 'Archivo completado.'
      )
      await handleRefresh()
    } catch (e) {
      console.error(e)
      toast.error('Error al archivar')
    } finally {
      setArchiving(false)
    }
  }

  const filteredSorted = useMemo(() => {
    let list = [...muestras]
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((m) => {
        const id = (m.identificacion || m.id).toLowerCase()
        const rem = m.muestreo?.remision?.remision_number?.toString().toLowerCase() ?? ''
        const recipe = m.muestreo?.remision?.recipe?.recipe_code?.toLowerCase() ?? ''
        const client = (
          m.muestreo?.remision?.orders?.clients?.business_name ||
          m.muestreo?.remision?.order?.clients?.business_name ||
          ''
        ).toLowerCase()
        return id.includes(q) || rem.includes(q) || recipe.includes(q) || client.includes(q)
      })
    }
    return applySort(list, sortOption)
  }, [muestras, searchQuery, sortOption])

  const muestrasForSelectedDay = useMemo(() => {
    if (!selectedDate) return []
    return filteredSorted.filter((m) => {
      const d = getScheduledDateTime(m)
      return d && isSameDay(d, selectedDate)
    })
  }, [filteredSorted, selectedDate])

  const onSelectDate = useCallback((d: Date | undefined) => {
    setSelectedDate(d)
    if (d) {
      setWeekStart(startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON }))
      setCurrentMonth(d)
    }
  }, [])

  const hasActiveFilters =
    !!searchQuery.trim() ||
    planta !== 'todas' ||
    !isDefaultProgramDateRange(dateRange)

  const clearFilters = () => {
    setSearchQuery('')
    setPlanta('todas')
    setDateRange(defaultProgramDateRange())
  }

  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE']
  const hasAccess = profile && allowedRoles.includes(profile.role)
  const canArchive = profile && ['QUALITY_TEAM', 'EXECUTIVE'].includes(profile.role)

  const canScope =
    !!plantScope.plant_id || (plantScope.plant_ids?.length ?? 0) > 0

  const dateRangeButtonLabel = (() => {
    if (!dateRange?.from) return 'Todas las fechas'
    if (dateRange.from && dateRange.to) {
      return `${formatDate(dateRange.from, 'dd/MM/yy')} – ${formatDate(dateRange.to, 'dd/MM/yy')}`
    }
    return `Desde ${formatDate(dateRange.from, 'dd/MM/yy')}`
  })()

  if (!hasAccess) {
    return (
      <div className="max-w-3xl mx-auto rounded-lg border border-amber-200 bg-amber-50/90 p-8">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-700" />
          <h2 className="text-xl font-semibold text-amber-900">Acceso restringido</h2>
        </div>
        <p className="text-sm text-amber-800">
          No tienes permiso para acceder a los ensayos de laboratorio.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <QualityBreadcrumb
        hubName="Operaciones"
        hubHref="/quality/operaciones"
        items={[{ label: 'Ensayos' }]}
      />

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/80 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" />
          <p className="flex-1 text-sm text-red-900">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-red-300 bg-white text-red-800 hover:bg-red-50"
            onClick={() => void handleRefresh()}
          >
            Reintentar
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 md:text-2xl">
            Ensayos de laboratorio
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-sm text-stone-500">Programa de ensayos pendientes</p>
            {currentPlant && (
              <>
                <span className="text-stone-300">·</span>
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-900">
                  {currentPlant.name}
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex max-w-full flex-wrap rounded-lg border border-stone-200 bg-stone-100/80 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'week' ? 'primary' : 'outline'}
              className={cn(
                'h-8 gap-1.5 px-2.5 sm:px-3 rounded-md border-stone-300 shadow-none',
                viewMode === 'week' && qualityHubPrimaryButtonClass
              )}
              onClick={() => {
                setViewMode('week')
                const base = selectedDate ?? new Date()
                setWeekStart(startOfWeek(base, { weekStartsOn: WEEK_STARTS_ON }))
              }}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Semana</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'month' ? 'primary' : 'outline'}
              className={cn(
                'h-8 gap-1.5 px-2.5 sm:px-3 rounded-md border-stone-300 shadow-none',
                viewMode === 'month' && qualityHubPrimaryButtonClass
              )}
              onClick={() => {
                setViewMode('month')
                setCurrentMonth(selectedDate ?? new Date())
              }}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Mes</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'day' ? 'primary' : 'outline'}
              className={cn(
                'h-8 gap-1.5 px-2.5 sm:px-3 rounded-md border-stone-300 shadow-none',
                viewMode === 'day' && qualityHubPrimaryButtonClass
              )}
              onClick={() => {
                setViewMode('day')
                setSelectedDate((d) => d ?? new Date())
              }}
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Día</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              className={cn(
                'h-8 gap-1.5 px-2.5 sm:px-3 rounded-md border-stone-300 shadow-none',
                viewMode === 'list' && qualityHubPrimaryButtonClass
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>
          {canArchive && (
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5 border-stone-300 bg-white px-3 shadow-none hover:bg-stone-50"
              disabled={archiving || loading || !canScope}
              onClick={() => void handleArchiveStale()}
              title="Marcar como no realizadas las muestras pendientes con fecha de ensayo hace más de 60 días"
            >
              <Archive className={cn('h-4 w-4 text-stone-700', archiving && 'animate-pulse')} />
              <span className="hidden sm:inline">Archivar vencidos</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-9 border-stone-300 bg-white px-3 shadow-none hover:bg-stone-50"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading || !canScope}
            aria-label="Actualizar"
          >
            <RefreshCw className={cn('h-4 w-4 text-stone-700', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {!canScope ? (
        <Card className="border-stone-200">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h3 className="mb-2 text-lg font-semibold text-stone-900">No hay planta seleccionada</h3>
            <p className="mx-auto max-w-md text-sm text-stone-600">
              Selecciona una planta en el selector superior o elige una en los filtros para ver ensayos
              pendientes.
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-stone-200 bg-white p-12 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-sky-700" />
          <span className="text-sm text-stone-600">Cargando ensayos pendientes…</span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              id="ensayos-search"
              placeholder="Buscar: muestra, remisión, receta, cliente…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'h-9 min-h-9 min-w-0 flex-1 sm:max-w-md',
                'border-stone-300 bg-white text-stone-900 shadow-none'
              )}
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 min-w-[160px] max-w-[260px] justify-start gap-2 border-stone-300 bg-white px-3 font-normal text-stone-900 shadow-none hover:bg-stone-50"
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-stone-600" />
                  <span className="truncate">{dateRangeButtonLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto border-0 bg-transparent p-0 shadow-none"
                align="start"
              >
                <Calendar
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className="border-stone-200 shadow-md"
                />
              </PopoverContent>
            </Popover>

            {filterPlants.length > 1 && (
              <Select value={planta} onValueChange={setPlanta}>
                <SelectTrigger className={cn(filterSelectClass, 'w-[200px]')}>
                  <SelectValue placeholder="Planta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las plantas</SelectItem>
                  {filterPlants.map((p) => (
                    <SelectItem key={p.id} value={p.code}>
                      <span className="font-mono tabular-nums">{p.code}</span>
                      <span className="text-stone-600"> · {p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={sortOption} onValueChange={(v) => setSortOption(v as EnsayosSortOption)}>
              <SelectTrigger className={cn(filterSelectClass, 'w-[min(100%,220px)] sm:w-[220px]')}>
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fecha_asc">Fecha / hora (próximo primero)</SelectItem>
                <SelectItem value="fecha_desc">Fecha / hora (más lejano primero)</SelectItem>
                <SelectItem value="edad_asc">Edad del concreto (menor)</SelectItem>
                <SelectItem value="edad_desc">Edad del concreto (mayor)</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0 border-stone-300 bg-white px-3 text-stone-800 shadow-none hover:bg-stone-50"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          {viewMode === 'week' && (
            <div className="space-y-5">
              <EnsayosWeekView
                muestras={filteredSorted}
                weekStart={weekStart}
                selectedDate={selectedDate}
                onWeekStartChange={setWeekStart}
                onSelectDate={onSelectDate}
              />
              <EnsayosDaySheet selectedDate={selectedDate} muestrasForDay={muestrasForSelectedDay} />
            </div>
          )}
          {viewMode === 'month' && (
            <div className="space-y-5">
              <EnsayosCalendar
                muestras={filteredSorted}
                currentMonth={currentMonth}
                selectedDate={selectedDate}
                onCurrentMonthChange={setCurrentMonth}
                onSelectDate={onSelectDate}
              />
              <EnsayosDaySheet selectedDate={selectedDate} muestrasForDay={muestrasForSelectedDay} />
            </div>
          )}
          {viewMode === 'day' && selectedDate && (
            <EnsayosDayView
              selectedDate={selectedDate}
              muestrasForDay={muestrasForSelectedDay}
              onPrevDay={() => {
                const d = subDays(selectedDate, 1)
                onSelectDate(d)
              }}
              onNextDay={() => {
                const d = addDays(selectedDate, 1)
                onSelectDate(d)
              }}
              onToday={() => {
                const t = new Date()
                onSelectDate(t)
              }}
            />
          )}
          {viewMode === 'list' && <EnsayosListView muestras={filteredSorted} />}
        </>
      )}
    </div>
  )
}
